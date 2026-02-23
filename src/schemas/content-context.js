/**
 * Content Context Schema
 * JSON #2: Drives AI text generation
 *
 * This schema defines the structure for generating website content
 * including business information, language settings, tone, pages,
 * and SEO metadata.
 */

import { DEFAULTS, CONTENT_TONES, SUPPORTED_LANGUAGES } from '../constants.js';

/**
 * Schema definition for Content Context
 */
export const ContentContextSchema = {
  type: 'object',
  properties: {
    business: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Business name' },
        tagline: { type: 'string', description: 'Business tagline or slogan' },
        industry: { type: 'string', description: 'Industry or sector' },
        services: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of services offered',
        },
        targetAudience: { type: 'string', description: 'Description of target audience' },
        uniqueSellingPoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key differentiators and USPs',
        },
        location: { type: 'string', description: 'Business location' },
        contactInfo: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
            address: { type: 'string' },
          },
        },
      },
      required: ['name'],
    },
    language: {
      type: 'object',
      properties: {
        primary: {
          type: 'string',
          description: 'Primary language (ISO 639-1 code)',
          enum: Object.keys(SUPPORTED_LANGUAGES),
        },
        additional: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional languages',
        },
      },
    },
    tone: {
      type: 'string',
      enum: Object.values(CONTENT_TONES),
      description: 'Content tone for AI generation',
    },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Page URL slug' },
          title: { type: 'string', description: 'Page title' },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', description: 'Section type (hero, features, etc.)' },
                content: { type: 'object', description: 'Section-specific content' },
              },
            },
          },
        },
        required: ['slug', 'title'],
      },
    },
    sourceAnalysis: {
      type: 'object',
      description: 'Flow A: Data extracted from scraped website',
      properties: {
        extractedContent: { type: 'object' },
        brandElements: { type: 'object' },
        structure: { type: 'object' },
      },
    },
    voiceInterview: {
      type: 'object',
      description: 'Flow B: Q&A transcript from voice interview',
      properties: {
        transcript: { type: 'array' },
        summary: { type: 'string' },
        extractedInfo: { type: 'object' },
      },
    },
    seo: {
      type: 'object',
      properties: {
        metaTitle: { type: 'string', maxLength: 60 },
        metaDescription: { type: 'string', maxLength: 160 },
        keywords: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
  required: ['business'],
};

/**
 * Create a default content context
 * @param {Object} options - Override options
 * @returns {Object} Content context object
 */
export function createContentContext(options = {}) {
  return {
    business: {
      name: options.businessName || '',
      tagline: options.tagline || '',
      industry: options.industry || '',
      services: options.services || [],
      targetAudience: options.targetAudience || '',
      uniqueSellingPoints: options.uniqueSellingPoints || [],
      location: options.location || '',
      contactInfo: {
        phone: options.phone || '',
        email: options.email || '',
        address: options.address || '',
      },
    },
    language: {
      primary: options.language || DEFAULTS.LANGUAGE,
      additional: options.additionalLanguages || [],
    },
    tone: options.tone || DEFAULTS.TONE,
    pages: options.pages || [
      { slug: 'home', title: 'Home', sections: [{ type: 'hero' }, { type: 'features' }] },
      { slug: 'about', title: 'About Us', sections: [{ type: 'about' }, { type: 'team' }] },
      { slug: 'services', title: 'Services', sections: [{ type: 'services' }] },
      { slug: 'contact', title: 'Contact', sections: [{ type: 'contact' }] },
    ],
    sourceAnalysis: options.sourceAnalysis || null,
    voiceInterview: options.voiceInterview || null,
    seo: {
      metaTitle: options.metaTitle || '',
      metaDescription: options.metaDescription || '',
      keywords: options.keywords || [],
    },
  };
}

/**
 * Validate a content context object
 * @param {Object} context - The context to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateContentContext(context) {
  const errors = [];

  if (!context) {
    return { valid: false, errors: ['Content context is required'] };
  }

  if (!context.business) {
    errors.push('Business information is required');
  } else if (!context.business.name) {
    errors.push('Business name is required');
  }

  if (context.language) {
    if (context.language.primary && !SUPPORTED_LANGUAGES[context.language.primary]) {
      errors.push(`Unsupported language: ${context.language.primary}`);
    }
  }

  if (context.tone && !Object.values(CONTENT_TONES).includes(context.tone)) {
    errors.push(`Invalid tone: ${context.tone}. Must be one of: ${Object.values(CONTENT_TONES).join(', ')}`);
  }

  if (context.seo) {
    if (context.seo.metaTitle && context.seo.metaTitle.length > 60) {
      errors.push('SEO meta title should be 60 characters or less');
    }
    if (context.seo.metaDescription && context.seo.metaDescription.length > 160) {
      errors.push('SEO meta description should be 160 characters or less');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build content context from interview answers
 * @param {Object} answers - Interview answers keyed by question ID
 * @returns {Object} Content context
 */
export function buildContentContextFromInterview(answers) {
  const context = createContentContext();

  // Map new field IDs to content context
  if (answers.companyName) {
    context.business.name = answers.companyName;
  } else if (answers.business) {
    context.business.name = extractBusinessName(answers.business);
  }

  if (answers.industry) {
    context.business.industry = answers.industry;
  } else if (answers.business) {
    context.business.industry = extractIndustry(answers.business);
  }

  if (answers.services) {
    context.business.services = answers.services.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  if (answers.aboutUs) {
    context.business.targetAudience = answers.aboutUs;
  } else if (answers.customers) {
    context.business.targetAudience = answers.customers;
  }

  if (answers.advantages) {
    context.business.uniqueSellingPoints = answers.advantages.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  // Contact info
  if (answers.email) context.business.contactInfo.email = answers.email;
  if (answers.phone) context.business.contactInfo.phone = answers.phone;
  if (answers.address) {
    context.business.contactInfo.address = answers.address;
    context.business.location = answers.address;
  }

  // Team info
  if (answers.team) {
    context.business.team = answers.team;
  }

  // Legacy field support
  if (answers.brand) {
    const brandInfo = parseBrandInfo(answers.brand);
    if (brandInfo.name && !answers.companyName) context.business.name = brandInfo.name;
    if (brandInfo.tagline) context.business.tagline = brandInfo.tagline;
  }

  if (answers.pages) {
    context.pages = parsePageList(answers.pages);
  }

  // Store the full interview for reference
  context.voiceInterview = {
    transcript: Object.entries(answers).map(([id, answer]) => ({
      questionId: id,
      answer,
    })),
    summary: generateInterviewSummary(answers),
    extractedInfo: answers,
  };

  return context;
}

/**
 * Build content context from scraped website data
 * @param {Object} scrapedData - Data from Firecrawl
 * @param {Object} analysis - AI analysis of the website
 * @returns {Object} Content context
 */
export function buildContentContextFromScrape(scrapedData, analysis) {
  const context = createContentContext();

  // Extract business info from analysis
  if (analysis.businessInfo) {
    context.business = {
      ...context.business,
      ...analysis.businessInfo,
    };
  }

  // Extract pages from site structure
  if (analysis.siteStructure?.pages) {
    context.pages = analysis.siteStructure.pages.map(page => ({
      slug: page.slug || page.path?.replace(/^\//, '') || 'page',
      title: page.title || page.name,
      sections: page.sections || [],
    }));
  }

  // Store source analysis
  context.sourceAnalysis = {
    extractedContent: scrapedData.content || {},
    brandElements: analysis.brandElements || {},
    structure: analysis.siteStructure || {},
  };

  // Generate SEO from analysis
  if (analysis.seo) {
    context.seo = {
      metaTitle: analysis.seo.title || context.business.name,
      metaDescription: analysis.seo.description || '',
      keywords: analysis.seo.keywords || [],
    };
  }

  return context;
}

// Helper functions
function extractBusinessName(text) {
  // Simple extraction - in production, use NLP
  const words = text.split(' ').slice(0, 3);
  return words.join(' ');
}

function extractIndustry(text) {
  const industries = ['technology', 'healthcare', 'finance', 'retail', 'education', 'consulting'];
  const lower = text.toLowerCase();
  return industries.find(i => lower.includes(i)) || '';
}

function parseBrandInfo(text) {
  const parts = text.split(/[,\-:]/).map(s => s.trim());
  return {
    name: parts[0] || '',
    tagline: parts[1] || '',
  };
}

function parsePageList(text) {
  const defaultSections = {
    home: [{ type: 'hero' }, { type: 'features' }],
    about: [{ type: 'about' }],
    services: [{ type: 'services' }],
    contact: [{ type: 'contact' }],
    blog: [{ type: 'blog' }],
  };

  const pages = text.toLowerCase().split(/[,\s]+/).filter(Boolean);
  return pages.map(page => ({
    slug: page,
    title: page.charAt(0).toUpperCase() + page.slice(1),
    sections: defaultSections[page] || [],
  }));
}

function generateInterviewSummary(answers) {
  const parts = [];
  if (answers.companyName) parts.push(`Company: ${answers.companyName}`);
  if (answers.industry) parts.push(`Industry: ${answers.industry}`);
  if (answers.services) parts.push(`Services: ${answers.services}`);
  if (answers.aboutUs) parts.push(`About: ${answers.aboutUs}`);
  // Legacy fields
  if (answers.business) parts.push(`Business: ${answers.business}`);
  if (answers.customers) parts.push(`Target audience: ${answers.customers}`);
  if (answers.goal) parts.push(`Website goal: ${answers.goal}`);
  return parts.join('. ');
}

export default {
  ContentContextSchema,
  createContentContext,
  validateContentContext,
  buildContentContextFromInterview,
  buildContentContextFromScrape,
};
