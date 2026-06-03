import { createFileRoute } from "@tanstack/react-router";
import "~/styles/mission.css";

export const Route = createFileRoute("/_marketing/mission")({
  component: Mission,
  head: () => ({
    meta: [
      { title: "Mission | WordToSite" },
      {
        name: "description",
        content:
          "Our mission: make the web work for the AI age. Websites that answer engines cite, built by anyone in seconds.",
      },
    ],
  }),
});

const VALUES: { title: string; desc: string }[] = [
  {
    title: "Voice over dashboards",
    desc: "The best interface is natural language. Say what you want, and it happens. No menus, no learning curves.",
  },
  {
    title: "AI-native by default",
    desc: "Every website should be optimized for AI search from the first deploy. Not as an afterthought or a plugin.",
  },
  {
    title: "Speed is a feature",
    desc: "60 seconds from idea to live website. Anything slower means you'll abandon it or settle for less.",
  },
  {
    title: "No vendor lock-in",
    desc: "Self-host with your own keys. Export your data. WordPress under the hood means you always have an escape hatch.",
  },
];

function Mission() {
  return (
    <main className="page-content">
      <h1 className="page-title">Our Mission</h1>
      <p className="page-subtitle">
        The web changed. Over 60% of searches end without a click. AI assistants answer questions by citing websites,
        not sending traffic to them. Most websites weren't built for this world. We're fixing that.
      </p>

      <div className="page-section">
        <h2>The Problem</h2>
        <p>
          The internet moved to a zero-click model. Google's AI Overviews, ChatGPT, Claude, Perplexity, and Gemini are
          answering user questions directly. Your website's content matters more than ever, but the way it's structured,
          optimized, and delivered needs to fundamentally change.
        </p>
        <p>
          Meanwhile, building and managing a website still requires dashboards, plugins, manual SSL configuration, and
          technical knowledge that most people don't have. The tools haven't caught up to the reality of how the web
          works now.
        </p>
      </div>

      <div className="page-section">
        <h2>Our Approach</h2>
        <p>
          WordToSite builds websites for the AI age. Every site we create is optimized for Answer Engine Optimization
          (AEO) and Generative Engine Optimization (GEO) from day one. Clean semantic HTML, proper schema markup,
          structured content that AI engines can parse, cite, and reference.
        </p>
        <p>
          We removed the dashboard. You manage your website by talking to it. From your phone, between meetings,
          wherever you are. AI handles the complexity. You handle the intent.
        </p>
      </div>

      <div className="page-section">
        <h2>What We Believe</h2>
        <div className="values-grid">
          {VALUES.map((value) => (
            <div className="value-card" key={value.title}>
              <h3>{value.title}</h3>
              <p>{value.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="page-section">
        <h2>The Team</h2>
        <p>
          WordToSite is built by a small team of engineers, designers, and AI practitioners who believe the web should
          be accessible to everyone, not just people who know how to configure nginx or write CSS. We're building the
          tool we wish existed.
        </p>
      </div>
    </main>
  );
}
