// Value Object for Permission Name - DDD Pattern

export type PermissionNameType =
  // User management
  | 'user:create' | 'user:read' | 'user:update' | 'user:delete'
  // Customer management
  | 'customer:create' | 'customer:read' | 'customer:update' | 'customer:delete'
  // Sales pipeline
  | 'deal:create' | 'deal:read' | 'deal:update' | 'deal:delete'
  // AI permissions
  | 'ai:configure' | 'ai:chat' | 'ai:knowledge:manage'
  // Analytics
  | 'analytics:read' | 'analytics:manage'
  // Organization
  | 'organization:manage'
  // High-level permission groups for test compatibility
  | 'system.administration' | 'organization.management' | 'user.management'
  | 'department.management' | 'role.assignment' | 'data.all_access'
  | 'team.management' | 'profile.management' | 'data.department_access' | 'data.own_access';

export class PermissionName {
  private constructor(private readonly value: PermissionNameType) {}

  public static create(value: string): PermissionName {
    if (!this.isValid(value)) {
      throw new Error(`Invalid permission name: ${value}`);
    }
    return new PermissionName(value as PermissionNameType);
  }

  // User management permissions
  public static userCreate(): PermissionName {
    return new PermissionName('user:create');
  }

  public static userRead(): PermissionName {
    return new PermissionName('user:read');
  }

  public static userUpdate(): PermissionName {
    return new PermissionName('user:update');
  }

  public static userDelete(): PermissionName {
    return new PermissionName('user:delete');
  }

  // Customer management permissions
  public static customerCreate(): PermissionName {
    return new PermissionName('customer:create');
  }

  public static customerRead(): PermissionName {
    return new PermissionName('customer:read');
  }

  public static customerUpdate(): PermissionName {
    return new PermissionName('customer:update');
  }

  public static customerDelete(): PermissionName {
    return new PermissionName('customer:delete');
  }

  // Sales permissions
  public static dealCreate(): PermissionName {
    return new PermissionName('deal:create');
  }

  public static dealRead(): PermissionName {
    return new PermissionName('deal:read');
  }

  public static dealUpdate(): PermissionName {
    return new PermissionName('deal:update');
  }

  public static dealDelete(): PermissionName {
    return new PermissionName('deal:delete');
  }

  // AI permissions
  public static aiConfigure(): PermissionName {
    return new PermissionName('ai:configure');
  }

  public static aiChat(): PermissionName {
    return new PermissionName('ai:chat');
  }

  public static aiKnowledgeManage(): PermissionName {
    return new PermissionName('ai:knowledge:manage');
  }

  // Analytics permissions
  public static analyticsRead(): PermissionName {
    return new PermissionName('analytics:read');
  }

  public static analyticsManage(): PermissionName {
    return new PermissionName('analytics:manage');
  }

  // Organization permissions
  public static organizationManage(): PermissionName {
    return new PermissionName('organization:manage');
  }

  // High-level permission groups (for test compatibility)
  public static systemAdministration(): PermissionName {
    return new PermissionName('system.administration');
  }

  public static organizationManagement(): PermissionName {
    return new PermissionName('organization.management');
  }

  public static userManagement(): PermissionName {
    return new PermissionName('user.management');
  }

  public static departmentManagement(): PermissionName {
    return new PermissionName('department.management');
  }

  public static roleAssignment(): PermissionName {
    return new PermissionName('role.assignment');
  }

  public static dataAllAccess(): PermissionName {
    return new PermissionName('data.all_access');
  }

  public static teamManagement(): PermissionName {
    return new PermissionName('team.management');
  }

  public static profileManagement(): PermissionName {
    return new PermissionName('profile.management');
  }

  public static dataDepartmentAccess(): PermissionName {
    return new PermissionName('data.department_access');
  }

  public static dataOwnAccess(): PermissionName {
    return new PermissionName('data.own_access');
  }

  public getValue(): PermissionNameType {
    return this.value;
  }

  public getResource(): string {
    return this.value.split(':')[0] || '';
  }

  public getAction(): string {
    const parts = this.value.split(':');
    return parts[parts.length - 1] || '';
  }

  public isUserPermission(): boolean {
    return this.value.startsWith('user:');
  }

  public isCustomerPermission(): boolean {
    return this.value.startsWith('customer:');
  }

  public isDealPermission(): boolean {
    return this.value.startsWith('deal:');
  }

  public isAiPermission(): boolean {
    return this.value.startsWith('ai:');
  }

  public isAnalyticsPermission(): boolean {
    return this.value.startsWith('analytics:');
  }

  public isOrganizationPermission(): boolean {
    return this.value.startsWith('organization:');
  }

  public isManagePermission(): boolean {
    return this.value.includes('manage') || this.value.includes('delete');
  }

  public equals(other: PermissionName): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    const validPermissions: PermissionNameType[] = [
      'user:create', 'user:read', 'user:update', 'user:delete',
      'customer:create', 'customer:read', 'customer:update', 'customer:delete',
      'deal:create', 'deal:read', 'deal:update', 'deal:delete',
      'ai:configure', 'ai:chat', 'ai:knowledge:manage',
      'analytics:read', 'analytics:manage',
      'organization:manage',
      'system.administration', 'organization.management', 'user.management',
      'department.management', 'role.assignment', 'data.all_access',
      'team.management', 'profile.management', 'data.department_access', 'data.own_access'
    ];
    return validPermissions.includes(value as PermissionNameType);
  }
}