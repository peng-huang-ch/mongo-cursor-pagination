import type { ParsedQs } from 'qs';
import type { Collection } from 'mongodb';
import type { PaginationParams, PaginationQuery } from './types';
import { find } from './find';
import { sanitizeQuery } from './utils/sanitizeQuery';

/**
 * A wrapper around `find()` that make it easy to implement a basic HTTP API using Express. So your
 * user can call "/list?limit=1&fields=_id,name" and the querystring parameters will be passed
 * to this method on the Express request object.
 *
 * @param {ExpressRequest} req An express request object with the following on the querystring:
 *    -limit: If a numeric string, passed to `find()` as the limit. If limit also passed in params
 *      then this value cannot exceed it.
 *    -next: If a non-empty string, passed to `find()` as the next cursor.
 *    -previous: If a non-empty string, passed to `find()` as the previous cursor.
 *    -fields: If a non-empty string, used to limit fields that are returned. Multiple fields
 *      can be specified as a comma-delimited list. If field name used is not in params.fields,
 *      it will be ignored.
 * @param {MongoCollection} collection A collection object returned from the MongoDB library's
 *    or the mongoist package's `db.collection(<collectionName>)` method.
 * @param {Object} params See documentation for `find()`, plus these options:
 *    -overrideFields: an object containing fields that should override fields from the querystring, e.g.
 *      {_id: 0} or {internalField: 1}. We only support field exclusion for _id, as we expect whitelists
 *      for fields from both params.fields and params.overrideFields.
 */
export async function findWithReq<T>(
  req: { query: ParsedQs },
  collection: Collection,
  params: Partial<PaginationParams>,
) {
  const sanitized = sanitizeQuery(
    req.query as unknown as PaginationQuery,
    params,
  );

  return find<T>(collection, sanitized);
}
