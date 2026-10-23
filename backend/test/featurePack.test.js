'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const express = require('express');
const { filterRecords, exportRecords } = require('../services/featurePack');
const createRouter = require('../routes/featurePack');
const fakeAuth = (req, res, next) => { if (!req.headers['x-user']) return res.status(401).json({ error: 'unauthorized' }); req.user = { id: req.headers['x-user'] }; next(); };
async function withServer(fn) { const app = express(); app.use(express.json()); app.use('/fp', createRouter(fakeAuth)); const s = app.listen(0); try { await fn(`http://127.0.0.1:${s.address().port}`); } finally { s.close(); } }
test('filter preserves false/0/empty and csv export keeps them', () => {
  const rows = [{ title: 'Alpha shoe', status: 'todo', price: 0, flagged: false, description: '' }, { title: 'Beta', status: 'done', price: 10, flagged: true, description: 'x' }];
  assert.equal(filterRecords(rows, { search: 'alpha' })[0].flagged, false);
  assert.equal(filterRecords(rows, { search: 'alpha' })[0].price, 0);
  const csv = exportRecords(rows, 'csv'); assert.match(csv.body, /false/); assert.match(csv.body, /"0"/);
  assert.equal(JSON.parse(exportRecords(rows, 'json').body).length, 2);
});
test('tasks CRUD/search/export and AI fallback', async () => {
  delete process.env.OPENROUTER_API_KEY; delete process.env.OPENAI_API_KEY;
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/fp/tasks`)).status, 401);
    const h = { 'x-user': 'u1', 'content-type': 'application/json' };
    const created = await (await fetch(`${base}/fp/tasks`, { method: 'POST', headers: h, body: JSON.stringify({ title: 'Reprice Alpha', price: 100, cost: 90 }) })).json();
    assert.equal(created.title, 'Reprice Alpha');
    const list = await (await fetch(`${base}/fp/tasks?search=reprice`, { headers: h })).json(); assert.equal(list.items.length, 1);
    const upd = await (await fetch(`${base}/fp/tasks/${created.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ status: 'done' }) })).json(); assert.equal(upd.status, 'done');
    const csv = await fetch(`${base}/fp/tasks/export?format=csv`, { headers: h }); assert.match(csv.headers.get('content-type'), /text\/csv/); assert.match(await csv.text(), /Reprice Alpha/);
    const ai = await (await fetch(`${base}/fp/ai/margin-risk`, { method: 'POST', headers: h, body: JSON.stringify({ records: [{ title: 'A', price: 100, cost: 90 }, { title: 'B', price: 0, flagged: false }] }) })).json();
    assert.equal(ai.aiGenerated, false); assert.ok(ai.sections.Overview); assert.ok(ai.sections['Margin risk']); assert.equal(ai.sections['Margin risk'].unpricedRecords, 1);
  });
});
