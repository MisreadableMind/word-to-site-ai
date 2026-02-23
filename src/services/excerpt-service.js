/**
 * Excerpt Service
 * Handles excerpt generation for posts and pages
 */

import AIService from './ai-service.js';
import { DEFAULTS } from '../constants.js';

class ExcerptService {
  constructor(options = {}) {
    this.aiService = options.aiService || new AIService();
    this.defaultMaxWords = options.maxWords || DEFAULTS.EXCERPT_WORD_COUNT;
  }

  /**
   * Generate an excerpt from content
   * @param {string} content - Full content (HTML or plain text)
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated excerpt
   */
  async generateExcerpt(content, options = {}) {
    const {
      maxWords = this.defaultMaxWords,
      style = 'informative',
      includeEllipsis = true,
    } = options;

    if (!content || content.trim().length === 0) {
      return '';
    }

    // Try AI-powered generation first
    if (this.aiService.hasOpenAI) {
      try {
        const excerpt = await this.aiGenerateExcerpt(content, maxWords, style);
        return this.formatExcerpt(excerpt, maxWords, includeEllipsis);
      } catch (error) {
        console.warn('AI excerpt generation failed, using fallback:', error.message);
      }
    }

    // Fallback to smart truncation
    return this.smartTruncate(content, maxWords, includeEllipsis);
  }

  /**
   * AI-powered excerpt generation
   * @param {string} content - Full content
   * @param {number} maxWords - Maximum words
   * @param {string} style - Excerpt style
   * @returns {Promise<string>} Generated excerpt
   */
  async aiGenerateExcerpt(content, maxWords, style) {
    const styleInstructions = {
      informative: 'Summarize the main point clearly and informatively.',
      engaging: 'Make it attention-grabbing and encourage reading more.',
      professional: 'Keep it formal and business-appropriate.',
      casual: 'Use a friendly, conversational tone.',
    };

    const instruction = styleInstructions[style] || styleInstructions.informative;

    const prompt = `Create a compelling excerpt from this content.

Requirements:
- Maximum ${maxWords} words
- ${instruction}
- No HTML tags
- Should entice the reader to read more
- Capture the essence of the content

Content:
${this.stripHtml(content).slice(0, 5000)}

Return ONLY the excerpt text, nothing else.`;

    return await this.aiService.callOpenAI(prompt, {
      model: 'gpt-4o-mini',
      maxTokens: 100,
      temperature: 0.5,
    });
  }

  /**
   * Smart truncation fallback
   * @param {string} content - Content to truncate
   * @param {number} maxWords - Maximum words
   * @param {boolean} includeEllipsis - Add ellipsis if truncated
   * @returns {string} Truncated excerpt
   */
  smartTruncate(content, maxWords, includeEllipsis = true) {
    // Strip HTML
    const text = this.stripHtml(content);

    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    let excerpt = '';
    let wordCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/);

      if (wordCount + sentenceWords.length <= maxWords) {
        excerpt += sentence;
        wordCount += sentenceWords.length;
      } else if (wordCount === 0) {
        // First sentence is too long, truncate it
        excerpt = sentenceWords.slice(0, maxWords).join(' ');
        wordCount = maxWords;
        break;
      } else {
        break;
      }
    }

    excerpt = excerpt.trim();

    // Add ellipsis if truncated and doesn't end with punctuation
    if (includeEllipsis && wordCount >= maxWords && !/[.!?]$/.test(excerpt)) {
      excerpt += '...';
    }

    return excerpt;
  }

  /**
   * Simple word-based truncation
   * @param {string} content - Content to truncate
   * @param {number} wordCount - Number of words
   * @returns {string} Truncated text
   */
  trimWords(content, wordCount = DEFAULTS.EXCERPT_WORD_COUNT) {
    const text = this.stripHtml(content);
    const words = text.split(/\s+/).filter(Boolean);
    const truncated = words.slice(0, wordCount).join(' ');
    return words.length > wordCount ? truncated + '...' : truncated;
  }

  /**
   * Strip HTML tags from content
   * @param {string} html - HTML content
   * @returns {string} Plain text
   */
  stripHtml(html) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Format excerpt to ensure it meets requirements
   * @param {string} excerpt - Excerpt text
   * @param {number} maxWords - Maximum words
   * @param {boolean} includeEllipsis - Add ellipsis if truncated
   * @returns {string} Formatted excerpt
   */
  formatExcerpt(excerpt, maxWords, includeEllipsis) {
    const words = excerpt.split(/\s+/).filter(Boolean);

    if (words.length <= maxWords) {
      return excerpt;
    }

    const truncated = words.slice(0, maxWords).join(' ');
    return includeEllipsis ? truncated + '...' : truncated;
  }

  /**
   * Generate excerpts for multiple posts
   * @param {Object[]} posts - Array of posts with content
   * @param {Object} options - Generation options
   * @returns {Promise<Object[]>} Posts with excerpts added
   */
  async generateBulkExcerpts(posts, options = {}) {
    const results = [];

    for (const post of posts) {
      const content = post.content || post.body || '';
      const excerpt = await this.generateExcerpt(content, options);

      results.push({
        ...post,
        excerpt,
      });
    }

    return results;
  }

  /**
   * Check if content needs an excerpt generated
   * @param {Object} post - Post object
   * @returns {boolean} Whether excerpt is needed
   */
  needsExcerpt(post) {
    return !post.excerpt || post.excerpt.trim().length === 0;
  }
}

export default ExcerptService;
