-- Plugin API Schema
-- Hub-and-spoke architecture for AI Traffic Optimizer

-- API keys / licenses
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key VARCHAR(70) UNIQUE NOT NULL,
  client_id VARCHAR(100) NOT NULL,
  client_name VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_client_id ON api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON api_keys(api_key);

-- Registered plugin installations
CREATE TABLE IF NOT EXISTS site_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  site_url VARCHAR(500) NOT NULL,
  plugin_version VARCHAR(20),
  wp_version VARCHAR(20),
  php_version VARCHAR(20),
  active_theme VARCHAR(255),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  site_health JSONB DEFAULT '{}',
  UNIQUE(api_key_id, site_url)
);

CREATE INDEX IF NOT EXISTS idx_site_registrations_status ON site_registrations(status);

-- Synced traffic data from plugins
CREATE TABLE IF NOT EXISTS plugin_traffic_data (
  id BIGSERIAL PRIMARY KEY,
  registration_id UUID REFERENCES site_registrations(id),
  visit_time TIMESTAMPTZ NOT NULL,
  visitor_type VARCHAR(20),
  bot_name VARCHAR(100),
  bot_company VARCHAR(100),
  page_url VARCHAR(500),
  confidence SMALLINT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_traffic_registration ON plugin_traffic_data(registration_id);
CREATE INDEX IF NOT EXISTS idx_plugin_traffic_visit_time ON plugin_traffic_data(visit_time);

-- Config pushed to plugins
CREATE TABLE IF NOT EXISTS plugin_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL,
  config_value JSONB NOT NULL,
  version VARCHAR(20) DEFAULT '1.0.0',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(config_key)
);

-- Agent actions queued for plugins
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES site_registrations(id),
  action_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_registration ON agent_actions(registration_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON agent_actions(status);
