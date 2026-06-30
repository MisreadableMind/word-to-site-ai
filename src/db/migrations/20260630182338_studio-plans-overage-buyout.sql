ALTER TABLE user_sites ADD COLUMN IF NOT EXISTS expires_at    timestamptz;
ALTER TABLE user_sites ADD COLUMN IF NOT EXISTS bought_out_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_user_sites_expires_at ON user_sites (expires_at);

ALTER TABLE site_licenses ADD COLUMN IF NOT EXISTS lifetime boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS site_usage_days (
  id                     uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  usage_date             date NOT NULL,
  plan_tier              text NOT NULL,
  live_sites             integer NOT NULL DEFAULT 0,
  included_sites         integer NOT NULL DEFAULT 0,
  overage_sites          integer NOT NULL DEFAULT 0,
  per_site_cents         integer NOT NULL DEFAULT 0,
  amount_cents           integer NOT NULL DEFAULT 0,
  stripe_invoice_item_id text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_site_usage_days_user_id ON site_usage_days (user_id);

CREATE TABLE IF NOT EXISTS site_buyouts (
  id                         uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  site_id                    uuid REFERENCES user_sites (id) ON DELETE SET NULL,
  domain                     text,
  fee_cents                  integer NOT NULL,
  status                     text NOT NULL DEFAULT 'awaiting_payment',
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id   text,
  error_message              text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  completed_at               timestamptz
);
CREATE INDEX IF NOT EXISTS idx_site_buyouts_user_id    ON site_buyouts (user_id);
CREATE INDEX IF NOT EXISTS idx_site_buyouts_session_id ON site_buyouts (stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_site_buyouts_status     ON site_buyouts (status);

-- Grandfather the removed 'starter' tier into 'pro' (swap their Stripe price separately).
UPDATE users         SET plan_tier = 'pro', updated_at = now() WHERE plan_tier = 'starter';
UPDATE subscriptions SET plan_tier = 'pro', updated_at = now() WHERE plan_tier = 'starter';

-- Down migration (optional, for manual rollback):
-- DROP TABLE IF EXISTS site_buyouts;
-- DROP TABLE IF EXISTS site_usage_days;
-- ALTER TABLE site_licenses DROP COLUMN IF EXISTS lifetime;
-- ALTER TABLE user_sites DROP COLUMN IF EXISTS bought_out_at;
-- ALTER TABLE user_sites DROP COLUMN IF EXISTS expires_at;
