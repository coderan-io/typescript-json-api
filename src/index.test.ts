import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    JsonApiResource,
    type DefineResource,
    type JsonApiDocument,
    type WithRelations,
} from './index.ts';

type User = DefineResource<'users', { username: string }>;
type Reaction = DefineResource<'reactions', { type: string }>;
type Article = DefineResource<'articles', { title: string }>;

const doc: JsonApiDocument<
    Article,
    {
        author: User;
        editor: User | null;
        reactions: WithRelations<Reaction, { user: User }>[];
    }
> = {
    data: {
        type: 'articles',
        id: 1,
        attributes: { title: 'Hello' },
        relationships: {
            author: { data: { type: 'users', id: 7 } },
            editor: { data: null },
            reactions: {
                data: [
                    { type: 'reactions', id: 3 },
                    { type: 'reactions', id: 99 },
                ],
            },
        },
    },
    included: [
        { type: 'users', id: 7, attributes: { username: 'eran' } },
        {
            type: 'reactions',
            id: 3,
            attributes: { type: 'heart' },
            relationships: { user: { data: { type: 'users', id: 7 } } },
        },
    ],
};

test('resolves attributes, to-one, to-many and nested relationships', () => {
    const resource = new JsonApiResource(doc);
    const article = resource.data();

    assert.equal(article.attribute('title'), 'Hello');
    assert.equal(article.relationship('author').attribute('username'), 'eran');
    assert.equal(article.relationship('editor'), null);

    const reactions = article.relationship('reactions');
    assert.equal(reactions.length, 1, 'identifiers missing from included are skipped');
    assert.equal(reactions[0]!.relationship('user').attribute('username'), 'eran');

    assert.equal(resource.data(), article, 'data() is memoized');
});

test('wraps collections', () => {
    const list = new JsonApiResource<Article[]>({
        data: [
            { type: 'articles', id: 1, attributes: { title: 'a' } },
            { type: 'articles', id: 2, attributes: { title: 'b' } },
        ],
    });
    assert.deepEqual(
        list.data().map((a) => a.attribute('title')),
        ['a', 'b'],
    );
});
