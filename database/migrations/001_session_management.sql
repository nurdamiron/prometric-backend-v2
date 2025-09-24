-- 🏗️ SESSION MANAGEMENT MIGRATION
-- Adds all required fields for enhanced auth system
-- Safe to run multiple times (IF NOT EXISTS)

-- Add session management fields to users table (safe execution)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='failed_login_attempts') THEN
    ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='locked_until') THEN
    ALTER TABLE users ADD COLUMN locked_until TIMESTAMP NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login_at') THEN
    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login_ip') THEN
    ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45) NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_changed_at') THEN
    ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='known_devices') THEN
    ALTER TABLE users ADD COLUMN known_devices JSONB NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='security_events') THEN
    ALTER TABLE users ADD COLUMN security_events JSONB NULL;
  END IF;
END
$$;

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  jti VARCHAR(255) UNIQUE NOT NULL,
  device_fingerprint VARCHAR(255) NULL,
  user_agent TEXT NULL,
  ip_address VARCHAR(45) NULL,
  device_info JSONB NULL,
  expires_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  revocation_reason VARCHAR(100) NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraint
ALTER TABLE refresh_tokens
  ADD CONSTRAINT IF NOT EXISTS fk_refresh_tokens_user_id
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_jti ON refresh_tokens(jti);

-- Create indexes for users table security fields
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts);

-- Cleanup old/expired refresh tokens (run periodically)
DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day';

-- Cleanup old security events (keep only last 3 months)
UPDATE users
SET security_events = (
  SELECT jsonb_agg(event)
  FROM jsonb_array_elements(security_events) as event
  WHERE (event->>'timestamp')::timestamp > NOW() - INTERVAL '3 months'
)
WHERE security_events IS NOT NULL;