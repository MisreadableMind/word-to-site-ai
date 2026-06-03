import { createFileRoute } from "@tanstack/react-router";
import "~/styles/privacy.css";

export const Route = createFileRoute("/_marketing/privacy")({
  component: Privacy,
  head: () => ({
    meta: [
      { title: "Privacy Policy | WordToSite" },
      {
        name: "description",
        content:
          "WordToSite privacy policy. How we collect, use, and protect your data.",
      },
    ],
  }),
});

function Privacy() {
  return (
    <main className="page-content">
      <h1 className="page-title">Privacy Policy</h1>
      <p className="page-updated">Last updated: February 2026</p>

      <div className="page-section">
        <h2>1. Information We Collect</h2>
        <p>When you use WordToSite, we collect information necessary to provide our services:</p>
        <ul>
          <li><strong>Account information:</strong> Email address and password when you create an account.</li>
          <li><strong>Website content:</strong> URLs you provide for migration, voice recordings for transcription, and content you create through the platform.</li>
          <li><strong>Usage data:</strong> Pages visited, features used, and deployment activity to improve our service.</li>
          <li><strong>Technical data:</strong> Browser type, device information, and IP address for security and performance.</li>
        </ul>
      </div>

      <div className="page-section">
        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To create, deploy, and manage your websites.</li>
          <li>To process voice commands and generate AI content via third-party AI providers (OpenAI, Anthropic, Google).</li>
          <li>To configure DNS and SSL through Cloudflare on your behalf.</li>
          <li>To improve our services and develop new features.</li>
          <li>To communicate important service updates.</li>
        </ul>
      </div>

      <div className="page-section">
        <h2>3. Third-Party Services</h2>
        <p>WordToSite integrates with third-party services to deliver its functionality. Your data may be processed by:</p>
        <ul>
          <li><strong>OpenAI, Anthropic, Google:</strong> For AI content generation and analysis. Subject to their respective privacy policies.</li>
          <li><strong>Cloudflare:</strong> For DNS management and SSL provisioning.</li>
          <li><strong>InstaWP:</strong> For WordPress hosting and deployment.</li>
          <li><strong>Firecrawl:</strong> For website scraping during migration.</li>
          <li><strong>Stripe:</strong> For payment processing on paid plans. We never see or store your full card number — Stripe holds the payment details directly. We retain only the Stripe customer ID, subscription status, and invoice history.</li>
        </ul>
        <p>We only share the minimum data necessary for each service to function.</p>
      </div>

      <div className="page-section">
        <h2>4. Data Storage &amp; Security</h2>
        <p>Your data is stored securely and encrypted in transit. We do not sell your personal information to third parties. Voice recordings are processed in real-time and not permanently stored unless you explicitly save a transcript.</p>
      </div>

      <div className="page-section">
        <h2>5. Your Rights</h2>
        <p>You may request access to, correction of, or deletion of your personal data at any time. To exercise these rights, contact us at privacy@wordtosite.com. If you self-host WordToSite, your data never leaves your infrastructure.</p>
      </div>

      <div className="page-section">
        <h2>6. Cookies</h2>
        <p>We use essential cookies for authentication and session management. We do not use third-party tracking cookies or advertising pixels.</p>
      </div>

      <div className="page-section">
        <h2>7. Changes to This Policy</h2>
        <p>We may update this policy from time to time. Significant changes will be communicated via email or in-app notification. Continued use of WordToSite after changes constitutes acceptance of the updated policy.</p>
      </div>
    </main>
  );
}
