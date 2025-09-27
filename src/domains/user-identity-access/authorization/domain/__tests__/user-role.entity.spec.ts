// Unit tests for UserRole Domain Entity - DDD Pattern
import { UserRole } from '../entities/user-role.entity';
import { RoleName } from '../value-objects/role-name.vo';

describe('UserRole Domain Entity', () => {
  const mockUserRoleProps = {
    id: 'user-role-123',
    userId: 'user-456',
    organizationId: 'org-789',
    roleName: RoleName.employee(),
    assignedBy: 'admin-user-123',
    assignedAt: new Date('2024-01-15T10:00:00Z'),
    isActive: true
  };

  describe('Creation', () => {
    test('should create user role with valid properties', () => {
      const userRole = UserRole.create(mockUserRoleProps);

      expect(userRole.getId()).toBe('user-role-123');
      expect(userRole.getUserId()).toBe('user-456');
      expect(userRole.getOrganizationId()).toBe('org-789');
      expect(userRole.getRoleName().getValue()).toBe('employee');
      expect(userRole.getAssignedBy()).toBe('admin-user-123');
      expect(userRole.getAssignedAt()).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(userRole.isActive()).toBe(true);
    });

    test('should create user role with department isolation', () => {
      const propsWithDepartment = {
        ...mockUserRoleProps,
        departmentId: 'dept-sales-123'
      };

      const userRole = UserRole.create(propsWithDepartment);

      expect(userRole.getDepartmentId()).toBe('dept-sales-123');
      expect(userRole.isDepartmentSpecific()).toBe(true);
    });

    test('should create organization-wide role without department', () => {
      const userRole = UserRole.create(mockUserRoleProps);

      expect(userRole.getDepartmentId()).toBeUndefined();
      expect(userRole.isDepartmentSpecific()).toBe(false);
      expect(userRole.isOrganizationWide()).toBe(true);
    });

    test('should create user role with expiration date', () => {
      const validUntil = new Date('2024-12-31T23:59:59Z');
      const propsWithExpiry = {
        ...mockUserRoleProps,
        validUntil
      };

      const userRole = UserRole.create(propsWithExpiry);

      expect(userRole.getValidUntil()).toEqual(validUntil);
      expect(userRole.hasExpiration()).toBe(true);
    });

    test('should throw error for invalid user ID', () => {
      const invalidProps = { ...mockUserRoleProps, userId: '' };
      expect(() => UserRole.create(invalidProps)).toThrow('User ID is required');
    });

    test('should throw error for invalid organization ID', () => {
      const invalidProps = { ...mockUserRoleProps, organizationId: '' };
      expect(() => UserRole.create(invalidProps)).toThrow('Organization ID is required');
    });

    test('should throw error for invalid assigner ID', () => {
      const invalidProps = { ...mockUserRoleProps, assignedBy: '' };
      expect(() => UserRole.create(invalidProps)).toThrow('Assigned by user ID is required');
    });

    test('should throw error for future assignment date', () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const invalidProps = { ...mockUserRoleProps, assignedAt: futureDate };
      expect(() => UserRole.create(invalidProps)).toThrow('Assignment date cannot be in the future');
    });
  });

  describe('Business Logic', () => {
    test('should correctly determine if role is expired', () => {
      const pastDate = new Date('2023-12-31T23:59:59Z');
      const futureDate = new Date('2025-12-31T23:59:59Z');

      const expiredRole = UserRole.create({
        ...mockUserRoleProps,
        validUntil: pastDate
      });

      const validRole = UserRole.create({
        ...mockUserRoleProps,
        validUntil: futureDate
      });

      const permanentRole = UserRole.create(mockUserRoleProps);

      expect(expiredRole.isExpired()).toBe(true);
      expect(validRole.isExpired()).toBe(false);
      expect(permanentRole.isExpired()).toBe(false);
    });

    test('should correctly determine if role is currently valid', () => {
      const expiredRole = UserRole.create({
        ...mockUserRoleProps,
        validUntil: new Date('2023-12-31T23:59:59Z')
      });

      const inactiveRole = UserRole.create({
        ...mockUserRoleProps,
        isActive: false
      });

      const validRole = UserRole.create(mockUserRoleProps);

      expect(expiredRole.isCurrentlyValid()).toBe(false);
      expect(inactiveRole.isCurrentlyValid()).toBe(false);
      expect(validRole.isCurrentlyValid()).toBe(true);
    });

    test('should correctly determine role permissions based on role name', () => {
      const ownerRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.owner()
      });

      const adminRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.admin()
      });

      const managerRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.manager()
      });

      const employeeRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.employee()
      });

      expect(ownerRole.canManageUsers()).toBe(true);
      expect(adminRole.canManageUsers()).toBe(true);
      expect(managerRole.canManageUsers()).toBe(false);
      expect(employeeRole.canManageUsers()).toBe(false);

      expect(ownerRole.canAdministrateSystem()).toBe(true);
      expect(adminRole.canAdministrateSystem()).toBe(false);
      expect(managerRole.canAdministrateSystem()).toBe(false);
      expect(employeeRole.canAdministrateSystem()).toBe(false);
    });

    test('should correctly handle department isolation logic', () => {
      const orgWideRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.admin()
      });

      const deptRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.manager(),
        departmentId: 'dept-sales-123'
      });

      expect(orgWideRole.hasAccessToDepartment('any-dept')).toBe(true);
      expect(deptRole.hasAccessToDepartment('dept-sales-123')).toBe(true);
      expect(deptRole.hasAccessToDepartment('dept-marketing-456')).toBe(false);
    });
  });

  describe('Role Management', () => {
    test('should allow deactivation of role', () => {
      const userRole = UserRole.create(mockUserRoleProps);
      expect(userRole.isActive()).toBe(true);

      userRole.deactivate();
      expect(userRole.isActive()).toBe(false);
      expect(userRole.isCurrentlyValid()).toBe(false);
    });

    test('should allow reactivation of role if not expired', () => {
      const userRole = UserRole.create({
        ...mockUserRoleProps,
        isActive: false
      });

      expect(userRole.isActive()).toBe(false);

      userRole.reactivate();
      expect(userRole.isActive()).toBe(true);
      expect(userRole.isCurrentlyValid()).toBe(true);
    });

    test('should not allow reactivation of expired role', () => {
      const expiredRole = UserRole.create({
        ...mockUserRoleProps,
        validUntil: new Date('2023-12-31T23:59:59Z'),
        isActive: false
      });

      expect(() => expiredRole.reactivate()).toThrow('Cannot reactivate expired role');
    });

    test('should allow extending role expiration', () => {
      const originalExpiry = new Date('2025-06-30T23:59:59Z');
      const newExpiry = new Date('2025-12-31T23:59:59Z');

      const userRole = UserRole.create({
        ...mockUserRoleProps,
        validUntil: originalExpiry
      });

      userRole.extendValidUntil(newExpiry);
      expect(userRole.getValidUntil()).toEqual(newExpiry);
    });

    test('should not allow setting expiration date in the past', () => {
      const userRole = UserRole.create(mockUserRoleProps);
      const pastDate = new Date('2023-01-01T00:00:00Z');

      expect(() => userRole.extendValidUntil(pastDate)).toThrow('Valid until date cannot be in the past');
    });
  });

  describe('Domain Events', () => {
    test('should record role assignment event on creation', () => {
      const userRole = UserRole.create(mockUserRoleProps);

      const events = userRole.getUncommittedEvents();
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.aggregateId).toBe('user-role-123');
      expect(event.eventType).toBe('UserRoleAssigned');
      expect(event.eventData.userId).toBe('user-456');
      expect(event.eventData.roleName).toBe('employee');
    });

    test('should record role deactivation event', () => {
      const userRole = UserRole.create(mockUserRoleProps);
      userRole.markEventsAsCommitted(); // Clear creation events

      userRole.deactivate();

      const events = userRole.getUncommittedEvents();
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.eventType).toBe('UserRoleDeactivated');
      expect(event.eventData.userId).toBe('user-456');
    });

    test('should record role extension event', () => {
      const newExpiry = new Date('2025-12-31T23:59:59Z');
      const userRole = UserRole.create(mockUserRoleProps);
      userRole.markEventsAsCommitted();

      userRole.extendValidUntil(newExpiry);

      const events = userRole.getUncommittedEvents();
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.eventType).toBe('UserRoleExtended');
      expect(event.eventData.newValidUntil).toEqual(newExpiry);
    });

    test('should clear events after marking as committed', () => {
      const userRole = UserRole.create(mockUserRoleProps);
      expect(userRole.getUncommittedEvents()).toHaveLength(1);

      userRole.markEventsAsCommitted();
      expect(userRole.getUncommittedEvents()).toHaveLength(0);
    });
  });

  describe('Role Hierarchy and Access Control', () => {
    test('should correctly determine if role can assign other roles', () => {
      const ownerRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.owner()
      });

      const adminRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.admin()
      });

      const managerRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.manager()
      });

      const employeeRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.employee()
      });

      expect(ownerRole.canAssignRole(RoleName.admin())).toBe(true);
      expect(ownerRole.canAssignRole(RoleName.owner())).toBe(true);

      expect(adminRole.canAssignRole(RoleName.manager())).toBe(true);
      expect(adminRole.canAssignRole(RoleName.employee())).toBe(true);
      expect(adminRole.canAssignRole(RoleName.owner())).toBe(false);

      expect(managerRole.canAssignRole(RoleName.employee())).toBe(false);
      expect(employeeRole.canAssignRole(RoleName.employee())).toBe(false);
    });

    test('should handle cross-department role assignment restrictions', () => {
      const orgAdminRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.admin()
      });

      const deptManagerRole = UserRole.create({
        ...mockUserRoleProps,
        roleName: RoleName.manager(),
        departmentId: 'dept-sales'
      });

      // Organization admin can assign roles in any department
      expect(orgAdminRole.canAssignRoleInDepartment('dept-marketing')).toBe(true);
      expect(orgAdminRole.canAssignRoleInDepartment('dept-sales')).toBe(true);

      // Department manager can only assign roles in their department
      expect(deptManagerRole.canAssignRoleInDepartment('dept-sales')).toBe(true);
      expect(deptManagerRole.canAssignRoleInDepartment('dept-marketing')).toBe(false);
    });
  });

  describe('Equality and Comparison', () => {
    test('should correctly compare user roles for equality', () => {
      const role1 = UserRole.create(mockUserRoleProps);
      const role2 = UserRole.create({ ...mockUserRoleProps });
      const role3 = UserRole.create({ ...mockUserRoleProps, userId: 'different-user' });

      expect(role1.equals(role2)).toBe(true);
      expect(role1.equals(role3)).toBe(false);
    });

    test('should correctly generate hash code', () => {
      const role1 = UserRole.create(mockUserRoleProps);
      const role2 = UserRole.create({ ...mockUserRoleProps });
      const role3 = UserRole.create({ ...mockUserRoleProps, userId: 'different-user' });

      expect(role1.getHashCode()).toBe(role2.getHashCode());
      expect(role1.getHashCode()).not.toBe(role3.getHashCode());
    });
  });

  describe('Validation and Edge Cases', () => {
    test('should handle role with minimum valid properties', () => {
      const minimalProps = {
        id: 'min-role',
        userId: 'user-1',
        organizationId: 'org-1',
        roleName: RoleName.employee(),
        assignedBy: 'admin-1',
        assignedAt: new Date(),
        isActive: true
      };

      expect(() => UserRole.create(minimalProps)).not.toThrow();
    });

    test('should handle role assignment at exact current time', () => {
      const now = new Date();
      const propsWithNow = {
        ...mockUserRoleProps,
        assignedAt: now
      };

      expect(() => UserRole.create(propsWithNow)).not.toThrow();
    });

    test('should handle role with very long IDs', () => {
      const longId = 'a'.repeat(100);
      const propsWithLongId = {
        ...mockUserRoleProps,
        id: longId,
        userId: longId,
        organizationId: longId
      };

      expect(() => UserRole.create(propsWithLongId)).not.toThrow();
    });
  });

  describe('Serialization', () => {
    test('should correctly serialize to plain object', () => {
      const userRole = UserRole.create(mockUserRoleProps);
      const serialized = userRole.toPlainObject();

      expect(serialized.id).toBe('user-role-123');
      expect(serialized.userId).toBe('user-456');
      expect(serialized.organizationId).toBe('org-789');
      expect(serialized.roleName).toBe('employee');
      expect(serialized.assignedBy).toBe('admin-user-123');
      expect(serialized.isActive).toBe(true);
    });

    test('should include optional properties in serialization', () => {
      const propsWithOptional = {
        ...mockUserRoleProps,
        departmentId: 'dept-123',
        validUntil: new Date('2025-12-31T23:59:59Z')
      };

      const userRole = UserRole.create(propsWithOptional);
      const serialized = userRole.toPlainObject();

      expect(serialized.departmentId).toBe('dept-123');
      expect(serialized.validUntil).toEqual(new Date('2025-12-31T23:59:59Z'));
    });
  });
});