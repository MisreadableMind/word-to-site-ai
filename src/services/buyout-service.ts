import { eq, and, desc, sql } from "drizzle-orm";
import { db, siteBuyouts } from "../db/client";

export const BuyoutStatus = {
  AwaitingPayment: "awaiting_payment",
  Paid: "paid",
  Completed: "completed",
  Failed: "failed",
};

const siteBuyoutColumns = {
  id: siteBuyouts.id,
  user_id: siteBuyouts.userId,
  site_id: siteBuyouts.siteId,
  domain: siteBuyouts.domain,
  fee_cents: siteBuyouts.feeCents,
  status: siteBuyouts.status,
  stripe_checkout_session_id: siteBuyouts.stripeCheckoutSessionId,
  stripe_payment_intent_id: siteBuyouts.stripePaymentIntentId,
  error_message: siteBuyouts.errorMessage,
  created_at: siteBuyouts.createdAt,
  completed_at: siteBuyouts.completedAt,
};

interface CreatePendingParams {
  userId: string;
  siteId: string;
  domain: string;
  feeCents: number;
  stripeCheckoutSessionId: string;
}

interface MarkFailedParams {
  sessionId: string;
  errorMessage: string;
}

export default class BuyoutService {
  initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async createPending({ userId, siteId, domain, feeCents, stripeCheckoutSessionId }: CreatePendingParams) {
    await this.initialize();
    const rows = await db
      .insert(siteBuyouts)
      .values({
        userId,
        siteId,
        domain,
        feeCents,
        status: BuyoutStatus.AwaitingPayment,
        stripeCheckoutSessionId,
      })
      .returning(siteBuyoutColumns);
    return rows[0];
  }

  async getByCheckoutSession(sessionId: string) {
    await this.initialize();
    const rows = await db
      .select(siteBuyoutColumns)
      .from(siteBuyouts)
      .where(eq(siteBuyouts.stripeCheckoutSessionId, sessionId));
    return rows[0] || null;
  }

  async getById(id: string, userId: string) {
    await this.initialize();
    const rows = await db
      .select(siteBuyoutColumns)
      .from(siteBuyouts)
      .where(and(eq(siteBuyouts.id, id), eq(siteBuyouts.userId, userId)));
    return rows[0] || null;
  }

  async getActiveForSite(siteId: string) {
    await this.initialize();
    const rows = await db
      .select(siteBuyoutColumns)
      .from(siteBuyouts)
      .where(and(eq(siteBuyouts.siteId, siteId), sql`${siteBuyouts.status} <> 'failed'`))
      .orderBy(desc(siteBuyouts.createdAt))
      .limit(1);
    return rows[0] || null;
  }

  async markPaid(sessionId: string, paymentIntentId: string | null) {
    await this.initialize();
    const rows = await db
      .update(siteBuyouts)
      .set({ status: BuyoutStatus.Paid, stripePaymentIntentId: paymentIntentId })
      .where(eq(siteBuyouts.stripeCheckoutSessionId, sessionId))
      .returning(siteBuyoutColumns);
    return rows[0] || null;
  }

  async markCompleted(sessionId: string) {
    await this.initialize();
    const rows = await db
      .update(siteBuyouts)
      .set({ status: BuyoutStatus.Completed, completedAt: sql`now()` })
      .where(eq(siteBuyouts.stripeCheckoutSessionId, sessionId))
      .returning(siteBuyoutColumns);
    return rows[0] || null;
  }

  async markFailed({ sessionId, errorMessage }: MarkFailedParams) {
    await this.initialize();
    const rows = await db
      .update(siteBuyouts)
      .set({ status: BuyoutStatus.Failed, errorMessage })
      .where(eq(siteBuyouts.stripeCheckoutSessionId, sessionId))
      .returning(siteBuyoutColumns);
    return rows[0] || null;
  }

  async listByUser(userId: string) {
    await this.initialize();
    return db
      .select(siteBuyoutColumns)
      .from(siteBuyouts)
      .where(eq(siteBuyouts.userId, userId))
      .orderBy(desc(siteBuyouts.createdAt));
  }
}
