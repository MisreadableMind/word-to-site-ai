import { Router } from 'express';
import { createUserAuth } from '../middleware/user-auth.js';
import { requireCustomDomain, requireDomainPurchase } from '../middleware/entitlement.js';
import { DOMAIN_MARKUP_PERCENT } from '../billing/entitlements.js';
import { getStripe } from '../billing/stripe-client.js';

const origin = (req) => `${req.protocol}://${req.get('host')}`;
const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z][a-zA-Z0-9.-]*$/;

let pricingCache = { at: 0, data: new Map() };
const PRICING_TTL_MS = 60 * 60 * 1000;

async function quoteWholesale(namecheap, domain) {
  const tld = domain.split('.').slice(1).join('.');
  const now = Date.now();
  if (now - pricingCache.at > PRICING_TTL_MS) {
    pricingCache = { at: now, data: new Map() };
  }
  if (pricingCache.data.has(tld)) {
    return pricingCache.data.get(tld);
  }
  const price = await namecheap.getRegistrationPrice(tld, 1);
  pricingCache.data.set(tld, price);
  return price;
}

function computeQuote(wholesale) {
  const wholesaleCents = Math.round(wholesale.priceUsd * 100);
  const markupCents = Math.round(wholesaleCents * DOMAIN_MARKUP_PERCENT);
  const totalCents = wholesaleCents + markupCents;
  return {
    wholesaleCents,
    markupCents,
    totalCents,
    wholesalePriceUsd: wholesaleCents / 100,
    markupUsd: markupCents / 100,
    totalPriceUsd: totalCents / 100,
    markupPercent: Math.round(DOMAIN_MARKUP_PERCENT * 100),
    currency: wholesale.currency || 'USD',
  };
}

export default function createDomainRouter({ authService, namecheap, billingService, domainService, domainWorkflowFactory }) {
  const router = Router();
  router.use(createUserAuth(authService));

  router.post('/quote', requireCustomDomain(), async (req, res) => {
    try {
      const { domain } = req.body || {};
      if (!domain || !DOMAIN_REGEX.test(domain)) {
        return res.status(400).json({ error: { message: 'Invalid domain format', type: 'validation_error' } });
      }
      const availability = await namecheap.checkDomain(domain);
      if (!availability.available) {
        return res.json({
          success: true,
          domain,
          available: false,
          premium: availability.premium,
          premiumPrice: availability.premiumPrice,
          reason: availability.premium ? 'premium' : 'taken',
        });
      }
      if (availability.premium) {
        return res.json({
          success: true,
          domain,
          available: false,
          premium: true,
          premiumPrice: availability.premiumPrice,
          reason: 'premium',
        });
      }
      const wholesale = await quoteWholesale(namecheap, domain);
      const quote = computeQuote(wholesale);
      res.json({ success: true, domain, available: true, premium: false, ...quote });
    } catch (err) {
      console.error('Domain quote error:', err);
      res.status(500).json({ error: { message: err.message || 'Quote failed', type: 'server_error' } });
    }
  });

  router.post('/purchase', requireDomainPurchase(), async (req, res) => {
    try {
      const { domain } = req.body || {};
      if (!domain || !DOMAIN_REGEX.test(domain)) {
        return res.status(400).json({ error: { message: 'Invalid domain format', type: 'validation_error' } });
      }

      const availability = await namecheap.checkDomain(domain);
      if (!availability.available || availability.premium) {
        return res.status(400).json({
          error: {
            message: availability.premium
              ? 'Premium domains require manual support.'
              : `${domain} is not available.`,
            type: 'validation_error',
          },
        });
      }

      const wholesale = await quoteWholesale(namecheap, domain);
      const quote = computeQuote(wholesale);

      const customerId = await billingService.getOrCreateStripeCustomer(req.user);
      const stripe = getStripe();
      const base = origin(req);

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        line_items: [{
          price_data: {
            currency: quote.currency.toLowerCase(),
            product_data: { name: `Domain registration — ${domain} (1 year)` },
            unit_amount: quote.totalCents,
          },
          quantity: 1,
        }],
        success_url: `${base}/domains.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/domains.html?status=cancelled`,
        client_reference_id: req.user.id,
        metadata: {
          intent: 'domain_purchase',
          user_id: req.user.id,
          domain,
          expected_wholesale_cents: String(quote.wholesaleCents),
          expected_total_cents: String(quote.totalCents),
        },
      });

      await domainService.createPending({
        userId: req.user.id,
        domain,
        totalChargedCents: quote.totalCents,
        wholesaleCents: quote.wholesaleCents,
        stripeCheckoutSessionId: session.id,
      });

      res.json({ success: true, url: session.url, sessionId: session.id });
    } catch (err) {
      console.error('Domain purchase error:', err);
      res.status(500).json({ error: { message: err.message || 'Purchase failed', type: 'server_error' } });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const rows = await domainService.listByUser(req.user.id);
      res.json({ success: true, domains: rows.map(mapRow) });
    } catch (err) {
      console.error('List domains error:', err);
      res.status(500).json({ error: { message: 'Failed to list domains', type: 'server_error' } });
    }
  });

  router.get('/by-session/:sessionId', async (req, res) => {
    try {
      const row = await domainService.getByCheckoutSession(req.params.sessionId);
      if (!row || row.user_id !== req.user.id) {
        return res.status(404).json({ error: { message: 'Not found', type: 'not_found' } });
      }
      res.json({ success: true, domain: mapRow(row) });
    } catch (err) {
      console.error('Get domain by session error:', err);
      res.status(500).json({ error: { message: 'Failed', type: 'server_error' } });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const row = await domainService.getById(req.params.id, req.user.id);
      if (!row) return res.status(404).json({ error: { message: 'Not found', type: 'not_found' } });
      res.json({ success: true, domain: mapRow(row) });
    } catch (err) {
      console.error('Get domain error:', err);
      res.status(500).json({ error: { message: 'Failed', type: 'server_error' } });
    }
  });

  router.post('/:id/map', async (req, res) => {
    try {
      const row = await domainService.getById(req.params.id, req.user.id);
      if (!row) return res.status(404).json({ error: { message: 'Not found', type: 'not_found' } });
      if (row.status !== 'registered') {
        return res.status(409).json({ error: { message: `Cannot map a domain in status "${row.status}"`, type: 'conflict' } });
      }
      const { siteId } = req.body || {};
      if (!siteId) {
        return res.status(400).json({ error: { message: 'siteId is required', type: 'validation_error' } });
      }

      const workflow = domainWorkflowFactory();
      const result = await workflow.execute({
        domain: row.domain,
        registerNewDomain: false,
        acceptOwnedDomain: true,
        siteName: row.domain.replace(/\./g, '-'),
      });

      if (result.success) {
        await domainService.attachSite(row.id, req.user.id, siteId);
      }
      res.json(result);
    } catch (err) {
      console.error('Map domain error:', err);
      res.status(500).json({ error: { message: err.message || 'Mapping failed', type: 'server_error' } });
    }
  });

  return router;
}

function mapRow(row) {
  return {
    id: row.id,
    domain: row.domain,
    status: row.status,
    siteId: row.site_id,
    namecheapOrderId: row.namecheap_order_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    totalChargedCents: row.total_charged_cents,
    wholesaleCents: row.wholesale_cents,
    errorMessage: row.error_message,
    registeredAt: row.registered_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
