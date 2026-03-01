-- AI Proxy Schema
-- Centralizes AI access (OpenAI Responses API) for deployed WordPress sites

-- Registered sites that can use the AI proxy
CREATE TABLE IF NOT EXISTS proxy_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(500) UNIQUE NOT NULL,
  api_key VARCHAR(80) UNIQUE NOT NULL,
  label VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  monthly_token_limit BIGINT DEFAULT 100000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proxy_sites_api_key ON proxy_sites(api_key);
CREATE INDEX IF NOT EXISTS idx_proxy_sites_domain ON proxy_sites(domain);
CREATE INDEX IF NOT EXISTS idx_proxy_sites_status ON proxy_sites(status);

-- Request log for usage tracking and analytics
CREATE TABLE IF NOT EXISTS proxy_request_log (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID REFERENCES proxy_sites(id),
  domain VARCHAR(500),
  model VARCHAR(60),
  endpoint VARCHAR(100),
  method VARCHAR(10),
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  response_status INT,
  latency_ms INT,
  error_message TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proxy_request_log_site_id ON proxy_request_log(site_id);
CREATE INDEX IF NOT EXISTS idx_proxy_request_log_domain ON proxy_request_log(domain);
CREATE INDEX IF NOT EXISTS idx_proxy_request_log_requested_at ON proxy_request_log(requested_at);
