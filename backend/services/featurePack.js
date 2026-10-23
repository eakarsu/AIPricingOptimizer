'use strict';
// FP42C: pure helpers — search/filter, CSV/JSON export, labelled AI fallback.
function hasProvider(env = process.env) { return Boolean(env.OPENROUTER_API_KEY || env.OPENAI_API_KEY); }
function providerName(env = process.env) { return env.OPENROUTER_API_KEY ? 'openrouter' : (env.OPENAI_API_KEY ? 'openai' : null); }
function textOf(r) { return [r.title, r.name, r.description, r.sku, r.category, r.status].filter((v) => v !== undefined && v !== null).join(' ').toLowerCase(); }
function filterRecords(records, query = {}) {
  const search = String(query.search || query.q || '').trim().toLowerCase();
  return (records || []).filter((r) => {
    if (search && !textOf(r).includes(search)) return false;
    if (query.status && String(r.status ?? '') !== String(query.status)) return false;
    if (query.priority && String(r.priority ?? '') !== String(query.priority)) return false;
    if (query.category && String(r.category ?? '') !== String(query.category)) return false;
    if (query.stage && String(r.stage ?? '') !== String(query.stage)) return false;
    return true;
  }).map((r) => ({ ...r })); // preserve false/0/'' keys
}
function csvCell(v) { if (v === null || v === undefined) return ''; if (typeof v === 'object') v = JSON.stringify(v); return `"${String(v).replace(/"/g, '""')}"`; }
function toCSV(records) {
  const keys = [...new Set((records || []).flatMap((r) => Object.keys(r || {})))];
  if (!keys.length) return '';
  return [keys.join(','), ...(records || []).map((r) => keys.map((k) => csvCell(r[k])).join(','))].join('\n');
}
function exportRecords(records, format = 'json') {
  return String(format).toLowerCase() === 'csv'
    ? { contentType: 'text/csv', body: toCSV(records), filename: 'export.csv' }
    : { contentType: 'application/json', body: JSON.stringify(records ?? [], null, 2), filename: 'export.json' };
}
function overview(records) {
  const byStatus = {};
  for (const r of records || []) { const s = String(r.status ?? ''); byStatus[s] = (byStatus[s] || 0) + 1; }
  return { totalRecords: (records || []).length, byStatus, emptyRecords: (records || []).length === 0 };
}
async function resolveAi(kind, defs, records, env = process.env) {
  const def = defs.find((d) => d.key === kind);
  if (!def) return null;
  const sections = { Overview: overview(records), [def.title]: def.compute(records || []) };
  const key = env.OPENROUTER_API_KEY || env.OPENAI_API_KEY;
  if (key) {
    try {
      const isOpenRouter = Boolean(env.OPENROUTER_API_KEY);
      const url = isOpenRouter ? `${(env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.OPENROUTER_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: `${def.title} over records: ${JSON.stringify(records).slice(0, 4000)}` }] }) });
      if (!res.ok) throw new Error(`provider HTTP ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('provider empty response');
      return { aiGenerated: true, provider: providerName(env), label: `AI-generated (${providerName(env)})`, kind, sections: { ...sections, 'Provider response': content } };
    } catch (_e) { /* fall through to deterministic fallback */ }
  }
  return { aiGenerated: false, provider: 'deterministic-fallback', label: 'Deterministic fallback — no AI provider configured or provider unavailable (aiGenerated: false)', kind, sections };
}
function createTaskStore() {
  let nextId = 1; const byUser = new Map();
  const bucket = (u) => { if (!byUser.has(u)) byUser.set(u, new Map()); return byUser.get(u); };
  return {
    list: (u) => [...bucket(u).values()].map((r) => ({ ...r })),
    create: (u, body) => { const t = { id: nextId++, title: String(body.title).trim(), description: body.description ?? '', status: body.status || 'todo', priority: body.priority || 'medium', category: body.category ?? '', score: body.score ?? 0, flagged: body.flagged ?? false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; bucket(u).set(t.id, t); return { ...t }; },
    update: (u, id, body) => { const t = bucket(u).get(Number(id)); if (!t) return null; for (const k of ['title','description','status','priority','category','score','flagged']) if (body[k] !== undefined) t[k] = body[k]; t.updated_at = new Date().toISOString(); return { ...t }; },
  };
}
module.exports = { hasProvider, providerName, filterRecords, toCSV, exportRecords, overview, resolveAi, createTaskStore };
