// Get User Permissions Query Handler - CQRS Pattern
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUserPermissionsQuery } from './get-user-permissions.query';
import type { UserRoleRepository } from '../../../domain/repositories/user-role.repository';
import { AuthorizationDomainService } from '../../../domain/services/authorization-domain.service';
import { PermissionName } from '../../../domain/value-objects/permission-name.vo';

export interface UserPermissionsDto {
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  lastUpdated: Date;
}

@QueryHandler(GetUserPermissionsQuery)
export class GetUserPermissionsHandler implements IQueryHandler<GetUserPermissionsQuery, UserPermissionsDto> {
  constructor(
    @Inject('UserRoleRepository')
    private readonly userRoleRepository: UserRoleRepository,
    private readonly authorizationDomainService: AuthorizationDomainService
  ) {}

  async execute(query: GetUserPermissionsQuery): Promise<UserPermissionsDto> {
    const { userId, organizationId } = query;

    // Получаем активные роли пользователя в организации
    const userRoles = await this.userRoleRepository.findActiveByUserIdAndOrganizationId(
      userId,
      organizationId
    );

    // Получаем все разрешения пользователя через domain service
    const permissions = this.authorizationDomainService.getUserPermissions(
      userRoles,
      organizationId
    );

    // Собираем DTO
    const result: UserPermissionsDto = {
      userId,
      organizationId,
      roles: userRoles.map(role => role.getRoleName().getValue()),
      permissions: permissions.map(perm => perm.getValue()),
      lastUpdated: new Date()
    };

    return result;
  }
}