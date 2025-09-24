import { Query } from '../../../../../../shared/application/interfaces/query-handler.interface';

export class FindCustomersQuery implements Query {
  public readonly queryId?: string;
  public readonly timestamp?: Date;

  constructor(
    public readonly organizationId: string,
    public readonly search?: string,
    public readonly status?: string[],
    public readonly assignedTo?: string,
    public readonly tags?: string[],
    public readonly page?: number,
    public readonly limit?: number,
    public readonly sortBy?: string,
    public readonly sortOrder?: 'ASC' | 'DESC',
    public readonly createdAfter?: Date,
    public readonly createdBefore?: Date,
    public readonly leadScoreMin?: number,
    public readonly leadScoreMax?: number,
    public readonly potentialValueMin?: number,
    public readonly overdueOnly?: boolean
  ) {
    this.timestamp = new Date();
  }
}