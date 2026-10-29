// Run Once for All Items. Emits exactly one item per lead, in order.
// The key table is read by node 3 (executeOnce); this node only decides who uses which key.
//
// Two invariants live here:
// 1. BUDGET GATE (all or nothing). Total remaining calls across every key must cover every
//    lead. If it does not, throw before spending anything. A partial batch is not an option:
//    7 Validate Drafts throws when items.length !== leads.length.
// 2. MONOTONIC USAGE. The key table is a cached snapshot, so every item on a key would
//    otherwise compute the same `daily_usage + 1` and all those increments would collapse
//    into one. Each item records its own running ordinal for that key instead.
const DAILY_LIMIT = 19;

const keys = $('3 Fetch Gemini Keys').all()
  .map(i => i.json)
  .filter(k => k && k.api_key)
  .map(k => {
    const base = parseInt(k.daily_usage, 10) || 0;
    return {
      id: k.id,
      api_key: k.api_key,
      base,
      remaining: Math.max(0, DAILY_LIMIT - base),
      taken: 0,
    };
  })
  .filter(k => k.remaining > 0);

if (!keys.length) {
  throw new Error(
    'STOP: no usable Gemini keys. The table is empty or every key has daily_usage >= ' +
    DAILY_LIMIT + '. Nothing was spent.'
  );
}

const leads = $('2 Build Email Prompt').all();
const capacity = keys.reduce((sum, k) => sum + k.remaining, 0);

if (capacity < leads.length) {
  throw new Error(
    'STOP: ' + leads.length + ' leads need ' + leads.length + ' Gemini calls, but only ' +
    capacity + ' remain across ' + keys.length + ' key(s) (limit ' + DAILY_LIMIT +
    '/key/day). Add keys or reset daily_usage in Supabase. Nothing was spent.'
  );
}

// Round-robin across keys, but each key stops when its own budget is spent, so an uneven
// table (18 / 18 / 0) can never push a key past the daily limit.
const alloc = [];
while (alloc.length < leads.length) {
  let progressed = false;
  for (const k of keys) {
    if (alloc.length >= leads.length) break;
    if (k.taken < k.remaining) {
      k.taken += 1;
      alloc.push({ k, usage: k.base + k.taken });
      progressed = true;
    }
  }
  if (!progressed) break;
}

return leads.map(({ json }, i) => ({
  json: {
    ...json,                       // REQUIRED: keeps prompt_json for the HTTP body
    api_key: alloc[i].k.api_key,
    key_row_id: alloc[i].k.id,
    new_usage_count: alloc[i].usage,
  },
}));
