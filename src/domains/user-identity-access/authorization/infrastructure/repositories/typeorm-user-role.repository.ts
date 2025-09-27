// TypeORM User Role Repository Implementation - Infrastructure Layer
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleRepository } from '../../domain/repositories/user-role.repository';
import { UserRole } from '../../domain/entities/user-role.entity';
import { RoleName } from '../../domain/value-objects/role-name.vo';
import { UserRoleEntity } from '../persistence/user-role.entity';

@Injectable()
export class TypeOrmUserRoleRepository implements UserRoleRepository {
  constructor(
    @InjectRepository(UserRoleEntity)
    private readonly repository: Repository<UserRoleEntity>
  ) {}

  async save(userRole: UserRole): Promise<void> {
    const entity = this.toEntity(userRole);
    await this.repository.save(entity);
  }

  async findById(id: string): Promise<UserRole | null> {
    const entity = await this.repository.findOne({
      where: { id }
    });

    return entity ? this.toDomain(entity) : null;
  }

  async findByUserId(userId: string): Promise<UserRole[]> {
    const entities = await this.repository.find({
      where: { userId }
    });

    return entities.map(entity => this.toDomain(entity));
  }

  async findActiveByUserIdAndOrganizationId(
    userId: string,
    organizationId: string
  ): Promise<UserRole[]> {
    const entities = await this.repository.find({
      where: {
        userId,
        organizationId,
        isActive: true
      }
    });

    return entities
      .map(entity => this.toDomain(entity))
      .filter(userRole => userRole.isActive());
  }

  async findByRoleNameAndOrganizationId(
    roleName: RoleName,
    organizationId: string
  ): Promise<UserRole[]> {
    const entities = await this.repository.find({
      where: {
        organizationId,
        roleName: roleName.getValue()
      }
    });

    return entities.map(entity => this.toDomain(entity));
  }

  async existsByUserIdAndOrganizationIdAndRoleName(
    userId: string,
    organizationId: string,
    roleName: RoleName
  ): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        userId,
        organizationId,
        roleName: roleName.getValue(),
        isActive: true
      }
    });

    return count > 0;
  }

  async deactivateAllByUserIdAndOrganizationId(
    userId: string,
    organizationId: string
  ): Promise<void> {
    await this.repository.update(
      {
        userId,
        organizationId
      },
      {
        isActive: false,
        updatedAt: new Date()
      }
    );
  }

  async remove(userRole: UserRole): Promise<void> {
    await this.repository.delete(userRole.getId());
  }

  async findExpiringRoles(days: number): Promise<UserRole[]> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);

    const entities = await this.repository
      .createQueryBuilder('userRole')
      .where('userRole.validUntil IS NOT NULL')
      .andWhere('userRole.validUntil <= :expirationDate', { expirationDate })
      .andWhere('userRole.isActive = true')
      .getMany();

    return entities.map(entity => this.toDomain(entity));
  }

  async countByRoleNameAndOrganizationId(
    roleName: RoleName,
    organizationId: string
  ): Promise<number> {
    return await this.repository.count({
      where: {
        organizationId,
        roleName: roleName.getValue(),
        isActive: true
      }
    });
  }

  // Mapping methods
  private toDomain(entity: UserRoleEntity): UserRole {
    return UserRole.reconstitute({
      id: entity.id,
      userId: entity.userId,
      organizationId: entity.organizationId,
      departmentId: entity.departmentId || undefined,
      roleName: RoleName.create(entity.roleName),
      assignedBy: entity.assignedBy,
      assignedAt: entity.assignedAt,
      isActive: entity.isActive,
      validUntil: entity.validUntil || undefined
    });
  }

  private toEntity(userRole: UserRole): Partial<UserRoleEntity> {
    return {
      id: userRole.getId(),
      userId: userRole.getUserId(),
      organizationId: userRole.getOrganizationId(),
      departmentId: userRole.getDepartmentId() || null,
      roleName: userRole.getRoleName().getValue(),
      assignedBy: userRole.getAssignedBy(),
      assignedAt: userRole.getAssignedAt(),
      isActive: userRole.isActive(),
      validUntil: userRole.getValidUntil() || undefined
    };
  }
}