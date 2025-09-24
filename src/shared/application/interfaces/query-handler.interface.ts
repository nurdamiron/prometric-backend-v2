export interface Query {
  readonly queryId?: string;
  readonly timestamp?: Date;
}

export interface QueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    total?: number;
    page?: number;
    limit?: number;
    executionTime?: number;
    queryTime?: number;
    queryType?: string;
    timestamp?: Date;
  };
}

export interface QueryHandler<TQuery extends Query, TResult = any> {
  execute(query: TQuery): Promise<QueryResult<TResult>>;
}

export interface QueryBus {
  execute<TQuery extends Query, TResult = any>(
    query: TQuery
  ): Promise<QueryResult<TResult>>;

  register<TQuery extends Query, TResult = any>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void;
}