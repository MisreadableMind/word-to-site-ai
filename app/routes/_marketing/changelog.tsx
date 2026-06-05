import { createFileRoute } from "@tanstack/react-router";
import "~/styles/changelog.css";

export const Route = createFileRoute("/_marketing/changelog")({
  component: Changelog,
  head: () => ({
    meta: [
      { title: "Changelog | WordToSite" },
      {
        name: "description",
        content:
          "WordToSite changelog. See what's new, improved, and fixed in each release.",
      },
    ],
  }),
});

type ChangeTag = "new" | "improved" | "fixed";

type Change = {
  tag: ChangeTag;
  text: string;
};

type Release = {
  version: string;
  date: string;
  title: string;
  changes: Change[];
};

const TAG_CLASS: Record<ChangeTag, string> = {
  new: "tag-new",
  improved: "tag-improved",
  fixed: "tag-fixed",
};

const RELEASES: Release[] = [
  {
    version: "v3.0.0",
    date: "February 2026",
    title: "The Zero-Click Release",
    changes: [
      {
        tag: "new",
        text: "Complete rebrand to WordToSite with new dark theme and landing page.",
      },
      {
        tag: "new",
        text: "AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) built into every site.",
      },
      {
        tag: "new",
        text: "Voice-first website management via real-time transcription.",
      },
      {
        tag: "new",
        text: "Multi-AI content generation: OpenAI, Anthropic Claude, and Google Gemini.",
      },
      {
        tag: "new",
        text: "Automatic Cloudflare DNS zone creation and SSL provisioning.",
      },
      {
        tag: "new",
        text: "Site migration via URL: paste your existing site and rebuild it AI-optimized.",
      },
      {
        tag: "improved",
        text: "Mobile-first responsive design across all interfaces.",
      },
      {
        tag: "improved",
        text: "Deployment speed reduced to under 60 seconds.",
      },
    ],
  },
  {
    version: "v2.1.0",
    date: "January 2026",
    title: "End-to-End Onboarding",
    changes: [
      {
        tag: "new",
        text: "Three onboarding paths: migrate, voice create, and start from scratch.",
      },
      {
        tag: "new",
        text: "Real-time deployment progress via Server-Sent Events.",
      },
      {
        tag: "new",
        text: "Firecrawl integration for website scraping and migration.",
      },
      {
        tag: "improved",
        text: "WordPress template system for faster deployments.",
      },
      {
        tag: "fixed",
        text: "Voice transcription accuracy improvements for noisy environments.",
      },
    ],
  },
  {
    version: "v2.0.0",
    date: "December 2025",
    title: "Domain & SSL Automation",
    changes: [
      {
        tag: "new",
        text: "Complete domain registration and SSL workflow.",
      },
      {
        tag: "new",
        text: "Cloudflare API integration for automated DNS management.",
      },
      {
        tag: "new",
        text: "InstaWP deployment integration.",
      },
      {
        tag: "improved",
        text: "Landing page redesign with AEO/GEO messaging.",
      },
      {
        tag: "fixed",
        text: "SSL certificate renewal edge cases resolved.",
      },
    ],
  },
  {
    version: "v1.0.0",
    date: "November 2025",
    title: "Initial Release",
    changes: [
      {
        tag: "new",
        text: "AI-powered website creation with OpenAI integration.",
      },
      {
        tag: "new",
        text: "Basic WordPress deployment pipeline.",
      },
      {
        tag: "new",
        text: "Voice transcription prototype.",
      },
      {
        tag: "new",
        text: "Docker support for self-hosting.",
      },
    ],
  },
];

function Changelog() {
  return (
    <main className="page-content">
      <h1 className="page-title">Changelog</h1>
      <p className="page-subtitle">
        Everything new, improved, and fixed in WordToSite.
      </p>

      {RELEASES.map((release) => (
        <div className="release" key={release.version}>
          <div className="release-header">
            <span className="release-version">{release.version}</span>
            <span className="release-date">{release.date}</span>
          </div>
          <h2 className="release-title">{release.title}</h2>
          <ul className="change-list">
            {release.changes.map((change, i) => (
              <li key={i}>
                <span className={`change-tag ${TAG_CLASS[change.tag]}`}>
                  {change.tag}
                </span>
                <span className="change-text">{change.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </main>
  );
}
