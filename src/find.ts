import _ from 'underscore';
import { sanitizeParams } from './utils/sanitizeParams';
import {
  prepareResponse,
  generateSort,
  generateCursorQuery,
} from './utils/query';
import { aggregate } from './aggregate';

import type { Collection, FindOptions } from 'mongodb';
import type { PaginateResult, Paginated, PaginationParams } from './types';

/**
 * Performs a find() query on a passed-in Mongo collection, using criteria you specify. The results
 * are ordered by the paginatedField.
 *
 * @param {MongoCollection} collection A collection object returned from the MongoDB library's
 * @param {Object} params
 *    -query {Object} The find query.
 *    -limit {Number} The page size. Must be between 1 and `config.MAX_LIMIT`.
 *    -fields {Object} Fields to query in the Mongo object format, e.g. {_id: 1, timestamp :1}.
 *      The default is to query all fields.
 *    -paginatedField {String} The field name to query the range for. The field must be:
 *        1. Orderable. We must sort by this value. If duplicate values for paginatedField field
 *          exist, the results will be secondarily ordered by the _id.
 *        2. Indexed. For large collections, this should be indexed for query performance.
 *        3. Immutable. If the value changes between paged queries, it could appear twice.
          4. Consistent. All values (except undefined and null values) must be of the same type.
 *      The default is to use the Mongo built-in '_id' field, which satisfies the above criteria.
 *      The only reason to NOT use the Mongo _id field is if you chose to implement your own ids.
 *    -sortAscending {boolean} Whether to sort in ascending order by the `paginatedField`.
 *    -sortCaseInsensitive {boolean} Whether to ignore case when sorting, in which case `paginatedField`
 *      must be a string property.
 *    -next {String} The value to start querying the page.
 *    -previous {String} The value to start querying previous page.
 *    -after {String} The _id to start querying the page.
 *    -before {String} The _id to start querying previous page.
 *    -hint {String} An optional index hint to provide to the mongo query
 *    -collation {Object} An optional collation to provide to the mongo query. E.g. { locale: 'en', strength: 2 }. When null, disables the global collation.
 */
export async function find<T>(
  collection: Collection,
  params: PaginationParams,
) {
  const removePaginatedFieldInResponse =
    params.fields && !params.fields[params.paginatedField || '_id'];

  let response: PaginateResult<T>;
  if (params.sortCaseInsensitive) {
    // For case-insensitive sorting, we need to work with an aggregation:
    response = await aggregate(
      collection,
      Object.assign({}, params, {
        aggregation: params.query ? [{ $match: params.query }] : [],
      }),
    );
  } else {
    // Need to repeat `params.paginatedField` default value ('_id') since it's set in 'sanitizeParams()'
    params = _.defaults(await sanitizeParams(collection, params), {
      query: {},
    });

    const cursorQuery = generateCursorQuery(params);
    const $sort = generateSort(params);

    // Support the native 'mongodb' driver.
    const options: FindOptions = {
      limit: params.limit! + 1, // Query one more element to see if there's another page.
      sort: $sort,
    };
    if (!_.isEmpty(params.fields)) options.projection = params.fields;
    if (!_.isEmpty(params.hint)) options.hint = params.fields;

    /**
     * IMPORTANT
     *
     * If using collation, check the README:
     * https://github.com/mixmaxhq/mongo-cursor-pagination#important-note-regarding-collation
     */
    if (params.collation) options.collation = params.collation;
    const query = collection.find(
      { $and: [cursorQuery, params.query ?? {}] },
      options,
    );

    const results = (await query.toArray()) as Paginated<T>[];
    response = prepareResponse(results, params);
  }

  // Remove fields that we added to the query (such as paginatedField and _id) that the user didn't ask for.
  if (removePaginatedFieldInResponse) {
    response.results = response.results?.map((result) =>
      _.omit(result, params.paginatedField!),
    ) as T[];
  }

  return response;
}
