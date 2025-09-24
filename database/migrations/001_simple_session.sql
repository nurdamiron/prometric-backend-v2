-- 🏗️ SIMPLE SESSION MANAGEMENT MIGRATION
-- Add session fields to existing users table

-- Session management fields
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45);
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN known_devices JSONB;
ALTER TABLE users ADD COLUMN security_events JSONB;

-- Create refresh_tokens table
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  jti VARCHAR(255) UNIQUE NOT NULL,
  device_fingerprint VARCHAR(255),
  user_agent TEXT,
  ip_address VARCHAR(45),
  device_info JSONB,
  expires_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revocation_reason VARCHAR(100),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at);
CREATE INDEX idx_refresh_tokens_jti ON refresh_tokens(jti);

-- Create indexes for users table security fields
CREATE INDEX idx_users_last_login_at ON users(last_login_at);
CREATE INDEX idx_users_locked_until ON users(locked_until);
CREATE INDEX idx_users_failed_attempts ON users(failed_login_attempts);