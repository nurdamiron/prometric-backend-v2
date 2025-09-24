export interface Repository<T, ID> {
  save(entity: T): Promise<void>;
  findById(id: ID): Promise<T | null>;
  delete(id: ID): Promise<void>;
}

export interface SearchableRepository<T, ID, SearchCriteria> extends Repository<T, ID> {
  search(criteria: SearchCriteria): Promise<SearchResult<T>>;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UnitOfWork {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}