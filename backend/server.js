require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory token blacklist (for logout)
const tokenBlacklist = new Set();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Rate limiting - auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pricing_optimizer',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// JWT Middleware (with token blacklist check)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked. Please login again.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    req.token = token;
    next();
  });
};

// RBAC Authorization Middleware
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userRole = userResult.rows[0].role;
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions. Required role: ' + allowedRoles.join(' or ') });
      }
      req.userRole = userRole;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
};

// Password Strength Validator
const validatePasswordStrength = (password) => {
  const errors = [];
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters long');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Password must contain at least one special character');
  return { isValid: errors.length === 0, errors };
};

// Pagination helper
const paginate = (query, page, limit) => {
  const offset = (page - 1) * limit;
  return { paginatedQuery: `${query} LIMIT ${limit} OFFSET ${offset}`, offset };
};

// OpenRouter AI Integration
async function callOpenRouter(prompt, systemPrompt = 'You are an AI pricing optimization expert.') {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Pricing Optimizer'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'anthropic/claude-haiku-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    }
    return 'Unable to generate AI response';
  } catch (error) {
    console.error('OpenRouter API error:', error);
    return 'AI service temporarily unavailable';
  }
}

// Helper function to clean AI response from markdown code blocks
function cleanAIResponse(response) {
  if (!response) return response;
  return response
    .replace(/```json\s*/gi, '')
    .replace(/```javascript\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

// Helper function to extract JSON object from AI response
function extractJSON(response, type = 'object') {
  const cleaned = cleanAIResponse(response);
  const pattern = type === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = cleaned.match(pattern);
  return match ? match[0] : null;
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, email_verified: user.email_verified }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Password strength validation
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ error: 'Weak password', details: passwordCheck.errors });
    }

    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, role, email_verified',
      [email, hashedPassword, name]
    );

    const user = result.rows[0];

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, verificationToken, new Date(Date.now() + 24 * 60 * 60 * 1000)]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user, verificationToken });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== PASSWORD STRENGTH CHECK ====================
app.post('/api/auth/check-password-strength', (req, res) => {
  const { password } = req.body;
  const result = validatePasswordStrength(password);
  let strength = 'weak';
  if (result.isValid) strength = 'strong';
  else if (result.errors.length <= 2) strength = 'medium';
  res.json({ strength, ...result });
});

// ==================== LOGOUT ====================
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  tokenBlacklist.add(req.token);
  // Clean up expired tokens periodically (every 100 logouts)
  if (tokenBlacklist.size % 100 === 0) {
    for (const t of tokenBlacklist) {
      try {
        jwt.verify(t, process.env.JWT_SECRET);
      } catch {
        tokenBlacklist.delete(t);
      }
    }
  }
  res.json({ message: 'Logged out successfully' });
});

// ==================== CHANGE PASSWORD ====================
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate new password strength
    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ error: 'Weak password', details: passwordCheck.errors });
    }

    // Verify current password
    const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    // Blacklist current token to force re-login
    tokenBlacklist.add(req.token);

    res.json({ message: 'Password changed successfully. Please login again.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== PASSWORD RESET ====================
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const userResult = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // Return success even if user not found (security: don't reveal if email exists)
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const user = userResult.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate existing reset tokens for this user
    await pool.query('UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false', [user.id]);

    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetToken, expiresAt]
    );

    // In production, send email with reset link. For demo, return token.
    res.json({
      message: 'If an account with that email exists, a reset link has been sent.',
      resetToken, // Demo only - would not include in production
      resetLink: `http://localhost:3000/reset-password?token=${resetToken}`
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validate new password strength
    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ error: 'Weak password', details: passwordCheck.errors });
    }

    // Find valid reset token
    const resetResult = await pool.query(
      'SELECT * FROM password_resets WHERE token = $1 AND used = false AND expires_at > NOW()',
      [token]
    );

    if (resetResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetRecord = resetResult.rows[0];

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, resetRecord.user_id]);

    // Mark token as used
    await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [resetRecord.id]);

    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get password reset history (admin only)
app.get('/api/password-resets', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { page, limit } = req.query;
    if (page && limit) {
      const p = parseInt(page);
      const l = parseInt(limit);
      const countResult = await pool.query('SELECT COUNT(*) as count FROM password_resets');
      const total = parseInt(countResult.rows[0].count);
      const result = await pool.query(
        'SELECT pr.*, u.email, u.name FROM password_resets pr JOIN users u ON pr.user_id = u.id ORDER BY pr.created_at DESC LIMIT $1 OFFSET $2',
        [l, (p - 1) * l]
      );
      return res.json({ data: result.rows, pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) } });
    }
    const result = await pool.query(
      'SELECT pr.*, u.email, u.name FROM password_resets pr JOIN users u ON pr.user_id = u.id ORDER BY pr.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching password resets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== EMAIL VERIFICATION ====================
app.post('/api/auth/send-verification', authenticateToken, async (req, res) => {
  try {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await pool.query(
      'INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [req.user.id, verificationToken, expiresAt]
    );

    res.json({
      message: 'Verification email sent.',
      verificationToken, // Demo only
      verificationLink: `http://localhost:3000/verify-email?token=${verificationToken}`
    });
  } catch (error) {
    console.error('Send verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    const verifyResult = await pool.query(
      'SELECT * FROM email_verifications WHERE token = $1 AND verified = false AND expires_at > NOW()',
      [token]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const record = verifyResult.rows[0];

    // Mark email as verified
    await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [record.user_id]);
    await pool.query('UPDATE email_verifications SET verified = true WHERE id = $1', [record.id]);

    res.json({ message: 'Email verified successfully!' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get email verification history (admin only)
app.get('/api/email-verifications', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { page, limit } = req.query;
    if (page && limit) {
      const p = parseInt(page);
      const l = parseInt(limit);
      const countResult = await pool.query('SELECT COUNT(*) as count FROM email_verifications');
      const total = parseInt(countResult.rows[0].count);
      const result = await pool.query(
        'SELECT ev.*, u.email, u.name FROM email_verifications ev JOIN users u ON ev.user_id = u.id ORDER BY ev.created_at DESC LIMIT $1 OFFSET $2',
        [l, (p - 1) * l]
      );
      return res.json({ data: result.rows, pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) } });
    }
    const result = await pool.query(
      'SELECT ev.*, u.email, u.name FROM email_verifications ev JOIN users u ON ev.user_id = u.id ORDER BY ev.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching email verifications:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== PRODUCTS ROUTES ====================
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { name, description, current_price, cost, category, sku } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, description, current_price, cost, category, sku) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description, current_price, cost, category, sku]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, current_price, cost, category, sku } = req.body;
    const result = await pool.query(
      'UPDATE products SET name = $1, description = $2, current_price = $3, cost = $4, category = $5, sku = $6, updated_at = NOW() WHERE id = $7 RETURNING *',
      [name, description, current_price, cost, category, sku, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== COMPETITORS ROUTES ====================
app.get('/api/competitors', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM competitors ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching competitors:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/competitors/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM competitors WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching competitor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/competitors', authenticateToken, async (req, res) => {
  try {
    const { name, website, product_name, competitor_price, our_price, market_position, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO competitors (name, website, product_name, competitor_price, our_price, market_position, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, website, product_name, competitor_price, our_price, market_position, notes]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating competitor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/competitors/:id', authenticateToken, async (req, res) => {
  try {
    const { name, website, product_name, competitor_price, our_price, market_position, notes } = req.body;
    const result = await pool.query(
      'UPDATE competitors SET name = $1, website = $2, product_name = $3, competitor_price = $4, our_price = $5, market_position = $6, notes = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
      [name, website, product_name, competitor_price, our_price, market_position, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating competitor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/competitors/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM competitors WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    res.json({ message: 'Competitor deleted successfully' });
  } catch (error) {
    console.error('Error deleting competitor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Competitor Analysis
app.post('/api/competitors/analyze', authenticateToken, async (req, res) => {
  try {
    const { competitorId } = req.body;

    const result = await pool.query('SELECT * FROM competitors WHERE id = $1', [competitorId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    const competitor = result.rows[0];
    const prompt = `Analyze this competitor pricing data and provide strategic recommendations:

    Competitor: ${competitor.name}
    Website: ${competitor.website}
    Product: ${competitor.product_name}
    Competitor Price: $${competitor.competitor_price}
    Our Price: $${competitor.our_price}
    Market Position: ${competitor.market_position}

    Please provide:
    1. Price positioning analysis
    2. Competitive advantages/disadvantages
    3. Recommended pricing strategy
    4. Market share implications`;

    const analysis = await callOpenRouter(prompt);
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing competitor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DEMAND SIGNALS ROUTES ====================
app.get('/api/demand-signals', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM demand_signals ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching demand signals:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/demand-signals/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM demand_signals WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demand signal not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching demand signal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/demand-signals', authenticateToken, async (req, res) => {
  try {
    const { product_name, signal_type, signal_strength, source, trend, volume, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO demand_signals (product_name, signal_type, signal_strength, source, trend, volume, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [product_name, signal_type, signal_strength, source, trend, volume, notes]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating demand signal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/demand-signals/:id', authenticateToken, async (req, res) => {
  try {
    const { product_name, signal_type, signal_strength, source, trend, volume, notes } = req.body;
    const result = await pool.query(
      'UPDATE demand_signals SET product_name = $1, signal_type = $2, signal_strength = $3, source = $4, trend = $5, volume = $6, notes = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
      [product_name, signal_type, signal_strength, source, trend, volume, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demand signal not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating demand signal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/demand-signals/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM demand_signals WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demand signal not found' });
    }
    res.json({ message: 'Demand signal deleted successfully' });
  } catch (error) {
    console.error('Error deleting demand signal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Demand Analysis
app.post('/api/demand-signals/analyze', authenticateToken, async (req, res) => {
  try {
    const { signalId } = req.body;

    const result = await pool.query('SELECT * FROM demand_signals WHERE id = $1', [signalId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demand signal not found' });
    }

    const signal = result.rows[0];
    const prompt = `Analyze this demand signal and provide actionable insights:

    Product: ${signal.product_name}
    Signal Type: ${signal.signal_type}
    Signal Strength: ${signal.signal_strength}/100
    Source: ${signal.source}
    Trend: ${signal.trend}
    Volume: ${signal.volume}

    Please provide:
    1. Demand forecast analysis
    2. Pricing implications based on demand
    3. Inventory recommendations
    4. Timing recommendations for price changes`;

    const analysis = await callOpenRouter(prompt);
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing demand signal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== PRICE SUGGESTIONS ROUTES ====================
app.get('/api/price-suggestions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM price_suggestions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching price suggestions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/price-suggestions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM price_suggestions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price suggestion not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching price suggestion:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/price-suggestions', authenticateToken, async (req, res) => {
  try {
    const { product_name, current_price, suggested_price, confidence, reason, expected_impact, status } = req.body;
    const result = await pool.query(
      'INSERT INTO price_suggestions (product_name, current_price, suggested_price, confidence, reason, expected_impact, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [product_name, current_price, suggested_price, confidence, reason, expected_impact, status || 'pending']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating price suggestion:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/price-suggestions/:id', authenticateToken, async (req, res) => {
  try {
    const { product_name, current_price, suggested_price, confidence, reason, expected_impact, status } = req.body;
    const result = await pool.query(
      'UPDATE price_suggestions SET product_name = $1, current_price = $2, suggested_price = $3, confidence = $4, reason = $5, expected_impact = $6, status = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
      [product_name, current_price, suggested_price, confidence, reason, expected_impact, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price suggestion not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating price suggestion:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/price-suggestions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM price_suggestions WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price suggestion not found' });
    }
    res.json({ message: 'Price suggestion deleted successfully' });
  } catch (error) {
    console.error('Error deleting price suggestion:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to gather comprehensive data for AI pricing
async function gatherPricingData(pool, product) {
  const dataSources = {
    competitors: [],
    demandSignals: [],
    marketTrends: [],
    priceHistory: [],
    allCompetitors: [],
    categoryProducts: []
  };

  // 1. Get competitors matching product name OR similar products
  const competitorsByName = await pool.query(
    'SELECT * FROM competitors WHERE product_name ILIKE $1 OR product_name ILIKE $2',
    [`%${product.name}%`, `%${product.category}%`]
  );
  dataSources.competitors = competitorsByName.rows;

  // 2. Get ALL competitors for market context (limit to recent/relevant)
  const allCompetitors = await pool.query(
    'SELECT name, market_position, competitor_price, our_price FROM competitors ORDER BY created_at DESC LIMIT 10'
  );
  dataSources.allCompetitors = allCompetitors.rows;

  // 3. Get demand signals for this product OR category
  const demandSignals = await pool.query(
    'SELECT * FROM demand_signals WHERE product_name ILIKE $1 OR product_name ILIKE $2 ORDER BY signal_strength DESC',
    [`%${product.name}%`, `%${product.category}%`]
  );
  dataSources.demandSignals = demandSignals.rows;

  // 4. Get active market trends (especially high impact ones)
  const marketTrends = await pool.query(
    `SELECT * FROM market_trends
     WHERE (category ILIKE $1 OR category ILIKE $2 OR impact_level = 'high')
     ORDER BY CASE impact_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
     LIMIT 5`,
    [`%${product.category}%`, '%pricing%']
  );
  dataSources.marketTrends = marketTrends.rows;

  // 5. Get price history for this product
  const priceHistory = await pool.query(
    'SELECT * FROM price_history WHERE product_name ILIKE $1 ORDER BY change_date DESC LIMIT 10',
    [`%${product.name}%`]
  );
  dataSources.priceHistory = priceHistory.rows;

  // 6. Get similar products in same category for benchmarking
  const categoryProducts = await pool.query(
    'SELECT name, current_price, cost, category FROM products WHERE category = $1 AND id != $2',
    [product.category, product.id]
  );
  dataSources.categoryProducts = categoryProducts.rows;

  return dataSources;
}

// Helper function to calculate data confidence score
function calculateDataConfidence(dataSources) {
  let score = 50; // Base score

  if (dataSources.competitors.length > 0) score += 15;
  if (dataSources.competitors.length > 2) score += 5;
  if (dataSources.demandSignals.length > 0) score += 10;
  if (dataSources.marketTrends.length > 0) score += 10;
  if (dataSources.priceHistory.length > 0) score += 5;
  if (dataSources.categoryProducts.length > 0) score += 5;

  return Math.min(score, 95); // Cap at 95%
}

// Helper function to build comprehensive AI prompt
function buildPricingPrompt(product, dataSources, dataConfidence) {
  const margin = ((product.current_price - product.cost) / product.current_price * 100).toFixed(2);

  // Calculate competitor price range
  let competitorPriceRange = 'No direct competitor data';
  if (dataSources.competitors.length > 0) {
    const prices = dataSources.competitors.map(c => c.competitor_price).filter(p => p);
    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
      competitorPriceRange = `Range: $${minPrice} - $${maxPrice}, Average: $${avgPrice}`;
    }
  }

  // Calculate demand strength
  let demandIndicator = 'Unknown';
  if (dataSources.demandSignals.length > 0) {
    const avgStrength = dataSources.demandSignals.reduce((a, b) => a + (b.signal_strength || 0), 0) / dataSources.demandSignals.length;
    const trends = dataSources.demandSignals.map(d => d.trend).filter(t => t);
    demandIndicator = `Average Strength: ${avgStrength.toFixed(0)}/100, Trends: ${trends.join(', ') || 'mixed'}`;
  }

  // Market trend summary
  let trendSummary = 'No current market trends';
  if (dataSources.marketTrends.length > 0) {
    trendSummary = dataSources.marketTrends.map(t =>
      `${t.trend_name} (${t.direction}, ${t.impact_level} impact)`
    ).join('; ');
  }

  // Price history summary
  let priceHistorySummary = 'No price history';
  if (dataSources.priceHistory.length > 0) {
    const recentChanges = dataSources.priceHistory.slice(0, 3).map(h => {
      const change = ((h.new_price - h.old_price) / h.old_price * 100).toFixed(1);
      return `${change > 0 ? '+' : ''}${change}%`;
    });
    priceHistorySummary = `Recent changes: ${recentChanges.join(', ')}`;
  }

  // Category benchmark
  let categoryBenchmark = 'No category data';
  if (dataSources.categoryProducts.length > 0) {
    const prices = dataSources.categoryProducts.map(p => p.current_price).filter(p => p);
    if (prices.length > 0) {
      const avgCategoryPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
      categoryBenchmark = `Category avg: $${avgCategoryPrice}, Products in category: ${dataSources.categoryProducts.length}`;
    }
  }

  return `You are an expert AI pricing strategist. Analyze ALL the data below and provide an optimal price recommendation.

═══════════════════════════════════════════════════════════════
PRODUCT DETAILS
═══════════════════════════════════════════════════════════════
• Name: ${product.name}
• Category: ${product.category || 'Uncategorized'}
• Current Price: $${product.current_price}
• Cost: $${product.cost}
• Current Margin: ${margin}%
• Description: ${product.description || 'N/A'}

═══════════════════════════════════════════════════════════════
COMPETITOR INTELLIGENCE (${dataSources.competitors.length} direct matches)
═══════════════════════════════════════════════════════════════
${competitorPriceRange}
${dataSources.competitors.length > 0 ?
  dataSources.competitors.map(c =>
    `• ${c.name}: $${c.competitor_price} (${c.market_position || 'unknown position'})`
  ).join('\n') : 'No direct competitors found'}

Market Overview (${dataSources.allCompetitors.length} competitors):
${dataSources.allCompetitors.map(c => `• ${c.name}: ${c.market_position}`).join('\n')}

═══════════════════════════════════════════════════════════════
DEMAND SIGNALS (${dataSources.demandSignals.length} signals)
═══════════════════════════════════════════════════════════════
${demandIndicator}
${dataSources.demandSignals.length > 0 ?
  dataSources.demandSignals.map(d =>
    `• ${d.signal_type}: Strength ${d.signal_strength}/100, Trend: ${d.trend}, Volume: ${d.volume || 'N/A'}`
  ).join('\n') : 'No demand signals available'}

═══════════════════════════════════════════════════════════════
MARKET TRENDS (${dataSources.marketTrends.length} active trends)
═══════════════════════════════════════════════════════════════
${trendSummary}
${dataSources.marketTrends.length > 0 ?
  dataSources.marketTrends.map(t =>
    `• ${t.trend_name}: ${t.direction} direction, ${t.impact_level} impact - ${t.description || ''}`
  ).join('\n') : ''}

═══════════════════════════════════════════════════════════════
PRICE HISTORY
═══════════════════════════════════════════════════════════════
${priceHistorySummary}
${dataSources.priceHistory.length > 0 ?
  dataSources.priceHistory.slice(0, 5).map(h =>
    `• ${new Date(h.change_date).toLocaleDateString()}: $${h.old_price} → $${h.new_price} (${h.change_reason || 'no reason'})`
  ).join('\n') : ''}

═══════════════════════════════════════════════════════════════
CATEGORY BENCHMARK
═══════════════════════════════════════════════════════════════
${categoryBenchmark}

═══════════════════════════════════════════════════════════════
DATA CONFIDENCE: ${dataConfidence}%
═══════════════════════════════════════════════════════════════

Based on ALL the above data, provide your pricing recommendation. Consider:
1. Competitor positioning (are we premium, budget, or mid-market?)
2. Demand signals (high demand = potential for price increase)
3. Market trends (adjust for industry-wide changes)
4. Historical price changes (what worked before?)
5. Margin protection (minimum viable margin)

Respond ONLY with this JSON (no other text):
{
  "suggested_price": <number with 2 decimals>,
  "confidence": <${Math.max(dataConfidence - 10, 30)}-${Math.min(dataConfidence + 10, 95)}>,
  "reason": "<2-3 sentences explaining the recommendation based on the data>",
  "expected_impact": "<specific prediction: e.g., 'Estimated 5-8% revenue increase based on competitor pricing gap and high demand signals'>"
}`;
}

// AI Price Suggestion Generator (ENHANCED)
app.post('/api/price-suggestions/generate', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;

    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Gather comprehensive data from ALL sources
    const dataSources = await gatherPricingData(pool, product);
    const dataConfidence = calculateDataConfidence(dataSources);
    const prompt = buildPricingPrompt(product, dataSources, dataConfidence);

    const aiResponse = await callOpenRouter(prompt, 'You are an expert AI pricing strategist with deep knowledge of competitive pricing, demand elasticity, and market dynamics.');

    // Try to parse AI response as JSON
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const suggestion = JSON.parse(jsonMatch[0]);

        // Save to database
        const result = await pool.query(
          'INSERT INTO price_suggestions (product_name, current_price, suggested_price, confidence, reason, expected_impact, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
          [product.name, product.current_price, suggestion.suggested_price, suggestion.confidence, suggestion.reason, suggestion.expected_impact, 'pending']
        );

        res.json({
          suggestion: result.rows[0],
          aiResponse,
          dataSourcesSummary: {
            competitors: dataSources.competitors.length,
            demandSignals: dataSources.demandSignals.length,
            marketTrends: dataSources.marketTrends.length,
            priceHistory: dataSources.priceHistory.length,
            categoryProducts: dataSources.categoryProducts.length,
            dataConfidence
          }
        });
      } else {
        res.json({ aiResponse, message: 'AI response could not be parsed as structured suggestion' });
      }
    } catch (parseError) {
      res.json({ aiResponse, message: 'AI response provided as text' });
    }
  } catch (error) {
    console.error('Error generating price suggestion:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Price Suggestion Preview (ENHANCED - doesn't save to database)
app.post('/api/price-suggestions/preview', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;

    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Gather comprehensive data from ALL sources
    const dataSources = await gatherPricingData(pool, product);
    const dataConfidence = calculateDataConfidence(dataSources);
    const prompt = buildPricingPrompt(product, dataSources, dataConfidence);

    const aiResponse = await callOpenRouter(prompt, 'You are an expert AI pricing strategist with deep knowledge of competitive pricing, demand elasticity, and market dynamics.');

    // Try to parse AI response as JSON
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const suggestion = JSON.parse(jsonMatch[0]);
        // Return preview without saving
        res.json({
          preview: {
            product_name: product.name,
            current_price: product.current_price,
            suggested_price: suggestion.suggested_price,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
            expected_impact: suggestion.expected_impact,
          },
          aiResponse,
          dataSourcesSummary: {
            competitors: dataSources.competitors.length,
            demandSignals: dataSources.demandSignals.length,
            marketTrends: dataSources.marketTrends.length,
            priceHistory: dataSources.priceHistory.length,
            categoryProducts: dataSources.categoryProducts.length,
            dataConfidence
          }
        });
      } else {
        res.json({ aiResponse, message: 'AI response could not be parsed as structured suggestion' });
      }
    } catch (parseError) {
      res.json({ aiResponse, message: 'AI response provided as text' });
    }
  } catch (error) {
    console.error('Error generating price suggestion preview:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== PRICE HISTORY ROUTES ====================
app.get('/api/price-history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM price_history ORDER BY change_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/price-history/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM price_history WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price history not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/price-history', authenticateToken, async (req, res) => {
  try {
    const { product_name, old_price, new_price, change_reason, changed_by, change_date } = req.body;
    const result = await pool.query(
      'INSERT INTO price_history (product_name, old_price, new_price, change_reason, changed_by, change_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [product_name, old_price, new_price, change_reason, changed_by, change_date || new Date()]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating price history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/price-history/:id', authenticateToken, async (req, res) => {
  try {
    const { product_name, old_price, new_price, change_reason, changed_by, change_date } = req.body;
    const result = await pool.query(
      'UPDATE price_history SET product_name = $1, old_price = $2, new_price = $3, change_reason = $4, changed_by = $5, change_date = $6 WHERE id = $7 RETURNING *',
      [product_name, old_price, new_price, change_reason, changed_by, change_date, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price history not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating price history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/price-history/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM price_history WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price history not found' });
    }
    res.json({ message: 'Price history deleted successfully' });
  } catch (error) {
    console.error('Error deleting price history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== MARKET TRENDS ROUTES ====================
app.get('/api/market-trends', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM market_trends ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching market trends:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/market-trends/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM market_trends WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market trend not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching market trend:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/market-trends', authenticateToken, async (req, res) => {
  try {
    const { trend_name, category, direction, impact_level, description, data_source, start_date, end_date } = req.body;
    const result = await pool.query(
      'INSERT INTO market_trends (trend_name, category, direction, impact_level, description, data_source, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [trend_name, category, direction, impact_level, description, data_source, start_date, end_date]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating market trend:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/market-trends/:id', authenticateToken, async (req, res) => {
  try {
    const { trend_name, category, direction, impact_level, description, data_source, start_date, end_date } = req.body;
    const result = await pool.query(
      'UPDATE market_trends SET trend_name = $1, category = $2, direction = $3, impact_level = $4, description = $5, data_source = $6, start_date = $7, end_date = $8, updated_at = NOW() WHERE id = $9 RETURNING *',
      [trend_name, category, direction, impact_level, description, data_source, start_date, end_date, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market trend not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating market trend:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/market-trends/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM market_trends WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market trend not found' });
    }
    res.json({ message: 'Market trend deleted successfully' });
  } catch (error) {
    console.error('Error deleting market trend:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Market Trend Analysis
app.post('/api/market-trends/analyze', authenticateToken, async (req, res) => {
  try {
    const { trendId } = req.body;

    const result = await pool.query('SELECT * FROM market_trends WHERE id = $1', [trendId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market trend not found' });
    }

    const trend = result.rows[0];
    const prompt = `Analyze this market trend and provide pricing strategy recommendations:

    Trend: ${trend.trend_name}
    Category: ${trend.category}
    Direction: ${trend.direction}
    Impact Level: ${trend.impact_level}
    Description: ${trend.description}
    Data Source: ${trend.data_source}

    Please provide:
    1. Trend impact analysis
    2. Pricing strategy adjustments
    3. Product category recommendations
    4. Risk assessment and mitigation strategies`;

    const analysis = await callOpenRouter(prompt);
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing market trend:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== AI INSIGHTS ROUTES ====================
app.get('/api/ai-insights', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_insights ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/ai-insights/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_insights WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AI insight not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching AI insight:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/ai-insights', authenticateToken, async (req, res) => {
  try {
    const { insight_type, title, content, priority, status, related_products } = req.body;
    const result = await pool.query(
      'INSERT INTO ai_insights (insight_type, title, content, priority, status, related_products) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [insight_type, title, content, priority, status || 'new', related_products]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating AI insight:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/ai-insights/:id', authenticateToken, async (req, res) => {
  try {
    const { insight_type, title, content, priority, status, related_products } = req.body;
    const result = await pool.query(
      'UPDATE ai_insights SET insight_type = $1, title = $2, content = $3, priority = $4, status = $5, related_products = $6, updated_at = NOW() WHERE id = $7 RETURNING *',
      [insight_type, title, content, priority, status, related_products, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AI insight not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating AI insight:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/ai-insights/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM ai_insights WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AI insight not found' });
    }
    res.json({ message: 'AI insight deleted successfully' });
  } catch (error) {
    console.error('Error deleting AI insight:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate comprehensive AI insights
app.post('/api/ai-insights/generate', authenticateToken, async (req, res) => {
  try {
    // Get all relevant data
    const products = await pool.query('SELECT * FROM products');
    const competitors = await pool.query('SELECT * FROM competitors');
    const demandSignals = await pool.query('SELECT * FROM demand_signals');
    const marketTrends = await pool.query('SELECT * FROM market_trends');

    const prompt = `As an AI pricing optimization expert, analyze this e-commerce data and generate actionable insights:

    Products (${products.rows.length} items): ${JSON.stringify(products.rows.slice(0, 5))}

    Competitors (${competitors.rows.length} items): ${JSON.stringify(competitors.rows.slice(0, 5))}

    Demand Signals (${demandSignals.rows.length} items): ${JSON.stringify(demandSignals.rows.slice(0, 5))}

    Market Trends (${marketTrends.rows.length} items): ${JSON.stringify(marketTrends.rows.slice(0, 5))}

    Please provide 3 key insights in JSON format:
    [
      {
        "insight_type": "pricing|competitor|demand|trend",
        "title": "<brief title>",
        "content": "<detailed insight>",
        "priority": "high|medium|low",
        "related_products": "<comma-separated product names>"
      }
    ]`;

    const aiResponse = await callOpenRouter(prompt);

    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const insights = JSON.parse(jsonMatch[0]);
        const savedInsights = [];

        for (const insight of insights) {
          const result = await pool.query(
            'INSERT INTO ai_insights (insight_type, title, content, priority, status, related_products) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [insight.insight_type, insight.title, insight.content, insight.priority, 'new', insight.related_products]
          );
          savedInsights.push(result.rows[0]);
        }

        res.json({ insights: savedInsights, aiResponse });
      } else {
        res.json({ aiResponse, message: 'AI response provided as text' });
      }
    } catch (parseError) {
      res.json({ aiResponse, message: 'AI response could not be parsed' });
    }
  } catch (error) {
    console.error('Error generating AI insights:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== USER MANAGEMENT ROUTES ====================
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at',
      [name, email, hashedPassword, role || 'user']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    let query, params;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET name = $1, email = $2, password = $3, role = $4 WHERE id = $5 RETURNING id, email, name, role, created_at';
      params = [name, email, hashedPassword, role, req.params.id];
    } else {
      query = 'UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4 RETURNING id, email, name, role, created_at';
      params = [name, email, role, req.params.id];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DASHBOARD STATS ====================
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const products = await pool.query('SELECT COUNT(*) as count FROM products');
    const competitors = await pool.query('SELECT COUNT(*) as count FROM competitors');
    const suggestions = await pool.query('SELECT COUNT(*) as count FROM price_suggestions WHERE status = $1', ['pending']);
    const insights = await pool.query('SELECT COUNT(*) as count FROM ai_insights WHERE status = $1', ['new']);
    const bundles = await pool.query('SELECT COUNT(*) as count FROM bundle_recommendations');
    const forecasts = await pool.query('SELECT COUNT(*) as count FROM demand_forecasts');
    const discounts = await pool.query('SELECT COUNT(*) as count FROM discount_optimizations');
    const elasticity = await pool.query('SELECT COUNT(*) as count FROM price_elasticity');
    const tracking = await pool.query('SELECT COUNT(*) as count FROM competitor_price_tracking WHERE alert_status = $1', ['alert']);

    // Admin feature counts
    const passwordResetsCount = await pool.query('SELECT COUNT(*) as count FROM password_resets');
    const passwordChangesCount = await pool.query('SELECT COUNT(*) as count FROM password_changes');
    const sessionLogsCount = await pool.query('SELECT COUNT(*) as count FROM session_logs');
    const paginationConfigsCount = await pool.query('SELECT COUNT(*) as count FROM pagination_configs');
    const pdfExportsCount = await pool.query('SELECT COUNT(*) as count FROM pdf_exports');
    const confirmationDialogsCount = await pool.query('SELECT COUNT(*) as count FROM confirmation_dialogs');
    const errorLogsCount = await pool.query('SELECT COUNT(*) as count FROM error_logs');
    const loadingConfigsCount = await pool.query('SELECT COUNT(*) as count FROM loading_configs');
    const rbacPoliciesCount = await pool.query('SELECT COUNT(*) as count FROM rbac_policies');
    const rateLimitLogsCount = await pool.query('SELECT COUNT(*) as count FROM rate_limit_logs');
    const securityHeadersCount = await pool.query('SELECT COUNT(*) as count FROM security_headers');
    const emailVerificationsCount = await pool.query('SELECT COUNT(*) as count FROM email_verifications');
    const passwordValidationsCount = await pool.query('SELECT COUNT(*) as count FROM password_validations');

    res.json({
      totalProducts: parseInt(products.rows[0].count),
      totalCompetitors: parseInt(competitors.rows[0].count),
      pendingSuggestions: parseInt(suggestions.rows[0].count),
      newInsights: parseInt(insights.rows[0].count),
      totalBundles: parseInt(bundles.rows[0].count),
      totalForecasts: parseInt(forecasts.rows[0].count),
      totalDiscounts: parseInt(discounts.rows[0].count),
      totalElasticity: parseInt(elasticity.rows[0].count),
      priceAlerts: parseInt(tracking.rows[0].count),
      totalPasswordResets: parseInt(passwordResetsCount.rows[0].count),
      totalPasswordChanges: parseInt(passwordChangesCount.rows[0].count),
      totalSessionLogs: parseInt(sessionLogsCount.rows[0].count),
      totalPaginationConfigs: parseInt(paginationConfigsCount.rows[0].count),
      totalPdfExports: parseInt(pdfExportsCount.rows[0].count),
      totalConfirmationDialogs: parseInt(confirmationDialogsCount.rows[0].count),
      totalErrorLogs: parseInt(errorLogsCount.rows[0].count),
      totalLoadingConfigs: parseInt(loadingConfigsCount.rows[0].count),
      totalRbacPolicies: parseInt(rbacPoliciesCount.rows[0].count),
      totalRateLimitLogs: parseInt(rateLimitLogsCount.rows[0].count),
      totalSecurityHeaders: parseInt(securityHeadersCount.rows[0].count),
      totalEmailVerifications: parseInt(emailVerificationsCount.rows[0].count),
      totalPasswordValidations: parseInt(passwordValidationsCount.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== NEW FEATURE: COMPETITOR PRICE TRACKING ====================
app.get('/api/competitor-tracking', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM competitor_price_tracking ORDER BY tracked_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching competitor tracking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/competitor-tracking/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM competitor_price_tracking WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tracking record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching tracking record:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/competitor-tracking', authenticateToken, async (req, res) => {
  try {
    const { competitor_name, product_name, previous_price, current_price, alert_status, notes } = req.body;
    const price_change = current_price - previous_price;
    const change_percentage = ((price_change / previous_price) * 100).toFixed(2);

    const result = await pool.query(
      'INSERT INTO competitor_price_tracking (competitor_name, product_name, previous_price, current_price, price_change, change_percentage, alert_status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [competitor_name, product_name, previous_price, current_price, price_change, change_percentage, alert_status || 'normal', notes]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating tracking record:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/competitor-tracking/:id', authenticateToken, async (req, res) => {
  try {
    const { competitor_name, product_name, previous_price, current_price, alert_status, notes } = req.body;
    const price_change = current_price - previous_price;
    const change_percentage = ((price_change / previous_price) * 100).toFixed(2);

    const result = await pool.query(
      'UPDATE competitor_price_tracking SET competitor_name = $1, product_name = $2, previous_price = $3, current_price = $4, price_change = $5, change_percentage = $6, alert_status = $7, notes = $8, updated_at = NOW() WHERE id = $9 RETURNING *',
      [competitor_name, product_name, previous_price, current_price, price_change, change_percentage, alert_status, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tracking record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tracking record:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/competitor-tracking/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM competitor_price_tracking WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tracking record not found' });
    }
    res.json({ message: 'Tracking record deleted successfully' });
  } catch (error) {
    console.error('Error deleting tracking record:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Competitor Tracking Analysis
app.post('/api/competitor-tracking/analyze', authenticateToken, async (req, res) => {
  try {
    const { trackingId } = req.body;

    const result = await pool.query('SELECT * FROM competitor_price_tracking WHERE id = $1', [trackingId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tracking record not found' });
    }

    const tracking = result.rows[0];

    // Get our product price
    const ourProduct = await pool.query('SELECT * FROM products WHERE name ILIKE $1', [`%${tracking.product_name}%`]);
    const ourPrice = ourProduct.rows[0]?.current_price || 'Unknown';

    const prompt = `Analyze this competitor price change and provide strategic recommendations:

COMPETITOR PRICE CHANGE DETECTED:
- Competitor: ${tracking.competitor_name}
- Product: ${tracking.product_name}
- Previous Price: $${tracking.previous_price}
- Current Price: $${tracking.current_price}
- Price Change: $${tracking.price_change} (${tracking.change_percentage}%)
- Alert Status: ${tracking.alert_status}
- Our Current Price: $${ourPrice}

Please provide a comprehensive analysis in the following JSON format:
{
  "impact_assessment": {
    "severity": "high|medium|low",
    "market_impact": "<brief description>",
    "competitive_position": "<how this affects our position>"
  },
  "recommended_actions": [
    {
      "action": "<specific action to take>",
      "priority": "immediate|short-term|long-term",
      "expected_outcome": "<what we expect to achieve>"
    }
  ],
  "price_recommendation": {
    "suggested_price": <number>,
    "reasoning": "<why this price>",
    "timing": "<when to implement>"
  },
  "risk_analysis": {
    "if_we_match": "<consequence>",
    "if_we_dont_match": "<consequence>",
    "best_strategy": "<recommended approach>"
  }
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are a competitive pricing strategist with expertise in e-commerce market dynamics.');

    // Parse the AI response
    let parsedAnalysis = null;
    try {
      const jsonString = extractJSON(aiResponse, 'object');
      if (jsonString) {
        parsedAnalysis = JSON.parse(jsonString);
      }
    } catch (e) {
      console.log('Could not parse competitor analysis JSON:', e.message);
    }

    // Update the tracking record with AI analysis
    await pool.query(
      'UPDATE competitor_price_tracking SET ai_analysis = $1, updated_at = NOW() WHERE id = $2',
      [aiResponse, trackingId]
    );

    res.json({ analysis: parsedAnalysis || aiResponse, aiResponse, tracking });
  } catch (error) {
    console.error('Error analyzing competitor tracking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== NEW FEATURE: DEMAND FORECASTS ====================
app.get('/api/demand-forecasts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM demand_forecasts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching demand forecasts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/demand-forecasts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM demand_forecasts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demand forecast not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching demand forecast:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/demand-forecasts', authenticateToken, async (req, res) => {
  try {
    const { product_name, forecast_period, predicted_demand, confidence_level, seasonality_factor, trend_direction, recommended_price, current_price, factors } = req.body;
    const result = await pool.query(
      'INSERT INTO demand_forecasts (product_name, forecast_period, predicted_demand, confidence_level, seasonality_factor, trend_direction, recommended_price, current_price, factors) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [product_name, forecast_period, predicted_demand, confidence_level, seasonality_factor, trend_direction, recommended_price, current_price, factors]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating demand forecast:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/demand-forecasts/:id', authenticateToken, async (req, res) => {
  try {
    const { product_name, forecast_period, predicted_demand, confidence_level, seasonality_factor, trend_direction, recommended_price, current_price, factors } = req.body;
    const result = await pool.query(
      'UPDATE demand_forecasts SET product_name = $1, forecast_period = $2, predicted_demand = $3, confidence_level = $4, seasonality_factor = $5, trend_direction = $6, recommended_price = $7, current_price = $8, factors = $9, updated_at = NOW() WHERE id = $10 RETURNING *',
      [product_name, forecast_period, predicted_demand, confidence_level, seasonality_factor, trend_direction, recommended_price, current_price, factors, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demand forecast not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating demand forecast:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/demand-forecasts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM demand_forecasts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demand forecast not found' });
    }
    res.json({ message: 'Demand forecast deleted successfully' });
  } catch (error) {
    console.error('Error deleting demand forecast:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Demand Forecast Generation
app.post('/api/demand-forecasts/generate', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;

    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Gather historical data
    const demandSignals = await pool.query('SELECT * FROM demand_signals WHERE product_name ILIKE $1', [`%${product.name}%`]);
    const priceHistory = await pool.query('SELECT * FROM price_history WHERE product_name ILIKE $1 ORDER BY change_date DESC LIMIT 10', [`%${product.name}%`]);
    const marketTrends = await pool.query('SELECT * FROM market_trends WHERE category = $1 OR impact_level = $2', [product.category, 'high']);

    const prompt = `Generate a demand forecast for this product:

PRODUCT INFORMATION:
- Name: ${product.name}
- Category: ${product.category}
- Current Price: $${product.current_price}
- Cost: $${product.cost}

HISTORICAL DEMAND SIGNALS:
${demandSignals.rows.map(s => `- ${s.signal_type}: Strength ${s.signal_strength}/100, Trend: ${s.trend}`).join('\n') || 'No historical data'}

PRICE HISTORY:
${priceHistory.rows.map(h => `- ${new Date(h.change_date).toLocaleDateString()}: $${h.old_price} → $${h.new_price}`).join('\n') || 'No price history'}

RELEVANT MARKET TRENDS:
${marketTrends.rows.map(t => `- ${t.trend_name}: ${t.direction} (${t.impact_level} impact)`).join('\n') || 'No trends'}

Please provide a demand forecast in the following JSON format:
{
  "forecast_period": "Q1 2024|Q2 2024|etc",
  "predicted_demand": <number of units>,
  "confidence_level": <0-100>,
  "seasonality_factor": <0.5-2.0 multiplier>,
  "trend_direction": "increasing|decreasing|stable|seasonal",
  "recommended_price": <optimal price based on demand>,
  "factors": "<key factors influencing the forecast>",
  "detailed_analysis": {
    "demand_drivers": ["<factor 1>", "<factor 2>"],
    "risks": ["<risk 1>", "<risk 2>"],
    "opportunities": ["<opportunity 1>", "<opportunity 2>"],
    "pricing_strategy": "<recommended pricing approach based on demand>"
  }
}`;

    console.log('=== Calling OpenRouter for demand forecast ===');
    const aiResponse = await callOpenRouter(prompt, 'You are a demand forecasting expert with deep knowledge of e-commerce patterns and consumer behavior.');
    console.log('AI Response received:', aiResponse?.substring(0, 200));

    try {
      const jsonString = extractJSON(aiResponse, 'object');
      if (jsonString) {
        const forecast = JSON.parse(jsonString);
        console.log('Parsed forecast:', forecast);

        const result = await pool.query(
          'INSERT INTO demand_forecasts (product_name, forecast_period, predicted_demand, confidence_level, seasonality_factor, trend_direction, recommended_price, current_price, factors, ai_analysis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
          [product.name, forecast.forecast_period, forecast.predicted_demand, forecast.confidence_level, forecast.seasonality_factor, forecast.trend_direction, forecast.recommended_price, product.current_price, forecast.factors, aiResponse]
        );

        console.log('Forecast saved to DB:', result.rows[0]);
        res.json({ forecast: result.rows[0], aiResponse });
      } else {
        console.log('No JSON found in AI response, creating fallback forecast');
        // Create a fallback forecast with the AI response
        const fallbackForecast = {
          product_name: product.name,
          forecast_period: 'Q1 2024',
          predicted_demand: 1000,
          confidence_level: 70,
          seasonality_factor: 1.0,
          trend_direction: 'stable',
          recommended_price: product.current_price,
          current_price: product.current_price,
          factors: 'AI analysis provided below',
          ai_analysis: aiResponse
        };
        res.json({ forecast: fallbackForecast, aiResponse, message: 'AI response provided as text' });
      }
    } catch (parseError) {
      console.log('Parse error:', parseError.message);
      // Create a fallback forecast even on parse error
      const fallbackForecast = {
        product_name: product.name,
        forecast_period: 'Q1 2024',
        predicted_demand: 1000,
        confidence_level: 70,
        seasonality_factor: 1.0,
        trend_direction: 'stable',
        recommended_price: product.current_price,
        current_price: product.current_price,
        factors: 'AI analysis provided below',
        ai_analysis: aiResponse
      };
      res.json({ forecast: fallbackForecast, aiResponse, message: 'AI response could not be parsed' });
    }
  } catch (error) {
    console.error('Error generating demand forecast:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Analyze specific demand forecast with AI
app.post('/api/demand-forecasts/analyze', authenticateToken, async (req, res) => {
  try {
    const { forecastId } = req.body;
    console.log('=== Analyzing demand forecast:', forecastId, '===');

    const forecastResult = await pool.query('SELECT * FROM demand_forecasts WHERE id = $1', [forecastId]);
    if (forecastResult.rows.length === 0) {
      return res.status(404).json({ error: 'Demand forecast not found' });
    }

    const forecast = forecastResult.rows[0];

    // Get related data
    const demandSignals = await pool.query('SELECT * FROM demand_signals WHERE product_name ILIKE $1', [`%${forecast.product_name}%`]);
    const competitors = await pool.query('SELECT * FROM competitors WHERE product_name ILIKE $1 LIMIT 5', [`%${forecast.product_name}%`]);
    const priceHistory = await pool.query('SELECT * FROM price_history WHERE product_name ILIKE $1 ORDER BY change_date DESC LIMIT 5', [`%${forecast.product_name}%`]);

    const prompt = `Analyze this demand forecast and provide strategic insights:

FORECAST DATA:
- Product: ${forecast.product_name}
- Forecast Period: ${forecast.forecast_period}
- Predicted Demand: ${forecast.predicted_demand} units
- Confidence Level: ${forecast.confidence_level}%
- Seasonality Factor: ${forecast.seasonality_factor}x
- Trend Direction: ${forecast.trend_direction}
- Current Price: $${forecast.current_price}
- Recommended Price: $${forecast.recommended_price}
- Key Factors: ${forecast.factors || 'Not specified'}

DEMAND SIGNALS:
${demandSignals.rows.map(s => `- ${s.signal_type}: Strength ${s.signal_strength}/100, Trend: ${s.trend}`).join('\n') || 'No demand signals available'}

COMPETITOR LANDSCAPE:
${competitors.rows.map(c => `- ${c.name}: $${c.competitor_price} (${c.market_position})`).join('\n') || 'No competitor data'}

PRICE HISTORY:
${priceHistory.rows.map(h => `- ${new Date(h.change_date).toLocaleDateString()}: $${h.old_price} → $${h.new_price}`).join('\n') || 'No price history'}

Please provide a comprehensive demand analysis in this JSON format:
{
  "predicted_demand": ${forecast.predicted_demand},
  "confidence_level": ${forecast.confidence_level},
  "trend_direction": "${forecast.trend_direction}",
  "recommended_price": ${forecast.recommended_price},
  "seasonality_factor": ${forecast.seasonality_factor},
  "factors": "<key factors affecting demand>",
  "detailed_analysis": {
    "demand_drivers": ["<specific demand driver 1>", "<demand driver 2>", "<demand driver 3>"],
    "risks": ["<specific risk factor 1>", "<risk factor 2>", "<risk factor 3>"],
    "opportunities": ["<market opportunity 1>", "<opportunity 2>", "<opportunity 3>"],
    "pricing_strategy": "<detailed pricing strategy recommendation based on the forecast>"
  }
}`;

    console.log('=== Calling OpenRouter for demand analysis ===');
    const aiResponse = await callOpenRouter(prompt, 'You are a demand forecasting expert specializing in market analysis, consumer behavior, and pricing strategy.');
    console.log('AI Response received:', aiResponse?.substring(0, 300));

    try {
      const jsonString = extractJSON(aiResponse, 'object');
      if (jsonString) {
        const analysis = JSON.parse(jsonString);
        console.log('Successfully parsed demand analysis');

        await pool.query(
          'UPDATE demand_forecasts SET ai_analysis = $1 WHERE id = $2',
          [JSON.stringify(analysis), forecastId]
        );

        res.json({ analysis, aiResponse, message: 'Forecast analyzed successfully' });
      } else {
        console.log('No JSON found in response');
        res.json({ aiResponse, message: 'AI response provided as text' });
      }
    } catch (parseError) {
      console.log('Parse error:', parseError.message);
      res.json({ aiResponse, message: 'AI response received but could not be parsed as JSON' });
    }
  } catch (error) {
    console.error('Error analyzing demand forecast:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== NEW FEATURE: BUNDLE RECOMMENDATIONS ====================
app.get('/api/bundle-recommendations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bundle_recommendations ORDER BY affinity_score DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bundle recommendations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/bundle-recommendations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bundle_recommendations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bundle recommendation not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching bundle recommendation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/bundle-recommendations', authenticateToken, async (req, res) => {
  try {
    const { bundle_name, products, individual_total, bundle_price, discount_percentage, expected_margin, affinity_score, recommendation_reason, status } = req.body;
    const result = await pool.query(
      'INSERT INTO bundle_recommendations (bundle_name, products, individual_total, bundle_price, discount_percentage, expected_margin, affinity_score, recommendation_reason, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [bundle_name, products, individual_total, bundle_price, discount_percentage, expected_margin, affinity_score, recommendation_reason, status || 'suggested']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating bundle recommendation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/bundle-recommendations/:id', authenticateToken, async (req, res) => {
  try {
    const { bundle_name, products, individual_total, bundle_price, discount_percentage, expected_margin, affinity_score, recommendation_reason, status } = req.body;
    const result = await pool.query(
      'UPDATE bundle_recommendations SET bundle_name = $1, products = $2, individual_total = $3, bundle_price = $4, discount_percentage = $5, expected_margin = $6, affinity_score = $7, recommendation_reason = $8, status = $9, updated_at = NOW() WHERE id = $10 RETURNING *',
      [bundle_name, products, individual_total, bundle_price, discount_percentage, expected_margin, affinity_score, recommendation_reason, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bundle recommendation not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating bundle recommendation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/bundle-recommendations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM bundle_recommendations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bundle recommendation not found' });
    }
    res.json({ message: 'Bundle recommendation deleted successfully' });
  } catch (error) {
    console.error('Error deleting bundle recommendation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Bundle Generation
app.post('/api/bundle-recommendations/generate', authenticateToken, async (req, res) => {
  try {
    const products = await pool.query('SELECT * FROM products ORDER BY category, current_price');
    const demandSignals = await pool.query('SELECT * FROM demand_signals ORDER BY signal_strength DESC LIMIT 20');

    const prompt = `Analyze these products and recommend profitable bundles:

AVAILABLE PRODUCTS:
${products.rows.map(p => `- ${p.name} (${p.category}): $${p.current_price}, Cost: $${p.cost}`).join('\n')}

DEMAND SIGNALS:
${demandSignals.rows.map(s => `- ${s.product_name}: ${s.signal_type} strength ${s.signal_strength}/100`).join('\n')}

Please recommend 3 profitable product bundles in this JSON format:
[
  {
    "bundle_name": "<creative bundle name>",
    "products": "<comma-separated product names>",
    "individual_total": <sum of individual prices>,
    "bundle_price": <recommended bundle price>,
    "discount_percentage": <percentage discount>,
    "expected_margin": <expected profit margin %>,
    "affinity_score": <0-100 how well products go together>,
    "recommendation_reason": "<why these products bundle well>",
    "detailed_analysis": {
      "target_customer": "<who would buy this>",
      "cross_sell_potential": "<upsell opportunities>",
      "seasonal_relevance": "<best time to promote>",
      "marketing_angle": "<how to position this bundle>"
    }
  }
]`;

    console.log('=== Calling OpenRouter for bundle recommendations ===');
    const aiResponse = await callOpenRouter(prompt, 'You are a retail merchandising expert specializing in product bundling and cross-selling strategies.');
    console.log('AI Response received:', aiResponse?.substring(0, 300));

    try {
      const jsonString = extractJSON(aiResponse, 'array');
      if (jsonString) {
        const bundles = JSON.parse(jsonString);
        console.log('Parsed bundles:', bundles.length);
        const savedBundles = [];

        for (const bundle of bundles) {
          const result = await pool.query(
            'INSERT INTO bundle_recommendations (bundle_name, products, individual_total, bundle_price, discount_percentage, expected_margin, affinity_score, recommendation_reason, status, ai_analysis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [bundle.bundle_name, bundle.products, bundle.individual_total, bundle.bundle_price, bundle.discount_percentage, bundle.expected_margin, bundle.affinity_score, bundle.recommendation_reason, 'suggested', JSON.stringify(bundle.detailed_analysis)]
          );
          savedBundles.push(result.rows[0]);
        }

        console.log('Saved bundles to DB:', savedBundles.length);
        res.json({ bundles: savedBundles, aiResponse });
      } else {
        console.log('No JSON array found in AI response');
        res.json({ aiResponse, message: 'AI response provided as text' });
      }
    } catch (parseError) {
      console.log('Parse error:', parseError.message);
      res.json({ aiResponse, message: 'AI response could not be parsed' });
    }
  } catch (error) {
    console.error('Error generating bundle recommendations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Analyze Specific Bundle
app.post('/api/bundle-recommendations/analyze', authenticateToken, async (req, res) => {
  try {
    const { bundleId } = req.body;
    console.log('=== Analyzing bundle:', bundleId, '===');

    const bundleResult = await pool.query('SELECT * FROM bundle_recommendations WHERE id = $1', [bundleId]);
    if (bundleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const bundle = bundleResult.rows[0];

    // Get related product data
    const productNames = bundle.products.split(',').map(p => p.trim());
    const products = await pool.query('SELECT * FROM products WHERE name = ANY($1)', [productNames]);
    const demandSignals = await pool.query('SELECT * FROM demand_signals ORDER BY signal_strength DESC LIMIT 10');
    const competitors = await pool.query('SELECT * FROM competitors LIMIT 5');

    const prompt = `Analyze this product bundle and provide strategic insights:

BUNDLE INFORMATION:
- Bundle Name: ${bundle.bundle_name}
- Products: ${bundle.products}
- Individual Total: $${bundle.individual_total}
- Bundle Price: $${bundle.bundle_price}
- Discount: ${bundle.discount_percentage}%
- Current Affinity Score: ${bundle.affinity_score}/100
- Recommendation Reason: ${bundle.recommendation_reason}

PRODUCT DETAILS:
${products.rows.map(p => `- ${p.name}: $${p.current_price} (Cost: $${p.cost}, Category: ${p.category})`).join('\n') || 'Product details not available'}

MARKET CONTEXT:
${demandSignals.rows.map(s => `- ${s.product_name}: ${s.signal_type} (strength: ${s.signal_strength}/100)`).join('\n') || 'No demand signals'}

COMPETITOR LANDSCAPE:
${competitors.rows.map(c => `- ${c.name}: ${c.pricing_strategy}`).join('\n') || 'No competitor data'}

Please provide a comprehensive bundle analysis in this JSON format:
{
  "target_customer": "<detailed description of ideal customer persona>",
  "cross_sell_potential": "<specific upsell and cross-sell opportunities>",
  "seasonal_relevance": "<best seasons/events to promote this bundle>",
  "marketing_angle": "<compelling marketing message and positioning>",
  "price_optimization": {
    "current_assessment": "<is current pricing optimal?>",
    "recommended_price": <suggested price>,
    "reasoning": "<why this price is better>"
  },
  "competitive_advantage": "<how this bundle beats competitors>",
  "risks": ["<risk 1>", "<risk 2>"],
  "opportunities": ["<opportunity 1>", "<opportunity 2>"],
  "action_items": ["<action 1>", "<action 2>", "<action 3>"]
}`;

    console.log('=== Calling OpenRouter for bundle analysis ===');
    const aiResponse = await callOpenRouter(prompt, 'You are a retail strategy expert specializing in product bundling, pricing optimization, and customer psychology.');
    console.log('AI Response received:', aiResponse?.substring(0, 300));

    // Update the bundle with new AI analysis
    try {
      const jsonString = extractJSON(aiResponse, 'object');
      if (jsonString) {
        const analysis = JSON.parse(jsonString);
        console.log('Successfully parsed AI analysis');

        // Update database with new analysis
        await pool.query(
          'UPDATE bundle_recommendations SET ai_analysis = $1 WHERE id = $2',
          [JSON.stringify(analysis), bundleId]
        );

        res.json({ analysis, aiResponse, message: 'Bundle analyzed successfully' });
      } else {
        console.log('No JSON found in response');
        res.json({ aiResponse, message: 'AI response provided as text' });
      }
    } catch (parseError) {
      console.log('Parse error:', parseError.message);
      res.json({ aiResponse, message: 'AI response received but could not be parsed as JSON' });
    }
  } catch (error) {
    console.error('Error analyzing bundle:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== NEW FEATURE: DISCOUNT OPTIMIZATIONS ====================
app.get('/api/discount-optimizations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM discount_optimizations ORDER BY expected_revenue_impact DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching discount optimizations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/discount-optimizations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM discount_optimizations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Discount optimization not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching discount optimization:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/discount-optimizations', authenticateToken, async (req, res) => {
  try {
    const { product_name, current_price, optimal_discount, discounted_price, expected_volume_increase, expected_revenue_impact, break_even_volume, recommendation, discount_type, valid_period } = req.body;
    const result = await pool.query(
      'INSERT INTO discount_optimizations (product_name, current_price, optimal_discount, discounted_price, expected_volume_increase, expected_revenue_impact, break_even_volume, recommendation, discount_type, valid_period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [product_name, current_price, optimal_discount, discounted_price, expected_volume_increase, expected_revenue_impact, break_even_volume, recommendation, discount_type, valid_period]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating discount optimization:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/discount-optimizations/:id', authenticateToken, async (req, res) => {
  try {
    const { product_name, current_price, optimal_discount, discounted_price, expected_volume_increase, expected_revenue_impact, break_even_volume, recommendation, discount_type, valid_period } = req.body;
    const result = await pool.query(
      'UPDATE discount_optimizations SET product_name = $1, current_price = $2, optimal_discount = $3, discounted_price = $4, expected_volume_increase = $5, expected_revenue_impact = $6, break_even_volume = $7, recommendation = $8, discount_type = $9, valid_period = $10, updated_at = NOW() WHERE id = $11 RETURNING *',
      [product_name, current_price, optimal_discount, discounted_price, expected_volume_increase, expected_revenue_impact, break_even_volume, recommendation, discount_type, valid_period, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Discount optimization not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating discount optimization:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/discount-optimizations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM discount_optimizations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Discount optimization not found' });
    }
    res.json({ message: 'Discount optimization deleted successfully' });
  } catch (error) {
    console.error('Error deleting discount optimization:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Discount Optimization
app.post('/api/discount-optimizations/generate', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;

    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get elasticity data if available
    const elasticity = await pool.query('SELECT * FROM price_elasticity WHERE product_name ILIKE $1', [`%${product.name}%`]);
    const demandSignals = await pool.query('SELECT * FROM demand_signals WHERE product_name ILIKE $1', [`%${product.name}%`]);
    const competitors = await pool.query('SELECT * FROM competitors WHERE product_name ILIKE $1', [`%${product.name}%`]);

    const prompt = `Calculate the optimal discount for this product:

PRODUCT INFORMATION:
- Name: ${product.name}
- Category: ${product.category}
- Current Price: $${product.current_price}
- Cost: $${product.cost}
- Current Margin: ${((product.current_price - product.cost) / product.current_price * 100).toFixed(1)}%

PRICE ELASTICITY DATA:
${elasticity.rows.length > 0 ? `- Elasticity: ${elasticity.rows[0].elasticity_coefficient} (${elasticity.rows[0].elasticity_type})` : 'No elasticity data'}

DEMAND SIGNALS:
${demandSignals.rows.map(s => `- ${s.signal_type}: Strength ${s.signal_strength}/100, Trend: ${s.trend}`).join('\n') || 'No demand signals'}

COMPETITOR PRICES:
${competitors.rows.map(c => `- ${c.name}: $${c.competitor_price}`).join('\n') || 'No competitor data'}

Please calculate the optimal discount in this JSON format:
{
  "optimal_discount": <percentage as number, e.g., 15 for 15%>,
  "discounted_price": <final price after discount>,
  "expected_volume_increase": <percentage increase in sales volume>,
  "expected_revenue_impact": <dollar amount change in revenue>,
  "break_even_volume": <units needed to break even>,
  "recommendation": "highly_recommended|recommended|optional|not_recommended",
  "discount_type": "percentage|fixed|tiered",
  "valid_period": "<recommended duration>",
  "detailed_analysis": {
    "profit_impact": "<how profit is affected>",
    "market_positioning": "<how this affects brand position>",
    "customer_psychology": "<how customers perceive this discount>",
    "best_timing": "<when to implement>",
    "risks": ["<risk 1>", "<risk 2>"],
    "alternatives": ["<alternative 1>", "<alternative 2>"]
  }
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are a pricing analyst expert in discount optimization and promotional strategies.');

    try {
      const jsonString = extractJSON(aiResponse, 'object');
      if (jsonString) {
        const discount = JSON.parse(jsonString);

        const result = await pool.query(
          'INSERT INTO discount_optimizations (product_name, current_price, optimal_discount, discounted_price, expected_volume_increase, expected_revenue_impact, break_even_volume, recommendation, discount_type, valid_period, ai_analysis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
          [product.name, product.current_price, discount.optimal_discount, discount.discounted_price, discount.expected_volume_increase, discount.expected_revenue_impact, discount.break_even_volume, discount.recommendation, discount.discount_type, discount.valid_period, aiResponse]
        );

        res.json({ optimization: result.rows[0], aiResponse });
      } else {
        res.json({ aiResponse, message: 'AI response provided as text' });
      }
    } catch (parseError) {
      res.json({ aiResponse, message: 'AI response could not be parsed' });
    }
  } catch (error) {
    console.error('Error generating discount optimization:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Analyze specific discount optimization with AI
app.post('/api/discount-optimizations/analyze', authenticateToken, async (req, res) => {
  try {
    const { optimizationId } = req.body;
    console.log('=== Analyzing discount optimization:', optimizationId, '===');

    const optResult = await pool.query('SELECT * FROM discount_optimizations WHERE id = $1', [optimizationId]);
    if (optResult.rows.length === 0) {
      return res.status(404).json({ error: 'Discount optimization not found' });
    }

    const optimization = optResult.rows[0];

    // Get related data
    const elasticity = await pool.query('SELECT * FROM price_elasticity WHERE product_name ILIKE $1', [`%${optimization.product_name}%`]);
    const competitors = await pool.query('SELECT * FROM competitors WHERE product_name ILIKE $1 LIMIT 5', [`%${optimization.product_name}%`]);
    const demandSignals = await pool.query('SELECT * FROM demand_signals WHERE product_name ILIKE $1', [`%${optimization.product_name}%`]);

    const prompt = `Analyze this discount optimization and provide strategic insights:

DISCOUNT OPTIMIZATION DETAILS:
- Product: ${optimization.product_name}
- Current Price: $${optimization.current_price}
- Optimal Discount: ${optimization.optimal_discount}%
- Discounted Price: $${optimization.discounted_price}
- Expected Volume Increase: ${optimization.expected_volume_increase}%
- Expected Revenue Impact: $${optimization.expected_revenue_impact}
- Break-even Volume: ${optimization.break_even_volume} units
- Discount Type: ${optimization.discount_type}
- Valid Period: ${optimization.valid_period || 'Not specified'}
- Current Recommendation: ${optimization.recommendation}

PRICE ELASTICITY:
${elasticity.rows.length > 0 ? `Coefficient: ${elasticity.rows[0].elasticity_coefficient} (${elasticity.rows[0].elasticity_type})` : 'No elasticity data available'}

COMPETITOR LANDSCAPE:
${competitors.rows.map(c => `- ${c.name}: $${c.competitor_price}`).join('\n') || 'No competitor data'}

DEMAND SIGNALS:
${demandSignals.rows.map(s => `- ${s.signal_type}: Strength ${s.signal_strength}/100`).join('\n') || 'No demand signals'}

Please provide a comprehensive discount analysis in this JSON format:
{
  "optimal_discount": ${optimization.optimal_discount},
  "expected_volume_increase": ${optimization.expected_volume_increase},
  "expected_revenue_impact": ${optimization.expected_revenue_impact},
  "detailed_analysis": {
    "profit_impact": "<detailed analysis of how this discount affects profit margins and overall profitability>",
    "market_positioning": "<how this discount strategy affects brand perception and market positioning>",
    "customer_psychology": "<insights on how customers perceive and respond to this discount level>",
    "best_timing": "<optimal timing recommendations for implementing this discount>",
    "risks": ["<specific risk 1>", "<specific risk 2>", "<specific risk 3>"],
    "alternatives": ["<alternative discount strategy 1>", "<alternative strategy 2>"]
  }
}`;

    console.log('=== Calling OpenRouter for discount analysis ===');
    const aiResponse = await callOpenRouter(prompt, 'You are a retail pricing strategist expert in discount optimization, promotional psychology, and revenue management.');
    console.log('AI Response received:', aiResponse?.substring(0, 300));

    try {
      const jsonString = extractJSON(aiResponse, 'object');
      if (jsonString) {
        const analysis = JSON.parse(jsonString);
        console.log('Successfully parsed discount analysis');

        await pool.query(
          'UPDATE discount_optimizations SET ai_analysis = $1 WHERE id = $2',
          [JSON.stringify(analysis), optimizationId]
        );

        res.json({ analysis, aiResponse, message: 'Discount analyzed successfully' });
      } else {
        console.log('No JSON found in response');
        res.json({ aiResponse, message: 'AI response provided as text' });
      }
    } catch (parseError) {
      console.log('Parse error:', parseError.message);
      res.json({ aiResponse, message: 'AI response received but could not be parsed as JSON' });
    }
  } catch (error) {
    console.error('Error analyzing discount optimization:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== NEW FEATURE: PRICE ELASTICITY ====================
app.get('/api/price-elasticity', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM price_elasticity ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching price elasticity:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/price-elasticity/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM price_elasticity WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price elasticity record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching price elasticity:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/price-elasticity', authenticateToken, async (req, res) => {
  try {
    const { product_name, elasticity_coefficient, elasticity_type, price_sensitivity, optimal_price_range_min, optimal_price_range_max, current_price, demand_curve_type, cross_elasticity } = req.body;
    const result = await pool.query(
      'INSERT INTO price_elasticity (product_name, elasticity_coefficient, elasticity_type, price_sensitivity, optimal_price_range_min, optimal_price_range_max, current_price, demand_curve_type, cross_elasticity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [product_name, elasticity_coefficient, elasticity_type, price_sensitivity, optimal_price_range_min, optimal_price_range_max, current_price, demand_curve_type, cross_elasticity]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating price elasticity:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/price-elasticity/:id', authenticateToken, async (req, res) => {
  try {
    const { product_name, elasticity_coefficient, elasticity_type, price_sensitivity, optimal_price_range_min, optimal_price_range_max, current_price, demand_curve_type, cross_elasticity } = req.body;
    const result = await pool.query(
      'UPDATE price_elasticity SET product_name = $1, elasticity_coefficient = $2, elasticity_type = $3, price_sensitivity = $4, optimal_price_range_min = $5, optimal_price_range_max = $6, current_price = $7, demand_curve_type = $8, cross_elasticity = $9, updated_at = NOW() WHERE id = $10 RETURNING *',
      [product_name, elasticity_coefficient, elasticity_type, price_sensitivity, optimal_price_range_min, optimal_price_range_max, current_price, demand_curve_type, cross_elasticity, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price elasticity record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating price elasticity:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/price-elasticity/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM price_elasticity WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price elasticity record not found' });
    }
    res.json({ message: 'Price elasticity record deleted successfully' });
  } catch (error) {
    console.error('Error deleting price elasticity:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Price Elasticity Analysis
app.post('/api/price-elasticity/analyze', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;

    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get historical data
    const priceHistory = await pool.query('SELECT * FROM price_history WHERE product_name ILIKE $1 ORDER BY change_date DESC LIMIT 10', [`%${product.name}%`]);
    const demandSignals = await pool.query('SELECT * FROM demand_signals WHERE product_name ILIKE $1', [`%${product.name}%`]);
    const competitors = await pool.query('SELECT * FROM competitors WHERE product_name ILIKE $1', [`%${product.name}%`]);
    const categoryProducts = await pool.query('SELECT * FROM products WHERE category = $1 AND id != $2', [product.category, product.id]);

    const prompt = `Analyze the price elasticity for this product:

PRODUCT INFORMATION:
- Name: ${product.name}
- Category: ${product.category}
- Current Price: $${product.current_price}
- Cost: $${product.cost}

PRICE HISTORY (for elasticity estimation):
${priceHistory.rows.map(h => `- ${new Date(h.change_date).toLocaleDateString()}: $${h.old_price} → $${h.new_price} (${h.change_reason})`).join('\n') || 'No price history'}

DEMAND SIGNALS:
${demandSignals.rows.map(s => `- ${s.signal_type}: Strength ${s.signal_strength}/100, Trend: ${s.trend}`).join('\n') || 'No demand signals'}

COMPETITOR PRICES:
${competitors.rows.map(c => `- ${c.name}: $${c.competitor_price} (${c.market_position})`).join('\n') || 'No competitor data'}

CATEGORY PRODUCTS (for cross-elasticity):
${categoryProducts.rows.map(p => `- ${p.name}: $${p.current_price}`).join('\n') || 'No category products'}

Please analyze price elasticity and provide results in this JSON format:
{
  "elasticity_coefficient": <number, negative for normal goods>,
  "elasticity_type": "elastic|inelastic|unit_elastic",
  "price_sensitivity": "high|medium|low",
  "optimal_price_range_min": <minimum optimal price>,
  "optimal_price_range_max": <maximum optimal price>,
  "demand_curve_type": "linear|convex|concave",
  "cross_elasticity": "<related products and their cross-elasticity>",
  "detailed_analysis": {
    "interpretation": "<what the elasticity means for pricing>",
    "pricing_power": "<how much control over price>",
    "volume_sensitivity": "<how volume changes with price>",
    "revenue_optimization": "<strategy to maximize revenue>",
    "competitive_implications": "<how competitors affect elasticity>",
    "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"]
  }
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an economist specializing in price elasticity analysis and demand modeling.');

    try {
      const jsonString = extractJSON(aiResponse, 'object');
      if (jsonString) {
        const elasticity = JSON.parse(jsonString);

        const result = await pool.query(
          'INSERT INTO price_elasticity (product_name, elasticity_coefficient, elasticity_type, price_sensitivity, optimal_price_range_min, optimal_price_range_max, current_price, demand_curve_type, cross_elasticity, ai_analysis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
          [product.name, elasticity.elasticity_coefficient, elasticity.elasticity_type, elasticity.price_sensitivity, elasticity.optimal_price_range_min, elasticity.optimal_price_range_max, product.current_price, elasticity.demand_curve_type, elasticity.cross_elasticity, aiResponse]
        );

        res.json({ elasticity: result.rows[0], aiResponse });
      } else {
        res.json({ aiResponse, message: 'AI response provided as text' });
      }
    } catch (parseError) {
      res.json({ aiResponse, message: 'AI response could not be parsed' });
    }
  } catch (error) {
    console.error('Error analyzing price elasticity:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Analyze specific price elasticity record with AI
app.post('/api/price-elasticity/analyze-item', authenticateToken, async (req, res) => {
  try {
    const { elasticityId } = req.body;
    console.log('=== Analyzing price elasticity item:', elasticityId, '===');

    const elasticityResult = await pool.query('SELECT * FROM price_elasticity WHERE id = $1', [elasticityId]);
    if (elasticityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Price elasticity record not found' });
    }

    const elasticity = elasticityResult.rows[0];

    // Get related data
    const competitors = await pool.query('SELECT * FROM competitors WHERE product_name ILIKE $1 LIMIT 5', [`%${elasticity.product_name}%`]);
    const demandSignals = await pool.query('SELECT * FROM demand_signals WHERE product_name ILIKE $1', [`%${elasticity.product_name}%`]);
    const priceHistory = await pool.query('SELECT * FROM price_history WHERE product_name ILIKE $1 ORDER BY change_date DESC LIMIT 5', [`%${elasticity.product_name}%`]);

    const prompt = `Analyze this price elasticity data and provide strategic insights:

ELASTICITY DATA:
- Product: ${elasticity.product_name}
- Elasticity Coefficient: ${elasticity.elasticity_coefficient}
- Elasticity Type: ${elasticity.elasticity_type}
- Price Sensitivity: ${elasticity.price_sensitivity}
- Current Price: $${elasticity.current_price}
- Optimal Price Range: $${elasticity.optimal_price_range_min} - $${elasticity.optimal_price_range_max}
- Demand Curve Type: ${elasticity.demand_curve_type}
- Cross-Elasticity: ${elasticity.cross_elasticity || 'Not specified'}

COMPETITOR LANDSCAPE:
${competitors.rows.map(c => `- ${c.name}: $${c.competitor_price} (${c.market_position})`).join('\n') || 'No competitor data available'}

DEMAND SIGNALS:
${demandSignals.rows.map(s => `- ${s.signal_type}: Strength ${s.signal_strength}/100, Trend: ${s.trend}`).join('\n') || 'No demand signals'}

PRICE HISTORY:
${priceHistory.rows.map(h => `- ${new Date(h.change_date).toLocaleDateString()}: $${h.old_price} → $${h.new_price}`).join('\n') || 'No price history'}

Please provide a comprehensive elasticity analysis in this JSON format:
{
  "elasticity_coefficient": ${elasticity.elasticity_coefficient},
  "elasticity_type": "${elasticity.elasticity_type}",
  "optimal_price_range_min": ${elasticity.optimal_price_range_min},
  "optimal_price_range_max": ${elasticity.optimal_price_range_max},
  "detailed_analysis": {
    "interpretation": "<detailed explanation of what this elasticity coefficient means for the business>",
    "pricing_power": "<analysis of how much pricing power the business has for this product>",
    "volume_sensitivity": "<how sensitive sales volume is to price changes and what this means>",
    "revenue_optimization": "<specific strategies to optimize revenue based on this elasticity>",
    "competitive_implications": "<how the competitive landscape affects pricing decisions>",
    "recommendations": ["<actionable recommendation 1>", "<actionable recommendation 2>", "<actionable recommendation 3>"]
  }
}`;

    console.log('=== Calling OpenRouter for elasticity analysis ===');
    const aiResponse = await callOpenRouter(prompt, 'You are an economist and pricing strategist specializing in price elasticity analysis, demand modeling, and revenue optimization.');
    console.log('AI Response received:', aiResponse?.substring(0, 300));

    try {
      const jsonString = extractJSON(aiResponse, 'object');
      if (jsonString) {
        const analysis = JSON.parse(jsonString);
        console.log('Successfully parsed elasticity analysis');

        await pool.query(
          'UPDATE price_elasticity SET ai_analysis = $1 WHERE id = $2',
          [JSON.stringify(analysis), elasticityId]
        );

        res.json({ analysis, aiResponse, message: 'Elasticity analyzed successfully' });
      } else {
        console.log('No JSON found in response');
        res.json({ aiResponse, message: 'AI response provided as text' });
      }
    } catch (parseError) {
      console.log('Parse error:', parseError.message);
      res.json({ aiResponse, message: 'AI response received but could not be parsed as JSON' });
    }
  } catch (error) {
    console.error('Error analyzing price elasticity:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== AI PRICE TRACKER ROUTES ====================

// Get all tracked prices
app.get('/api/price-tracker', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pt.*, s.name as store_name, c.name as category_name
      FROM price_tracker pt
      LEFT JOIN price_tracker_stores s ON pt.store_id = s.id
      LEFT JOIN price_tracker_categories c ON pt.category_id = c.id
      ORDER BY pt.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tracked prices:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single tracked item
app.get('/api/price-tracker/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pt.*, s.name as store_name, c.name as category_name
      FROM price_tracker pt
      LEFT JOIN price_tracker_stores s ON pt.store_id = s.id
      LEFT JOIN price_tracker_categories c ON pt.category_id = c.id
      WHERE pt.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching tracked item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create tracked item
app.post('/api/price-tracker', authenticateToken, async (req, res) => {
  try {
    const { name, description, url, current_price, original_price, image_url, category_id, store_id } = req.body;
    const result = await pool.query(
      `INSERT INTO price_tracker (name, description, url, current_price, original_price, image_url, category_id, store_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, description, url, current_price, original_price, image_url, category_id, store_id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating tracked item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update tracked item
app.put('/api/price-tracker/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, url, current_price, original_price, image_url, category_id, store_id } = req.body;
    const result = await pool.query(
      `UPDATE price_tracker SET name = $1, description = $2, url = $3, current_price = $4, original_price = $5,
       image_url = $6, category_id = $7, store_id = $8, updated_at = NOW() WHERE id = $9 RETURNING *`,
      [name, description, url, current_price, original_price, image_url, category_id, store_id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tracked item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete tracked item
app.delete('/api/price-tracker/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM price_tracker WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting tracked item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get price tracker categories
app.get('/api/price-tracker-categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM price_tracker_categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get price tracker stores
app.get('/api/price-tracker-stores', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM price_tracker_stores ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get price tracker alerts
app.get('/api/price-tracker-alerts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, pt.name as product_name, pt.current_price
      FROM price_tracker_alerts a
      JOIN price_tracker pt ON a.product_id = pt.id
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create price alert
app.post('/api/price-tracker-alerts', authenticateToken, async (req, res) => {
  try {
    const { product_id, target_price, alert_type } = req.body;
    const result = await pool.query(
      `INSERT INTO price_tracker_alerts (product_id, target_price, alert_type)
       VALUES ($1, $2, $3) RETURNING *`,
      [product_id, target_price, alert_type || 'below']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete price alert
app.delete('/api/price-tracker-alerts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM price_tracker_alerts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI: Analyze deal
app.post('/api/price-tracker/ai/analyze-deal', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;
    const productResult = await pool.query(`
      SELECT pt.*, s.name as store_name, c.name as category_name
      FROM price_tracker pt
      LEFT JOIN price_tracker_stores s ON pt.store_id = s.id
      LEFT JOIN price_tracker_categories c ON pt.category_id = c.id
      WHERE pt.id = $1
    `, [productId]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];
    const discount = product.original_price ? ((product.original_price - product.current_price) / product.original_price * 100).toFixed(1) : 0;

    const prompt = `Analyze this e-commerce deal and provide a recommendation:

Product: ${product.name}
Store: ${product.store_name || 'Unknown'}
Category: ${product.category_name || 'Unknown'}
Original Price: $${product.original_price || 'N/A'}
Current Price: $${product.current_price}
Discount: ${discount}%
Description: ${product.description || 'N/A'}

Please provide:
1. Deal Score (1-10)
2. Is this a good deal? Why or why not?
3. Buy Now / Wait / Skip recommendation
4. Any concerns or red flags`;

    const aiResponse = await callOpenRouter(prompt, 'You are an AI deal analyst for e-commerce. Evaluate deals and provide buying recommendations.');

    res.json({
      product: product.name,
      store: product.store_name,
      currentPrice: product.current_price,
      originalPrice: product.original_price,
      discount: `${discount}%`,
      analysis: aiResponse,
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI analyze deal error:', error);
    res.status(500).json({ error: 'Failed to analyze deal' });
  }
});

// AI: Predict price
app.post('/api/price-tracker/ai/predict-price', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;
    const productResult = await pool.query('SELECT * FROM price_tracker WHERE id = $1', [productId]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    const prompt = `Analyze this product and predict future prices:

Product: ${product.name}
Current Price: $${product.current_price}
Original Price: $${product.original_price || 'N/A'}
Category: ${product.category_id}

Please provide:
1. Price trend analysis
2. Predicted price in 7 days
3. Predicted price in 30 days
4. Best time to buy recommendation
5. Confidence level (low/medium/high)`;

    const aiResponse = await callOpenRouter(prompt, 'You are an AI price prediction expert. Analyze products and provide price predictions.');

    res.json({
      product: product.name,
      currentPrice: product.current_price,
      analysis: aiResponse,
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI predict price error:', error);
    res.status(500).json({ error: 'Failed to predict price' });
  }
});

// AI: Get recommendations
app.get('/api/price-tracker/ai/recommendations', authenticateToken, async (req, res) => {
  try {
    const dealsResult = await pool.query(`
      SELECT pt.*, s.name as store_name, c.name as category_name,
        ((pt.original_price - pt.current_price) / pt.original_price * 100) as discount_percent
      FROM price_tracker pt
      LEFT JOIN price_tracker_stores s ON pt.store_id = s.id
      LEFT JOIN price_tracker_categories c ON pt.category_id = c.id
      WHERE pt.original_price > pt.current_price
      ORDER BY discount_percent DESC
      LIMIT 10
    `);

    const prompt = `Based on current deals, recommend the best products to buy:

Top Deals Available:
${dealsResult.rows.map((p, i) => `${i + 1}. ${p.name}
   - Category: ${p.category_name || 'Unknown'}
   - Store: ${p.store_name || 'Unknown'}
   - Original: $${p.original_price} → Now: $${p.current_price}
   - Discount: ${parseFloat(p.discount_percent).toFixed(1)}%`).join('\n\n')}

Please provide:
1. Top 3 must-buy deals right now
2. Why each deal is worth considering
3. Any deals to skip and why`;

    const aiResponse = await callOpenRouter(prompt, 'You are an AI shopping assistant. Provide personalized product recommendations based on current deals.');

    res.json({
      topDeals: dealsResult.rows,
      analysis: aiResponse,
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Dashboard stats update for price tracker
app.get('/api/price-tracker/stats', authenticateToken, async (req, res) => {
  try {
    const trackedCount = await pool.query('SELECT COUNT(*) FROM price_tracker');
    const alertsCount = await pool.query('SELECT COUNT(*) FROM price_tracker_alerts WHERE is_active = true');

    res.json({
      trackedProducts: parseInt(trackedCount.rows[0].count),
      activeAlerts: parseInt(alertsCount.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching price tracker stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ADMIN FEATURE CRUD ROUTES ====================

// --- Password Resets (GET list already exists above, add remaining CRUD) ---
app.get('/api/password-resets/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT pr.*, u.email, u.name FROM password_resets pr LEFT JOIN users u ON pr.user_id = u.id WHERE pr.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Password reset not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching password reset:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/password-resets', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, token, used, expires_at } = req.body;
    const result = await pool.query(
      'INSERT INTO password_resets (user_id, token, used, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, token || crypto.randomBytes(32).toString('hex'), used || false, expires_at]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating password reset:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/password-resets/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, token, used, expires_at } = req.body;
    const result = await pool.query(
      'UPDATE password_resets SET user_id = $1, token = $2, used = $3, expires_at = $4 WHERE id = $5 RETURNING *',
      [user_id, token, used, expires_at, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Password reset not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating password reset:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/password-resets/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM password_resets WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Password reset not found' });
    res.json({ message: 'Password reset deleted successfully' });
  } catch (error) {
    console.error('Error deleting password reset:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Password Changes ---
app.get('/api/password-changes', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT pc.*, u.email, u.name FROM password_changes pc LEFT JOIN users u ON pc.user_id = u.id ORDER BY pc.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching password changes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/password-changes/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT pc.*, u.email, u.name FROM password_changes pc LEFT JOIN users u ON pc.user_id = u.id WHERE pc.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Password change not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching password change:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/password-changes', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, change_type, ip_address, user_agent, status } = req.body;
    const result = await pool.query(
      'INSERT INTO password_changes (user_id, change_type, ip_address, user_agent, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, change_type, ip_address, user_agent, status || 'success']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating password change:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/password-changes/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, change_type, ip_address, user_agent, status } = req.body;
    const result = await pool.query(
      'UPDATE password_changes SET user_id = $1, change_type = $2, ip_address = $3, user_agent = $4, status = $5 WHERE id = $6 RETURNING *',
      [user_id, change_type, ip_address, user_agent, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Password change not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating password change:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/password-changes/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM password_changes WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Password change not found' });
    res.json({ message: 'Password change deleted successfully' });
  } catch (error) {
    console.error('Error deleting password change:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Session Logs ---
app.get('/api/session-logs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT sl.*, u.email, u.name FROM session_logs sl LEFT JOIN users u ON sl.user_id = u.id ORDER BY sl.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching session logs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/session-logs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT sl.*, u.email, u.name FROM session_logs sl LEFT JOIN users u ON sl.user_id = u.id WHERE sl.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session log not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching session log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/session-logs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, session_token, ip_address, user_agent, login_at, logout_at, status } = req.body;
    const result = await pool.query(
      'INSERT INTO session_logs (user_id, session_token, ip_address, user_agent, login_at, logout_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [user_id, session_token, ip_address, user_agent, login_at || new Date(), logout_at, status || 'active']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating session log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/session-logs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, session_token, ip_address, user_agent, login_at, logout_at, status } = req.body;
    const result = await pool.query(
      'UPDATE session_logs SET user_id = $1, session_token = $2, ip_address = $3, user_agent = $4, login_at = $5, logout_at = $6, status = $7 WHERE id = $8 RETURNING *',
      [user_id, session_token, ip_address, user_agent, login_at, logout_at, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session log not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating session log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/session-logs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM session_logs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session log not found' });
    res.json({ message: 'Session log deleted successfully' });
  } catch (error) {
    console.error('Error deleting session log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Pagination Configs ---
app.get('/api/pagination-configs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pagination_configs ORDER BY page_name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pagination configs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/pagination-configs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pagination_configs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagination config not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching pagination config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/pagination-configs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { page_name, items_per_page, max_items_per_page, default_sort_field, default_sort_order, enabled } = req.body;
    const result = await pool.query(
      'INSERT INTO pagination_configs (page_name, items_per_page, max_items_per_page, default_sort_field, default_sort_order, enabled) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [page_name, items_per_page || 25, max_items_per_page || 100, default_sort_field, default_sort_order || 'DESC', enabled !== false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating pagination config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/pagination-configs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { page_name, items_per_page, max_items_per_page, default_sort_field, default_sort_order, enabled } = req.body;
    const result = await pool.query(
      'UPDATE pagination_configs SET page_name = $1, items_per_page = $2, max_items_per_page = $3, default_sort_field = $4, default_sort_order = $5, enabled = $6, updated_at = NOW() WHERE id = $7 RETURNING *',
      [page_name, items_per_page, max_items_per_page, default_sort_field, default_sort_order, enabled, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagination config not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating pagination config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/pagination-configs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM pagination_configs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagination config not found' });
    res.json({ message: 'Pagination config deleted successfully' });
  } catch (error) {
    console.error('Error deleting pagination config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- PDF Exports ---
app.get('/api/pdf-exports', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT pe.*, u.email, u.name FROM pdf_exports pe LEFT JOIN users u ON pe.user_id = u.id ORDER BY pe.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching PDF exports:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/pdf-exports/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT pe.*, u.email, u.name FROM pdf_exports pe LEFT JOIN users u ON pe.user_id = u.id WHERE pe.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'PDF export not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching PDF export:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/pdf-exports', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, export_type, file_name, file_size, page_count, status } = req.body;
    const result = await pool.query(
      'INSERT INTO pdf_exports (user_id, export_type, file_name, file_size, page_count, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [user_id, export_type, file_name, file_size, page_count, status || 'completed']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating PDF export:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/pdf-exports/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, export_type, file_name, file_size, page_count, status } = req.body;
    const result = await pool.query(
      'UPDATE pdf_exports SET user_id = $1, export_type = $2, file_name = $3, file_size = $4, page_count = $5, status = $6 WHERE id = $7 RETURNING *',
      [user_id, export_type, file_name, file_size, page_count, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'PDF export not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating PDF export:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/pdf-exports/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM pdf_exports WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'PDF export not found' });
    res.json({ message: 'PDF export deleted successfully' });
  } catch (error) {
    console.error('Error deleting PDF export:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Confirmation Dialogs ---
app.get('/api/confirmation-dialogs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM confirmation_dialogs ORDER BY action_name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching confirmation dialogs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/confirmation-dialogs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM confirmation_dialogs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Confirmation dialog not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching confirmation dialog:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/confirmation-dialogs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { action_name, dialog_title, dialog_message, confirm_button_text, cancel_button_text, severity, requires_input, enabled } = req.body;
    const result = await pool.query(
      'INSERT INTO confirmation_dialogs (action_name, dialog_title, dialog_message, confirm_button_text, cancel_button_text, severity, requires_input, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [action_name, dialog_title, dialog_message, confirm_button_text || 'Confirm', cancel_button_text || 'Cancel', severity || 'warning', requires_input || false, enabled !== false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating confirmation dialog:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/confirmation-dialogs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { action_name, dialog_title, dialog_message, confirm_button_text, cancel_button_text, severity, requires_input, enabled } = req.body;
    const result = await pool.query(
      'UPDATE confirmation_dialogs SET action_name = $1, dialog_title = $2, dialog_message = $3, confirm_button_text = $4, cancel_button_text = $5, severity = $6, requires_input = $7, enabled = $8, updated_at = NOW() WHERE id = $9 RETURNING *',
      [action_name, dialog_title, dialog_message, confirm_button_text, cancel_button_text, severity, requires_input, enabled, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Confirmation dialog not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating confirmation dialog:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/confirmation-dialogs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM confirmation_dialogs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Confirmation dialog not found' });
    res.json({ message: 'Confirmation dialog deleted successfully' });
  } catch (error) {
    console.error('Error deleting confirmation dialog:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Error Logs ---
app.get('/api/error-logs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT el.*, u.email, u.name FROM error_logs el LEFT JOIN users u ON el.user_id = u.id ORDER BY el.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/error-logs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT el.*, u.email, u.name FROM error_logs el LEFT JOIN users u ON el.user_id = u.id WHERE el.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Error log not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching error log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/error-logs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { error_type, error_message, stack_trace, endpoint, method, user_id, ip_address, severity, resolved } = req.body;
    const result = await pool.query(
      'INSERT INTO error_logs (error_type, error_message, stack_trace, endpoint, method, user_id, ip_address, severity, resolved) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [error_type, error_message, stack_trace, endpoint, method, user_id, ip_address, severity || 'error', resolved || false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating error log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/error-logs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { error_type, error_message, stack_trace, endpoint, method, user_id, ip_address, severity, resolved } = req.body;
    const result = await pool.query(
      'UPDATE error_logs SET error_type = $1, error_message = $2, stack_trace = $3, endpoint = $4, method = $5, user_id = $6, ip_address = $7, severity = $8, resolved = $9 WHERE id = $10 RETURNING *',
      [error_type, error_message, stack_trace, endpoint, method, user_id, ip_address, severity, resolved, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Error log not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating error log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/error-logs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM error_logs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Error log not found' });
    res.json({ message: 'Error log deleted successfully' });
  } catch (error) {
    console.error('Error deleting error log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Loading Configs ---
app.get('/api/loading-configs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM loading_configs ORDER BY component_name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching loading configs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/loading-configs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM loading_configs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Loading config not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching loading config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/loading-configs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { component_name, loading_type, skeleton_count, timeout_ms, retry_count, show_progress, enabled } = req.body;
    const result = await pool.query(
      'INSERT INTO loading_configs (component_name, loading_type, skeleton_count, timeout_ms, retry_count, show_progress, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [component_name, loading_type || 'spinner', skeleton_count || 5, timeout_ms || 30000, retry_count || 3, show_progress || false, enabled !== false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating loading config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/loading-configs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { component_name, loading_type, skeleton_count, timeout_ms, retry_count, show_progress, enabled } = req.body;
    const result = await pool.query(
      'UPDATE loading_configs SET component_name = $1, loading_type = $2, skeleton_count = $3, timeout_ms = $4, retry_count = $5, show_progress = $6, enabled = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
      [component_name, loading_type, skeleton_count, timeout_ms, retry_count, show_progress, enabled, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Loading config not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating loading config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/loading-configs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM loading_configs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Loading config not found' });
    res.json({ message: 'Loading config deleted successfully' });
  } catch (error) {
    console.error('Error deleting loading config:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- RBAC Policies ---
app.get('/api/rbac-policies', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rbac_policies ORDER BY role_name ASC, resource ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching RBAC policies:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rbac-policies/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rbac_policies WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'RBAC policy not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching RBAC policy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/rbac-policies', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { role_name, resource, action, effect, conditions, priority, enabled } = req.body;
    const result = await pool.query(
      'INSERT INTO rbac_policies (role_name, resource, action, effect, conditions, priority, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [role_name, resource, action, effect || 'allow', conditions, priority || 0, enabled !== false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating RBAC policy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/rbac-policies/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { role_name, resource, action, effect, conditions, priority, enabled } = req.body;
    const result = await pool.query(
      'UPDATE rbac_policies SET role_name = $1, resource = $2, action = $3, effect = $4, conditions = $5, priority = $6, enabled = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
      [role_name, resource, action, effect, conditions, priority, enabled, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'RBAC policy not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating RBAC policy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/rbac-policies/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM rbac_policies WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'RBAC policy not found' });
    res.json({ message: 'RBAC policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting RBAC policy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Rate Limit Logs ---
app.get('/api/rate-limit-logs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT rl.*, u.email, u.name FROM rate_limit_logs rl LEFT JOIN users u ON rl.user_id = u.id ORDER BY rl.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rate limit logs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rate-limit-logs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT rl.*, u.email, u.name FROM rate_limit_logs rl LEFT JOIN users u ON rl.user_id = u.id WHERE rl.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rate limit log not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching rate limit log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/rate-limit-logs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { ip_address, endpoint, method, request_count, window_start, window_end, blocked, user_id } = req.body;
    const result = await pool.query(
      'INSERT INTO rate_limit_logs (ip_address, endpoint, method, request_count, window_start, window_end, blocked, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [ip_address, endpoint, method, request_count || 1, window_start, window_end, blocked || false, user_id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating rate limit log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/rate-limit-logs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { ip_address, endpoint, method, request_count, window_start, window_end, blocked, user_id } = req.body;
    const result = await pool.query(
      'UPDATE rate_limit_logs SET ip_address = $1, endpoint = $2, method = $3, request_count = $4, window_start = $5, window_end = $6, blocked = $7, user_id = $8 WHERE id = $9 RETURNING *',
      [ip_address, endpoint, method, request_count, window_start, window_end, blocked, user_id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rate limit log not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating rate limit log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/rate-limit-logs/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM rate_limit_logs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rate limit log not found' });
    res.json({ message: 'Rate limit log deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate limit log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Security Headers ---
app.get('/api/security-headers', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM security_headers ORDER BY header_name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching security headers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/security-headers/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM security_headers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Security header not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching security header:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/security-headers', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { header_name, header_value, description, category, enabled, applies_to } = req.body;
    const result = await pool.query(
      'INSERT INTO security_headers (header_name, header_value, description, category, enabled, applies_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [header_name, header_value, description, category, enabled !== false, applies_to || 'all']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating security header:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/security-headers/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { header_name, header_value, description, category, enabled, applies_to } = req.body;
    const result = await pool.query(
      'UPDATE security_headers SET header_name = $1, header_value = $2, description = $3, category = $4, enabled = $5, applies_to = $6, updated_at = NOW() WHERE id = $7 RETURNING *',
      [header_name, header_value, description, category, enabled, applies_to, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Security header not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating security header:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/security-headers/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM security_headers WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Security header not found' });
    res.json({ message: 'Security header deleted successfully' });
  } catch (error) {
    console.error('Error deleting security header:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Email Verifications (GET list already exists above, add remaining CRUD) ---
app.get('/api/email-verifications/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT ev.*, u.email, u.name FROM email_verifications ev LEFT JOIN users u ON ev.user_id = u.id WHERE ev.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Email verification not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching email verification:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/email-verifications', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, token, verified, expires_at } = req.body;
    const result = await pool.query(
      'INSERT INTO email_verifications (user_id, token, verified, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, token || crypto.randomBytes(32).toString('hex'), verified || false, expires_at]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating email verification:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/email-verifications/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { user_id, token, verified, expires_at } = req.body;
    const result = await pool.query(
      'UPDATE email_verifications SET user_id = $1, token = $2, verified = $3, expires_at = $4 WHERE id = $5 RETURNING *',
      [user_id, token, verified, expires_at, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Email verification not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating email verification:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/email-verifications/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM email_verifications WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Email verification not found' });
    res.json({ message: 'Email verification deleted successfully' });
  } catch (error) {
    console.error('Error deleting email verification:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Password Validations ---
app.get('/api/password-validations', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM password_validations ORDER BY priority DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching password validations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/password-validations/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM password_validations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Password validation not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching password validation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/password-validations', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { rule_name, rule_type, rule_value, error_message, severity, enabled, priority } = req.body;
    const result = await pool.query(
      'INSERT INTO password_validations (rule_name, rule_type, rule_value, error_message, severity, enabled, priority) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [rule_name, rule_type, rule_value, error_message, severity || 'error', enabled !== false, priority || 0]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating password validation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/password-validations/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { rule_name, rule_type, rule_value, error_message, severity, enabled, priority } = req.body;
    const result = await pool.query(
      'UPDATE password_validations SET rule_name = $1, rule_type = $2, rule_value = $3, error_message = $4, severity = $5, enabled = $6, priority = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
      [rule_name, rule_type, rule_value, error_message, severity, enabled, priority, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Password validation not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating password validation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/password-validations/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM password_validations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Password validation not found' });
    res.json({ message: 'Password validation deleted successfully' });
  } catch (error) {
    console.error('Error deleting password validation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
