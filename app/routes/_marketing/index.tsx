import { createFileRoute, Link } from "@tanstack/react-router";
import { Faq, type FaqItem } from "~/components/Faq";

export const Route = createFileRoute("/_marketing/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "WordToSite — Websites for the zero-click internet" },
      {
        name: "description",
        content:
          "Search is going zero-click. WordToSite builds AEO- and GEO-optimized websites by voice — no dashboards, no CMS. Migrate any site or create one by talking.",
      },
    ],
  }),
});

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'What are AEO, GEO, and the "zero-click internet"?',
    a: "Over 60% of Google searches now end without a click. AI assistants like ChatGPT, Perplexity, and Google's AI Overviews answer questions by pulling from your website directly. AEO (Answer Engine Optimization) means structuring your content so answer engines can find and cite you. GEO (Generative Engine Optimization) means optimizing for AI-generated search results. Your content matters more than ever, but visitors may never actually visit your page. WordToSite builds websites with AEO and GEO from day one: clean semantic HTML, proper schema markup, and content structured for AI extraction.",
  },
  {
    q: "I already have a website. Why would I switch?",
    a: "You don't have to abandon your existing site. Paste your URL, and we'll analyze everything: your brand, content, colors, page structure. Then rebuild it on modern infrastructure. Same brand, same message, but now with AEO-ready structured data, GEO-optimized content, automatic SSL, and the ability to manage it all by voice. Think of it as migrating your website to the future.",
  },
  {
    q: "How does voice management work?",
    a: 'Open WordToSite on your phone. Tap the mic. Say "Update the homepage heading to say we\'re hiring" or "Write a blog post about our new product launch." Your voice is transcribed in real-time, AI interprets your intent and generates the changes, and you tap one button to publish. No wp-admin. No laptop. No learning curve.',
  },
  {
    q: "Can I actually manage my site from my phone?",
    a: "Yes. That's the entire point. Traditional CMS dashboards were designed for desktop. WordToSite is designed for the way you actually work. On your phone, between meetings, on the go. Voice commands for quick edits, a mobile-first interface for reviewing changes, and an AI that understands context so you don't have to navigate menus.",
  },
  {
    q: "Is this just another WordPress wrapper?",
    a: "WordPress is the engine, not the interface. You never need to see wp-admin unless you want to. It's always there if you do. WordToSite is an AI orchestration layer powered by OpenAI, Anthropic Claude, and Google Gemini for content and intelligence, Firecrawl for scraping, Cloudflare for DNS, and InstaWP for hosting. WordPress is a battle-tested runtime for websites. We handle everything on top.",
  },
  {
    q: "What's the tech stack?",
    a: "AI from the best labs in the world: OpenAI ChatGPT for content, Anthropic Claude for reasoning, Google Gemini for visual analysis and long-context understanding. Firecrawl for web scraping. Cloudflare for DNS and SSL. InstaWP for WordPress deployment. Real-time voice via WebSocket, live deployment progress via Server-Sent Events. All wrapped in a simple UI. You don't need to know any of this to use it.",
  },
  {
    q: "Can I self-host this?",
    a: "Yes. WordToSite can run on your own infrastructure. You bring your own API keys for the AI services you want to use (OpenAI, Anthropic, Gemini, Cloudflare, etc.) and the platform runs entirely under your control. No vendor lock-in. Your data, your keys, your servers. We'll have a simple setup wizard to get you going in minutes.",
  },
];

const SC_NAV = (
  <div className="sc-nav">
    <div className="sc-nav-logo">
      <div className="sc-nav-icon" />
      <div className="sc-nav-text" />
    </div>
    <div className="sc-nav-links">
      <div className="sc-nav-link" />
      <div className="sc-nav-link" />
    </div>
  </div>
);

const SC_3COLS = (
  <div className="sc-3cols">
    {[0, 1, 2].map((i) => (
      <div className="sc-3col-block" key={i}>
        <div className="sc-3col-icon" />
        <div className="sc-3col-line" />
        <div className="sc-3col-line2" />
      </div>
    ))}
  </div>
);

const SHOWCASE_CARDS: { theme: string; url: string; body: React.ReactNode }[] = [
  {
    theme: "sc-theme-indigo",
    url: "acme-saas.com",
    body: (
      <>
        {SC_NAV}
        <div className="sc-hero-block">
          <div className="sc-hero-title" />
          <div className="sc-hero-sub" />
          <div className="sc-hero-btn" />
        </div>
        {SC_3COLS}
      </>
    ),
  },
  {
    theme: "sc-theme-pink",
    url: "studio-portfolio.com",
    body: (
      <>
        {SC_NAV}
        <div className="sc-img-block" />
        <div className="sc-cols">
          <div className="sc-col-block" />
          <div className="sc-col-block" />
        </div>
        <div className="sc-cols">
          <div className="sc-col-block" />
          <div className="sc-col-block" />
        </div>
      </>
    ),
  },
  {
    theme: "sc-theme-green",
    url: "greenbowl-cafe.com",
    body: (
      <>
        {SC_NAV}
        <div className="sc-hero-block">
          <div className="sc-hero-title" />
          <div className="sc-hero-sub" />
          <div className="sc-hero-btn" />
        </div>
        <div className="sc-text-lines">
          <div className="sc-text-line" style={{ width: "90%" }} />
          <div className="sc-text-line" style={{ width: "75%" }} />
          <div className="sc-text-line" style={{ width: "60%" }} />
        </div>
      </>
    ),
  },
  {
    theme: "sc-theme-yellow",
    url: "urban-threads.shop",
    body: (
      <>
        {SC_NAV}
        <div className="sc-img-block" />
        {SC_3COLS}
      </>
    ),
  },
  {
    theme: "sc-theme-orange",
    url: "spark-agency.co",
    body: (
      <>
        {SC_NAV}
        <div className="sc-hero-block">
          <div className="sc-hero-title" />
          <div className="sc-hero-sub" />
        </div>
        <div className="sc-cols">
          <div className="sc-col-block" />
          <div className="sc-col-block" />
        </div>
        <div className="sc-text-lines">
          <div className="sc-text-line" style={{ width: "85%" }} />
          <div className="sc-text-line" style={{ width: "70%" }} />
        </div>
      </>
    ),
  },
  {
    theme: "sc-theme-indigo",
    url: "daily-thoughts.blog",
    body: (
      <>
        {SC_NAV}
        <div className="sc-img-block" />
        <div className="sc-text-lines">
          <div className="sc-text-line" style={{ width: "95%" }} />
          <div className="sc-text-line" style={{ width: "80%" }} />
          <div className="sc-text-line" style={{ width: "90%" }} />
          <div className="sc-text-line" style={{ width: "65%" }} />
        </div>
      </>
    ),
  },
];

const AEO_CODE_HTML = `<span class="hl-comment">&lt;!-- AEO: Structured data for answer engines --&gt;</span>
<span class="hl-tag">&lt;script</span> <span class="hl-attr">type</span>=<span class="hl-str">"application/ld+json"</span><span class="hl-tag">&gt;</span>
{
  <span class="hl-key">"@context"</span>: <span class="hl-str">"schema.org"</span>,
  <span class="hl-key">"@type"</span>: <span class="hl-str">"LocalBusiness"</span>,
  <span class="hl-key">"name"</span>: <span class="hl-str">"Your Business"</span>,
  <span class="hl-key">"description"</span>: <span class="hl-str">"..."</span>,
  <span class="hl-key">"address"</span>: { ... },
  <span class="hl-key">"openingHours"</span>: <span class="hl-str">"Mo-Fr 09:00-17:00"</span>
}
<span class="hl-tag">&lt;/script&gt;</span>

<span class="hl-tag">&lt;article</span> <span class="hl-attr">itemscope</span>
  <span class="hl-attr">itemtype</span>=<span class="hl-str">"schema.org/Service"</span><span class="hl-tag">&gt;</span>
  <span class="hl-tag">&lt;h1</span> <span class="hl-attr">itemprop</span>=<span class="hl-str">"name"</span><span class="hl-tag">&gt;</span>Web Design<span class="hl-tag">&lt;/h1&gt;</span>
  <span class="hl-tag">&lt;p</span> <span class="hl-attr">itemprop</span>=<span class="hl-str">"description"</span><span class="hl-tag">&gt;</span>
    Professional web design for
    small businesses...
  <span class="hl-tag">&lt;/p&gt;</span>
  <span class="hl-tag">&lt;span</span> <span class="hl-attr">itemprop</span>=<span class="hl-str">"price"</span><span class="hl-tag">&gt;</span>$499<span class="hl-tag">&lt;/span&gt;</span>
<span class="hl-tag">&lt;/article&gt;</span>

<span class="hl-comment">&lt;!-- GEO: Semantic HTML for generative AI --&gt;</span>
<span class="hl-tag">&lt;nav</span> <span class="hl-attr">aria-label</span>=<span class="hl-str">"main"</span><span class="hl-tag">&gt;</span>...<span class="hl-tag">&lt;/nav&gt;</span>
<span class="hl-tag">&lt;main</span> <span class="hl-attr">role</span>=<span class="hl-str">"main"</span><span class="hl-tag">&gt;</span>...<span class="hl-tag">&lt;/main&gt;</span>
<span class="hl-tag">&lt;meta</span> <span class="hl-attr">name</span>=<span class="hl-str">"robots"</span>
  <span class="hl-attr">content</span>=<span class="hl-str">"max-snippet:-1"</span><span class="hl-tag"> /&gt;</span>`;

const ARROW = (
  <svg className="shift-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const SHIFT_ROWS: [string, string][] = [
  ["Browse 200 themes", "AI picks your template"],
  ["Write all your copy", "Describe it, we write it"],
  ["Configure DNS yourself", "Domain + SSL, handled"],
  ["Open wp-admin", '"Update the homepage"'],
  ["Sit at your desk", "Manage from your phone"],
];

const HOOD_CARDS = [
  { bg: "--accent-dim", fg: "--accent", title: "Firecrawl Scraping", desc: "Deep-crawl any site. Extract content, brand elements, color palettes, and page structures automatically.", tag: "website analysis", icon: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></> },
  { bg: "--green-dim", fg: "--green", title: "Whisper + WebSocket", desc: "Real-time voice transcription via WebSocket. Stream audio, get text back instantly. Works on mobile browsers.", tag: "voice pipeline", icon: <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></> },
  { bg: "--yellow-dim", fg: "--yellow", title: "Multi-AI Content Engine", desc: "Page copy, blog posts, and meta descriptions generated by top-tier AI labs: OpenAI ChatGPT, Anthropic Claude, and Google Gemini.", tag: "content gen", icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  { bg: "--pink-dim", fg: "--pink", title: "Gemini Vision", desc: "Visual layout analysis with Google Gemini's 1M+ token context. Understands your site's design, not just its code.", tag: "visual AI", icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></> },
  { bg: "--orange-dim", fg: "--orange", title: "Cloudflare DNS + SSL", desc: "Automatic DNS zone creation, record management, and SSL provisioning. Zero manual nameserver config.", tag: "infrastructure", icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> },
  { bg: "--accent-dim", fg: "--accent", title: "InstaWP Deploy", desc: "Full WordPress instances in seconds. Template-based. No servers to manage. Auto-configured with your content.", tag: "deploy", icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /> },
];

const COMPARE_ROWS: [string, string][] = [
  ["No AEO / Schema markup", "AEO & Schema markup"],
  ["No GEO optimization", "GEO optimization"],
  ["No voice management", "Voice management"],
  ["Manual SSL & DNS", "Auto SSL & DNS"],
  ["No AI content generation", "AI content generation"],
  ["Desktop-first editing", "Mobile-first editing"],
  ["Complex dashboards", "Dashboard-free"],
  ["Slow deploy cycles", "60-second deploys"],
];

const CITATIONS = [
  { icon: "G", style: { background: "#4285F4", color: "#fff" }, platform: "Google Featured Snippet", label: "Featured answer", labelColor: "var(--text-muted)", prefix: "Source:", src: "bellasbakery.com", body: <><strong>Bella's Bakery</strong> is a family-owned artisan bakery in Portland, OR specializing in sourdough breads and French pastries. Open Tuesday through Sunday, 7 AM to 6 PM.</> },
  { icon: "C", style: { background: "#10A37F", color: "#fff" }, platform: "ChatGPT", label: "Answer", labelColor: "#10A37F", prefix: "Referenced:", src: "bellasbakery.com/wedding-cakes", body: <>Based on their website, <strong>Bella's Bakery</strong> offers custom wedding cakes starting at $150. They use locally sourced organic flour and offer gluten-free options.</> },
  { icon: "A", style: { background: "linear-gradient(135deg,#D97706,#CA8A04)", color: "#fff" }, platform: "Claude", label: "Response", labelColor: "#D97706", prefix: "Cited:", src: "bellasbakery.com/menu", body: <>According to <strong>Bella's Bakery</strong>, their most popular items include the San Francisco-style sourdough loaf and the seasonal fruit tarts made with organic ingredients.</> },
  { icon: "G", style: { background: "linear-gradient(135deg,#4285F4,#34A853)", color: "#fff" }, platform: "Gemini", label: "AI Overview", labelColor: "#4285F4", prefix: "From:", src: "bellasbakery.com/about", body: <><strong>Bella's Bakery</strong> in Portland has a 4.9-star rating. Reviewers highlight the artisan sourdough and welcoming atmosphere. They also offer baking classes on weekends.</> },
];

const TESTIMONIALS = [
  { quote: "I rebuilt my entire agency portfolio in 20 minutes. The AEO markup alone would have taken my dev team a week. Now our clients show up in AI search results.", avatar: "linear-gradient(135deg,#818CF8,#6366F1)", name: "Sarah Chen", role: "Founder, Pixel & Co Agency" },
  { quote: "Voice management is a game-changer. I updated my restaurant menu from my phone while prepping for dinner service. Said it, reviewed it, published. Done.", avatar: "linear-gradient(135deg,#34D399,#059669)", name: "Marcus Rivera", role: "Owner, The Green Fork" },
  { quote: "We migrated 12 client sites in a single afternoon. Pasted the URLs, WordToSite analyzed everything, and rebuilt them with proper schema. Our SEO metrics jumped 40%.", avatar: "linear-gradient(135deg,#F472B6,#DB2777)", name: "Priya Patel", role: "Digital Strategist, BrightPath" },
  { quote: "I'm not technical at all. I described my coaching business in a voice note and had a full website live in 60 seconds. My clients find me through ChatGPT now.", avatar: "linear-gradient(135deg,#FBBF24,#D97706)", name: "James Okafor", role: "Life Coach & Speaker" },
  { quote: "The zero-dashboard approach sold me. No more logging into wp-admin, no more plugin updates. I just talk to my site and it does what I want. This is the future.", avatar: "linear-gradient(135deg,#FB923C,#EA580C)", name: "Lena Vogt", role: "Freelance Designer, Berlin" },
  { quote: "We white-label WordToSite for our agency clients. They get AI-optimized sites, we get recurring revenue, and nobody touches a CMS dashboard. Everyone wins.", avatar: "linear-gradient(135deg,#A78BFA,#7C3AED)", name: "Tom Andersen", role: "CEO, Nordic Digital" },
];

function Home() {
  const cards = [...SHOWCASE_CARDS, ...SHOWCASE_CARDS];
  return (
    <>
      <header className="hero">
        <div className="hero-eyebrow">Building for the post-dashboard era</div>
        <h1>
          Websites for the<br />
          <span className="gradient">zero-click internet.</span>
        </h1>
        <p className="hero-sub">
          Search is going zero-click. AI answers questions before anyone visits your page. Your website needs AEO and GEO to stay visible, and you shouldn't need a dashboard to make it happen.
        </p>
        <div className="hero-actions">
          <Link className="btn-hero btn-hero-primary" to="/app">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Create your site
          </Link>
          <a className="btn-hero btn-hero-secondary" href="#paths">See how it works</a>
          <Link className="btn-hero btn-hero-secondary" to="/pricing">Pricing</Link>
        </div>
        <p className="hero-hint">No code. No dashboards. Just talk and we build.</p>

        <div className="hero-showcase">
          <div className="showcase-row">
            <div className="showcase-track">
              {cards.map((card, i) => (
                <div className={`showcase-card ${card.theme}`} key={i}>
                  <div className="showcase-browser-bar">
                    <span className="showcase-dots"><span /><span /><span /></span>
                    <span className="showcase-url">{card.url}</span>
                  </div>
                  <div className="showcase-body">{card.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="trust-bar">
        <div className="trust-bar-inner">
          <span className="trust-label">Powered by</span>
          <div className="trust-logos">
            <span className="trust-logo">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" /></svg>
              OpenAI
            </span>
            <span className="trust-logo">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.304 2.016H6.696C4.212 2.016 2.016 4.212 2.016 6.696v10.608c0 2.484 2.196 4.68 4.68 4.68h10.608c2.484 0 4.68-2.196 4.68-4.68V6.696c0-2.484-2.196-4.68-4.68-4.68zm-4.32 14.784h-1.2V8.4h-2.4v7.2h-1.2V8.4a1.2 1.2 0 0 1 1.2-1.2h2.4a1.2 1.2 0 0 1 1.2 1.2v8.4zm3.6 0h-1.2v-4.8h-1.2v-1.2h1.2V9.6h1.2v1.2h1.2v1.2h-1.2v4.8z" /></svg>
              Anthropic
            </span>
            <span className="trust-logo">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
              Gemini
            </span>
            <span className="trust-logo">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5088 16.8447C15.981 17.0258 15.27 17.1936 14.3811 17.3541L13.881 14.5765L16.5088 16.8447ZM7.49121 16.8447L10.1191 14.5765L9.61893 17.3541C8.72998 17.1936 8.01904 17.0258 7.49121 16.8447ZM12 3.8073L8.59473 10.4141H15.4053L12 3.8073ZM4.14844 13.9688C3.70898 13.1406 3.41992 12.2598 3.28418 11.3438L6.3252 14.0039L4.14844 13.9688ZM20.6748 11.3438C20.5391 12.2598 20.2501 13.1406 19.8115 13.9688L17.6748 14.0039L20.6748 11.3438ZM12 21.6C10.3477 21.6 8.74805 21.1898 7.30078 20.4023L9.87891 18.5039L12 21.1875L14.1211 18.5039L16.6992 20.4023C15.252 21.1898 13.6523 21.6 12 21.6Z" /></svg>
              Cloudflare
            </span>
          </div>
        </div>
      </div>

      <div className="manifesto">
        <div className="manifesto-track">
          {[
            ["purple", "No dashboards"], ["green", "Voice-first management"], ["pink", "Migrate from any website"], ["yellow", "AEO + GEO optimized"], ["orange", "Manage from your phone"], ["purple", "Auto SSL + custom domains"], ["green", "60-second deploys"], ["pink", "Schema markup built-in"],
            ["purple", "No dashboards"], ["green", "Voice-first management"], ["pink", "Migrate from any website"], ["yellow", "AEO + GEO optimized"], ["orange", "Manage from your phone"], ["purple", "Auto SSL + custom domains"], ["green", "60-second deploys"], ["pink", "Schema markup built-in"],
          ].map(([dot, label], i) => (
            <span className="manifesto-item" key={i}>
              <span className={`mi-dot ${dot}`} /> {label}
            </span>
          ))}
        </div>
      </div>

      <section id="vision" className="border-t">
        <div className="section-container">
          <div className="shift-layout fade-in">
            <div className="section-eyebrow">the shift</div>
            <h3 className="shift-headline">The internet changed.<br />Website creation didn't.</h3>
            <p className="shift-body">
              Most searches now end before anyone clicks a link. AI reads your site so humans don't have to. Your site needs Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO) to stay visible. But theme hunting, block dragging, dashboard wrangling? That was designed for a different era.
            </p>
            <div className="shift-comparison">
              {SHIFT_ROWS.map(([oldv, newv], i) => (
                <div className="shift-row" key={i}>
                  <div className="shift-old">{oldv}</div>
                  {ARROW}
                  <div className="shift-new">{newv}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">the difference</div>
            <h2 className="section-title">AEO + GEO, built in.</h2>
            <p className="section-desc">Your visitors see a beautiful page. Answer engines and generative AI see clean, structured data. WordToSite builds for both. Automatically.</p>
          </div>
          <div className="dual-view fade-in">
            <div className="view-card">
              <div className="view-label">What your visitors see</div>
              <div className="view-browser">
                <div className="browser-bar">
                  <span className="browser-dots"><span /><span /><span /></span>
                  <span className="browser-url">yourbusiness.com</span>
                </div>
                <div className="browser-body">
                  <div className="mock-nav">
                    <div className="mock-logo"><div className="mock-logo-icon" /><div className="mock-logo-text" /></div>
                    <div className="mock-nav-links"><div className="mock-nav-link" /><div className="mock-nav-link" /><div className="mock-nav-link" /></div>
                    <div className="mock-nav-btn" />
                  </div>
                  <div className="mock-hero">
                    <div className="mock-hero-title" /><div className="mock-hero-sub" /><div className="mock-hero-cta" />
                  </div>
                  <div className="mock-section-label" />
                  <div className="mock-section-title" />
                  <div className="mock-cards">
                    {[0, 1, 2].map((i) => (
                      <div className="mock-card" key={i}>
                        <div className="mock-card-icon" /><div className="mock-card-title" /><div className="mock-card-desc" /><div className="mock-card-desc2" />
                      </div>
                    ))}
                  </div>
                  <div className="mock-testimonial">
                    <div className="mock-avatar" />
                    <div className="mock-testimonial-lines"><div className="mock-testimonial-line" /><div className="mock-testimonial-line" /><div className="mock-testimonial-line" /></div>
                  </div>
                  <div className="mock-footer">
                    <div className="mock-footer-logo" />
                    <div className="mock-footer-links"><div className="mock-footer-link" /><div className="mock-footer-link" /><div className="mock-footer-link" /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="view-card">
              <div className="view-label view-label-ai">What answer engines see (AEO/GEO)</div>
              <div className="view-code">
                <pre dangerouslySetInnerHTML={{ __html: AEO_CODE_HTML }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="paths" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">get started</div>
            <h2 className="section-title">Two paths. One destination.</h2>
            <p className="section-desc">Whether you're migrating an existing website or building from scratch, you're 60 seconds from production.</p>
          </div>
          <div className="paths-grid fade-in">
            <div className="path-card">
              <div className="path-icon migrate">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
              </div>
              <div className="path-label">I have a website</div>
              <h3 className="path-title">Bring your old site<br />into the new internet</h3>
              <p className="path-desc">Paste your URL. Our AI scrapes it, extracts your brand, analyzes your layout, and rebuilds it. AEO-ready with structured data, schema markup, and content optimized for answer engines.</p>
              <div className="path-steps">
                <div className="path-step"><span className="path-step-num">1</span> Paste your current website URL</div>
                <div className="path-step"><span className="path-step-num">2</span> AI extracts brand, content, structure</div>
                <div className="path-step"><span className="path-step-num">3</span> Template matched, content regenerated</div>
                <div className="path-step"><span className="path-step-num">4</span> Live site with your custom domain</div>
              </div>
              <Link className="path-cta" to="/app">
                Migrate my site
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="path-card">
              <div className="path-icon voice">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
              </div>
              <div className="path-label">I need a new website</div>
              <h3 className="path-title">Just talk.<br />We'll build it.</h3>
              <p className="path-desc">Answer 8 quick questions by voice or text, from your laptop or phone. Our AI builds your complete site brief, picks the right template, and generates all your content.</p>
              <div className="path-steps">
                <div className="path-step"><span className="path-step-num">1</span> Answer questions by voice or text</div>
                <div className="path-step"><span className="path-step-num">2</span> AI builds your business brief</div>
                <div className="path-step"><span className="path-step-num">3</span> Template, content, and features selected</div>
                <div className="path-step"><span className="path-step-num">4</span> Production site deployed instantly</div>
              </div>
              <Link className="path-cta" to="/app">
                Start talking
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="voice" className="border-t">
        <div className="section-container">
          <div className="voice-grid fade-in">
            <div className="voice-mockup">
              <div className="phone-notch" />
              <div className="phone-body">
                <div className="phone-header">
                  <h4>WordToSite</h4>
                  <p>Managing your-business.com</p>
                </div>
                <div className="phone-wave">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => <div className="wave-bar" key={i} />)}
                </div>
                <div className="phone-transcript">
                  <div className="t-label">You said:</div>
                  "Update the homepage hero to say we now serve Europe. Add a blog post about our expansion."
                </div>
                <div className="phone-actions">
                  <div className="phone-btn secondary">Redo</div>
                  <div className="phone-btn primary">Apply changes</div>
                </div>
              </div>
            </div>
            <div className="voice-info">
              <div className="section-eyebrow">voice-first</div>
              <h3>Your website, managed<br />from your pocket.</h3>
              <p>No more opening a laptop to update a heading. No more learning wp-admin. Talk to your website like you'd talk to a colleague. From your phone, on the bus, between meetings.</p>
              <p>This is where website management is going. We're just building it first.</p>
              <div className="voice-capabilities">
                <div className="voice-cap">
                  <div className="voice-cap-icon v1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </div>
                  <div className="voice-cap-text"><h4>Edit by speaking</h4><p>"Change the tagline to 'Built for speed'". Done.</p></div>
                </div>
                <div className="voice-cap">
                  <div className="voice-cap-icon v2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                  </div>
                  <div className="voice-cap-text"><h4>Create content by voice</h4><p>"Write a blog post about our new pricing". Published.</p></div>
                </div>
                <div className="voice-cap">
                  <div className="voice-cap-icon v3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                  </div>
                  <div className="voice-cap-text"><h4>Fully mobile</h4><p>No desktop required. Manage everything from your phone.</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="tech" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">under the hood</div>
            <h2 className="section-title">Boring tech. Wild results.</h2>
            <p className="section-desc">A clean UI that orchestrates AI from the world's best labs, handles DNS, and deploys WordPress. So you never have to.</p>
          </div>
          <div className="hood-grid fade-in">
            {HOOD_CARDS.map((c, i) => (
              <div className="hood-card" key={i}>
                <div className="hood-icon" style={{ background: `var(${c.bg})`, color: `var(${c.fg})` }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{c.icon}</svg>
                </div>
                <h3 className="hood-title">{c.title}</h3>
                <p className="hood-desc">{c.desc}</p>
                <span className="hood-tag">{c.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">the comparison</div>
            <h2 className="section-title">Regular websites vs WordToSite</h2>
            <p className="section-desc">Everything your current site is missing, built in from day one.</p>
          </div>
          <div className="compare-table fade-in">
            <div className="compare-header">
              <div className="compare-header-cell">Regular websites</div>
              <div className="compare-header-cell">WordToSite</div>
            </div>
            {COMPARE_ROWS.map(([no, yes], i) => (
              <div className="compare-row" key={i}>
                <div className="compare-cell"><span className="compare-x">&#x2717;</span> {no}</div>
                <div className="compare-cell"><span className="compare-check">&#x2713;</span> {yes}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">visibility</div>
            <h2 className="section-title">Where your site appears</h2>
            <p className="section-desc">AEO and GEO-optimized sites get cited by AI engines. Here's what that looks like.</p>
          </div>
          <div className="citation-grid fade-in">
            {CITATIONS.map((c, i) => (
              <div className="citation-card" key={i}>
                <div className="citation-header">
                  <div className="citation-icon" style={c.style}>{c.icon}</div>
                  <span className="citation-platform">{c.platform}</span>
                </div>
                <div className="citation-body">
                  <div className="citation-label" style={{ color: c.labelColor }}>{c.label}</div>
                  <p className="citation-text">{c.body}</p>
                  <div className="citation-source">
                    <span>{c.prefix}</span>
                    <span className="citation-source-link">{c.src}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">what people say</div>
            <h2 className="section-title">Trusted by builders who ship</h2>
            <p className="section-desc">Founders, freelancers, and agencies who switched to WordToSite.</p>
          </div>
          <div className="testimonials-grid fade-in">
            {TESTIMONIALS.map((t, i) => (
              <div className="testimonial-card" key={i}>
                <div className="testimonial-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <p className="testimonial-quote">"{t.quote}"</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar" style={{ background: t.avatar }} />
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">faq</div>
            <h2 className="section-title">Questions you're thinking</h2>
          </div>
          <Faq items={FAQ_ITEMS} />
        </div>
      </section>

      <section className="border-t cta-section">
        <div className="section-container">
          <div className="fade-in">
            <h2 className="cta-title">The web moved on.<br />Your website should too.</h2>
            <p className="cta-desc">Migrate your existing site or create one by talking to it. AEO and GEO-ready from the first deploy.</p>
            <div className="cta-actions">
              <Link className="btn-hero btn-hero-primary" to="/app">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                Create your site
              </Link>
              <a className="btn-hero btn-hero-secondary" href="#faq">Read FAQ</a>
            </div>
            <div className="cta-powered">
              Powered by AI from
              <span className="cta-lab">OpenAI</span>
              <span className="cta-dot" />
              <span className="cta-lab">Anthropic</span>
              <span className="cta-dot" />
              <span className="cta-lab">Google</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
