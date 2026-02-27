/**
 * Onboarding Workflow Orchestrator
 * Handles both Flow A (copy website) and Flow B (voice interview)
 */

import FirecrawlService from './services/firecrawl-service.js';
import AIService from './services/ai-service.js';
import VoiceService from './services/voice-service.js';
import BaseSiteService from './services/base-site-service.js';
import { createDeploymentContext, validateDeploymentContext } from './schemas/deployment-context.js';
import { createContentContext, validateContentContext, buildContentContextFromInterview, buildContentContextFromScrape } from './schemas/content-context.js';
import { DEFAULTS, ONBOARDING_FLOWS } from './constants.js';
import { config } from './config.js';

/**
 * Onboarding workflow step identifiers
 */
export const OnboardingSteps = {
  SELECTING_FLOW: 'selecting_flow',
  ANALYZING_SOURCE: 'analyzing_source',
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
    this.firecrawl = new FirecrawlService(options.firecrawlApiKey);
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
      this.templateCatalog = Array.isArray(skins)
        ? skins.map(skin => ({
            slug: skin.slug || skin.name,
            name: skin.name || skin.slug,
            description: skin.description || '',
            industries: skin.industries || [],
            features: skin.features || [],
            style: skin.style || 'modern',
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
   * Execute Flow A: Customer has existing website to copy
   * @param {string} sourceUrl - URL of existing website
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Generated contexts
   */
  async executeFlowA(sourceUrl, options = {}) {
    const result = {
      success: false,
      flow: ONBOARDING_FLOWS.COPY,
      sourceUrl,
      deploymentContext: null,
      contentContext: null,
      templateMatch: null,
      steps: [],
      error: null,
    };

    try {
      // Step 1: Analyze source website
      this.emitProgress(OnboardingSteps.ANALYZING_SOURCE, {
        message: `Analyzing website: ${sourceUrl}`,
      });

      const scraped = await this.firecrawl.scrapeUrl(sourceUrl, {
        formats: ['markdown', 'html'],
      });

      result.steps.push({
        step: 'source_scraped',
        success: true,
        data: {
          url: sourceUrl,
          wordCount: scraped.markdown?.split(/\s+/).length || 0,
          hasScreenshot: !!scraped.screenshot,
        },
      });

      // Extract brand elements
      const brandElements = this.firecrawl.extractBrandElements(scraped);

      // Step 2: Match template
      this.emitProgress(OnboardingSteps.MATCHING_TEMPLATE, {
        message: 'Matching to best template...',
      });

      await this.loadTemplateCatalog();
      const analysis = await this.ai.analyzeWebsite(scraped, this.templateCatalog);
      const templateMatch = await this.ai.matchTemplate(analysis, this.templateCatalog);

      result.templateMatch = templateMatch;
      result.steps.push({
        step: 'template_matched',
        success: true,
        data: templateMatch,
      });

      // Step 3: Generate contexts
      this.emitProgress(OnboardingSteps.GENERATING_CONTEXTS, {
        message: 'Generating deployment and content contexts...',
      });

      const contexts = this.generateContexts(ONBOARDING_FLOWS.COPY, {
        analysis,
        brandElements,
        scraped,
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
        message: 'Analysis complete! Ready for confirmation.',
      });

      result.success = true;
      return result;
    } catch (error) {
      this.emitProgress(OnboardingSteps.ERROR, {
        message: error.message,
        error,
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
        error,
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

    if (flow === ONBOARDING_FLOWS.COPY) {
      // Flow A: Extract from scraped website
      const { brandElements, analysis } = data;

      if (brandElements) {
        context.branding.faviconUrl = brandElements.favicon || DEFAULTS.FAVICON_URL;
        if (brandElements.colors?.length > 0) {
          context.branding.primaryColor = brandElements.colors[0];
          if (brandElements.colors.length > 1) {
            context.branding.secondaryColor = brandElements.colors[1];
          }
        }
        if (brandElements.logo) {
          context.branding.logoUrl = brandElements.logo;
        }
      }

      // Apply template variation if recommended
      if (analysis?.recommendedTemplate?.variation) {
        context.template.variation = analysis.recommendedTemplate.variation;
      }

      // Extract skin preference
      if (analysis?.brandElements?.style) {
        context.template.skin = analysis.brandElements.style;
      }
    } else if (flow === ONBOARDING_FLOWS.VOICE) {
      // Flow B: Extract from interview brief
      const { brief } = data;

      if (brief.brandColors?.length > 0) {
        const colors = brief.brandColors.filter(c => /^#[0-9A-Fa-f]{6}$/.test(c));
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

    if (flow === ONBOARDING_FLOWS.COPY) {
      // Flow A: Build from scraped analysis
      const { scraped, analysis } = data;
      return buildContentContextFromScrape(scraped, analysis);
    } else if (flow === ONBOARDING_FLOWS.VOICE) {
      // Flow B: Build from interview
      const { interviewAnswers, brief } = data;

      const context = buildContentContextFromInterview(interviewAnswers);

      // Enhance with brief data
      if (brief.businessInfo) {
        context.business = {
          ...context.business,
          ...brief.businessInfo,
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

  /**
   * Get available onboarding flows
   * @returns {Object[]} Flow options
   */
  static getFlowOptions() {
    return [
      {
        id: ONBOARDING_FLOWS.COPY,
        label: 'I have an existing website',
        description: 'We\'ll analyze your current site and recreate it with improvements',
        icon: 'copy',
        requiresUrl: true,
      },
      {
        id: ONBOARDING_FLOWS.VOICE,
        label: 'I need to create a new website',
        description: 'Answer a few questions and we\'ll build your perfect site',
        icon: 'microphone',
        requiresUrl: false,
      },
    ];
  }

  /**
   * Get onboarding step info for UI
   * @param {string} flow - Selected flow
   * @returns {Object[]} Step info
   */
  static getStepsInfo(flow) {
    const commonSteps = [
      { id: OnboardingSteps.MATCHING_TEMPLATE, label: 'Finding perfect template', order: 2 },
      { id: OnboardingSteps.GENERATING_CONTEXTS, label: 'Generating configuration', order: 3 },
      { id: OnboardingSteps.CONFIRMING_SELECTION, label: 'Confirming selection', order: 4 },
      { id: OnboardingSteps.COMPLETE, label: 'Complete', order: 5 },
    ];

    if (flow === ONBOARDING_FLOWS.COPY) {
      return [
        { id: OnboardingSteps.ANALYZING_SOURCE, label: 'Analyzing your website', order: 1 },
        ...commonSteps,
      ];
    } else {
      return [
        { id: OnboardingSteps.CONDUCTING_INTERVIEW, label: 'Processing your answers', order: 1 },
        ...commonSteps,
      ];
    }
  }
}

export default OnboardingWorkflow;
