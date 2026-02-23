# CLAUDE.md — WordToSite

## Project Overview

WordToSite is an AI-powered Website-as-a-Service (WaaS) platform. Users create, migrate, and manage websites via voice commands and AI — optimized for Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO). No dashboards. No CMS learning curve.

## Tech Stack

- **Runtime:** Node.js (ES modules)
- **Server:** Express 4 with static file serving from `public/`
- **Real-time:** WebSocket (`ws`) for voice transcription
- **AI providers:** OpenAI, Anthropic Claude, Google Gemini (via `src/services/ai-service.js`)
- **Website scraping:** Firecrawl (`src/services/firecrawl-service.js`)
- **Hosting/deploy:** InstaWP for WordPress instances (`src/instawp.js`)
- **DNS/SSL:** Cloudflare API (`src/cloudflare.js`)
- **Domain registration:** Namecheap API (`src/namecheap.js`)
- **File uploads:** Multer
- **XML parsing:** xml2js
- **Config:** dotenv (see `src/.env.example`)
- **Dev:** nodemon for hot reload
- **Container:** Dockerfile for self-hosting
- **Auth:** Basic auth (skipped in development mode)

## Project Structure

```
src/
  server.js              — Express app, routes, SSE endpoints
  config.js              — Env-based configuration
  constants.js           — Shared constants (flows, modes)
  index.js               — InstaWP site creator
  onboarding-workflow.js — Multi-step onboarding orchestration
  domain-workflow.js     — Domain registration + DNS + SSL flow
  cloudflare.js          — Cloudflare DNS/SSL API wrapper
  namecheap.js           — Namecheap domain API wrapper
  instawp.js             — InstaWP deployment API wrapper
  services/
    ai-service.js        — Multi-provider AI content generation
    voice-service.js     — Voice transcription service
    firecrawl-service.js — Website scraping for migration
    wordpress-service.js — WP REST API operations
    editor-service.js    — Content editing service
    excerpt-service.js   — AI excerpt/summary generation
  schemas/               — Data context schemas
  websocket/
    voice-handler.js     — WebSocket voice command handler
public/
  index.html             — Landing page (dark theme, all sections)
  app.html               — Main application UI
  privacy.html, terms.html, mission.html, docs.html, changelog.html — Info pages
```

## Development

```bash
npm install
npm run dev          # starts on localhost:3000 with nodemon
```

Basic auth is disabled when `NODE_ENV=development`.

## Git Workflow Rules

- **Always create a feature branch** before starting work. Branch naming: `feature/<short-description>` (e.g. `feature/testimonials-section`, `feature/voice-onboarding`).
- **Do NOT add `Co-Authored-By` lines** to commit messages. Commits should look like they were written by the developer alone.
- **Commit messages:** concise, imperative mood, focus on "why" not "what". One or two sentences max.
- **Commit frequently** — small, logical chunks. Don't bundle unrelated changes.
- **PR to `main`** when the feature is complete. Keep PRs focused on a single feature or fix.
