import { EJSON } from 'bson';
import base64url from 'base64-url';

// BSON can't encode undefined values, so we will use this value instead:
const BSON_UNDEFINED = '__bson-undefined__';

/**
 * These will take a paging handle (`next` or `previous`) and encode/decode it
 * as a string which can be passed in a URL.
 */

export function encode(obj: any, placeholder = BSON_UNDEFINED) {
  if (Array.isArray(obj) && obj[0] === undefined) obj[0] = placeholder;
  return base64url.encode(EJSON.stringify(obj));
}

export function decode(str: string, placeholder = BSON_UNDEFINED): any {
  const parsed = EJSON.parse(base64url.decode(str));
  if (Array.isArray(parsed) && parsed[0] === placeholder) parsed[0] = undefined;
  return parsed;
}
