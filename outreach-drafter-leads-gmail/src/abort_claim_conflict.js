const errs = $input.all().map(i => i.json?.error ?? i.json);
const msg  = errs.map(e => e?.message ?? String(e)).join(' | ').slice(0, 200);
throw new Error(
  `${errs.length} ledger claim(s) failed — a concurrent run or a stale ledger read is the likely cause. ` +
  `No further drafts were created. Detail: ${msg}`
);
// Unreachable: satisfies n8n-mcp's static "Code must return data" check. A throw
// here is intentional and must terminate the workflow.
return [];
