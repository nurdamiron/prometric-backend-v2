import { Injectable } from '@nestjs/common';
import { Query, QueryBus, QueryHandler, QueryResult } from '../interfaces/query-handler.interface';

@Injectable()
export class InMemoryQueryBus implements QueryBus {
  private handlers = new Map<string, QueryHandler<any, any>>();

  async execute<TQuery extends Query, TResult = any>(
    query: TQuery
  ): Promise<QueryResult<TResult>> {
    const queryType = query.constructor.name;
    const handler = this.handlers.get(queryType);

    if (!handler) {
      return {
        success: false,
        error: `No handler registered for query: ${queryType}`
      };
    }

    try {
      const startTime = Date.now();
      const result = await handler.execute(query);
      const executionTime = Date.now() - startTime;

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime,
          queryType
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Query execution failed',
        metadata: {
          queryType,
          timestamp: new Date()
        }
      };
    }
  }

  register<TQuery extends Query, TResult = any>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void {
    if (this.handlers.has(queryType)) {
      throw new Error(`Handler for query ${queryType} is already registered`);
    }
    this.handlers.set(queryType, handler);
  }
}