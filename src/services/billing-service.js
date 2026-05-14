import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { getStripe, planForPriceId, invalidatePriceCache } from '../billing/stripe-client.js';
import { getEntitlements, PLAN_TIERS } from '../billing/entitlements.js';
import { DomainStatus } from './domain-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class BillingService {

  constructor({ proxyService = null, domainService = null, namecheap = null } = {}) {
    this.initialized = false;
    this.proxyService = proxyService;
    this.domainService = domainService;
    this.namecheap = namecheap;
  }

  async initialize() {
    if (this.initialized) return;
    try {
      const migrationPath = path.join(__dirname, '../db/migrations/005-billing.sql');
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(sql);
      this.initialized = true;
      console.log('Billing database initialized');
    } catch (error) {
      console.error('Failed to initialize billing database:', error.message);
    }
  }

  async getOrCreateStripeCustomer(user) {
    await this.initialize();

    const existing = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [user.id]
    );

    const customerId = existing.rows[0]?.stripe_customer_id;
    if (customerId) return customerId;

    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.displayName || undefined,
      metadata: { user_id: user.id },
    });

    await pool.query(
      'UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
      [customer.id, user.id]
    );

    return customer.id;
  }

  async getUserByCustomerId(customerId) {
    await this.initialize();
    const result = await pool.query(
      'SELECT id, email, display_name, plan_tier FROM users WHERE stripe_customer_id = $1',
      [customerId]
    );
    return result.rows[0] || null;
  }

  async getActiveSubscription(userId) {
    await this.initialize();
    const result = await pool.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async getSiteCount(userId) {
    await this.initialize();
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM user_sites
       WHERE user_id = $1 AND status != 'deleted'`,
      [userId]
    );
    return result.rows[0].count;
  }

  async markEventProcessed(eventId, eventType, payload) {
    await this.initialize();
    const result = await pool.query(
      `INSERT INTO billing_events (stripe_event_id, event_type, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING id`,
      [eventId, eventType, payload]
    );
    return result.rows.length > 0;
  }

  async upsertSubscription({ userId, stripeSubscriptionId, stripePriceId, planTier, status, currentPeriodEnd, cancelAtPeriodEnd }) {
    await this.initialize();
    await pool.query(
      `INSERT INTO subscriptions
         (user_id, stripe_subscription_id, stripe_price_id, plan_tier, status, current_period_end, cancel_at_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (stripe_subscription_id) DO UPDATE SET
         stripe_price_id = EXCLUDED.stripe_price_id,
         plan_tier = EXCLUDED.plan_tier,
         status = EXCLUDED.status,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         updated_at = NOW()`,
      [
        userId,
        stripeSubscriptionId,
        stripePriceId,
        planTier,
        status,
        currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        Boolean(cancelAtPeriodEnd),
      ]
    );
  }

  async setUserPlanTier(userId, planTier) {
    await this.initialize();
    await pool.query(
      'UPDATE users SET plan_tier = $1, updated_at = NOW() WHERE id = $2',
      [planTier, userId]
    );

    if (this.proxyService) {
      const tokens = getEntitlements(planTier).monthlyTokens;
      try {
        await pool.query(
          `UPDATE proxy_sites ps
           SET monthly_token_limit = $1
           FROM user_sites us
           WHERE us.user_id = $2
             AND us.status != 'deleted'
             AND ps.domain = (
               CASE
                 WHEN us.wp_url IS NOT NULL THEN regexp_replace(us.wp_url, '^https?://([^/]+).*$', '\\1')
                 ELSE us.domain
               END
             )`,
          [tokens, userId]
        );
      } catch (err) {
        console.warn('Failed to sync proxy_sites.monthly_token_limit:', err.message);
      }
    }
  }

  async handleEvent(event) {
    await this.initialize();

    const isNew = await this.markEventProcessed(event.id, event.type, event);
    if (!isNew) {
      return { processed: false, reason: 'duplicate' };
    }

    switch (event.type) {
      case 'checkout.session.completed':
        return this._handleCheckoutCompleted(event.data.object);
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return this._handleSubscriptionChange(event.data.object);
      case 'customer.subscription.deleted':
        return this._handleSubscriptionDeleted(event.data.object);
      case 'invoice.payment_failed':
        return this._handleInvoicePaymentFailed(event.data.object);
      case 'invoice.paid':
        return this._handleInvoicePaid(event.data.object);
      case 'price.created':
      case 'price.updated':
      case 'price.deleted':
      case 'product.updated':
        invalidatePriceCache();
        return { processed: true, reason: 'price cache invalidated', type: event.type };
      default:
        return { processed: true, reason: 'noop', type: event.type };
    }
  }

  async _handleCheckoutCompleted(session) {
    const intent = session.metadata?.intent;
    if (intent === 'domain_purchase') {
      return this._handleDomainPurchase(session);
    }
    if (session.mode !== 'subscription') {
      return { processed: true, reason: 'non-subscription checkout' };
    }
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const user = await this.getUserByCustomerId(customerId);
    if (!user) {
      console.warn('checkout.session.completed for unknown customer:', customerId);
      return { processed: true, reason: 'unknown customer' };
    }
    return { processed: true, reason: 'subscription event will follow', userId: user.id };
  }

  async _handleDomainPurchase(session) {
    if (!this.domainService || !this.namecheap) {
      console.error('Domain purchase webhook received but domainService/namecheap not wired');
      return { processed: true, reason: 'misconfigured' };
    }

    const sessionId = session.id;
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    const domain = session.metadata?.domain;
    const userId = session.metadata?.user_id;

    if (!domain || !userId) {
      console.error('Domain purchase missing metadata:', { sessionId, domain, userId });
      return { processed: true, reason: 'missing metadata' };
    }

    const row = await this.domainService.getByCheckoutSession(sessionId);
    if (!row) {
      console.warn('Domain purchase webhook for unknown session:', sessionId);
      return { processed: true, reason: 'unknown session' };
    }
    if (row.status === DomainStatus.Registered) {
      return { processed: true, reason: 'already registered' };
    }

    await this.domainService.markRegistering(sessionId);

    try {
      const availability = await this.namecheap.checkDomain(domain);
      if (!availability.available) {
        throw new Error(`Domain ${domain} is no longer available`);
      }
      if (availability.premium) {
        throw new Error(`Domain ${domain} is now flagged premium and cannot be auto-registered`);
      }

      const registration = await this.namecheap.registerDomain(domain, 1);
      if (!registration.registered) {
        throw new Error(`Namecheap reported registration unsuccessful for ${domain}`);
      }

      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await this.domainService.markRegistered({
        sessionId,
        namecheapOrderId: registration.orderId,
        paymentIntentId,
        expiresAt: expiresAt.toISOString(),
      });

      return { processed: true, domain, orderId: registration.orderId };
    } catch (err) {
      console.error(`Domain registration failed for ${domain}; refunding payment:`, err.message);
      const errorMessage = err.message || 'Unknown error';
      try {
        if (paymentIntentId) {
          await getStripe().refunds.create({ payment_intent: paymentIntentId });
        }
      } catch (refundErr) {
        console.error('Refund creation failed:', refundErr.message);
      }
      await this.domainService.markFailed({ sessionId, errorMessage });
      return { processed: true, reason: 'failed-and-refunded', error: errorMessage };
    }
  }

  async _handleSubscriptionChange(subscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const user = await this.getUserByCustomerId(customerId);
    if (!user) {
      console.warn('Subscription change for unknown customer:', customerId);
      return { processed: true, reason: 'unknown customer' };
    }

    const item = subscription.items?.data?.[0];
    const priceId = item?.price?.id || null;
    const planTier = await planForPriceId(priceId);

    if (!planTier) {
      console.warn('Subscription with unrecognized price id:', priceId);
      return { processed: true, reason: 'unknown price' };
    }

    const periodEnd = item?.current_period_end || subscription.current_period_end || null;

    await this.upsertSubscription({
      userId: user.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      planTier,
      status: subscription.status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    const effectivePlan = ['active', 'trialing', 'past_due'].includes(subscription.status)
      ? planTier
      : PLAN_TIERS.FREE;
    await this.setUserPlanTier(user.id, effectivePlan);

    return { processed: true, userId: user.id, planTier: effectivePlan };
  }

  async _handleSubscriptionDeleted(subscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const user = await this.getUserByCustomerId(customerId);
    if (!user) return { processed: true, reason: 'unknown customer' };

    await pool.query(
      `UPDATE subscriptions
       SET status = 'canceled', updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );
    await this.setUserPlanTier(user.id, PLAN_TIERS.FREE);
    return { processed: true, userId: user.id, planTier: PLAN_TIERS.FREE };
  }

  async _handleInvoicePaymentFailed(invoice) {
    const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!subId) return { processed: true, reason: 'no subscription' };
    await pool.query(
      `UPDATE subscriptions
       SET status = 'past_due', updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [subId]
    );
    return { processed: true, status: 'past_due' };
  }

  async _handleInvoicePaid(invoice) {
    const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!subId) return { processed: true, reason: 'no subscription' };
    await pool.query(
      `UPDATE subscriptions
       SET status = 'active', updated_at = NOW()
       WHERE stripe_subscription_id = $1 AND status = 'past_due'`,
      [subId]
    );
    return { processed: true };
  }
}
