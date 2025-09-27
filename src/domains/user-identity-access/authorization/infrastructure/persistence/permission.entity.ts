import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToMany, ManyToOne, JoinColumn } from 'typeorm';
import { PermissionAction, ConditionOperator } from '../../domain/permission.domain';

@Entity('permissions')
@Index(['resource', 'action'])
@Index(['organizationId'])
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ length: 100 })
  resource: string;

  @Column({
    type: 'enum',
    enum: PermissionAction
  })
  action: PermissionAction;

  @Column({ type: 'jsonb', nullable: true })
  conditions?: Array<{
    field: string;
    operator: ConditionOperator;
    value: any;
    description?: string;
  }>;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId?: string;

  @Column({ name: 'is_system_permission', default: true })
  isSystemPermission: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('roles')
@Index(['organizationId'])
@Index(['level'])
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ name: 'display_name', length: 100 })
  displayName: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId?: string;

  @Column({ name: 'is_system_role', default: true })
  isSystemRole: boolean;

  @Column({
    type: 'enum',
    enum: [0, 1, 2, 3, 4], // RoleLevel enum values
    default: 4
  })
  level: number;

  @ManyToMany(() => PermissionEntity)
  permissions: PermissionEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


@Entity('user_permissions')
@Index(['userId', 'organizationId'])
@Index(['permissionId'])
export class UserPermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'permission_id' })
  permissionId: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'granted_by' })
  grantedBy: string;

  @Column({ name: 'granted_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  grantedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  conditions?: Array<{
    field: string;
    operator: ConditionOperator;
    value: any;
  }>;

  @ManyToOne(() => PermissionEntity)
  @JoinColumn({ name: 'permission_id' })
  permission: PermissionEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}