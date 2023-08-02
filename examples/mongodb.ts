import { MongoClient } from 'mongodb';
import { find } from '../src';

async function main() {
  const url = 'mongodb://localhost:27017';
  const client = new MongoClient(url);
  const dbName = 'myProject';
  // Use connect method to connect to the server
  await client.connect();
  console.log('Connected successfully to server');
  const db = client.db(dbName);
  const collection = db.collection('documents');

  await collection.insertMany([
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
    },
  ]);

  // Query the first page.
  let result = await find(collection, {
    limit: 2,
  });
  console.log(result);

  // Query next page.
  result = await find(collection, {
    limit: 2,
    next: result.next, // This queries the next page
  });
  console.log(result);
}

main().catch(console.log);
