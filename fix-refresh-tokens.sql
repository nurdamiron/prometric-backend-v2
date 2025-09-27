-- Fix refresh_tokens table to handle null values

-- Update all null token values with placeholder
UPDATE refresh_tokens SET token = 'placeholder' WHERE token IS NULL;

-- Update all null expiresAt values with past date
UPDATE refresh_tokens SET "expiresAt" = '2020-01-01 00:00:00' WHERE "expiresAt" IS NULL;

-- Alternative: Clean table completely (uncomment if needed)
-- DELETE FROM refresh_tokens WHERE token IS NULL OR "expiresAt" IS NULL;