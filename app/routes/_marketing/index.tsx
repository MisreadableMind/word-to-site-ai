import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Faq, type FaqItem } from "~/components/Faq";
import "~/styles/pricing.css";
import "~/styles/landing.css";

export const Route = createFileRoute("/_marketing/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "WordToSite — Client-ready WordPress sites in about a minute" },
      {
        name: "description",
        content:
          "Pick a design, add your client's details, and AI fills a live, polished WordPress site with tailored copy and images. 200 designs, shareable preview URLs, and you only pay while a site is live. Built for WordPress studios, agencies & freelancers.",
      },
    ],
  }),
});

/* ─── Hero showcase (scrolling demo-site cards) ─── */

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
    url: "vista-dental.wordtosite.app",
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
    url: "metro-salon.wordtosite.app",
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
    url: "bloom-cafe.wordtosite.app",
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
    url: "urban-eats.wordtosite.app",
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
    url: "harbor-law.wordtosite.app",
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
    url: "iron-gym.wordtosite.app",
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

/* ─── Why studios use it ─── */

const TRIO_CARDS = [
  {
    bg: "--accent-dim",
    fg: "--accent",
    title: "Instant, not blank",
    desc: "Every page comes pre-filled with copy and images written around your client's business — not placeholder text. Ready to present in about a minute.",
    icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  },
  {
    bg: "--pink-dim",
    fg: "--pink",
    title: "200 designs to choose from",
    desc: "A polished design for almost any niche — clinics, cafés, gyms, law firms, shops and more. Pick one and it deploys live, fully styled.",
    icon: (
      <>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </>
    ),
  },
  {
    bg: "--green-dim",
    fg: "--green",
    title: "Pay only for what's live",
    desc: "Run several client projects at once. The moment a client decides — or you're done — delete the site and billing for it stops on the spot.",
    icon: (
      <>
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </>
    ),
  },
];

/* ─── How it works ─── */

const HOW_STEPS = [
  {
    n: "1",
    title: "Add your client's basics",
    desc: "Business name, what they do, tone, a few details. This is the context the AI writes from.",
  },
  {
    n: "2",
    title: "Choose a design",
    desc: "Browse 200 ready-made designs and pick the one that fits your client's industry and style.",
  },
  {
    n: "3",
    title: "AI builds & fills it — live",
    desc: "The site is deployed to a live preview URL and AI generates tailored texts and images across every page. No hosting setup on your side.",
  },
  {
    n: "4",
    title: "Tweak & share",
    desc: "Adjust the design, swap content, add your own touches, then send the preview link to your client.",
  },
  {
    n: "5",
    title: "Keep it or delete it",
    desc: "Client's in? Move it forward. Client passed? Delete the site — and you stop being billed for it immediately.",
  },
  {
    n: "↻",
    title: "Run many at once",
    desc: "Spin up sites for different clients in parallel — each is independent, and you only ever pay for the ones that are live.",
    highlight: true,
  },
];

/* ─── Who it's for ─── */

const WHO_CARDS = [
  {
    bg: "--accent-dim",
    fg: "--accent",
    title: "Web studios",
    desc: "Pitch multiple concepts fast, win more proposals, and start every project from a polished, content-filled base.",
    icon: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    ),
  },
  {
    bg: "--yellow-dim",
    fg: "--yellow",
    title: "Digital agencies",
    desc: "Give your sales and delivery teams a way to produce live client demos on demand — without tying up developers.",
    icon: (
      <>
        <path d="M3 11l18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </>
    ),
  },
  {
    bg: "--pink-dim",
    fg: "--pink",
    title: "Freelancers",
    desc: "Punch above your weight. Show clients a finished-looking site before you've written a line of code, and only pay while it's live.",
    icon: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  },
];

/* ─── Features ─── */

const FEATURES: [string, string][] = [
  ["200 professional designs", "A professionally designed template for every kind of business."],
  ["AI-written copy", "Headlines, services, about pages — written around your client's business and structured so AI search engines can cite it."],
  ["AI-generated images", "Relevant visuals placed across the site automatically."],
  ["Premium content library", "Royalty-free premium templates, images, and texts included with every project."],
  ["One-click live deploy", "Each site goes live on a shareable preview URL — no hosting to set up."],
  ["Safe sandbox", "Experiment freely in an isolated environment — never your client's production server."],
  ["Full editing", "Tweak design and content before the client ever sees it."],
  ["Many projects at once", "Run several client sites in parallel, for one client or many."],
  ["Delete = stop billing", "No long-term commitment per site. Remove it and the meter stops."],
];

/* ─── Plans ─── */

type PlanLi = { text: React.ReactNode; sub?: string; muted?: boolean };

type LandingPlan = {
  name: string;
  price: number;
  tagline: string;
  cta: string;
  to: string;
  featured?: boolean;
  items: PlanLi[];
};

const LANDING_PLANS: LandingPlan[] = [
  {
    name: "Free",
    price: 0,
    tagline: "Try the platform and see it for yourself.",
    cta: "Start free",
    to: "/app",
    items: [
      { text: <><b>1 live site</b> at a time</> },
      { text: <>All <b>200 designs</b></> },
      { text: "Live preview URL" },
      { text: "No AI content generation", muted: true },
      { text: "Site expires after 7 days", muted: true },
    ],
  },
  {
    name: "Pro",
    price: 49,
    tagline: "For studios and freelancers running client projects.",
    cta: "Start Pro",
    to: "/pricing",
    featured: true,
    items: [
      { text: <><b>5 live sites</b> at once</> },
      { text: <>Extra live sites: <b>$0.40 / day</b> each</>, sub: "billed only while live" },
      { text: <><b>Unlimited sites</b> per month</>, sub: "create & delete as many as you want" },
      { text: <><b>AI texts & images</b> on every site</> },
      { text: "Premium content library" },
      { text: <><b>10 AI generations</b> / month included</>, sub: "then $6 per extra generation" },
      { text: "All 200 designs" },
    ],
  },
  {
    name: "Business",
    price: 99,
    tagline: "For agencies and teams with lots of projects.",
    cta: "Start Business",
    to: "/pricing",
    items: [
      { text: <><b>20 live sites</b> at once</> },
      { text: <>Extra live sites: <b>$0.30 / day</b> each</>, sub: "cheaper per site than Pro" },
      { text: <><b>Unlimited sites</b> per month</>, sub: "create & delete as many as you want" },
      { text: "Everything in Pro" },
      { text: <><b>25 AI generations</b> / month included</>, sub: "then $6 per extra generation" },
      { text: "Priority support" },
    ],
  },
];

/* ─── Billing gantt ─── */

type GBar = readonly [name: string, from: number, to: number];

const POOL = [
  "Maple Diner", "Oak & Co", "Riverside Inn", "Summit Law", "Velvet Salon", "Pine Dental",
  "Echo Media", "Crest Realty", "Fern Florist", "Bolt Repair", "Hue Studio", "Sage Wellness",
  "Tide Surf", "Atlas Movers", "Juno Bakery", "Onyx Barber", "Lark Boutique", "Ember Grill",
  "Cove Hotel", "Drift Coffee", "Mint Spa", "Quill Books", "Rune Tattoo", "Aria Dance",
  "Terra Garden", "Wren Photo", "Zephyr Travel", "Flux Gym", "Nimbus IT", "Pearl Nails",
  "Cedar Vet", "Bay Cycles", "Lotus Yoga", "Forge Welding", "Halo Optics", "Brio Pasta",
  "Vault Finance", "Reef Diving", "Aspen Ski", "Comet Couriers", "Sable Roofing", "Grove Daycare",
];

function bizSlots(): GBar[][] {
  const slots: GBar[][] = [];
  let n = 0;
  for (let s = 0; s < 20; s++) {
    const split = 11 + (s % 8);
    slots.push([
      [POOL[n++] ?? "", 1, split],
      [POOL[n++] ?? "", split + 1, 30],
    ]);
  }
  return slots;
}

type Scenario = {
  plan: string;
  price: number;
  included: number;
  rate: number;
  slots: GBar[][];
  extras: GBar[];
  sub: React.ReactNode;
  cap: React.ReactNode;
};

const SCENARIOS: Record<"pro" | "biz", Scenario> = {
  pro: {
    plan: "Pro",
    price: 49,
    included: 5,
    rate: 0.4,
    slots: [
      [["Bloom Café", 1, 10], ["Vista Dental", 11, 21], ["Coral Spa", 22, 30]],
      [["Harbor Law", 1, 8], ["Iron Gym", 9, 19], ["Peak Roofing", 20, 30]],
      [["Sunny Daycare", 1, 13], ["Metro Salon", 14, 24], ["Apex Auto", 25, 30]],
      [["Green Yoga", 1, 11], ["Lumen Studio", 12, 22], ["Nova Dental", 23, 30]],
      [["Urban Eats", 1, 9], ["Stellar Gym", 10, 20], ["Bright Bakery", 21, 30]],
    ],
    extras: [["Pixel Agency", 10, 19], ["Bright Clinic", 10, 19]],
    sub: (
      <>
        Your <b>Pro</b> plan covers <b>5 live sites at once</b>. Across the month 17 client sites
        flowed through those 5 slots — each time you finish and delete one, the next project takes
        its place. Only the 2 sites you ran <i>beyond</i> 5 are billed per day.
      </>
    ),
    cap: (
      <>
        Watch the slots get reused: as each site is approved or dropped and deleted, the freed slot
        instantly serves your next client — all for the one flat <b>$49</b>. The 2 sites that went
        over your plan cost just <b>$8</b> for the days they were live, and stop the moment you
        delete them.
      </>
    ),
  },
  biz: {
    plan: "Business",
    price: 99,
    included: 20,
    rate: 0.3,
    slots: bizSlots(),
    extras: [["Slate Roofing", 12, 21], ["Terra Health", 12, 21]],
    sub: (
      <>
        Your <b>Business</b> plan covers <b>20 live sites at once</b>. A busy agency cycled{" "}
        <b>40+ client sites</b> through those 20 slots this month — slots free up and refill as
        projects wrap. Only the 2 sites beyond 20 are billed per day.
      </>
    ),
    cap: (
      <>
        Run an entire agency from one plan. As each client site is finished and deleted, its slot
        immediately serves the next — 40 sites for one flat <b>$99</b>. The 2 sites beyond your 20
        added just <b>$6</b>, billed only for the days they were live.
      </>
    ),
  },
};

const TICKS = ["Day 1", "5", "10", "15", "20", "25", "30"];

function barPos(from: number, to: number): React.CSSProperties {
  return {
    left: `${(((from - 1) / 30) * 100).toFixed(2)}%`,
    width: `${(((to - from + 1) / 30) * 100).toFixed(2)}%`,
  };
}

function BillingGantt() {
  const [key, setKey] = useState<"pro" | "biz">("pro");
  const s = SCENARIOS[key];
  const extraDays = s.extras.reduce((sum, [, from, to]) => sum + (to - from + 1), 0);
  const extraCost = extraDays * s.rate;

  return (
    <div className="gantt">
      <div className="gtab-hint">Pick a plan to see how its billing works ↓</div>
      <div className="gtabs">
        <button type="button" className={`gtab${key === "pro" ? " active" : ""}`} onClick={() => setKey("pro")}>
          Pro · $49/mo
        </button>
        <button type="button" className={`gtab${key === "biz" ? " active" : ""}`} onClick={() => setKey("biz")}>
          Business · $99/mo
        </button>
      </div>

      <div className="gtitle">How your bill adds up — a real month</div>
      <p className="gsub">{s.sub}</p>

      <div className="glegend">
        <span><i style={{ background: "linear-gradient(135deg,#3148e8,#6e5ae6)" }} />Covered by your plan</span>
        <span><i style={{ background: "linear-gradient(135deg,#e3992e,#b86e00)" }} />Extra site — billed per day live</span>
      </div>

      <div className="gscroll">
        <div className={`gchart${s.slots.length > 10 ? " dense" : ""}`}>
          <div className="grow axis">
            <div />
            <div className="gtime">
              {TICKS.map((label, i) => (
                <span
                  className="gtick"
                  key={label}
                  style={{
                    left: `${(i * 100) / 6}%`,
                    transform: i === 0 ? "none" : i === 6 ? "translateX(-100%)" : undefined,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {s.slots.map((slot, i) => (
            <div className="grow" key={i}>
              <div className="glabel">Slot {i + 1}</div>
              <div className="gtime">
                {slot.map(([name, from, to], j) => (
                  <div
                    className={`gbar ${j % 2 ? "plan2" : "plan"}`}
                    style={barPos(from, to)}
                    title={`${name}: day ${from}–${to}`}
                    key={j}
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="gseprow">
            <span className="t">Above your plan's {s.included} sites — billed per day</span>
          </div>

          {s.extras.map(([name, from, to], i) => (
            <div className="grow" key={i}>
              <div className="glabel">Extra</div>
              <div className="gtime">
                <div className="gbar extra" style={barPos(from, to)} title={name}>
                  {name} · {to - from + 1}d
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ginv">
        <div className="ir">
          <span>{s.plan} plan — covers {s.included} live sites</span>
          <span>${s.price.toFixed(2)}</span>
        </div>
        <div className="ir">
          <span>{s.extras.length} extra sites — {extraDays} site-days × ${s.rate.toFixed(2)}</span>
          <span>${extraCost.toFixed(2)}</span>
        </div>
        <div className="ir tot">
          <span>Your bill this month</span>
          <span>${(s.price + extraCost).toFixed(2)}</span>
        </div>
      </div>

      <p className="gcap">{s.cap}</p>
    </div>
  );
}

/* ─── Go live ─── */

const GOLIVE_STEPS = [
  {
    title: "Your client approves",
    desc: <>Hit <b>"Take it live"</b> on the site you built. No re-work — it's the same site they already reviewed.</>,
  },
  {
    title: "Choose where it lives",
    desc: <>Export it to your own hosting in one click, or keep it hosted with us. The site moves with all its content intact.</>,
  },
  {
    title: "Get the official theme license",
    desc: <>A genuine ThemeREX license — <b>$69 once</b>, with lifetime updates and support. Charged only now, only for this won project.</>,
  },
  {
    title: "It's yours to hand over",
    desc: <>A real, licensed, update-ready WordPress site you deliver to your client and bill for — at your full project price.</>,
  },
];

/* ─── Testimonials ─── */

const TESTIMONIALS = [
  {
    quote: "We used to send clients static mockups and pray. Now we send a live site with their name on it. Two of our last three pitches closed on the spot.",
    avatar: "linear-gradient(135deg,#3148e8,#1733d1)",
    name: "Sarah Chen",
    role: "Founder, Pixel & Co Agency",
  },
  {
    quote: "Seventeen client demos last month on one Pro plan. The ones that didn't convert cost us nothing but the minute it took to delete them.",
    avatar: "linear-gradient(135deg,#d4549a,#b4236e)",
    name: "Priya Patel",
    role: "Digital Strategist, BrightPath",
  },
  {
    quote: "We white-label the demos for our clients. They see a finished-looking site in the first meeting, we get the contract — and we only pay for what stays live.",
    avatar: "linear-gradient(135deg,#6e5ae6,#4b38c9)",
    name: "Tom Andersen",
    role: "CEO, Nordic Digital",
  },
];

/* ─── FAQ ─── */

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Do I need my own hosting?",
    a: "No. Every site runs on our cloud in a safe sandbox and gets its own live preview link. There's nothing to install or configure on your side.",
  },
  {
    q: 'What exactly is an "AI generation"?',
    a: "One generation is a full build of a site's content — all the texts and images, written and placed around your client's business. Each time you create a new site or regenerate its content, that's one generation. Your plan includes a monthly amount, and extras are billed at a flat per-generation rate.",
  },
  {
    q: "What happens when I delete a site?",
    a: "The site is removed and you immediately stop being billed for it. There's no per-site commitment — keep a site for three days or three weeks, it's entirely up to you.",
  },
  {
    q: "Can I work on several client sites at the same time?",
    a: "Yes. Each plan includes a number of sites you can run at once (1 on Free, 5 on Pro, 20 on Business). Need more than your plan includes? Add extra live sites anytime — they're billed only for the days they're online.",
  },
  {
    q: "What does the client see?",
    a: "A live, fully styled WordPress site on a shareable preview URL — already filled with relevant content, ready to review. You can tweak everything before sharing it.",
  },
  {
    q: "Do I pay for the theme on every site?",
    a: "No. Building and previewing sites costs you nothing in theme licensing — you only buy the theme license ($69 one-time, lifetime updates) on a project when your client approves it and you take it live. Every demo that never converts is completely free.",
  },
  {
    q: "Is the theme license genuine, and why is it cheaper here?",
    a: "Yes — WordToSite works directly with ThemeREX, the studio behind all 200 designs. The go-live license is a real, official license with lifetime updates and support, offered at an exclusive one-time price we arranged with them — a better deal than buying it on your own and re-subscribing for every project.",
  },
  {
    q: "Is there a contract or setup fee?",
    a: "No contracts and no setup fees. You can start free, upgrade when you're ready, and cancel anytime. Usage is totalled and billed once a month, and the one-time theme license is charged only when you take a won project live.",
  },
  {
    q: "What if I go over my plan's limits?",
    a: "You're never blocked. Extra live sites and extra AI generations are simply added to your monthly bill at the rates shown on each plan — so you can keep working without interruption.",
  },
];

/* ─── Shared bits ─── */

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCard({ card }: { card: (typeof TRIO_CARDS)[number] }) {
  return (
    <div className="hood-card">
      <div className="hood-icon" style={{ background: `var(${card.bg})`, color: `var(${card.fg})` }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {card.icon}
        </svg>
      </div>
      <h3 className="hood-title">{card.title}</h3>
      <p className="hood-desc">{card.desc}</p>
    </div>
  );
}

function Home() {
  const cards = [...SHOWCASE_CARDS, ...SHOWCASE_CARDS];
  return (
    <>
      {/* HERO */}
      <header className="hero">
        <div className="hero-eyebrow">For WordPress studios, agencies &amp; freelancers</div>
        <h1>
          Client-ready WordPress sites<br />
          <span className="gradient">in about a minute.</span>
        </h1>
        <p className="hero-sub">
          Pick a design, add your client's details, and watch AI fill a <b>live</b>, polished
          WordPress site with tailored copy and images. Show it, tweak it, then keep it or delete
          it — <b>you only pay for the time a site is really live.</b>
        </p>
        <div className="hero-actions">
          <Link className="btn-hero btn-hero-primary" to="/app">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Start free — no card needed
          </Link>
          <a className="btn-hero btn-hero-secondary" href="#how">See how it works</a>
          <a className="btn-hero btn-hero-secondary" href="#pricing">Pricing</a>
        </div>
        <p className="hero-hint">200 ready-made designs · Human-like AI content · Delete anytime, billing stops</p>

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

      {/* MANIFESTO STRIP */}
      <div className="manifesto">
        <div className="manifesto-track">
          {[
            ["purple", "Client-ready in ~1 minute"], ["green", "200 ready-made designs"], ["pink", "AI copy + images included"], ["yellow", "Live preview URLs"], ["orange", "Delete = billing stops"], ["purple", "No hosting setup"], ["green", "Run client sites in parallel"], ["pink", "White-label demos"],
            ["purple", "Client-ready in ~1 minute"], ["green", "200 ready-made designs"], ["pink", "AI copy + images included"], ["yellow", "Live preview URLs"], ["orange", "Delete = billing stops"], ["purple", "No hosting setup"], ["green", "Run client sites in parallel"], ["pink", "White-label demos"],
          ].map(([dot, label], i) => (
            <span className="manifesto-item" key={i}>
              <span className={`mi-dot ${dot}`} /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* WHY STUDIOS USE IT */}
      <section className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">why studios use it</div>
            <h2 className="section-title">Stop showing clients empty templates.</h2>
            <p className="section-desc">
              Skip the blank-theme, lorem-ipsum stage. Hand your client something that already
              looks finished — white-labeled and ready to present.
            </p>
          </div>
          <div className="hood-grid fade-in">
            {TRIO_CARDS.map((card) => (
              <IconCard card={card} key={card.title} />
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">how it works</div>
            <h2 className="section-title">From brief to live preview in five steps.</h2>
          </div>
          <div className="steps-grid fade-in">
            {HOW_STEPS.map((step) => (
              <div className={`step-card${step.highlight ? " highlight" : ""}`} key={step.title}>
                <div className="step-num">{step.n}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">who it's for</div>
            <h2 className="section-title">Built for people who pitch WordPress sites.</h2>
            <p className="section-desc">
              If you create WordPress sites for clients and want a faster, more impressive way to
              win the project — this is for you.
            </p>
          </div>
          <div className="hood-grid fade-in">
            {WHO_CARDS.map((card) => (
              <IconCard card={card} key={card.title} />
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">what you get</div>
            <h2 className="section-title">Everything to go from idea to "wow."</h2>
          </div>
          <div className="feat-grid fade-in">
            {FEATURES.map(([title, desc]) => (
              <div className="feat-item" key={title}>
                <span className="feat-check">✓</span>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">pricing</div>
            <h2 className="section-title">Simple plans. Pay for what you actually use.</h2>
            <p className="section-desc">
              Every plan includes a set of live sites. Need more? Add them — and only pay for the
              days they're online.
            </p>
          </div>

          <div className="landing-plans fade-in">
            {LANDING_PLANS.map((plan) => (
              <div className={`plan-card${plan.featured ? " featured" : ""}`} key={plan.name}>
                {plan.featured ? <span className="plan-tag">Most popular</span> : null}
                <div className="plan-head">
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-tagline">{plan.tagline}</div>
                  <div className="plan-price-row">
                    <div className="plan-price">
                      <span className="currency">$</span>
                      {plan.price}
                    </div>
                    <div className="plan-per">per month</div>
                  </div>
                </div>
                <div className="plan-feats">
                  <ul>
                    {plan.items.map((item, i) => (
                      <li className={item.muted ? "muted" : undefined} key={i}>
                        {item.muted ? <span className="li-dash">–</span> : <CheckIcon />}
                        <span>
                          {item.text}
                          {item.sub ? <span className="li-sub">{item.sub}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="plan-cta">
                  <Link className={`plan-btn${plan.featured ? " primary" : ""}`} to={plan.to}>
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="plans-note">No contracts. Cancel anytime. Usage is added up and billed once a month.</p>

          {/* BILLING EXPLAINER */}
          <div className="bill fade-in">
            <div className="bill-head">
              <h3>How "pay for what's live" works</h3>
              <p>
                Your plan covers a set number of live sites. Spin up more whenever you need them —
                each extra site is billed only for the days it's actually online. Delete a site and
                its billing stops the same day.
              </p>
            </div>

            <BillingGantt />

            <div className="bill-points">
              <div className="bill-point">
                <h3>🟢 You're in control</h3>
                <p>Create and delete sites whenever you like. Nothing runs — or bills — without you.</p>
              </div>
              <div className="bill-point">
                <h3>⏱️ Daily, not monthly</h3>
                <p>Extra sites are counted per day they're live, so a 3-day demo costs a fraction of a full month.</p>
              </div>
              <div className="bill-point">
                <h3>🧮 One clear invoice</h3>
                <p>Your plan fee plus any usage is totalled into a single monthly bill. No surprises.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GO LIVE / LICENSE */}
      <section id="golive" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">when your client says yes</div>
            <h2 className="section-title">Take it live — and own it.</h2>
            <p className="section-desc">
              Building and showing demos is always free. You only pay for the theme license on the
              projects your client actually buys — then it's a flat <b>one-time</b> fee with{" "}
              <b>lifetime updates</b>.
            </p>
          </div>

          <div className="golive-grid fade-in">
            <div className="gl-steps">
              {GOLIVE_STEPS.map((step, i) => (
                <div className="gl-step" key={step.title}>
                  <div className="gl-num">{i + 1}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="lic-card">
              <div className="lic-badge">Exclusive WordToSite price</div>
              <div className="lic-name">Go-live theme license</div>
              <div className="lic-price">
                $69<small> one-time</small>
              </div>
              <div className="lic-sub">
                per won project — the official white-label license, sourced directly from ThemeREX,
                the studio behind all 200 designs. We pass it through at cost.
              </div>
              <ul>
                <li>Lifetime theme updates &amp; support included</li>
                <li>Genuine, official ThemeREX license</li>
                <li>Export to your own hosting, or keep it with us</li>
                <li>Only charged when your client buys — every demo is free</li>
              </ul>
              <div className="lic-foot">
                A better deal than buying the license on its own: one flat price, lifetime updates,
                available exclusively through WordToSite.
              </div>
            </div>
          </div>

          <div className="demo-free">
            🎉 <b>Build as many demos as you want at no theme cost.</b> The $69 license applies only
            on projects you win and take live — never on demos that don't convert.
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">what studios say</div>
            <h2 className="section-title">Pitch with a finished site, not a promise.</h2>
          </div>
          <div className="testimonials-grid fade-in">
            {TESTIMONIALS.map((t) => (
              <div className="testimonial-card" key={t.name}>
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

      {/* FAQ */}
      <section id="faq" className="border-t">
        <div className="section-container">
          <div className="section-header center fade-in">
            <div className="section-eyebrow">faq</div>
            <h2 className="section-title">Good questions, clear answers.</h2>
          </div>
          <Faq items={FAQ_ITEMS} />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t cta-section">
        <div className="section-container">
          <div className="fade-in">
            <h2 className="cta-title">Show your next client<br />a finished site — today.</h2>
            <p className="cta-desc">
              Start free, build your first AI-filled preview, and see why studios stop pitching
              empty templates.
            </p>
            <div className="cta-actions">
              <Link className="btn-hero btn-hero-primary" to="/app">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Start free — no card needed
              </Link>
              <a className="btn-hero btn-hero-secondary" href="#pricing">Compare plans</a>
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
