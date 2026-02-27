/**
 * Application-wide constants and default values
 */

export const DEFAULTS = {
  // Default favicon URL (Flexify theme favicon)
  FAVICON_URL: 'https://flexify.themerex.net/wp-content/uploads/2025/07/cropped-favicon-32x32.jpg',

  // Default template slug for InstaWP
  TEMPLATE_SLUG: 'flexify',

  // Default word count for auto-generated excerpts
  EXCERPT_WORD_COUNT: 30,

  // Default language (ISO 639-1)
  LANGUAGE: 'en',

  // Default tone for AI content generation
  TONE: 'professional',
};

export const EDITOR_MODES = {
  LIGHT: 'light',       // Chat + Voice interface
  ADVANCED: 'advanced', // WP Admin
};

export const ONBOARDING_FLOWS = {
  COPY: 'copy',   // Flow A: Customer has existing website to copy
  VOICE: 'voice', // Flow B: Customer needs new website (voice interview)
};

export const CONTENT_TONES = {
  PROFESSIONAL: 'professional',
  FRIENDLY: 'friendly',
  CASUAL: 'casual',
  FORMAL: 'formal',
};

export const PAGE_SECTION_TYPES = {
  HERO: 'hero',
  FEATURES: 'features',
  ABOUT: 'about',
  SERVICES: 'services',
  TESTIMONIALS: 'testimonials',
  PRICING: 'pricing',
  CONTACT: 'contact',
  CTA: 'cta',
  FAQ: 'faq',
  TEAM: 'team',
  GALLERY: 'gallery',
  BLOG: 'blog',
};

export const DEFAULT_PAGES = ['home', 'about', 'services', 'contact', 'blog'];

export const INTERVIEW_QUESTIONS = [
  // Step 1: Core business info
  { id: 'email', question: 'Your email address', context: 'We\'ll use this for your account', required: true, step: 1 },
  { id: 'companyName', question: 'Company name', context: 'Your business or brand name', required: true, step: 1 },
  { id: 'industry', question: 'Industry', context: 'e.g., Technology, Healthcare, Consulting', required: true, step: 1 },
  { id: 'services', question: 'What services or products do you offer?', context: 'List your main offerings', required: true, step: 1 },
  { id: 'aboutUs', question: 'Tell us about your business', context: 'A brief description of what you do', required: true, step: 1 },
  // Step 2: Additional details
  { id: 'address', question: 'Business address', context: 'Your physical location', required: false, step: 2 },
  { id: 'phone', question: 'Phone number', context: 'Contact phone number', required: false, step: 2 },
  { id: 'team', question: 'Tell us about your team', context: 'Team size, key members, roles', required: false, step: 2 },
  { id: 'advantages', question: 'What makes you different?', context: 'Your competitive advantages and USPs', required: false, step: 2 },
];

// Static fallback — can be dynamically fetched via BaseSiteService.getLanguages()
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  uk: 'Ukrainian',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  ar: 'Arabic',
};

export const FEATURE_FLAGS = {
  VOICE_FLOW: 'voice_flow',
  LIGHT_EDITOR: 'light_editor',
  AI_CONTENT: 'ai_content',
  AUTO_EXCERPT: 'auto_excerpt',
};
