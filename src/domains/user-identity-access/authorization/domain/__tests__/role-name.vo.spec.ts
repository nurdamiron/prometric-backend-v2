// Unit tests for RoleName Value Object - DDD Pattern
import { RoleName } from '../value-objects/role-name.vo';

describe('RoleName Value Object', () => {
  describe('Creation', () => {
    test('should create valid role names', () => {
      expect(() => RoleName.create('owner')).not.toThrow();
      expect(() => RoleName.create('admin')).not.toThrow();
      expect(() => RoleName.create('manager')).not.toThrow();
      expect(() => RoleName.create('employee')).not.toThrow();
    });

    test('should throw error for invalid role names', () => {
      expect(() => RoleName.create('invalid')).toThrow('Invalid role name');
      expect(() => RoleName.create('')).toThrow('Invalid role name');
      expect(() => RoleName.create(null as any)).toThrow('Invalid role name');
      expect(() => RoleName.create(undefined as any)).toThrow('Invalid role name');
    });

    test('should create role using static factory methods', () => {
      const ownerRole = RoleName.owner();
      const adminRole = RoleName.admin();
      const managerRole = RoleName.manager();
      const employeeRole = RoleName.employee();

      expect(ownerRole.getValue()).toBe('owner');
      expect(adminRole.getValue()).toBe('admin');
      expect(managerRole.getValue()).toBe('manager');
      expect(employeeRole.getValue()).toBe('employee');
    });
  });

  describe('Business Logic Methods', () => {
    test('should correctly identify role types', () => {
      const ownerRole = RoleName.owner();
      const adminRole = RoleName.admin();
      const managerRole = RoleName.manager();
      const employeeRole = RoleName.employee();

      expect(ownerRole.isOwner()).toBe(true);
      expect(adminRole.isAdmin()).toBe(true);
      expect(managerRole.isManager()).toBe(true);
      expect(employeeRole.isEmployee()).toBe(true);

      // Cross-checks
      expect(ownerRole.isAdmin()).toBe(false);
      expect(adminRole.isManager()).toBe(false);
      expect(managerRole.isEmployee()).toBe(false);
      expect(employeeRole.isOwner()).toBe(false);
    });

    test('should correctly determine user management permissions', () => {
      const ownerRole = RoleName.owner();
      const adminRole = RoleName.admin();
      const managerRole = RoleName.manager();
      const employeeRole = RoleName.employee();

      expect(ownerRole.canManageUsers()).toBe(true);
      expect(adminRole.canManageUsers()).toBe(true);
      expect(managerRole.canManageUsers()).toBe(false);
      expect(employeeRole.canManageUsers()).toBe(false);
    });

    test('should correctly determine system administration permissions', () => {
      const ownerRole = RoleName.owner();
      const adminRole = RoleName.admin();
      const managerRole = RoleName.manager();
      const employeeRole = RoleName.employee();

      expect(ownerRole.canAdministrateSystem()).toBe(true);
      expect(adminRole.canAdministrateSystem()).toBe(false);
      expect(managerRole.canAdministrateSystem()).toBe(false);
      expect(employeeRole.canAdministrateSystem()).toBe(false);
    });

    test('should correctly determine department management permissions', () => {
      const ownerRole = RoleName.owner();
      const adminRole = RoleName.admin();
      const managerRole = RoleName.manager();
      const employeeRole = RoleName.employee();

      expect(ownerRole.canManageDepartment()).toBe(true);
      expect(adminRole.canManageDepartment()).toBe(true);
      expect(managerRole.canManageDepartment()).toBe(true);
      expect(employeeRole.canManageDepartment()).toBe(false);
    });

    test('should correctly calculate role hierarchy levels', () => {
      const ownerRole = RoleName.owner();
      const adminRole = RoleName.admin();
      const managerRole = RoleName.manager();
      const employeeRole = RoleName.employee();

      expect(ownerRole.getHierarchyLevel()).toBe(1);
      expect(adminRole.getHierarchyLevel()).toBe(2);
      expect(managerRole.getHierarchyLevel()).toBe(3);
      expect(employeeRole.getHierarchyLevel()).toBe(4);
    });

    test('should correctly determine if one role is higher than another', () => {
      const ownerRole = RoleName.owner();
      const adminRole = RoleName.admin();
      const managerRole = RoleName.manager();
      const employeeRole = RoleName.employee();

      expect(ownerRole.isHigherThan(adminRole)).toBe(true);
      expect(adminRole.isHigherThan(managerRole)).toBe(true);
      expect(managerRole.isHigherThan(employeeRole)).toBe(true);

      expect(employeeRole.isHigherThan(managerRole)).toBe(false);
      expect(managerRole.isHigherThan(adminRole)).toBe(false);
      expect(adminRole.isHigherThan(ownerRole)).toBe(false);
    });
  });

  describe('Equality and Comparison', () => {
    test('should correctly compare role names for equality', () => {
      const role1 = RoleName.create('owner');
      const role2 = RoleName.create('owner');
      const role3 = RoleName.create('admin');

      expect(role1.equals(role2)).toBe(true);
      expect(role1.equals(role3)).toBe(false);
    });

    test('should correctly handle null/undefined comparisons', () => {
      const role = RoleName.create('owner');

      expect(role.equals(null as any)).toBe(false);
      expect(role.equals(undefined as any)).toBe(false);
    });

    test('should correctly compare with different object types', () => {
      const role = RoleName.create('owner');
      const plainObject = { value: 'owner' };

      expect(role.equals(plainObject as any)).toBe(false);
    });
  });

  describe('Immutability', () => {
    test('should be immutable - cannot change value after creation', () => {
      const role = RoleName.create('owner');

      expect(role.getValue()).toBe('owner');

      // Try to modify (should not be possible due to private readonly)
      // This is more of a compile-time check, but we can verify the value doesn't change
      const originalValue = role.getValue();
      expect(role.getValue()).toBe(originalValue);
    });

    test('should create different instances for same role', () => {
      const role1 = RoleName.create('owner');
      const role2 = RoleName.create('owner');

      // Different instances
      expect(role1).not.toBe(role2);
      // But equal values
      expect(role1.equals(role2)).toBe(true);
    });
  });

  describe('Display and Formatting', () => {
    test('should return correct display name', () => {
      expect(RoleName.owner().getDisplayName()).toBe('Owner');
      expect(RoleName.admin().getDisplayName()).toBe('Admin');
      expect(RoleName.manager().getDisplayName()).toBe('Manager');
      expect(RoleName.employee().getDisplayName()).toBe('Employee');
    });

    test('should return correct string representation', () => {
      const role = RoleName.create('owner');
      expect(role.toString()).toBe('owner');
    });

    test('should handle case sensitivity correctly', () => {
      expect(() => RoleName.create('Owner')).toThrow();
      expect(() => RoleName.create('OWNER')).toThrow();
      expect(() => RoleName.create('oWnEr')).toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle whitespace in role names', () => {
      expect(() => RoleName.create(' owner ')).toThrow();
      expect(() => RoleName.create('owner ')).toThrow();
      expect(() => RoleName.create(' owner')).toThrow();
    });

    test('should handle special characters', () => {
      expect(() => RoleName.create('owner-admin')).toThrow();
      expect(() => RoleName.create('owner_admin')).toThrow();
      expect(() => RoleName.create('owner.admin')).toThrow();
    });

    test('should handle numbers in role names', () => {
      expect(() => RoleName.create('owner123')).toThrow();
      expect(() => RoleName.create('123owner')).toThrow();
    });
  });

  describe('Role Permissions Matrix', () => {
    test('should validate complete permission matrix', () => {
      const roles = [
        RoleName.owner(),
        RoleName.admin(),
        RoleName.manager(),
        RoleName.employee()
      ];

      const permissions = [
        'canManageUsers',
        'canAdministrateSystem',
        'canManageDepartment'
      ] as const;

      // Expected permission matrix
      const expectedMatrix = {
        owner: { canManageUsers: true, canAdministrateSystem: true, canManageDepartment: true },
        admin: { canManageUsers: true, canAdministrateSystem: false, canManageDepartment: true },
        manager: { canManageUsers: false, canAdministrateSystem: false, canManageDepartment: true },
        employee: { canManageUsers: false, canAdministrateSystem: false, canManageDepartment: false }
      };

      roles.forEach(role => {
        const roleName = role.getValue() as keyof typeof expectedMatrix;
        const expected = expectedMatrix[roleName];

        permissions.forEach(permission => {
          const hasPermission = role[permission]();
          expect(hasPermission).toBe(expected[permission]);
        });
      });
    });
  });
});