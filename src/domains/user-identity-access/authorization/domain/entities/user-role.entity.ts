// User Role Entity - DDD Domain Entity
import { RoleName, RoleNameType } from '../value-objects/role-name.vo';
import { PermissionName } from '../value-objects/permission-name.vo';

export interface UserRoleDomainProps {
  id: string;
  userId: string;
  organizationId: string;
  departmentId?: string; // Если null - права на весь organization
  roleName: RoleName;
  assignedBy: string;
  assignedAt: Date;
  isActive: boolean;
  validUntil?: Date;
}

export class UserRole {
  private constructor(private props: UserRoleDomainProps) {}

  public static create(props: Omit<UserRoleDomainProps, 'assignedAt'> & { isActive?: boolean; assignedAt?: Date }): UserRole {
    // Validate required fields
    if (!props.userId || props.userId.trim() === '') {
      throw new Error('User ID is required');
    }
    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new Error('Organization ID is required');
    }
    if (!props.assignedBy || props.assignedBy.trim() === '') {
      throw new Error('Assigned by user ID is required');
    }
    if (props.assignedAt && props.assignedAt > new Date()) {
      throw new Error('Assignment date cannot be in the future');
    }

    const userRole = new UserRole({
      ...props,
      id: props.id || crypto.randomUUID(),
      assignedAt: props.assignedAt || new Date(),
      isActive: props.isActive ?? true,
    });

    // Add domain event for role assignment
    userRole.addEvent({
      aggregateId: userRole.getId(),
      eventType: 'UserRoleAssigned',
      eventData: {
        userId: userRole.getUserId(),
        organizationId: userRole.getOrganizationId(),
        roleName: userRole.getRoleName().getValue(),
        assignedBy: userRole.getAssignedBy(),
        assignedAt: userRole.getAssignedAt()
      }
    });

    return userRole;
  }

  public static reconstitute(props: UserRoleDomainProps): UserRole {
    return new UserRole(props);
  }

  // Getters
  public getId(): string {
    return this.props.id;
  }

  public getUserId(): string {
    return this.props.userId;
  }

  public getOrganizationId(): string {
    return this.props.organizationId;
  }

  public getDepartmentId(): string | undefined {
    return this.props.departmentId;
  }

  public getRoleName(): RoleName {
    return this.props.roleName;
  }

  public getAssignedBy(): string {
    return this.props.assignedBy;
  }

  public getAssignedAt(): Date {
    return this.props.assignedAt;
  }

  public isActive(): boolean {
    return this.props.isActive && !this.isExpired();
  }

  public getValidUntil(): Date | undefined {
    return this.props.validUntil;
  }

  // Business Logic Methods
  public hasPermission(permission: PermissionName): boolean {
    if (!this.isActive()) {
      return false;
    }

    const roleName = this.props.roleName;

    // Owner has all permissions
    if (roleName.isOwner()) {
      return true;
    }

    // Admin permissions
    if (roleName.isAdmin()) {
      return this.getAdminPermissions().some(p => p.equals(permission));
    }

    // Manager permissions
    if (roleName.isManager()) {
      return this.getManagerPermissions().some(p => p.equals(permission));
    }

    // Employee permissions
    if (roleName.isEmployee()) {
      return this.getEmployeePermissions().some(p => p.equals(permission));
    }

    return false;
  }

  public canManageUser(targetUserId: string, targetRole: RoleName): boolean {
    if (!this.isActive()) {
      return false;
    }

    // Can't manage yourself
    if (this.props.userId === targetUserId) {
      return false;
    }

    const myRole = this.props.roleName;

    // Owner can manage anyone except other owners
    if (myRole.isOwner()) {
      return !targetRole.isOwner();
    }

    // Admin can manage managers and employees
    if (myRole.isAdmin()) {
      return targetRole.isManager() || targetRole.isEmployee();
    }

    // Manager can manage employees only
    if (myRole.isManager()) {
      return targetRole.isEmployee();
    }

    return false;
  }

  public canAccessOrganizationData(organizationId: string): boolean {
    return this.isActive() && this.props.organizationId === organizationId;
  }

  public canAccessDepartmentData(organizationId: string, departmentId: string): boolean {
    if (!this.canAccessOrganizationData(organizationId)) {
      return false;
    }

    // Owner и Admin могут видеть все департаменты
    if (this.props.roleName.isOwner() || this.props.roleName.isAdmin()) {
      return true;
    }

    // Manager и Employee могут видеть только свой департамент
    return this.props.departmentId === departmentId;
  }

  public hasOrganizationWideAccess(): boolean {
    return this.isActive() && (
      this.props.roleName.isOwner() ||
      this.props.roleName.isAdmin() ||
      this.props.departmentId === undefined // Если departmentId null = organization-wide права
    );
  }


  // Private helper methods
  public isExpired(): boolean {
    if (!this.props.validUntil) {
      return false;
    }
    return new Date() > this.props.validUntil;
  }

  // Additional Business Logic Methods
  public isDepartmentSpecific(): boolean {
    return !!this.props.departmentId;
  }

  public isOrganizationWide(): boolean {
    return !this.props.departmentId;
  }

  public hasExpiration(): boolean {
    return !!this.props.validUntil;
  }

  public isCurrentlyValid(): boolean {
    return this.isActive() && !this.isExpired();
  }

  public canManageUsers(): boolean {
    return this.props.roleName.canManageUsers();
  }

  public canAdministrateSystem(): boolean {
    return this.props.roleName.canAdministrateSystem();
  }

  public hasAccessToDepartment(departmentId: string): boolean {
    // Organization-wide roles have access to all departments
    if (this.isOrganizationWide()) {
      return true;
    }
    // Department-specific roles only have access to their department
    return this.props.departmentId === departmentId;
  }

  public canAssignRole(targetRole: RoleName): boolean {
    const currentRole = this.props.roleName;
    
    // Owner can assign any role
    if (currentRole.isOwner()) {
      return true;
    }
    
    // Admin can assign admin, manager, employee (but not owner)
    if (currentRole.isAdmin()) {
      return targetRole.isAdmin() || targetRole.isManager() || targetRole.isEmployee();
    }
    
    // Manager cannot assign any roles (only owner and admin can assign roles)
    if (currentRole.isManager()) {
      return false;
    }
    
    // Employee cannot assign any roles
    return false;
  }

  public canAssignRoleInDepartment(departmentId: string): boolean {
    // Organization-wide roles can assign roles in any department
    if (this.isOrganizationWide()) {
      return true;
    }
    // Department-specific roles can only assign roles in their department
    return this.props.departmentId === departmentId;
  }

  // Role Management Methods
  public deactivate(): void {
    this.props.isActive = false;
    this.addEvent({
      aggregateId: this.getId(),
      eventType: 'UserRoleDeactivated',
      eventData: {
        userId: this.getUserId(),
        organizationId: this.getOrganizationId(),
        deactivatedAt: new Date()
      }
    });
  }

  public reactivate(): void {
    if (this.isExpired()) {
      throw new Error('Cannot reactivate expired role');
    }
    this.props.isActive = true;
  }

  public extendValidUntil(newExpiry: Date): void {
    if (newExpiry <= new Date()) {
      throw new Error('Valid until date cannot be in the past');
    }
    const oldExpiry = this.props.validUntil;
    this.props.validUntil = newExpiry;
    this.addEvent({
      aggregateId: this.getId(),
      eventType: 'UserRoleExtended',
      eventData: {
        userId: this.getUserId(),
        organizationId: this.getOrganizationId(),
        oldValidUntil: oldExpiry,
        newValidUntil: newExpiry,
        extendedAt: new Date()
      }
    });
  }

  // Equality and Comparison
  public equals(other: UserRole): boolean {
    if (!other || !(other instanceof UserRole)) {
      return false;
    }
    return this.props.id === other.props.id &&
           this.props.userId === other.props.userId &&
           this.props.organizationId === other.props.organizationId &&
           this.props.departmentId === other.props.departmentId &&
           this.props.roleName.equals(other.props.roleName) &&
           this.props.assignedBy === other.props.assignedBy &&
           this.props.assignedAt.getTime() === other.props.assignedAt.getTime() &&
           this.props.isActive === other.props.isActive &&
           this.props.validUntil?.getTime() === other.props.validUntil?.getTime();
  }

  public getHashCode(): string {
    // Generate hash based on content, not id
    const content = `${this.props.userId}-${this.props.organizationId}-${this.props.departmentId || ''}-${this.props.roleName.getValue()}-${this.props.assignedBy}-${this.props.assignedAt.getTime()}-${this.props.isActive}-${this.props.validUntil?.getTime() || ''}`;
    return Buffer.from(content).toString('base64');
  }

  // Serialization
  public toPlainObject(): any {
    return {
      id: this.props.id,
      userId: this.props.userId,
      organizationId: this.props.organizationId,
      departmentId: this.props.departmentId,
      roleName: this.props.roleName.getValue(),
      assignedBy: this.props.assignedBy,
      assignedAt: this.props.assignedAt,
      isActive: this.props.isActive,
      validUntil: this.props.validUntil
    };
  }

  // Domain Events (simplified implementation)
  private events: any[] = [];

  public getUncommittedEvents(): any[] {
    return [...this.events];
  }

  public markEventsAsCommitted(): void {
    this.events = [];
  }

  private addEvent(event: any): void {
    this.events.push(event);
  }

  private getAdminPermissions(): PermissionName[] {
    return [
      PermissionName.organizationManagement(),
      PermissionName.userManagement(),
      PermissionName.departmentManagement(),
      PermissionName.roleAssignment(),
      PermissionName.userCreate(),
      PermissionName.userRead(),
      PermissionName.userUpdate(),
      PermissionName.customerCreate(),
      PermissionName.customerRead(),
      PermissionName.customerUpdate(),
      PermissionName.customerDelete(),
      PermissionName.dealCreate(),
      PermissionName.dealRead(),
      PermissionName.dealUpdate(),
      PermissionName.dealDelete(),
      PermissionName.aiConfigure(),
      PermissionName.aiChat(),
      PermissionName.analyticsRead(),
      PermissionName.analyticsManage(),
    ];
  }

  private getManagerPermissions(): PermissionName[] {
    return [
      PermissionName.customerCreate(),
      PermissionName.customerRead(),
      PermissionName.customerUpdate(),
      PermissionName.dealCreate(),
      PermissionName.dealRead(),
      PermissionName.dealUpdate(),
      PermissionName.aiChat(),
      PermissionName.analyticsRead(),
    ];
  }

  private getEmployeePermissions(): PermissionName[] {
    return [
      PermissionName.customerRead(),
      PermissionName.customerUpdate(),
      PermissionName.dealRead(),
      PermissionName.dealUpdate(),
      PermissionName.aiChat(),
    ];
  }


  public toJSON(): UserRoleDomainProps {
    return { ...this.props };
  }
}