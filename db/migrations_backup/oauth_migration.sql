-- OAuth Migration: Replace NextAuth with custom OAuth
-- Run this migration to update the database schema

-- 1. Add OAuth columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);

-- 2. Create index for OAuth lookups
CREATE INDEX IF NOT EXISTS users_provider_idx ON users(provider, provider_id);

-- 3. Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create indexes for refresh_tokens
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_jti_idx ON refresh_tokens(jti);

-- 5. Drop NextAuth tables (uncomment after verifying migration works)
-- DROP TABLE IF EXISTS accounts;
-- DROP TABLE IF EXISTS sessions;
-- DROP TABLE IF EXISTS verification_tokens;

-- 6. Remove password_hash column (uncomment after migration)
-- ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
