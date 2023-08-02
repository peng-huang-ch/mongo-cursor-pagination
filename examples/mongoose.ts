import { PaginateModel, mongoosePlugin } from '../src';
import { faker } from '@faker-js/faker';
import assert from 'node:assert/strict';

import mongoose from 'mongoose';
import _ from 'underscore';

interface Author extends mongoose.Document {
  name: string;
  counter: number;
}

const AuthorSchema = new mongoose.Schema({
  name: String,
  counter: Number,
});
AuthorSchema.index({ name: 'text' });
AuthorSchema.plugin(mongoosePlugin);

const Author = mongoose.model<Author, PaginateModel<Author>>(
  'Author',
  AuthorSchema,
);

async function main() {
  await mongoose.connect('mongodb://localhost:27017/myProject');
  mongoose.set('debug', true);

  const docs = new Array(100).fill(0).map((_, i) => {
    return {
      name: faker.string.alpha(10),
      counter: i + 1,
    };
  });

  await Author.deleteMany({});
  await Author.insertMany(docs);

  // Query the first page.
  let result = await Author.paginate({
    limit: 2,
    paginatedField: 'counter',
    fields: { name: 1, counter: 1 },
  });
  assert.strict(result.results.length === 2);
  assert.strict(result.results[0].counter === 100);
  assert.strict(result.results[1].counter === 99);

  // Query next page.
  result = await Author.paginate({
    limit: 2,
    paginatedField: 'counter',
    next: result.next, // This queries the next page
  });
  console.log(result);
  assert.strict(result.results.length === 2);
  assert.strict(result.results[0].counter === 98);
  assert.strict(result.results[1].counter === 97);
  assert.strict(result.hasPrevious === true);

  // Query previous page.
  result = await Author.paginate({
    limit: 2,
    paginatedField: 'counter',
    previous: result.previous, // This queries the next page
  });
  assert.strict(result.results.length === 2);
  assert.strict(result.results[0].counter === 100);
  assert.strict(result.results[1].counter === 99);
  assert.strict(result.hasPrevious === false);
  mongoose.disconnect();
}

main().catch(console.log);
