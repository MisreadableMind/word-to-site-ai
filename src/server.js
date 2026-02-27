import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import multer from 'multer';
import InstaWPSiteCreator from './index.js';
import DomainWorkflow from './domain-workflow.js';
import NamecheapAPI from './namecheap.js';
import { config, validateDomainConfig } from './config.js';
import OnboardingWorkflow, { OnboardingSteps } from './onboarding-workflow.js';
import ExcerptService from './services/excerpt-service.js';
import EditorService from './services/editor-service.js';
import VoiceService from './services/voice-service.js';
import AIService from './services/ai-service.js';
import WordPressService from './services/wordpress-service.js';
import VoiceHandler from './websocket/voice-handler.js';
import { ONBOARDING_FLOWS, EDITOR_MODES } from './constants.js';
import PluginAPIService from './services/plugin-api-service.js';
import createPluginRouter from './routes/plugin-routes.js';
import ProxyService from './services/proxy-service.js';
import createProxyRouter from './routes/proxy-routes.js';
import AuthService from './services/auth-service.js';
import SiteService from './services/site-service.js';
import createAuthRouter from './routes/auth-routes.js';
import createSiteRouter from './routes/site-routes.js';
import createEditorRouter from './routes/editor-routes.js';
import { createOptionalUserAuth } from './middleware/user-auth.js';
import SkinsService from './services/skins-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.server.port;

// Plugin API routes (mounted BEFORE basic auth - uses its own API key auth)
if (config.pluginApi?.enabled !== false) {
  const pluginService = new PluginAPIService();
  app.use('/api/plugin', express.json(), createPluginRouter(pluginService));
}

// AI Proxy routes (mounted BEFORE basic auth - uses its own API key auth)
if (config.proxy?.enabled !== false) {
  const proxyService = new ProxyService();
  app.use('/api/proxy', express.json({ limit: '1mb' }), createProxyRouter(proxyService));
}

// User Auth & Sites routes (mounted BEFORE basic auth - uses its own session auth)
const authService = new AuthService();
const siteService = new SiteService();
const aiService = new AIService({ openaiApiKey: config.openai?.apiKey, geminiApiKey: config.gemini?.apiKey });
const editorService = new EditorService({ aiService, siteService });
const skinsService = new SkinsService();
if (config.auth?.enabled !== false) {
  app.use('/api/auth', express.json(), createAuthRouter(authService));
  app.use('/api/sites', express.json(), createSiteRouter(siteService, authService));
  app.use('/api/editor/chat', express.json(), createEditorRouter(editorService, authService));
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
app.use(express.static(path.join(__dirname, '../public')));

// Multer for multipart file uploads (voice transcription)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Existing: Simple site creation (no domain)
app.post('/api/create-site', async (req, res) => {
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
      isReserved: isReserved !== undefined ? isReserved : true,
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
app.post('/api/create-site-with-domain', async (req, res) => {
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
app.get('/api/create-site-with-domain/stream', async (req, res) => {
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

// Updated: Config check with domain workflow and AI status
app.get('/api/config', async (req, res) => {
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
      firecrawlConfigured: !!config.firecrawl?.apiKey,
    },
    features: {
      voiceFlow: config.features?.voiceFlow || false,
      lightEditor: config.features?.lightEditor || false,
      aiContent: config.features?.aiContent !== false,
      onboardingFlowA: true,
      onboardingFlowB: true,
    },
    skins: await skinsService.getSkins().catch(() => null),
  });
});

// Skins & Languages (cached server-side)
app.get('/api/skins', async (req, res) => {
  try {
    const skins = await skinsService.getSkins();
    res.json({ success: true, data: skins });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

app.get('/api/languages', async (req, res) => {
  try {
    const languages = await skinsService.getLanguages();
    res.json({ success: true, data: languages });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

// Updated: Health check with version
app.get('/api/health', (req, res) => {
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

// POST /api/voice/transcribe - Transcribe uploaded audio file
app.post('/api/voice/transcribe', upload.single('audio'), async (req, res) => {
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

// Get available onboarding flows
app.get('/api/onboard/flows', (req, res) => {
  res.json({
    flows: OnboardingWorkflow.getFlowOptions(),
  });
});

// Flow A: Analyze existing website
app.post('/api/onboard/analyze-url', async (req, res) => {
  try {
    const { url, options } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
      });
    }

    const workflow = new OnboardingWorkflow({
      firecrawlApiKey: config.firecrawl?.apiKey,
      openaiApiKey: config.openai?.apiKey,
      geminiApiKey: config.gemini?.apiKey,
    });

    const result = await workflow.executeFlowA(url, options || {});
    res.json(result);
  } catch (error) {
    console.error('Error in Flow A:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Flow A: SSE stream for real-time progress
app.get('/api/onboard/analyze-url/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;

  if (!url) {
    res.write(`data: ${JSON.stringify({ step: 'error', error: 'URL is required' })}\n\n`);
    res.end();
    return;
  }

  const workflow = new OnboardingWorkflow({
    firecrawlApiKey: config.firecrawl?.apiKey,
    openaiApiKey: config.openai?.apiKey,
    geminiApiKey: config.gemini?.apiKey,
    onProgress: (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    },
  });

  try {
    const result = await workflow.executeFlowA(url);
    res.write(`data: ${JSON.stringify({ step: 'result', data: result })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ step: 'error', error: error.message })}\n\n`);
  }

  res.end();
});

// Generate tagline from company name and industry
app.post('/api/onboard/generate-tagline', async (req, res) => {
  try {
    const { companyName, industry } = req.body;

    if (!companyName || !industry) {
      return res.status(400).json({
        success: false,
        error: 'Company name and industry are required',
      });
    }

    const aiService = new AIService({
      openaiApiKey: config.openai?.apiKey,
      geminiApiKey: config.gemini?.apiKey,
    });

    if (aiService.hasOpenAI) {
      try {
        const result = await aiService.chat([
          { role: 'system', content: 'You are a branding expert. Generate a short, catchy tagline (max 8 words) for a business. Return ONLY the tagline text, nothing else.' },
          { role: 'user', content: `Company: ${companyName}\nIndustry: ${industry}` },
        ]);
        return res.json({ success: true, tagline: result.trim() });
      } catch (error) {
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

// Get onboarding steps info for UI
app.get('/api/onboard/steps', (req, res) => {
  const flow = req.query.flow || ONBOARDING_FLOWS.COPY;
  res.json({
    steps: OnboardingWorkflow.getStepsInfo(flow),
  });
});

// Optional auth middleware for onboarding confirm endpoints
const optionalAuth = createOptionalUserAuth(authService);

// Confirm and proceed with deployment (full pipeline)
app.post('/api/onboard/confirm', optionalAuth, async (req, res) => {
  try {
    const {
      sessionId,
      templateSlug,
      deploymentContext,
      contentContext,
      domain,
      registerNewDomain,
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

    // If domain workflow is needed
    if (domain) {
      const domainWorkflow = new DomainWorkflow({
        instawpApiKey: effectiveApiKey,
      });

      const result = await domainWorkflow.executeWithContexts({
        domain,
        registerNewDomain: registerNewDomain || false,
        deploymentContext,
        contentContext,
        editorPreference,
      });

      // Save domain-workflow site to user's dashboard if logged in
      if (req.user && result.site) {
        try {
          await siteService.createSite(req.user.id, {
            domain,
            instawpId: result.site.id || null,
            templateSlug: templateSlug || deploymentContext.template?.slug,
            wpUrl: result.site.wp_url,
            wpUsername: result.site.wp_username,
            wpPassword: result.site.wp_password,
            siteName: deploymentContext.branding?.siteTitle || contentContext?.business?.name || 'My Site',
            onboardType: 'domain',
            onboardData: { deploymentContext, contentContext },
          });
        } catch (err) {
          console.warn('Failed to save site to user dashboard:', err.message);
        }
      }

      return res.json(result);
    }

    // Simple site creation (no domain) with full deploy pipeline
    const creator = new InstaWPSiteCreator(effectiveApiKey);
    const siteResult = await creator.createSite({
      siteName: deploymentContext.branding?.siteTitle || contentContext?.business?.name || undefined,
      templateSlug: templateSlug || deploymentContext.template?.slug,
    });

    const site = normalizeSiteData(siteResult.site || siteResult);
    const result = {
      success: true,
      site,
      steps: [{ step: 'site_created', success: true }],
    };

    // Apply deployment context if we have site credentials
    if (site.wp_url && site.wp_username && site.wp_password) {
      const wp = new WordPressService(site.wp_url, {
        username: site.wp_username,
        password: site.wp_password,
      });

      // Apply deployment context
      if (deploymentContext) {
        try {
          const settingsUpdate = {};
          if (deploymentContext.branding?.siteTitle) settingsUpdate.title = deploymentContext.branding.siteTitle;
          if (deploymentContext.branding?.tagline) settingsUpdate.tagline = deploymentContext.branding.tagline;
          if (Object.keys(settingsUpdate).length > 0) {
            await wp.updateSiteSettings(settingsUpdate);
          }

          // Apply customizer
          const customizerSettings = {};
          if (deploymentContext.branding?.faviconUrl) customizerSettings.faviconUrl = deploymentContext.branding.faviconUrl;
          if (deploymentContext.branding?.logoUrl) customizerSettings.logoUrl = deploymentContext.branding.logoUrl;
          if (deploymentContext.branding?.primaryColor) customizerSettings.primaryColor = deploymentContext.branding.primaryColor;
          if (Object.keys(customizerSettings).length > 0) {
            await wp.updateCustomizer(customizerSettings);
          }

          result.steps.push({ step: 'deployment_applied', success: true });
        } catch (error) {
          console.warn('Failed to apply deployment context:', error.message);
          result.steps.push({ step: 'deployment_applied', success: false, error: error.message });
        }
      }

      // Generate and push content
      if (contentContext) {
        try {
          const ai = new AIService({
            openaiApiKey: config.openai?.apiKey,
            geminiApiKey: config.gemini?.apiKey,
          });

          let generatedContent = null;
          if (ai.hasOpenAI) {
            generatedContent = await ai.generateContent(contentContext);
          }

          const pagesToCreate = contentContext.pages || [];
          let homepageId = null;

          for (const pageDef of pagesToCreate) {
            try {
              const aiPage = generatedContent?.pages?.[pageDef.slug];
              const content = aiPage
                ? buildPageHtml(pageDef.slug, aiPage)
                : buildFallbackHtml(pageDef, contentContext.business);

              const created = await wp.createPage({
                title: pageDef.title || pageDef.slug,
                content,
                slug: pageDef.slug,
                status: 'publish',
              });

              if (pageDef.slug === 'home') homepageId = created.id;
            } catch (err) {
              console.warn(`Failed to create page ${pageDef.slug}:`, err.message);
            }
          }

          if (homepageId) {
            await wp.setFrontPage(homepageId).catch(() => {});
          }

          await wp.updateSiteSettings({
            title: contentContext.business?.name || 'My Website',
            tagline: contentContext.business?.tagline || '',
          }).catch(() => {});

          result.steps.push({ step: 'content_generated', success: true });
        } catch (error) {
          console.warn('Failed to generate content:', error.message);
          result.steps.push({ step: 'content_generated', success: false, error: error.message });
        }
      }

      // Select editor
      if (editorPreference) {
        try {
          const editorService = new EditorService();
          result.editor = await editorService.selectEditor(site.id, site.wp_url, editorPreference);
        } catch (error) {
          result.editor = { mode: 'advanced', url: `${site.wp_url}/wp-admin` };
        }
      }
    }

    // Save site to user's dashboard if logged in
    if (req.user && site) {
      try {
        await siteService.createSite(req.user.id, {
          domain: site.domain || null,
          instawpId: site.id || null,
          templateSlug: templateSlug || deploymentContext.template?.slug,
          wpUrl: site.wp_url,
          wpUsername: site.wp_username,
          wpPassword: site.wp_password,
          siteName: deploymentContext.branding?.siteTitle || contentContext?.business?.name || 'My Site',
          onboardType: domain ? 'domain' : 'simple',
          onboardData: { deploymentContext, contentContext },
        });
      } catch (err) {
        console.warn('Failed to save site to user dashboard:', err.message);
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error confirming onboarding:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// SSE streaming confirm endpoint for real-time deploy progress
app.get('/api/onboard/confirm/stream', optionalAuth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const {
    apiKey,
    domain,
    registerNewDomain,
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

  const sendProgress = (step, data = {}) => {
    res.write(`data: ${JSON.stringify({ step, timestamp: new Date().toISOString(), ...data })}\n\n`);
  };

  try {
    if (domain) {
      // Domain workflow with progress
      const domainWorkflow = new DomainWorkflow({
        instawpApiKey: effectiveApiKey,
        onProgress: (progress) => {
          sendProgress(progress.step, progress);
        },
      });

      const result = await domainWorkflow.executeWithContexts({
        domain,
        registerNewDomain: registerNewDomain === 'true',
        deploymentContext,
        contentContext,
      });

      // Save to user's dashboard
      if (req.user && result.site) {
        try {
          await siteService.createSite(req.user.id, {
            domain,
            instawpId: result.site.id || null,
            templateSlug: templateSlug || deploymentContext.template?.slug,
            wpUrl: result.site.wp_url,
            wpUsername: result.site.wp_username,
            wpPassword: result.site.wp_password,
            siteName: deploymentContext.branding?.siteTitle || contentContext?.business?.name || 'My Site',
            onboardType: 'domain',
            onboardData: { deploymentContext, contentContext },
          });
        } catch (err) {
          console.warn('Failed to save site to user dashboard (stream):', err.message);
        }
      }

      res.write(`data: ${JSON.stringify({ step: 'result', data: result })}\n\n`);
    } else {
      // Simple site creation with progress
      sendProgress('creating_site', { message: 'Creating WordPress site...' });

      const siteName = deploymentContext.branding?.siteTitle
        || contentContext?.business?.name
        || undefined;

      const creator = new InstaWPSiteCreator(effectiveApiKey);
      const siteResult = await creator.createSite({
        siteName,
        templateSlug: templateSlug || deploymentContext.template?.slug,
        onProgress: ({ phase, message }) => {
          sendProgress('creating_site', { message, phase });
        },
      });

      const site = normalizeSiteData(siteResult.site || siteResult);
      sendProgress('site_created', { message: 'Site created!' });

      const result = { success: true, site, steps: [] };

      if (site.wp_url && site.wp_username && site.wp_password) {
        const wp = new WordPressService(site.wp_url, {
          username: site.wp_username,
          password: site.wp_password,
        });

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

        // Generate content
        if (contentContext) {
          sendProgress('generating_content', { message: 'Generating AI content...' });

          try {
            const ai = new AIService({
              openaiApiKey: config.openai?.apiKey,
              geminiApiKey: config.gemini?.apiKey,
            });

            let generated = null;
            if (ai.hasOpenAI) {
              generated = await ai.generateContent(contentContext);
            }

            sendProgress('pushing_content', { message: 'Publishing pages...' });

            const pages = contentContext.pages || [];
            let homepageId = null;

            for (const pageDef of pages) {
              try {
                const aiPage = generated?.pages?.[pageDef.slug];
                const content = aiPage
                  ? buildPageHtml(pageDef.slug, aiPage)
                  : buildFallbackHtml(pageDef, contentContext.business);

                const created = await wp.createPage({
                  title: pageDef.title || pageDef.slug,
                  content,
                  slug: pageDef.slug,
                  status: 'publish',
                });
                if (pageDef.slug === 'home') homepageId = created.id;
              } catch (err) {
                console.warn(`Failed to create page ${pageDef.slug}:`, err.message);
              }
            }

            if (homepageId) await wp.setFrontPage(homepageId).catch(() => {});

            await wp.updateSiteSettings({
              title: contentContext.business?.name || 'My Website',
              tagline: contentContext.business?.tagline || '',
            }).catch(() => {});

            result.steps.push({ step: 'content_generated', success: true });
          } catch (error) {
            result.steps.push({ step: 'content_generated', success: false, error: error.message });
          }
        }
      }

      // Save to user's dashboard
      if (req.user && site) {
        try {
          await siteService.createSite(req.user.id, {
            domain: site.domain || null,
            instawpId: site.id || null,
            templateSlug: templateSlug || deploymentContext.template?.slug,
            wpUrl: site.wp_url,
            wpUsername: site.wp_username,
            wpPassword: site.wp_password,
            siteName: deploymentContext.branding?.siteTitle || contentContext?.business?.name || 'My Site',
            onboardType: 'simple',
            onboardData: { deploymentContext, contentContext },
          });
        } catch (err) {
          console.warn('Failed to save site to user dashboard (stream):', err.message);
        }
      }

      sendProgress('complete', { message: 'Deployment complete!' });
      res.write(`data: ${JSON.stringify({ step: 'result', data: result })}\n\n`);
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

  const username = raw.wp_username || raw.username || raw.admin_user || '';
  const password = raw.wp_password || raw.password || raw.admin_pass || '';

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

// ==========================================
// CONTENT HELPERS
// ==========================================

/**
 * Build HTML content for a page from AI-generated structured content
 */
function buildPageHtml(slug, pageContent) {
  const sections = [];

  if (pageContent.hero) {
    sections.push(`<div class="hero-section"><h1>${pageContent.hero.headline || ''}</h1><p>${pageContent.hero.subheadline || ''}</p>${pageContent.hero.cta ? `<a href="#contact" class="cta-button">${pageContent.hero.cta}</a>` : ''}</div>`);
  }

  if (pageContent.features && Array.isArray(pageContent.features)) {
    const items = pageContent.features.map(f => `<div class="feature"><h3>${f.title || ''}</h3><p>${f.description || ''}</p></div>`).join('\n');
    sections.push(`<div class="features-section">${items}</div>`);
  }

  if (pageContent.about) {
    const content = typeof pageContent.about === 'string' ? pageContent.about : (pageContent.about.content || pageContent.about.description || '');
    sections.push(`<div class="about-section"><h2>${pageContent.about.title || 'About Us'}</h2><p>${content}</p></div>`);
  }

  if (pageContent.services && Array.isArray(pageContent.services)) {
    const items = pageContent.services.map(s => `<div class="service"><h3>${s.title || ''}</h3><p>${s.description || ''}</p></div>`).join('\n');
    sections.push(`<div class="services-section"><h2>Our Services</h2>${items}</div>`);
  }

  if (pageContent.contact) {
    sections.push(`<div class="contact-section"><h2>${pageContent.contact.title || 'Contact Us'}</h2><p>${pageContent.contact.description || 'Get in touch with us.'}</p></div>`);
  }

  if (sections.length === 0) {
    for (const [key, value] of Object.entries(pageContent)) {
      if (typeof value === 'string') {
        sections.push(`<p>${value}</p>`);
      } else if (typeof value === 'object' && value !== null) {
        sections.push(`<div><h2>${value.title || key}</h2><p>${value.content || value.description || ''}</p></div>`);
      }
    }
  }

  return sections.join('\n\n');
}

/**
 * Build fallback HTML when AI content generation is unavailable
 */
function buildFallbackHtml(pageDef, business) {
  const name = business?.name || 'Our Business';
  const tagline = business?.tagline || '';
  switch (pageDef.slug) {
    case 'home': return `<h1>Welcome to ${name}</h1>\n<p>${tagline}</p>\n<p>We are dedicated to providing exceptional service.</p>`;
    case 'about': return `<h2>About ${name}</h2>\n<p>Learn more about our story, mission, and team.</p>`;
    case 'services': return `<h2>Our Services</h2>\n<p>Discover what ${name} can do for you.</p>`;
    case 'contact': return `<h2>Contact Us</h2>\n<p>Get in touch with ${name}. We'd love to hear from you.</p>`;
    case 'blog': return `<h2>Blog</h2>\n<p>Stay up to date with the latest news from ${name}.</p>`;
    default: return `<h2>${pageDef.title || pageDef.slug}</h2>\n<p>Welcome to the ${pageDef.title || pageDef.slug} page.</p>`;
  }
}

// Create HTTP server and attach WebSocket handler
const server = createServer(app);
const voiceHandler = new VoiceHandler();

// Initialize WebSocket for voice if enabled
if (config.features?.voiceFlow) {
  voiceHandler.initialize(server);
}

server.listen(PORT, () => {
  // Hourly cleanup of expired sessions
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

  console.log(`\nWordToSite Server v3.0.0`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`\nCore endpoints:`);
  console.log(`  GET  /api/health - Health check`);
  console.log(`  GET  /api/config - Configuration status`);
  console.log(`  GET  /api/skins - Cached skins list`);
  console.log(`  GET  /api/languages - Cached languages list`);
  console.log(`  POST /api/create-site - Create site (no domain)`);
  console.log(`  POST /api/create-site-with-domain - Full domain workflow`);
  console.log(`\nVoice endpoints:`);
  console.log(`  POST /api/voice/transcribe - Transcribe audio file`);
  console.log(`\nOnboarding endpoints:`);
  console.log(`  GET  /api/onboard/flows - Get available flows`);
  console.log(`  POST /api/onboard/analyze-url - Flow A: Analyze existing website`);
  console.log(`  POST /api/onboard/generate-tagline - Generate AI tagline`);
  console.log(`  POST /api/onboard/interview/complete - Flow B: Submit interview`);
  console.log(`  POST /api/onboard/confirm - Confirm and deploy`);
  console.log(`  GET  /api/onboard/confirm/stream - SSE deploy progress`);
  console.log(`\nWizard endpoints:`);
  console.log(`  POST /api/wizard/deploy - Apply deployment context`);
  console.log(`  POST /api/wizard/generate-content - Generate AI content`);
  console.log(`  POST /api/wizard/generate-excerpt - Generate excerpt`);
  console.log(`\nEditor endpoints:`);
  console.log(`  POST /api/editor/test - Test Light Editor capability`);
  console.log(`  POST /api/editor/select - Select editor mode`);
  console.log(`  GET  /api/editor/options - Get editor options`);
  if (config.pluginApi?.enabled !== false) {
    console.log(`\nPlugin API endpoints:`);
    console.log(`  GET  /api/plugin/ping - Connectivity test`);
    console.log(`  POST /api/plugin/register - Site registration`);
    console.log(`  POST /api/plugin/heartbeat - Heartbeat`);
    console.log(`  GET  /api/plugin/config - Pull config`);
    console.log(`  POST /api/plugin/sync/traffic - Push traffic data`);
    console.log(`  GET  /api/plugin/agent/actions - Get pending actions`);
  }
  if (config.proxy?.enabled !== false) {
    console.log(`\nAI Proxy endpoints:`);
    console.log(`  GET  /api/proxy/ping - Connectivity test`);
    console.log(`  POST /api/proxy/admin/register-site - Register site`);
    console.log(`  POST /api/proxy/admin/push-key - Push key to WP site`);
    console.log(`  GET  /api/proxy/admin/sites - List registered sites`);
    console.log(`  POST /api/proxy/v1/chat/completions - AI proxy endpoint`);
    console.log(`  GET  /api/proxy/v1/models - Available models`);
    console.log(`  GET  /api/proxy/v1/usage - Usage stats`);
  }
  if (config.auth?.enabled !== false) {
    console.log(`\nUser Auth endpoints:`);
    console.log(`  POST /api/auth/register - Register new account`);
    console.log(`  POST /api/auth/login - Log in`);
    console.log(`  POST /api/auth/logout - Log out`);
    console.log(`  GET  /api/auth/me - Current user`);
    console.log(`  GET  /api/sites - List user's sites`);
  }
  if (config.features?.voiceFlow) {
    console.log(`\nWebSocket:`);
    console.log(`  WS   /ws/voice - Voice interview handler`);
  }
  console.log(`\n  → App:    http://localhost:${PORT}/app.html`);
  console.log(`  → Health: http://localhost:${PORT}/api/health`);
  console.log(`  → Config: http://localhost:${PORT}/api/config\n`);
});
