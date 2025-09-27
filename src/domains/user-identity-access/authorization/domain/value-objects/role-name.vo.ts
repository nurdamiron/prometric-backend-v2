// Value Object for Role Name - DDD Pattern

export type RoleNameType = 'owner' | 'admin' | 'manager' | 'employee';

export class RoleName {
  private constructor(private readonly value: RoleNameType) {}

  public static create(value: string): RoleName {
    if (!this.isValid(value)) {
      throw new Error(`Invalid role name: ${value}. Must be one of: owner, admin, manager, employee`);
    }
    return new RoleName(value as RoleNameType);
  }

  public static owner(): RoleName {
    return new RoleName('owner');
  }

  public static admin(): RoleName {
    return new RoleName('admin');
  }

  public static manager(): RoleName {
    return new RoleName('manager');
  }

  public static employee(): RoleName {
    return new RoleName('employee');
  }

  public getValue(): RoleNameType {
    return this.value;
  }

  public isOwner(): boolean {
    return this.value === 'owner';
  }

  public isAdmin(): boolean {
    return this.value === 'admin';
  }

  public isManager(): boolean {
    return this.value === 'manager';
  }

  public isEmployee(): boolean {
    return this.value === 'employee';
  }

  public canManageUsers(): boolean {
    return this.isOwner() || this.isAdmin();
  }

  public canDeleteCustomers(): boolean {
    return this.isOwner() || this.isAdmin();
  }

  public hasFullAccess(): boolean {
    return this.isOwner();
  }

  public canAdministrateSystem(): boolean {
    return this.isOwner();
  }

  public canManageDepartment(): boolean {
    return this.isOwner() || this.isAdmin() || this.isManager();
  }

  public getHierarchyLevel(): number {
    switch (this.value) {
      case 'owner': return 1;
      case 'admin': return 2;
      case 'manager': return 3;
      case 'employee': return 4;
      default: return 99;
    }
  }

  public isHigherThan(other: RoleName): boolean {
    return this.getHierarchyLevel() < other.getHierarchyLevel();
  }

  public getDisplayName(): string {
    return this.value.charAt(0).toUpperCase() + this.value.slice(1);
  }

  public equals(other: RoleName): boolean {
    if (!other || !(other instanceof RoleName)) {
      return false;
    }
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    const validRoles: RoleNameType[] = ['owner', 'admin', 'manager', 'employee'];
    return validRoles.includes(value as RoleNameType);
  }
}