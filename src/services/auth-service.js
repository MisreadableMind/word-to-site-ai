import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class AuthService {

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const migrationPath = path.join(__dirname, '../db/migrations/003-user-auth.sql');
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(sql);
      this.initialized = true;
      console.log('User auth database initialized');
    } catch (error) {
      console.error('Failed to initialize user auth database:', error.message);
    }
  }

  // ==========================================
  // REGISTRATION & LOGIN
  // ==========================================

  async register(email, password, displayName) {
    await this.initialize();

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_EXISTS' });
    }

    const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, plan_tier, status, created_at`,
      [normalizedEmail, passwordHash, displayName || null]
    );

    return result.rows[0];
  }

  async login(email, password) {
    await this.initialize();

    const normalizedEmail = email.toLowerCase().trim();

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [normalizedEmail]
    );

    const user = result.rows[0];
    if (!user) {
      throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });
    }

    if (user.status !== 'active') {
      throw Object.assign(new Error('Account is disabled'), { code: 'ACCOUNT_DISABLED' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });
    }

    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  async createSession(userId, meta = {}) {
    await this.initialize();

    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + config.auth.sessionMaxAge);

    await pool.query(
      `INSERT INTO user_sessions (user_id, token, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, token, meta.userAgent || null, meta.ipAddress || null, expiresAt]
    );

    return { token, expiresAt };
  }

  async validateSession(token) {
    await this.initialize();

    const result = await pool.query(
      `SELECT s.*, u.id AS user_id, u.email, u.display_name, u.plan_tier, u.status
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW() AND u.status = 'active'`,
      [token]
    );

    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      session: {
        id: row.id,
        token: row.token,
        expiresAt: row.expires_at,
      },
      user: {
        id: row.user_id,
        email: row.email,
        displayName: row.display_name,
        planTier: row.plan_tier,
        status: row.status,
      },
    };
  }

  async deleteSession(token) {
    await this.initialize();
    await pool.query('DELETE FROM user_sessions WHERE token = $1', [token]);
  }

  async deleteAllUserSessions(userId) {
    await this.initialize();
    await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
  }

  async cleanExpiredSessions() {
    await this.initialize();
    const result = await pool.query('DELETE FROM user_sessions WHERE expires_at <= NOW()');
    return result.rowCount;
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  async getUserById(userId) {
    await this.initialize();

    const result = await pool.query(
      'SELECT id, email, display_name, plan_tier, status, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0] || null;
  }

  async updatePassword(userId, currentPassword, newPassword) {
    await this.initialize();

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows[0]) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      throw Object.assign(new Error('Current password is incorrect'), { code: 'INVALID_PASSWORD' });
    }

    const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );
  }

  async updateProfile(userId, updates) {
    await this.initialize();

    const allowed = {};
    if (updates.displayName !== undefined) allowed.display_name = updates.displayName;

    const keys = Object.keys(allowed);
    if (keys.length === 0) return this.getUserById(userId);

    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    setClauses.push('updated_at = NOW()');
    const values = keys.map(k => allowed[k]);

    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1
       RETURNING id, email, display_name, plan_tier, status, created_at, updated_at`,
      [userId, ...values]
    );

    return result.rows[0] || null;
  }

  async deleteUser(userId, password) {
    await this.initialize();

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows[0]) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) {
      throw Object.assign(new Error('Password is incorrect'), { code: 'INVALID_PASSWORD' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
}
