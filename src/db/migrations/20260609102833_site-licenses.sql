DO
$$
    BEGIN
        CREATE TYPE license_status AS ENUM ('active', 'expired', 'not_paid', 'disabled');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

CREATE TABLE IF NOT EXISTS site_licenses
(
    id           uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    license_key  TEXT             NOT NULL UNIQUE,
    instawp_id   TEXT             NULL UNIQUE,
    user_site_id uuid             NULL REFERENCES user_sites (id) ON DELETE SET NULL,
    user_id      uuid             NULL REFERENCES users (id) ON DELETE SET NULL,
    wp_url       TEXT             NULL,
    status       license_status   NOT NULL DEFAULT 'not_paid'::license_status,
    expires_at   timestamptz      NULL,
    activated_at timestamptz      NULL,
    created_at   timestamptz      NOT NULL DEFAULT now(),
    updated_at   timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_licenses_user_id ON site_licenses (user_id);
CREATE INDEX IF NOT EXISTS idx_site_licenses_status ON site_licenses (status);
