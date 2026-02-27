# WordToSite — Glossary

> Internal terminology reference. Use these terms consistently across code, tickets, and conversations.

---

## Core Concepts

### WaaS (Website-as-a-Service)
The core product model of WordToSite. Users don't install or manage software — they get a fully managed website created and maintained via AI. No CMS dashboards, no technical skills required.

### WaaS Wizard *(not "Chat")*
The multi-step site creation flow that guides users from zero to a deployed website. This is the **onboarding + deployment pipeline**, not a chat interface.

- Step-by-step guided flow (select path → provide info → review → deploy)
- Drives template selection, content generation, and deployment
- Outputs a **Wizard Payload** — the unified JSON sent to WordPress

> Do NOT call this "Chat". The WaaS Wizard is a structured creation flow. "Chat" refers to the Light Editor's editing interface (see below).

`src/onboarding-workflow.js` → `src/schemas/wp-wizard-payload.js`

### Chat *(not "Wizard")*
The conversational interface inside the **Light Editor** for editing an already-created site. Users type or speak natural language commands ("change the heading", "add a pricing section") and AI executes them as structured actions.

- Multi-turn conversation with message history
- Produces **Action Blocks** (`update_page`, `create_page`, `update_settings`)
- Available only **after** a site is deployed

> Do NOT call this "Wizard". Chat is for post-creation editing. The Wizard is for site creation.

`src/services/editor-service.js`

### SSE Stream (Server-Sent Events)
The real-time progress mechanism used during long-running operations (site creation, migration, deployment). The server pushes progress events to the client as they happen.

- `/api/onboard/flow-a/stream` — Migration progress
- `/api/onboard/confirm/stream` — Deployment progress
- `/api/create-site-with-domain/stream` — Domain + site creation

Progress steps: `creating_site` → `applying_deployment` → `generating_content` → `pushing_content` → `complete`

---

## Onboarding & Flows

### Onboarding
The entire process from a new user arriving to having a deployed website. Consists of sequential steps managed by `OnboardingWorkflow`.

Steps: `SELECTING_FLOW` → `ANALYZING_SOURCE` or `CONDUCTING_INTERVIEW` → `MATCHING_TEMPLATE` → `GENERATING_CONTEXTS` → `CONFIRMING_SELECTION` → `COMPLETE`

`src/onboarding-workflow.js`

### Flow A (COPY / Migration)
The user has an existing website they want to migrate. WordToSite scrapes the source URL via Firecrawl, analyzes its structure and brand with AI, matches a template, and rebuilds it with proper optimization.

Constant: `ONBOARDING_FLOWS.COPY`

### Flow B (VOICE / Voice Interview)
The user needs a new website from scratch. They go through a voice or text interview where AI asks about their business (name, industry, services, target audience). The answers are processed into a structured brief.

Constant: `ONBOARDING_FLOWS.VOICE`

### Interview
A multi-step Q&A session in Flow B. AI asks structured questions (company name, industry, services, about us, address, phone, team, advantages) and builds a brief from the answers. Can be conducted via voice (Whisper transcription) or text input.

`src/constants.js` (`INTERVIEW_QUESTIONS`)

### Brief (Business Brief)
The structured output of an interview or migration analysis. Contains: company name, tagline, industry, services, target audience, unique selling points, location, and contact info. Used to generate the Content Context.

### Scraping (Website Scraping)
The process of extracting content, structure, and brand elements from an existing website during Flow A. Uses Firecrawl API with a native fetch fallback. Extracts: markdown content, HTML, metadata, screenshots, and brand elements (logo, colors, fonts, style).

`src/services/firecrawl-service.js`

### Template Matching
AI (Gemini) analyzes the brief or scraped data and recommends the best WordPress template from the catalog based on industry, features, and style. Falls back to `flexify` if no match.

---

## AI & Models

### AI Model *(not "LLM", not "GPT")*
The general term for any AI system used in the project. We use **multiple providers**, so avoid saying "GPT" or "LLM" when you mean the general concept.

- **"GPT"** — only use when specifically referring to OpenAI's GPT-4o or GPT-4o-mini
- **"LLM"** — technically correct for text models, but too narrow (we also use Whisper for audio, Gemini for vision)
- **"AI model"** — use this as the default generic term

### Whisper (OpenAI `whisper-1`)
OpenAI's speech-to-text model used for voice transcription. Converts audio from the user's microphone into text during the Voice Interview (Flow B) and Light Editor voice commands. Supports auto language detection.

> This is NOT a text generation model. Whisper only does audio → text. Content generation uses GPT-4o.

`src/services/ai-service.js` → `transcribeAudio()`

### GPT-4o (OpenAI)
The primary text generation model. Handles content generation, blog posts, interview processing, chat responses, and action block creation.

### GPT-4o-mini (OpenAI)
A lighter, faster OpenAI model used for simpler tasks like excerpt generation where full GPT-4o is overkill.

### Gemini (Google Gemini 1.5 Pro)
Google's multimodal model used for website analysis (visual + content) and template matching. Chosen for its large context window (1M+ tokens) which allows processing entire scraped websites at once.

### Claude (Anthropic)
Anthropic's model, available via proxy service. Used for reasoning, content analysis, and structured data generation.

### TTS (Text-to-Speech, OpenAI `tts-1`)
OpenAI's text-to-speech model. Converts AI responses to audio. Available voices: alloy, echo, fable, onyx, nova, shimmer.

### AI Provider
The company behind an AI model. WordToSite uses three providers: **OpenAI** (GPT-4o, Whisper, TTS), **Google** (Gemini), and **Anthropic** (Claude). Different tasks route to different providers based on their strengths.

`src/services/ai-service.js`

---

## Editor & Chat

### Light Editor (`EDITOR_MODES.LIGHT`)
The chat + voice interface for editing a deployed site. Users describe changes in natural language, AI converts them to structured Action Blocks, and the system executes them against the WordPress REST API.

> Requires the WAAS Controller plugin on the WP site. Falls back to Advanced Editor if not available.

`src/services/editor-service.js`

### Advanced Editor (`EDITOR_MODES.ADVANCED`)
Direct access to the full WordPress Admin dashboard (`/wp-admin`). Used as a fallback when the Light Editor isn't viable or when users need full control.

### Action Block (`:::action ... :::`)
A structured JSON command embedded in AI chat responses. The Light Editor parses these and executes them against WordPress. Three types:

- `update_page` — update an existing page's title or content
- `create_page` — create a new page
- `update_settings` — update site title or tagline

Format: `:::action\n{"type": "update_page", "pageId": 5, "updates": {"title": "New Title"}}\n:::`

### Editor Session
A persistent conversation thread between a user and the Light Editor for a specific site. Stores message history (role + content pairs) in the database so context is preserved across page reloads.

### WAAS Controller (WordPress Plugin)
A WordPress plugin installed on deployed sites that exposes a REST API at `/wp-json/waas-controller/v1`. Provides endpoints for health checks (`/health`) and site structure (`/site-map`). Required for the Light Editor to function.

---

## Deployment & Infrastructure

### Deployment Context (JSON Schema #1)
A JSON object that drives the technical deployment: which template to use, which plugins to install, demo content settings, branding (colors, logo, favicon), and feature flags.

`src/schemas/deployment-context.js`

### Content Context (JSON Schema #2)
A JSON object that drives AI text generation: business info, language, tone, page structure, source analysis data, voice interview data, and SEO metadata.

`src/schemas/content-context.js`

### Wizard Payload
The combined JSON sent to the WordPress WAAS Controller plugin. Merges Deployment Context + Content Context + site info + client info into a single payload. This is what WordPress actually receives.

`src/schemas/wp-wizard-payload.js` → `buildWizardPayload()`

### InstaWP (Hosting Provider)
The hosting platform used to create and manage WordPress instances. Provides API for site creation, status polling, SSL checks, and A record extraction for DNS.

`src/instawp.js`

### Template (WP Template)
A WordPress theme from the template catalog, identified by a slug (e.g. `flexify`, `flavor`). Each template can have multiple **skins** (color schemes) and **variations**.

### Skin (Template Skin)
A color scheme / visual variant within a template. Selected during template matching based on the brand analysis.

### Magic Login URL
A one-time URL provided by InstaWP that logs the user directly into their WordPress admin without credentials. Used for Advanced Editor access.

### Firecrawl (Scraping Service)
Third-party API used for website scraping in Flow A (migration). Extracts HTML, markdown, metadata, and screenshots. Has a native fetch fallback if the API is unavailable.

`src/services/firecrawl-service.js`

---

## Domain & DNS

### Domain Workflow
The automated pipeline for connecting a custom domain to a deployed site:

1. `CHECKING_AVAILABILITY` — domain availability check
2. `REGISTERING_DOMAIN` — register via Namecheap
3. `MAPPING_DOMAIN` — map in InstaWP
4. `CREATING_ZONE` — create Cloudflare zone
5. `SETTING_DNS_RECORDS` — configure A records
6. `UPDATING_NAMESERVERS` — point to Cloudflare NS
7. `CONFIGURING_SECURITY` — SSL + DDoS protection

`src/domain-workflow.js`

### Cloudflare (DNS/SSL Provider)
Manages DNS zones, DNS records (A, CNAME, MX), SSL/TLS certificates, and security settings (DDoS protection) for deployed sites.

`src/cloudflare.js`

### Namecheap (Domain Registrar)
Used for domain registration, nameserver updates, and DNS host management.

`src/namecheap.js`

---

## Content & SEO

### AEO (Answer Engine Optimization)
Structuring content so answer engines (Google Featured Snippets) can extract and display information directly in search results. Implemented via semantic HTML, heading hierarchy, and FAQ structured data.

### GEO (Generative Engine Optimization)
Optimizing content for AI-powered search engines (ChatGPT, Claude, Perplexity, Gemini) that generate answers by referencing and citing your website. Implemented via Schema.org JSON-LD and AI-friendly content formatting.

### Excerpt (Content Summary)
An AI-generated summary of page content, typically ~30 words. Used for SEO meta descriptions and page previews. Supports styles: informative, engaging, professional, casual. Generated via GPT-4o-mini.

`src/services/excerpt-service.js`

### Page Section Types
Predefined section types used when generating page content: `hero`, `features`, `about`, `services`, `testimonials`, `pricing`, `contact`, `cta`, `faq`, `team`, `gallery`, `blog`.

### Default Pages
The five pages generated for every new site by default: `home`, `about`, `services`, `contact`, `blog`.

### Tone (Content Tone)
The writing style applied to all generated content. Options: `professional`, `friendly`, `casual`, `formal`.

---

## WordPress Theme Terminology

### Theme-Clone
A theme built on a source theme **without modifying core files** and without significant changes to the base skin. Allowed changes: renaming base skin, modifying `skin-setup.php` / `skin-demo-importer.php`, adding Fontello icons, replacing logos, adding new files (listed in `skin-upgrade.json`).

> Auto-updates replace both the theme core and the skin folder.

- **Theme-Clone-Remake** — replaces an existing portfolio theme. Starts at next major version (e.g. 3.2.1 → 4.0).
- **Theme-Clone-New** — uploaded as a brand new theme, starting at version 1.0.

### Theme-Branch
A theme built on a source theme's core but with **significant changes** to styles and logic. The skin folder is fully reworked and doesn't maintain compatibility with the base skin.

> Auto-updates replace only the theme core (not the skin folder).

- **Theme-Branch-Remake** — replaces an existing portfolio theme. Starts at next major version.
- **Theme-Branch-New** — uploaded as a brand new theme, starting at version 1.0.

### Naming Convention
Theme names follow a 3-part format: **Theme - Relation Type - Upload Type**

- Relation Type: **Clone** (minor skin changes) or **Branch** (significant rework)
- Upload Type: **Remake** (replaces existing theme) or **New** (brand new theme)

Example: "WineShop: Theme-Clone-Remake based on Qwery Wine skin"

### Fix vs Update
- **Fix**: correction to a theme not yet accepted, after reviewer feedback. Always version 1.0.
- **Update**: new version of an accepted theme with fixes and improvements. Each update increments the version number.

### Micro-niche vs Macro-niche
- **Micro-niche**: templates for a very specific, narrow segment (mushroom farm, single cryptocurrency).
- **Macro-niche**: templates for a broad category (business theme usable as blog, personal site, or company site).
