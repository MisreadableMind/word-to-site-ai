import { PLAN_ENTITLEMENTS } from './entitlements';

const SCRIPT_VERSION = 'v1';

export function buildTargets(planEntitlements = PLAN_ENTITLEMENTS, { buyoutFeeCents = null } = {}) {
  const planTargets = Object.entries(planEntitlements)
    .filter(([, ent]) => ent.lookupKey)
    .map(([tier, ent]) => ({
      tier,
      lookupKey: ent.lookupKey,
      productName: `WordToSite — ${ent.label}`,
      priceCents: Math.round(ent.monthlyPriceUsd * 100),
      currency: 'usd',
      interval: 'month',
    }));

  if (buyoutFeeCents == null) return planTargets;

  return [
    ...planTargets,
    {
      tier: 'buyout',
      lookupKey: 'wts_buyout',
      productName: 'WordToSite — Site buyout (lifetime license)',
      priceCents: buyoutFeeCents,
      currency: 'usd',
      interval: null,
    },
  ];
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

    const existingInterval = existing.recurring?.interval ?? null;
    if (existing.currency !== target.currency || existingInterval !== target.interval) {
      driftWarnings.push({
        existing,
        target,
        reason: `Stripe has ${existing.currency}/${existingInterval || 'one-time'}, entitlements.js expects ${target.currency}/${target.interval || 'one-time'}`,
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
          recurring: target.interval ? { interval: target.interval } : undefined,
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

export async function migrateStarterSubscriptions(
  stripe,
  { dryRun = false, prorationBehavior = 'none', log = () => {} } = {},
) {
  const starterList = await stripe.prices.list({ lookup_keys: ['wts_starter'], limit: 1 });
  const starterPrice = starterList.data[0];
  if (!starterPrice) {
    log('no wts_starter price found — nothing to migrate');
    return { migrated: 0 };
  }

  const proList = await stripe.prices.list({ lookup_keys: ['wts_pro'], active: true, limit: 1 });
  const proPrice = proList.data[0];
  if (!proPrice && !dryRun) {
    throw new Error('wts_pro price not found — create plan prices before migrating subscribers');
  }

  let migrated = 0;
  for await (const sub of stripe.subscriptions.list({ price: starterPrice.id, status: 'all', limit: 100 })) {
    if (!['active', 'trialing', 'past_due'].includes(sub.status)) continue;
    const item = sub.items.data.find((i) => i.price.id === starterPrice.id);
    if (!item) continue;

    if (dryRun || !proPrice) {
      log(`would migrate ${sub.id} → wts_pro`);
      migrated += 1;
      continue;
    }

    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: proPrice.id }],
      proration_behavior: prorationBehavior,
    });
    log(`migrated ${sub.id} → wts_pro`);
    migrated += 1;
  }

  return { migrated };
}
