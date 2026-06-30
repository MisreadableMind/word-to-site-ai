import express from 'express';
import { pathToFileURL } from 'url';
import { createServer } from 'http';
import multer from 'multer';
import dns from 'dns';
import InstaWPSiteCreator from './index';
import InstaWPAPI, { sanitizeSiteName } from './instawp';
import DomainWorkflow from './domain-workflow';
import NamecheapAPI from './namecheap';
import { config, validateDomainConfig, toWpLocale } from './config';
import { prepareWizardData } from './services/business-structurer';
import OnboardingWorkflow from './onboarding-workflow';
import ExcerptService from './services/excerpt-service';
import EditorService from './services/editor-service';
import VoiceService from './services/voice-service';
import AIService from './services/ai-service';
import WordPressService from './services/wordpress-service';
import BaseSiteService from './services/base-site-service';
import VoiceHandler from './websocket/voice-handler';
import { EDITOR_MODES } from './constants';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { makeParseableTextFormat } from 'openai/lib/parser';
import { z } from 'zod';
import PluginAPIService from './services/plugin-api-service';
import createPluginRouter from './routes/plugin-routes';
import ProxyService from './services/proxy-service';
import createProxyRouter from './routes/proxy-routes';
import AuthService from './services/auth-service';
import SiteService from './services/site-service';
import BillingService from './services/billing-service';
import DomainService from './services/domain-service';
import BuyoutService from './services/buyout-service';
import JobsService from './services/jobs-service';
import createAuthRouter from './routes/auth-routes';
import createSiteRouter from './routes/site-routes';
import createEditorRouter from './routes/editor-routes';
import createBillingRouter, { createBillingWebhookRouter } from './routes/billing-routes';
import createDomainRouter from './routes/domain-routes';
import createAdminJobsRouter from './routes/admin-jobs-routes';
import LicenseService, { generateLicenseKey } from './services/license-service';
import createLicenseRouter from './routes/license-routes';
import { PLATFORM_HOSTS, PRIMARY_PLATFORM_HOST, classify as classifyDomain } from './lib/domain-classifier';
import { createUserAuth, createOptionalUserAuth } from './middleware/user-auth';
import { requireSiteCreate, requireCustomDomain, getVoiceLimit } from './middleware/entitlement';
import { provisionImageBank } from './lib/image-bank-flow';
import { getEntitlements as getPlanEntitlements } from './billing/entitlements';
import { get, isNil } from "lodash-es";
import { recommendSkins } from './services/skin-recommender';

const CRITICAL_ONBOARDING_STEPS = [
  'skin_switched',
  'deployment_applied',
  'wizard_data_saved',
];

function withAggregateSuccess(result) {
  const failed = result.steps?.find(
    (s) => s.success === false && CRITICAL_ONBOARDING_STEPS.includes(s.step),
  );
  if (!failed) return result;
  return {
    ...result,
    success: false,
    error: `${failed.step} failed: ${failed.error}`,
  };
}

class CriticalStepError extends Error {
  step: string;

  constructor(step: string, message: string) {
    super(message);
    this.step = step;
  }
}

function computeSiteExpiry(planTier) {
  const ttl = getPlanEntitlements(planTier || 'free').siteTtlDays;
  return ttl ? new Date(Date.now() + ttl * 86400000).toISOString() : null;
}

function isReservedForPlan(planTier) {
  return getPlanEntitlements(planTier || 'free').siteTtlDays == null;
}

const app = express();
const PORT = config.server.port;

// Trust Render's load balancer so req.protocol reflects X-Forwarded-Proto (https)
app.set('trust proxy', 1);

// AI Proxy service — instantiated globally so onboarding flows and plugin register can use it
// Plugin API routes (mounted BEFORE basic auth - uses its own API key auth)
if (config.pluginApi?.enabled !== false) {
  const pluginService = new PluginAPIService();
  app.use('/api/plugin', express.json(), createPluginRouter(pluginService));
}

// AI Proxy service — instantiated globally so onboarding flows can auto-register keys
const proxyService = config.proxy?.enabled !== false ? new ProxyService() : null;
if (proxyService) {
  app.use('/api/proxy', express.json({ limit: '1mb' }), createProxyRouter(proxyService));
}

// User Auth & Sites routes (mounted BEFORE basic auth - uses its own session auth)
const authService = new AuthService();
const siteService = new SiteService();
const licenseService = new LicenseService();
app.use('/api/license', express.json(), createLicenseRouter(licenseService));
const namecheapForBilling = config.stripe?.secretKey ? new NamecheapAPI() : null;
const domainService = config.stripe?.secretKey ? new DomainService() : null;
const buyoutService = config.stripe?.secretKey ? new BuyoutService() : null;
const domainWorkflowFactory = () => new DomainWorkflow({
  instawpApiKey: config.instawp.apiKey,
  proxyService,
});
const billingService = config.stripe?.secretKey
  ? new BillingService({ proxyService, domainService, namecheap: namecheapForBilling, licenseService, buyoutService, domainWorkflowFactory })
  : null;
const jobsService = billingService ? new JobsService({ billingService, licenseService }) : null;
const aiService = new AIService({ openaiApiKey: config.openai?.apiKey, geminiApiKey: config.gemini?.apiKey });
const editorService = new EditorService({ aiService, siteService });
if (config.auth?.enabled !== false) {
  app.use('/api/auth', express.json(), createAuthRouter(authService));
  app.use('/api/sites', express.json(), createSiteRouter(siteService, authService, proxyService, billingService, buyoutService));
  app.use('/api/editor/chat', express.json(), createEditorRouter(editorService, authService));
}

app.post('/api/content-bank/callback', express.json({ limit: '256kb' }), async (req, res) => {
  const login = req.query.login;
  if (!login) {
    return res.status(400).json({ ok: false, error: 'login required' });
  }

  const body = req.body || {};
  const status = body.status === 'error' || body.success === false ? 'failed' : 'ready';

  const updated = await siteService.setImagesStatusByImageBankLogin(login, status).catch((err) => {
    console.warn(`[content-bank callback] update failed for login ${login}:`, err.message);
    return null;
  });

  if (!updated) {
    return res.status(404).json({ ok: false, error: 'unknown login' });
  }

  res.json({ ok: true, status });
});

// Stripe webhook MUST be mounted before the global express.json() parser below — signature
// verification requires the raw request body.
if (billingService) {
  app.use('/api/billing', createBillingWebhookRouter(billingService));
  app.use('/api/billing', express.json(), createBillingRouter(billingService, authService));
  app.use('/api/domains', express.json(), createDomainRouter({
    authService,
    namecheap: namecheapForBilling,
    billingService,
    domainService,
    domainWorkflowFactory,
  }));
} else {
  const featureDisabled = (req, res) => {
    res.status(404).json({
      error: {
        message: 'Billing & domain features require Stripe to be configured on this deployment.',
        type: 'feature_disabled',
        feature: req.baseUrl.replace('/api/', ''),
      },
    });
  };
  app.use('/api/billing', express.json(), featureDisabled);
  app.use('/api/domains', express.json(), featureDisabled);
}

const noopMiddleware = (req, res, next) => next();
const requireAuthForBilling = billingService ? createUserAuth(authService) : noopMiddleware;
const siteCreateGate = billingService ? requireSiteCreate(billingService) : noopMiddleware;
const customDomainGate = billingService ? requireCustomDomain() : noopMiddleware;

function refuseLegacyDomainRegistration(req, res, next) {
  if (!billingService) return next();
  const source = (req.body && Object.keys(req.body).length > 0) ? req.body : (req.query || {});
  if (source.registerNewDomain === true || source.registerNewDomain === 'true') {
    return res.status(400).json({
      error: {
        type: 'flow_moved',
        message: 'Domain registration is now a separate, payment-confirmed step. Finish onboarding with a subdomain (or "bring your own domain"), then add a custom domain from /domains.',
        redirect: '/domains',
      },
    });
  }
  return next();
}

// Basic auth middleware (skipped when NODE_ENV=development or user auth is enabled)
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || 'WAAS';
if (process.env.NODE_ENV !== 'development' && config.auth?.enabled === false) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="WordToSite"');
      return res.status(401).send('Authentication required');
    }
    const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const password = decoded.includes(':') ? decoded.split(':').slice(1).join(':') : decoded;
    if (password !== BASIC_AUTH_PASSWORD) {
      res.set('WWW-Authenticate', 'Basic realm="WordToSite"');
      return res.status(401).send('Invalid credentials');
    }
    next();
  });
}

app.use(express.json());

// Multer for multipart file uploads (voice transcription)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function resolveProxyBaseUrl(req) {
  const base = config.proxy?.publicBaseUrl
    || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/proxy`;
}

async function autoRegisterProxyKey(wpUrl, siteName, req) {
  if (!proxyService) return;

  try {
    const domain = new URL(wpUrl).hostname;
    const existing = await proxyService.getSiteByDomain(domain);
    const monthlyTokenLimit = billingService && req?.user
      ? getPlanEntitlements(req.user.planTier).monthlyTokens
      : undefined;
    const site = existing
      || await proxyService.registerSite(domain, siteName || domain, wpUrl, { monthlyTokenLimit });

    if (existing) {
      console.log(`Proxy key already exists for ${domain}, re-pushing existing key`);
    } else {
      console.log(`Proxy key registered for ${domain}: ${site.api_key.slice(0, 8)}...`);
    }

    const proxyUrl = resolveProxyBaseUrl(req);
    const pushResponse = await fetch(`${wpUrl}/wp-json/wordtosite/v1/set-proxy-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proxyUrl, apiKey: site.api_key }),
    });

    if (!pushResponse.ok) {
      console.warn(`Failed to push proxy config to ${domain}: ${await pushResponse.text()}`);
      return { step: 'proxy_registered', success: true, reused: !!existing, pushed: false };
    }

    console.log(`Proxy config pushed to ${domain}`);
    return { step: 'proxy_registered', success: true, reused: !!existing, pushed: true };
  } catch (error) {
    console.warn('Auto proxy registration failed:', error.message);
    return { step: 'proxy_registered', success: false, error: error.message };
  }
}

// Base site service (skins & languages from TRXWaaSWizard plugin)
const baseSiteService = new BaseSiteService();

// GET /api/skins — cached skins list from base site
app.get('/api/skins', async (req, res) => {
  try {
    const skins = await baseSiteService.getSkins();
    res.json({ success: true, skins });
  } catch (error) {
    console.error('Error fetching skins:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/languages — cached languages list from base site
app.get('/api/languages', async (req, res) => {
  try {
    const languages = await baseSiteService.getLanguages();
    res.json({ success: true, languages });
  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const nonStrictTextFormat = <T extends z.ZodType>(schema: T, name: string) => {
  const { schema: jsonSchema } = zodTextFormat(schema, name);
  return makeParseableTextFormat(
    { type: 'json_schema', name, strict: false, schema: jsonSchema },
    (content): z.infer<T> => schema.parse(JSON.parse(content)),
  );
};

app.post('/api/skins/recommend', async (req, res) => {
  try {
    const skins = await baseSiteService.getSkins();
    res.json({ success: true, recommended: await recommendSkins(skins, req.body) });
  } catch (error) {
    console.error('Skin recommendation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Existing: Simple site creation (no domain)
app.post('/api/create-site', requireAuthForBilling, siteCreateGate, async (req, res) => {
  try {
    const { apiKey, siteName, isShared, isReserved } = req.body;

    const effectiveApiKey = apiKey || config.instawp.apiKey;

    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        error: 'InstaWP API Key is required. Either provide it in the form or set INSTA_WP_API_KEY in .env file.',
      });
    }

    const creator = new InstaWPSiteCreator(effectiveApiKey);

    const result = await creator.createSite({
      siteName: siteName || undefined,
      isShared: isShared !== undefined ? isShared : false,
      isReserved: isReserved !== undefined ? isReserved : isReservedForPlan(req.user?.planTier),
    });

    res.json(result);
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Direct WordPress auto-login: serves a page that auto-submits credentials to wp-login.php
app.get('/api/wp-auto-login', (req, res) => {
  const { url, u, p } = req.query;
  if (!url || !u || !p) {
    return res.status(400).send('Missing login parameters');
  }
  const loginUrl = url.replace(/\/+$/, '') + '/wp-login.php';
  // Serve a minimal HTML page that auto-submits the login form
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Logging in…</title></head><body>
<p style="font-family:system-ui;text-align:center;margin-top:20vh">Logging you in&hellip;</p>
<form id="f" method="POST" action="${loginUrl.replace(/"/g, '&quot;')}">
<input type="hidden" name="log" value="${u.replace(/"/g, '&quot;')}">
<input type="hidden" name="pwd" value="${p.replace(/"/g, '&quot;')}">
<input type="hidden" name="redirect_to" value="/wp-admin/">
<input type="hidden" name="rememberme" value="forever">
</form><script>document.getElementById("f").submit();</script></body></html>`);
});

// New: Check domain availability
app.post('/api/check-domain', async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain name is required',
      });
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid domain format. Example: example.com',
      });
    }

    const namecheap = new NamecheapAPI();
    const result = await namecheap.checkDomain(domain);

    res.json({
      success: true,
      domain: result.domain,
      available: result.available,
      premium: result.premium,
      premiumPrice: result.premiumPrice,
    });
  } catch (error) {
    console.error('Error checking domain:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// New: Create site with full domain workflow
app.post('/api/create-site-with-domain', requireAuthForBilling, refuseLegacyDomainRegistration, siteCreateGate, customDomainGate, async (req, res) => {
  try {
    const {
      apiKey,
      domain,
      registerNewDomain,
      siteName,
      contacts,
      includeWww,
      registrationYears,
    } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain name is required',
      });
    }

    const effectiveApiKey = apiKey || config.instawp.apiKey;
    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        error: 'InstaWP API Key is required',
      });
    }

    // Validate domain configuration
    try {
      validateDomainConfig(registerNewDomain);
    } catch (configError) {
      return res.status(400).json({
        success: false,
        error: configError.message,
        configurationRequired: true,
      });
    }

    const workflow = new DomainWorkflow({
      instawpApiKey: effectiveApiKey,
    });

    const result = await workflow.execute({
      domain,
      registerNewDomain: registerNewDomain || false,
      siteName,
      contacts,
      includeWww: includeWww !== false,
      registrationYears: registrationYears || 1,
    });

    res.json(result);
  } catch (error) {
    console.error('Error in domain workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// New: Server-Sent Events for real-time progress
app.get('/api/create-site-with-domain/stream', requireAuthForBilling, refuseLegacyDomainRegistration, siteCreateGate, customDomainGate, async (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { apiKey, domain, registerNewDomain, siteName, includeWww } = req.query;

  if (!domain) {
    res.write(`data: ${JSON.stringify({ step: 'error', error: 'Domain is required' })}\n\n`);
    res.end();
    return;
  }

  const effectiveApiKey = apiKey || config.instawp.apiKey;
  if (!effectiveApiKey) {
    res.write(`data: ${JSON.stringify({ step: 'error', error: 'API key is required' })}\n\n`);
    res.end();
    return;
  }

  // Validate configuration
  try {
    validateDomainConfig(registerNewDomain === 'true');
  } catch (configError) {
    res.write(`data: ${JSON.stringify({ step: 'error', error: configError.message })}\n\n`);
    res.end();
    return;
  }

  const workflow = new DomainWorkflow({
    instawpApiKey: effectiveApiKey,
    onProgress: (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    },
  });

  try {
    const result = await workflow.execute({
      domain,
      registerNewDomain: registerNewDomain === 'true',
      siteName,
      includeWww: includeWww !== 'false',
    });

    res.write(`data: ${JSON.stringify({ step: 'result', data: result })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ step: 'error', error: error.message })}\n\n`);
  }

  res.end();
});

// New: Get workflow steps info for UI
app.get('/api/workflow-steps', (req, res) => {
  const registerNewDomain = req.query.registerNewDomain === 'true';
  res.json({
    steps: DomainWorkflow.getWorkflowStepsInfo(registerNewDomain),
  });
});

// New: Check SSL status for a site
app.get('/api/ssl-status/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { apiKey } = req.query;

    const effectiveApiKey = apiKey || config.instawp.apiKey;
    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
      });
    }

    const workflow = new DomainWorkflow({ instawpApiKey: effectiveApiKey });
    const sslStatus = await workflow.checkSslStatus(siteId);

    res.json({
      success: true,
      ...sslStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Admin API key middleware for sensitive endpoints
function requireAdminKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (!config.adminApiKey || key !== config.adminApiKey) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

if (jobsService) {
  app.use('/api/admin/jobs', express.json(), requireAdminKey, createAdminJobsRouter(jobsService));
}

// Updated: Config check with domain workflow and AI status
app.get('/api/config', requireAdminKey, async (req, res) => {
  res.json({
    hasApiKey: !!config.instawp.apiKey,
    templateSlug: config.instawp.templateSlug,
    domainWorkflow: {
      cloudflareConfigured: !!(
        config.cloudflare.apiKey &&
        config.cloudflare.email &&
        config.cloudflare.accountId
      ),
      namecheapConfigured: !!(
        config.namecheap.apiKey &&
        config.namecheap.username &&
        config.namecheap.clientIp
      ),
    },
    aiServices: {
      openaiConfigured: !!config.openai?.apiKey,
      geminiConfigured: !!config.gemini?.apiKey,
    },
    features: {
      voiceFlow: config.features?.voiceFlow || false,
      lightEditor: config.features?.lightEditor || false,
      aiContent: config.features?.aiContent !== false,
      onboardingFlowB: true,
    },
    skins: await baseSiteService.getSkins().catch(() => null),
  });
});

// Updated: Health check with version
app.get('/api/health', requireAdminKey, (req, res) => {
  res.json({
    status: 'ok',
    service: 'InstaWP Site Creator',
    version: '3.0.0',
    features: ['site-creation', 'domain-workflow', 'onboarding-wizard', 'ai-content'],
  });
});

// ==========================================
// VOICE TRANSCRIPTION ENDPOINT
// ==========================================

// --- Voice rate limiter (per-day, limit derived from the user's plan tier) ---
const voiceRateLimit = new Map();
const VOICE_RATE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
const VOICE_DEFAULT_LIMIT = 15;

function resolveVoiceLimit(planTier) {
  return billingService ? getVoiceLimit(planTier || 'free') : VOICE_DEFAULT_LIMIT;
}

function checkVoiceRateLimit(userId, limit) {
  const now = Date.now();
  const entry = voiceRateLimit.get(userId);
  if (!entry || now > entry.windowStart + VOICE_RATE_WINDOW) {
    voiceRateLimit.set(userId, { windowStart: now, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) {
    const resetIn = Math.ceil((entry.windowStart + VOICE_RATE_WINDOW - now) / 60000);
    return { allowed: false, remaining: 0, resetIn };
  }
  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

// Auth middleware for voice
const requireAuth = createUserAuth(authService);

// POST /api/voice/transcribe - Transcribe uploaded audio file (requires login, rate-limited)
app.post('/api/voice/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  const voiceLimit = resolveVoiceLimit(req.user.planTier);
  const rateCheck = checkVoiceRateLimit(req.user.id, voiceLimit);
  res.set('X-RateLimit-Remaining', String(rateCheck.remaining));
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: `Voice limit reached (${voiceLimit}/day). Resets in ${rateCheck.resetIn} minutes. You can still type your answers.`,
      upgradeUrl: '/pricing',
    });
  }
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required. Send as multipart form data with field name "audio".',
      });
    }

    const aiService = new AIService({
      openaiApiKey: config.openai?.apiKey,
    });

    if (!aiService.hasOpenAI) {
      return res.status(400).json({
        success: false,
        error: 'OpenAI API key is required for voice transcription. Set OPENAI_API_KEY in .env.',
      });
    }

    const voiceService = new VoiceService({ aiService });
    const language = req.body?.language || 'auto';
    const result = await voiceService.transcribe(req.file.buffer, language);

    res.json({
      success: true,
      text: result.text,
      language: result.language,
    });
  } catch (error) {
    console.error('Voice transcription error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==========================================
// ONBOARDING ENDPOINTS
// ==========================================

app.get('/api/onboard/check-domain-dns', async (req, res) => {
  const domain = (req.query.domain || '').toString().trim().toLowerCase();
  const c = classifyDomain(domain);
  if (c.kind === 'invalid' || c.kind === 'reserved') {
    return res.status(400).json({ error: 'Valid domain is required' });
  }

  const baseHostMatcher = new RegExp(
    `(?:^|\\.)(?:${PLATFORM_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})$`,
    'i',
  );
  const expectedCnameTarget = `${domain.replace(/\./g, '-')}.${PRIMARY_PLATFORM_HOST}`;

  const result = {
    domain,
    expectedCnameTarget,
    resolves: false,
    pointsHere: false,
    cname: [],
    a: [],
  };

  try {
    const cname = await dns.promises.resolveCname(domain);
    result.cname = cname;
    result.resolves = result.resolves || cname.length > 0;
    result.pointsHere = cname.some((c) => baseHostMatcher.test(c.toLowerCase()));
  } catch (err) {
    if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
      console.warn(`CNAME lookup for ${domain} failed:`, err.code || err.message);
    }
  }

  if (!result.pointsHere) {
    try {
      const a = await dns.promises.resolve4(domain);
      result.a = a;
      result.resolves = result.resolves || a.length > 0;
    } catch (err) {
      if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
        console.warn(`A-record lookup for ${domain} failed:`, err.code || err.message);
      }
    }
  }

  res.json(result);
});

// Generate tagline from company name and industry
const IndustryMatch = z.object({
  matched: z.string().describe('The closest matching industry from the provided options, or the original text if none match'),
});

app.post('/api/onboard/match-industry', async (req, res) => {
  try {
    const { text, options } = req.body;

    if (!text || !options?.length) {
      return res.status(400).json({ success: false, error: 'text and options are required' });
    }

    if (!config.openai?.apiKey) {
      return res.json({ success: true, matched: text });
    }

    const openai = new OpenAI({ apiKey: config.openai.apiKey });

    const response = await openai.responses.parse({
      model: 'gpt-5-mini',
      input: [
        {
          role: 'system',
          content: `You are a classifier. The user said an industry name via voice. Match it to the closest option from this list: ${options.join(', ')}. If none match well, use the original text.`,
        },
        { role: 'user', content: text },
      ],
      text: { format: nonStrictTextFormat(IndustryMatch, 'industry_match') },
      reasoning: { effort: 'minimal' },
    });

    const matched = response.output_parsed?.matched || text;
    res.json({ success: true, matched });
  } catch (error) {
    console.error('Industry match error:', error);
    res.json({ success: true, matched: req.body.text });
  }
});

const SuggestedOptions = z.object({
  services: z.array(z.string().describe('Short service/product name, 2-4 words')).describe('10-12 services relevant to this business'),
  about: z.array(z.string().describe('Short about-us phrase')).describe('6-8 about-us phrases describing what this business might do'),
});

app.post('/api/onboard/suggest-options', async (req, res) => {
  try {
    const { companyName, industry } = req.body;

    if (!companyName || !industry) {
      return res.status(400).json({ success: false, error: 'companyName and industry are required' });
    }

    if (!config.openai?.apiKey) {
      return res.json({ success: true, services: null, about: null });
    }

    const openai = new OpenAI({ apiKey: config.openai.apiKey });

    const response = await openai.responses.parse({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: 'You suggest options for a business website onboarding form. Given a company name and industry, suggest relevant services/products and about-us phrases.',
        },
        { role: 'user', content: `Company: ${companyName}\nIndustry: ${industry}` },
      ],
      text: { format: nonStrictTextFormat(SuggestedOptions, 'suggested_options') },
    });

    const parsed = response.output_parsed;
    res.json({
      success: true,
      services: parsed?.services || null,
      about: parsed?.about || null,
    });
  } catch (error) {
    console.error('Suggest options error:', error);
    res.json({ success: true, services: null, about: null });
  }
});

const Step2Suggestions = z.object({
  team: z.string().describe('A 2-3 sentence paragraph about the team, written in first person plural (we/our), professional but warm tone'),
  advantages: z.string().describe('A 2-3 sentence paragraph about competitive advantages and unique selling points, written in first person plural'),
});

app.post('/api/onboard/suggest-step2', async (req, res) => {
  try {
    const { companyName, industry, services } = req.body;

    if (!companyName || !industry) {
      return res.status(400).json({ success: false, error: 'companyName and industry are required' });
    }

    if (!config.openai?.apiKey) {
      return res.json({ success: true, team: null, advantages: null });
    }

    const openai = new OpenAI({ apiKey: config.openai.apiKey });

    const response = await openai.responses.parse({
      model: 'gpt-5-mini',
      input: [
        {
          role: 'system',
          content: 'You write website copy for businesses. Given a company name, industry, and services, generate an "about the team" paragraph and a "what makes us different" paragraph. Keep each to 2-3 sentences. Write in first person plural (we/our). Be specific to the industry, not generic.',
        },
        { role: 'user', content: `Company: ${companyName}\nIndustry: ${industry}\nServices: ${services || 'N/A'}` },
      ],
      text: { format: nonStrictTextFormat(Step2Suggestions, 'step2_suggestions') },
      reasoning: { effort: 'minimal' },
    });

    const parsed = response.output_parsed;
    res.json({
      success: true,
      team: parsed?.team || null,
      advantages: parsed?.advantages || null,
    });
  } catch (error) {
    console.error('Step 2 suggestions error:', error);
    res.json({ success: true, team: null, advantages: null });
  }
});

const Tagline = z.object({
  tagline: z.string().describe('A short, catchy tagline, max 8 words'),
});

app.post('/api/onboard/generate-tagline', async (req, res) => {
  try {
    const { companyName, industry, services, aboutUs } = req.body;

    if (!companyName || !industry) {
      return res.status(400).json({
        success: false,
        error: 'Company name and industry are required',
      });
    }

    if (config.openai?.apiKey) {
      try {
        const openai = new OpenAI({ apiKey: config.openai.apiKey });
        const { output_parsed } = await openai.responses.parse({
          model: 'gpt-4.1-mini',
          input: [
            { role: 'system', content: 'You are a branding expert. Generate a short, catchy tagline (max 8 words) for a business. Write the tagline in the same language as the business details provided; if unclear, use English.' },
            { role: 'user', content: `Company: ${companyName}\nIndustry: ${industry}\nServices: ${services || 'N/A'}\nAbout: ${aboutUs || 'N/A'}` },
          ],
          text: { format: nonStrictTextFormat(Tagline, 'tagline') },
        });

        if (!isNil(get(output_parsed, 'tagline'))) {
          return res.json({ success: true, tagline: output_parsed!.tagline });
        }
      } catch (error: any) {
        console.warn('AI tagline generation failed:', error.message);
      }
    }

    // Fallback template
    const tagline = `${companyName} — Your trusted ${industry.toLowerCase()} partner`;
    res.json({ success: true, tagline });
  } catch (error) {
    console.error('Error generating tagline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Flow B: Submit interview answers
app.post('/api/onboard/interview/complete', async (req, res) => {
  try {
    const { answers, language } = req.body;

    if (!answers || Object.keys(answers).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Interview answers are required',
      });
    }

    // Basic email validation
    if (answers.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(answers.email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email address',
        });
      }
    }

    const workflow = new OnboardingWorkflow({
      openaiApiKey: config.openai?.apiKey,
      geminiApiKey: config.gemini?.apiKey,
    });

    const result = await workflow.executeFlowB(answers, { language });
    res.json(result);
  } catch (error) {
    console.error('Error in Flow B:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Optional auth middleware for onboarding confirm endpoints
const optionalAuth = createOptionalUserAuth(authService);

// Confirm and proceed with deployment (full pipeline)
const confirmAuth = billingService ? requireAuth : optionalAuth;
app.post('/api/onboard/confirm', confirmAuth, refuseLegacyDomainRegistration, siteCreateGate, customDomainGate, async (req, res) => {
  try {
    const {
      sessionId,
      templateSlug,
      deploymentContext,
      contentContext,
      domain,
      registerNewDomain,
      acceptOwnedDomain,
      editorPreference,
      apiKey,
    } = req.body;

    if (!deploymentContext) {
      return res.status(400).json({
        success: false,
        error: 'Deployment context is required',
      });
    }

    const effectiveApiKey = apiKey || config.instawp.apiKey;
    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        error: 'InstaWP API key is required',
      });
    }

    const licenseKey = licenseService ? generateLicenseKey() : null;

    // If domain workflow is needed
    if (domain) {
      const domainWorkflow = new DomainWorkflow({
        instawpApiKey: effectiveApiKey,
        proxyService,
        proxyUrl: proxyService ? resolveProxyBaseUrl(req) : null,
      });

      const result = await domainWorkflow.executeWithContexts({
        domain,
        registerNewDomain: registerNewDomain || false,
        acceptOwnedDomain: acceptOwnedDomain === true || acceptOwnedDomain === 'true',
        deploymentContext,
        contentContext,
        editorPreference,
        email: req.user?.email,
        callbackBaseUrl: `${req.protocol}://${req.get('host')}`,
        licenseKey,
      });

      if (licenseService && licenseKey && result.site?.id) {
        await licenseService
          .issueForSite({
            instawpId: result.site.id,
            wpUrl: result.site.wp_url || null,
            userId: req.user?.id || null,
            userSiteId: null,
            status: req.user ? 'active' : 'not_paid',
            licenseKey,
          })
          .catch((err) => console.warn('Failed to issue license:', err.message));
      }

      // Save domain-workflow site to user's dashboard if logged in
      if (req.user && result.site) {
        try {
          const createdRow = await siteService.createSite(req.user.id, {
            domain,
            instawpId: result.site.id || null,
            templateSlug: templateSlug || deploymentContext.template?.slug,
            wpUrl: result.site.wp_url,
            wpUsername: result.site.wp_username,
            wpPassword: result.site.wp_password,
            siteName: deploymentContext.branding?.siteTitle || contentContext?.business?.name || 'My Site',
            onboardType: 'domain',
            onboardData: { deploymentContext, contentContext },
            imageBankLogin: result.imageBank?.login || null,
            imageBankPassword: result.imageBank?.password || null,
            imagesStatus: result.imageBank?.status || null,
            expiresAt: computeSiteExpiry(req.user.planTier),
          });
          if (licenseService && result.site.id && createdRow?.id) {
            await licenseService
              .linkSite({ instawpId: result.site.id, userId: req.user.id, userSiteId: createdRow.id })
              .catch((err) => console.warn('Failed to link license:', err.message));
          }
        } catch (err) {
          console.warn('Failed to save site to user dashboard:', err.message);
        }
      }

      return res.json(result);
    }

    // Simple site creation (no domain) with full deploy pipeline
    const requestedSiteName = deploymentContext.branding?.siteTitle
      || contentContext?.business?.name
      || undefined;
    const sanitizedSiteName = sanitizeSiteName(requestedSiteName);
    if (sanitizedSiteName) {
      const api = new InstaWPAPI(effectiveApiKey);
      const available = await api.isSiteNameAvailable(sanitizedSiteName);
      if (!available) {
        return res.status(409).json({
          success: false,
          error: `Site name "${sanitizedSiteName}" is already taken. Please choose a different name.`,
        });
      }
    }

    const creator = new InstaWPSiteCreator(effectiveApiKey);
    const siteResult = await creator.createSite({
      siteName: requestedSiteName,
      templateSlug: templateSlug || deploymentContext.template?.slug,
      isReserved: isReservedForPlan(req.user?.planTier),
    });

    const site = normalizeSiteData(siteResult.site || siteResult);
    const result = {
      success: true,
      site,
      steps: [{ step: 'site_created', success: true }],
    };

    let effectiveLicenseKey = licenseKey;
    if (licenseService && licenseKey && site?.id) {
      const issued = await licenseService
        .issueForSite({
          instawpId: site.id,
          wpUrl: site.wp_url || null,
          userId: req.user?.id || null,
          userSiteId: null,
          status: req.user ? 'active' : 'not_paid',
          licenseKey,
        })
        .catch((err) => {
          console.warn('Failed to issue license:', err.message);
          return null;
        });
      if (issued?.license_key) effectiveLicenseKey = issued.license_key;
    }

    // Apply deployment context if we have site credentials
    try {
    if (site.wp_url && site.wp_username && site.wp_password) {
      const wp = new WordPressService(site.wp_url, {
        username: config.instawp.snapshotWpUsername,
        password: config.instawp.snapshotWpPassword,
      });

      const skinSlug = templateSlug || deploymentContext.template?.slug;

      if (effectiveLicenseKey) {
        try {
          await wp.activateLicense(effectiveLicenseKey, {
            userName: req.user?.displayName || null,
            userEmail: req.user?.email || null,
          });
          await licenseService.markActivated(effectiveLicenseKey).catch(() => {});
          result.steps.push({ step: 'license_activated', success: true });
        } catch (error) {
          console.warn('Failed to activate license on site:', error.message);
          result.steps.push({ step: 'license_activated', success: false, error: error.message });
          if (skinSlug && skinSlug !== 'default') {
            throw new CriticalStepError('license_activated', error.message);
          }
        }
      }

      if (skinSlug && skinSlug !== 'default') {
        try {
          await wp.switchSkin(skinSlug);
          result.steps.push({ step: 'skin_switched', success: true, skin: skinSlug });
        } catch (error) {
          console.error('Failed to switch skin:', error.message);
          result.steps.push({ step: 'skin_switched', success: false, error: error.message });
          throw new CriticalStepError('skin_switched', error.message);
        }
      }

      if (deploymentContext) {
        try {
          const settingsUpdate = {};
          if (deploymentContext.branding?.siteTitle) settingsUpdate.title = deploymentContext.branding.siteTitle;
          if (deploymentContext.branding?.tagline) settingsUpdate.tagline = deploymentContext.branding.tagline;
          if (Object.keys(settingsUpdate).length > 0) {
            await wp.updateSiteSettings(settingsUpdate);
          }

          const customizerSettings = {};
          if (deploymentContext.branding?.faviconUrl) customizerSettings.faviconUrl = deploymentContext.branding.faviconUrl;
          if (deploymentContext.branding?.logoUrl) customizerSettings.logoUrl = deploymentContext.branding.logoUrl;
          if (deploymentContext.branding?.primaryColor) customizerSettings.primaryColor = deploymentContext.branding.primaryColor;
          if (Object.keys(customizerSettings).length > 0) {
            await wp.updateCustomizer(customizerSettings);
          }

          result.steps.push({ step: 'deployment_applied', success: true });
        } catch (error) {
          console.error('Failed to apply deployment context:', error.message);
          result.steps.push({ step: 'deployment_applied', success: false, error: error.message });
        }
      }

      try {
        const wizardData = await prepareWizardData(deploymentContext, contentContext, site);
        await wp.saveWizardData(wizardData);
        result.steps.push({ step: 'wizard_data_saved', success: true });
      } catch (error) {
        console.error('Failed to save wizard data:', error.message);
        result.steps.push({ step: 'wizard_data_saved', success: false, error: error.message });
      }

      try {
        const imageBank = await provisionImageBank({
          wp,
          domain: site.domain || new URL(site.wp_url).hostname,
          name: deploymentContext.branding?.siteTitle || contentContext?.business?.name,
          email: req.user?.email,
        });
        if (imageBank) {
          result.imageBank = imageBank;
          result.steps.push({ step: 'image_bank_registered', success: true });
        }
      } catch (error) {
        console.warn('Image bank provisioning failed:', error.message);
        result.steps.push({ step: 'image_bank_registered', success: false, error: error.message });
      }

      // Auto-register proxy key (non-blocking)
      const proxyStep = await autoRegisterProxyKey(
        site.wp_url,
        deploymentContext.branding?.siteTitle || contentContext?.business?.name,
        req,
      );
      if (proxyStep) result.steps.push(proxyStep);

      // Translate plugin (if non-English)
      const wpLocale = toWpLocale(contentContext?.language?.primary);
      if (wpLocale && wpLocale !== 'en_US') {
        try {
          await wp.translatePlugin(wpLocale);
          result.steps.push({ step: 'plugin_translated', success: true, locale: wpLocale });
        } catch (error) {
          console.warn('Failed to translate plugin:', error.message);
          result.steps.push({ step: 'plugin_translated', success: false, error: error.message });
        }
      }

      if (editorPreference) {
        try {
          const editorService = new EditorService();
          result.editor = await editorService.selectEditor(site.id, site.wp_url, editorPreference);
        } catch (error) {
          result.editor = { mode: 'advanced', url: `${site.wp_url}/wp-admin` };
        }
      }
    }
    } catch (error) {
      if (!(error instanceof CriticalStepError)) throw error;
      console.error(`Deploy aborted at ${error.step}: ${error.message}`);
      result.success = false;
      result.error = `${error.step} failed: ${error.message}`;
    }

    // Save site to user's dashboard if logged in
    if (req.user && site) {
      try {
        const createdRow = await siteService.createSite(req.user.id, {
          domain: site.domain || null,
          instawpId: site.id || null,
          templateSlug: templateSlug || deploymentContext.template?.slug,
          wpUrl: site.wp_url,
          wpUsername: site.wp_username,
          wpPassword: site.wp_password,
          siteName: deploymentContext.branding?.siteTitle || contentContext?.business?.name || 'My Site',
          onboardType: domain ? 'domain' : 'simple',
          onboardData: { deploymentContext, contentContext },
          imageBankLogin: result.imageBank?.login || null,
          imageBankPassword: result.imageBank?.password || null,
          imagesStatus: result.imageBank?.status || null,
          expiresAt: computeSiteExpiry(req.user.planTier),
        });
        if (licenseService && site.id && createdRow?.id) {
          await licenseService
            .linkSite({ instawpId: site.id, userId: req.user.id, userSiteId: createdRow.id })
            .catch((err) => console.warn('Failed to link license:', err.message));
        }
      } catch (err) {
        console.warn('Failed to save site to user dashboard:', err.message);
      }
    }

    res.json(withAggregateSuccess(result));
  } catch (error) {
    console.error('Error confirming onboarding:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// SSE streaming confirm endpoint for real-time deploy progress
app.get('/api/onboard/confirm/stream', confirmAuth, refuseLegacyDomainRegistration, siteCreateGate, customDomainGate, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const {
    apiKey,
    domain,
    registerNewDomain,
    acceptOwnedDomain,
    templateSlug,
  } = req.query;

  // deploymentContext and contentContext are sent as JSON-encoded query params
  let deploymentContext, contentContext;
  try {
    deploymentContext = req.query.deploymentContext ? JSON.parse(req.query.deploymentContext) : null;
    contentContext = req.query.contentContext ? JSON.parse(req.query.contentContext) : null;
  } catch {
    res.write(`data: ${JSON.stringify({ step: 'error', error: 'Invalid context data' })}\n\n`);
    res.end();
    return;
  }

  if (!deploymentContext) {
    res.write(`data: ${JSON.stringify({ step: 'error', error: 'Deployment context is required' })}\n\n`);
    res.end();
    return;
  }

  const effectiveApiKey = apiKey || config.instawp.apiKey;
  if (!effectiveApiKey) {
    res.write(`data: ${JSON.stringify({ step: 'error', error: 'API key is required' })}\n\n`);
    res.end();
    return;
  }

  const licenseKey = licenseService ? generateLicenseKey() : null;

  const sendProgress = (step, data = {}) => {
    res.write(`data: ${JSON.stringify({ step, timestamp: new Date().toISOString(), ...data })}\n\n`);
  };

  try {
    if (domain) {
      // Domain workflow with progress
      const domainWorkflow = new DomainWorkflow({
        instawpApiKey: effectiveApiKey,
        proxyService,
        proxyUrl: proxyService ? resolveProxyBaseUrl(req) : null,
        onProgress: (progress) => {
          sendProgress(progress.step, progress);
        },
      });

      const result = await domainWorkflow.executeWithContexts({
        domain,
        registerNewDomain: registerNewDomain === 'true',
        acceptOwnedDomain: acceptOwnedDomain === 'true',
        deploymentContext,
        contentContext,
        email: req.user?.email,
        callbackBaseUrl: `${req.protocol}://${req.get('host')}`,
        licenseKey,
      });

      if (licenseService && licenseKey && result.site?.id) {
        await licenseService
          .issueForSite({
            instawpId: result.site.id,
            wpUrl: result.site.wp_url || null,
            userId: req.user?.id || null,
            userSiteId: null,
            status: req.user ? 'active' : 'not_paid',
            licenseKey,
          })
          .catch((err) => console.warn('Failed to issue license:', err.message));
      }

      // Save to user's dashboard
      if (req.user && result.site) {
        try {
          const createdRow = await siteService.createSite(req.user.id, {
            domain,
            instawpId: result.site.id || null,
            templateSlug: templateSlug || deploymentContext.template?.slug,
            wpUrl: result.site.wp_url,
            wpUsername: result.site.wp_username,
            wpPassword: result.site.wp_password,
            siteName: deploymentContext.branding?.siteTitle || contentContext?.business?.name || 'My Site',
            onboardType: 'domain',
            onboardData: { deploymentContext, contentContext },
            imageBankLogin: result.imageBank?.login || null,
            imageBankPassword: result.imageBank?.password || null,
            imagesStatus: result.imageBank?.status || null,
            expiresAt: computeSiteExpiry(req.user.planTier),
          });
          if (licenseService && result.site.id && createdRow?.id) {
            await licenseService
              .linkSite({ instawpId: result.site.id, userId: req.user.id, userSiteId: createdRow.id })
              .catch((err) => console.warn('Failed to link license:', err.message));
          }
        } catch (err) {
          console.warn('Failed to save site to user dashboard (stream):', err.message);
        }
      }

      res.write(`data: ${JSON.stringify({ step: 'result', data: result })}\n\n`);
    } else {
      // Simple site creation with progress
      const siteName = deploymentContext.branding?.siteTitle
        || contentContext?.business?.name
        || undefined;
      const sanitizedName = sanitizeSiteName(siteName);
      let siteNameNote = '';
      if (sanitizedName && sanitizedName !== siteName) {
        siteNameNote = ` — name sanitized to "${sanitizedName}"`;
      } else if (sanitizedName) {
        siteNameNote = ` "${sanitizedName}"`;
      }

      if (sanitizedName) {
        sendProgress('validating_name', { message: `Checking "${sanitizedName}" availability...` });
        const api = new InstaWPAPI(effectiveApiKey);
        let available = false;
        try {
          available = await api.isSiteNameAvailable(sanitizedName);
        } catch (err) {
          console.warn(`Site name availability check failed: ${err.message}`);
          const message = `Could not verify site name availability: ${err.message}`;
          sendProgress('error', { step: 'validating_name', message });
          res.write(`data: ${JSON.stringify({
            step: 'result',
            data: { success: false, error: message, site: null, steps: [] },
          })}\n\n`);
          return res.end();
        }
        if (!available) {
          const message = `Site name "${sanitizedName}" is already taken. Please choose a different name.`;
          sendProgress('error', { step: 'validating_name', message });
          res.write(`data: ${JSON.stringify({
            step: 'result',
            data: { success: false, error: message, site: null, steps: [] },
          })}\n\n`);
          return res.end();
        }
      }

      sendProgress('creating_site', { message: `Creating WordPress site${siteNameNote}...` });

      const creator = new InstaWPSiteCreator(effectiveApiKey);
      const siteResult = await creator.createSite({
        siteName,
        templateSlug: templateSlug || deploymentContext.template?.slug,
        isReserved: isReservedForPlan(req.user?.planTier),
        onProgress: ({ phase, message }) => {
          sendProgress('creating_site', { message, phase });
        },
      });

      const site = normalizeSiteData(siteResult.site || siteResult);
      sendProgress('site_created', { message: 'Site created!' });

      const result = { success: true, site, steps: [] };

      let effectiveLicenseKey = licenseKey;
      if (licenseService && licenseKey && site?.id) {
        const issued = await licenseService
          .issueForSite({
            instawpId: site.id,
            wpUrl: site.wp_url || null,
            userId: req.user?.id || null,
            userSiteId: null,
            status: req.user ? 'active' : 'not_paid',
            licenseKey,
          })
          .catch((err) => {
            console.warn('Failed to issue license:', err.message);
            return null;
          });
        if (issued?.license_key) effectiveLicenseKey = issued.license_key;
      }

      try {
      if (site.wp_url && site.wp_username && site.wp_password) {
        const wp = new WordPressService(site.wp_url, {
          username: config.instawp.snapshotWpUsername,
          password: config.instawp.snapshotWpPassword,
        });

        const skinSlug = templateSlug || deploymentContext.template?.slug;

        if (effectiveLicenseKey) {
          try {
            await wp.activateLicense(effectiveLicenseKey, {
              userName: req.user?.displayName || null,
              userEmail: req.user?.email || null,
            });
            await licenseService.markActivated(effectiveLicenseKey).catch(() => {});
            result.steps.push({ step: 'license_activated', success: true });
          } catch (error) {
            console.warn('Failed to activate license on site:', error.message);
            result.steps.push({ step: 'license_activated', success: false, error: error.message });
            if (skinSlug && skinSlug !== 'default') {
              throw new CriticalStepError('license_activated', error.message);
            }
          }
        }

        if (skinSlug && skinSlug !== 'default') {
          sendProgress('switching_skin', { message: `Switching skin to "${skinSlug}"...` });
          try {
            await wp.switchSkin(skinSlug, {
              onProgress: (progress) => {
                sendProgress('switching_skin', { message: progress.message, ...progress });
              },
            });
            result.steps.push({ step: 'skin_switched', success: true, skin: skinSlug });
          } catch (error) {
            console.error('Failed to switch skin:', error.message);
            result.steps.push({ step: 'skin_switched', success: false, error: error.message });
            throw new CriticalStepError('skin_switched', error.message);
          }
        }

        // Apply deployment context
        sendProgress('applying_deployment', { message: 'Applying site configuration...' });
        try {
          const settings = {};
          if (deploymentContext.branding?.siteTitle) settings.title = deploymentContext.branding.siteTitle;
          if (deploymentContext.branding?.tagline) settings.tagline = deploymentContext.branding.tagline;
          if (Object.keys(settings).length > 0) await wp.updateSiteSettings(settings);

          const customizer = {};
          if (deploymentContext.branding?.faviconUrl) customizer.faviconUrl = deploymentContext.branding.faviconUrl;
          if (deploymentContext.branding?.logoUrl) customizer.logoUrl = deploymentContext.branding.logoUrl;
          if (deploymentContext.branding?.primaryColor) customizer.primaryColor = deploymentContext.branding.primaryColor;
          if (Object.keys(customizer).length > 0) await wp.updateCustomizer(customizer);

          result.steps.push({ step: 'deployment_applied', success: true });
        } catch (error) {
          result.steps.push({ step: 'deployment_applied', success: false, error: error.message });
        }

        sendProgress('structuring_business', { message: 'Structuring company info...' });
        try {
          const wizardData = await prepareWizardData(deploymentContext, contentContext, site);
          sendProgress('saving_wizard_data', { message: 'Saving wizard data...' });
          await wp.saveWizardData(wizardData);
          result.steps.push({ step: 'wizard_data_saved', success: true });
        } catch (error) {
          console.error('Failed to save wizard data:', error.message);
          result.steps.push({ step: 'wizard_data_saved', success: false, error: error.message });
        }

        try {
          const imageBank = await provisionImageBank({
            wp,
            domain: site.domain || new URL(site.wp_url).hostname,
            name: deploymentContext.branding?.siteTitle || contentContext?.business?.name,
            email: req.user?.email,
          });
          if (imageBank) {
            result.imageBank = imageBank;
            result.steps.push({ step: 'image_bank_registered', success: true });
          }
        } catch (error) {
          console.warn('Image bank provisioning failed:', error.message);
          result.steps.push({ step: 'image_bank_registered', success: false, error: error.message });
        }

        // Auto-register proxy key (non-blocking)
        const proxyStep = await autoRegisterProxyKey(
          site.wp_url,
          deploymentContext.branding?.siteTitle || contentContext?.business?.name,
          req,
        );
        if (proxyStep) result.steps.push(proxyStep);

        // Translate plugin (if non-English)
        const wpLocale = toWpLocale(contentContext?.language?.primary);
        if (wpLocale && wpLocale !== 'en_US') {
          sendProgress('translating_plugin', { message: `Translating to ${wpLocale}...` });
          try {
            await wp.translatePlugin(wpLocale, {
              onProgress: (progress) => {
                sendProgress('translating_plugin', { message: progress.message, ...progress });
              },
            });
            result.steps.push({ step: 'plugin_translated', success: true, locale: wpLocale });
          } catch (error) {
            console.warn('Failed to translate plugin:', error.message);
            result.steps.push({ step: 'plugin_translated', success: false, error: error.message });
          }
        }
      }
      } catch (error) {
        if (!(error instanceof CriticalStepError)) throw error;
        console.error(`Deploy aborted at ${error.step}: ${error.message}`);
        result.success = false;
        result.error = `${error.step} failed: ${error.message}`;
      }

      // Save to user's dashboard
      if (req.user && site) {
        try {
          const createdRow = await siteService.createSite(req.user.id, {
            domain: site.domain || null,
            instawpId: site.id || null,
            templateSlug: templateSlug || deploymentContext.template?.slug,
            wpUrl: site.wp_url,
            wpUsername: site.wp_username,
            wpPassword: site.wp_password,
            siteName: deploymentContext.branding?.siteTitle || contentContext?.business?.name || 'My Site',
            onboardType: 'simple',
            onboardData: { deploymentContext, contentContext },
            imageBankLogin: result.imageBank?.login || null,
            imageBankPassword: result.imageBank?.password || null,
            imagesStatus: result.imageBank?.status || null,
            expiresAt: computeSiteExpiry(req.user.planTier),
          });
          if (licenseService && site.id && createdRow?.id) {
            await licenseService
              .linkSite({ instawpId: site.id, userId: req.user.id, userSiteId: createdRow.id })
              .catch((err) => console.warn('Failed to link license:', err.message));
          }
        } catch (err) {
          console.warn('Failed to save site to user dashboard (stream):', err.message);
        }
      }

      const finalResult = withAggregateSuccess(result);
      if (finalResult.success !== false) {
        sendProgress('complete', { message: 'Deployment complete!' });
      }
      res.write(`data: ${JSON.stringify({ step: 'result', data: finalResult })}\n\n`);
    }
  } catch (error) {
    res.write(`data: ${JSON.stringify({ step: 'error', error: error.message })}\n\n`);
  }

  res.end();
});

// ==========================================
// WIZARD ENDPOINTS
// ==========================================

// Accept deployment context for deployment
app.post('/api/wizard/deploy', async (req, res) => {
  try {
    const { siteId, siteUrl, deploymentContext } = req.body;

    if (!siteId || !deploymentContext) {
      return res.status(400).json({
        success: false,
        error: 'Site ID and deployment context are required',
      });
    }

    // In a full implementation, this would:
    // 1. Apply template skin
    // 2. Install and configure plugins
    // 3. Import demo content
    // 4. Apply branding (logo, favicon, colors)

    res.json({
      success: true,
      siteId,
      applied: {
        template: deploymentContext.template,
        plugins: deploymentContext.plugins?.length || 0,
        demoContent: deploymentContext.demoContent?.import || false,
        branding: !!deploymentContext.branding,
      },
      message: 'Deployment context applied successfully',
    });
  } catch (error) {
    console.error('Error applying deployment context:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Accept content context for AI content generation
app.post('/api/wizard/generate-content', async (req, res) => {
  try {
    const { siteId, siteUrl, contentContext } = req.body;

    if (!siteId || !contentContext) {
      return res.status(400).json({
        success: false,
        error: 'Site ID and content context are required',
      });
    }

    // In a full implementation, this would:
    // 1. Generate content using AI
    // 2. Push content to WordPress via WAAS Controller Plugin
    // 3. Apply SEO settings

    res.json({
      success: true,
      siteId,
      contentGenerated: {
        pages: contentContext.pages?.length || 0,
        business: contentContext.business?.name || 'Unknown',
        tone: contentContext.tone,
      },
      message: 'Content generation initiated',
    });
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Generate excerpt for content
app.post('/api/wizard/generate-excerpt', async (req, res) => {
  try {
    const { content, maxWords, style } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required',
      });
    }

    const excerptService = new ExcerptService();
    const excerpt = await excerptService.generateExcerpt(content, {
      maxWords: maxWords || 30,
      style: style || 'informative',
    });

    res.json({
      success: true,
      excerpt,
      wordCount: excerpt.split(/\s+/).length,
    });
  } catch (error) {
    console.error('Error generating excerpt:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==========================================
// EDITOR ENDPOINTS
// ==========================================

// Test Light Editor capability
app.post('/api/editor/test', async (req, res) => {
  try {
    const { siteId, siteUrl } = req.body;

    if (!siteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Site URL is required',
      });
    }

    const editorService = new EditorService();
    const result = await editorService.testLightEditorCapability(siteId, siteUrl);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error testing editor capability:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Select editor mode
app.post('/api/editor/select', async (req, res) => {
  try {
    const { siteId, siteUrl, mode } = req.body;

    if (!siteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Site URL is required',
      });
    }

    const editorService = new EditorService();
    const selection = await editorService.selectEditor(siteId, siteUrl, mode || EDITOR_MODES.LIGHT);

    res.json({
      success: true,
      ...selection,
    });
  } catch (error) {
    console.error('Error selecting editor:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get editor options for UI
app.get('/api/editor/options', async (req, res) => {
  try {
    const { siteId, siteUrl } = req.query;

    const editorService = new EditorService();

    let capabilities = null;
    if (siteUrl) {
      capabilities = await editorService.testLightEditorCapability(siteId, siteUrl);
    }

    const options = editorService.getEditorOptions(capabilities);

    res.json({
      success: true,
      options,
      lightEditorAvailable: capabilities?.viable || false,
    });
  } catch (error) {
    console.error('Error getting editor options:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==========================================
// SITE DATA HELPERS
// ==========================================

/**
 * Normalize a site object from InstaWP so that wp_url, wp_username,
 * wp_password are always present regardless of which field name the
 * API actually used.
 */
function normalizeSiteData(raw) {
  if (!raw) return raw;

  // Try every known field name for the site URL
  const url = raw.wp_url || raw.url || raw.site_url || raw.siteUrl
    || raw.wordpress_url || raw.domain
    || findUrlInObject(raw)
    || '';

  const username = raw.wp_username || raw.username || raw.admin_user
    || raw.site_meta?.wp_username || config.instawp.snapshotWpUsername || '';
  const password = raw.wp_password || raw.password || raw.admin_pass
    || raw.site_meta?.wp_password || config.instawp.snapshotWpPassword || '';

  // Build direct auto-login URL that bypasses InstaWP dashboard
  const magicLoginUrl = (url && username && password)
    ? `/api/wp-auto-login?url=${encodeURIComponent(url)}&u=${encodeURIComponent(username)}&p=${encodeURIComponent(password)}`
    : '';

  return {
    ...raw,
    wp_url: url,
    wp_username: username,
    wp_password: password,
    magic_login_url: magicLoginUrl,
  };
}

/**
 * Last-resort: scan all top-level string values for something that looks
 * like an http(s) URL pointing to a site (not an API endpoint).
 */
function findUrlInObject(obj) {
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && /^https?:\/\/.+\..+/.test(v)
        && !v.includes('/api/') && !v.includes('/wp-json/')) {
      return v;
    }
  }
  return null;
}

// Create HTTP server, attach WebSocket, and start listening
const voiceHandler = new VoiceHandler();

function startServer(port) {
  const server = createServer(app);

  // Initialize WebSocket for voice if enabled
  if (config.features?.voiceFlow) {
    voiceHandler.initialize(server);
  }

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      throw err;
    }
  });

  server.listen(port, () => {
    if (
      process.env.NODE_ENV === 'development'
      && config.namecheap.apiKey
      && !config.namecheap.sandbox
      && !config.namecheap.allowRealInDev
    ) {
      console.warn(
        '\n⚠️  Real Namecheap credentials detected in development mode.\n'
        + '   Domain registration is blocked at runtime to prevent accidental charges.\n'
        + '   Set NAMECHEAP_SANDBOX=true (recommended) or ALLOW_REAL_NAMECHEAP_IN_DEV=true to enable.\n'
      );
    }

    if (config.auth?.enabled !== false) {
      setInterval(async () => {
        try {
          const cleaned = await authService.cleanExpiredSessions();
          if (cleaned > 0) console.log(`Cleaned ${cleaned} expired sessions`);
        } catch (err) {
          console.error('Session cleanup error:', err.message);
        }
      }, 60 * 60 * 1000);
    }
  });
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) startServer(PORT);

export default app;
