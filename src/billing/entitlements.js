export const PLAN_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  BUSINESS: 'business',
};

export const DOMAIN_MARKUP_PERCENT = 0.20;

export const PLAN_ENTITLEMENTS = {
  free: {
    label: 'Free',
    tagline: 'Try the platform, free for 7 days',
    monthlyPriceUsd: 0,
    lookupKey: null,
    maxSites: 1,
    extraSiteDayUsd: null,
    siteTtlDays: 7,
    customDomain: false,
    monthlyTokens: 50_000_000,
    voicePerDay: 5,
    watermark: true,
  },
  pro: {
    label: 'Pro',
    tagline: 'For studios running client projects',
    monthlyPriceUsd: 49,
    lookupKey: 'wts_pro',
    maxSites: 5,
    extraSiteDayUsd: 0.40,
    siteTtlDays: null,
    customDomain: 'managed',
    monthlyTokens: 100_000_000,
    voicePerDay: 100,
    watermark: false,
  },
  business: {
    label: 'Business',
    tagline: 'For agencies and teams with lots of projects',
    monthlyPriceUsd: 99,
    lookupKey: 'wts_business',
    maxSites: 20,
    extraSiteDayUsd: 0.30,
    siteTtlDays: null,
    customDomain: 'managed',
    monthlyTokens: 100_000_000,
    voicePerDay: 500,
    watermark: false,
  },
};

export const PAID_LOOKUP_KEYS = Object.values(PLAN_ENTITLEMENTS)
  .map((p) => p.lookupKey)
  .filter(Boolean);

export function getEntitlements(planTier) {
  return PLAN_ENTITLEMENTS[planTier] || PLAN_ENTITLEMENTS.free;
}

export function lookupKeyForPlan(planTier) {
  return PLAN_ENTITLEMENTS[planTier]?.lookupKey || null;
}

export function planForLookupKey(lookupKey) {
  if (!lookupKey) return null;
  for (const [tier, ent] of Object.entries(PLAN_ENTITLEMENTS)) {
    if (ent.lookupKey === lookupKey) return tier;
  }
  return null;
}

export function allowsCustomDomainRegistration(planTier) {
  return getEntitlements(planTier).customDomain === 'managed';
}

export function allowsCustomDomain(planTier) {
  return getEntitlements(planTier).customDomain !== false;
}

export function getIncludedSites(planTier) {
  return getEntitlements(planTier).maxSites;
}

export function isMeteredPlan(planTier) {
  return getEntitlements(planTier).extraSiteDayUsd != null;
}

export function getOverageDayCents(planTier) {
  const rate = getEntitlements(planTier).extraSiteDayUsd;
  return rate == null ? 0 : Math.round(rate * 100);
}

export function getSiteTtlDays(planTier) {
  return getEntitlements(planTier).siteTtlDays;
}
