// Get User Permissions Query - CQRS Pattern

export class GetUserPermissionsQuery {
  constructor(
    public readonly userId: string,
    public readonly organizationId: string
  ) {}
}