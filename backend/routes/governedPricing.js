'use strict';

const express = require('express');
const pool = require('../db');
const { assignExperimentUnit, authorizeTransition, digest, evaluateExperiment, recommendPrice, validateExperiment, validateSnapshot } = require('../domain/pricingPolicy');
const { providerReadiness, requireProviders } = require('../services/providerBoundary');

async function callOpenRouter(messages) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');
  const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 1200,
    }),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message || `OpenRouter returned HTTP ${response.status}`);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('OpenRouter returned an empty response');
  return { content, model: data.model || process.env.OPENROUTER_MODEL };
}

function parseAiJson(content) {
  try { return JSON.parse(content); } catch (_error) {}
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch (_error) {} }
  const object = content.match(/\{[\s\S]*\}/);
  if (object) { try { return JSON.parse(object[0]); } catch (_error) {} }
  return { analysis: content };
}

module.exports = function buildRouter(authenticate) {
  const router = express.Router();
  router.use(authenticate);
  const tenant = (req) => String(req.user.tenantId);
  const roles = (...allowed) => (req, res, next) => allowed.includes(req.user.role) ? next() : res.status(403).json({ error: 'Insufficient pricing role' });
  async function tx(work) { const client = await pool.connect(); try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  function fail(res, error, fallback) { if (error.code === '23505') return res.status(409).json({ error: 'Version or idempotency conflict' }); if (error.code === 'PROVIDER_NOT_READY') return res.status(503).json({ error: error.message }); const status = error.status || (/required|invalid|must|cannot|conflict|outside|exceeds|allowed/.test(error.message) ? 422 : 500); return res.status(status).json({ error: status === 500 ? fallback : error.message }); }
  async function event(client, req, recommendationId, type, payload, evidenceDigest = null) { await client.query(`INSERT INTO pricing_events(tenant_id,recommendation_id,actor_id,event_type,payload,evidence_digest) VALUES($1,$2,$3,$4,$5,$6)`, [tenant(req), recommendationId || null, req.user.id, type, payload || {}, evidenceDigest]); }

  router.get('/providers/readiness', roles('pricing_analyst', 'pricing_approver', 'auditor', 'admin'), (_req, res) => { const result = providerReadiness(); res.status(result.ready ? 200 : 503).json(result); });

  router.post('/ai/recommendation-analysis', roles('pricing_analyst', 'admin'), async (req, res) => {
    try {
      const input = req.body || {};
      if (!String(input.sku || '').trim() || !Number.isInteger(input.currentPriceMinor) || !Number.isInteger(input.unitCostMinor)) {
        return res.status(422).json({ error: 'sku, currentPriceMinor, and unitCostMinor are required' });
      }
      const ai = await callOpenRouter([
        {
          role: 'system',
          content: 'You are a pricing decision-support analyst. You never execute a price change. Return strict JSON with summary, recommended_price_minor, rationale, guardrails, risks, and required_human_review.',
        },
        { role: 'user', content: `Analyze this governed pricing scenario and return JSON only: ${JSON.stringify(input)}` },
      ]);
      const analysis = parseAiJson(ai.content);
      await pool.query(
        `INSERT INTO pricing_ai_analyses(tenant_id,actor_id,request,response,model)
         VALUES($1,$2,$3,$4,$5)`,
        [tenant(req), req.user.id, input, analysis, ai.model]
      );
      return res.json({ analysis, model: ai.model, automaticExecution: false });
    } catch (error) {
      return fail(res, error, 'Pricing AI analysis failed');
    }
  });

  router.post('/snapshots', roles('pricing_analyst', 'admin'), async (req, res) => {
    try {
      const key = String(req.get('Idempotency-Key') || '').trim();
      if (!key) return res.status(400).json({ error: 'Idempotency-Key is required' });
      requireProviders(['commerce', 'pos', 'erp', 'inventory', 'crm', 'market_data']);
      const snapshot = { ...req.body, tenantId: tenant(req) };
      const validation = validateSnapshot(snapshot);
      if (!validation.ok) return res.status(422).json({ error: 'Pricing snapshot rejected', details: validation.errors });
      const result = await tx(async (client) => {
        const replay = await client.query('SELECT * FROM pricing_snapshots WHERE tenant_id=$1 AND idempotency_key=$2', [tenant(req), key]);
        if (replay.rows[0]) return { snapshot: replay.rows[0], replayed: true };
        const inserted = await client.query(
          `INSERT INTO pricing_snapshots(tenant_id,idempotency_key,snapshot_ref,version,sku,as_of,currency,snapshot,snapshot_digest,created_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [tenant(req), key, snapshot.snapshotId, snapshot.version, snapshot.sku, snapshot.asOf, snapshot.currency, snapshot, validation.snapshotDigest, req.user.id]
        );
        for (const name of Object.keys(snapshot.sources)) await client.query(
          `INSERT INTO pricing_source_evidence(tenant_id,snapshot_id,source_type,source_system,source_version,source_digest)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [tenant(req), inserted.rows[0].id, name, snapshot.sources[name].system, snapshot.sources[name].version, snapshot.sources[name].digest]
        );
        await event(client, req, null, 'snapshot_ingested', { snapshotId: inserted.rows[0].id, sku: snapshot.sku }, validation.snapshotDigest);
        return { snapshot: inserted.rows[0], replayed: false };
      });
      return res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { return fail(res, error, 'Pricing snapshot could not be persisted'); }
  });

  router.post('/snapshots/:id/recommendations', roles('pricing_analyst', 'admin'), async (req, res) => {
    try {
      const key = String(req.get('Idempotency-Key') || '').trim();
      if (!key || !Number.isFinite(Date.parse(req.body?.effectiveAt))) return res.status(422).json({ error: 'Idempotency-Key and effectiveAt are required' });
      const result = await tx(async (client) => {
        const replay = await client.query('SELECT * FROM pricing_recommendations WHERE tenant_id=$1 AND idempotency_key=$2', [tenant(req), key]);
        if (replay.rows[0]) return { recommendation: replay.rows[0], replayed: true };
        const found = await client.query('SELECT * FROM pricing_snapshots WHERE id=$1 AND tenant_id=$2', [req.params.id, tenant(req)]);
        if (!found.rows[0]) throw Object.assign(new Error('Snapshot not found'), { status: 404 });
        const recommendation = recommendPrice(found.rows[0].snapshot, req.body.effectiveAt);
        const workflowState = recommendation.status === 'review_required' ? 'draft' : 'blocked';
        const inserted = await client.query(
          `INSERT INTO pricing_recommendations
           (tenant_id,idempotency_key,snapshot_id,sku,engine_status,workflow_state,revision,current_price_minor,recommended_price_minor,currency,effective_at,recommendation,recommendation_digest,created_by)
           VALUES($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [tenant(req), key, found.rows[0].id, recommendation.sku, recommendation.status, workflowState, recommendation.currentPriceMinor, recommendation.recommendedPriceMinor, recommendation.currency, req.body.effectiveAt, recommendation, recommendation.recommendationDigest, req.user.id]
        );
        await event(client, req, inserted.rows[0].id, 'recommendation_calculated', { engineStatus: recommendation.status }, recommendation.recommendationDigest);
        return { recommendation: inserted.rows[0], replayed: false };
      });
      return res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { return fail(res, error, 'Price recommendation failed'); }
  });

  router.post('/recommendations/:id/approvals', roles('pricing_approver', 'admin'), async (req, res) => {
    try {
      if (!['approve', 'reject'].includes(req.body?.decision) || !String(req.body?.attestation || '').trim()) return res.status(422).json({ error: 'Decision and attestation are required' });
      const found = await pool.query('SELECT * FROM pricing_recommendations WHERE id=$1 AND tenant_id=$2', [req.params.id, tenant(req)]);
      if (!found.rows[0]) return res.status(404).json({ error: 'Recommendation not found' });
      if (found.rows[0].workflow_state !== 'review_pending') return res.status(409).json({ error: 'Recommendation is not awaiting review' });
      if (String(found.rows[0].created_by) === String(req.user.id)) return res.status(409).json({ error: 'Recommendation creator cannot approve' });
      const result = await pool.query(
        `INSERT INTO pricing_approvals(tenant_id,recommendation_id,actor_id,decision,attestation_digest)
         VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [tenant(req), req.params.id, req.user.id, req.body.decision, digest(req.body.attestation)]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) { return fail(res, error, 'Approval could not be recorded'); }
  });

  router.post('/recommendations/:id/transition', async (req, res) => {
    try {
      const revision = Number(req.get('If-Match'));
      if (!Number.isInteger(revision) || revision < 1) return res.status(400).json({ error: 'If-Match must be a positive revision' });
      if (['synced', 'rolled_back'].includes(req.body?.nextStatus)) return res.status(422).json({ error: 'Provider outcomes must reconcile synced or rolled-back state' });
      const result = await tx(async (client) => {
        const found = await client.query('SELECT * FROM pricing_recommendations WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, tenant(req)]);
        const recommendation = found.rows[0];
        if (!recommendation) throw Object.assign(new Error('Recommendation not found'), { status: 404 });
        if (recommendation.revision !== revision) throw Object.assign(new Error('Recommendation revision conflict'), { status: 409 });
        if (recommendation.engine_status !== 'review_required') throw new Error('Blocked engine result cannot enter execution workflow');
        const approvals = (await client.query('SELECT actor_id AS "actorId",decision FROM pricing_approvals WHERE tenant_id=$1 AND recommendation_id=$2', [tenant(req), recommendation.id])).rows;
        const channels = Array.isArray(req.body?.channels) ? [...new Set(req.body.channels.map((item) => String(item).toLowerCase()))] : [];
        let providers = [];
        if (['sync_pending', 'rollback_pending'].includes(req.body?.nextStatus)) providers = requireProviders(channels).map((item) => item.name);
        const authorization = authorizeTransition({ current: recommendation.workflow_state, next: req.body?.nextStatus, actor: req.user, recommendation: { createdBy: recommendation.created_by, effectiveAt: recommendation.effective_at }, approvals, providers, rollbackEvidence: req.body?.rollbackEvidence });
        if (!authorization.ok) throw new Error(authorization.errors.join('; '));
        const updated = await client.query('UPDATE pricing_recommendations SET workflow_state=$1,revision=revision+1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3 AND revision=$4 RETURNING *', [req.body.nextStatus, recommendation.id, tenant(req), revision]);
        if (['sync_pending', 'rollback_pending'].includes(req.body.nextStatus)) {
          const operation = req.body.nextStatus === 'rollback_pending' ? 'rollback' : 'apply';
          for (const channel of channels) await client.query(
            `INSERT INTO pricing_channel_outbox(tenant_id,recommendation_id,channel,operation,idempotency_key,payload)
             VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING`,
            [tenant(req), recommendation.id, channel, operation, `${recommendation.recommendation_digest}:${operation}:${channel}`, { sku: recommendation.sku, priceMinor: operation === 'rollback' ? recommendation.current_price_minor : recommendation.recommended_price_minor, currency: recommendation.currency, effectiveAt: recommendation.effective_at, rollbackEvidence: req.body.rollbackEvidence || null }]
          );
        }
        await event(client, req, recommendation.id, 'state_transition', { from: recommendation.workflow_state, to: req.body.nextStatus, channels }, req.body?.rollbackEvidence?.evidenceDigest || null);
        return updated.rows[0];
      });
      return res.json(result);
    } catch (error) { return fail(res, error, 'Recommendation transition failed'); }
  });

  router.post('/channel-outbox/:id/outcome', roles('channel_operator', 'admin'), async (req, res) => {
    try {
      if (!['delivered', 'failed'].includes(req.body?.status) || (req.body.status === 'delivered' && (!String(req.body.externalVersion || '').trim() || !/^[a-f0-9]{64}$/.test(String(req.body.evidenceDigest || ''))))) return res.status(422).json({ error: 'Delivered|failed outcome and provider version/evidence are required' });
      const result = await tx(async (client) => {
        const found = await client.query('SELECT * FROM pricing_channel_outbox WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, tenant(req)]);
        const work = found.rows[0];
        if (!work) throw Object.assign(new Error('Channel work not found'), { status: 404 });
        requireProviders([work.channel]);
        const workStatus = req.body.status === 'delivered' ? 'delivered' : (work.attempts >= 4 ? 'dead_letter' : 'retry');
        await client.query(`UPDATE pricing_channel_outbox SET status=$1,attempts=attempts+1,external_version=$2,evidence_digest=$3,last_error_code=$4,next_attempt_at=NOW()+INTERVAL '5 minutes' WHERE id=$5`, [workStatus, req.body.externalVersion || null, req.body.evidenceDigest || null, req.body.errorCode || null, work.id]);
        if (req.body.status === 'failed') await client.query(`INSERT INTO pricing_integration_failures(tenant_id,recommendation_id,provider,operation,retryable,error_code,sanitized_detail) VALUES($1,$2,$3,$4,$5,$6,'provider detail redacted')`, [tenant(req), work.recommendation_id, work.channel, work.operation, workStatus !== 'dead_letter', String(req.body.errorCode || 'SYNC_FAILED').slice(0, 100)]);
        const remaining = await client.query("SELECT 1 FROM pricing_channel_outbox WHERE tenant_id=$1 AND recommendation_id=$2 AND operation=$3 AND status<>'delivered' LIMIT 1", [tenant(req), work.recommendation_id, work.operation]);
        let recommendation = null;
        if (!remaining.rows[0] && req.body.status === 'delivered') {
          const nextState = work.operation === 'rollback' ? 'rolled_back' : 'synced';
          recommendation = (await client.query('UPDATE pricing_recommendations SET workflow_state=$1,revision=revision+1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *', [nextState, work.recommendation_id, tenant(req)])).rows[0];
          await event(client, req, work.recommendation_id, `${work.operation}_reconciled`, { externalVersion: req.body.externalVersion, state: nextState }, req.body.evidenceDigest);
        }
        return { workStatus, recommendation };
      });
      return res.status(req.body.status === 'delivered' ? 200 : 502).json(result);
    } catch (error) { return fail(res, error, 'Channel outcome failed'); }
  });

  router.post('/experiments', roles('pricing_analyst', 'admin'), async (req, res) => {
    try {
      const validation = validateExperiment(req.body || {});
      if (!validation.ok) return res.status(422).json({ error: 'Experiment rejected', details: validation.errors });
      const recommendation = await pool.query("SELECT id FROM pricing_recommendations WHERE id=$1 AND tenant_id=$2 AND workflow_state IN ('approved','scheduled','synced','monitoring') AND recommendation_digest=$3", [req.body.recommendationId, tenant(req), req.body.recommendationDigest]);
      if (!recommendation.rows[0]) return res.status(409).json({ error: 'Experiment requires a reviewed recommendation digest' });
      const result = await pool.query(
        `INSERT INTO pricing_experiments(tenant_id,recommendation_id,experiment_ref,experiment,experiment_digest,status,created_by)
         VALUES($1,$2,$3,$4,$5,'planned',$6) RETURNING *`,
        [tenant(req), recommendation.rows[0].id, req.body.experimentId, req.body, validation.experimentDigest, req.user.id]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) { return fail(res, error, 'Experiment could not be persisted'); }
  });

  router.post('/experiments/:id/outcomes', roles('pricing_analyst', 'auditor', 'admin'), async (req, res) => {
    try {
      const experiment = await pool.query('SELECT * FROM pricing_experiments WHERE id=$1 AND tenant_id=$2', [req.params.id, tenant(req)]);
      if (!experiment.rows[0]) return res.status(404).json({ error: 'Experiment not found' });
      const evaluation = evaluateExperiment(experiment.rows[0].experiment, req.body || {});
      const result = await pool.query(
        `INSERT INTO pricing_experiment_evaluations(tenant_id,experiment_id,outcomes,evaluation,evaluation_digest,evaluated_by)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [tenant(req), experiment.rows[0].id, req.body, evaluation, evaluation.evaluationDigest || digest(evaluation), req.user.id]
      );
      return res.status(evaluation.status === 'awaiting_delayed_outcomes' ? 202 : 201).json({ evaluation, record: result.rows[0], automaticExecution: false });
    } catch (error) { return fail(res, error, 'Experiment outcomes failed'); }
  });

  router.post('/experiments/:id/assignments', roles('pricing_analyst', 'admin'), async (req, res) => {
    try {
      if (!Array.isArray(req.body?.unitRefs) || !req.body.unitRefs.length || req.body.unitRefs.length > 1000) return res.status(422).json({ error: '1..1000 unitRefs are required' });
      const found = await pool.query("SELECT * FROM pricing_experiments WHERE id=$1 AND tenant_id=$2 AND status IN ('planned','running')", [req.params.id, tenant(req)]);
      if (!found.rows[0]) return res.status(404).json({ error: 'Assignable experiment not found' });
      const assignments = req.body.unitRefs.map((unitRef) => assignExperimentUnit(found.rows[0].experiment, unitRef));
      const result = await tx(async (client) => {
        const rows = [];
        for (const assignment of assignments) {
          const inserted = await client.query(
            `INSERT INTO pricing_experiment_assignments(tenant_id,experiment_id,unit_digest,bucket,arm)
             VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,experiment_id,unit_digest) DO NOTHING RETURNING *`,
            [tenant(req), found.rows[0].id, assignment.unitDigest, assignment.bucket, assignment.arm]
          );
          rows.push(inserted.rows[0] || (await client.query('SELECT * FROM pricing_experiment_assignments WHERE tenant_id=$1 AND experiment_id=$2 AND unit_digest=$3', [tenant(req), found.rows[0].id, assignment.unitDigest])).rows[0]);
        }
        await client.query("UPDATE pricing_experiments SET status='running' WHERE id=$1 AND status='planned'", [found.rows[0].id]);
        return rows;
      });
      return res.status(201).json({ assignments: result, deterministic: true, rawUnitRefsPersisted: false });
    } catch (error) { return fail(res, error, 'Experiment assignment failed'); }
  });

  return router;
};
