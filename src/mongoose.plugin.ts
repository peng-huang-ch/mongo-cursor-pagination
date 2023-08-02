import _ from 'underscore';
import { find } from './find';
import { search } from './search';
import { Schema } from 'mongoose';
import { PaginateResult, PaginationParams, PluginOptions } from './types';

/**
 * Mongoose plugin
 * @param {Object} schema mongoose schema.
 * @param {Object} options
 * @param {string} options.name name of the function.
 * @param {string} options.searchFnName name of the function.
 */
export function mongoosePlugin(schema: Schema, options: PluginOptions) {
  const paginateFnName: string = (options && options.name) || 'paginate';
  schema.static(paginateFnName, async function (params: object): Promise<
    PaginateResult<any>
  > {
    if (!this.collection) {
      throw new Error('collection property not found');
    }
    return find(this.collection, Object.assign({}, params));
  });

  const searchFnName: string = (options && options.searchFnName) || 'search';
  schema.static(
    searchFnName,
    async function (
      searchString: string,
      params: Partial<PaginationParams>,
    ): Promise<PaginateResult<any>> {
      if (!this.collection) {
        throw new Error('collection property not found');
      }
      return search(this.collection, searchString, Object.assign({}, params));
    },
  );
  return schema;
}
