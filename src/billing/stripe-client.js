import Stripe from 'stripe';
import { config } from '../config.js';
import { PAID_LOOKUP_KEYS, planForLookupKey, lookupKeyForPlan } from './entitlements.js';

let stripeInstance = null;
let priceCache = null;
let priceCachePromise = null;

export function getStripe() {
  if (!config.stripe.secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-09-30.clover',
      typescript: false,
    });
  }
  return stripeInstance;
}

export function isStripeReady() {
  return Boolean(config.stripe.secretKey);
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!config.stripe.webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}

async function loadPriceCache() {
  if (priceCache) return priceCache;
  if (priceCachePromise) return priceCachePromise;

  priceCachePromise = (async () => {
    const list = await getStripe().prices.list({
      lookup_keys: PAID_LOOKUP_KEYS,
      active: true,
      limit: PAID_LOOKUP_KEYS.length,
    });
    const byLookup = new Map();
    for (const price of list.data) {
      if (price.lookup_key) byLookup.set(price.lookup_key, price.id);
    }
    priceCache = byLookup;
    priceCachePromise = null;
    return priceCache;
  })().catch((err) => {
    priceCachePromise = null;
    throw err;
  });

  return priceCachePromise;
}

export async function priceIdForPlan(planTier) {
  const lookupKey = lookupKeyForPlan(planTier);
  if (!lookupKey) return null;
  const cache = await loadPriceCache();
  return cache.get(lookupKey) || null;
}

export async function planForPriceId(priceId) {
  if (!priceId) return null;
  const cache = await loadPriceCache();
  for (const [lookupKey, id] of cache.entries()) {
    if (id === priceId) return planForLookupKey(lookupKey);
  }
  try {
    const price = await getStripe().prices.retrieve(priceId);
    if (price?.lookup_key) {
      cache.set(price.lookup_key, price.id);
      return planForLookupKey(price.lookup_key);
    }
  } catch {
    return null;
  }
  return null;
}

export function invalidatePriceCache() {
  priceCache = null;
  priceCachePromise = null;
}

export async function listResolvedPrices() {
  const cache = await loadPriceCache();
  const out = {};
  for (const [lookupKey, id] of cache.entries()) {
    const tier = planForLookupKey(lookupKey);
    if (tier) out[tier] = id;
  }
  return out;
}
