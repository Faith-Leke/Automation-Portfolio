const gate = $('Preflight Gate').first().json;
const rows = $input.all().map(i => i.json).filter(r => r && r.email_hash);
const count = s => rows.filter(r => r.status === s).length;
const drafted = count('done'), failed = count('failed'), pending = count('pending');

// Parse-time counters come from Node 11, which is the only node that knows them.
// P21 must NOT reconstruct them from the ledger — the ledger has no idea how many
// rows the PDF contained or how many were unreadable.
const stats = $('Parse & Prepare Leads').first()?.json?.__stats ?? {};

return [{ json: {
  run_id: gate.run_id,
  status: drafted === 0 ? 'failed' : 'completed',
  drafted, failed, pending,
  total_parsed:   stats.total_parsed   ?? 0,
  valid:          stats.valid          ?? rows.length,
  duplicates:     stats.duplicates     ?? 0,
  parse_failures: stats.parse_failures ?? 0,
  deferred:       stats.deferred       ?? 0,
}}];
