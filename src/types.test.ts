// Compile-time type tests: checked by `tsc --noEmit` in `npm test`, nothing runs.
import type {
    CollectIncludes,
    DefineResource,
    JsonApiData,
    JsonApiDataOf,
    JsonApiResource,
    WithRelations,
} from './index.ts';

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type User = DefineResource<'users', { username: string }>;
type Reaction = WithRelations<DefineResource<'reactions', { type: string }>, { user: User }>;
type Article = DefineResource<'articles', { title: string; views: number }>;
type Relations = { author: User; editor: User | null; reactions: Reaction[] };
type AuthorIdentifier = WithRelations<Article, Relations>['relationships']['author']['data'];
type EditorIdentifier = WithRelations<Article, Relations>['relationships']['editor']['data'];

declare const article: JsonApiDataOf<Article, Relations>;
declare const reaction: JsonApiData<Reaction>;
declare const list: JsonApiResource<Article[]>;

export type Tests = [
    Expect<Equal<typeof article.type, 'articles'>>,
    Expect<Equal<ReturnType<typeof article.attribute<'title'>>, string>>,
    Expect<Equal<ReturnType<typeof article.attribute<'views'>>, number>>,
    Expect<Equal<ReturnType<typeof article.relationship<'author'>>, JsonApiData<User>>>,
    Expect<Equal<ReturnType<typeof article.relationship<'editor'>>, JsonApiData<User> | null>>,
    Expect<Equal<ReturnType<typeof article.relationship<'reactions'>>, JsonApiData<Reaction>[]>>,
    Expect<Equal<ReturnType<typeof reaction.relationship<'user'>>, JsonApiData<User>>>,
    Expect<Equal<ReturnType<typeof list.data>, JsonApiData<Article>[]>>,
    Expect<Equal<CollectIncludes<WithRelations<Article, Relations>>, User | Reaction>>,
];

// Never called; only here so tsc checks the @ts-expect-error lines.
export function negativeCases(): void {
    // @ts-expect-error unknown attribute
    article.attribute('nope');
    // @ts-expect-error unknown relationship
    article.relationship('nope');
    // @ts-expect-error resource without relations has none to resolve
    reaction.relationship('user').relationship('anything');
    // @ts-expect-error wrong `type` discriminator in a relationship identifier
    const _bad: AuthorIdentifier = { type: 'articles', id: 1 };
    // @ts-expect-error non-nullable to-one cannot be empty on the wire
    const _empty: AuthorIdentifier = null;
    const _deleted: EditorIdentifier = null;
}
