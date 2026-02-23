/**
 * WP Plugin Wizard Payload Schema
 * Unified JSON sent to the WordPress WAAS Controller plugin after site creation.
 * Merges all onboarding data (client info, industry, preferences, content, branding)
 * into a single payload the WP plugin can consume to fully configure the site.
 *
 * TODO: Wire this into the deploy pipeline after site is created and reachable.
 */

/**
 * Build the wizard payload from deployment + content contexts and site info.
 *
 * @param {Object} params
 * @param {Object} params.site           - Created InstaWP site data
 * @param {Object} params.deploymentContext - Deployment context (template, branding, plugins)
 * @param {Object} params.contentContext   - Content context (business, pages, SEO, tone)
 * @param {Object} [params.interviewAnswers] - Raw interview answers (Flow B)
 * @param {Object} [params.sourceAnalysis]   - Scraped site analysis (Flow A)
 * @returns {Object} WP wizard payload
 */
export function buildWizardPayload({
  site,
  deploymentContext,
  contentContext,
  interviewAnswers,
  sourceAnalysis,
}) {
  const dc = deploymentContext || {};
  const cc = contentContext || {};
  const business = cc.business || {};

  return {
    // ── Meta ──────────────────────────────────────────────
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    flow: cc.sourceAnalysis ? 'copy' : 'voice',

    // ── Site ─────────────────────────────────────────────
    site: {
      id: site?.id || null,
      url: site?.wp_url || site?.url || '',
      adminUrl: site?.wp_admin_url || '',
      magicLoginUrl: site?.magic_login_url || '',
    },

    // ── Client / Business ────────────────────────────────
    client: {
      companyName: business.name || '',
      tagline: business.tagline || '',
      industry: business.industry || '',
      services: business.services || [],
      targetAudience: business.targetAudience || '',
      uniqueSellingPoints: business.uniqueSellingPoints || [],
      location: business.location || '',
      team: business.team || null,
      contact: {
        email: business.contactInfo?.email || '',
        phone: business.contactInfo?.phone || '',
        address: business.contactInfo?.address || '',
      },
    },

    // ── Branding & Design ────────────────────────────────
    branding: {
      logoUrl: dc.branding?.logoUrl || null,
      faviconUrl: dc.branding?.faviconUrl || null,
      primaryColor: dc.branding?.primaryColor || null,
      secondaryColor: dc.branding?.secondaryColor || null,
      siteTitle: business.name || '',
      tagline: business.tagline || '',
    },

    // ── Template & Theme ─────────────────────────────────
    template: {
      slug: dc.template?.slug || 'flexify',
      skin: dc.template?.skin || 'default',
      variation: dc.template?.variation || null,
    },

    // ── Content ──────────────────────────────────────────
    content: {
      language: cc.language?.primary || 'en',
      additionalLanguages: cc.language?.additional || [],
      tone: cc.tone || 'professional',
      pages: (cc.pages || []).map(p => ({
        slug: p.slug,
        title: p.title,
        sections: p.sections || [],
      })),
    },

    // ── SEO ──────────────────────────────────────────────
    seo: {
      metaTitle: cc.seo?.metaTitle || business.name || '',
      metaDescription: cc.seo?.metaDescription || '',
      keywords: cc.seo?.keywords || [],
    },

    // ── Plugins ──────────────────────────────────────────
    plugins: (dc.plugins || []).map(p => ({
      slug: p.slug,
      activate: p.activate !== false,
      config: p.config || {},
    })),

    // ── Features ─────────────────────────────────────────
    features: dc.features || [],

    // ── Demo Content ─────────────────────────────────────
    demoContent: {
      import: dc.demoContent?.import !== false,
      pages: dc.demoContent?.pages || [],
      contentSlots: dc.demoContent?.contentSlots || {},
    },

    // ── Source Data (for debugging / re-generation) ──────
    _source: {
      interviewAnswers: interviewAnswers || null,
      sourceAnalysis: sourceAnalysis || null,
      voiceInterview: cc.voiceInterview || null,
    },
  };
}

/**
 * Example payload for reference / testing.
 * This is what a fully-populated wizard payload looks like.
 */
export const EXAMPLE_PAYLOAD = {
  version: '1.0.0',
  generatedAt: '2026-02-11T12:00:00.000Z',
  flow: 'voice',

  site: {
    id: 2333884,
    url: 'https://sparky.instawp.site',
    adminUrl: 'https://sparky.instawp.site/wp-admin',
    magicLoginUrl: '/api/wp-auto-login?url=...&u=...&p=...',
  },

  client: {
    companyName: 'Sparky',
    tagline: 'Electrifying digital solutions',
    industry: 'Technology',
    services: ['Web Development', 'AI Integration', 'Cloud Hosting'],
    targetAudience: 'Small businesses looking to modernize their online presence',
    uniqueSellingPoints: ['AI-powered automation', '24/7 support', 'No-code management'],
    location: 'San Francisco, CA',
    team: '5 engineers, 2 designers',
    contact: {
      email: 'hello@sparky.io',
      phone: '+1-555-0123',
      address: '123 Market St, San Francisco, CA 94105',
    },
  },

  branding: {
    logoUrl: 'https://example.com/logo.png',
    faviconUrl: 'https://example.com/favicon.ico',
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
    siteTitle: 'Sparky',
    tagline: 'Electrifying digital solutions',
  },

  template: {
    slug: 'flexify',
    skin: 'modern',
    variation: null,
  },

  content: {
    language: 'en',
    additionalLanguages: [],
    tone: 'professional',
    pages: [
      { slug: 'home', title: 'Home', sections: [{ type: 'hero' }, { type: 'features' }] },
      { slug: 'about', title: 'About Us', sections: [{ type: 'about' }, { type: 'team' }] },
      { slug: 'services', title: 'Services', sections: [{ type: 'services' }] },
      { slug: 'contact', title: 'Contact', sections: [{ type: 'contact' }] },
    ],
  },

  seo: {
    metaTitle: 'Sparky — Electrifying Digital Solutions',
    metaDescription: 'Sparky helps small businesses modernize with AI-powered websites, cloud hosting, and 24/7 support.',
    keywords: ['web development', 'AI websites', 'small business', 'cloud hosting'],
  },

  plugins: [
    { slug: 'contact-form-7', activate: true, config: {} },
    { slug: 'wordpress-seo', activate: true, config: {} },
  ],

  features: ['contact-form', 'ai-blog-posts', 'seo', 'analytics'],

  demoContent: {
    import: true,
    pages: ['home', 'about', 'services', 'contact', 'blog'],
    contentSlots: {},
  },

  _source: {
    interviewAnswers: {
      email: 'hello@sparky.io',
      companyName: 'Sparky',
      industry: 'Technology',
      services: 'Web Development, AI Integration, Cloud Hosting',
      aboutUs: 'We help small businesses modernize their online presence with AI-powered tools',
      address: '123 Market St, San Francisco, CA 94105',
      phone: '+1-555-0123',
      team: '5 engineers, 2 designers',
      advantages: 'AI-powered automation, 24/7 support, No-code management',
    },
    sourceAnalysis: null,
    voiceInterview: null,
  },
};

export default { buildWizardPayload, EXAMPLE_PAYLOAD };
