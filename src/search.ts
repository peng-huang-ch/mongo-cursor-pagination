import _ from 'underscore';
import * as bsonUrlEncoding from './utils/bsonUrlEncoding';

import type { Collection } from 'mongodb';
import type { SearchDocument, PaginationParams, PaginateResult } from './types';
import { DEFAULT_LIMIT } from './constants';

/**
 * Performs a search query on a Mongo collection and pages the results. This is different from
 * find() in that the results are ordered by their relevancy, and as such, it does not take
 * a paginatedField parameter. Note that this is less performant than find() because it must
 * perform the full search on each call to this function.
 *
 * @param {MongoCollection} collection A collection object returned from the MongoDB library's
 *    or the mongoist package's `db.collection(<collectionName>)` method. This MUST have a Mongo
 *    $text index on it.
 *    See https://docs.mongodb.com/manual/core/index-text/.
 * @param {String} searchString String to search on.
 * @param {Object} params
 *    -query {Object} The find query.
 *    -limit {Number} The page size. Must be between 1 and `config.MAX_LIMIT`.
 *    -fields {Object} Fields to query in the Mongo object format, e.g. {title :1}.
 *      The default is to query ONLY _id (note this is a difference from `find()`).
 *    -next {String} The value to start querying the page. Defaults to start at the beginning of
 *      the results.
 */
export async function search<T>(
  collection: Collection,
  searchString: string,
  params: Partial<PaginationParams>,
): Promise<PaginateResult<T>> {
  if (_.isString(params.limit)) params.limit = parseInt(params.limit, 10);
  if (params.next) params.next = bsonUrlEncoding.decode(params.next);

  params = _.defaults(params, {
    query: {},
    limit: DEFAULT_LIMIT,
  });

  if (params.limit && params.limit < 1) params.limit = 1;

  // We must perform an aggregate query since Mongo can't query a range when using $text search.
  const aggregate: any[] = [
    {
      $match: _.extend({}, params.query, {
        $text: {
          $search: searchString,
        },
      }),
    },
    {
      $project: _.extend({}, params.fields, {
        _id: 1,
        score: {
          $meta: 'textScore',
        },
      }),
    },
    {
      $sort: {
        score: {
          $meta: 'textScore',
        },
        _id: -1,
      },
    },
  ];

  if (params.next) {
    aggregate.push({
      $match: {
        $or: [
          {
            score: {
              $lt: params.next[0],
            },
          },
          {
            score: {
              $eq: params.next[0],
            },
            _id: {
              $lt: params.next[1],
            },
          },
        ],
      },
    });
  }

  aggregate.push({
    $limit: params.limit,
  });

  let response: PaginateResult<T>;

  // Only support the native 'mongodb' driver. See:
  const results = await collection
    .aggregate<SearchDocument<T>>(aggregate)
    .toArray();

  const fullPageOfResults = results.length === params.limit;
  if (fullPageOfResults) {
    response = {
      results,
      next: bsonUrlEncoding.encode([
        _.last(results)?.score,
        _.last(results)?._id,
      ]),
    };
  } else {
    response = {
      results,
    };
  }
  return response;
}
