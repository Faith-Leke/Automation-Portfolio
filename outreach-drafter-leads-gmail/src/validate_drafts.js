const leads = $('When Executed by Another Workflow').all().map(i => i.json);
const items = $input.all();

// E10: refuse to guess. A length mismatch would shift every draft onto the wrong person.
if (leads.length !== items.length) {
  throw new Error(`Pairing failure: ${leads.length} leads vs ${items.length} drafts. Refusing to guess who receives what.`);
}

const BANNED = /\b(guarantee|guaranteed|discount|invoice|refund|100%|risk-free)\b/i;
const URLISH = /(https?:\/\/|www\.)/i;
const EMAILISH = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

return items.map((it, i) => {
  const lead = leads[i];
  const out  = it.json?.output ?? it.json ?? {};
  const subject = String(out.subject ?? '').replace(/\s+/g, ' ').trim();
  const body    = String(out.body ?? '').trim();
  const words   = body.split(/\s+/).filter(Boolean).length;

  const reasons = [];
  if (!subject || subject.length < 3 || subject.length > 78) reasons.push('subject_length');
  if (/[\r\n]/.test(subject)) reasons.push('subject_multiline');
  if (words < 60 || words > 180) reasons.push(`body_words=${words}`);
  if (/\{\{|\}\}|\[[A-Z_]+\]|<lead_field/.test(body)) reasons.push('placeholder_residue');
  if (URLISH.test(body) || URLISH.test(subject)) reasons.push('url_present');
  if (BANNED.test(body)) reasons.push('commitment_language');
  if (/\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/.test(body)) reasons.push('phone_present');
  const others = (body.match(EMAILISH) ?? []).filter(e =>
    e.toLowerCase() !== String(lead.email).toLowerCase());
  if (others.length) reasons.push('foreign_email');

  const first = String(lead.name ?? '').split(' ')[0].toLowerCase();
  if (first && !body.toLowerCase().includes(first)) reasons.push('no_first_name');

  return { json: {
    run_id: lead.run_id, lead_id: lead.lead_id, name: lead.name,
    email: lead.email, email_hash: lead.email_hash,
    attempt: Number(lead.attempt ?? 0),
    subject, body, valid: reasons.length === 0, reason: reasons.join(','),
  }};
});
