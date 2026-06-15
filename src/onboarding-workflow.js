/**
 * Onboarding Workflow Orchestrator
 * Handles both Flow A (copy website) and Flow B (voice interview)
 */

import { colord } from 'colord';
import AIService from './services/ai-service';
import VoiceService from './services/voice-service';
import BaseSiteService from './services/base-site-service';
import { createDeploymentContext, validateDeploymentContext } from './schemas/deployment-context';
import { createContentContext, validateContentContext, buildContentContextFromInterview } from './schemas/content-context';
import { DEFAULTS, ONBOARDING_FLOWS } from './constants';
import { config } from './config';

function toHexColor(value) {
  const color = colord(value);
  return color.isValid() ? color.toHex() : null;
}

/**
 * Onboarding workflow step identifiers
 */
export const OnboardingSteps = {
  CONDUCTING_INTERVIEW: 'conducting_interview',
  MATCHING_TEMPLATE: 'matching_template',
  GENERATING_CONTEXTS: 'generating_contexts',
  CONFIRMING_SELECTION: 'confirming_selection',
  COMPLETE: 'complete',
  ERROR: 'error',
};

/**
 * Fallback template catalog used when the base site API is unavailable
 */
const FALLBACK_TEMPLATE_CATALOG = [
  {
    slug: 'flexify',
    name: 'Flexify',
    description: 'Modern business theme with flexible layouts',
    industries: ['business', 'agency', 'consulting', 'technology'],
    features: ['portfolio', 'team', 'services', 'blog', 'contact-form'],
    style: 'modern',
  },
];

class OnboardingWorkflow {
  constructor(options = {}) {
    this.ai = new AIService({
      openaiApiKey: options.openaiApiKey,
      geminiApiKey: options.geminiApiKey,
    });
    this.voice = new VoiceService({ aiService: this.ai });
    this.baseSite = new BaseSiteService();

    this.onProgress = options.onProgress || (() => {});
    this.templateCatalog = options.templateCatalog || null;
  }

  /**
   * Load template catalog from the base site API (cached).
   * Falls back to a hardcoded catalog if the API is unavailable.
   * @returns {Promise<Object[]>}
   */
  async loadTemplateCatalog() {
    if (this.templateCatalog) {
      return this.templateCatalog;
    }

    try {
      const skins = await this.baseSite.getSkins();
      this.templateCatalog = Array.isArray(skins) && skins.length > 0
        ? skins.map(skin => ({
            slug: skin.slug,
            name: skin.title || skin.slug,
            description: skin.keywords || '',
            industries: skin.category ? [skin.category] : [],
            features: [],
            style: 'modern',
            ...skin,
          }))
        : FALLBACK_TEMPLATE_CATALOG;
    } catch (error) {
      console.warn('Failed to load skins from base site, using fallback catalog:', error.message);
      this.templateCatalog = FALLBACK_TEMPLATE_CATALOG;
    }

    return this.templateCatalog;
  }

  /**
   * Emit progress update
   * @param {string} step - Current step
   * @param {Object} data - Additional data
   */
  emitProgress(step, data = {}) {
    this.onProgress({
      step,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Execute Flow B: Customer needs new website (voice interview)
   * @param {Object} interviewAnswers - Answers from voice interview
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Generated contexts
   */
  async executeFlowB(interviewAnswers, options = {}) {
    const result = {
      success: false,
      flow: ONBOARDING_FLOWS.VOICE,
      interviewAnswers,
      deploymentContext: null,
      contentContext: null,
      templateMatch: null,
      steps: [],
      error: null,
    };

    try {
      // Step 1: Process interview
      this.emitProgress(OnboardingSteps.CONDUCTING_INTERVIEW, {
        message: 'Processing interview responses...',
      });

      const processedInterview = await this.voice.processInterview(
        Object.entries(interviewAnswers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
        options.language || DEFAULTS.LANGUAGE
      );

      result.steps.push({
        step: 'interview_processed',
        success: true,
        data: {
          questionsAnswered: Object.keys(interviewAnswers).length,
        },
      });

      // Step 2: Match template based on brief
      this.emitProgress(OnboardingSteps.MATCHING_TEMPLATE, {
        message: 'Finding the perfect template...',
      });

      await this.loadTemplateCatalog();
      const brief = processedInterview.brief;
      const templateMatch = await this.matchTemplateFromBrief(brief);

      result.templateMatch = templateMatch;
      result.steps.push({
        step: 'template_matched',
        success: true,
        data: templateMatch,
      });

      // Step 3: Generate contexts
      this.emitProgress(OnboardingSteps.GENERATING_CONTEXTS, {
        message: 'Creating your website configuration...',
      });

      const contexts = this.generateContexts(ONBOARDING_FLOWS.VOICE, {
        brief,
        interviewAnswers,
        templateMatch,
        options,
      });

      result.deploymentContext = contexts.deploymentContext;
      result.contentContext = contexts.contentContext;
      result.steps.push({
        step: 'contexts_generated',
        success: true,
      });

      // Validate contexts
      const deploymentValidation = validateDeploymentContext(result.deploymentContext);
      const contentValidation = validateContentContext(result.contentContext);

      if (!deploymentValidation.valid || !contentValidation.valid) {
        throw new Error([
          ...deploymentValidation.errors,
          ...contentValidation.errors,
        ].join(', '));
      }

      // Complete
      this.emitProgress(OnboardingSteps.COMPLETE, {
        message: 'Configuration ready! Please review and confirm.',
      });

      result.success = true;
      return result;
    } catch (error) {
      this.emitProgress(OnboardingSteps.ERROR, {
        message: error.message,
      });

      result.error = error.message;
      result.errorDetails = {
        message: error.message,
        stack: error.stack,
        failedAtStep: result.steps[result.steps.length - 1]?.step || 'unknown',
      };

      return result;
    }
  }

  /**
   * Generate both deployment and content contexts
   * @param {string} flow - Flow type ('copy' or 'voice')
   * @param {Object} data - Data from flow execution
   * @returns {Object} Both contexts
   */
  generateContexts(flow, data) {
    const deploymentContext = this.buildDeploymentContext(flow, data);
    const contentContext = this.buildContentContext(flow, data);

    return {
      deploymentContext,
      contentContext,
    };
  }

  /**
   * Build deployment context from flow data
   * @param {string} flow - Flow type
   * @param {Object} data - Flow data
   * @returns {Object} Deployment context
   */
  buildDeploymentContext(flow, data) {
    const { templateMatch, options = {} } = data;

    // Base context with defaults
    const context = createDeploymentContext({
      templateSlug: templateMatch?.slug || DEFAULTS.TEMPLATE_SLUG,
    });

    if (flow === ONBOARDING_FLOWS.VOICE) {
      // Extract from interview brief
      const { brief } = data;

      if (brief.brandColors?.length > 0) {
        const colors = brief.brandColors.map(toHexColor).filter(Boolean);
        if (colors.length > 0) {
          context.branding.primaryColor = colors[0];
          if (colors.length > 1) {
            context.branding.secondaryColor = colors[1];
          }
        }
      }

      // Map preferred style to skin
      if (brief.preferredStyle) {
        context.template.skin = brief.preferredStyle;
      }
    }

    // Apply any option overrides
    if (options.faviconUrl) {
      context.branding.faviconUrl = options.faviconUrl;
    }

    // Ensure favicon has default
    if (!context.branding.faviconUrl) {
      context.branding.faviconUrl = DEFAULTS.FAVICON_URL;
    }

    return context;
  }

  /**
   * Build content context from flow data
   * @param {string} flow - Flow type
   * @param {Object} data - Flow data
   * @returns {Object} Content context
   */
  buildContentContext(flow, data) {
    const { options = {} } = data;

    if (flow === ONBOARDING_FLOWS.VOICE) {
      // Build from interview
      const { interviewAnswers, brief } = data;

      const context = buildContentContextFromInterview(interviewAnswers);

      // Enhance with brief data
      if (brief.businessInfo) {
        const { contactInfo: briefContact, ...rest } = brief.businessInfo;
        context.business = {
          ...context.business,
          ...rest,
          contactInfo: { ...context.business.contactInfo, ...(briefContact || {}) },
        };
      }

      if (brief.contentTone) {
        context.tone = brief.contentTone;
      }

      if (brief.requiredPages) {
        context.pages = brief.requiredPages.map(slug => ({
          slug,
          title: slug.charAt(0).toUpperCase() + slug.slice(1),
          sections: [],
        }));
      }

      return context;
    }

    // Fallback to default context
    return createContentContext();
  }

  /**
   * Match template based on interview brief
   * @param {Object} brief - Interview brief
   * @returns {Promise<Object>} Template match
   */
  async matchTemplateFromBrief(brief) {
    // Try AI matching first
    if (this.ai.hasGemini || this.ai.hasOpenAI) {
      try {
        return await this.ai.matchTemplate(
          {
            businessInfo: brief.businessInfo,
            preferredStyle: brief.preferredStyle,
            websiteGoals: brief.websiteGoals,
          },
          this.templateCatalog
        );
      } catch (error) {
        console.warn('AI template matching failed:', error.message);
      }
    }

    // Fallback: Simple keyword matching
    const industry = brief.businessInfo?.industry?.toLowerCase() || '';
    const matchedTemplate = this.templateCatalog.find(t =>
      t.industries.some(i => industry.includes(i))
    );

    return {
      slug: matchedTemplate?.slug || DEFAULTS.TEMPLATE_SLUG,
      confidence: matchedTemplate ? 0.6 : 0.3,
      reason: matchedTemplate
        ? `Matched based on industry: ${industry}`
        : 'Default template (no industry match)',
    };
  }

}

export default OnboardingWorkflow;
