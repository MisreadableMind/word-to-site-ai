# Tech Stack

## Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | ES modules | Runtime |
| Express | ^4.18.2 | HTTP server, routing, static files |
| ws | ^8.19.0 | WebSocket for voice transcription |
| pg | ^8.13.0 | PostgreSQL database client |
| axios | ^1.6.0 | HTTP client for external APIs |
| multer | ^2.0.2 | File upload handling |
| xml2js | ^0.6.2 | XML parsing (Namecheap API) |
| dotenv | ^16.3.1 | Environment variable management |

## Frontend

| Technology | Purpose |
|------------|---------|
| Vanilla HTML/CSS/JS | Static pages served from `public/` |

## AI Providers

| Provider | Purpose |
|----------|---------|
| OpenAI (GPT-4o) | Content generation, Whisper voice transcription |
| Anthropic Claude | AI content generation |
| Google Gemini | Visual analysis (1M+ token context) |

## External Services

| Service | Purpose |
|---------|---------|
| InstaWP | WordPress site provisioning and hosting |
| Cloudflare | DNS management, SSL certificates |
| Namecheap | Domain registration |
| Firecrawl | Website scraping for migration |

## Infrastructure

| Technology | Purpose |
|------------|---------|
| Docker | Containerization (Dockerfile provided) |
| nodemon | Development hot reload |

## Why These Choices?

- **Express + vanilla frontend**: Keeps the stack simple — no build step, fast iteration
- **Multi-provider AI**: Flexibility to use the best model for each task (GPT-4o for content, Gemini for visual analysis)
- **InstaWP + WordPress**: Proven CMS with extensive REST API, managed hosting reduces ops burden
- **Cloudflare + Namecheap**: Full domain lifecycle automation from registration to SSL
