// Get System Health Query - CQRS Pattern

export class GetSystemHealthQuery {
  constructor(
    public readonly includeDetails: boolean = true
  ) {}
}