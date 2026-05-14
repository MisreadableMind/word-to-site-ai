export const PLAN_TIERS = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  BUSINESS: 'business',
};

export const PLAN_ENTITLEMENTS = {
  free: {
    label: 'Free',
    monthlyPriceUsd: 0,
    lookupKey: null,
    maxSites: 1,
    customDomain: false,
    includedDomains: 0,
    monthlyTokens: 50_000,
    voicePerDay: 5,
    watermark: true,
  },
  starter: {
    label: 'Starter',
    monthlyPriceUsd: 19,
    lookupKey: 'wts_starter',
    maxSites: 1,
    customDomain: 'byod',
    includedDomains: 0,
    monthlyTokens: 250_000,
    voicePerDay: 25,
    watermark: false,
  },
  pro: {
    label: 'Pro',
    monthlyPriceUsd: 49,
    lookupKey: 'wts_pro',
    maxSites: 3,
    customDomain: 'managed',
    includedDomains: 1,
    monthlyTokens: 1_000_000,
    voicePerDay: 100,
    watermark: false,
  },
  business: {
    label: 'Business',
    monthlyPriceUsd: 99,
    lookupKey: 'wts_business',
    maxSites: 10,
    customDomain: 'managed',
    includedDomains: 5,
    monthlyTokens: 5_000_000,
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
