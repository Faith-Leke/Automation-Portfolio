const gate  = $('Preflight Gate').first().json;
const leads = $('Parse & Prepare Leads').all().map(i => i.json)
                .filter(r => r && r.email_hash);
const byHash = new Map(leads.map(l => [l.email_hash, l]));

// Two item kinds arrive here. Claim rows come back from Supabase and carry no
// ledger_state; retry leads come from 13a and are still tagged. That is the
// discriminator — no node references, no try/catch, works even when 14 never ran.
const input   = $input.all().map(i => i.json ?? {});
const claimed = input.filter(j => !j.ledger_state && j.email_hash).map(j => j.email_hash);
const retries = input.filter(j => j.ledger_state === 'retry' && j.email_hash);

const claimedSet = new Set(claimed);
const queue = [];
for (const h of claimed) {
  const l = byHash.get(h);
  if (l) queue.push({ ...l, attempt: 0 });
}
for (const r of retries) {
  if (claimedSet.has(r.email_hash)) continue;
  queue.push({ ...r });
}

// Guards the one case the DB cannot: a lead that appears as both a fresh claim and a
// retry. De-duplicating here is cheaper than a second PK collision.
const seen = new Set();
const final = queue.filter(q => {
  if (seen.has(q.email_hash)) return false;
  seen.add(q.email_hash);
  return true;
});

if (!final.length) {
  throw new Error('Dispatch queue is empty: every claim failed to join back to a parsed lead. Refusing to stall the loop.');
}

return final.map(q => ({ json: {
  run_id: gate.run_id, lead_id: q.lead_id, name: q.name, email: q.email,
  title: q.title ?? '', company: q.company ?? '',
  email_hash: q.email_hash, attempt: Number(q.attempt ?? 0), enrichment_note: '',
}}));
