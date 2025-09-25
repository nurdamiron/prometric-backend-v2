import { ValueObject } from '../../../../../shared/domain/base/value-object';

interface UserRoleProps {
  value: string;
}

export class UserRole extends ValueObject<UserRoleProps> {
  private static readonly VALID_ROLES = ['owner', 'admin', 'manager', 'employee'] as const;

  private constructor(props: UserRoleProps) {
    super(props);
  }

  static create(role: string): UserRole {
    if (!role || typeof role !== 'string') {
      throw new Error('Role is required');
    }

    const normalizedRole = role.toLowerCase().trim();

    if (!this.VALID_ROLES.includes(normalizedRole as any)) {
      throw new Error(`Invalid role. Must be one of: ${this.VALID_ROLES.join(', ')}`);
    }

    return new UserRole({ value: normalizedRole });
  }

  get value(): string {
    return this.props.value;
  }

  // 🔐 RBAC Business Rules
  canManageOrganization(): boolean {
    return this.props.value === 'owner';
  }

  canManageEmployees(): boolean {
    return ['owner', 'admin'].includes(this.props.value);
  }

  canViewReports(): boolean {
    return ['owner', 'admin', 'manager'].includes(this.props.value);
  }

  canEditCustomers(): boolean {
    return ['owner', 'admin', 'manager', 'employee'].includes(this.props.value);
  }

  canViewCustomers(): boolean {
    return true; // All roles can view customers
  }

  canConfigureAI(): boolean {
    return ['owner', 'admin'].includes(this.props.value);
  }

  canApproveDeals(): boolean {
    return ['owner', 'admin', 'manager'].includes(this.props.value);
  }

  getPermissionLevel(): number {
    const levels: { [key: string]: number } = {
      'owner': 100,
      'admin': 80,
      'manager': 60,
      'employee': 40
    };
    return levels[this.props.value] || 0;
  }

  hasHigherPermissionThan(otherRole: UserRole): boolean {
    return this.getPermissionLevel() > otherRole.getPermissionLevel();
  }

  equals(other: UserRole): boolean {
    return this.props.value === other.props.value;
  }
}