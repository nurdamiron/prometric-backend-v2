// Assign Role Command - CQRS Pattern
import { RoleNameType } from '../../../domain/value-objects/role-name.vo';

export class AssignRoleCommand {
  constructor(
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly roleName: RoleNameType,
    public readonly assignedBy: string,
    public readonly validUntil?: Date
  ) {}
}