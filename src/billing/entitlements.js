import { config } from '../config.js';

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
    maxSites: 10,
    customDomain: 'managed',
    includedDomains: 5,
    monthlyTokens: 5_000_000,
    voicePerDay: 500,
    watermark: false,
  },
};

export function getEntitlements(planTier) {
  return PLAN_ENTITLEMENTS[planTier] || PLAN_ENTITLEMENTS.free;
}

export function planForPriceId(priceId) {
  const prices = config.stripe.prices;
  if (priceId === prices.starter) return PLAN_TIERS.STARTER;
  if (priceId === prices.pro) return PLAN_TIERS.PRO;
  if (priceId === prices.business) return PLAN_TIERS.BUSINESS;
  return null;
}

export function priceIdForPlan(planTier) {
  const prices = config.stripe.prices;
  if (planTier === PLAN_TIERS.STARTER) return prices.starter;
  if (planTier === PLAN_TIERS.PRO) return prices.pro;
  if (planTier === PLAN_TIERS.BUSINESS) return prices.business;
  return null;
}

export function allowsCustomDomainRegistration(planTier) {
  const ent = getEntitlements(planTier);
  return ent.customDomain === 'managed';
}

export function allowsCustomDomain(planTier) {
  return getEntitlements(planTier).customDomain !== false;
}
