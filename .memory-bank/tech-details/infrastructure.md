# Infrastructure

## Environments

| Environment | URL | Branch | Purpose |
|-------------|-----|--------|---------|
| Development | localhost:3000 | feature/* | Local testing (auth disabled) |
| Production | TBD | main | Live |

## CI/CD Pipeline

No CI/CD pipeline detected. Consider adding GitHub Actions for:
- Linting
- Tests
- Docker build
- Deployment

## Containerization

Dockerfile is available in the project root for self-hosting.

## Environment Variables

Required env vars (see `src/.env.example`):

**Core:**
- `PORT` - Server port (default: 3000)
- `INSTA_WP_API_KEY` - InstaWP API key
- `TEMPLATE_SLUG` - InstaWP template (default: flexify)

**Domain Workflow (optional):**
- `NAMECHEAP_API_KEY` - Namecheap domain registration
- `NAMECHEAP_USERNAME` - Namecheap account
- `NAMECHEAP_CLIENT_IP` - Whitelisted IP
- `NAMECHEAP_SANDBOX` - Sandbox mode toggle
- `CLOUDFLARE_API_KEY` - Cloudflare global API key
- `CLOUDFLARE_EMAIL` - Cloudflare account email
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `DOMAIN_CONTACT_*` - Domain registration contact info

**AI & Content (optional):**
- `OPENAI_API_KEY` - OpenAI (GPT-4o, Whisper)
- `GEMINI_API_KEY` - Google Gemini (visual analysis)
- `FIRECRAWL_API_KEY` - Firecrawl (website scraping)

**Feature Flags:**
- `ENABLE_VOICE_FLOW` - Voice interview flow
- `ENABLE_LIGHT_EDITOR` - Chat-based editing
- `ENABLE_AI_CONTENT` - AI content generation
