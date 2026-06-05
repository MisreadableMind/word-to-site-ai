import { createFileRoute, Link } from "@tanstack/react-router";
import "~/styles/docs.css";

export const Route = createFileRoute("/_marketing/docs")({
  component: Docs,
  head: () => ({
    meta: [
      { title: "Documentation | WordToSite" },
      {
        name: "description",
        content:
          "WordToSite documentation. Get started, learn features, and deploy your first AI-optimized website.",
      },
    ],
  }),
});

const SELF_HOST_CODE_HTML = `git clone https://github.com/wordtosite/wordtosite.git<br>
cp .env.example .env<br>
# Add your API keys to .env<br>
docker build -t wordtosite .<br>
docker run -p 3000:3000 --env-file .env wordtosite`;

function Docs() {
  return (
    <main className="page-content">
      <h1 className="page-title">Documentation</h1>
      <p className="page-subtitle">
        Everything you need to create, migrate, and manage AI-optimized websites with WordToSite.
      </p>

      <div className="page-section">
        <h2>Quick Start</h2>
        <p>Get your first website live in under 60 seconds.</p>
        <ol className="step-list">
          <li>
            Go to the <Link to="/app">WordToSite dashboard</Link> and sign in.
          </li>
          <li>
            Choose your path: <strong>Migrate</strong> an existing site, <strong>Create by voice</strong>, or{" "}
            <strong>Start from scratch</strong>.
          </li>
          <li>
            Follow the guided flow. AI handles content generation, schema markup, and deployment.
          </li>
          <li>Your site is live with AEO/GEO optimization, SSL, and a custom domain.</li>
        </ol>
      </div>

      <div className="page-section">
        <h2>Path 1: Migrate an Existing Site</h2>
        <p>
          Paste your current website URL. WordToSite uses Firecrawl to scrape your site's content,
          structure, branding, and assets. AI then rebuilds it with proper schema markup, semantic HTML,
          and GEO optimization.
        </p>
        <h3>What gets migrated</h3>
        <ul>
          <li>Page content and structure</li>
          <li>Brand colors, fonts, and visual identity</li>
          <li>Images and media assets</li>
          <li>Navigation and page hierarchy</li>
        </ul>
        <h3>What gets added</h3>
        <ul>
          <li>Schema.org structured data (Organization, LocalBusiness, FAQ, etc.)</li>
          <li>AEO-optimized content structure</li>
          <li>Open Graph and social meta tags</li>
          <li>Automatic SSL and DNS via Cloudflare</li>
        </ul>
      </div>

      <div className="page-section">
        <h2>Path 2: Create by Voice</h2>
        <p>
          Tap the mic, describe your business or idea, and WordToSite transcribes your voice in real-time.
          AI interprets your intent and generates a complete website.
        </p>
        <h3>Voice commands for management</h3>
        <ul>
          <li>
            <code>"Update the homepage heading to say we're hiring"</code>
          </li>
          <li>
            <code>"Write a blog post about our product launch"</code>
          </li>
          <li>
            <code>"Change the primary color to blue"</code>
          </li>
          <li>
            <code>"Add a pricing section with three tiers"</code>
          </li>
        </ul>
      </div>

      <div className="page-section">
        <h2>Path 3: Start from Scratch</h2>
        <p>
          Answer a few questions about your business: name, industry, target audience, and key services.
          AI generates everything: content, structure, schema markup, and design. Review, tweak, and deploy.
        </p>
      </div>

      <div className="page-section">
        <h2>AI Providers</h2>
        <p>WordToSite uses multiple AI providers for different capabilities:</p>
        <ul>
          <li>
            <strong>OpenAI (ChatGPT):</strong> Content generation, copywriting, and text optimization.
          </li>
          <li>
            <strong>Anthropic (Claude):</strong> Reasoning, content analysis, and structured data generation.
          </li>
          <li>
            <strong>Google (Gemini):</strong> Visual analysis, long-context understanding, and multimodal tasks.
          </li>
        </ul>
      </div>

      <div className="page-section">
        <h2>Domain &amp; SSL</h2>
        <p>
          WordToSite automatically provisions SSL certificates and configures DNS through Cloudflare. When
          you connect a custom domain:
        </p>
        <ol>
          <li>We create a DNS zone on Cloudflare.</li>
          <li>DNS records are configured automatically.</li>
          <li>SSL certificate is provisioned and renewed automatically.</li>
          <li>Your site is accessible via HTTPS immediately.</li>
        </ol>
      </div>

      <div className="page-section">
        <h2>Self-Hosting</h2>
        <p>
          WordToSite can run on your own infrastructure. Clone the repository, provide your own API keys,
          and deploy with Docker.
        </p>
        <div className="code-block" dangerouslySetInnerHTML={{ __html: SELF_HOST_CODE_HTML }} />
        <p>
          Required API keys: OpenAI, Anthropic, Google Gemini, Cloudflare, InstaWP. Optional: Firecrawl (for
          migration).
        </p>
      </div>

      <div className="page-section">
        <h2>AEO &amp; GEO Explained</h2>
        <p>
          <strong>AEO (Answer Engine Optimization)</strong> structures your content so that answer engines
          like Google's Featured Snippets can extract and display your information directly in search results.
        </p>
        <p>
          <strong>GEO (Generative Engine Optimization)</strong> optimizes your content for AI-powered search
          engines like ChatGPT, Claude, Perplexity, and Gemini, which generate answers by referencing and
          citing your website.
        </p>
        <p>
          WordToSite implements both automatically: clean semantic HTML, proper heading hierarchy, Schema.org
          JSON-LD, FAQ structured data, and content formatted for AI extraction.
        </p>
      </div>
    </main>
  );
}
