import { Db, MongoClient, ObjectId } from 'mongodb';
import _ from 'underscore';
import { faker } from '@faker-js/faker';
import * as paging from '../src/search';

describe('search', () => {
  let connection: MongoClient;
  let db: Db;
  interface TestDocument {
    _id: ObjectId;
    mytext: string;
    counter: number;
    score: number;
    timestamp?: number;
  }
  const id_dataset = new Array(20)
    .fill(0)
    .map((_, index) => new ObjectId(index));
  const get_id = (index: number): ObjectId => id_dataset[index - 1];
  const test_paging_search_coll = faker.string.alpha(20);
  const test_duplicate_search_coll = faker.string.alpha(20);

  beforeAll(async () => {
    const uri: string = (global as any).__MONGO_URI__;
    connection = await MongoClient.connect(uri);
    db = connection.db();

    await Promise.all([
      db.collection(test_paging_search_coll).createIndex(
        {
          mytext: 'text',
        },
        {
          name: 'test_index',
        },
      ),
      db.collection(test_duplicate_search_coll).createIndex(
        {
          mytext: 'text',
        },
        {
          name: 'test_index',
        },
      ),
    ]);

    await Promise.all([
      db.collection(test_paging_search_coll).insertMany([
        {
          mytext: 'one',
        },
        {
          mytext: 'one two',
        },
        {
          mytext: 'one two three',
        },
        {
          mytext: 'one two three four',
        },
        {
          mytext: 'one two three four five',
          group: 'one',
        },
        {
          mytext: 'one two three four five six',
          group: 'one',
        },
        {
          mytext: 'one two three four five six seven',
          group: 'one',
        },
        {
          mytext: 'one two three four five six seven eight',
          group: 'one',
        },
      ]),
      db.collection(test_duplicate_search_coll).insertMany([
        {
          _id: get_id(6),
          mytext: 'one',
          counter: 1,
        },
        {
          _id: get_id(5),
          mytext: 'one',
          counter: 2,
        },
        {
          _id: get_id(4),
          mytext: 'one',
          counter: 3,
        },
        {
          _id: get_id(3),
          mytext: 'one two',
          counter: 4,
        },
        {
          _id: get_id(2),
          mytext: 'one two',
          counter: 5,
        },
        {
          _id: get_id(1),
          mytext: 'one two',
          counter: 6,
        },
      ]),
    ]);
  });

  afterAll(async () => connection.close());

  describe('basic usage', () => {
    it('queries the first few pages', async () => {
      const collection = db.collection(test_paging_search_coll);
      // First page of 2
      let res = await paging.search<TestDocument>(collection, 'one', {
        fields: {
          mytext: 1,
        },
        limit: 2,
      });

      expect(res.results.length).toEqual(2);
      expect(res.results[0].mytext).toEqual('one');
      expect(res.results[0].score).toEqual(1.1);
      expect(res.results[1].mytext).toEqual('one two');
      expect(res.results[1].score).toEqual(0.75);
      expect(res.previous).toBeFalsy();
      expect(typeof res.next).toEqual('string');

      // Go forward 2
      res = await paging.search(collection, 'one', {
        fields: {
          mytext: 1,
        },
        limit: 3,
        next: res.next,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].mytext).toEqual('one two three');
      expect(res.results[0].score).toEqual(0.6666666666666666);
      expect(res.results[1].mytext).toEqual('one two three four');
      expect(res.results[1].score).toEqual(0.625);
      expect(res.results[2].mytext).toEqual('one two three four five');
      expect(res.results[2].score).toEqual(0.6);
      expect(typeof res.next).toEqual('string');

      // Go forward another 2
      res = await paging.search(collection, 'one', {
        fields: {
          mytext: 1,
        },
        limit: 4,
        next: res.next,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].mytext).toEqual('one two three four five six');
      expect(res.results[0].score).toEqual(0.5833333333333334);
      expect(res.results[1].mytext).toEqual(
        'one two three four five six seven',
      );
      expect(res.results[1].score).toEqual(0.5714285714285714);
      expect(res.results[2].mytext).toEqual(
        'one two three four five six seven eight',
      );
      expect(res.results[2].score).toEqual(0.5625);
      expect(res.next).toEqual(undefined);
    });
  });

  describe('when there are duplicate scores', () => {
    it('queries the first few pages', async () => {
      const collection = db.collection(test_duplicate_search_coll);
      // First page of 2.
      let res = await paging.search<TestDocument>(collection, 'one', {
        fields: {
          mytext: 1,
          counter: 1,
        },
        limit: 2,
      });

      expect(res.results.length).toEqual(2);
      expect(res.results[0].counter).toEqual(1);
      expect(res.results[1].counter).toEqual(2);
      expect(res.previous).toBeFalsy();
      expect(typeof res.next).toEqual('string');

      // Go forward 2
      res = await paging.search(collection, 'one', {
        fields: {
          mytext: 1,
          counter: 1,
        },
        limit: 2,
        next: res.next,
      });

      expect(res.results.length).toEqual(2);
      expect(res.results[0].counter).toEqual(3);
      expect(res.results[1].counter).toEqual(4);
      expect(typeof res.next).toEqual('string');

      // Go forward another 2
      res = await paging.search(collection, 'one', {
        fields: {
          mytext: 1,
          counter: 1,
        },
        limit: 4,
        next: res.next,
      });

      expect(res.results.length).toEqual(2);
      expect(res.results[0].counter).toEqual(5);
      expect(res.results[1].counter).toEqual(6);
      expect(res.next).toEqual(undefined);
    });
  });
});
