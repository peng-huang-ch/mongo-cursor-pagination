import mongoose from 'mongoose';
import _ from 'underscore';
import { mongoosePlugin } from '../src/mongoose.plugin';
import { PaginateModel, DynPaginateModel } from '../src/types';

interface Author extends mongoose.Document {
  name: string;
}

const AuthorSchema = new mongoose.Schema({ name: String });
AuthorSchema.index({ name: 'text' });

AuthorSchema.plugin(mongoosePlugin, {
  name: 'paginateFN',
  searchFnName: 'searchFN',
});
const Author = mongoose.model<Author, DynPaginateModel<Author>>(
  'Author',
  AuthorSchema,
);

interface Post extends mongoose.Document {
  title: string;
}

const PostSchema = new mongoose.Schema({
  title: String,
  date: Date,
  body: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author',
  },
});

PostSchema.plugin(mongoosePlugin);
PostSchema.index({ title: 'text' });

const Post = mongoose.model<Post, PaginateModel<Post>>('Post', PostSchema);

describe('mongoose plugin', () => {
  beforeAll(async () => {
    const uri: string = (global as any).__MONGO_URI__;

    await mongoose.connect(uri);
    const author = await Author.create({ name: 'Pawan Pandey' });

    const posts = [],
      date = new Date();

    for (let i = 1; i <= 100; i++) {
      const post = new Post({
        title: 'Post #' + i,
        date: new Date(date.getTime() + i),
        author: author._id,
        body: 'Post Body #' + i,
      });
      posts.push(post);
    }

    await Post.create(posts);
    await Author.ensureIndexes();
    await Post.ensureIndexes();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  it('initializes the pagination function by the provided name', () => {
    const method = Author['paginateFN'];
    expect(method).toBeInstanceOf(Function);

    expect(Author.paginateFN).toBeInstanceOf(Function);
    const promise = Author.paginateFN();
    expect(promise.then instanceof Function).toBe(true);
  });

  it('returns a promise', () => {
    const promise = Post.paginate();
    expect(promise.then instanceof Function).toBe(true);
  });

  it('returns data in the expected format', async () => {
    const data = await Post.paginate();
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('previous');
    expect(data).toHaveProperty('hasPrevious');
    expect(data).toHaveProperty('next');
    expect(data).toHaveProperty('hasNext');
  });

  // //#region search
  it('initializes the search function by the provided name', () => {
    const promise = Author.searchFN('');
    expect(promise.then instanceof Function).toBe(true);
  });

  it('returns a promise for search function', () => {
    const promise = Post.search('');
    expect(promise.then instanceof Function).toBe(true);
  });

  it('returns data in the expected format for search function', async () => {
    const data = await Post.search('Post #1', { limit: 3 });
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('next');
  });
  // //#endregion
});
