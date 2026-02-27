/**
 * AI Service
 * Multi-provider AI wrapper for content generation and analysis
 * Supports: OpenAI (GPT-4o, gpt-4o-transcribe, Whisper), Google Gemini
 */

import OpenAI from 'openai';
import { config } from '../config.js';
import { DEFAULTS, CONTENT_TONES } from '../constants.js';

class AIService {
  constructor(options = {}) {
    this.openaiApiKey = options.openaiApiKey || config.openai?.apiKey;
    this.geminiApiKey = options.geminiApiKey || config.gemini?.apiKey;

    this.openaiBaseUrl = 'https://api.openai.com/v1';
    this.geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // Initialize OpenAI SDK client if API key is available
    this.openai = this.openaiApiKey
      ? new OpenAI({ apiKey: this.openaiApiKey })
      : null;
  }

  /**
   * Check if OpenAI is configured
   */
  get hasOpenAI() {
    return !!this.openaiApiKey;
  }

  /**
   * Check if Gemini is configured
   */
  get hasGemini() {
    return !!this.geminiApiKey;
  }

  // ==========================================
  // Website Analysis (Gemini - 1M+ token context)
  // ==========================================

  /**
   * Analyze a scraped website and match to templates
   * @param {Object} firecrawlData - Data from Firecrawl
   * @param {Object[]} templateCatalog - Available templates
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeWebsite(firecrawlData, templateCatalog = []) {
    if (!this.hasGemini) {
      console.warn('Gemini not configured, using fallback analysis');
      return this.fallbackWebsiteAnalysis(firecrawlData);
    }

    const prompt = `Analyze this website content and extract structured information for recreating it.

## Website Content (Markdown):
${firecrawlData.markdown?.slice(0, 100000) || 'No content available'}

## Website Metadata:
${JSON.stringify(firecrawlData.metadata || {}, null, 2)}

## Available Templates:
${JSON.stringify(templateCatalog.map(t => ({ slug: t.slug, name: t.name, features: t.features })), null, 2)}

## Instructions:
Analyze the website and return a JSON object with:

1. **businessInfo**: Extract business name, tagline, industry, services, target audience, contact info
2. **brandElements**: Colors (hex), fonts, logo URL, style (modern/classic/minimal/bold)
3. **siteStructure**: List of pages with their purpose and sections
4. **recommendedTemplate**: Best matching template slug from the catalog, with reasoning
5. **contentTone**: One of: professional, friendly, casual, formal
6. **seo**: Extracted meta title, description, keywords

Return ONLY valid JSON, no markdown formatting.`;

    try {
      const result = await this.callGemini(prompt);
      return JSON.parse(result);
    } catch (error) {
      console.error('Website analysis error:', error.message);
      return this.fallbackWebsiteAnalysis(firecrawlData);
    }
  }

  /**
   * Fallback analysis when AI is not available
   */
  fallbackWebsiteAnalysis(firecrawlData) {
    const metadata = firecrawlData.metadata || {};
    return {
      businessInfo: {
        name: metadata.title?.split(/[|\-–]/)[0]?.trim() || 'Business',
        tagline: metadata.description?.slice(0, 100) || '',
        industry: '',
        services: [],
        targetAudience: '',
        contactInfo: {},
      },
      brandElements: {
        colors: [],
        fonts: [],
        logo: metadata.ogImage || null,
        style: 'modern',
      },
      siteStructure: {
        pages: [
          { slug: 'home', title: 'Home', purpose: 'Main landing page' },
        ],
      },
      recommendedTemplate: {
        slug: DEFAULTS.TEMPLATE_SLUG,
        reason: 'Default template (AI analysis unavailable)',
      },
      contentTone: DEFAULTS.TONE,
      seo: {
        title: metadata.title || '',
        description: metadata.description || '',
        keywords: [],
      },
    };
  }

  // ==========================================
  // Content Generation (GPT-4o)
  // ==========================================

  /**
   * Generate website content based on content context
   * @param {Object} contentContext - Content context object
   * @param {Object} templateSlots - Template-specific content slots
   * @returns {Promise<Object>} Generated content
   */
  async generateContent(contentContext, templateSlots = {}) {
    if (!this.hasOpenAI) {
      throw new Error('OpenAI API key is required for content generation');
    }

    const business = contentContext.business || {};
    const tone = contentContext.tone || DEFAULTS.TONE;

    const prompt = `Generate website content for a ${business.industry || 'business'} called "${business.name}".

## Business Information:
- Name: ${business.name}
- Tagline: ${business.tagline || 'Not specified'}
- Industry: ${business.industry || 'Not specified'}
- Services: ${(business.services || []).join(', ') || 'Not specified'}
- Target Audience: ${business.targetAudience || 'General'}
- Unique Selling Points: ${(business.uniqueSellingPoints || []).join(', ') || 'Not specified'}

## Content Requirements:
- Tone: ${tone}
- Language: ${contentContext.language?.primary || DEFAULTS.LANGUAGE}

## Pages to Generate:
${JSON.stringify(contentContext.pages || [], null, 2)}

## Template Slots:
${JSON.stringify(templateSlots, null, 2)}

Generate content for each page section. Return a JSON object with:
{
  "pages": {
    "home": {
      "hero": { "headline": "...", "subheadline": "...", "cta": "..." },
      "features": [{ "title": "...", "description": "..." }]
    },
    "about": { ... },
    ...
  },
  "global": {
    "footer": { ... },
    "navigation": [ ... ]
  }
}

Return ONLY valid JSON.`;

    const response = await this.callOpenAI(prompt, {
      model: 'gpt-4o',
      responseFormat: { type: 'json_object' },
    });

    return JSON.parse(response);
  }

  /**
   * Generate blog post content
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Generated post
   */
  async generateBlogPost(params) {
    const { topic, keywords = [], tone = DEFAULTS.TONE, wordCount = 800 } = params;

    if (!this.hasOpenAI) {
      throw new Error('OpenAI API key is required for blog post generation');
    }

    const prompt = `Write a blog post about: ${topic}

Requirements:
- Tone: ${tone}
- Target word count: ${wordCount}
- Include keywords naturally: ${keywords.join(', ')}

Return a JSON object with:
{
  "title": "Blog post title",
  "content": "Full blog post content in HTML",
  "excerpt": "30-word excerpt for preview",
  "metaDescription": "SEO meta description (max 160 chars)",
  "tags": ["suggested", "tags"]
}`;

    const response = await this.callOpenAI(prompt, {
      model: 'gpt-4o',
      responseFormat: { type: 'json_object' },
    });

    return JSON.parse(response);
  }

  // ==========================================
  // Excerpt Generation
  // ==========================================

  /**
   * Generate an excerpt from content
   * @param {string} content - Full content (HTML or text)
   * @param {number} maxWords - Maximum words
   * @returns {Promise<string>} Generated excerpt
   */
  async generateExcerpt(content, maxWords = DEFAULTS.EXCERPT_WORD_COUNT) {
    if (!this.hasOpenAI) {
      // Fallback to simple truncation
      return this.simpleExcerpt(content, maxWords);
    }

    const prompt = `Create a compelling excerpt from this content in ${maxWords} words or less.
The excerpt should be engaging and summarize the key point.
Do not include any HTML tags.

Content:
${content.slice(0, 5000)}

Return ONLY the excerpt text, no quotes or formatting.`;

    try {
      return await this.callOpenAI(prompt, {
        model: 'gpt-4o-mini',
        maxTokens: 100,
      });
    } catch {
      return this.simpleExcerpt(content, maxWords);
    }
  }

  /**
   * Simple excerpt generation (fallback)
   */
  simpleExcerpt(content, maxWords) {
    // Strip HTML
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text.split(' ');
    const excerpt = words.slice(0, maxWords).join(' ');
    return words.length > maxWords ? excerpt + '...' : excerpt;
  }

  // ==========================================
  // Interview & Voice (GPT-4o + gpt-4o-transcribe / Whisper fallback)
  // ==========================================

  /**
   * Transcribe audio using OpenAI SDK
   * Uses gpt-4o-transcribe for higher quality; falls back to whisper-1 on error.
   * @param {Buffer|Blob} audioBuffer - Audio data
   * @param {string} language - Language code (optional, 'auto' for detection)
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeAudio(audioBuffer, language = 'auto') {
    if (!this.openai) {
      throw new Error('OpenAI API key is required for audio transcription');
    }

    const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });
    const models = ['gpt-4o-transcribe', 'whisper-1'];

    for (const model of models) {
      try {
        const params = { file, model };
        if (language !== 'auto') {
          params.language = language;
        }

        const transcription = await this.openai.audio.transcriptions.create(params);

        return {
          text: transcription.text,
          language: transcription.language,
        };
      } catch (error) {
        if (model !== models[models.length - 1]) {
          console.warn(`${model} transcription failed, trying fallback:`, error.message);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Conduct an interview step (get next question based on context)
   * @param {Object[]} conversationHistory - Previous Q&A
   * @param {Object} context - Interview context
   * @returns {Promise<Object>} Next question and suggestions
   */
  async conductInterview(conversationHistory, context = {}) {
    if (!this.hasOpenAI) {
      throw new Error('OpenAI API key is required for interview');
    }

    const prompt = `You are conducting an interview to gather information for creating a website.

Previous conversation:
${conversationHistory.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}

Based on the conversation so far, determine:
1. What important information is still missing
2. The next most relevant question to ask
3. Follow-up suggestions based on their answers

Return JSON:
{
  "nextQuestion": "The next question to ask",
  "context": "Brief context for why this question matters",
  "suggestions": ["Suggested follow-up 1", "Suggested follow-up 2"],
  "extractedInfo": { "key": "value" },
  "completionPercentage": 50
}`;

    const response = await this.callOpenAI(prompt, {
      model: 'gpt-4o',
      responseFormat: { type: 'json_object' },
    });

    return JSON.parse(response);
  }

  /**
   * Build brief from interview answers
   * @param {Object} interviewAnswers - All interview answers
   * @returns {Promise<Object>} Structured brief
   */
  async buildBriefFromInterview(interviewAnswers) {
    if (!this.hasOpenAI) {
      throw new Error('OpenAI API key required');
    }

    const prompt = `Convert these interview answers into a structured website brief.

Interview Answers:
${JSON.stringify(interviewAnswers, null, 2)}

Return a JSON object with:
{
  "businessInfo": {
    "name": "",
    "tagline": "",
    "industry": "",
    "services": [],
    "targetAudience": "",
    "uniqueSellingPoints": [],
    "location": "",
    "contactInfo": {}
  },
  "websiteGoals": [],
  "preferredStyle": "",
  "contentTone": "professional|friendly|casual|formal",
  "requiredPages": [],
  "inspirationSites": [],
  "brandColors": [],
  "additionalNotes": ""
}`;

    const response = await this.callOpenAI(prompt, {
      model: 'gpt-4o',
      responseFormat: { type: 'json_object' },
    });

    return JSON.parse(response);
  }

  // ==========================================
  // Template Matching (Gemini)
  // ==========================================

  /**
   * Match website analysis to best template
   * @param {Object} analysis - Website analysis
   * @param {Object[]} templates - Available templates with screenshots
   * @returns {Promise<Object>} Best match with reasoning
   */
  async matchTemplate(analysis, templates) {
    if (!this.hasGemini) {
      // Return default template
      return {
        slug: DEFAULTS.TEMPLATE_SLUG,
        confidence: 0.5,
        reason: 'Default template (AI matching unavailable)',
      };
    }

    const prompt = `Based on this website analysis, recommend the best matching template.

## Analysis:
${JSON.stringify(analysis, null, 2)}

## Available Templates:
${JSON.stringify(templates.map(t => ({
  slug: t.slug,
  name: t.name,
  description: t.description,
  industries: t.industries,
  features: t.features,
})), null, 2)}

Return JSON:
{
  "slug": "template-slug",
  "confidence": 0.85,
  "reason": "Why this template is the best match",
  "alternates": [
    { "slug": "other-template", "reason": "Why this could also work" }
  ]
}`;

    const response = await this.callGemini(prompt);
    return JSON.parse(response);
  }

  // ==========================================
  // Chat (multi-turn conversation)
  // ==========================================

  /**
   * Send a multi-turn conversation to OpenAI chat completions
   * @param {Object[]} messages - Array of {role, content} messages
   * @param {Object} options - Model options
   * @returns {Promise<{content: string, usage: Object}>}
   */
  async chat(messages, options = {}) {
    if (!this.hasOpenAI) {
      throw new Error('OpenAI API key is required for chat');
    }

    const {
      model = 'gpt-4o',
      maxTokens = 4096,
      temperature = 0.7,
    } = options;

    const body = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage || null,
    };
  }

  // ==========================================
  // API Calls
  // ==========================================

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt, options = {}) {
    const {
      model = 'gpt-4o',
      maxTokens = 4096,
      temperature = 0.7,
      responseFormat,
    } = options;

    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    };

    if (responseFormat) {
      body.response_format = responseFormat;
    }

    const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Call Gemini API
   */
  async callGemini(prompt, options = {}) {
    const {
      model = 'gemini-1.5-pro',
      maxTokens = 8192,
    } = options;

    const response = await fetch(
      `${this.geminiBaseUrl}/models/${model}:generateContent?key=${this.geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Gemini request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}

export default AIService;
