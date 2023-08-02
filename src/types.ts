import type { ObjectId } from 'bson';
import { Document, Model } from 'mongoose';

export type Paginated<T> = T & { _id: ObjectId };

export type SearchDocument<T> = T & { _id: ObjectId; score: number };

export interface PaginationFields {
  previous?: string | Record<string, any>;
  next?: string | Record<string, any>;
  sortCaseInsensitive?: boolean;
  query?: Record<string, any>;
  paginatedField?: string;
  fields?: Record<string, any>;
}

export interface PaginationQuery extends PaginationFields {
  limit: string;
}

export interface PaginationParams extends PaginationFields {
  limit: number;
  next?: string;
}

export interface PreparePaginateResult<T> {
  hasPrevious: boolean;
  previous?: T;
  hasNext: boolean;
  next?: T;
  results: T[];
}

export interface PaginateResult<T> {
  hasPrevious?: boolean;
  previous?: string;
  hasNext?: boolean;
  next?: string;
  results: T[];
}

export interface PluginOptions {
  name: string;
  searchFnName: string;
}

export interface PaginateModel<T extends Document> extends Model<T> {
  paginate(params?: PaginationParams): Promise<PaginateResult<T>>;
  search(str: string, params?: PaginationParams): Promise<PaginateResult<T>>;
}

export type DynPaginateModel<T extends Document> = PaginateModel<T> & {
  [K in string]: (
    str?: string,
    params?: PaginationParams,
  ) => Promise<PaginateResult<T>>;
};
