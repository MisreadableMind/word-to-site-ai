import { PLAN_ENTITLEMENTS } from './entitlements.js';

const SCRIPT_VERSION = 'v1';

export function buildTargets(planEntitlements = PLAN_ENTITLEMENTS) {
  return Object.entries(planEntitlements)
    .filter(([, ent]) => ent.lookupKey)
    .map(([tier, ent]) => ({
      tier,
      lookupKey: ent.lookupKey,
      productName: `WordToSite — ${ent.label}`,
      priceCents: Math.round(ent.monthlyPriceUsd * 100),
      currency: 'usd',
      interval: 'month',
    }));
}

export function diffTargets(currentPrices, targets) {
  const byKey = new Map(currentPrices.map((p) => [p.lookup_key, p]));
  const create = [];
  const driftWarnings = [];
  const unchanged = [];

  for (const target of targets) {
    const existing = byKey.get(target.lookupKey);
    if (!existing) {
      create.push(target);
      continue;
    }

    if (existing.unit_amount !== target.priceCents) {
      driftWarnings.push({
        existing,
        target,
        reason: `Stripe has $${(existing.unit_amount / 100).toFixed(2)}/mo, entitlements.js has $${(target.priceCents / 100).toFixed(2)}/mo`,
      });
      continue;
    }

    if (existing.currency !== target.currency || existing.recurring?.interval !== target.interval) {
      driftWarnings.push({
        existing,
        target,
        reason: `Stripe has ${existing.currency}/${existing.recurring?.interval}, entitlements.js expects ${target.currency}/${target.interval}`,
      });
      continue;
    }

    unchanged.push({ existing, target });
  }

  return { create, driftWarnings, unchanged };
}

export async function applyPlan(stripe, plan, { log = () => {} } = {}) {
  const applied = [];

  for (const target of plan.create) {
    const productKey = `wts-setup-${SCRIPT_VERSION}-product-${target.lookupKey}`;
    const priceKey = `wts-setup-${SCRIPT_VERSION}-price-${target.lookupKey}`;

    const product = await stripe.products.create(
      {
        name: target.productName,
        metadata: { plan_tier: target.tier, managed_by: 'wts-stripe-setup' },
      },
      { idempotencyKey: productKey },
    );

    let price;
    try {
      price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: target.priceCents,
          currency: target.currency,
          recurring: { interval: target.interval },
          lookup_key: target.lookupKey,
          metadata: { plan_tier: target.tier, managed_by: 'wts-stripe-setup' },
        },
        { idempotencyKey: priceKey },
      );
    } catch (err) {
      try {
        await stripe.products.update(product.id, { active: false });
        log(`archived orphan product ${product.id} after price creation failed`);
      } catch (archiveErr) {
        log(`failed to archive orphan product ${product.id}: ${archiveErr.message}`);
      }
      err.orphanProductId = product.id;
      throw err;
    }

    applied.push({ target, productId: product.id, priceId: price.id });
  }

  return { applied };
}
