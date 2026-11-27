# @coderan/json-api

Type-safe [JSON:API](https://jsonapi.org) document reader for TypeScript. Declare your resources and their relations once, then read attributes and resolve relationships (from `included`) with full type inference.

Zero runtime dependencies.

## Install

```sh
npm install @coderan/json-api
```

## Usage

### 1. Declare resources

```ts
import type { DefineResource, JsonApiDocument, WithRelations } from '@coderan/json-api';

type User = DefineResource<'users', { username: string }>;
type Reaction = DefineResource<'reactions', { type: string }>;
type Article = DefineResource<'articles', { title: string }>;
```

### 2. Type the document

The second type argument maps relationship names to resources. Use an array for to-many, `| null` for a to-one that may be empty, and `WithRelations` for nested relations:

```ts
type ArticleDocument = JsonApiDocument<
    Article,
    {
        author: User;
        editor: User | null;
        reactions: WithRelations<Reaction, { user: User }>[];
    }
>;
```

This type checks the wire format too: relationship identifiers must have the right `type`, `included` may only contain reachable resources, and a non-nullable to-one cannot be `data: null`.

A matching response from your server:

```json
{
    "data": {
        "type": "articles",
        "id": 1,
        "attributes": { "title": "Hello JSON:API" },
        "relationships": {
            "author": { "data": { "type": "users", "id": 7 } },
            "editor": { "data": null },
            "reactions": {
                "data": [
                    { "type": "reactions", "id": 3 },
                    { "type": "reactions", "id": 4 }
                ]
            }
        }
    },
    "included": [
        { "type": "users", "id": 7, "attributes": { "username": "eran" } },
        { "type": "users", "id": 8, "attributes": { "username": "sam" } },
        {
            "type": "reactions",
            "id": 3,
            "attributes": { "type": "heart" },
            "relationships": { "user": { "data": { "type": "users", "id": 8 } } }
        },
        {
            "type": "reactions",
            "id": 4,
            "attributes": { "type": "thumbs-up" },
            "relationships": { "user": { "data": { "type": "users", "id": 7 } } }
        }
    ]
}
```

Relationships only hold `{ type, id }` identifiers; the full resources live once in the top-level `included` array, even when referenced multiple times (user `7` is both the author and a reactor).

### 3. Read it

```ts
import { JsonApiResource } from '@coderan/json-api';

const article = new JsonApiResource(response as ArticleDocument).data();

article.attribute('title'); // 'Hello JSON:API'
article.relationship('author').attribute('username'); // 'eran'
article.relationship('editor')?.attribute('username'); // undefined (editor is null)
article.relationship('reactions')[0]?.relationship('user').attribute('username'); // 'sam'
```

Collections work the same way: `JsonApiDocument<Article[]>` makes `.data()` return an array.

## API

### `JsonApiResource`

| Member                          | Description                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `new JsonApiResource(document)` | Wraps a document and indexes its `included` resources.                                |
| `.data()`                       | `JsonApiData` wrapper(s) for the primary data. Memoized: same instance on every call. |
| `.included()`                   | The raw `included` array.                                                             |
| `.links()` / `.meta()`          | Top-level links and meta (e.g. pagination).                                           |

### `JsonApiData`

| Member               | Description                              |
| -------------------- | ---------------------------------------- |
| `.id` / `.type`      | Resource identifier.                     |
| `.attribute(key)`    | Typed attribute value.                   |
| `.relationship(key)` | Resolved related resource(s), see below. |
| `.links` / `.meta`   | Resource-level links and meta.           |
| `.toJSON()`          | The raw resource object.                 |

`relationship()` returns:

- **to-one** `User`: `JsonApiData<User>`
- **to-one** `User | null`: `JsonApiData<User> | null`
- **to-many** `User[]`: `JsonApiData<User>[]`. Identifiers missing from `included` are skipped.

To type a variable holding a resolved resource, use `JsonApiDataOf`:

```ts
import type { JsonApiDataOf } from '@coderan/json-api';

type ArticleData = JsonApiDataOf<Article, { author: User }>;
```

## Caveats

- Resource ids are typed as `number`.
- A non-nullable to-one whose identifier is missing from `included` returns `null` at runtime. Declare it `| null` if your server may omit it.

## Development

```sh
npm test            # typecheck (incl. type tests in src/types.test.ts) + runtime tests
npm run lint        # oxlint
npm run format      # oxfmt
```

## License

MIT
