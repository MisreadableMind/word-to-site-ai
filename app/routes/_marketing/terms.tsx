import { createFileRoute } from "@tanstack/react-router";
import "~/styles/terms.css";

export const Route = createFileRoute("/_marketing/terms")({
  component: Terms,
  head: () => ({
    meta: [
      { title: "Terms of Service | WordToSite" },
      {
        name: "description",
        content:
          "WordToSite terms of service. Rules and guidelines for using our platform.",
      },
    ],
  }),
});

function Terms() {
  return (
    <main className="page-content">
      <h1 className="page-title">Terms of Service</h1>
      <p className="page-updated">Last updated: February 2026</p>

      <div className="page-section">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using WordToSite, you agree to be bound by these Terms of Service. If you do not agree, do not use the service. These terms apply to all users, whether using the hosted version or self-hosting the platform.</p>
      </div>

      <div className="page-section">
        <h2>2. Description of Service</h2>
        <p>WordToSite is an AI-powered website creation and management platform. We provide tools to create, migrate, and manage websites using artificial intelligence, voice commands, and automated deployment. The service includes integration with third-party AI providers, hosting infrastructure, and domain management tools.</p>
      </div>

      <div className="page-section">
        <h2>3. User Accounts</h2>
        <ul>
          <li>You must provide accurate information when creating an account.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
          <li>You must notify us immediately of any unauthorized access.</li>
        </ul>
      </div>

      <div className="page-section">
        <h2>4. Acceptable Use</h2>
        <p>You agree not to use WordToSite to:</p>
        <ul>
          <li>Create websites that violate any applicable laws or regulations.</li>
          <li>Generate or distribute harmful, abusive, or misleading content.</li>
          <li>Infringe on intellectual property rights of others.</li>
          <li>Attempt to circumvent security measures or access other users' data.</li>
          <li>Overload or interfere with the service infrastructure.</li>
        </ul>
      </div>

      <div className="page-section">
        <h2>5. Content Ownership</h2>
        <p>You retain ownership of all content you create or upload to WordToSite. We do not claim any intellectual property rights over your websites, text, images, or other materials. AI-generated content created through our platform is yours to use as you see fit.</p>
      </div>

      <div className="page-section">
        <h2>6. Third-Party Services</h2>
        <p>WordToSite integrates with third-party services including OpenAI, Anthropic, Google, Cloudflare, InstaWP, Firecrawl, and Stripe (payment processing). Your use of these services through WordToSite is also subject to their respective terms. We are not responsible for the availability or performance of third-party services.</p>
      </div>

      <div className="page-section">
        <h2>7. Billing &amp; Subscriptions</h2>
        <p>Paid plans are billed in advance on a recurring monthly cycle. Payments are processed by Stripe; we do not store full payment card details on our servers. You may upgrade, downgrade, or cancel your subscription at any time through the customer portal. Cancellations take effect at the end of the current billing period — no prorated refunds for partial periods. Failed payments will result in your subscription being marked past-due, with a grace period before automatic downgrade to the free tier. Domain registrations bundled with paid plans are non-refundable.</p>
      </div>

      <div className="page-section">
        <h2>8. Service Availability</h2>
        <p>We strive to maintain high availability but do not guarantee uninterrupted service. We may perform maintenance, updates, or modifications that temporarily affect availability. We will provide reasonable notice for planned downtime when possible.</p>
      </div>

      <div className="page-section">
        <h2>9. Limitation of Liability</h2>
        <p>WordToSite is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service, including loss of data, revenue, or business opportunities. Our total liability shall not exceed the amount you paid for the service in the preceding 12 months.</p>
      </div>

      <div className="page-section">
        <h2>10. Termination</h2>
        <p>You may stop using WordToSite at any time. We may suspend or terminate your account for violation of these terms. Upon termination, you may export your data within 30 days. After that period, we may delete your account data.</p>
      </div>

      <div className="page-section">
        <h2>11. Changes to Terms</h2>
        <p>We may update these terms from time to time. Material changes will be communicated via email or in-app notification at least 30 days before they take effect. Continued use of WordToSite after changes constitutes acceptance.</p>
      </div>
    </main>
  );
}
