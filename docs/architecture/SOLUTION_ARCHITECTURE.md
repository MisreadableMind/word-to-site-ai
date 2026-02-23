# Solution Architecture: WordToSite Platform

> Version: 0.1 (Draft)
> Date: 2025-02-04

---

## 1. High-Level Overview

```
+------------------------------------------------------------------+
|                        FRONTEND (SolidStart)                      |
|  Onboarding Wizard | Chat Editor | Dashboard | Voice Capture      |
+-------------------------------+----------------------------------+
                                |
                          HTTPS / WSS
                                |
+-------------------------------v----------------------------------+
|                      BACKEND GATEWAY (Node.js)                    |
|  API Router | Auth Middleware | WebSocket Hub | Job Dispatcher     |
+---+----------+----------+----------+----------+---------+--------+
    |          |          |          |          |         |
    v          v          v          v          v         v
+------+  +------+  +--------+  +------+  +-------+  +-------+
| Auth |  |  AI  |  | Site   |  | WP   |  |Domain |  |Billing|
| Svc  |  | Svc  |  |Builder |  |Editor|  |  Svc  |  |  Svc  |
+------+  +------+  +--------+  +------+  +-------+  +-------+
    |         |          |          |          |          |
    v         v          v          v          v          v
 Postgres  OpenAI    InstaWP     WP REST   Namecheap   Stripe
 + Redis   Whisper   API         API       Cloudflare
           GPT-4o    Firecrawl
           Gemini
```

---

## 2. Two Onboarding Flows

### Flow A: "Copy My Website"

```
User pastes URL
       |
       v
+-----------------+     +---------------------+     +---------------------+
| 1. Firecrawl    | --> | 2. Gemini Analyzes  | --> | 3. Gemini Matches   |
| (crawl + parse) |     | (vision + text)     |     |  Template            |
| HTML, markdown, |     | extract:            |     | (receives ALL        |
| metadata,       |     | - brand voice       |     |  template previews + |
| screenshots,    |     | - page structure    |     |  metadata, picks     |
| links           |     | - content blocks    |     |  best fit)           |
+-----------------+     | - color palette     |     +---------------------+
                        | - industry/niche    |              |
                        +---------------------+              v
                                                    +-------------------+
                                                    | 4. Generate Site  |
                                                    | - Create via       |
                                                    |   InstaWP API      |
                                                    | - Push content via |
                                                    |   WP REST API      |
                                                    | - Apply styling    |
                                                    +-------------------+
                                                             |
                                                             v
                                                    +-------------------+
                                                    | 5. Preview & Edit |
                                                    | (Chat interface)  |
                                                    +-------------------+
```

**Crawl strategy (Firecrawl):**
- Use [Firecrawl](https://www.firecrawl.dev/) API to crawl the target URL
- Firecrawl handles JS rendering, returns clean markdown + structured data
- Extracts: title, meta, OG tags, headings, body text, images, nav structure, links
- Capture screenshot via Firecrawl's screenshot option
- Single call replaces the need for a self-hosted headless browser
- Rate-limited per user, results cached 1 hour

**AI interpretation + template matching (Gemini):**
1. **Analyze** — Gemini receives the Firecrawl output (markdown + screenshot), outputs structured JSON: industry, page sections, color scheme, content blocks, brand tone
2. **Match** — Gemini receives the analysis **plus visual previews/screenshots of ALL our WP templates** in a single multimodal request. With its large context window (1M+ tokens), Gemini compares the source site's look and feel against every template simultaneously, scoring and ranking the top 3 matches. This is a visual-first comparison — not just metadata matching.
3. **Generate** — GPT-4o produces WP-ready content mapped to the selected template's content areas (hero, about, services, contact, etc.)

**Why Gemini for visual matching:**
- 1M+ token context window can ingest all template screenshots + source site in one call
- Strong multimodal vision capabilities for comparing visual layouts
- Cost-effective for large visual payloads compared to alternatives

### Flow B: "Voice Mode" (Guided Interview)

```
User starts voice session
       |
       v
+-------------------+     +------------------+     +-------------------+
| 1. Question Flow  | --> | 2. Whisper STT   | --> | 3. Context Build  |
| (guided Q&A,      |     | (real-time        |     | (accumulate into  |
|  ~5-8 questions)  |     |  transcription)   |     |  structured brief)|
+-------------------+     +------------------+     +-------------------+
                                                            |
                                                            v
                                                   +-------------------+
                                                   | 4. AI Generates   |
                                                   | (same as Flow A   |
                                                   |  steps 3-5)       |
                                                   +-------------------+
```

**Question set (adaptive, AI picks follow-ups based on prior answers):**

| #  | Question                                              | Extracts              |
|----|-------------------------------------------------------|-----------------------|
| 1  | What does your business do?                           | Industry, niche       |
| 2  | Who are your customers?                               | Target audience       |
| 3  | What's the main goal of your website?                 | CTA, conversion type  |
| 4  | Do you have a brand name and tagline?                 | Brand identity        |
| 5  | What pages do you need?                               | Site structure        |
| 6  | Do you have brand colors or a logo?                   | Visual identity       |
| 7  | Any websites you like the look of?                    | Style reference       |
| 8  | Anything else important?                              | Catch-all context     |

**Voice pipeline:**
- Frontend captures audio via MediaRecorder API, streams chunks via WebSocket
- Backend pipes chunks to OpenAI Whisper API (streaming or batch, depending on latency needs)
- Transcribed text is appended to conversation context
- GPT-4o generates the next question (or confirms enough context gathered)
- TTS (OpenAI) reads back confirmations/questions to the user

---

## 3. Chat-Based Website Editing

After a site is created, the user can modify it through a conversational chat interface.

```
+------------------+        +-------------------+        +-------------------+        +-------------------+
|   Chat UI        | -----> |  AI Interpreter   | -----> |  Backend Gateway  | -----> | WAAS Controller   |
|   (SolidJS)      | <----- |  (GPT-4o)         | <----- |  Action Planner   | <----- | Plugin (on WP)    |
+------------------+        +-------------------+        +-------------------+        +-------------------+
                                                                                             |
                                                                                      Executes changes
                                                                                      directly inside WP
                                                                                             |
                                                                                      +------v------+
                                                                                      | WordPress   |
                                                                                      | (blocks,    |
                                                                                      |  theme,     |
                                                                                      |  options,   |
                                                                                      |  menus)     |
                                                                                      +-------------+
```

### Why a Custom Plugin (not vanilla WP REST API)

The standard WP REST API (`/wp/v2/`) is designed for basic CRUD on posts/pages. It cannot:
- Manipulate Gutenberg blocks or page builder elements (Elementor, etc.)
- Change theme customizer settings or CSS variables
- Reorder sections within a page
- Manage navigation menus reliably across themes
- Handle template-specific content areas (hero sections, feature grids, etc.)

We need a **WAAS Controller Plugin** installed on every provisioned site that exposes high-level endpoints our backend can call.

### WAAS Controller Plugin

A lightweight custom WordPress plugin, auto-installed during site provisioning via InstaWP template.

**Plugin REST namespace:** `/wp-json/waas/v1/`

**Endpoints:**

| Endpoint                          | Method | What it does                                              |
|-----------------------------------|--------|-----------------------------------------------------------|
| `/waas/v1/site-map`              | GET    | Returns full site structure: pages, sections, blocks, menus, theme settings |
| `/waas/v1/sections`              | GET    | List all sections on a page with their editable fields    |
| `/waas/v1/sections/:id`          | PATCH  | Update a section's content (headline, text, image, CTA)   |
| `/waas/v1/sections/reorder`      | POST   | Reorder sections within a page                            |
| `/waas/v1/sections`              | POST   | Add a new section from a predefined section library       |
| `/waas/v1/sections/:id`          | DELETE | Remove a section                                          |
| `/waas/v1/pages`                 | POST   | Create a new page with predefined section layout          |
| `/waas/v1/pages/:id`             | PATCH  | Update page metadata (title, slug, SEO)                   |
| `/waas/v1/theme/colors`          | PATCH  | Update theme color palette (primary, secondary, accent)   |
| `/waas/v1/theme/fonts`           | PATCH  | Update typography (heading font, body font, sizes)        |
| `/waas/v1/theme/logo`            | POST   | Upload and set site logo                                  |
| `/waas/v1/media`                 | POST   | Upload media, return attachment ID + URL                  |
| `/waas/v1/media/replace`         | POST   | Replace an existing image in-place (swap hero image, etc.)|
| `/waas/v1/menus`                 | GET    | List navigation menus and items                           |
| `/waas/v1/menus/:id`             | PATCH  | Update menu items (add/remove/reorder links)              |
| `/waas/v1/settings`              | PATCH  | Update site title, tagline, favicon, footer text          |
| `/waas/v1/snapshot`              | POST   | Create a rollback snapshot of current site state          |
| `/waas/v1/snapshot/restore`      | POST   | Restore site to a previous snapshot                       |
| `/waas/v1/health`                | GET    | Plugin version, WP version, theme, active plugins         |

**How it works internally:**
- The plugin translates each API call into the appropriate WordPress PHP functions
- For Gutenberg: parses and manipulates block JSON (`parse_blocks()` / `serialize_blocks()`)
- For theme settings: uses `set_theme_mod()`, `update_option()`, CSS custom properties
- For menus: uses `wp_update_nav_menu_item()`, `wp_create_nav_menu()`
- Snapshots: exports all pages + options + menus as a JSON blob, stored in `wp_options`

**Example — AI edit flow:**
1. User says: _"Change the hero headline to 'We Build Dreams'"_
2. GPT-4o interprets, outputs:
   ```json
   {
     "action": "update_section",
     "endpoint": "PATCH /waas/v1/sections/hero-home",
     "body": { "headline": "We Build Dreams" }
   }
   ```
3. Backend validates against allow-list, calls the plugin endpoint
4. Plugin finds the hero block on the home page, updates the heading block content, saves
5. Plugin returns `{ "success": true, "updated_fields": ["headline"] }`
6. Confirmed back to user in chat with a live preview link

**Supported edit categories (all via plugin):**

| Category        | Examples                                       | Plugin Endpoint                |
|-----------------|------------------------------------------------|--------------------------------|
| Content         | Change text, swap images, update headings      | `PATCH /waas/v1/sections/:id`  |
| Structure       | Add page, reorder sections, add new section    | `POST /waas/v1/sections`, `/pages` |
| Styling         | Change colors, fonts, button styles            | `PATCH /waas/v1/theme/colors`, `/fonts` |
| Media           | Upload logo, replace hero image                | `POST /waas/v1/media`, `/media/replace` |
| Navigation      | Add/remove/reorder menu items                  | `PATCH /waas/v1/menus/:id`     |
| Settings        | Update site title, tagline, favicon            | `PATCH /waas/v1/settings`      |
| Rollback        | Undo last edit, restore to checkpoint          | `POST /waas/v1/snapshot/restore` |

**Plugin authentication:**
- Secret API key generated during site provisioning, stored in `wp-config.php`
- Passed via `X-WAAS-Key` header on every request
- Key stored encrypted in our Postgres database, scoped per site
- All requests proxied through Backend Gateway (user never gets raw credentials)
- Plugin rejects any request not matching the stored key

---

## 4. System Components

### 4.1 Frontend (SolidStart)

**Why SolidJS/SolidStart:**
- Fine-grained reactivity without virtual DOM (fast UI updates for real-time chat/voice)
- SolidStart provides SSR for landing/marketing pages (SEO)
- Small bundle size (~7kb runtime)
- Native signals model is ideal for streaming WebSocket data

**Pages & routes:**

```
/                       Landing page (marketing, SSR)
/auth/login             Login (email + OAuth)
/auth/register          Registration
/onboard/copy           Flow A: paste URL
/onboard/voice          Flow B: voice interview
/onboard/preview        Preview generated site before going live
/dashboard              List of user's sites
/dashboard/:siteId      Site detail (status, domain, settings)
/dashboard/:siteId/edit Chat-based editor
/account                Profile, billing, plan management
```

**Key frontend modules:**
- `VoiceCapture` — MediaRecorder + WebSocket streaming
- `ChatEditor` — Message list, input, streaming responses, action previews
- `OnboardingWizard` — Step-by-step flow with progress
- `SitePreview` — Iframe embed of the generated site with overlay controls

### 4.2 Backend Gateway (Node.js / Express or Fastify)

Single entry point for all client requests. Stateless, horizontally scalable.

```
backend-gateway/
  src/
    server.ts               Entry point
    middleware/
      auth.ts               JWT validation, session management
      rateLimit.ts           Per-user rate limiting
      validation.ts          Request schema validation (Zod)
    routes/
      auth.routes.ts         Login, register, OAuth callbacks
      onboard.routes.ts      Both onboarding flows
      sites.routes.ts        CRUD for user's sites
      chat.routes.ts         Chat editing (REST + WS upgrade)
      billing.routes.ts      Stripe webhooks, plan management
      domains.routes.ts      Domain check, register, DNS
    services/
      ai.service.ts          Multi-provider AI (OpenAI GPT/Whisper/TTS + Gemini vision)
      crawler.service.ts     Firecrawl API client (crawl + screenshot)
      siteBuilder.service.ts Template matching + site generation
      wpEditor.service.ts    WP REST API proxy for chat edits
      domain.service.ts      Namecheap + Cloudflare orchestration
      auth.service.ts        User management, JWT, OAuth
      billing.service.ts     Stripe integration
    workers/
      siteCreation.worker.ts Async job: full site build pipeline
      crawl.worker.ts        Async job: URL crawl + analysis
    websocket/
      voiceHandler.ts        Voice streaming + Whisper pipeline
      chatHandler.ts         Real-time chat editing
    db/
      schema.ts              Drizzle ORM schema
      migrations/            DB migrations
    queue/
      index.ts               BullMQ job queue setup
```

**Key technology choices:**
- **Fastify** (or Express) — HTTP framework
- **Drizzle ORM** — Type-safe database access
- **BullMQ + Redis** — Job queue for async workflows (site creation takes 30-120s)
- **Zod** — Request/response validation
- **Firecrawl** — Managed crawling API for Flow A (no self-hosted browser needed)
- **Google Gemini** — Visual template matching (large context multimodal)

### 4.3 Services Detail

#### Auth Service
- JWT access tokens (15min) + refresh tokens (7d)
- OAuth providers: Google, GitHub (expandable)
- User table with plan tier, site quota
- RBAC: `owner`, `editor`, `viewer` per site (future: team features)

#### AI Service (Multi-Provider)
Two AI providers, each used for what it does best:

**Google Gemini (visual analysis + template matching):**
- Site visual analysis — receives Firecrawl screenshot + markdown, extracts design intent
- Template matching — receives source site + ALL template screenshots in one call, performs visual-first comparison
- Leverages 1M+ token context window to compare against entire template catalog at once
- Model: `gemini-2.0-flash` for fast analysis, `gemini-2.0-pro` for complex matching

**OpenAI (language + voice):**
- **GPT-4o**: content generation, chat editing intent parsing, voice Q&A flow
- **Whisper**: speech-to-text for voice mode
- **TTS**: text-to-speech for voice responses

**Shared concerns:**
- Centralized client wrappers with retry, rate-limit handling
- Prompt templates versioned and stored in code (not DB) for auditability
- Token/cost usage tracked per user per provider for cost allocation

#### Crawler Service (Firecrawl)
- Uses [Firecrawl API](https://www.firecrawl.dev/) — no self-hosted browser
- Single API call returns: clean markdown, metadata, screenshot, links, structured content
- Handles JS-rendered SPAs, anti-bot pages, and complex sites
- Options: `scrape` (single page) or `crawl` (multi-page, follow links up to depth N)
- Config: max 5 pages per crawl, results cached 1 hour (same URL = skip re-crawl)
- Firecrawl API key stored server-side, never exposed to frontend

#### Site Builder Service
- Maintains a **Template Catalog** — metadata for each WP template:
  ```json
  {
    "slug": "flexify",
    "name": "Flexify Business",
    "industries": ["saas", "agency", "consulting"],
    "sections": ["hero", "features", "testimonials", "pricing", "cta", "footer"],
    "color_scheme": "light",
    "style": "modern-minimal"
  }
  ```
- Gemini scores templates visually against the user's brief/source site, picks top match
- Generates content-to-section mapping
- Calls InstaWP to create site (template includes WAAS Controller Plugin pre-installed)
- Pushes content via plugin endpoints (`/waas/v1/sections`, `/waas/v1/pages`, etc.)

#### WP Editor Service
- Proxies chat edit commands to the **WAAS Controller Plugin** on each site
- Fetches site structure via `GET /waas/v1/site-map` (cached, refreshed on edits)
- Translates high-level intents ("make the button blue") into plugin endpoint calls
- Creates snapshots before each edit batch via `POST /waas/v1/snapshot`
- Supports rollback via `POST /waas/v1/snapshot/restore`
- All communication goes through the plugin — never raw WP core APIs

#### Domain Service
- Wraps existing `namecheap.js` + `cloudflare.js` clients
- Adds: domain suggestions (AI-generated based on business name)
- Domain status monitoring (propagation, SSL readiness)

#### Billing Service
- Stripe Checkout for subscriptions
- Plans: Free (1 site, no custom domain) | Pro ($X/mo, N sites, domains) | Agency ($Y/mo, unlimited)
- Webhooks: subscription created/updated/cancelled, payment failed
- Usage metering: AI tokens, sites created, domains registered

---

## 5. Data Model

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│    users      │     │    sites      │     │  site_edits       │
├──────────────┤     ├──────────────┤     ├──────────────────┤
│ id (uuid)     │──┐  │ id (uuid)     │──┐  │ id (uuid)         │
│ email         │  │  │ user_id (fk)  │  │  │ site_id (fk)      │
│ password_hash │  │  │ name          │  │  │ user_message       │
│ plan_tier     │  │  │ domain        │  │  │ ai_interpretation  │
│ stripe_cust_id│  │  │ instawp_id    │  │  │ actions_executed   │
│ created_at    │  │  │ template_slug │  │  │ status             │
│ updated_at    │  │  │ wp_url        │  │  │ created_at         │
└──────────────┘  │  │ wp_app_pass   │  │  └──────────────────┘
                  │  │ status        │  │
                  │  │ cf_zone_id    │  │  ┌──────────────────┐
                  │  │ onboard_type  │  │  │  onboard_sessions  │
                  │  │ onboard_data  │  │  ├──────────────────┤
                  │  │ created_at    │  │  │ id (uuid)         │
                  │  └──────────────┘  │  │ user_id (fk)      │
                  │                    │  │ site_id (fk)       │
                  │  ┌──────────────┐  │  │ flow_type          │
                  │  │  domains      │  │  │ source_url         │
                  │  ├──────────────┤  │  │ voice_transcript   │
                  │  │ id (uuid)     │  │  │ ai_brief (json)    │
                  │  │ site_id (fk)  │  │  │ template_scores    │
                  │  │ domain_name   │  │  │ status             │
                  │  │ registrar     │  │  │ created_at         │
                  │  │ ns_provider   │  │  └──────────────────┘
                  │  │ ssl_status    │  │
                  │  │ registered_at │  │  ┌──────────────────┐
                  │  └──────────────┘  │  │  subscriptions     │
                  │                    │  ├──────────────────┤
                  └────────────────────┘  │ id (uuid)         │
                                          │ user_id (fk)      │
                                          │ stripe_sub_id     │
                                          │ plan_tier          │
                                          │ status             │
                                          │ current_period_end │
                                          └──────────────────┘
```

---

## 6. Real-Time Communication

Two WebSocket channels per authenticated user:

| Channel          | Purpose                        | Direction         |
|------------------|--------------------------------|-------------------|
| `/ws/voice`      | Audio streaming for voice mode | Client <-> Server |
| `/ws/chat`       | Chat editing with streaming AI | Client <-> Server |

**Voice WebSocket protocol:**
```
Client -> Server:  { type: "audio_chunk", data: <base64 PCM> }
Server -> Client:  { type: "transcript", text: "..." }
Server -> Client:  { type: "ai_question", text: "...", audio: <base64 mp3> }
Client -> Server:  { type: "audio_chunk", data: <base64 PCM> }
...
Server -> Client:  { type: "brief_complete", brief: { ... } }
```

**Chat WebSocket protocol:**
```
Client -> Server:  { type: "edit_request", message: "Change headline to ..." }
Server -> Client:  { type: "ai_thinking", status: "interpreting..." }
Server -> Client:  { type: "action_plan", actions: [...], confirm: true }
Client -> Server:  { type: "confirm", approved: true }
Server -> Client:  { type: "executing", action: 1, total: 3 }
Server -> Client:  { type: "executing", action: 2, total: 3 }
Server -> Client:  { type: "executing", action: 3, total: 3 }
Server -> Client:  { type: "complete", summary: "Updated headline on home page" }
```

---

## 7. Infrastructure

```
                        ┌─────────────┐
                        │  Cloudflare  │
                        │  (CDN/WAF)   │
                        └──────┬──────┘
                               │
                    ┌──────────v──────────┐
                    │   Load Balancer      │
                    │   (nginx / cloud LB) │
                    └───┬─────────────┬───┘
                        │             │
              ┌─────────v──┐   ┌──────v────────┐
              │  Frontend   │   │  Backend GW    │
              │  (SolidStart│   │  (Node.js x N) │
              │   SSR/CDN)  │   │                │
              └─────────────┘   └───┬────────┬──┘
                                    │        │
                          ┌─────────v┐  ┌────v─────┐
                          │ Postgres  │  │  Redis    │
                          │ (primary  │  │ (cache +  │
                          │  + read   │  │  queues)  │
                          │  replica) │  │           │
                          └──────────┘  └──────────┘
```

**Deployment options (start simple, scale later):**
- **Phase 1:** Single VPS (Hetzner/DigitalOcean) — Docker Compose with all services
- **Phase 2:** Separate frontend (Vercel/Cloudflare Pages) + backend (Railway/Fly.io)
- **Phase 3:** Kubernetes or managed containers for horizontal scaling

---

## 8. Security Considerations

| Concern                  | Mitigation                                                  |
|--------------------------|-------------------------------------------------------------|
| WP credentials in DB     | Encrypt at rest (AES-256), decrypt only at execution time   |
| User auth                | JWT + refresh rotation, bcrypt passwords, OAuth2            |
| API keys (OpenAI, Gemini, Firecrawl) | Vault or encrypted env, never sent to frontend  |
| Chat injection           | AI output validated before WP API execution, action allow-list |
| Crawl abuse              | Rate limit Firecrawl calls per user, Firecrawl handles robots.txt |
| Billing fraud            | Stripe webhook signature verification, idempotency keys    |
| XSS in chat              | Sanitize all AI-generated content before rendering          |

---

## 9. API Contract (Key Endpoints)

### Onboarding

```
POST   /api/onboard/copy
       Body: { url: string }
       Response: { sessionId, analysis: { industry, sections, colors, ... } }

POST   /api/onboard/copy/confirm
       Body: { sessionId, templateSlug, domain?, customizations? }
       Response: { siteId, status: "building" }

WS     /ws/voice
       (see protocol above)

POST   /api/onboard/voice/confirm
       Body: { sessionId, templateSlug, domain?, customizations? }
       Response: { siteId, status: "building" }
```

### Sites

```
GET    /api/sites                    List user's sites
GET    /api/sites/:id                Site detail + status
DELETE /api/sites/:id                Delete site
GET    /api/sites/:id/preview        Get preview URL
POST   /api/sites/:id/publish        Publish (attach domain, go live)
```

### Chat Editing

```
WS     /ws/chat/:siteId             (see protocol above)
GET    /api/sites/:id/edits          Edit history
POST   /api/sites/:id/edits/undo     Undo last edit batch
```

### Domains

```
POST   /api/domains/check            Check availability
POST   /api/domains/suggest          AI-generated suggestions
POST   /api/domains/register         Register + configure DNS
GET    /api/domains/:id/status       Propagation + SSL status
```

### Billing

```
POST   /api/billing/checkout         Create Stripe checkout session
POST   /api/billing/portal           Stripe customer portal link
POST   /api/billing/webhook          Stripe webhook handler
GET    /api/billing/usage            Current usage stats
```

---

## 10. Template Catalog Strategy

The system needs a curated set of WordPress templates with structured metadata so the AI can match them to user needs.

**Template metadata schema:**
```json
{
  "slug": "developer-developer",
  "name": "Developer Developer",
  "provider": "developer",
  "industries": ["technology", "saas", "startup"],
  "page_types": ["home", "about", "services", "blog", "contact", "pricing"],
  "sections": {
    "home": ["hero", "features_grid", "testimonials", "cta_banner", "stats"],
    "about": ["team", "mission", "timeline"],
    "services": ["service_cards", "process_steps"]
  },
  "style_tags": ["modern", "minimal", "dark-option"],
  "content_slots": {
    "hero_headline": { "type": "text", "max_length": 60 },
    "hero_subheadline": { "type": "text", "max_length": 120 },
    "hero_image": { "type": "image", "dimensions": "1920x1080" },
    "features": { "type": "repeater", "fields": ["icon", "title", "description"], "max": 6 }
  }
}
```

This catalog lives in the codebase (version controlled) and is loaded at startup.

**Template screenshot library:**
Each template also has a set of pre-rendered screenshots stored in cloud storage (S3/R2):
- `{slug}/home-desktop.png` (1440x900)
- `{slug}/home-mobile.png` (390x844)
- `{slug}/inner-page.png` (representative inner page)

These screenshots are sent to **Gemini** alongside the source site screenshot for visual comparison. Gemini sees all templates at once and picks the closest visual match — layout structure, whitespace, typography feel, color warmth, component density.

**How the AI uses the catalog:**
1. **Gemini** receives source site screenshot + all template screenshots → ranks top 3 visual matches
2. Metadata (industries, style_tags) is used as a tiebreaker / validation layer
3. **GPT-4o** receives the winning template's `content_slots` → generates content that fits the structure

---

## 11. Migration Path from Current Codebase

The existing `wordtosite` code becomes the foundation of the **Domain Service** and **Site Builder Service**:

| Current File           | Becomes                                    |
|------------------------|--------------------------------------------|
| `src/instawp.js`       | `services/siteBuilder.service.ts` (core)   |
| `src/namecheap.js`     | `services/domain.service.ts` (domain reg)  |
| `src/cloudflare.js`    | `services/domain.service.ts` (DNS/SSL)     |
| `src/domain-workflow.js`| `workers/siteCreation.worker.ts` (async)  |
| `src/config.js`        | Absorbed into env config + per-user creds  |
| `src/server.js`        | Replaced by new backend gateway            |
| `public/index.html`    | Replaced by SolidStart frontend            |

---

## 12. Phase Plan

### Phase 1 — Foundation
- Backend Gateway scaffolding (Fastify + TypeScript)
- Auth (JWT + Google OAuth)
- Database schema + migrations (Drizzle + Postgres)
- Port existing InstaWP/Namecheap/Cloudflare clients to TypeScript
- Basic SolidStart app with auth pages + dashboard shell

### Phase 2 — Flow A (Copy Website)
- Crawler service (Playwright)
- AI analysis pipeline (GPT-4o)
- Template catalog + matching logic
- WP REST API content population
- Onboarding UI for URL flow

### Phase 3 — Flow B (Voice Mode)
- Voice capture (frontend MediaRecorder)
- WebSocket audio streaming
- Whisper integration
- Guided Q&A engine (GPT-4o)
- TTS responses
- Onboarding UI for voice flow

### Phase 4 — Chat Editing
- Chat WebSocket infrastructure
- AI intent parsing for edits
- WP REST API executor with action planner
- Edit history + undo
- Chat UI component

### Phase 5 — Billing & Polish
- Stripe integration (checkout, webhooks, portal)
- Plan enforcement (site limits, feature gates)
- Monitoring, error tracking, logging
- Landing page, docs
