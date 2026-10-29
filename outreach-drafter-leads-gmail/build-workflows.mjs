// Builder for outreach-drafter-leads-gmail (Parent + Child + Ops).
// Reads Code-node sources from ./src and writes parent.json / child.json / ops.json.
// Deterministic: same inputs => byte-identical output.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(HERE, 'src', f), 'utf8');

let seq = 0;
const uid = () => {
  seq += 1;
  const n = String(seq).padStart(12, '0');
  return `a0000000-0000-4000-8000-${n}`;
};

const node = (name, type, typeVersion, position, parameters = {}, settings = {}) => ({
  parameters,
  id: uid(),
  name,
  type,
  typeVersion,
  position,
  ...settings,
});

let stickySeq = 0;
const sticky = (content, position, width, height, color = 7) => {
  stickySeq += 1;
  return node(`Sticky Note ${stickySeq}`, 'n8n-nodes-base.stickyNote', 1, position,
    { content, height, width, color });
};

const cond = (id, leftValue, operator, rightValue) => ({
  id,
  leftValue,
  ...(rightValue === undefined ? {} : { rightValue }),
  operator,
});

const ifNode = (name, position, conditions, settings = {}) =>
  node(name, 'n8n-nodes-base.if', 2.4, position, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 4 },
      conditions,
      combinator: 'and',
    },
    options: {},
  }, settings);

const code = (name, position, file, settings = {}) =>
  node(name, 'n8n-nodes-base.code', 2, position, {
    jsCode: src(file),
    language: 'javaScript',
    mode: 'runOnceForAllItems',
  }, settings);

const sb = (name, position, parameters, settings = {}) =>
  node(name, 'n8n-nodes-base.supabase', 1, position, {
    authentication: 'secretKey',
    resource: 'row',
    ...parameters,
  }, settings);

const field = (fieldId, fieldValue) => ({ fieldId, fieldValue });
// Supabase v1 nests "Define Below" rows under fieldsUi.fieldValues — a top-level
// `fieldValues` key validates clean and silently writes nothing.
const fields = (pairs) => ({ fieldsUi: { fieldValues: pairs.map(([k, v]) => field(k, v)) } });
const where = (keyName, keyValue, condition = 'eq') => ({
  filterType: 'manual',
  filters: { conditions: [{ keyName, condition, keyValue }] },
});

const main = (targets) => ({ main: [targets.map((n) => ({ node: n, type: 'main', index: 0 }))] });
const two = (ok, err) => ({
  main: [
    ok.map((n) => ({ node: n, type: 'main', index: 0 })),
    err.map((n) => ({ node: n, type: 'main', index: 0 })),
  ],
});
const ai = (target, type) => ({ [type]: [[{ node: target, type, index: 0 }]] });

const settings = {
  executionOrder: 'v1',
  timezone: 'Africa/Lagos',
  saveDataSuccessExecution: 'none',
  saveDataErrorExecution: 'all',
};

// ─────────────────────────────────────────────────────────────────────────────
// PARENT
// ─────────────────────────────────────────────────────────────────────────────
const P = {
  start: '1 Start Batch',
  config: '2 Read Run Config',
  runs: '3 Read Active Runs',
  ledger: '4 Read Ledger Index',
  preflight: '5 Preflight Gate',
  clear: '6 Clear To Run?',
  blockedLog: '6a Log Blocked Run',
  blocked: '7 Run Blocked',
  markRunning: '8 Mark Run Running',
  drive: '9 Download Leads PDF',
  extract: '10 Extract PDF Text',
  parse: '11 Parse & Prepare Leads',
  available: '12 Leads Available?',
  emptyLog: '13 Log Empty Run',
  newOrRetry: '13a New Or Retry?',
  claim: '14 Claim Ledger Rows',
  abort: '15 Abort On Claim Conflict',
  queue: '16 Assemble Dispatch Queue',
  batch: '17 Batch Of 25',
  child: '18 Draft Batch Emails',
  guard: '19 Loop Guard',
  results: '20 Read Run Results',
  summary: '21 Build Run Summary',
  outcome: '22 Log Run Outcome',
};

const parentNodes = [
  node(P.start, 'n8n-nodes-base.manualTrigger', 1, [0, 300], {}),

  sb(P.config, [250, 300], { operation: 'getAll', tableId: 'outreach_config', returnAll: true },
    { alwaysOutputData: true }),

  sb(P.runs, [500, 300], {
    operation: 'getAll', tableId: 'outreach_runs', returnAll: true,
    ...where('status', 'running'),
  }, { alwaysOutputData: true, executeOnce: true }),

  sb(P.ledger, [750, 300], { operation: 'getAll', tableId: 'outreach_ledger', returnAll: true },
    { alwaysOutputData: true, executeOnce: true }),

  code(P.preflight, [1000, 300], 'preflight_gate.js', { onError: 'stopWorkflow' }),

  ifNode(P.clear, [1250, 300], [
    cond('clear-1', '={{ $json.clear_to_run }}', { type: 'boolean', operation: 'true', singleValue: true }),
  ]),

  sb(P.blockedLog, [1500, 500], {
    operation: 'create', tableId: 'outreach_runs', dataToSend: 'defineBelow',
    ...fields([
      ['run_id', '={{ $json.run_id }}'],
      ['status', 'blocked'],
      ['started_at', '={{ $now.toISO() }}'],
      ['finished_at', '={{ $now.toISO() }}'],
      ['blocked_reason', '={{ $json.block_reason }}'],
      ['drafted', '={{ 0 }}'],
      ['failed', '={{ 0 }}'],
      ['valid', '={{ 0 }}'],
      ['total_parsed', '={{ 0 }}'],
      ['duplicates', '={{ 0 }}'],
      ['parse_failures', '={{ 0 }}'],
      ['deferred', '={{ 0 }}'],
    ]),
  }, { onError: 'stopWorkflow', alwaysOutputData: true }),

  node(P.blocked, 'n8n-nodes-base.stopAndError', 1, [1750, 500], {
    errorType: 'errorMessage',
    errorMessage: "=Outreach batch blocked by preflight: {{ $json.blocked_reason ?? $json.block_reason }}. Run {{ $json.run_id ?? '' }} logged status=blocked. No drafts were created.",
  }),

  sb(P.markRunning, [1500, 300], {
    operation: 'create', tableId: 'outreach_runs', dataToSend: 'defineBelow',
    ...fields([
      ['run_id', '={{ $json.run_id }}'],
      ['status', 'running'],
      ['started_at', '={{ $now.toISO() }}'],
    ]),
  }, { onError: 'stopWorkflow', alwaysOutputData: true }),

  node(P.drive, 'n8n-nodes-base.googleDrive', 3, [1750, 300], {
    authentication: 'oAuth2',
    resource: 'file',
    operation: 'download',
    fileId: {
      __rl: true,
      mode: 'id',
      value: "={{ $('Preflight Gate').first().json.drive_file_id }}",
    },
    options: { binaryPropertyName: 'data' },
  }, {
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    onError: 'stopWorkflow',
  }),

  node(P.extract, 'n8n-nodes-base.extractFromFile', 1.2, [2000, 300], {
    operation: 'pdf',
    binaryPropertyName: 'data',
    options: { joinPages: true },
  }, { onError: 'stopWorkflow' }),

  code(P.parse, [2250, 300], 'parse_prepare_leads.js', { onError: 'stopWorkflow' }),

  // IF v2.4 has no `notTrue` operator (validation fails). `notEquals true` against a
  // null-safe boolean is the equivalent: missing __no_leads => leads are available.
  ifNode(P.available, [2500, 300], [
    cond('avail-1', '={{ $json.__no_leads ?? false }}', { type: 'boolean', operation: 'notEquals' }, true),
  ]),

  sb(P.emptyLog, [2500, 500], {
    operation: 'update', tableId: 'outreach_runs', dataToSend: 'defineBelow',
    ...where('run_id', "={{ $('Preflight Gate').first().json.run_id }}"),
    ...fields([
      ['status', 'no_leads'],
      ['finished_at', '={{ $now.toISO() }}'],
      ['blocked_reason', 'no new valid leads after dedupe'],
      ['total_parsed', '={{ $json.__stats?.total_parsed ?? 0 }}'],
      ['parse_failures', '={{ $json.__stats?.parse_failures ?? 0 }}'],
      ['duplicates', '={{ $json.__stats?.duplicates ?? 0 }}'],
      ['deferred', '={{ $json.__stats?.deferred ?? 0 }}'],
      ['valid', '={{ 0 }}'],
    ]),
  }, { alwaysOutputData: true }),

  ifNode(P.newOrRetry, [2750, 300], [
    cond('nr-1', '={{ $json.ledger_state }}', { type: 'string', operation: 'equals' }, 'new'),
  ]),

  sb(P.claim, [3000, 300], {
    operation: 'create', tableId: 'outreach_ledger', dataToSend: 'defineBelow',
    ...fields([
      ['email_hash', '={{ $json.email_hash }}'],
      ['email_domain', '={{ $json.email_domain }}'],
      ['status', 'pending'],
      ['run_id', '={{ $json.run_id }}'],
      ['attempt', '={{ $json.attempt }}'],
      ['updated_at', '={{ $now.toISO() }}'],
    ]),
  }, { onError: 'continueErrorOutput', alwaysOutputData: true }),

  code(P.abort, [3250, 500], 'abort_claim_conflict.js', { onError: 'stopWorkflow' }),

  code(P.queue, [3250, 300], 'assemble_dispatch_queue.js', { onError: 'stopWorkflow' }),

  node(P.batch, 'n8n-nodes-base.splitInBatches', 3, [3500, 300], {
    batchSize: "={{ $('Preflight Gate').first().json.batch_size }}",
    options: { reset: false },
  }),

  node(P.child, 'n8n-nodes-base.executeWorkflow', 1.4, [3750, 300], {
    workflowId: { __rl: true, mode: 'list', value: '', cachedResultName: 'Draft batch outreach emails' },
    mode: 'once',
    options: { waitForSubWorkflow: true },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        run_id: '={{ $json.run_id }}',
        lead_id: '={{ $json.lead_id }}',
        name: '={{ $json.name }}',
        email: '={{ $json.email }}',
        title: '={{ $json.title }}',
        company: '={{ $json.company }}',
        email_hash: '={{ $json.email_hash }}',
        attempt: '={{ $json.attempt }}',
        enrichment_note: '={{ $json.enrichment_note }}',
      },
      matchingColumns: [],
      schema: ['run_id', 'lead_id', 'name', 'email', 'title', 'company', 'email_hash', 'attempt', 'enrichment_note']
        .map((id) => ({
          id,
          displayName: id,
          required: ['run_id', 'lead_id', 'name', 'email', 'email_hash', 'attempt'].includes(id),
          defaultMatch: false,
          display: true,
          canBeUsedToMatch: true,
          type: id === 'attempt' ? 'number' : 'string',
        })),
      attemptToConvertTypes: false,
      convertFieldsToString: false,
    },
  }, {
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    onError: 'stopWorkflow',
  }),

  node(P.guard, 'n8n-nodes-base.limit', 1, [4000, 500], {
    maxItems: 1,
    keep: 'firstItems',
  }, { alwaysOutputData: true }),

  sb(P.results, [4250, 500], {
    operation: 'getAll', tableId: 'outreach_ledger', returnAll: true,
    ...where('run_id', "={{ $('Preflight Gate').first().json.run_id }}"),
  }, { alwaysOutputData: true, executeOnce: true }),

  code(P.summary, [4500, 500], 'build_run_summary.js', { onError: 'stopWorkflow' }),

  sb(P.outcome, [4750, 500], {
    operation: 'update', tableId: 'outreach_runs', dataToSend: 'defineBelow',
    ...where('run_id', '={{ $json.run_id }}'),
    ...fields([
      ['status', '={{ $json.status }}'],
      ['drafted', '={{ $json.drafted }}'],
      ['failed', '={{ $json.failed }}'],
      ['total_parsed', '={{ $json.total_parsed }}'],
      ['valid', '={{ $json.valid }}'],
      ['duplicates', '={{ $json.duplicates }}'],
      ['parse_failures', '={{ $json.parse_failures }}'],
      ['deferred', '={{ $json.deferred }}'],
      ['finished_at', '={{ $now.toISO() }}'],
    ]),
  }, { alwaysOutputData: true, onError: 'stopWorkflow' }),

  // ── Sticky notes ──────────────────────────────────────────────────────────
  sticky(
    '## PHASE 1 · PREFLIGHT & LOCKS\n' +
    'Nodes 1–7. Manual start → Supabase reads (config / active runs / ledger) → one decision gate.\n' +
    '**Fails CLOSED** on: missing or non-`false` kill switch, active run < 4 h, invalid cap, unparseable PDF URL.\n' +
    'Blocked path first writes `outreach_runs.status = blocked`, then throws (loud, legible).',
    [0, 60], 1400, 160, 7),
  sticky(
    '## 🔴 MANUAL CREDENTIALS — PHASE 1\n' +
    '- **Supabase** (`supabaseApi`, secret key `sb_secret_…`): Read Run Config · Read Active Runs · Read Ledger Index · Log Blocked Run · Mark Run Running.\n' +
    '- **Google Drive** (`googleDriveOAuth2Api`, scope `drive.readonly`): Download Leads PDF.\n' +
    '- Publishable / legacy `service_role` keys are NOT accepted. OAuth consent in **Testing** ⇒ refresh token dies in 7 days.',
    [0, 640], 1400, 200, 3),
  sticky(
    '## PHASE 2 · PARSE / CLAIM / QUEUE\n' +
    'Nodes 8–16. PDF binary → text → validated leads → PK claim → dispatch queue.\n' +
    '`__stats` rides on every lead item so the run summary can never over-report.\n' +
    '`13a` routes retries **around** the primary-key claim — that branch is not a dead end.',
    [1450, 60], 1850, 160, 7),
  sticky(
    '## 🔴 MANUAL CREDENTIALS — PHASE 2\n' +
    '- **Supabase** (`supabaseApi`): Claim Ledger Rows (INSERT, PK = `email_hash`) · Read Run Results · Log Run Outcome.\n' +
    '- The primary key **is** the idempotency gate; the §1.4 DDL is not optional.\n' +
    '- Gemini / Gmail credentials are attached in the child workflow, not here.',
    [1450, 640], 1850, 200, 3),
  sticky(
    '## PHASE 3 · BATCH LOOP & RUN LOG\n' +
    'Nodes 17–22. One batch (≤25) in flight at a time → child workflow → summary counted from the ledger.\n' +
    'Loop-back edge: `18 → 17`. Done output: `17 main[0] → 19 Loop Guard` (max 1 item).',
    [3350, 60], 1750, 160, 7),
  sticky(
    '## 🔴 MANUAL CREDENTIALS & WIRING — PHASE 3\n' +
    '- **Supabase** (`supabaseApi`): Log Run Outcome.\n' +
    '- **Child workflow**: `18 Draft Batch Emails` imports with an **empty** `workflowId` — re-pick “Draft batch outreach emails” in the dropdown.\n' +
    '- Assign **`Ops: log outreach failure`** as the Error Workflow (Workflow Settings → UI only).',
    [3350, 640], 1750, 200, 3),
];

const parentConnections = {
  [P.start]: main([P.config]),
  [P.config]: main([P.runs]),
  [P.runs]: main([P.ledger]),
  [P.ledger]: main([P.preflight]),
  [P.preflight]: main([P.clear]),
  [P.clear]: two([P.markRunning], [P.blockedLog]),
  [P.blockedLog]: main([P.blocked]),
  [P.markRunning]: main([P.drive]),
  [P.drive]: main([P.extract]),
  [P.extract]: main([P.parse]),
  [P.parse]: main([P.available]),
  [P.available]: two([P.newOrRetry], [P.emptyLog]),
  [P.newOrRetry]: two([P.claim], [P.queue]),
  [P.claim]: two([P.queue], [P.abort]),
  [P.queue]: main([P.batch]),
  [P.batch]: two([P.guard], [P.child]),
  [P.child]: main([P.batch]),
  [P.guard]: main([P.results]),
  [P.results]: main([P.summary]),
  [P.summary]: main([P.outcome]),
};

const parent = {
  name: 'outreach-drafter-leads-gmail',
  nodes: parentNodes,
  connections: parentConnections,
  settings,
  active: false,
  pinData: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  trigger: '1 When Executed by Another Workflow',
  prompt: '2 Build Email Prompt',
  chain: '3 Write Outreach Emails',
  model: '4 Gemini Flash',
  parser: '5 Email JSON Parser',
  fixer: '6 Gemini Fixer',
  validate: '7 Validate Drafts',
  valid: '8 Drafts Valid?',
  draft: '9 Create Gmail Draft',
  drafted: '10 Mark Rows Drafted',
  success: '11 Return Success',
  failed: '12 Mark Rows Failed',
  failure: '13 Return Failure',
};

const inputTypes = {
  run_id: 'string', lead_id: 'string', name: 'string', email: 'string',
  title: 'string', company: 'string', email_hash: 'string',
  attempt: 'number', enrichment_note: 'string',
};

const childNodes = [
  node(C.trigger, 'n8n-nodes-base.executeWorkflowTrigger', 1.3, [0, 400], {
    inputSource: 'workflowInputs',
    workflowInputs: {
      values: Object.entries(inputTypes).map(([name, type]) => ({ name, type })),
    },
  }),

  code(C.prompt, [250, 400], 'build_email_prompt.js', { onError: 'stopWorkflow' }),

  node(C.chain, '@n8n/n8n-nodes-langchain.chainLlm', 1.9, [500, 400], {
    promptType: 'define',
    text: '={{ $json.prompt }}',
    hasOutputParser: true,
    batching: { batchSize: 5, delayBetweenBatches: 1000 },
  }, {
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
  }),

  node(C.model, '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', 1.2, [500, 80], {
    modelName: 'models/gemini-3-flash-preview',
    options: { temperature: 0.4 },
  }),

  node(C.parser, '@n8n/n8n-nodes-langchain.outputParserStructured', 1.3, [750, 80], {
    schemaType: 'manual',
    inputSchema: JSON.stringify({
      type: 'object',
      properties: {
        subject: { type: 'string', minLength: 3, maxLength: 78 },
        body: { type: 'string', minLength: 200, maxLength: 1500 },
      },
      required: ['subject', 'body'],
      additionalProperties: false,
    }, null, 2),
    autoFix: true,
    customizeRetryPrompt: false,
  }),

  node(C.fixer, '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', 1.2, [1000, 80], {
    modelName: 'models/gemini-3-flash-preview',
    options: { temperature: 0 },
  }),

  code(C.validate, [750, 400], 'validate_drafts.js', { onError: 'stopWorkflow' }),

  ifNode(C.valid, [1000, 400], [
    cond('valid-1', '={{ $json.valid }}', { type: 'boolean', operation: 'true', singleValue: true }),
  ]),

  node(C.draft, 'n8n-nodes-base.gmail', 2.2, [1250, 400], {
    resource: 'draft',
    operation: 'create',
    subject: '={{ $json.subject }}',
    emailType: 'html',
    message: "={{ $json.body.replace(/\\n/g, '<br>') }}",
    // v2.2 draft/create has NO top-level sendTo: the recipient lives in options.sendTo.
    options: { sendTo: '={{ $json.email }}' },
  }, {
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
  }),

  sb(C.drafted, [1500, 400], {
    operation: 'update', tableId: 'outreach_ledger', dataToSend: 'defineBelow',
    ...where('email_hash', "={{ $('Validate Drafts').all()[$itemIndex]?.json.email_hash }}"),
    ...fields([
      ['status', 'done'],
      ['draft_id', '={{ $json.id }}'],
      ['run_id', "={{ $('Validate Drafts').all()[$itemIndex]?.json.run_id }}"],
      ['attempt', "={{ ($('Validate Drafts').all()[$itemIndex]?.json.attempt ?? 0) + 1 }}"],
      ['updated_at', '={{ $now.toISO() }}'],
      ['note', '={{ null }}'],
    ]),
  }, { onError: 'stopWorkflow', alwaysOutputData: true }),

  node(C.success, 'n8n-nodes-base.set', 3.5, [1750, 400], {
    mode: 'manual',
    includeOtherFields: false,
    assignments: {
      assignments: [
        { id: 's-1', name: 'ok', value: true, type: 'boolean' },
        { id: 's-2', name: 'status', value: 'done', type: 'string' },
        { id: 's-3', name: 'email_hash', value: "={{ $('Validate Drafts').all()[$itemIndex]?.json.email_hash }}", type: 'string' },
        { id: 's-4', name: 'draft_id', value: '={{ $json.id }}', type: 'string' },
        { id: 's-5', name: 'error', value: '={{ null }}', type: 'string' },
      ],
    },
  }),

  sb(C.failed, [1250, 600], {
    operation: 'update', tableId: 'outreach_ledger', dataToSend: 'defineBelow',
    ...where('email_hash', "={{ $('Validate Drafts').all()[$itemIndex]?.json.email_hash }}"),
    ...fields([
      ['status', 'failed'],
      ['note', "={{ ($json.reason || $json.error?.message || 'unknown').slice(0,200).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '<redacted>') }}"],
      ['attempt', "={{ ($('Validate Drafts').all()[$itemIndex]?.json.attempt ?? 0) + 1 }}"],
      ['updated_at', '={{ $now.toISO() }}'],
    ]),
  }, { onError: 'stopWorkflow', alwaysOutputData: true }),

  node(C.failure, 'n8n-nodes-base.set', 3.5, [1500, 600], {
    mode: 'manual',
    includeOtherFields: false,
    assignments: {
      assignments: [
        { id: 'f-1', name: 'ok', value: false, type: 'boolean' },
        { id: 'f-2', name: 'status', value: 'failed', type: 'string' },
        { id: 'f-3', name: 'email_hash', value: "={{ $json.email_hash ?? '' }}", type: 'string' },
        { id: 'f-4', name: 'draft_id', value: '={{ null }}', type: 'string' },
        { id: 'f-5', name: 'error', value: "={{ ($json.reason || $json.error?.message || 'unknown').slice(0,200) }}", type: 'string' },
      ],
    },
  }),

  // ── Sticky notes ──────────────────────────────────────────────────────────
  sticky(
    '## PHASE 1 · PROMPT & GENERATION\n' +
    'Nodes 1–3. Typed trigger (one item per lead, ≤25) → tag-delimited prompt → Basic LLM Chain.\n' +
    'Untrusted PDF text is wrapped in `<lead_field>` and declared DATA, never instructions.\n' +
    'Batching 5 / 1 s spaces the Gemini calls; retry 3× on 429.',
    [0, 220], 900, 130, 7),
  sticky(
    '## PHASE 2 · VALIDATE & CREATE DRAFT\n' +
    'Nodes 7–13. Index-paired re-attach of lead identity → content rules → `gmail draft.create`.\n' +
    'A rejected draft is quarantined with a reason code; `done` is written only after Gmail returns an `id`.',
    [950, 220], 1000, 130, 7),
  sticky(
    '## 🔴 MANUAL CREDENTIALS (attach in the n8n UI)\n' +
    '- **Gemini** (`googlePalmApi`, paid tier): `4 Gemini Flash`, `6 Gemini Fixer` (auto-fix only fires on parse failure).\n' +
    '- **Gmail** (`gmailOAuth2`, scope `gmail.compose`): `9 Create Gmail Draft` — drafts only, no send node exists.\n' +
    '- **Supabase** (`supabaseApi`, secret key): `10 Mark Rows Drafted`, `12 Mark Rows Failed`.',
    [0, 740], 1950, 180, 3),
];

const childConnections = {
  [C.trigger]: main([C.prompt]),
  [C.prompt]: main([C.chain]),
  [C.chain]: two([C.validate], [C.failed]),
  [C.model]: ai(C.chain, 'ai_languageModel'),
  [C.parser]: ai(C.chain, 'ai_outputParser'),
  [C.fixer]: ai(C.parser, 'ai_languageModel'),
  [C.validate]: main([C.valid]),
  [C.valid]: two([C.draft], [C.failed]),
  [C.draft]: two([C.drafted], [C.failed]),
  [C.drafted]: main([C.success]),
  [C.failed]: main([C.failure]),
};

const child = {
  name: 'Draft batch outreach emails',
  nodes: childNodes,
  connections: childConnections,
  settings,
  active: false,
  pinData: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// OPS
// ─────────────────────────────────────────────────────────────────────────────
const O = {
  trigger: '1 Error Trigger',
  build: '2 Build Failure Record',
  log: '3 Log Failure',
};

const opsNodes = [
  node(O.trigger, 'n8n-nodes-base.errorTrigger', 1, [0, 300], {}),
  code(O.build, [250, 300], 'build_failure_record.js', {}),
  sb(O.log, [500, 300], {
    operation: 'create', tableId: 'outreach_failures', dataToSend: 'defineBelow',
    ...fields([
      ['run_id', '={{ $json.run_id }}'],
      ['workflow', '={{ $json.workflow }}'],
      ['node', '={{ $json.node }}'],
      ['error_code', '={{ $json.error_code }}'],
      ['error_message', '={{ $json.error_message }}'],
      ['occurred_at', '={{ $now.toISO() }}'],
    ]),
  }, { alwaysOutputData: true, onError: 'stopWorkflow' }),

  sticky(
    '## PHASE 1 · FAILURE CAPTURE\n' +
    'Catch-all sink for anything that escapes per-node handling. Writes Postgres, never Gmail — recursion-safe.\n' +
    '**Must be assigned as the Error Workflow** on BOTH the parent and the child (Workflow Settings → UI only).',
    [0, 60], 800, 160, 7),
  sticky(
    '## 🔴 MANUAL CREDENTIALS\n' +
    '- **Supabase** (`supabaseApi`, secret key): `3 Log Failure` → `outreach_failures`.\n' +
    '- Redacts email-shaped substrings and caps the message at 200 chars before any write.',
    [0, 420], 800, 160, 3),
];

const ops = {
  name: 'Ops: log outreach failure',
  nodes: opsNodes,
  connections: {
    [O.trigger]: main([O.build]),
    [O.build]: main([O.log]),
  },
  settings,
  active: false,
  pinData: {},
};

writeFileSync(join(HERE, 'parent.json'), JSON.stringify(parent, null, 2) + '\n');
writeFileSync(join(HERE, 'child.json'), JSON.stringify(child, null, 2) + '\n');
writeFileSync(join(HERE, 'ops.json'), JSON.stringify(ops, null, 2) + '\n');

console.log('parent:', parentNodes.length, 'nodes');
console.log('child:', childNodes.length, 'nodes');
console.log('ops:', opsNodes.length, 'nodes');
