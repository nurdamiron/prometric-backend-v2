-- Setup Test User for AI Brain Testing
-- Run this in PostgreSQL to create a complete test environment

-- 1. Check current user status
SELECT id, email, status, onboarding_step, verification_code, organization_id
FROM users
WHERE email = 'aitest@prometric.kz';

-- 2. Create organization first (if not exists)
INSERT INTO organizations (id, name, bin, industry, address, city, phone, email, status)
VALUES (
  'test-org-' || extract(epoch from now())::text,
  'Prometric Test Company',
  '123456789012',
  'Technology',
  'Алматы, ул. Абая 150',
  'Алматы',
  '+77771234567',
  'test@prometric-company.kz',
  'active'
) ON CONFLICT (bin) DO NOTHING;

-- 3. Force verify the user and complete onboarding
UPDATE users
SET
  status = 'active',
  onboarding_step = 'completed',
  verification_code = NULL,
  verification_expires_at = NULL,
  role = 'owner',
  organization_id = (SELECT id FROM organizations WHERE bin = '123456789012' LIMIT 1)
WHERE email = 'aitest@prometric.kz';

-- 4. Verify the setup is complete
SELECT
  u.id as user_id,
  u.email,
  u.status,
  u.role,
  u.onboarding_step,
  u.organization_id,
  o.name as org_name,
  o.bin as org_bin,
  o.industry
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE u.email = 'aitest@prometric.kz';

-- Expected result:
-- user_id: [uuid]
-- email: aitest@prometric.kz
-- status: active
-- role: owner
-- onboarding_step: completed
-- organization_id: [uuid]
-- org_name: Prometric Test Company
-- org_bin: 123456789012
-- industry: Technology