// SHA-256 (pure JS). `require('crypto')` is NOT available in the Code node unless the
// instance allowlists the module, so the hash is computed inline. Input here is always
// an ASCII email address, which is all this implementation needs to support.
function sha256hex(ascii) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;
  const hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0, 8);
    const h = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = h[0];
      const e = h[4];
      const temp1 = h[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & h[5]) ^ (~e & h[6]))
        + k[i]
        + (w[i] = i < 16 ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
      h.unshift((temp1 + temp2) | 0);
      h.length = 9;
      h[4] = (h[4] + temp1) | 0;
      h.length = 8;
    }
    for (let i = 0; i < 8; i++) hash[i] = (h[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

const gate = $('Preflight Gate').first().json;
const raw = ($json.text ?? '').replace(/\r/g, '');

// Full ledger rows, keyed by hash — the single source of dedupe AND retry state.
const prior = new Map((gate.ledger_rows ?? []).map(r => [r.email_hash, r]));
const MIN = 1000 * 60;

const clean = s => String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ').trim();
const cap = (s, n) => clean(s).slice(0, n);
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Row shape: "<serial> <name> <email> <title> <company>"
const rows = raw.split('\n').map(l => l.trim()).filter(Boolean)
  .filter(l => !/^s\/?no\.?\s+name\s+emai?l/i.test(l));       // header, incl. the "Emai" typo

const seen = new Set();
const out = [];
let parseFailures = 0, duplicates = 0, notRetryable = 0;

for (const line of rows) {
  const m = line.match(/^(\d{1,6})\s+(.*)$/);
  if (!m) { parseFailures++; continue; }
  const body = m[2];
  const em = body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (!em || !EMAIL.test(em[0])) { parseFailures++; continue; }

  const email = em[0].toLowerCase();
  const before = body.slice(0, body.indexOf(em[0])).trim();          // name
  const after  = body.slice(body.indexOf(em[0]) + em[0].length).trim(); // title + company
  if (!before) { parseFailures++; continue; }

  const parts = after ? after.split(/\s{2,}|\s*[|•·]\s*/).filter(Boolean) : [];
  const title   = cap(parts[0] ?? '', 120);
  const company = cap(parts.slice(1).join(' ') || '', 120);

  const hash = sha256hex(email);
  if (!hash) { parseFailures++; continue; }

  if (seen.has(hash)) { duplicates++; continue; }          // repeated inside this PDF
  seen.add(hash);

  const p = prior.get(hash);
  if (p?.status === 'done') { duplicates++; continue; }    // finished in an earlier run

  // A prior row that failed, or is a stale pending claim, is retried — but only while
  // attempt < 2, so a permanently bad lead cannot be retried forever.
  let ledgerState = 'new', attempt = 0;
  if (p) {
    const stale = Date.now() - new Date(p.updated_at ?? 0).getTime() > 120 * MIN;
    const eligible = Number(p.attempt ?? 0) < 2 &&
      (p.status === 'failed' || (p.status === 'pending' && stale));
    if (!eligible) { notRetryable++; continue; }
    ledgerState = 'retry';
    attempt = Number(p.attempt ?? 0);
  }

  out.push({ json: {
    lead_id: m[1], name: cap(before, 80), email,
    title: cap(title, 120), company: cap(company, 120),
    email_hash: hash, email_domain: email.split('@')[1],
    run_id: gate.run_id, attempt, enrichment_note: '',
    ledger_state: ledgerState,
  }});
}

const pct = rows.length ? (parseFailures / rows.length) * 100 : 100;
if (rows.length === 0 || pct > (gate.max_parse_failure_pct ?? 2)) {
  throw new Error(`Parse gate failed: ${parseFailures}/${rows.length} rows unparsed (${pct.toFixed(1)}%). No drafts created.`);
}

// `max_drafts` is a hard ceiling on the run — retries included. Retries are emitted
// first so fresh work cannot starve leftover work; `attempt < 2` bounds that to at
// most two runs. Anything not emitted stays unclaimed (new) or retryable (failed),
// so a later run picks it up on its own.
const newLeads   = out.filter(r => r.json.ledger_state === 'new');
const retryLeads = out.filter(r => r.json.ledger_state === 'retry');
const budget     = Math.max(1, Number(gate.max_drafts ?? 25));
const emitted    = [...retryLeads, ...newLeads].slice(0, budget);
const keptNew    = emitted.filter(r => r.json.ledger_state === 'new').length;
const deferred   = newLeads.length - keptNew;

const stats = {
  total_parsed:   rows.length,
  parse_failures: parseFailures,
  duplicates,
  not_retryable:  notRetryable,
  deferred,
  valid: emitted.length,
};

if (!emitted.length) return [{ json: { __no_leads: true, __stats: stats } }];
return emitted.map(r => ({ json: { ...r.json, __stats: stats } }));
