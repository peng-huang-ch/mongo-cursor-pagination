import * as bsonUrlEncoding from '../../src/utils/bsonUrlEncoding';
import { encodePaginationTokens } from '../../src/utils/query';

describe('encodePaginationTokens', () => {
  it('encodes the pagination tokens on the passed-in response object', () => {
    const params = {
      paginatedField: '_id',
    };
    const prepare: any = {
      next: { _id: '789' },
      previous: { _id: '456' },
    };

    const response = encodePaginationTokens(params, prepare);

    expect(response.next).toEqual(bsonUrlEncoding.encode('789'));
    expect(response.previous).toEqual(bsonUrlEncoding.encode('456'));
  });

  it("constructs pagination tokens using both the _id and the paginatedField if the latter isn't the former", () => {
    const params = {
      paginatedField: 'name',
    };

    const prepare: any = {
      next: { _id: '789', name: 'Test 2' },
      previous: { _id: '456', name: 'Test' },
    };
    const response = encodePaginationTokens(params, prepare);

    expect(response.next).toEqual(bsonUrlEncoding.encode(['Test 2', '789']));
    expect(response.previous).toEqual(bsonUrlEncoding.encode(['Test', '456']));
  });
});
