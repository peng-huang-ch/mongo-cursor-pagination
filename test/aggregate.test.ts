import { ObjectId } from 'bson';
import { Collection, Db, MongoClient } from 'mongodb';
import _ from 'underscore';
import { faker } from '@faker-js/faker';
import { aggregate } from '../src/aggregate';
import * as paging from '../src/aggregate';

describe('aggregate', () => {
  let connection: MongoClient;
  let db: Db;

  interface TestDocument {
    _id: ObjectId;
    counter: number;
    color: string;
    start: number;
    timestamp?: number;
  }

  const id_dataset = new Array(8)
    .fill(0)
    .map((_, index) => new ObjectId(index));
  const get_id = (index: number): ObjectId => id_dataset[index - 1];

  let test_aggregation_lookup_dataset: { _id: ObjectId; name: string }[];
  let test_null_values_dataset: any[];

  const test_paging_coll = faker.string.alpha(20);
  const test_aggregation_coll = faker.string.alpha(20);
  const test_aggregation_lookup_coll = faker.string.alpha(20);
  const test_aggregation_sort_coll = faker.string.alpha(20);
  const test_null_values_coll = faker.string.alpha(20);

  beforeAll(async () => {
    const uri: string = (global as any).__MONGO_URI__;
    connection = await MongoClient.connect(uri);
    db = connection.db();

    test_aggregation_lookup_dataset = [
      {
        _id: get_id(1),
        name: 'mercury',
      },
      {
        _id: get_id(2),
        name: 'venus',
      },
      {
        _id: get_id(3),
        name: 'earth',
      },
      {
        _id: get_id(4),
        name: 'mars',
      },
      {
        _id: get_id(5),
        name: 'jupiter',
      },
      {
        _id: get_id(6),
        name: 'saturn',
      },
    ];

    test_null_values_dataset = [
      undefined,
      undefined,
      undefined,
      null,
      null,
      'Alice',
      'Bob',
      'alpha',
      'bravo',
    ].map((name, i) =>
      name === undefined
        ? { _id: get_id(i + 1) }
        : { _id: get_id(i + 1), name },
    );

    // Set up collections once for testing later.
    await Promise.all([
      db.collection(test_paging_coll).insertMany([
        {
          counter: 1,
        },
        {
          counter: 2,
        },
        {
          counter: 3,
        },
        {
          counter: 4,
          color: 'blue',
        },
        {
          counter: 5,
          color: 'blue',
        },
        {
          counter: 6,
          color: 'blue',
        },
        {
          counter: 7,
          color: 'blue',
        },
        {
          counter: 8,
          color: 'blue',
        },
      ]),
      db.collection(test_aggregation_coll).insertMany([
        {
          items: [1, 2, 3].map(
            (i) => test_aggregation_lookup_dataset[i - 1]._id,
          ),
        },
        {
          items: [4, 5, 6].map(
            (i) => test_aggregation_lookup_dataset[i - 1]._id,
          ),
        },
        {
          items: [1, 3, 6].map(
            (i) => test_aggregation_lookup_dataset[i - 1]._id,
          ),
        },
        {
          items: [2, 4, 5].map(
            (i) => test_aggregation_lookup_dataset[i - 1]._id,
          ),
        },
      ]),
      db
        .collection(test_aggregation_lookup_coll)
        .insertMany(test_aggregation_lookup_dataset),
      db.collection(test_aggregation_lookup_coll).createIndex(
        {
          name: 'text',
        },
        {
          name: 'test_index',
        },
      ),
      db.collection(test_aggregation_sort_coll).insertMany([
        {
          name: 'Alpha',
        },
        {
          name: 'gimel',
        },
        {
          name: 'Beta',
        },
        {
          name: 'bet',
        },
        {
          name: 'Gamma',
        },
        {
          name: 'aleph',
        },
      ]),
      db.collection(test_null_values_coll).insertMany(test_null_values_dataset),
    ]);
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(() => {});

  describe('test pagination', () => {
    it('queries the first few pages with next/previous', async () => {
      const collection = db.collection(test_paging_coll);
      // First page of 3
      let res = await aggregate<TestDocument>(collection, {
        limit: 3,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);

      // Go forward 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        next: res.next,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(5);
      expect(res.results[1].counter).toEqual(4);
      expect(res.results[2].counter).toEqual(3);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Go forward another 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        next: res.next,
      });

      expect(res.results.length).toEqual(2);
      expect(res.results[0].counter).toEqual(2);
      expect(res.results[1].counter).toEqual(1);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(false);

      // Now back up 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        previous: res.previous,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(5);
      expect(res.results[1].counter).toEqual(4);
      expect(res.results[2].counter).toEqual(3);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Now back up 3 more
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        previous: res.previous,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);
    });

    it('queries the first few pages with after/before', async () => {
      const collection = db.collection(test_paging_coll);
      // First page of 3
      let res = await aggregate<TestDocument>(collection, {
        limit: 3,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);

      // Go forward 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        after: res.results[res.results.length - 1]._id,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(5);
      expect(res.results[1].counter).toEqual(4);
      expect(res.results[2].counter).toEqual(3);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Go forward another 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        after: res.results[res.results.length - 1]._id,
      });

      expect(res.results.length).toEqual(2);
      expect(res.results[0].counter).toEqual(2);
      expect(res.results[1].counter).toEqual(1);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(false);

      // Now back up 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        before: res.results[0]._id,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(5);
      expect(res.results[1].counter).toEqual(4);
      expect(res.results[2].counter).toEqual(3);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Now back up 3 more
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        before: res.results[0]._id,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);
    });

    it('handles hitting the end with next/previous', async () => {
      const collection = db.collection(test_paging_coll);
      // First page of 2
      let res = await aggregate<TestDocument>(collection, {
        limit: 4,
      });

      expect(res.results.length).toEqual(4);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.results[3].counter).toEqual(5);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);

      // Go forward 2
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        next: res.next,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(4);
      expect(res.results[1].counter).toEqual(3);
      expect(res.results[2].counter).toEqual(2);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Go forward another 1, results be empty.
      res = await aggregate<TestDocument>(collection, {
        limit: 2,
        next: res.next,
      });

      expect(res.results.length).toEqual(1);
      expect(res.results[0].counter).toEqual(1);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(false);
    });

    it('handles hitting the end with after/before', async () => {
      const collection = db.collection(test_paging_coll);
      // First page of 2
      let res = await aggregate<TestDocument>(collection, {
        limit: 4,
      });

      expect(res.results.length).toEqual(4);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.results[3].counter).toEqual(5);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);

      // Go forward 2
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        after: res.results[res.results.length - 1]._id,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(4);
      expect(res.results[1].counter).toEqual(3);
      expect(res.results[2].counter).toEqual(2);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Go forward another 1, results be empty.
      res = await aggregate<TestDocument>(collection, {
        limit: 2,
        after: res.results[res.results.length - 1]._id,
      });

      expect(res.results.length).toEqual(1);
      expect(res.results[0].counter).toEqual(1);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(false);
    });

    it('handles hitting the beginning with next/previous', async () => {
      const collection = db.collection(test_paging_coll);
      // First page of 2
      let res = await aggregate<TestDocument>(collection, {
        limit: 4,
      });

      expect(res.results.length).toEqual(4);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.results[3].counter).toEqual(5);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);

      // Go forward 2
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        next: res.next,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(4);
      expect(res.results[1].counter).toEqual(3);
      expect(res.results[2].counter).toEqual(2);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Go back to beginning.
      res = await aggregate<TestDocument>(collection, {
        limit: 100,
        previous: res.previous,
      });

      expect(res.results.length).toEqual(4);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.results[3].counter).toEqual(5);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);
    });

    it('handles hitting the beginning with after/before', async () => {
      const collection = db.collection(test_paging_coll);
      // First page of 2
      let res = await aggregate<TestDocument>(collection, {
        limit: 4,
      });

      expect(res.results.length).toEqual(4);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.results[3].counter).toEqual(5);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);

      // Go forward 2
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        after: res.results[res.results.length - 1]._id,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(4);
      expect(res.results[1].counter).toEqual(3);
      expect(res.results[2].counter).toEqual(2);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Go back to beginning.
      res = await aggregate<TestDocument>(collection, {
        limit: 100,
        before: res.results[0]._id,
      });

      expect(res.results.length).toEqual(4);
      expect(res.results[0].counter).toEqual(8);
      expect(res.results[1].counter).toEqual(7);
      expect(res.results[2].counter).toEqual(6);
      expect(res.results[3].counter).toEqual(5);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);
    });

    it('uses passed-in simple aggregation', async () => {
      const collection = db.collection(test_paging_coll);
      // First page.
      const res = await aggregate<TestDocument>(collection, {
        aggregation: [
          {
            $match: { color: 'blue' },
          },
        ],
      });

      expect(res.results.length).toEqual(5);
      expect(res.results[0].color).toEqual('blue');
      expect(res.hasNext).toBe(false);
      expect(res.hasPrevious).toBe(false);
    });

    it('does not return "next" or "previous" if there are no results', async () => {
      const collection = db.collection(test_paging_coll);
      // First page.
      const res = await aggregate<TestDocument>(collection, {
        limit: 3,
        aggregation: [
          {
            $match: { nonexistantfield: true },
          },
        ],
      });

      expect(res.results.length).toEqual(0);
      expect(res.hasNext).toBe(false);
      expect(res.hasPrevious).toBe(false);
    });

    it('respects sortAscending option with next/previous', async () => {
      const collection = db.collection(test_paging_coll);
      // First page of 3
      let res = await aggregate<TestDocument>(collection, {
        limit: 3,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(1);
      expect(res.results[1].counter).toEqual(2);
      expect(res.results[2].counter).toEqual(3);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);

      // Go forward 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        next: res.next,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(4);
      expect(res.results[1].counter).toEqual(5);
      expect(res.results[2].counter).toEqual(6);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Go forward another 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        next: res.next,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(2);
      expect(res.results[0].counter).toEqual(7);
      expect(res.results[1].counter).toEqual(8);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(false);

      // // Now back up 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        previous: res.previous,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(4);
      expect(res.results[1].counter).toEqual(5);
      expect(res.results[2].counter).toEqual(6);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Now back up 3 more
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        previous: res.previous,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(1);
      expect(res.results[1].counter).toEqual(2);
      expect(res.results[2].counter).toEqual(3);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);
    });

    it('respects sortAscending option with after/before', async () => {
      const collection = db.collection(test_paging_coll);
      // First page of 3
      let res = await aggregate<TestDocument>(collection, {
        limit: 3,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(1);
      expect(res.results[1].counter).toEqual(2);
      expect(res.results[2].counter).toEqual(3);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);

      // Go forward 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        after: res.results[res.results.length - 1]._id,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(4);
      expect(res.results[1].counter).toEqual(5);
      expect(res.results[2].counter).toEqual(6);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Go forward another 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        after: res.results[res.results.length - 1]._id,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(2);
      expect(res.results[0].counter).toEqual(7);
      expect(res.results[1].counter).toEqual(8);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(false);

      // // Now back up 3
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        before: res.results[0]._id,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(4);
      expect(res.results[1].counter).toEqual(5);
      expect(res.results[2].counter).toEqual(6);
      expect(res.hasPrevious).toBe(true);
      expect(res.hasNext).toBe(true);

      // Now back up 3 more
      res = await aggregate<TestDocument>(collection, {
        limit: 3,
        before: res.results[0]._id,
        sortAscending: true,
      });

      expect(res.results.length).toEqual(3);
      expect(res.results[0].counter).toEqual(1);
      expect(res.results[1].counter).toEqual(2);
      expect(res.results[2].counter).toEqual(3);
      expect(res.hasPrevious).toBe(false);
      expect(res.hasNext).toBe(true);
    });
  });

  describe('lookup aggregations', () => {
    it('returns results from the aggregation', async () => {
      const collection = db.collection(test_aggregation_coll);
      const res = await aggregate<TestDocument>(collection, {
        aggregation: [
          {
            $match: {
              items: get_id(5),
            },
          },
          {
            $unwind: '$items',
          },
          {
            $lookup: {
              from: test_aggregation_lookup_coll,
              localField: 'items',
              foreignField: '_id',
              as: 'itemDoc',
            },
          },
          {
            $unwind: '$itemDoc',
          },
          {
            $group: {
              _id: '$_id',
              planets: { $push: '$itemDoc.name' },
            },
          },
          { $unwind: '$planets' },
        ],
        limit: 3,
      });

      expect(res.results.length).toEqual(3);
      expect(_.pluck(res.results, 'planets')).toEqual(
        expect.arrayContaining(['jupiter', 'venus', 'mars']),
      );
      expect(res.hasNext).toBe(true);
    });
  });

  describe('sort aggregations', () => {
    it('sorts alphabetically, uppercase first', async () => {
      const collection = db.collection(test_aggregation_sort_coll);

      const res = await aggregate<TestDocument>(collection, {
        paginatedField: 'name',
        sortAscending: true,
      });

      expect(_.pluck(res.results, 'name')).toEqual([
        'Alpha',
        'Beta',
        'Gamma',
        'aleph',
        'bet',
        'gimel',
      ]);

      const res_localized = await aggregate<TestDocument>(collection, {
        paginatedField: 'name',
        sortAscending: true,
        collation: { locale: 'en' },
      });

      expect(_.pluck(res_localized.results, 'name')).toEqual([
        'aleph',
        'Alpha',
        'bet',
        'Beta',
        'Gamma',
        'gimel',
      ]);

      const res_static_localized = await aggregate<TestDocument>(collection, {
        paginatedField: 'name',
        sortAscending: true,
        collation: { locale: 'en' },
      });

      expect(_.pluck(res_static_localized.results, 'name')).toEqual([
        'aleph',
        'Alpha',
        'bet',
        'Beta',
        'Gamma',
        'gimel',
      ]);

      const res_excluding_collation = await aggregate<TestDocument>(
        collection,
        {
          paginatedField: 'name',
          sortAscending: true,
          limit: 10,
          collation: null,
        },
      );

      expect(_.pluck(res_excluding_collation.results, 'name')).toEqual([
        'Alpha',
        'Beta',
        'Gamma',
        'aleph',
        'bet',
        'gimel',
      ]);
    });
  });

  describe('aggregation options', () => {
    let spy: jest.SpyInstance;
    beforeEach(() => {
      spy = jest.spyOn(paging, 'aggregate');
    });

    afterEach(() => {
      spy.mockRestore();
    });

    it('invokes aggregate with a `hint` if one is passed in via params object', async () => {
      const collection = db.collection(test_aggregation_lookup_coll);

      await aggregate<TestDocument>(collection, {
        aggregation: [
          {
            $sort: { name: 1 },
          },
        ],
        hint: 'test_index',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ hint: 'test_index' }),
      );
    });
  });

  describe('sorting without collation', () => {
    let collection: Collection;
    beforeAll(() => {
      collection = db.collection(test_aggregation_sort_coll);
    });

    describe('without the `sortCaseInsensitive` parameter...', () => {
      const options = {
        paginatedField: 'name',
        sortAscending: true,
        limit: 2,
      };
      it('sorts capital letters first', async () => {
        const { results: results } = await aggregate<TestDocument>(
          collection,
          options,
        );
        expect(_.pluck(results, 'name')).toEqual(['Alpha', 'Beta']);
      });

      it('sorts null and undefined values at the start', async () => {
        const collection = db.collection(test_null_values_coll);

        const pg1 = await aggregate<TestDocument>(collection, { ...options });
        expect(pg1.hasNext).toBe(true);
        expect(pg1.hasPrevious).toBe(false);
        expect(_.pluck(pg1.results, 'name')).toEqual([undefined, undefined]);
        expect(_.pluck(pg1.results, '_id')).toEqual([get_id(1), get_id(2)]);

        const pg2 = await aggregate<TestDocument>(collection, {
          ...options,
          next: pg1.next,
        });
        expect(pg2.hasNext).toBe(true);
        expect(pg2.hasPrevious).toBe(true);
        expect(_.pluck(pg2.results, 'name')).toEqual([undefined, null]);
        expect(_.pluck(pg2.results, '_id')).toEqual([get_id(3), get_id(4)]);

        const pg3 = await aggregate<TestDocument>(collection, {
          ...options,
          next: pg2.next,
        });
        expect(pg3.hasNext).toBe(true);
        expect(pg3.hasPrevious).toBe(true);
        expect(_.pluck(pg3.results, 'name')).toEqual([null, 'Alice']);
        expect(_.pluck(pg3.results, '_id')).toEqual([get_id(5), get_id(6)]);

        const pg4 = await aggregate<TestDocument>(collection, {
          ...options,
          next: pg3.next,
        });
        expect(pg4.hasNext).toBe(true);
        expect(pg4.hasPrevious).toBe(true);
        expect(_.pluck(pg4.results, 'name')).toEqual(['Bob', 'alpha']);
        expect(_.pluck(pg4.results, '_id')).toEqual([get_id(7), get_id(8)]);

        const pg3b = await aggregate<TestDocument>(collection, {
          ...options,
          previous: pg4.previous,
        });
        expect(pg3b.hasNext).toBe(true);
        expect(pg3b.next).toEqual(pg3.next);
        expect(pg3b.hasPrevious).toBe(true);
        expect(pg3b.previous).toEqual(pg3.previous);
        expect(pg3b.results).toEqual(pg3.results);

        const pg2b = await aggregate<TestDocument>(collection, {
          ...options,
          previous: pg3.previous,
        });
        expect(pg2b.hasNext).toBe(true);
        expect(pg2b.next).toEqual(pg2.next);
        expect(pg2b.hasPrevious).toBe(true);
        expect(pg2b.previous).toEqual(pg2.previous);
        expect(pg2b.results).toEqual(pg2.results);

        const pg1b = await aggregate<TestDocument>(collection, {
          ...options,
          previous: pg2.previous,
        });
        expect(pg1b.hasNext).toBe(true);
        expect(pg1b.next).toEqual(pg1.next);
        expect(pg1b.hasPrevious).toBe(false);
        expect(pg1b.previous).toEqual(pg1.previous);
        expect(pg1b.results).toEqual(pg1.results);
      });
    });

    describe('with the `sortCaseInsensitive` parameter...', () => {
      const options = {
        paginatedField: 'name',
        sortCaseInsensitive: true,
        sortAscending: true,
        limit: 2,
      };

      it('sorts case-insensitively', async () => {
        const r = await aggregate<TestDocument>(collection, { ...options });
        expect(_.pluck(r.results, 'name')).toEqual(['aleph', 'Alpha']);
        expect(r.hasNext).toBe(true);
        expect(r.hasPrevious).toBe(false);
      });

      it('returns the paginated field but not the temporary __lc field', async () => {
        const r = await aggregate<TestDocument>(collection, { ...options });
        expect('name' in r.results[0]).toBe(true);
        expect('__lc' in r.results[0]).toBe(false);
      });

      it('pages correctly forward and backward', async () => {
        const { next } = await aggregate<TestDocument>(collection, {
          ...options,
        });
        const pg2 = await aggregate<TestDocument>(collection, {
          ...options,
          next,
        });
        expect(_.pluck(pg2.results, 'name')).toEqual(['bet', 'Beta']);

        expect(pg2.hasPrevious).toBe(true);
        const pg1 = await aggregate<TestDocument>(collection, {
          ...options,
          previous: pg2.previous,
        });
        expect(_.pluck(pg1.results, 'name')).toEqual(['aleph', 'Alpha']);
        expect(pg1.hasNext).toBe(true);
        expect(pg1.hasPrevious).toBe(false);
        expect(pg1.next).toEqual(next);
      });

      it('sorts null and undefined values at the start', async () => {
        const collection = db.collection(test_null_values_coll);

        const pg1 = await aggregate<TestDocument>(collection, { ...options });
        expect(pg1.hasNext).toBe(true);
        expect(pg1.hasPrevious).toBe(false);
        expect(_.pluck(pg1.results, 'name')).toEqual([undefined, undefined]);
        expect(_.pluck(pg1.results, '_id')).toEqual([get_id(1), get_id(2)]);

        const pg2 = await aggregate<TestDocument>(collection, {
          ...options,
          next: pg1.next,
        });
        expect(pg2.hasNext).toBe(true);
        expect(pg2.hasPrevious).toBe(true);
        expect(_.pluck(pg2.results, 'name')).toEqual([undefined, null]);
        expect(_.pluck(pg2.results, '_id')).toEqual([get_id(3), get_id(4)]);

        const pg3 = await aggregate<TestDocument>(collection, {
          ...options,
          next: pg2.next,
        });
        expect(pg3.hasNext).toBe(true);
        expect(pg3.hasPrevious).toBe(true);
        expect(_.pluck(pg3.results, 'name')).toEqual([null, 'Alice']);
        expect(_.pluck(pg3.results, '_id')).toEqual([get_id(5), get_id(6)]);

        const pg4 = await aggregate<TestDocument>(collection, {
          ...options,
          next: pg3.next,
        });
        expect(pg4.hasNext).toBe(true);
        expect(pg4.hasPrevious).toBe(true);
        expect(_.pluck(pg4.results, 'name')).toEqual(['alpha', 'Bob']);
        expect(_.pluck(pg4.results, '_id')).toEqual([get_id(8), get_id(7)]);

        const pg3b = await aggregate<TestDocument>(collection, {
          ...options,
          previous: pg4.previous,
        });
        expect(pg3b.hasNext).toBe(true);
        expect(pg3b.next).toEqual(pg3.next);
        expect(pg3b.hasPrevious).toBe(true);
        expect(pg3b.previous).toEqual(pg3.previous);
        expect(pg3b.results).toEqual(pg3.results);

        const pg2b = await aggregate<TestDocument>(collection, {
          ...options,
          previous: pg3.previous,
        });
        expect(pg2b.hasNext).toBe(true);
        expect(pg2b.next).toEqual(pg2.next);
        expect(pg2b.hasPrevious).toBe(true);
        expect(pg2b.previous).toEqual(pg2.previous);
        expect(pg2b.results).toEqual(pg2.results);

        const pg1b = await aggregate<TestDocument>(collection, {
          ...options,
          previous: pg2.previous,
        });
        expect(pg1b.hasNext).toBe(true);
        expect(pg1b.next).toEqual(pg1.next);
        expect(pg1b.hasPrevious).toBe(false);
        expect(pg1b.previous).toEqual(pg1.previous);
        expect(pg1b.results).toEqual(pg1.results);
      });
    });
  });
});
