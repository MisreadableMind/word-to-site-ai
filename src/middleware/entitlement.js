import { getEntitlements, allowsCustomDomain, allowsCustomDomainRegistration } from '../billing/entitlements.js';

function paymentRequired(res, body) {
  return res.status(402).json({
    error: {
      message: body.message,
      type: 'payment_required',
      upgradeRequired: true,
      currentPlan: body.currentPlan,
      requiredFor: body.requiredFor,
      upgradeUrl: '/pricing.html',
    },
  });
}

export function requireSiteCreate(billingService) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required', type: 'authentication_error' } });
    }
    const planTier = req.user.planTier || 'free';
    const ent = getEntitlements(planTier);
    const used = await billingService.getSiteCount(req.user.id);
    if (used >= ent.maxSites) {
      return paymentRequired(res, {
        message: `Site limit reached for ${ent.label} plan (${ent.maxSites}). Upgrade to create more sites.`,
        currentPlan: planTier,
        requiredFor: 'siteCreate',
      });
    }
    req.entitlements = ent;
    next();
  };
}

export function requireCustomDomain(billingService) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required', type: 'authentication_error' } });
    }
    const planTier = req.user.planTier || 'free';

    const source = (req.body && Object.keys(req.body).length > 0) ? req.body : (req.query || {});
    const wantsRegistration = source.registerNewDomain === true || source.registerNewDomain === 'true';
    const wantsAnyDomain = Boolean(source.domain);

    if (wantsAnyDomain && !allowsCustomDomain(planTier)) {
      return paymentRequired(res, {
        message: 'Custom domains require a paid plan.',
        currentPlan: planTier,
        requiredFor: 'customDomain',
      });
    }

    if (wantsRegistration) {
      if (!allowsCustomDomainRegistration(planTier)) {
        return paymentRequired(res, {
          message: 'Domain registration requires the Pro or Business plan.',
          currentPlan: planTier,
          requiredFor: 'domainRegistration',
        });
      }
      const ent = getEntitlements(planTier);
      const used = await billingService.getDomainCreditsUsed(req.user.id);
      if (used >= ent.includedDomains) {
        return paymentRequired(res, {
          message: `Domain credits exhausted (${used}/${ent.includedDomains}). Upgrade to register more domains.`,
          currentPlan: planTier,
          requiredFor: 'domainCredit',
        });
      }
    }

    req.entitlements = getEntitlements(planTier);
    next();
  };
}

export function getVoiceLimit(planTier) {
  return getEntitlements(planTier).voicePerDay;
}
