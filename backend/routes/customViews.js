// Custom Views routes for AI Pricing Optimizer
// Adds 2 VIZ + 2 NON-VIZ pricing optimization features.
//   VIZ:     /elasticity-chart, /margin-heatmap
//   NON-VIZ: /recommendation-pdf, /pricing-rules (CRUD)

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
let ipKeyGenerator;
try {
  ({ ipKeyGenerator } = require('express-rate-limit'));
} catch (_) {
  ipKeyGenerator = (req) => (req.ip || 'unknown');
}
const pool = require('./_cfDb');

// --- JWT auth middleware (matches host server) ---
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.userId = decoded.userId || decoded.id;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Per-route rate limit ---
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) =>
    (typeof ipKeyGenerator === 'function' ? ipKeyGenerator(req, res) : (req.ip || 'unknown')),
});
router.use(limiter);

// --- Ensure pricing_rules table exists ---
const RULES_TABLE = 'custom_views_pricing_rules';
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${RULES_TABLE} (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(80) NOT NULL,
        min_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        max_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        competitor_undercut_pct NUMERIC(6,3) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${RULES_TABLE}`);
    if (rows[0].c === 0) {
      await pool.query(`
        INSERT INTO ${RULES_TABLE} (sku, min_price, max_price, competitor_undercut_pct, notes) VALUES
        ('SKU-1001', 19.99, 39.99, 2.5, 'Stay just below avg competitor price'),
        ('SKU-1002', 49.00, 89.00, 1.0, 'Premium tier - protect margin'),
        ('SKU-1003', 9.50,  14.50, 0.0, 'Loss leader, no undercut'),
        ('SKU-1004', 120.00, 220.00, 3.0, 'Aggressive undercut for traffic')
      `);
    }
  } catch (e) {
    console.warn('[customViews] ensure rules table failed:', e.message);
  }
})();

// ----------------- VIZ 1: Price Elasticity Chart per SKU -----------------
// GET /api/custom-views/elasticity-chart?sku=SKU-1001
router.get('/elasticity-chart', auth, async (req, res) => {
  try {
    const sku = (req.query.sku || 'SKU-1001').toString();
    // Deterministic synthetic elasticity curve seeded by sku hash
    let seed = 0;
    for (let i = 0; i < sku.length; i++) seed = (seed * 31 + sku.charCodeAt(i)) >>> 0;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    const elasticity = -(0.8 + rand() * 1.6); // -0.8 to -2.4
    const basePrice = 20 + Math.floor(rand() * 60);
    const baseDemand = 200 + Math.floor(rand() * 300);
    const baseCost = basePrice * (0.45 + rand() * 0.2);

    const points = [];
    for (let i = -8; i <= 8; i++) {
      const price = +(basePrice * (1 + i * 0.05)).toFixed(2);
      const demand = Math.max(0, Math.round(baseDemand * Math.pow(price / basePrice, elasticity)));
      const revenue = +(price * demand).toFixed(2);
      const profit = +((price - baseCost) * demand).toFixed(2);
      points.push({ price, demand, revenue, profit });
    }
    const optimal = points.reduce((a, b) => (b.profit > a.profit ? b : a), points[0]);

    res.json({
      sku,
      elasticity: +elasticity.toFixed(3),
      basePrice,
      baseCost: +baseCost.toFixed(2),
      optimal,
      points,
    });
  } catch (e) {
    console.error('elasticity-chart error', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});

// ----------------- VIZ 2: Margin Heatmap (SKU x Segment) -----------------
// GET /api/custom-views/margin-heatmap
router.get('/margin-heatmap', auth, async (req, res) => {
  try {
    const segments = ['Retail', 'Wholesale', 'Online', 'Enterprise', 'Outlet'];
    const skus = ['SKU-1001', 'SKU-1002', 'SKU-1003', 'SKU-1004', 'SKU-1005', 'SKU-1006'];
    let s = 1337;
    const r = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };

    const matrix = skus.map((sku) => ({
      sku,
      segments: segments.map((seg) => {
        const margin = +(0.05 + r() * 0.55).toFixed(3); // 5%-60%
        return { segment: seg, margin };
      }),
    }));

    // overall avg per sku
    matrix.forEach((row) => {
      row.avg = +(row.segments.reduce((a, b) => a + b.margin, 0) / row.segments.length).toFixed(3);
    });

    res.json({ segments, skus, matrix, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('margin-heatmap error', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});

// ----------------- NON-VIZ 1: Pricing Recommendation PDF -----------------
// GET /api/custom-views/recommendation-pdf?sku=SKU-1001
router.get('/recommendation-pdf', auth, async (req, res) => {
  try {
    const sku = (req.query.sku || 'SKU-1001').toString();
    const reason = (req.query.reason || 'Quarterly competitive repricing').toString();

    // Pull rule (if exists) for the SKU
    let rule = null;
    try {
      const { rows } = await pool.query(
        `SELECT sku, min_price, max_price, competitor_undercut_pct, notes FROM ${RULES_TABLE} WHERE sku=$1 LIMIT 1`,
        [sku]
      );
      rule = rows[0] || null;
    } catch (_) { /* ignore */ }

    const recommendedPrice = rule
      ? +(Number(rule.min_price) + 0.6 * (Number(rule.max_price) - Number(rule.min_price))).toFixed(2)
      : 29.99;

    // Build a minimal valid single-page PDF (no external dependency).
    const lines = [
      'AI Pricing Optimizer - Pricing Recommendation',
      '------------------------------------------------',
      `SKU:                ${sku}`,
      `Generated:          ${new Date().toISOString()}`,
      `Reason:             ${reason}`,
      `Recommended Price:  $${recommendedPrice.toFixed(2)}`,
      rule ? `Min / Max:          $${Number(rule.min_price).toFixed(2)} / $${Number(rule.max_price).toFixed(2)}` : 'Min / Max:          (no rule)',
      rule ? `Competitor undercut: ${Number(rule.competitor_undercut_pct).toFixed(2)}%` : 'Competitor undercut: n/a',
      rule && rule.notes ? `Notes: ${String(rule.notes).slice(0, 120)}` : 'Notes: (none)',
      '',
      'Action: Update price in PIM, monitor sell-through 7d.',
    ];

    const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    let textOps = 'BT /F1 12 Tf 50 760 Td 14 TL\n';
    lines.forEach((ln, i) => {
      textOps += i === 0
        ? `(${escape(ln)}) Tj\n`
        : `T* (${escape(ln)}) Tj\n`;
    });
    textOps += 'ET';

    const objects = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
    objects.push(`<< /Length ${Buffer.byteLength(textOps, 'utf8')} >>\nstream\n${textOps}\nendstream`);
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefStart = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => {
      pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pricing_${sku}.pdf"`);
    res.send(Buffer.from(pdf, 'utf8'));
  } catch (e) {
    console.error('recommendation-pdf error', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});

// ----------------- NON-VIZ 2: Pricing Rules CRUD -----------------
// GET /api/custom-views/pricing-rules
router.get('/pricing-rules', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, sku, min_price, max_price, competitor_undercut_pct, notes, created_at, updated_at
       FROM ${RULES_TABLE} ORDER BY id ASC`
    );
    res.json({ rules: rows, count: rows.length });
  } catch (e) {
    console.error('pricing-rules GET error', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});

// POST /api/custom-views/pricing-rules
router.post('/pricing-rules', auth, async (req, res) => {
  try {
    const { sku, min_price, max_price, competitor_undercut_pct, notes } = req.body || {};
    if (!sku) return res.status(400).json({ error: 'sku is required' });
    const min = Number(min_price) || 0;
    const max = Number(max_price) || 0;
    if (max < min) return res.status(400).json({ error: 'max_price must be >= min_price' });
    const { rows } = await pool.query(
      `INSERT INTO ${RULES_TABLE} (sku, min_price, max_price, competitor_undercut_pct, notes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, sku, min_price, max_price, competitor_undercut_pct, notes, created_at, updated_at`,
      [sku, min, max, Number(competitor_undercut_pct) || 0, notes || null]
    );
    res.status(201).json({ rule: rows[0] });
  } catch (e) {
    console.error('pricing-rules POST error', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});

// PUT /api/custom-views/pricing-rules/:id
router.put('/pricing-rules/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const { sku, min_price, max_price, competitor_undercut_pct, notes } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE ${RULES_TABLE}
         SET sku = COALESCE($1, sku),
             min_price = COALESCE($2, min_price),
             max_price = COALESCE($3, max_price),
             competitor_undercut_pct = COALESCE($4, competitor_undercut_pct),
             notes = COALESCE($5, notes),
             updated_at = NOW()
       WHERE id = $6
       RETURNING id, sku, min_price, max_price, competitor_undercut_pct, notes, created_at, updated_at`,
      [
        sku ?? null,
        min_price !== undefined ? Number(min_price) : null,
        max_price !== undefined ? Number(max_price) : null,
        competitor_undercut_pct !== undefined ? Number(competitor_undercut_pct) : null,
        notes ?? null,
        id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule: rows[0] });
  } catch (e) {
    console.error('pricing-rules PUT error', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});

// DELETE /api/custom-views/pricing-rules/:id
router.delete('/pricing-rules/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const { rows } = await pool.query(
      `DELETE FROM ${RULES_TABLE} WHERE id=$1 RETURNING id`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ ok: true, id });
  } catch (e) {
    console.error('pricing-rules DELETE error', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});

// Health for the custom-views suite
router.get('/health', (req, res) => {
  res.json({ ok: true, module: 'custom-views', ts: new Date().toISOString() });
});

module.exports = router;
