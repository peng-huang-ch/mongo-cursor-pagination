import { MongoClient } from 'mongodb';
import type { Db } from 'mongodb';
import { ObjectId } from 'bson';

import * as bsonUrlEncoding from '../../src/utils/bsonUrlEncoding';

describe('bson url encoding', () => {
  let connection: MongoClient;
  let db: Db;

  beforeAll(async () => {
    const uri: string = (global as any).__MONGO_URI__;
    connection = await MongoClient.connect(uri);
    db = connection.db();
  });

  afterAll(async () => {
    await connection.close();
  });

  it('encodes and decodes complex objects', async () => {
    const obj: any = {
      _id: new ObjectId('58164d86f69ab45942c6ff38'),
      date: new Date('Sun Oct 30 2016 12:32:35 GMT-0700 (PDT)'),
      number: 1,
      string: 'complex String &$##$-/?',
    };
    await db.collection('test_objects').insertOne(obj);
    const bsonObject = await db.collection('test_objects').findOne({});
    const str = bsonUrlEncoding.encode(bsonObject);

    expect(str).toEqual(
      'eyJfaWQiOnsiJG9pZCI6IjU4MTY0ZDg2ZjY5YWI0NTk0MmM2ZmYzOCJ9LCJkYXRlIjp7IiRkYXRlIjoiMjAxNi0xMC0zMFQxOTozMjozNVoifSwibnVtYmVyIjoxLCJzdHJpbmciOiJjb21wbGV4IFN0cmluZyAmJCMjJC0vPyJ9',
    );

    const decoded: any = bsonUrlEncoding.decode(str);
    // Check types
    expect(typeof decoded.date).toEqual('object');
    expect(typeof decoded.number).toEqual('number');
    expect(typeof decoded.string).toEqual('string');
  });

  it('encodes and decodes strings', async () => {
    const str = bsonUrlEncoding.encode('string _id');

    expect(str).toEqual('InN0cmluZyBfaWQi');

    const decoded = bsonUrlEncoding.decode(str);
    expect(decoded).toEqual('string _id');
    expect(typeof decoded).toEqual('string');
  });
});
