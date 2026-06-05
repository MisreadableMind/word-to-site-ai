ALTER TABLE user_sites
  ADD COLUMN IF NOT EXISTS image_bank_login    TEXT,
  ADD COLUMN IF NOT EXISTS image_bank_password TEXT,
  ADD COLUMN IF NOT EXISTS images_status       TEXT NOT NULL DEFAULT 'pending';
