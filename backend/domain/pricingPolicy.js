'use strict';

const crypto = require('crypto');

const SOURCE_TYPES = Object.freeze(['transactions', 'inventory', 'promotions', 'costs', 'competitors', 'demand', 'customer_constraints']);
const TRANSITIONS = Object.freeze({
  draft: new Set(['review_pending', 'cancelled']),
  review_pending: new Set(['approved', 'rejected', 'draft']),
  approved: new Set(['scheduled', 'cancelled']),
  scheduled: new Set(['sync_pending', 'cancelled']),
  sync_pending: new Set(['synced', 'failed']),
  synced: new Set(['monitoring', 'rollback_pending']),
  monitoring: new Set(['completed', 'rollback_pending', 'failed']),
  failed: new Set(['sync_pending', 'rollback_pending']),
  rollback_pending: new Set(['rolled_back', 'failed']),
  rejected: new Set(), cancelled: new Set(), completed: new Set(), rolled_back: new Set()
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function safeInteger(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function sha(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ''));
}

function validateSnapshot(snapshot) {
  const errors = [];
  for (const field of ['tenantId', 'snapshotId', 'sku', 'asOf', 'currency', 'fairnessRuleVersion']) if (!String(snapshot?.[field] || '').trim()) errors.push(`${field} is required`);
  if (!safeInteger(snapshot?.version, 1)) errors.push('version must be a positive integer');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(snapshot?.asOf || '')) || Number.isNaN(Date.parse(snapshot.asOf))) errors.push('asOf must be an ISO timestamp');
  if (!/^[A-Z]{3}$/.test(String(snapshot?.currency || ''))) errors.push('currency must be ISO 4217 uppercase');
  if (!safeInteger(snapshot?.currentPriceMinor, 1) || !safeInteger(snapshot?.costMinor) || snapshot.costMinor >= snapshot.currentPriceMinor) errors.push('positive current price above reconciled cost is required');
  if (!safeInteger(snapshot?.inventory?.onHand) || !safeInteger(snapshot?.inventory?.target, 1)) errors.push('authoritative inventory onHand and positive target are required');
  const sources = snapshot?.sources || {};
  for (const name of SOURCE_TYPES) {
    const source = sources[name];
    if (!String(source?.system || '').trim() || !String(source?.version || '').trim() || !sha(source?.digest)) errors.push(`${name} source system, version, and SHA-256 digest are required`);
  }
  if (!Array.isArray(snapshot?.transactions)) errors.push('transactions must be an authoritative array');
  else snapshot.transactions.forEach((item, index) => {
    if (!safeInteger(item?.priceMinor, 1) || !safeInteger(item?.units, 1) || !String(item?.period || '').trim()) errors.push(`transaction observation ${index} is invalid`);
  });
  if (!Array.isArray(snapshot?.competitorObservations)) errors.push('competitorObservations must be an authoritative array');
  else snapshot.competitorObservations.forEach((item, index) => {
    if (!String(item?.competitorId || '').trim() || !safeInteger(item?.priceMinor, 1) || !sha(item?.evidenceDigest) || !Number.isFinite(Date.parse(item?.observedAt))) errors.push(`competitor observation ${index} is invalid`);
  });
  if (!Array.isArray(snapshot?.promotions)) errors.push('promotions must be an authoritative array');
  else snapshot.promotions.forEach((item, index) => {
    if (!String(item?.promotionId || '').trim() || !Number.isFinite(Date.parse(item?.startsAt)) || !Number.isFinite(Date.parse(item?.endsAt)) || Date.parse(item.startsAt) > Date.parse(item.endsAt) || !safeInteger(item?.maximumPriceMinor, 1)) errors.push(`promotion ${index} is invalid`);
  });
  if (!Array.isArray(snapshot?.segments) || !snapshot.segments.length) errors.push('customer segment constraints are required');
  else snapshot.segments.forEach((segment, index) => {
    if (!String(segment?.segmentId || '').trim() || !safeInteger(segment?.minimumPriceMinor, 1) || !safeInteger(segment?.maximumPriceMinor, 1) || segment.minimumPriceMinor > segment.maximumPriceMinor) errors.push(`segment ${index} price constraints are invalid`);
    if (Array.isArray(segment?.protectedAttributes) && segment.protectedAttributes.length) errors.push(`segment ${index} cannot use protected attributes for price selection`);
  });
  const constraints = snapshot?.constraints || {};
  if (!safeInteger(constraints.marginFloorBasisPoints) || constraints.marginFloorBasisPoints >= 10000) errors.push('marginFloorBasisPoints must be 0..9999');
  if (!safeInteger(constraints.maxChangeBasisPoints, 1) || constraints.maxChangeBasisPoints > 5000) errors.push('maxChangeBasisPoints must be 1..5000');
  if (!safeInteger(constraints.competitorGuardrailBasisPoints) || constraints.competitorGuardrailBasisPoints > 5000) errors.push('competitorGuardrailBasisPoints must be 0..5000');
  if (!safeInteger(constraints.demandAdjustmentBasisPoints || 0) || (constraints.demandAdjustmentBasisPoints || 0) > constraints.maxChangeBasisPoints) errors.push('demand adjustment exceeds the change constraint');
  return { ok: errors.length === 0, errors, snapshotDigest: digest(snapshot) };
}

function estimateElasticity(observations) {
  const points = (observations || []).filter((item) => safeInteger(item?.priceMinor, 1) && safeInteger(item?.units, 1));
  if (points.length < 3 || new Set(points.map((item) => item.priceMinor)).size < 2) return { status: 'insufficient_data', method: 'log_log_ols_v1', sampleCount: points.length, elasticity: null };
  const x = points.map((item) => Math.log(item.priceMinor));
  const y = points.map((item) => Math.log(item.units));
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const xMean = mean(x), yMean = mean(y);
  const numerator = x.reduce((sum, value, index) => sum + (value - xMean) * (y[index] - yMean), 0);
  const denominator = x.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  const elasticity = denominator === 0 ? null : numerator / denominator;
  const status = Number.isFinite(elasticity) && elasticity < 0 ? 'estimated' : 'unstable';
  return { status, method: 'log_log_ols_v1', sampleCount: points.length, elasticity: status === 'estimated' ? elasticity : null, observationDigest: digest(points) };
}

function ceilDivide(numerator, denominator) {
  const result = Number((BigInt(numerator) + BigInt(denominator) - 1n) / BigInt(denominator));
  if (!Number.isSafeInteger(result)) throw new Error('price arithmetic exceeds safe integer range');
  return result;
}

function pricedByBasisPoints(amount, basisPoints) {
  const result = Number((BigInt(amount) * BigInt(basisPoints) + 5000n) / 10000n);
  if (!Number.isSafeInteger(result)) throw new Error('price arithmetic exceeds safe integer range');
  return result;
}

function recommendPrice(snapshot, effectiveAt) {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  if (!Number.isFinite(Date.parse(effectiveAt))) throw new Error('effectiveAt is required');
  const elasticity = estimateElasticity(snapshot.transactions);
  if (snapshot.newProduct === true || elasticity.status !== 'estimated') return {
    status: 'insufficient_data', sku: snapshot.sku, currentPriceMinor: snapshot.currentPriceMinor,
    recommendedPriceMinor: snapshot.currentPriceMinor, currency: snapshot.currency, elasticity,
    constraintsApplied: ['no automated movement for new or sparse products'], snapshotDigest: validation.snapshotDigest,
    recommendationDigest: digest({ snapshotDigest: validation.snapshotDigest, decision: 'hold_for_more_data' })
  };
  const constraints = snapshot.constraints;
  const marginFloorMinor = ceilDivide(BigInt(snapshot.costMinor) * 10000n, 10000 - constraints.marginFloorBasisPoints);
  const changeFloor = pricedByBasisPoints(snapshot.currentPriceMinor, 10000 - constraints.maxChangeBasisPoints);
  const changeCeiling = pricedByBasisPoints(snapshot.currentPriceMinor, 10000 + constraints.maxChangeBasisPoints);
  const segmentFloor = Math.max(...snapshot.segments.map((item) => item.minimumPriceMinor));
  const segmentCeiling = Math.min(...snapshot.segments.map((item) => item.maximumPriceMinor));
  const effectiveTime = Date.parse(effectiveAt);
  const activePromotions = snapshot.promotions.filter((item) => Date.parse(item.startsAt) <= effectiveTime && Date.parse(item.endsAt) >= effectiveTime);
  const promotionCeiling = activePromotions.length ? Math.min(...activePromotions.map((item) => item.maximumPriceMinor)) : Number.MAX_SAFE_INTEGER;
  const competitorPrices = snapshot.competitorObservations.map((item) => item.priceMinor).sort((a, b) => a - b);
  const competitorMedian = competitorPrices.length ? competitorPrices[Math.floor(competitorPrices.length / 2)] : null;
  const competitorFloor = competitorMedian === null ? 0 : pricedByBasisPoints(competitorMedian, 10000 - constraints.competitorGuardrailBasisPoints);
  const competitorCeiling = competitorMedian === null ? Number.MAX_SAFE_INTEGER : pricedByBasisPoints(competitorMedian, 10000 + constraints.competitorGuardrailBasisPoints);
  const floor = Math.max(marginFloorMinor, changeFloor, segmentFloor, competitorFloor);
  const ceiling = Math.min(changeCeiling, segmentCeiling, promotionCeiling, competitorCeiling);
  if (floor > ceiling) return {
    status: 'constraint_conflict', sku: snapshot.sku, currentPriceMinor: snapshot.currentPriceMinor,
    recommendedPriceMinor: null, currency: snapshot.currency, floorMinor: floor, ceilingMinor: ceiling,
    elasticity, constraintsApplied: ['margin floor', 'change bound', 'segment intersection', 'competitor guardrail', 'active promotion ceiling'],
    snapshotDigest: validation.snapshotDigest, recommendationDigest: digest({ snapshotDigest: validation.snapshotDigest, floor, ceiling, decision: 'conflict' })
  };
  const inventoryGap = (snapshot.inventory.onHand - snapshot.inventory.target) / snapshot.inventory.target;
  const inventoryAdjustment = Math.round(Math.max(-1, Math.min(1, -inventoryGap)) * 300);
  const demandAdjustment = constraints.demandAdjustmentBasisPoints || 0;
  const adjustment = Math.max(-constraints.maxChangeBasisPoints, Math.min(constraints.maxChangeBasisPoints, inventoryAdjustment + demandAdjustment));
  const unconstrained = pricedByBasisPoints(snapshot.currentPriceMinor, 10000 + adjustment);
  const recommendedPriceMinor = Math.max(floor, Math.min(ceiling, unconstrained));
  const result = {
    status: 'review_required', sku: snapshot.sku, currentPriceMinor: snapshot.currentPriceMinor,
    recommendedPriceMinor, currency: snapshot.currency, unitMarginMinor: recommendedPriceMinor - snapshot.costMinor,
    elasticity, effectiveAt, onePriceAcrossSegments: true,
    constraintsApplied: [
      `margin floor ${constraints.marginFloorBasisPoints}bp -> ${marginFloorMinor}`,
      `max change ±${constraints.maxChangeBasisPoints}bp`,
      `inventory adjustment ${inventoryAdjustment}bp`, `demand adjustment ${demandAdjustment}bp`,
      `segment range ${segmentFloor}..${segmentCeiling}`,
      competitorMedian === null ? 'no current competitor observation' : `competitor median ${competitorMedian} ±${constraints.competitorGuardrailBasisPoints}bp`,
      activePromotions.length ? `promotion ceiling ${promotionCeiling}` : 'no active promotion ceiling'
    ],
    snapshotDigest: validation.snapshotDigest
  };
  return { ...result, recommendationDigest: digest(result) };
}

function validateExperiment(experiment) {
  const errors = [];
  for (const field of ['experimentId', 'sku', 'startsAt', 'endsAt', 'recommendationDigest']) if (!String(experiment?.[field] || '').trim()) errors.push(`${field} is required`);
  if (!Number.isFinite(Date.parse(experiment?.startsAt)) || !Number.isFinite(Date.parse(experiment?.endsAt)) || Date.parse(experiment.startsAt) >= Date.parse(experiment.endsAt)) errors.push('experiment dates are invalid');
  if (!safeInteger(experiment?.controlBasisPoints, 1) || !safeInteger(experiment?.treatmentBasisPoints, 1) || experiment.controlBasisPoints + experiment.treatmentBasisPoints !== 10000) errors.push('nonzero control and treatment allocations must total 10000bp');
  if (!safeInteger(experiment?.minimumSamplePerArm, 1)) errors.push('minimumSamplePerArm is required');
  const required = ['incremental_margin', 'conversion', 'churn', 'cannibalization'];
  if (!Array.isArray(experiment?.metrics) || required.some((metric) => !experiment.metrics.includes(metric))) errors.push('incremental margin, conversion, churn, and cannibalization metrics are required');
  if (!sha(experiment?.recommendationDigest)) errors.push('recommendationDigest must be SHA-256');
  return { ok: errors.length === 0, errors, experimentDigest: digest(experiment) };
}

function evaluateExperiment(experiment, outcomes) {
  const validation = validateExperiment(experiment);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  if (outcomes?.delayedOutcomesComplete !== true) return { status: 'awaiting_delayed_outcomes', decision: 'hold', experimentDigest: validation.experimentDigest };
  const validateArm = (arm) => ['visitors', 'orders', 'revenueMinor', 'costMinor', 'churnedCustomers', 'crossProductMarginMinor'].every((field) => safeInteger(arm?.[field]));
  if (!validateArm(outcomes.control) || !validateArm(outcomes.treatment) || !sha(outcomes.sourceDigest)) throw new Error('authoritative reconciled outcome counters and sourceDigest are required');
  const control = outcomes.control, treatment = outcomes.treatment;
  const enoughSample = control.visitors >= experiment.minimumSamplePerArm && treatment.visitors >= experiment.minimumSamplePerArm;
  const rate = (numerator, denominator) => denominator ? numerator / denominator : 0;
  const controlMarginPerVisitor = rate(control.revenueMinor - control.costMinor, control.visitors);
  const treatmentMarginPerVisitor = rate(treatment.revenueMinor - treatment.costMinor, treatment.visitors);
  const metrics = {
    incrementalMarginMinorPerVisitor: treatmentMarginPerVisitor - controlMarginPerVisitor,
    conversionDelta: rate(treatment.orders, treatment.visitors) - rate(control.orders, control.visitors),
    churnDelta: rate(treatment.churnedCustomers, treatment.visitors) - rate(control.churnedCustomers, control.visitors),
    cannibalizationMarginDeltaMinorPerVisitor: rate(treatment.crossProductMarginMinor, treatment.visitors) - rate(control.crossProductMarginMinor, control.visitors)
  };
  const decision = enoughSample && metrics.incrementalMarginMinorPerVisitor > 0 && metrics.churnDelta <= 0 && metrics.cannibalizationMarginDeltaMinorPerVisitor >= 0 ? 'eligible_for_human_approval' : 'hold';
  const result = { status: enoughSample ? 'evaluated' : 'insufficient_sample', decision, enoughSample, metrics, sourceDigest: outcomes.sourceDigest, experimentDigest: validation.experimentDigest };
  return { ...result, evaluationDigest: digest(result) };
}

function assignExperimentUnit(experiment, unitRef) {
  const validation = validateExperiment(experiment);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  if (!String(unitRef || '').trim()) throw new Error('unitRef is required');
  const unitDigest = digest({ experimentDigest: validation.experimentDigest, unitRef: String(unitRef) });
  const bucket = Number.parseInt(unitDigest.slice(0, 8), 16) % 10000;
  return { unitDigest, bucket, arm: bucket < experiment.controlBasisPoints ? 'control' : 'treatment', experimentDigest: validation.experimentDigest };
}

function authorizeTransition({ current, next, actor, recommendation, approvals = [], providers = [], rollbackEvidence }) {
  const errors = [];
  if (!TRANSITIONS[current]?.has(next)) errors.push(`transition ${current} -> ${next} is not allowed`);
  const roles = ['pricing_analyst', 'pricing_approver', 'channel_operator', 'auditor', 'admin'];
  if (!roles.includes(actor?.role)) errors.push('recognized pricing role is required');
  if (next === 'review_pending' && !['pricing_analyst', 'admin'].includes(actor?.role)) errors.push('pricing analyst role is required');
  if (next === 'approved') {
    const approval = approvals.find((item) => item.decision === 'approve');
    if (!approval || !['pricing_approver', 'admin'].includes(actor?.role)) errors.push('independent pricing approval is required');
    if (String(approval?.actorId) === String(recommendation?.createdBy)) errors.push('recommendation creator cannot approve');
  }
  if (next === 'scheduled' && (!['pricing_approver', 'admin'].includes(actor?.role) || !recommendation?.effectiveAt || Date.parse(recommendation.effectiveAt) <= Date.now())) errors.push('approver and future effective date are required');
  if (next === 'sync_pending') {
    if (!['channel_operator', 'admin'].includes(actor?.role)) errors.push('channel operator role is required');
    if (!providers.length) errors.push('at least one configured channel provider is required');
  }
  if (next === 'synced' && !['channel_operator', 'admin'].includes(actor?.role)) errors.push('channel operator role is required');
  if (next === 'rollback_pending' && (!['channel_operator', 'pricing_approver', 'admin'].includes(actor?.role) || !sha(rollbackEvidence?.evidenceDigest) || !String(rollbackEvidence?.reason || '').trim())) errors.push('authorized rollback reason and evidence are required');
  if (next === 'rolled_back' && !['channel_operator', 'admin'].includes(actor?.role)) errors.push('channel operator role is required to reconcile rollback');
  return { ok: errors.length === 0, errors };
}

module.exports = { SOURCE_TYPES, TRANSITIONS, assignExperimentUnit, authorizeTransition, digest, estimateElasticity, evaluateExperiment, recommendPrice, validateExperiment, validateSnapshot };
