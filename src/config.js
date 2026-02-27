import dotenv from 'dotenv';

dotenv.config({ path: new URL('.env', import.meta.url) });

export const config = {
  // InstaWP Configuration
  instawp: {
    apiUrl: process.env.INSTAWP_API_URL || 'https://app.instawp.io/api/v2',
    apiUrlV1: process.env.INSTAWP_API_URL_V1 || 'https://app.instawp.io/api/v1',
    apiKey: process.env.INSTA_WP_API_KEY,
    templateSlug: process.env.TEMPLATE_SLUG || 'flexify',
  },

  // OpenAI Configuration (GPT-4o, Whisper)
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Google Gemini Configuration (Visual analysis, 1M+ token context)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },

  // Firecrawl Configuration (Website scraping)
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY,
  },

  // Feature Flags
  features: {
    voiceFlow: process.env.ENABLE_VOICE_FLOW === 'true',
    lightEditor: process.env.ENABLE_LIGHT_EDITOR === 'true',
    aiContent: process.env.ENABLE_AI_CONTENT !== 'false', // Enabled by default
  },

  // Namecheap Configuration (for domain registration)
  namecheap: {
    apiUrl: process.env.NAMECHEAP_SANDBOX === 'true'
      ? 'https://api.sandbox.namecheap.com/xml.response'
      : 'https://api.namecheap.com/xml.response',
    apiKey: process.env.NAMECHEAP_API_KEY,
    username: process.env.NAMECHEAP_USERNAME,
    clientIp: process.env.NAMECHEAP_CLIENT_IP,
    sandbox: process.env.NAMECHEAP_SANDBOX === 'true',
  },

  // Cloudflare Configuration (for DNS management)
  cloudflare: {
    apiKey: process.env.CLOUDFLARE_API_KEY,
    email: process.env.CLOUDFLARE_EMAIL,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  },

  // Default Domain Contact Information (for registration)
  domain: {
    defaultContacts: {
      firstName: process.env.DOMAIN_CONTACT_FIRST_NAME || '',
      lastName: process.env.DOMAIN_CONTACT_LAST_NAME || '',
      address1: process.env.DOMAIN_CONTACT_ADDRESS || '',
      city: process.env.DOMAIN_CONTACT_CITY || '',
      stateProvince: process.env.DOMAIN_CONTACT_STATE || '',
      postalCode: process.env.DOMAIN_CONTACT_POSTAL_CODE || '',
      country: process.env.DOMAIN_CONTACT_COUNTRY || 'US',
      phone: process.env.DOMAIN_CONTACT_PHONE || '',
      email: process.env.DOMAIN_CONTACT_EMAIL || '',
    },
  },

  // AI Proxy Configuration (centralized AI access for deployed sites)
  proxy: {
    enabled: process.env.ENABLE_AI_PROXY !== 'false',
    adminSecret: process.env.PROXY_ADMIN_SECRET || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  // Plugin API Configuration (hub-and-spoke)
  pluginApi: {
    enabled: process.env.ENABLE_PLUGIN_API !== 'false',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/wordtosite',
    maxBatchSize: parseInt(process.env.PLUGIN_API_MAX_BATCH) || 500,
  },

  // User Auth Configuration
  auth: {
    enabled: process.env.ENABLE_USER_AUTH !== 'false',
    sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE) || 7 * 24 * 60 * 60 * 1000,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  },

  // Base Site Configuration (TRXWaaSWizard plugin)
  baseSite: {
    url: process.env.BASE_SITE_URL || 'https://flexify.instawp.dev',
    username: process.env.BASE_SITE_USERNAME || 'lojowaguse1434',
    appPassword: process.env.BASE_SITE_APP_PASSWORD || 'Q21m ygZS BmTp TQMG tlGq bOyi',
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3000,
  },
};

// Validate required configuration for basic site creation
export function validateConfig(apiKey = null) {
  const errors = [];

  const keyToCheck = apiKey || config.instawp.apiKey;

  if (!keyToCheck) {
    errors.push('InstaWP API Key is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return true;
}

// Validate configuration for domain workflow
export function validateDomainConfig(registerNewDomain = false) {
  const errors = [];

  // Cloudflare is always required for DNS management
  if (!config.cloudflare.apiKey) {
    errors.push('CLOUDFLARE_API_KEY is required for domain configuration');
  }
  if (!config.cloudflare.email) {
    errors.push('CLOUDFLARE_EMAIL is required for domain configuration');
  }
  if (!config.cloudflare.accountId) {
    errors.push('CLOUDFLARE_ACCOUNT_ID is required for domain configuration');
  }

  // Namecheap only required if registering a new domain
  if (registerNewDomain) {
    if (!config.namecheap.apiKey) {
      errors.push('NAMECHEAP_API_KEY is required for domain registration');
    }
    if (!config.namecheap.username) {
      errors.push('NAMECHEAP_USERNAME is required for domain registration');
    }
    if (!config.namecheap.clientIp) {
      errors.push('NAMECHEAP_CLIENT_IP is required for domain registration');
    }

    // Check contact info for registration
    const contacts = config.domain.defaultContacts;
    if (!contacts.firstName || !contacts.lastName || !contacts.email || !contacts.phone) {
      errors.push('Domain contact information (DOMAIN_CONTACT_*) is required for registration');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Domain configuration validation failed:\n${errors.join('\n')}`);
  }

  return true;
}
