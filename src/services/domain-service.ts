import { eq, and, desc, sql } from "drizzle-orm";
import { db, domainRegistrations } from "../db/client";

export const DomainStatus = {
  AwaitingPayment: 'awaiting_payment',
  Registering: 'registering',
  Registered: 'registered',
  Failed: 'failed',
};

const domainRegistrationColumns = {
  id: domainRegistrations.id,
  user_id: domainRegistrations.userId,
  site_id: domainRegistrations.siteId,
  domain: domainRegistrations.domain,
  namecheap_order_id: domainRegistrations.namecheapOrderId,
  registered_at: domainRegistrations.registeredAt,
  expires_at: domainRegistrations.expiresAt,
  used_plan_credit: domainRegistrations.usedPlanCredit,
  stripe_payment_intent_id: domainRegistrations.stripePaymentIntentId,
  created_at: domainRegistrations.createdAt,
  status: domainRegistrations.status,
  stripe_checkout_session_id: domainRegistrations.stripeCheckoutSessionId,
  error_message: domainRegistrations.errorMessage,
  total_charged_cents: domainRegistrations.totalChargedCents,
  wholesale_cents: domainRegistrations.wholesaleCents,
};

interface CreatePendingParams {
  userId: string;
  domain: string;
  totalChargedCents: number;
  wholesaleCents: number;
  stripeCheckoutSessionId: string;
}

interface MarkRegisteredParams {
  sessionId: string;
  namecheapOrderId: string;
  paymentIntentId: string;
  expiresAt: string;
}

interface MarkFailedParams {
  sessionId: string;
  errorMessage: string;
}

export default class DomainService {
  initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async createPending({ userId, domain, totalChargedCents, wholesaleCents, stripeCheckoutSessionId }: CreatePendingParams) {
    await this.initialize();
    const rows = await db
      .insert(domainRegistrations)
      .values({
        userId,
        domain,
        status: DomainStatus.AwaitingPayment,
        usedPlanCredit: false,
        stripeCheckoutSessionId,
        totalChargedCents,
        wholesaleCents,
        registeredAt: sql`NOW()`,
        expiresAt: null,
      })
      .returning(domainRegistrationColumns);
    return rows[0];
  }

  async getByCheckoutSession(sessionId: string) {
    await this.initialize();
    const rows = await db
      .select(domainRegistrationColumns)
      .from(domainRegistrations)
      .where(eq(domainRegistrations.stripeCheckoutSessionId, sessionId));
    return rows[0] || null;
  }

  async getById(id: string, userId: string) {
    await this.initialize();
    const rows = await db
      .select(domainRegistrationColumns)
      .from(domainRegistrations)
      .where(and(eq(domainRegistrations.id, id), eq(domainRegistrations.userId, userId)));
    return rows[0] || null;
  }

  async listByUser(userId: string) {
    await this.initialize();
    const rows = await db
      .select(domainRegistrationColumns)
      .from(domainRegistrations)
      .where(eq(domainRegistrations.userId, userId))
      .orderBy(desc(domainRegistrations.createdAt));
    return rows;
  }

  async markRegistering(sessionId: string) {
    await this.initialize();
    const rows = await db
      .update(domainRegistrations)
      .set({ status: DomainStatus.Registering })
      .where(eq(domainRegistrations.stripeCheckoutSessionId, sessionId))
      .returning(domainRegistrationColumns);
    return rows[0] || null;
  }

  async markRegistered({ sessionId, namecheapOrderId, paymentIntentId, expiresAt }: MarkRegisteredParams) {
    await this.initialize();
    const rows = await db
      .update(domainRegistrations)
      .set({
        status: DomainStatus.Registered,
        namecheapOrderId,
        stripePaymentIntentId: paymentIntentId,
        expiresAt,
        registeredAt: sql`NOW()`,
      })
      .where(eq(domainRegistrations.stripeCheckoutSessionId, sessionId))
      .returning(domainRegistrationColumns);
    return rows[0] || null;
  }

  async markFailed({ sessionId, errorMessage }: MarkFailedParams) {
    await this.initialize();
    const rows = await db
      .update(domainRegistrations)
      .set({ status: DomainStatus.Failed, errorMessage })
      .where(eq(domainRegistrations.stripeCheckoutSessionId, sessionId))
      .returning(domainRegistrationColumns);
    return rows[0] || null;
  }

  async attachSite(id: string, userId: string, siteId: string) {
    await this.initialize();
    const rows = await db
      .update(domainRegistrations)
      .set({ siteId })
      .where(and(eq(domainRegistrations.id, id), eq(domainRegistrations.userId, userId)))
      .returning(domainRegistrationColumns);
    return rows[0] || null;
  }
}
