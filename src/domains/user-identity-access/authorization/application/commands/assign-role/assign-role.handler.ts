// Assign Role Command Handler - CQRS Pattern
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AssignRoleCommand } from './assign-role.command';
import type { UserRoleRepository } from '../../../domain/repositories/user-role.repository';
import { AuthorizationDomainService } from '../../../domain/services/authorization-domain.service';
import { UserRole } from '../../../domain/entities/user-role.entity';
import { RoleName } from '../../../domain/value-objects/role-name.vo';
import { RoleAssignedEvent } from '../../../domain/permission.domain';

@CommandHandler(AssignRoleCommand)
export class AssignRoleHandler implements ICommandHandler<AssignRoleCommand> {
  constructor(
    @Inject('UserRoleRepository')
    private readonly userRoleRepository: UserRoleRepository,
    private readonly authorizationDomainService: AuthorizationDomainService,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: AssignRoleCommand): Promise<void> {
    const { userId, organizationId, roleName, assignedBy, validUntil } = command;

    // Валидация входных данных
    const roleNameVo = RoleName.create(roleName);

    // Проверяем права назначающего пользователя
    const assignerRoles = await this.userRoleRepository.findActiveByUserIdAndOrganizationId(
      assignedBy,
      organizationId
    );

    const canAssign = this.authorizationDomainService.canAssignRole(
      assignerRoles,
      roleNameVo,
      organizationId
    );

    if (!canAssign) {
      throw new Error(`User ${assignedBy} cannot assign role ${roleName}`);
    }

    // Проверяем не назначена ли уже такая роль
    const existingRole = await this.userRoleRepository.existsByUserIdAndOrganizationIdAndRoleName(
      userId,
      organizationId,
      roleNameVo
    );

    if (existingRole) {
      throw new Error(`User ${userId} already has role ${roleName} in organization ${organizationId}`);
    }

    // Для роли owner может быть только один в организации
    if (roleNameVo.isOwner()) {
      const existingOwnerCount = await this.userRoleRepository.countByRoleNameAndOrganizationId(
        roleNameVo,
        organizationId
      );

      if (existingOwnerCount > 0) {
        throw new Error(`Organization ${organizationId} already has an owner`);
      }
    }

    // Создаем новую роль
    const userRole = UserRole.create({
      id: crypto.randomUUID(),
      userId,
      organizationId,
      roleName: roleNameVo,
      assignedBy,
      validUntil,
      isActive: true
    });

    // Сохраняем в репозиторий
    await this.userRoleRepository.save(userRole);

    // Публикуем domain event
    const roleAssignedEvent = new RoleAssignedEvent(
      userId,
      {
        id: userRole.getId(),
        name: roleNameVo.getValue(),
        displayName: roleNameVo.getValue().charAt(0).toUpperCase() + roleNameVo.getValue().slice(1),
        description: `${roleNameVo.getValue()} role`,
        permissions: [],
        isSystemRole: true,
        level: this.getRoleLevel(roleNameVo),
        createdAt: userRole.getAssignedAt(),
        updatedAt: userRole.getAssignedAt()
      },
      assignedBy,
      organizationId
    );

    this.eventBus.publish(roleAssignedEvent);
  }

  private getRoleLevel(roleName: RoleName): number {
    if (roleName.isOwner()) return 1;
    if (roleName.isAdmin()) return 2;
    if (roleName.isManager()) return 3;
    return 4; // employee
  }
}