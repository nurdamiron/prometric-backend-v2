// Unit tests for Authorization Domain Service - DDD Pattern
import { AuthorizationDomainService } from '../services/authorization-domain.service';
import { UserRole } from '../entities/user-role.entity';
import { RoleName } from '../value-objects/role-name.vo';
import { PermissionName } from '../value-objects/permission-name.vo';

describe('Authorization Domain Service', () => {
  let authorizationService: AuthorizationDomainService;

  beforeEach(() => {
    authorizationService = new AuthorizationDomainService();
  });

  const createMockUserRole = (roleName: string, departmentId?: string) => {
    return UserRole.create({
      id: `role-${roleName}-${Math.random()}`,
      userId: 'user-123',
      organizationId: 'org-456',
      departmentId,
      roleName: RoleName.create(roleName),
      assignedBy: 'admin-789',
      assignedAt: new Date(),
      isActive: true
    });
  };

  describe('getUserPermissions', () => {
    test('should return owner permissions for owner role', () => {
      const ownerRole = createMockUserRole('owner');
      const permissions = authorizationService.getUserPermissions([ownerRole], 'org-456');

      expect(permissions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: 'system.administration' }),
          expect.objectContaining({ value: 'organization.management' }),
          expect.objectContaining({ value: 'user.management' }),
          expect.objectContaining({ value: 'department.management' }),
          expect.objectContaining({ value: 'role.assignment' }),
          expect.objectContaining({ value: 'data.all_access' })
        ])
      );
    });

    test('should return admin permissions for admin role', () => {
      const adminRole = createMockUserRole('admin');
      const permissions = authorizationService.getUserPermissions([adminRole], 'org-456');

      const permissionValues = permissions.map(p => p.getValue());

      expect(permissionValues).toContain('organization.management');
      expect(permissionValues).toContain('user.management');
      expect(permissionValues).toContain('department.management');
      expect(permissionValues).toContain('role.assignment');
      expect(permissionValues).not.toContain('system.administration');
    });

    test('should return manager permissions for manager role', () => {
      const managerRole = createMockUserRole('manager', 'dept-sales');
      const permissions = authorizationService.getUserPermissions([managerRole], 'org-456');

      const permissionValues = permissions.map(p => p.getValue());

      expect(permissionValues).toContain('department.management');
      expect(permissionValues).toContain('team.management');
      expect(permissionValues).toContain('data.department_access');
      expect(permissionValues).not.toContain('user.management');
      expect(permissionValues).not.toContain('organization.management');
    });

    test('should return employee permissions for employee role', () => {
      const employeeRole = createMockUserRole('employee', 'dept-sales');
      const permissions = authorizationService.getUserPermissions([employeeRole], 'org-456');

      const permissionValues = permissions.map(p => p.getValue());

      expect(permissionValues).toContain('profile.management');
      expect(permissionValues).toContain('data.own_access');
      expect(permissionValues).not.toContain('team.management');
      expect(permissionValues).not.toContain('department.management');
    });

    test('should combine permissions from multiple roles', () => {
      const managerRole = createMockUserRole('manager', 'dept-sales');
      const employeeRole = createMockUserRole('employee', 'dept-marketing');

      const permissions = authorizationService.getUserPermissions([managerRole, employeeRole], 'org-456');
      const permissionValues = permissions.map(p => p.getValue());

      expect(permissionValues).toContain('department.management'); // From manager
      expect(permissionValues).toContain('profile.management'); // From employee
      expect(permissionValues).toContain('team.management'); // From manager
    });

    test('should deduplicate permissions from multiple roles', () => {
      const managerRole1 = createMockUserRole('manager', 'dept-sales');
      const managerRole2 = createMockUserRole('manager', 'dept-marketing');

      const permissions = authorizationService.getUserPermissions([managerRole1, managerRole2], 'org-456');
      const permissionValues = permissions.map(p => p.getValue());

      // Should not have duplicates
      const uniquePermissions = [...new Set(permissionValues)];
      expect(permissionValues.length).toBe(uniquePermissions.length);
    });

    test('should filter out permissions for inactive roles', () => {
      const activeRole = createMockUserRole('admin');
      const inactiveRole = UserRole.create({
        id: 'inactive-role',
        userId: 'user-123',
        organizationId: 'org-456',
        roleName: RoleName.owner(),
        assignedBy: 'admin-789',
        assignedAt: new Date(),
        isActive: false
      });

      const permissions = authorizationService.getUserPermissions([activeRole, inactiveRole], 'org-456');
      const permissionValues = permissions.map(p => p.getValue());

      // Should have admin permissions but not owner permissions
      expect(permissionValues).toContain('user.management');
      expect(permissionValues).not.toContain('system.administration');
    });

    test('should filter out permissions for expired roles', () => {
      const activeRole = createMockUserRole('admin');
      const expiredRole = UserRole.create({
        id: 'expired-role',
        userId: 'user-123',
        organizationId: 'org-456',
        roleName: RoleName.owner(),
        assignedBy: 'admin-789',
        assignedAt: new Date('2023-01-01'),
        validUntil: new Date('2023-12-31'),
        isActive: true
      });

      const permissions = authorizationService.getUserPermissions([activeRole, expiredRole], 'org-456');
      const permissionValues = permissions.map(p => p.getValue());

      expect(permissionValues).toContain('user.management');
      expect(permissionValues).not.toContain('system.administration');
    });
  });

  describe('canAssignRole', () => {
    test('should allow owner to assign any role', () => {
      const ownerRoles = [createMockUserRole('owner')];

      expect(authorizationService.canAssignRole(ownerRoles, RoleName.owner(), 'org-456')).toBe(true);
      expect(authorizationService.canAssignRole(ownerRoles, RoleName.admin(), 'org-456')).toBe(true);
      expect(authorizationService.canAssignRole(ownerRoles, RoleName.manager(), 'org-456')).toBe(true);
      expect(authorizationService.canAssignRole(ownerRoles, RoleName.employee(), 'org-456')).toBe(true);
    });

    test('should allow admin to assign lower roles but not owner', () => {
      const adminRoles = [createMockUserRole('admin')];

      expect(authorizationService.canAssignRole(adminRoles, RoleName.owner(), 'org-456')).toBe(false);
      expect(authorizationService.canAssignRole(adminRoles, RoleName.admin(), 'org-456')).toBe(true);
      expect(authorizationService.canAssignRole(adminRoles, RoleName.manager(), 'org-456')).toBe(true);
      expect(authorizationService.canAssignRole(adminRoles, RoleName.employee(), 'org-456')).toBe(true);
    });

    test('should not allow manager to assign any roles', () => {
      const managerRoles = [createMockUserRole('manager')];

      expect(authorizationService.canAssignRole(managerRoles, RoleName.owner(), 'org-456')).toBe(false);
      expect(authorizationService.canAssignRole(managerRoles, RoleName.admin(), 'org-456')).toBe(false);
      expect(authorizationService.canAssignRole(managerRoles, RoleName.manager(), 'org-456')).toBe(false);
      expect(authorizationService.canAssignRole(managerRoles, RoleName.employee(), 'org-456')).toBe(false);
    });

    test('should not allow employee to assign any roles', () => {
      const employeeRoles = [createMockUserRole('employee')];

      expect(authorizationService.canAssignRole(employeeRoles, RoleName.owner(), 'org-456')).toBe(false);
      expect(authorizationService.canAssignRole(employeeRoles, RoleName.admin(), 'org-456')).toBe(false);
      expect(authorizationService.canAssignRole(employeeRoles, RoleName.manager(), 'org-456')).toBe(false);
      expect(authorizationService.canAssignRole(employeeRoles, RoleName.employee(), 'org-456')).toBe(false);
    });

    test('should only consider roles from the same organization', () => {
      const ownerRoleInDifferentOrg = UserRole.create({
        id: 'role-different-org',
        userId: 'user-123',
        organizationId: 'different-org',
        roleName: RoleName.owner(),
        assignedBy: 'admin-789',
        assignedAt: new Date(),
        isActive: true
      });

      expect(authorizationService.canAssignRole([ownerRoleInDifferentOrg], RoleName.admin(), 'org-456')).toBe(false);
    });

    test('should use highest role for permission check', () => {
      const managerRole = createMockUserRole('manager');
      const adminRole = createMockUserRole('admin');
      const employeeRole = createMockUserRole('employee');

      const mixedRoles = [managerRole, adminRole, employeeRole];

      // Should use admin permissions (highest role)
      expect(authorizationService.canAssignRole(mixedRoles, RoleName.manager(), 'org-456')).toBe(true);
      expect(authorizationService.canAssignRole(mixedRoles, RoleName.owner(), 'org-456')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    test('should correctly identify if user has specific permission', () => {
      const adminRole = createMockUserRole('admin');
      const userRoles = [adminRole];

      expect(authorizationService.hasPermission(userRoles, PermissionName.create('user.management'), 'org-456')).toBe(true);
      expect(authorizationService.hasPermission(userRoles, PermissionName.create('system.administration'), 'org-456')).toBe(false);
    });

    test('should return false for invalid permission names', () => {
      const adminRole = createMockUserRole('admin');
      const userRoles = [adminRole];

      expect(() => {
        authorizationService.hasPermission(userRoles, PermissionName.create('invalid.permission'), 'org-456');
      }).toThrow('Invalid permission name');
    });

    test('should handle empty role array', () => {
      expect(authorizationService.hasPermission([], PermissionName.create('profile.management'), 'org-456')).toBe(false);
    });
  });

  describe('canAccessDepartment', () => {
    test('should allow organization-wide roles to access any department', () => {
      const orgAdminRole = createMockUserRole('admin'); // No department specified

      expect(authorizationService.canAccessDepartment([orgAdminRole], 'dept-sales', 'org-456')).toBe(true);
      expect(authorizationService.canAccessDepartment([orgAdminRole], 'dept-marketing', 'org-456')).toBe(true);
    });

    test('should allow department-specific roles to access only their department', () => {
      const deptManagerRole = createMockUserRole('manager', 'dept-sales');

      expect(authorizationService.canAccessDepartment([deptManagerRole], 'dept-sales', 'org-456')).toBe(true);
      expect(authorizationService.canAccessDepartment([deptManagerRole], 'dept-marketing', 'org-456')).toBe(false);
    });

    test('should handle mixed role scenarios', () => {
      const orgAdminRole = createMockUserRole('admin'); // Organization-wide
      const deptManagerRole = createMockUserRole('manager', 'dept-sales'); // Department-specific

      const mixedRoles = [orgAdminRole, deptManagerRole];

      // Should have access because of org-wide admin role
      expect(authorizationService.canAccessDepartment(mixedRoles, 'dept-marketing', 'org-456')).toBe(true);
    });

    test('should return false for different organization', () => {
      const adminRole = createMockUserRole('admin');

      expect(authorizationService.canAccessDepartment([adminRole], 'dept-sales', 'different-org')).toBe(false);
    });
  });

  describe('getHighestRole', () => {
    test('should return highest role from multiple roles', () => {
      const employeeRole = createMockUserRole('employee');
      const managerRole = createMockUserRole('manager');
      const adminRole = createMockUserRole('admin');
      const ownerRole = createMockUserRole('owner');

      expect(authorizationService.getHighestRole([employeeRole, managerRole])?.getValue()).toBe('manager');
      expect(authorizationService.getHighestRole([managerRole, adminRole])?.getValue()).toBe('admin');
      expect(authorizationService.getHighestRole([adminRole, ownerRole])?.getValue()).toBe('owner');
      expect(authorizationService.getHighestRole([employeeRole, ownerRole, managerRole])?.getValue()).toBe('owner');
    });

    test('should return null for empty roles array', () => {
      expect(authorizationService.getHighestRole([])).toBeNull();
    });

    test('should return single role when only one role provided', () => {
      const managerRole = createMockUserRole('manager');

      expect(authorizationService.getHighestRole([managerRole])?.getValue()).toBe('manager');
    });

    test('should handle duplicate roles', () => {
      const managerRole1 = createMockUserRole('manager');
      const managerRole2 = createMockUserRole('manager');

      expect(authorizationService.getHighestRole([managerRole1, managerRole2])?.getValue()).toBe('manager');
    });
  });

  describe('validateOrganizationAccess', () => {
    test('should validate user has access to organization', () => {
      const adminRole = createMockUserRole('admin');

      expect(() => {
        authorizationService.validateOrganizationAccess([adminRole], 'org-456');
      }).not.toThrow();
    });

    test('should throw error if user has no roles in organization', () => {
      const roleInDifferentOrg = UserRole.create({
        id: 'role-different-org',
        userId: 'user-123',
        organizationId: 'different-org',
        roleName: RoleName.admin(),
        assignedBy: 'admin-789',
        assignedAt: new Date(),
        isActive: true
      });

      expect(() => {
        authorizationService.validateOrganizationAccess([roleInDifferentOrg], 'org-456');
      }).toThrow('User does not have access to organization org-456');
    });

    test('should throw error for empty roles array', () => {
      expect(() => {
        authorizationService.validateOrganizationAccess([], 'org-456');
      }).toThrow('User has no active roles');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null/undefined inputs gracefully', () => {
      expect(authorizationService.getUserPermissions(null as any, 'org-456')).toEqual([]);
      expect(authorizationService.getUserPermissions(undefined as any, 'org-456')).toEqual([]);
      expect(authorizationService.canAssignRole(null as any, RoleName.employee(), 'org-456')).toBe(false);
    });

    test('should handle invalid organization ID', () => {
      const adminRole = createMockUserRole('admin');

      expect(authorizationService.getUserPermissions([adminRole], '')).toEqual([]);
      expect(authorizationService.canAssignRole([adminRole], RoleName.employee(), '')).toBe(false);
    });

    test('should handle roles with null/undefined properties', () => {
      // This would typically be caught at entity creation, but testing defensive programming
      const validRole = createMockUserRole('admin');

      expect(authorizationService.getUserPermissions([validRole], 'org-456')).toBeDefined();
    });
  });

  describe('Performance Considerations', () => {
    test('should efficiently handle large number of roles', () => {
      const roles = Array.from({ length: 100 }, (_, i) => createMockUserRole('employee'));

      const startTime = Date.now();
      const permissions = authorizationService.getUserPermissions(roles, 'org-456');
      const endTime = Date.now();

      // Should complete in reasonable time (less than 100ms for 100 roles)
      expect(endTime - startTime).toBeLessThan(100);
      expect(permissions.length).toBeGreaterThan(0);
    });

    test('should cache permission calculations for identical role sets', () => {
      const roles = [createMockUserRole('admin'), createMockUserRole('manager')];

      const permissions1 = authorizationService.getUserPermissions(roles, 'org-456');
      const permissions2 = authorizationService.getUserPermissions(roles, 'org-456');

      // Results should be identical
      expect(permissions1).toEqual(permissions2);
    });
  });
});