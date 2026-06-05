-- 004-user-sites.sql
-- User-owned sites tracking

CREATE TABLE IF NOT EXISTS user_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain TEXT,
  instawp_id TEXT,
  template_slug TEXT,
  wp_url TEXT,
  wp_username TEXT,
  wp_password TEXT,
  site_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  onboard_type TEXT,
  onboard_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sites_user_id ON user_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sites_domain ON user_sites(domain);
CREATE INDEX IF NOT EXISTS idx_user_sites_status ON user_sites(status);
