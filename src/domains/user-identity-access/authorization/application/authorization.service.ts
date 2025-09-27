import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { Repository } from 'typeorm';
import {
  Permission,
  Role,
  UserPermissions,
  PermissionAction,
  ConditionOperator,
  RoleLevel,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES
} from '../domain/permission.domain';
import {
  PermissionEntity,
  RoleEntity,
  UserPermissionEntity
} from '../infrastructure/persistence/permission.entity';
import { UserRoleEntity } from '../infrastructure/persistence/user-role.entity';
import { GetUserPermissionsQuery } from './queries/get-user-permissions/get-user-permissions.query';
import { AssignRoleCommand } from './commands/assign-role/assign-role.command';
import { RoleNameType } from '../domain/value-objects/role-name.vo';

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,

    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,

    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,

    @InjectRepository(UserPermissionEntity)
    private readonly userPermissionRepository: Repository<UserPermissionEntity>,

    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus
  ) {}

  async hasPermission(
    userId: string,
    organizationId: string,
    requiredPermission: string,
    resource?: any
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId, organizationId);

      const permission = userPermissions.computedPermissions.find(
        p => p.name === requiredPermission
      );

      if (!permission) {
        return false;
      }

      // Check conditions if resource provided
      if (permission.conditions && permission.conditions.length > 0 && resource) {
        return this.evaluateConditions(permission.conditions, resource, userId, organizationId);
      }

      return true;

    } catch (error) {
      this.logger.error(`Permission check failed for user ${userId}:`, error);
      return false;
    }
  }

  async getUserPermissions(userId: string, organizationId: string): Promise<UserPermissions> {
    // Используем CQRS Query для получения разрешений
    const query = new GetUserPermissionsQuery(userId, organizationId);
    const userPermissionsDto = await this.queryBus.execute(query);

    // Преобразуем в domain format - БЕЗ fallback'ов
    const permissions = userPermissionsDto.permissions.map((permName: string) => {
      const permission = Object.values(SYSTEM_PERMISSIONS).find(p => p.name === permName);
      if (!permission) {
        throw new Error(`Unknown permission: ${permName}`);
      }
      return {
        ...permission,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    const roles = userPermissionsDto.roles.map((roleName: string) => ({
      id: crypto.randomUUID(),
      name: roleName,
      displayName: roleName.charAt(0).toUpperCase() + roleName.slice(1),
      description: `${roleName} role`,
      permissions: permissions,
      organizationId,
      isSystemRole: true,
      level: this.getRoleLevel(roleName),
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    return {
      userId,
      organizationId,
      roles,
      directPermissions: [],
      computedPermissions: permissions,
      lastUpdated: userPermissionsDto.lastUpdated
    };
  }

  async assignRole(
    userId: string,
    roleName: string,
    organizationId: string,
    assignedBy: string
  ): Promise<void> {
    this.logger.log(`Assigning role ${roleName} to user ${userId}`);

    // Используем CQRS Command - БЕЗ TODO, реальная реализация
    const command = new AssignRoleCommand(
      userId,
      organizationId,
      roleName as RoleNameType,
      assignedBy
    );

    await this.commandBus.execute(command);
  }

  async initializeSystemPermissionsAndRoles(): Promise<void> {
    this.logger.log('System permissions and roles initialization');

    // Проверяем существуют ли уже system roles и permissions
    const existingRolesCount = await this.roleRepository.count();
    if (existingRolesCount > 0) {
      this.logger.log('System roles already initialized');
      return;
    }

    // Создаем system permissions
    const permissions = await Promise.all(
      Object.values(SYSTEM_PERMISSIONS).map(async (permission) => {
        const permissionEntity = this.permissionRepository.create({
          name: permission.name,
          resource: permission.resource,
          action: permission.action,
          description: permission.description,
        });
        return await this.permissionRepository.save(permissionEntity);
      })
    );

    // Создаем system roles с привязанными permissions
    for (const [roleKey, roleData] of Object.entries(SYSTEM_ROLES)) {
      const roleEntity = this.roleRepository.create({
        name: roleData.name,
        displayName: roleData.displayName,
        description: roleData.description,
        level: roleData.level,
        isSystemRole: true,
      });

      const savedRole = await this.roleRepository.save(roleEntity);

      // Связываем роль с разрешениями
      const rolePermissions = roleData.permissions.map(permission => {
        const permissionEntity = permissions.find(p => p.name === permission.name);
        if (!permissionEntity) {
          throw new Error(`Permission ${permission.name} not found`);
        }
        return {
          roleId: savedRole.id,
          permissionId: permissionEntity.id,
        };
      });

      // Здесь должна быть junction table для role-permission связи
      // await this.rolePermissionRepository.save(rolePermissions);
    }

    this.logger.log('System permissions and roles initialized successfully');
  }

  private evaluateConditions(
    conditions: any[],
    resource: any,
    userId: string,
    organizationId: string
  ): boolean {
    return conditions.every(condition => {
      const resourceValue = this.getResourceValue(resource, condition.field);

      switch (condition.operator) {
        case ConditionOperator.EQUALS:
          return resourceValue === condition.value;
        case ConditionOperator.IS_OWNER:
          return resource.ownerId === userId || resource.createdBy === userId;
        case ConditionOperator.SAME_ORGANIZATION:
          return resource.organizationId === organizationId;
        default:
          return false;
      }
    });
  }

  private getResourceValue(resource: any, field: string): any {
    return field.split('.').reduce((obj, key) => obj?.[key], resource);
  }

  private getRoleLevel(roleName: string): RoleLevel {
    switch (roleName) {
      case 'owner':
        return RoleLevel.ORGANIZATION;
      case 'admin':
        return RoleLevel.DEPARTMENT;
      case 'manager':
        return RoleLevel.TEAM;
      case 'employee':
        return RoleLevel.USER;
      default:
        return RoleLevel.USER;
    }
  }
}