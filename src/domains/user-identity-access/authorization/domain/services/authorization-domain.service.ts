// Authorization Domain Service - DDD Pattern
import { Injectable } from '@nestjs/common';
import { UserRole } from '../entities/user-role.entity';
import { RoleName } from '../value-objects/role-name.vo';
import { PermissionName } from '../value-objects/permission-name.vo';

export interface AuthorizationContext {
  resource?: any;
  organizationId: string;
  departmentId?: string;
  targetUserId?: string;
  targetRole?: RoleName;
}

@Injectable()
export class AuthorizationDomainService {

  /**
   * Проверяет есть ли у пользователя разрешение с учетом контекста
   */
  public hasPermission(
    userRoles: UserRole[],
    permission: PermissionName,
    contextOrOrgId: AuthorizationContext | string
  ): boolean {
    const context: AuthorizationContext = typeof contextOrOrgId === 'string'
      ? { organizationId: contextOrOrgId }
      : contextOrOrgId;
    // Получаем активные роли пользователя в данной организации
    const activeRoles = this.getActiveRolesInOrganization(userRoles, context.organizationId);

    if (activeRoles.length === 0) {
      return false;
    }

    // Проверяем базовое разрешение
    const hasBasePermission = activeRoles.some(role => role.hasPermission(permission));
    if (!hasBasePermission) {
      return false;
    }

    // Дополнительные контекстные проверки
    return this.evaluateContextualPermissions(activeRoles, permission, context);
  }

  /**
   * Проверяет может ли пользователь управлять другим пользователем
   */
  public canManageUser(
    userRoles: UserRole[],
    context: AuthorizationContext
  ): boolean {
    if (!context.targetUserId || !context.targetRole) {
      return false;
    }

    const activeRoles = this.getActiveRolesInOrganization(userRoles, context.organizationId);

    return activeRoles.some(role =>
      role.canManageUser(context.targetUserId!, context.targetRole!)
    );
  }


  /**
   * Проверяет может ли роль быть назначена пользователем
   */
  public canAssignRole(
    assignerRoles: UserRole[],
    targetRole: RoleName,
    organizationId: string
  ): boolean {
    const activeRoles = this.getActiveRolesInOrganization(assignerRoles, organizationId);

    // Только owner может назначать роль owner
    if (targetRole.isOwner()) {
      return activeRoles.some(role => role.getRoleName().isOwner());
    }

    // Owner и admin могут назначать роли admin, manager, employee
    if (targetRole.isAdmin() || targetRole.isManager() || targetRole.isEmployee()) {
      return activeRoles.some(role =>
        role.getRoleName().isOwner() || role.getRoleName().isAdmin()
      );
    }

    return false;
  }

  /**
   * Валидирует доступ пользователя к организации
   */
  public validateOrganizationAccess(
    userRoles: UserRole[],
    organizationId: string
  ): void {
    if (!userRoles || userRoles.length === 0) {
      throw new Error('User has no active roles');
    }

    const activeRoles = this.getActiveRolesInOrganization(userRoles, organizationId);

    if (activeRoles.length === 0) {
      throw new Error(`User does not have access to organization ${organizationId}`);
    }
  }

  /**
   * Проверяет доступ к ресурсу с учетом department isolation
   */
  public canAccessResource(
    userRoles: UserRole[],
    resource: any,
    permission: PermissionName,
    organizationId: string,
    departmentId: string | undefined,
    userId: string
  ): boolean {
    // Базовая проверка разрешения
    const hasPermission = this.hasPermission(userRoles, permission, {
      resource,
      organizationId,
      departmentId
    });

    if (!hasPermission) {
      return false;
    }

    // Проверка изоляции данных организации
    if (resource?.organizationId && resource.organizationId !== organizationId) {
      return false;
    }

    // Проверка изоляции данных департамента
    if (departmentId && resource?.departmentId && resource.departmentId !== departmentId) {
      // Проверяем может ли пользователь видеть данные другого департамента
      const canAccessDepartment = userRoles.some(role =>
        role.canAccessDepartmentData(organizationId, resource.departmentId)
      );

      if (!canAccessDepartment) {
        return false;
      }
    }

    // Дополнительные проверки ownership для sensitive operations
    if (permission.toString().includes('delete') || permission.toString().includes('manage')) {
      return this.canPerformSensitiveOperation(userRoles, resource, organizationId, userId);
    }

    return true;
  }

  // Private helper methods

  private getActiveRolesInOrganization(
    userRoles: UserRole[],
    organizationId: string
  ): UserRole[] {
    if (!userRoles) {
      return [];
    }
    return userRoles.filter(role =>
      role.isActive() && role.canAccessOrganizationData(organizationId)
    );
  }

  private evaluateContextualPermissions(
    activeRoles: UserRole[],
    permission: PermissionName,
    context: AuthorizationContext
  ): boolean {
    // Для AI permissions требуется дополнительная проверка
    if (permission.isAiPermission() && permission.toString().includes('configure')) {
      return activeRoles.some(role =>
        role.getRoleName().isOwner() || role.getRoleName().isAdmin()
      );
    }

    // Для organization management только owner
    if (permission.isOrganizationPermission()) {
      return activeRoles.some(role => role.getRoleName().isOwner());
    }

    // Для analytics management - owner и admin
    if (permission.toString() === 'analytics:manage') {
      return activeRoles.some(role =>
        role.getRoleName().isOwner() || role.getRoleName().isAdmin()
      );
    }

    return true;
  }

  private getRolePermissions(roleName: RoleName): PermissionName[] {
    if (roleName.isOwner()) {
      return this.getAllPermissions();
    }

    if (roleName.isAdmin()) {
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

    if (roleName.isManager()) {
      return [
        PermissionName.departmentManagement(),
        PermissionName.teamManagement(),
        PermissionName.dataDepartmentAccess(),
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

    if (roleName.isEmployee()) {
      return [
        PermissionName.profileManagement(),
        PermissionName.dataOwnAccess(),
        PermissionName.customerRead(),
        PermissionName.customerUpdate(),
        PermissionName.dealRead(),
        PermissionName.dealUpdate(),
        PermissionName.aiChat(),
      ];
    }

    return [];
  }

  private getAllPermissions(): PermissionName[] {
    return [
      // High-level permissions for owner
      PermissionName.systemAdministration(),
      PermissionName.organizationManagement(),
      PermissionName.userManagement(),
      PermissionName.departmentManagement(),
      PermissionName.roleAssignment(),
      PermissionName.dataAllAccess(),
      // User management
      PermissionName.userCreate(),
      PermissionName.userRead(),
      PermissionName.userUpdate(),
      PermissionName.userDelete(),
      // Customer management
      PermissionName.customerCreate(),
      PermissionName.customerRead(),
      PermissionName.customerUpdate(),
      PermissionName.customerDelete(),
      // Deal management
      PermissionName.dealCreate(),
      PermissionName.dealRead(),
      PermissionName.dealUpdate(),
      PermissionName.dealDelete(),
      // AI permissions
      PermissionName.aiConfigure(),
      PermissionName.aiChat(),
      PermissionName.aiKnowledgeManage(),
      // Analytics
      PermissionName.analyticsRead(),
      PermissionName.analyticsManage(),
      // Organization
      PermissionName.organizationManage(),
    ];
  }

  private canPerformSensitiveOperation(
    userRoles: UserRole[],
    resource: any,
    organizationId: string,
    userId: string
  ): boolean {
    const activeRoles = this.getActiveRolesInOrganization(userRoles, organizationId);

    // Owner может все
    if (activeRoles.some(role => role.getRoleName().isOwner())) {
      return true;
    }

    // Создатель ресурса может его удалять (в зависимости от роли)
    if (resource?.createdBy === userId || resource?.ownerId === userId) {
      return activeRoles.some(role =>
        role.getRoleName().isAdmin() || role.getRoleName().isManager()
      );
    }

    // Admin может удалять ресурсы не созданные owner'ом
    if (activeRoles.some(role => role.getRoleName().isAdmin())) {
      return resource?.createdBy !== this.findOwnerUserId(organizationId);
    }

    return false;
  }

  /**
   * Получает роль с наивысшим приоритетом из списка ролей
   */
  public getHighestRole(userRoles: UserRole[]): RoleName | null {
    if (!userRoles || userRoles.length === 0) {
      return null;
    }

    // Сортируем роли по иерархии (owner > admin > manager > employee)
    const sortedRoles = userRoles.sort((a, b) =>
      a.getRoleName().getHierarchyLevel() - b.getRoleName().getHierarchyLevel()
    );

    return sortedRoles[0]?.getRoleName() || null; // Первая роль имеет наивысший приоритет
  }

  /**
   * Проверяет может ли пользователь получить доступ к департаменту
   */
  public canAccessDepartment(
    userRoles: UserRole[],
    departmentId: string,
    organizationId: string
  ): boolean {
    if (!userRoles || userRoles.length === 0) {
      return false;
    }

    const activeRoles = this.getActiveRolesInOrganization(userRoles, organizationId);

    // Owner и Admin имеют доступ ко всем департаментам
    const hasOrgWideAccess = activeRoles.some(role =>
      role.getRoleName().isOwner() || role.getRoleName().isAdmin()
    );

    if (hasOrgWideAccess) {
      return true;
    }

    // Manager и Employee имеют доступ только к своему департаменту
    return activeRoles.some(role =>
      role.getDepartmentId() === departmentId
    );
  }

  /**
   * Исправляет обработку null/undefined для getUserPermissions
   */
  public getUserPermissions(
    userRoles: UserRole[],
    organizationId: string
  ): PermissionName[] {
    // Обработка null/undefined входных данных
    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    if (!organizationId) {
      return [];
    }

    const activeRoles = this.getActiveRolesInOrganization(userRoles, organizationId);
    const permissions = new Set<string>();

    for (const role of activeRoles) {
      const rolePermissions = this.getRolePermissions(role.getRoleName());
      rolePermissions.forEach(perm => permissions.add(perm.toString()));
    }

    return Array.from(permissions).map(perm => PermissionName.create(perm));
  }

  private findOwnerUserId(organizationId: string): string | null {
    // TODO: Implement finding owner user ID for organization
    // This would require organization repository
    return null;
  }
}