const cfgArr = $('Read Run Config').all().map(i => i.json).filter(r => r && r.key);
const cfg = Object.fromEntries(cfgArr.map(r => [r.key, String(r.value).trim()]));
const runs   = $('Read Active Runs').all().map(i => i.json).filter(r => r && r.run_id);
const ledger = $('Read Ledger Index').all().map(i => i.json).filter(r => r && r.email_hash);

const MIN = 1000 * 60;
const now = Date.now();
const runId = 'run_' + DateTime.now().toFormat('yyyyMMdd_HHmm');

const block = [];
if (cfg.kill_switch !== 'false') block.push('kill_switch=' + (cfg.kill_switch ?? 'MISSING'));
const active = runs.filter(r => r.status === 'running' &&
  now - new Date(r.started_at).getTime() < 4 * 60 * MIN);
if (active.length) block.push('active_run=' + active[0].run_id);

const maxDrafts = Number(cfg.max_drafts_per_run ?? NaN);
if (!Number.isFinite(maxDrafts) || maxDrafts < 1) block.push('max_drafts_per_run invalid');

const url = cfg.leads_pdf_url ?? '';
const m = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
if (!m) block.push('leads_pdf_url unparseable');

return [{ json: {
  clear_to_run: block.length === 0,
  block_reason: block.join('; '),
  run_id: runId,
  max_drafts: maxDrafts,
  batch_size: Number(cfg.batch_size ?? 25),
  max_parse_failure_pct: Number(cfg.max_parse_failure_pct ?? 2),
  drive_file_id: m ? m[1] : null,
  // Full ledger rows. Dedupe AND retry eligibility are both decided in Node 11,
  // so exactly one node owns the "new / done / retryable" policy.
  ledger_rows: ledger,
}}];
