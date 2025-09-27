import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('user_roles')
@Index(['userId', 'organizationId'])
@Index(['userId', 'organizationId', 'departmentId'])
@Index(['departmentId'])
export class UserRoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @Column({ name: 'organization_id', type: 'varchar' })
  organizationId: string;

  @Column({ name: 'department_id', type: 'varchar', nullable: true })
  departmentId: string | null;

  @Column({ name: 'role_name', type: 'varchar', length: 20 })
  roleName: string;

  @Column({ name: 'assigned_by', type: 'varchar' })
  assignedBy: string;

  @Column({ name: 'assigned_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assignedAt: Date;

  @Column({ name: 'valid_until', type: 'timestamp', nullable: true })
  validUntil?: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}