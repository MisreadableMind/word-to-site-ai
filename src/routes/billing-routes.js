import { Router } from 'express';
import express from 'express';
import { createUserAuth } from '../middleware/user-auth.js';
import { getStripe, verifyWebhookSignature } from '../billing/stripe-client.js';
import { PLAN_ENTITLEMENTS, PLAN_TIERS, priceIdForPlan, getEntitlements } from '../billing/entitlements.js';
import { config } from '../config.js';

export function createBillingWebhookRouter(billingService) {
  const router = Router();

  router.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return res.status(400).send('Missing stripe-signature header');
      }

      let event;
      try {
        event = verifyWebhookSignature(req.body, signature);
      } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      try {
        const result = await billingService.handleEvent(event);
        res.json({ received: true, ...result });
      } catch (err) {
        console.error('Stripe webhook handler error:', err);
        res.status(500).json({ error: { message: 'Webhook processing failed' } });
      }
    }
  );

  return router;
}

export default function createBillingRouter(billingService, authService) {
  const router = Router();
  const auth = createUserAuth(authService);

  router.get('/plans', (req, res) => {
    const plans = Object.entries(PLAN_ENTITLEMENTS).map(([tier, ent]) => ({
      tier,
      ...ent,
      priceId: priceIdForPlan(tier),
    }));
    res.json({ success: true, plans });
  });

  router.use(auth);

  router.get('/subscription', async (req, res) => {
    try {
      const sub = await billingService.getActiveSubscription(req.user.id);
      const planTier = req.user.planTier || PLAN_TIERS.FREE;
      const ent = getEntitlements(planTier);
      const siteCount = await billingService.getSiteCount(req.user.id);
      const domainCreditsUsed = await billingService.getDomainCreditsUsed(req.user.id);

      res.json({
        success: true,
        planTier,
        entitlements: ent,
        usage: {
          sitesUsed: siteCount,
          domainCreditsUsed,
          domainCreditsRemaining: Math.max(0, ent.includedDomains - domainCreditsUsed),
        },
        subscription: sub
          ? {
              id: sub.stripe_subscription_id,
              status: sub.status,
              currentPeriodEnd: sub.current_period_end,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              planTier: sub.plan_tier,
            }
          : null,
      });
    } catch (err) {
      console.error('Get subscription error:', err);
      res.status(500).json({ error: { message: 'Failed to load subscription', type: 'server_error' } });
    }
  });

  router.post('/checkout', async (req, res) => {
    try {
      const { planTier } = req.body || {};
      const priceId = priceIdForPlan(planTier);
      if (!priceId) {
        return res.status(400).json({
          error: { message: `Invalid plan: ${planTier}`, type: 'validation_error' },
        });
      }

      const customerId = await billingService.getOrCreateStripeCustomer(req.user);
      const stripe = getStripe();

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: config.stripe.successUrl,
        cancel_url: config.stripe.cancelUrl,
        allow_promotion_codes: true,
        client_reference_id: req.user.id,
        metadata: { user_id: req.user.id, plan_tier: planTier },
      });

      res.json({ success: true, url: session.url });
    } catch (err) {
      console.error('Checkout session error:', err);
      res.status(500).json({ error: { message: err.message || 'Checkout failed', type: 'server_error' } });
    }
  });

  router.post('/portal', async (req, res) => {
    try {
      const customerId = await billingService.getOrCreateStripeCustomer(req.user);
      const stripe = getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: config.stripe.portalReturnUrl,
      });
      res.json({ success: true, url: session.url });
    } catch (err) {
      console.error('Portal session error:', err);
      res.status(500).json({ error: { message: err.message || 'Portal failed', type: 'server_error' } });
    }
  });

  router.get('/invoices', async (req, res) => {
    try {
      const customerId = await billingService.getOrCreateStripeCustomer(req.user);
      const stripe = getStripe();
      const invoices = await stripe.invoices.list({ customer: customerId, limit: 20 });
      res.json({
        success: true,
        invoices: invoices.data.map((inv) => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amountPaid: inv.amount_paid,
          currency: inv.currency,
          created: inv.created,
          hostedInvoiceUrl: inv.hosted_invoice_url,
          invoicePdf: inv.invoice_pdf,
        })),
      });
    } catch (err) {
      console.error('List invoices error:', err);
      res.status(500).json({ error: { message: 'Failed to list invoices', type: 'server_error' } });
    }
  });

  return router;
}
