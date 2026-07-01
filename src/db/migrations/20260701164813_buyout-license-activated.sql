-- Track whether a buyout's license has been (re)activated on the client's own domain.
-- Up migration:

ALTER TABLE site_buyouts ADD COLUMN IF NOT EXISTS license_activated boolean NOT NULL DEFAULT false;

-- Down migration (optional, for manual rollback):
-- ALTER TABLE site_buyouts DROP COLUMN IF EXISTS license_activated;
