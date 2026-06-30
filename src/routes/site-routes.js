import { Router } from 'express';
import { createUserAuth } from '../middleware/user-auth';
import { classify } from '../lib/domain-classifier';
import { getStripe, getBuyoutPrice } from '../billing/stripe-client';
import { config } from '../config';

const origin = (req) => `${req.protocol}://${req.get('host')}`;

function buyoutDomainError(c) {
  if (c.kind === 'invalid') {
    return { type: 'invalid_domain', reason: c.reason, message: 'Enter a valid domain.' };
  }
  if (c.kind === 'platform_subdomain') {
    return { type: 'platform_subdomain', message: 'That is a WordToSite subdomain — enter the client’s own domain.' };
  }
  if (c.kind === 'reserved') {
    return { type: 'reserved_domain', reason: c.reason, message: 'This TLD can’t be used for a live site.' };
  }
  if (c.kind === 'subdomain') {
    return { type: 'subdomain', apex: c.apex, message: `Enter the root domain (${c.apex}) rather than a subdomain.` };
  }
  return null;
}

/**
 * Create site router
 * Mounted at /api/sites
 */
export default function createSiteRouter(siteService, authService, proxyService, billingService, buyoutService) {
  const router = Router();
  const auth = createUserAuth(authService);

  // All routes require authentication
  router.use(auth);

  // List user's sites
  router.get('/', async (req, res) => {
    try {
      const sites = await siteService.listSites(req.user.id);
      res.json({ success: true, sites });
    } catch (error) {
      console.error('List sites error:', error);
      res.status(500).json({
        error: { message: 'Failed to list sites', type: 'server_error' },
      });
    }
  });

  // Get site detail
  router.get('/:id', async (req, res) => {
    try {
      const site = await siteService.getSiteById(req.params.id, req.user.id);

      if (!site) {
        return res.status(404).json({
          error: { message: 'Site not found', type: 'not_found' },
        });
      }

      res.json({ success: true, site });
    } catch (error) {
      console.error('Get site error:', error);
      res.status(500).json({
        error: { message: 'Failed to get site', type: 'server_error' },
      });
    }
  });

  // Get proxy usage for a site
  router.get('/:id/usage', async (req, res) => {
    try {
      const site = await siteService.getSiteById(req.params.id, req.user.id);
      if (!site) {
        return res.status(404).json({ error: { message: 'Site not found', type: 'not_found' } });
      }

      if (!proxyService) {
        return res.json({ success: true, usage: null, message: 'Proxy service not enabled' });
      }

      // Look up the domain in proxy_sites
      const domain = site.wp_url ? new URL(site.wp_url).hostname : site.domain;
      if (!domain) {
        return res.json({ success: true, usage: null, message: 'No domain associated' });
      }

      const proxySite = await proxyService.getSiteByDomain(domain);
      if (!proxySite) {
        return res.json({ success: true, usage: null, message: 'No proxy key registered' });
      }

      const used = await proxyService.getMonthlyUsage(proxySite.id);
      const tokenLimit = parseInt(proxySite.monthly_token_limit) || 0;
      const quota = await proxyService.checkQuota(proxySite.id, tokenLimit);

      res.json({
        success: true,
        usage: {
          domain: proxySite.domain,
          status: proxySite.status,
          tokensUsed: used,
          tokenLimit,
          remaining: Math.max(0, tokenLimit - used),
          allowed: quota.allowed,
          period: new Date().toISOString().slice(0, 7),
        },
      });
    } catch (error) {
      console.error('Site usage error:', error);
      res.status(500).json({ error: { message: 'Failed to get usage', type: 'server_error' } });
    }
  });

  // Soft delete site
  router.delete('/:id', async (req, res) => {
    try {
      const site = await siteService.deleteSite(req.params.id, req.user.id);

      if (!site) {
        return res.status(404).json({
          error: { message: 'Site not found', type: 'not_found' },
        });
      }

      res.json({ success: true, message: 'Site deleted' });
    } catch (error) {
      console.error('Delete site error:', error);
      res.status(500).json({
        error: { message: 'Failed to delete site', type: 'server_error' },
      });
    }
  });

  // Quote a buyout for a site (one-time license fee + the client's own domain)
  router.post('/:id/buyout/quote', async (req, res) => {
    try {
      const site = await siteService.getSiteById(req.params.id, req.user.id);
      if (!site) {
        return res.status(404).json({ error: { message: 'Site not found', type: 'not_found' } });
      }
      const c = classify(typeof req.body?.domain === 'string' ? req.body.domain : '');
      const reject = buyoutDomainError(c);
      if (reject) return res.status(400).json({ error: reject });

      const buyoutPrice = await getBuyoutPrice().catch(() => null);
      const feeCents = buyoutPrice?.unitAmountCents ?? config.buyout.licenseFeeCents;

      res.json({
        success: true,
        domain: c.apex,
        feeCents,
        feeUsd: feeCents / 100,
      });
    } catch (error) {
      console.error('Buyout quote error:', error);
      res.status(500).json({ error: { message: 'Failed to quote buyout', type: 'server_error' } });
    }
  });

  // Start a buyout: create a one-time Stripe checkout, record a pending buyout
  router.post('/:id/buyout', async (req, res) => {
    try {
      if (!billingService || !buyoutService) {
        return res.status(404).json({
          error: { message: 'Buyout requires Stripe to be configured on this deployment.', type: 'feature_disabled' },
        });
      }

      const site = await siteService.getSiteById(req.params.id, req.user.id);
      if (!site) {
        return res.status(404).json({ error: { message: 'Site not found', type: 'not_found' } });
      }
      if (site.bought_out_at) {
        return res.status(409).json({ error: { message: 'This site has already been bought out.', type: 'conflict' } });
      }

      const c = classify(typeof req.body?.domain === 'string' ? req.body.domain : '');
      const reject = buyoutDomainError(c);
      if (reject) return res.status(400).json({ error: reject });

      const buyoutPrice = await getBuyoutPrice().catch(() => null);
      const feeCents = buyoutPrice?.unitAmountCents ?? config.buyout.licenseFeeCents;
      const lineItem = buyoutPrice
        ? { price: buyoutPrice.priceId, quantity: 1 }
        : {
            price_data: {
              currency: 'usd',
              product_data: { name: `Site buyout — ${site.site_name || c.apex} (lifetime license)` },
              unit_amount: feeCents,
            },
            quantity: 1,
          };
      const customerId = await billingService.getOrCreateStripeCustomer(req.user);
      const stripe = getStripe();
      const base = origin(req);

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        line_items: [lineItem],
        success_url: `${base}/dashboard?buyout={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/dashboard?status=cancelled`,
        client_reference_id: req.user.id,
        metadata: {
          intent: 'buyout',
          user_id: req.user.id,
          site_id: site.id,
          domain: c.apex,
        },
      });

      await buyoutService.createPending({
        userId: req.user.id,
        siteId: site.id,
        domain: c.apex,
        feeCents,
        stripeCheckoutSessionId: session.id,
      });

      res.json({ success: true, url: session.url, sessionId: session.id });
    } catch (error) {
      console.error('Buyout start error:', error);
      res.status(500).json({ error: { message: error.message || 'Failed to start buyout', type: 'server_error' } });
    }
  });

  return router;
}
