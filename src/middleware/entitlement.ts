import { and, eq, ne, desc } from 'drizzle-orm';
import { db, userSites } from '../db/client';
import { getEntitlements, allowsCustomDomain, allowsCustomDomainRegistration } from '../billing/entitlements';

interface Entitlements {
  label: string;
  maxSites: number;
  voicePerDay: number;
  customDomain: boolean | string;
}

interface AuthUser {
  id: string;
  planTier: string;
}

interface EntitlementRequest {
  user?: AuthUser;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  entitlements?: Entitlements;
}

interface EntitlementResponse {
  status(code: number): EntitlementResponse;
  json(body: unknown): EntitlementResponse;
}

type Next = () => void;

interface BillingService {
  getSiteCount(userId: string): Promise<number>;
}

interface PaymentRequiredBody {
  message: string;
  currentPlan: string;
  currentPlanLabel?: string;
  currentPlanLimit?: number;
  blockingSiteName?: string | null;
  requiredFor: string;
}

function paymentRequired(res: EntitlementResponse, body: PaymentRequiredBody): EntitlementResponse {
  return res.status(402).json({
    error: {
      message: body.message,
      type: 'payment_required',
      upgradeRequired: true,
      currentPlan: body.currentPlan,
      currentPlanLabel: body.currentPlanLabel,
      currentPlanLimit: body.currentPlanLimit,
      blockingSiteName: body.blockingSiteName,
      requiredFor: body.requiredFor,
      upgradeUrl: '/pricing',
    },
  });
}

async function getMostRecentSiteName(userId: string): Promise<string | null> {
  const rows = await db
    .select({
      site_name: userSites.siteName,
      domain: userSites.domain,
      wp_url: userSites.wpUrl,
    })
    .from(userSites)
    .where(and(eq(userSites.userId, userId), ne(userSites.status, 'deleted')))
    .orderBy(desc(userSites.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.site_name) return row.site_name;
  if (row.domain) return row.domain;
  if (row.wp_url) return row.wp_url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return null;
}

export function requireSiteCreate(billingService: BillingService) {
  return async (req: EntitlementRequest, res: EntitlementResponse, next: Next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required', type: 'authentication_error' } });
    }
    const planTier = req.user.planTier || 'free';
    const ent = getEntitlements(planTier) as Entitlements;
    const used = await billingService.getSiteCount(req.user.id);
    if (used >= ent.maxSites) {
      const blockingSiteName = await getMostRecentSiteName(req.user.id);
      return paymentRequired(res, {
        message: `Site limit reached for ${ent.label} plan (${ent.maxSites}). Upgrade to create more sites.`,
        currentPlan: planTier,
        currentPlanLabel: ent.label,
        currentPlanLimit: ent.maxSites,
        blockingSiteName,
        requiredFor: 'siteCreate',
      });
    }
    req.entitlements = ent;
    next();
  };
}

export function requireCustomDomain() {
  return async (req: EntitlementRequest, res: EntitlementResponse, next: Next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required', type: 'authentication_error' } });
    }
    const planTier = req.user.planTier || 'free';

    const source = (req.body && Object.keys(req.body).length > 0) ? req.body : (req.query || {});
    const wantsAnyDomain = Boolean(source.domain);

    if (wantsAnyDomain && !allowsCustomDomain(planTier)) {
      return paymentRequired(res, {
        message: 'Custom domains require a paid plan.',
        currentPlan: planTier,
        requiredFor: 'customDomain',
      });
    }

    req.entitlements = getEntitlements(planTier) as Entitlements;
    next();
  };
}

export function requireDomainPurchase() {
  return async (req: EntitlementRequest, res: EntitlementResponse, next: Next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required', type: 'authentication_error' } });
    }
    const planTier = req.user.planTier || 'free';
    if (!allowsCustomDomainRegistration(planTier)) {
      return paymentRequired(res, {
        message: 'Domain registration requires the Pro or Business plan.',
        currentPlan: planTier,
        requiredFor: 'domainRegistration',
      });
    }
    req.entitlements = getEntitlements(planTier) as Entitlements;
    next();
  };
}

export function getVoiceLimit(planTier: string): number {
  return (getEntitlements(planTier) as Entitlements).voicePerDay;
}
