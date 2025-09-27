-- Update User Roles Structure to DDD Format
-- Migrates from old role_id structure to new role_name + department_id structure

-- Backup existing data before migration
CREATE TABLE IF NOT EXISTS user_roles_backup AS
SELECT * FROM user_roles;

-- Drop foreign key constraint to role_id (if exists)
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS FK_user_roles_role_id;

-- Add new columns for DDD structure
ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS role_name VARCHAR(20),
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id),
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP;

-- Migrate existing data from old structure to new structure
-- Assuming we have roles table with name field
UPDATE user_roles
SET role_name = (
  SELECT r.name
  FROM roles r
  WHERE r.id = user_roles.role_id
)
WHERE role_name IS NULL;

-- Set default role_name if no match found
UPDATE user_roles
SET role_name = 'employee'
WHERE role_name IS NULL;

-- Update expires_at column name to valid_until
UPDATE user_roles
SET valid_until = expires_at
WHERE expires_at IS NOT NULL;

-- Drop old columns after data migration
ALTER TABLE user_roles
DROP COLUMN IF EXISTS role_id,
DROP COLUMN IF EXISTS expires_at;

-- Add constraints for new structure
ALTER TABLE user_roles
ADD CONSTRAINT CHK_user_roles_role_name
CHECK (role_name IN ('owner', 'admin', 'manager', 'employee'));

-- Make role_name NOT NULL
ALTER TABLE user_roles
ALTER COLUMN role_name SET NOT NULL;

-- Update indexes for new structure
DROP INDEX IF EXISTS idx_user_roles_role_id;
DROP INDEX IF EXISTS IDX_user_roles_roleId;

-- Create new optimized indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_role_name
ON user_roles(role_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_org_dept
ON user_roles(user_id, organization_id, department_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_org_dept_active
ON user_roles(organization_id, department_id, is_active);

-- Update any existing test/demo data with proper role names
UPDATE user_roles
SET role_name = 'owner'
WHERE user_id IN (
  SELECT u.id FROM users u
  WHERE u.email LIKE '%admin%' OR u.email LIKE '%owner%'
)
AND role_name != 'owner';

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_active_roles
ON user_roles(organization_id, role_name)
WHERE is_active = true;

-- Add comment for documentation
COMMENT ON COLUMN user_roles.role_name IS 'User role: owner, admin, manager, employee';
COMMENT ON COLUMN user_roles.department_id IS 'Department ID for manager/employee roles, NULL for organization-wide roles';
COMMENT ON COLUMN user_roles.valid_until IS 'Role expiration date, NULL for permanent roles';