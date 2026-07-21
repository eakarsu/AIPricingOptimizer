'use strict';
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: true } : undefined });
module.exports = pool;
