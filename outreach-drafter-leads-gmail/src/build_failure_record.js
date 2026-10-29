const e = $json.execution ?? {};
const w = $json.workflow ?? {};
const msg = String(e.error?.message ?? 'unknown')
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<redacted>')
  .replace(/\s+/g, ' ').slice(0, 200);
return [{ json: {
  run_id: (msg.match(/run_\d{8}_\d{4}/) ?? [null])[0],
  workflow: String(w.name ?? 'unknown').slice(0, 80),
  node: String(e.lastNodeExecuted ?? 'unknown').slice(0, 80),
  error_code: String(e.error?.name ?? e.error?.code ?? 'unknown').slice(0, 60),
  error_message: msg,
}}];
