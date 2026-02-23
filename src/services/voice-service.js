/**
 * Voice Service
 * Handles speech-to-text, text-to-speech, and voice interview flow
 */

import AIService from './ai-service.js';
import { config } from '../config.js';
import { INTERVIEW_QUESTIONS, DEFAULTS } from '../constants.js';

class VoiceService {
  constructor(options = {}) {
    this.aiService = options.aiService || new AIService();
    this.defaultVoice = options.voice || 'alloy';
    this.supportedVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  }

  /**
   * Transcribe audio to text
   * @param {Buffer|Blob} audioBuffer - Audio data
   * @param {string} language - Language code or 'auto' for detection
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioBuffer, language = 'auto') {
    console.log('Transcribing audio...');

    try {
      const result = await this.aiService.transcribeAudio(audioBuffer, language);
      console.log('✅ Transcription complete');
      return result;
    } catch (error) {
      console.error('Transcription error:', error.message);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Synthesize text to speech
   * @param {string} text - Text to synthesize
   * @param {Object} options - Synthesis options
   * @returns {Promise<Buffer>} Audio buffer
   */
  async synthesize(text, options = {}) {
    const {
      voice = this.defaultVoice,
      model = 'tts-1',
      speed = 1.0,
      responseFormat = 'mp3',
    } = options;

    if (!this.aiService.hasOpenAI) {
      throw new Error('OpenAI API key is required for text-to-speech');
    }

    console.log(`Synthesizing speech (voice: ${voice})...`);

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openai?.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          speed,
          response_format: responseFormat,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `TTS request failed: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      console.log('✅ Speech synthesized');

      return Buffer.from(audioBuffer);
    } catch (error) {
      console.error('TTS error:', error.message);
      throw error;
    }
  }

  /**
   * Get the next interview question based on context
   * @param {Object} context - Current interview context
   * @param {Object[]} previousAnswers - Previous Q&A pairs
   * @returns {Promise<Object>} Next question with context
   */
  async getNextQuestion(context = {}, previousAnswers = []) {
    const answeredQuestionIds = previousAnswers.map(qa => qa.questionId);
    const remainingQuestions = INTERVIEW_QUESTIONS.filter(
      q => !answeredQuestionIds.includes(q.id)
    );

    // If all predefined questions are answered, use AI to determine if more info needed
    if (remainingQuestions.length === 0) {
      return this.getFollowUpQuestion(previousAnswers);
    }

    // Use AI to select most relevant next question if available
    if (this.aiService.hasOpenAI && previousAnswers.length > 0) {
      try {
        const aiSuggestion = await this.aiService.conductInterview(
          previousAnswers.map(qa => ({
            question: INTERVIEW_QUESTIONS.find(q => q.id === qa.questionId)?.question || qa.questionId,
            answer: qa.answer,
          })),
          context
        );

        // Check if AI suggests a different order
        if (aiSuggestion.nextQuestion) {
          const matchingQuestion = remainingQuestions.find(q =>
            aiSuggestion.nextQuestion.toLowerCase().includes(q.id)
          );

          if (matchingQuestion) {
            return {
              questionId: matchingQuestion.id,
              question: matchingQuestion.question,
              context: matchingQuestion.context,
              suggestions: aiSuggestion.suggestions || [],
              completionPercentage: aiSuggestion.completionPercentage || this.calculateProgress(previousAnswers),
            };
          }
        }
      } catch (error) {
        console.warn('AI question selection failed, using default order:', error.message);
      }
    }

    // Fall back to next question in order
    const nextQuestion = remainingQuestions[0];
    return {
      questionId: nextQuestion.id,
      question: nextQuestion.question,
      context: nextQuestion.context,
      suggestions: [],
      completionPercentage: this.calculateProgress(previousAnswers),
    };
  }

  /**
   * Get a follow-up question when predefined questions are exhausted
   * @param {Object[]} previousAnswers - All previous answers
   * @returns {Promise<Object>} Follow-up question or completion signal
   */
  async getFollowUpQuestion(previousAnswers) {
    if (!this.aiService.hasOpenAI) {
      return {
        questionId: 'complete',
        question: null,
        complete: true,
        completionPercentage: 100,
      };
    }

    try {
      const result = await this.aiService.conductInterview(
        previousAnswers.map(qa => ({
          question: INTERVIEW_QUESTIONS.find(q => q.id === qa.questionId)?.question || qa.questionId,
          answer: qa.answer,
        }))
      );

      // If AI determines we have enough info
      if (result.completionPercentage >= 90) {
        return {
          questionId: 'complete',
          question: null,
          complete: true,
          completionPercentage: 100,
          extractedInfo: result.extractedInfo,
        };
      }

      return {
        questionId: `followup_${Date.now()}`,
        question: result.nextQuestion,
        context: result.context,
        suggestions: result.suggestions,
        completionPercentage: result.completionPercentage,
      };
    } catch {
      return {
        questionId: 'complete',
        question: null,
        complete: true,
        completionPercentage: 100,
      };
    }
  }

  /**
   * Calculate interview progress
   * @param {Object[]} previousAnswers - Previous answers
   * @returns {number} Progress percentage (0-100)
   */
  calculateProgress(previousAnswers) {
    const totalQuestions = INTERVIEW_QUESTIONS.length;
    const answered = previousAnswers.length;
    return Math.round((answered / totalQuestions) * 100);
  }

  /**
   * Process complete interview and generate brief
   * @param {Object[]} answers - All interview answers
   * @param {string} language - Language code
   * @returns {Promise<Object>} Generated brief
   */
  async processInterview(answers, language = DEFAULTS.LANGUAGE) {
    const answersMap = {};
    answers.forEach(qa => {
      answersMap[qa.questionId] = qa.answer;
    });

    // Build brief using AI if available
    if (this.aiService.hasOpenAI) {
      try {
        const brief = await this.aiService.buildBriefFromInterview(answersMap);
        return {
          success: true,
          brief,
          language,
          rawAnswers: answersMap,
        };
      } catch (error) {
        console.warn('AI brief generation failed:', error.message);
      }
    }

    // Fallback to structured mapping
    return {
      success: true,
      brief: this.mapAnswersToBrief(answersMap),
      language,
      rawAnswers: answersMap,
    };
  }

  /**
   * Map interview answers to brief structure (fallback)
   * @param {Object} answers - Answers keyed by question ID
   * @returns {Object} Brief object
   */
  mapAnswersToBrief(answers) {
    return {
      businessInfo: {
        name: answers.companyName || this.extractBusinessName(answers.brand || answers.business) || 'My Business',
        tagline: this.extractTagline(answers.brand) || '',
        industry: answers.industry || this.extractIndustry(answers.business) || '',
        services: answers.services ? this.parseList(answers.services) : this.parseList(answers.business) || [],
        targetAudience: answers.customers || '',
        uniqueSellingPoints: answers.advantages ? this.parseList(answers.advantages) : [],
        location: answers.address || '',
        team: answers.team || '',
        contactInfo: {
          email: answers.email || '',
          phone: answers.phone || '',
          address: answers.address || '',
        },
      },
      websiteGoals: answers.goal ? [answers.goal] : [],
      preferredStyle: 'modern',
      contentTone: 'professional',
      requiredPages: this.parsePages(answers.pages) || ['home', 'about', 'services', 'contact'],
      inspirationSites: this.parseUrls(answers.inspiration) || [],
      brandColors: this.parseColors(answers.branding) || [],
      additionalNotes: answers.aboutUs || answers.other || '',
    };
  }

  // Helper methods for parsing interview answers
  extractBusinessName(text) {
    if (!text) return null;
    // Simple extraction: take first few capitalized words
    const words = text.match(/[A-Z][a-zA-Z]*/g);
    return words ? words.slice(0, 3).join(' ') : text.split(' ').slice(0, 2).join(' ');
  }

  extractTagline(text) {
    if (!text) return '';
    // Look for quoted text or text after a dash
    const quoted = text.match(/"([^"]+)"/);
    if (quoted) return quoted[1];
    const afterDash = text.split(/[-–]/).slice(1).join(' ').trim();
    return afterDash || '';
  }

  extractIndustry(text) {
    if (!text) return '';
    const industries = [
      'technology', 'healthcare', 'finance', 'retail', 'education',
      'consulting', 'marketing', 'real estate', 'legal', 'restaurant',
      'fitness', 'beauty', 'construction', 'manufacturing', 'nonprofit'
    ];
    const lower = text.toLowerCase();
    return industries.find(i => lower.includes(i)) || '';
  }

  parseList(text) {
    if (!text) return [];
    return text.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  parsePages(text) {
    if (!text) return ['home', 'about', 'contact'];
    const pageKeywords = ['home', 'about', 'services', 'products', 'contact', 'blog', 'portfolio', 'team', 'pricing', 'faq'];
    const lower = text.toLowerCase();
    return pageKeywords.filter(p => lower.includes(p));
  }

  parseUrls(text) {
    if (!text) return [];
    const urlPattern = /https?:\/\/[^\s]+/g;
    return text.match(urlPattern) || [];
  }

  parseColors(text) {
    if (!text) return [];
    const hexPattern = /#[0-9A-Fa-f]{6}/g;
    const colors = text.match(hexPattern) || [];

    // Also look for color names
    const colorNames = ['blue', 'red', 'green', 'black', 'white', 'orange', 'purple', 'yellow', 'pink', 'grey', 'gray'];
    const lower = text.toLowerCase();
    colorNames.forEach(c => {
      if (lower.includes(c) && !colors.includes(c)) {
        colors.push(c);
      }
    });

    return colors;
  }
}

export default VoiceService;
