// User Role Repository Interface - DDD Pattern
import { UserRole } from '../entities/user-role.entity';
import { RoleName } from '../value-objects/role-name.vo';

export interface UserRoleRepository {
  /**
   * Сохранить роль пользователя
   */
  save(userRole: UserRole): Promise<void>;

  /**
   * Найти роль по ID
   */
  findById(id: string): Promise<UserRole | null>;

  /**
   * Найти все роли пользователя
   */
  findByUserId(userId: string): Promise<UserRole[]>;

  /**
   * Найти активные роли пользователя в организации
   */
  findActiveByUserIdAndOrganizationId(
    userId: string,
    organizationId: string
  ): Promise<UserRole[]>;

  /**
   * Найти всех пользователей с определенной ролью в организации
   */
  findByRoleNameAndOrganizationId(
    roleName: RoleName,
    organizationId: string
  ): Promise<UserRole[]>;

  /**
   * Проверить существует ли роль у пользователя в организации
   */
  existsByUserIdAndOrganizationIdAndRoleName(
    userId: string,
    organizationId: string,
    roleName: RoleName
  ): Promise<boolean>;

  /**
   * Деактивировать все роли пользователя в организации
   */
  deactivateAllByUserIdAndOrganizationId(
    userId: string,
    organizationId: string
  ): Promise<void>;

  /**
   * Удалить роль
   */
  remove(userRole: UserRole): Promise<void>;

  /**
   * Найти роли истекающие в ближайшее время
   */
  findExpiringRoles(days: number): Promise<UserRole[]>;

  /**
   * Получить количество пользователей с ролью в организации
   */
  countByRoleNameAndOrganizationId(
    roleName: RoleName,
    organizationId: string
  ): Promise<number>;
}