#!/usr/bin/env node
import { config } from '../src/config.js';
import { getStripe } from '../src/billing/stripe-client.js';
import { buildTargets, diffTargets, applyPlan } from '../src/billing/stripe-setup.js';

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_DRIFT = 2;

const HELP = `Stripe setup — creates Products + Prices for each paid plan tier.

Usage:
  npm run stripe:setup                 apply changes against the configured Stripe account
  npm run stripe:setup -- --dry-run    preview the diff, make no API writes
  npm run stripe:setup -- --yes-live   required when STRIPE_SECRET_KEY starts with sk_live_

Behavior:
  • Idempotent — already-correct Prices are left alone.
  • If a Price's amount drifts from entitlements.js, exits 2 without applying anything.
  • If Price creation fails, the orphan Product is archived in the same operation.

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
  console.log(`${symbol} ${pad(target.lookupKey, 14)} ${pad(`${fmtUsd(target.priceCents)}/${target.interval}`, 12)}${suffix ? '  ' + suffix : ''}`);
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
  const targets = buildTargets();
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

  if (args.dryRun) {
    console.log(`\nDry run complete — ${plan.create.length} would be created, ${plan.unchanged.length} unchanged.`);
    process.exit(EXIT_OK);
  }

  if (plan.create.length === 0) {
    console.log('\nNothing to do — all targets already present and matching.');
    process.exit(EXIT_OK);
  }

  try {
    const result = await applyPlan(stripe, plan, { log: (m) => console.log(`  ${m}`) });
    for (const { target, priceId } of result.applied) {
      console.log(`  ${target.lookupKey} → ${priceId}`);
    }
    console.log(`\nDone — created ${result.applied.length}, unchanged ${plan.unchanged.length}.`);
    process.exit(EXIT_OK);
  } catch (err) {
    console.error(`\nApply failed: ${err.message}`);
    if (err.orphanProductId) {
      console.error(`(Orphan product ${err.orphanProductId} was archived.)`);
    }
    process.exit(EXIT_ERROR);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(EXIT_ERROR);
});
