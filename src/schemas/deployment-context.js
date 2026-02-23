/**
 * Deployment Context Schema
 * JSON #1: Drives InstaWP template deployment
 *
 * This schema defines the structure for deploying a WordPress site
 * including template selection, plugin configuration, demo content,
 * branding, and enabled features.
 */

import { DEFAULTS, DEFAULT_PAGES } from '../constants.js';

/**
 * Schema definition for Deployment Context
 */
export const DeploymentContextSchema = {
  type: 'object',
  properties: {
    template: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Template identifier (e.g., "flexify")' },
        skin: { type: 'string', description: 'Color scheme identifier' },
        variation: { type: 'string', description: 'Optional template variation' },
      },
      required: ['slug'],
    },
    plugins: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug from WordPress repository' },
          activate: { type: 'boolean', description: 'Whether to activate after installation' },
          config: { type: 'object', description: 'Plugin-specific configuration settings' },
        },
        required: ['slug'],
      },
    },
    demoContent: {
      type: 'object',
      properties: {
        import: { type: 'boolean', description: 'Whether to import demo content' },
        pages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pages to create from demo content',
        },
        contentSlots: {
          type: 'object',
          description: 'Template-specific content mappings',
        },
      },
    },
    branding: {
      type: 'object',
      properties: {
        primaryColor: { type: 'string', description: 'Primary brand color (hex)' },
        secondaryColor: { type: 'string', description: 'Secondary brand color (hex)' },
        logoUrl: { type: 'string', format: 'uri', description: 'URL to logo image' },
        faviconUrl: { type: 'string', format: 'uri', description: 'URL to favicon' },
      },
    },
    features: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of features to enable (e.g., "ai-blog-posts", "contact-form")',
    },
  },
  required: ['template'],
};

/**
 * Create a default deployment context
 * @param {Object} options - Override options
 * @returns {Object} Deployment context object
 */
export function createDeploymentContext(options = {}) {
  return {
    template: {
      slug: options.templateSlug || DEFAULTS.TEMPLATE_SLUG,
      skin: options.skin || 'default',
      variation: options.variation || null,
    },
    plugins: options.plugins || [
      { slug: 'contact-form-7', activate: true, config: {} },
      { slug: 'wordpress-seo', activate: true, config: {} },
    ],
    demoContent: {
      import: options.importDemoContent !== false,
      pages: options.pages || DEFAULT_PAGES,
      contentSlots: options.contentSlots || {},
    },
    branding: {
      primaryColor: options.primaryColor || null,
      secondaryColor: options.secondaryColor || null,
      logoUrl: options.logoUrl || null,
      faviconUrl: options.faviconUrl || DEFAULTS.FAVICON_URL,
    },
    features: options.features || ['contact-form'],
  };
}

/**
 * Validate a deployment context object
 * @param {Object} context - The context to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateDeploymentContext(context) {
  const errors = [];

  if (!context) {
    return { valid: false, errors: ['Deployment context is required'] };
  }

  if (!context.template) {
    errors.push('Template configuration is required');
  } else if (!context.template.slug) {
    errors.push('Template slug is required');
  }

  if (context.branding) {
    if (context.branding.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(context.branding.primaryColor)) {
      errors.push('Primary color must be a valid hex color (e.g., #667eea)');
    }
    if (context.branding.secondaryColor && !/^#[0-9A-Fa-f]{6}$/.test(context.branding.secondaryColor)) {
      errors.push('Secondary color must be a valid hex color');
    }
  }

  if (context.plugins && !Array.isArray(context.plugins)) {
    errors.push('Plugins must be an array');
  }

  if (context.features && !Array.isArray(context.features)) {
    errors.push('Features must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge two deployment contexts (source overrides base)
 * @param {Object} base - Base context
 * @param {Object} source - Source context to merge
 * @returns {Object} Merged context
 */
export function mergeDeploymentContexts(base, source) {
  return {
    template: {
      ...base.template,
      ...source.template,
    },
    plugins: source.plugins || base.plugins,
    demoContent: {
      ...base.demoContent,
      ...source.demoContent,
    },
    branding: {
      ...base.branding,
      ...source.branding,
      // Ensure favicon always has a value
      faviconUrl: source.branding?.faviconUrl || base.branding?.faviconUrl || DEFAULTS.FAVICON_URL,
    },
    features: source.features || base.features,
  };
}

export default {
  DeploymentContextSchema,
  createDeploymentContext,
  validateDeploymentContext,
  mergeDeploymentContexts,
};
