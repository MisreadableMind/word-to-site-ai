-- 006-domain-status.sql
-- Track lifecycle status of Stripe-paid domain registrations.

ALTER TABLE domain_registrations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'registered';

ALTER TABLE domain_registrations
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

ALTER TABLE domain_registrations
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE domain_registrations
  ADD COLUMN IF NOT EXISTS total_charged_cents INT;

ALTER TABLE domain_registrations
  ADD COLUMN IF NOT EXISTS wholesale_cents INT;

ALTER TABLE domain_registrations
  ALTER COLUMN expires_at DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_domain_registrations_session_id
  ON domain_registrations(stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_domain_registrations_status
  ON domain_registrations(status);
