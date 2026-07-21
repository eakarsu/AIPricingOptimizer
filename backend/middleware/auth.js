'use strict';
const jwt = require('jsonwebtoken');
const pool = require('../db');
function jwtSecret() { const value = String(process.env.JWT_SECRET || ''); if (value.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters'); return value; }
async function authenticate(req, res, next) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  try {
    const claims = jwt.verify(header.slice(7), jwtSecret(), { issuer: 'pricing-optimizer' });
    const result = await pool.query('SELECT role FROM pricing_memberships WHERE tenant_id=$1 AND user_id=$2 AND active=TRUE', [claims.tenantId, claims.id]);
    if (!result.rows[0]) return res.status(403).json({ error: 'Active tenant membership required' });
    req.user = { ...claims, role: result.rows[0].role };
    next();
  } catch (_error) { return res.status(401).json({ error: 'Invalid or expired access token' }); }
}
module.exports = { authenticate, jwtSecret };
