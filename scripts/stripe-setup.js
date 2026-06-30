#!/usr/bin/env node
import { config } from '../src/config';
import { getStripe } from '../src/billing/stripe-client';
import { buildTargets, diffTargets, applyPlan, migrateStarterSubscriptions } from '../src/billing/stripe-setup';

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_DRIFT = 2;

const HELP = `Stripe setup — creates Products + Prices for each paid plan tier and the
one-time buyout price, then migrates any legacy wts_starter subscribers to wts_pro.

Usage:
  npm run stripe:setup                 apply changes against the configured Stripe account
  npm run stripe:setup -- --dry-run    preview the diff + would-migrate subs, make no API writes
  npm run stripe:setup -- --yes-live   required when STRIPE_SECRET_KEY starts with sk_live_

Behavior:
  • Idempotent — already-correct Prices and already-migrated subscribers are left alone.
  • If a Price's amount drifts from entitlements.js, exits 2 without applying anything.
  • If Price creation fails, the orphan Product is archived in the same operation.
  • Active/trialing/past_due subscriptions on wts_starter are moved to wts_pro
    (proration_behavior: none — they pay the new price from the next renewal).

Exit codes:
  0  success (created, or nothing to do)
  1  validation/auth failure, refused live without --yes-live, or apply error
  2  drift detected — manual reconciliation required
`;

function parseArgs(argv) {
  const allowed = new Set(['--dry-run', '--yes-live', '--help', '-h']);
  const flags = new Set();
  for (const arg of argv.slice(2)) {
    if (!allowed.has(arg)) {
      console.error(`Unknown argument: ${arg}\n`);
      console.error(HELP);
      process.exit(EXIT_ERROR);
    }
    flags.add(arg);
  }
  return {
    dryRun: flags.has('--dry-run'),
    yesLive: flags.has('--yes-live'),
    help: flags.has('--help') || flags.has('-h'),
  };
}

const fmtUsd = (cents) => `$${(cents / 100).toFixed(2)}`;
const pad = (s, n) => String(s).padEnd(n);

function printPlanLine(symbol, target, suffix = '') {
  const rate = target.interval ? `${fmtUsd(target.priceCents)}/${target.interval}` : `${fmtUsd(target.priceCents)} one-time`;
  console.log(`${symbol} ${pad(target.lookupKey, 14)} ${pad(rate, 12)}${suffix ? '  ' + suffix : ''}`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(HELP);
    process.exit(EXIT_OK);
  }

  if (!config.stripe.secretKey) {
    console.error('STRIPE_SECRET_KEY is not set; check .env');
    process.exit(EXIT_ERROR);
  }

  const isLive = config.stripe.secretKey.startsWith('sk_live_');
  if (isLive && !args.yesLive) {
    console.error('Refusing to run against live Stripe (sk_live_) without --yes-live.');
    console.error('Re-run with:  npm run stripe:setup -- --yes-live');
    process.exit(EXIT_ERROR);
  }

  const stripe = getStripe();
  const targets = buildTargets(undefined, { buyoutFeeCents: config.buyout.licenseFeeCents });
  const lookupKeys = targets.map((t) => t.lookupKey);

  const mode = isLive ? 'LIVE MODE' : 'test mode';
  const action = args.dryRun ? ' [dry run]' : '';
  console.log(`\nStripe setup — ${mode}${action}`);
  console.log(`Targets: ${lookupKeys.join(', ')}\n`);

  let existing;
  try {
    const list = await stripe.prices.list({
      lookup_keys: lookupKeys,
      active: true,
      limit: lookupKeys.length,
    });
    existing = list.data;
  } catch (err) {
    console.error(`Failed to read existing Stripe prices: ${err.message}`);
    process.exit(EXIT_ERROR);
  }

  const plan = diffTargets(existing, targets);

  for (const { target } of plan.unchanged) {
    printPlanLine('✓', target, 'unchanged');
  }
  for (const target of plan.create) {
    printPlanLine(args.dryRun ? '·' : '+', target, args.dryRun ? 'would create' : 'create');
  }
  for (const { target, reason } of plan.driftWarnings) {
    printPlanLine('⚠', target, `drift — ${reason}`);
  }

  if (plan.driftWarnings.length > 0) {
    console.log(`
Drift detected. Stripe Prices are immutable on amount/currency/interval.
Pick one path:
  • Update entitlements.js to match Stripe (zero customer impact), or
  • In the Stripe dashboard, archive the existing Price, then re-run this
    script (creates a new Price — existing subscribers stay on the old one).

No changes were applied.`);
    process.exit(EXIT_DRIFT);
  }

  let createdCount = 0;
  if (plan.create.length === 0) {
    console.log('\nPrices: nothing to create — all present and matching.');
  } else if (args.dryRun) {
    console.log(`\nPrices: ${plan.create.length} would be created.`);
  } else {
    try {
      const result = await applyPlan(stripe, plan, { log: (m) => console.log(`  ${m}`) });
      for (const { target, priceId } of result.applied) {
        console.log(`  ${target.lookupKey} → ${priceId}`);
      }
      createdCount = result.applied.length;
    } catch (err) {
      console.error(`\nApply failed: ${err.message}`);
      if (err.orphanProductId) {
        console.error(`(Orphan product ${err.orphanProductId} was archived.)`);
      }
      process.exit(EXIT_ERROR);
    }
  }

  console.log('\nLegacy subscribers (wts_starter → wts_pro):');
  let migratedCount = 0;
  try {
    const result = await migrateStarterSubscriptions(stripe, {
      dryRun: args.dryRun,
      prorationBehavior: 'none',
      log: (m) => console.log(`  ${m}`),
    });
    migratedCount = result.migrated;
    if (result.migrated === 0) console.log('  none to migrate');
  } catch (err) {
    console.error(`  migration failed: ${err.message}`);
    process.exit(EXIT_ERROR);
  }

  const createdLabel = args.dryRun ? `${plan.create.length} would be created` : `created ${createdCount}`;
  const migratedLabel = args.dryRun ? `${migratedCount} would migrate` : `migrated ${migratedCount}`;
  console.log(`\nDone — ${createdLabel}, ${migratedLabel}, ${plan.unchanged.length} unchanged.`);
  process.exit(EXIT_OK);
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(EXIT_ERROR);
});
