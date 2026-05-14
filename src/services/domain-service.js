import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DomainStatus = {
  AwaitingPayment: 'awaiting_payment',
  Registering: 'registering',
  Registered: 'registered',
  Failed: 'failed',
};

export default class DomainService {

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    try {
      const migration005 = path.join(__dirname, '../db/migrations/005-billing.sql');
      const migration006 = path.join(__dirname, '../db/migrations/006-domain-status.sql');
      await pool.query(fs.readFileSync(migration005, 'utf-8'));
      await pool.query(fs.readFileSync(migration006, 'utf-8'));
      this.initialized = true;
      console.log('Domain registrations database initialized');
    } catch (error) {
      console.error('Failed to initialize domain registrations database:', error.message);
    }
  }

  async createPending({ userId, domain, totalChargedCents, wholesaleCents, stripeCheckoutSessionId }) {
    await this.initialize();
    const result = await pool.query(
      `INSERT INTO domain_registrations
         (user_id, domain, status, used_plan_credit,
          stripe_checkout_session_id, total_charged_cents, wholesale_cents,
          registered_at, expires_at)
       VALUES ($1, $2, $3, FALSE, $4, $5, $6, NOW(), NULL)
       RETURNING *`,
      [userId, domain, DomainStatus.AwaitingPayment, stripeCheckoutSessionId, totalChargedCents, wholesaleCents]
    );
    return result.rows[0];
  }

  async getByCheckoutSession(sessionId) {
    await this.initialize();
    const result = await pool.query(
      'SELECT * FROM domain_registrations WHERE stripe_checkout_session_id = $1',
      [sessionId]
    );
    return result.rows[0] || null;
  }

  async getById(id, userId) {
    await this.initialize();
    const result = await pool.query(
      'SELECT * FROM domain_registrations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0] || null;
  }

  async listByUser(userId) {
    await this.initialize();
    const result = await pool.query(
      `SELECT * FROM domain_registrations
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async markRegistering(sessionId) {
    await this.initialize();
    const result = await pool.query(
      `UPDATE domain_registrations
       SET status = $2
       WHERE stripe_checkout_session_id = $1
       RETURNING *`,
      [sessionId, DomainStatus.Registering]
    );
    return result.rows[0] || null;
  }

  async markRegistered({ sessionId, namecheapOrderId, paymentIntentId, expiresAt }) {
    await this.initialize();
    const result = await pool.query(
      `UPDATE domain_registrations
       SET status = $2,
           namecheap_order_id = $3,
           stripe_payment_intent_id = $4,
           expires_at = $5,
           registered_at = NOW()
       WHERE stripe_checkout_session_id = $1
       RETURNING *`,
      [sessionId, DomainStatus.Registered, namecheapOrderId, paymentIntentId, expiresAt]
    );
    return result.rows[0] || null;
  }

  async markFailed({ sessionId, errorMessage }) {
    await this.initialize();
    const result = await pool.query(
      `UPDATE domain_registrations
       SET status = $2, error_message = $3
       WHERE stripe_checkout_session_id = $1
       RETURNING *`,
      [sessionId, DomainStatus.Failed, errorMessage]
    );
    return result.rows[0] || null;
  }

  async attachSite(id, userId, siteId) {
    await this.initialize();
    const result = await pool.query(
      `UPDATE domain_registrations
       SET site_id = $3
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, siteId]
    );
    return result.rows[0] || null;
  }
}
