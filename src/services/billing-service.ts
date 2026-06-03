import { db, users, subscriptions, billingEvents } from '../db/client';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { getStripe, planForPriceId, invalidatePriceCache } from '../billing/stripe-client';
import { getEntitlements, PLAN_TIERS } from '../billing/entitlements';
import { DomainStatus } from './domain-service';
import type DomainService from './domain-service';
import { classify } from '../lib/domain-classifier';

interface ProxyServiceLike {
  [key: string]: unknown;
}

interface NamecheapLike {
  checkDomain(domain: string): Promise<{ available: boolean; premium: boolean }>;
  registerDomain(domain: string, years: number): Promise<{ registered: boolean; orderId: string }>;
}

interface BillingServiceDeps {
  proxyService?: ProxyServiceLike | null;
  domainService?: DomainService | null;
  namecheap?: NamecheapLike | null;
}

interface UserContext {
  id: string;
  email: string;
  displayName?: string | null;
}

interface BillingUserRow {
  id: string;
  email: string;
  display_name: string | null;
  plan_tier: string;
}

interface UpsertSubscriptionInput {
  userId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  planTier: string;
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

interface StripeCustomerRef {
  id: string;
}

interface StripeSession {
  id: string;
  mode: string;
  customer: string | StripeCustomerRef | null;
  payment_intent: string | StripeCustomerRef | null;
  metadata?: { intent?: string; domain?: string; user_id?: string };
}

interface StripeSubscriptionItem {
  price?: { id: string | null };
  current_period_end?: number | null;
}

interface StripeSubscription {
  id: string;
  status: string;
  customer: string | StripeCustomerRef | null;
  cancel_at_period_end: boolean;
  current_period_end?: number | null;
  items?: { data?: StripeSubscriptionItem[] };
}

interface StripeInvoice {
  subscription: string | StripeCustomerRef | null;
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeSession & StripeSubscription & StripeInvoice };
}

export default class BillingService {

  initialized: boolean;
  proxyService: ProxyServiceLike | null;
  domainService: DomainService | null;
  namecheap: NamecheapLike | null;

  constructor({ proxyService = null, domainService = null, namecheap = null }: BillingServiceDeps = {}) {
    this.initialized = false;
    this.proxyService = proxyService;
    this.domainService = domainService;
    this.namecheap = namecheap;
  }

  async initialize() {
    this.initialized = true;
  }

  async getOrCreateStripeCustomer(user: UserContext) {
    await this.initialize();

    const existing = await db
      .select({ stripe_customer_id: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, user.id));

    const customerId = existing[0]?.stripe_customer_id;
    if (customerId) return customerId;

    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.displayName || undefined,
      metadata: { user_id: user.id },
    });

    await db
      .update(users)
      .set({ stripeCustomerId: customer.id, updatedAt: sql`NOW()` })
      .where(eq(users.id, user.id));

    return customer.id;
  }

  async getUserByCustomerId(customerId: string): Promise<BillingUserRow | null> {
    await this.initialize();
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        display_name: users.displayName,
        plan_tier: users.planTier,
      })
      .from(users)
      .where(eq(users.stripeCustomerId, customerId));
    return result[0] || null;
  }

  async getActiveSubscription(userId: string) {
    await this.initialize();
    const result = await db
      .select({
        id: subscriptions.id,
        user_id: subscriptions.userId,
        stripe_subscription_id: subscriptions.stripeSubscriptionId,
        stripe_price_id: subscriptions.stripePriceId,
        plan_tier: subscriptions.planTier,
        status: subscriptions.status,
        current_period_end: subscriptions.currentPeriodEnd,
        cancel_at_period_end: subscriptions.cancelAtPeriodEnd,
        created_at: subscriptions.createdAt,
        updated_at: subscriptions.updatedAt,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          inArray(subscriptions.status, ['active', 'trialing', 'past_due'])
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return result[0] || null;
  }

  async getSiteCount(userId: string) {
    await this.initialize();
    const { rows } = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count
      FROM user_sites
      WHERE user_id = ${userId} AND status != 'deleted'
    `);
    return rows[0].count;
  }

  async markEventProcessed(eventId: string, eventType: string, payload: StripeEvent) {
    await this.initialize();
    const result = await db
      .insert(billingEvents)
      .values({ stripeEventId: eventId, eventType, payload })
      .onConflictDoNothing({ target: billingEvents.stripeEventId })
      .returning({ id: billingEvents.id });
    return result.length > 0;
  }

  async upsertSubscription({ userId, stripeSubscriptionId, stripePriceId, planTier, status, currentPeriodEnd, cancelAtPeriodEnd }: UpsertSubscriptionInput) {
    await this.initialize();
    await db
      .insert(subscriptions)
      .values({
        userId,
        stripeSubscriptionId,
        stripePriceId,
        planTier,
        status,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
        cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd),
      })
      .onConflictDoUpdate({
        target: subscriptions.stripeSubscriptionId,
        set: {
          stripePriceId: sql`EXCLUDED.stripe_price_id`,
          planTier: sql`EXCLUDED.plan_tier`,
          status: sql`EXCLUDED.status`,
          currentPeriodEnd: sql`EXCLUDED.current_period_end`,
          cancelAtPeriodEnd: sql`EXCLUDED.cancel_at_period_end`,
          updatedAt: sql`NOW()`,
        },
      });
  }

  async setUserPlanTier(userId: string, planTier: string) {
    await this.initialize();
    await db
      .update(users)
      .set({ planTier, updatedAt: sql`NOW()` })
      .where(eq(users.id, userId));

    if (this.proxyService) {
      const tokens = getEntitlements(planTier).monthlyTokens;
      try {
        await db.execute(sql`
          UPDATE proxy_sites ps
          SET monthly_token_limit = ${tokens}
          FROM user_sites us
          WHERE us.user_id = ${userId}
            AND us.status != 'deleted'
            AND ps.domain = (
              CASE
                WHEN us.wp_url IS NOT NULL THEN regexp_replace(us.wp_url, '^https?://([^/]+).*$', '\\1')
                ELSE us.domain
              END
            )
        `);
      } catch (err) {
        console.warn('Failed to sync proxy_sites.monthly_token_limit:', (err as Error).message);
      }
    }
  }

  async handleEvent(event: StripeEvent) {
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

  async _handleCheckoutCompleted(session: StripeSession) {
    const intent = session.metadata?.intent;
    if (intent === 'domain_purchase') {
      return this._handleDomainPurchase(session);
    }
    if (session.mode !== 'subscription') {
      return { processed: true, reason: 'non-subscription checkout' };
    }
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const user = customerId ? await this.getUserByCustomerId(customerId) : null;
    if (!user) {
      console.warn('checkout.session.completed for unknown customer:', customerId);
      return { processed: true, reason: 'unknown customer' };
    }
    return { processed: true, reason: 'subscription event will follow', userId: user.id };
  }

  async _handleDomainPurchase(session: StripeSession) {
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

    const c = classify(domain);
    if (c.kind !== 'registerable') {
      const errorMessage = `Refusing to register non-registerable domain "${domain}" (${c.kind}${c.reason ? `:${c.reason}` : ''})`;
      console.error(errorMessage);
      try {
        if (paymentIntentId) {
          await getStripe().refunds.create({ payment_intent: paymentIntentId });
        }
      } catch (refundErr) {
        console.error('Refund creation failed:', (refundErr as Error).message);
      }
      await this.domainService.markFailed({ sessionId, errorMessage });
      return { processed: true, reason: 'invalid-domain-refunded', error: errorMessage };
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
        paymentIntentId: paymentIntentId as string,
        expiresAt: expiresAt.toISOString(),
      });

      return { processed: true, domain, orderId: registration.orderId };
    } catch (err) {
      console.error(`Domain registration failed for ${domain}; refunding payment:`, (err as Error).message);
      const errorMessage = (err as Error).message || 'Unknown error';
      try {
        if (paymentIntentId) {
          await getStripe().refunds.create({ payment_intent: paymentIntentId });
        }
      } catch (refundErr) {
        console.error('Refund creation failed:', (refundErr as Error).message);
      }
      await this.domainService.markFailed({ sessionId, errorMessage });
      return { processed: true, reason: 'failed-and-refunded', error: errorMessage };
    }
  }

  async _handleSubscriptionChange(subscription: StripeSubscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const user = customerId ? await this.getUserByCustomerId(customerId) : null;
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
      stripePriceId: priceId as string,
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

  async _handleSubscriptionDeleted(subscription: StripeSubscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const user = customerId ? await this.getUserByCustomerId(customerId) : null;
    if (!user) return { processed: true, reason: 'unknown customer' };

    await db
      .update(subscriptions)
      .set({ status: 'canceled', updatedAt: sql`NOW()` })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
    await this.setUserPlanTier(user.id, PLAN_TIERS.FREE);
    return { processed: true, userId: user.id, planTier: PLAN_TIERS.FREE };
  }

  async _handleInvoicePaymentFailed(invoice: StripeInvoice) {
    const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!subId) return { processed: true, reason: 'no subscription' };
    await db
      .update(subscriptions)
      .set({ status: 'past_due', updatedAt: sql`NOW()` })
      .where(eq(subscriptions.stripeSubscriptionId, subId));
    return { processed: true, status: 'past_due' };
  }

  async _handleInvoicePaid(invoice: StripeInvoice) {
    const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!subId) return { processed: true, reason: 'no subscription' };
    await db
      .update(subscriptions)
      .set({ status: 'active', updatedAt: sql`NOW()` })
      .where(
        and(
          eq(subscriptions.stripeSubscriptionId, subId),
          eq(subscriptions.status, 'past_due')
        )
      );
    return { processed: true };
  }
}
