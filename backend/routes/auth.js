'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate, jwtSecret } = require('../middleware/auth');
const router = express.Router();
router.post('/login', async (req, res) => {
  try {
    const { email, password, tenantId, tenant, tenantSlug } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const tenantRef = tenantId || tenant || tenantSlug || null;
    const params = [email];
    let tenantPredicate = '';
    if (tenantRef) {
      params.push(String(tenantRef));
      tenantPredicate = ' AND (m.tenant_id::text=$2 OR LOWER(o.name)=LOWER($2))';
    }
    const result = await pool.query(
      `SELECT u.id,u.email,u.password,u.name,m.tenant_id,m.role
       FROM users u
       JOIN pricing_memberships m ON m.user_id=u.id AND m.active=TRUE
       JOIN pricing_organizations o ON o.id=m.tenant_id
       WHERE LOWER(u.email)=LOWER($1)${tenantPredicate}
       ORDER BY m.tenant_id LIMIT 2`,
      params
    );
    if (result.rows.length !== 1) return res.status(401).json({ error: 'Invalid or ambiguous credentials' });
    const row = result.rows[0];
    if (!row || !await bcrypt.compare(password, row.password)) return res.status(401).json({ error: 'Invalid credentials' });
    const user = { id: row.id, email: row.email, name: row.name, tenantId: row.tenant_id, role: row.role };
    const token = jwt.sign(user, jwtSecret(), { issuer: 'pricing-optimizer', expiresIn: process.env.JWT_TTL || '1h' });
    return res.json({ token, user });
  } catch (_error) { return res.status(500).json({ error: 'Login failed' }); }
});
router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));
module.exports = router;
