'use strict';
const express = require('express');
const { filterRecords, exportRecords, resolveAi, createTaskStore } = require('../services/featurePack');
const AI_DEFS = [
  { key: 'margin-risk', title: 'Margin risk', compute: (r) => { const priced=r.filter(x=>Number(x.price)>0); const atRisk=priced.filter(x=>Number(x.cost||0)/Number(x.price)>0.8).length; const avg=priced.length?Math.round(priced.reduce((a,x)=>a+(1-Number(x.cost||0)/Number(x.price)),0)/priced.length*1000)/10:0; return {label:'Margin risk', pricedRecords:priced.length, unpricedRecords:r.length-priced.length, atRiskRecords:atRisk, averageMarginPct:avg}; } },
  { key: 'elasticity-hint', title: 'Elasticity hint', compute: (r) => { return {label:'Elasticity hint', recordsWithPrice:r.filter(x=>Number(x.price)>0).length, recordsWithZeroPrice:r.filter(x=>x.price===0).length, suggestedTestBandPct:r.length?5:0, note:r.length?'Test a small band on priced records first.':'No records to test.'}; } },
  { key: 'discount-guardrail', title: 'Discount guardrail', compute: (r) => { return {label:'Discount guardrail', discountedRecords:r.filter(x=>Number(x.discount)>0).length, undiscountedRecords:r.filter(x=>!Number(x.discount)).length, maxSuggestedDiscountPct:r.length?15:0}; } },
];
module.exports = function createFeaturePackRouter(authenticate, options = {}) {
  const router = express.Router();
  const store = options.store || createTaskStore();
  if (authenticate) router.use(authenticate);
  const userId = (req) => String(req.user?.id ?? req.user?.sub ?? 'anonymous');
  const load = async (req) => store.list(userId(req));
  router.get('/tasks', async (req, res) => res.json({ items: filterRecords(await load(req), req.query) }));
  router.post('/tasks', async (req, res) => { if (!String(req.body?.title || '').trim()) return res.status(400).json({ error: 'title is required' }); return res.status(201).json(store.create(userId(req), req.body)); });
  router.put('/tasks/:id', async (req, res) => { const u = store.update(userId(req), req.params.id, req.body || {}); return u ? res.json(u) : res.status(404).json({ error: 'Task not found' }); });
  router.get('/tasks/export', async (req, res) => { const out = exportRecords(filterRecords(await load(req), req.query), req.query.format); res.setHeader('Content-Type', out.contentType); res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`); return res.send(out.body); });
  router.get('/export', async (req, res) => { const out = exportRecords(filterRecords(await load(req), req.query), req.query.format); res.setHeader('Content-Type', out.contentType); return res.send(out.body); });
  router.post('/ai/:kind', async (req, res) => { const records = Array.isArray(req.body?.records) ? req.body.records : await load(req); const result = await resolveAi(req.params.kind, AI_DEFS, records); return result ? res.json(result) : res.status(404).json({ error: 'Unknown AI feature' }); });
  return router;
};
module.exports.AI_DEFS = AI_DEFS;
