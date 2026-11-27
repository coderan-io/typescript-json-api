import type {
    AnyResource,
    Links,
    Meta,
    RelationsMap,
    Resolve,
    ResourceId,
    ResourceIdentifier,
} from './Document.ts';

/** Lookup of included resources keyed by `type:id`. */
export type IncludedIndex = ReadonlyMap<string, AnyResource>;

export const indexKey = (r: { type: string; id: ResourceId }): string => `${r.type}:${r.id}`;

/** Builds the `type:id` lookup used for relationship resolution. */
export const indexIncluded = (included: readonly AnyResource[]): IncludedIndex =>
    new Map(included.map((r) => [indexKey(r), r]));

type RawRelationshipMap = Record<
    string,
    | {
          data: ResourceIdentifier<AnyResource> | Array<ResourceIdentifier<AnyResource>> | null;
      }
    | undefined
>;

/** Distributes over `U | null`, so a nullable to-one yields `JsonApiData<U> | null`. */
type RelatedData<V> = V extends AnyResource[]
    ? JsonApiData<V[number]>[]
    : V extends AnyResource
      ? JsonApiData<V>
      : null;

/**
 * Applies a relations map `R` to resource type `T` and returns the resulting
 * `JsonApiData` type.
 *
 * @example
 *   type ArticleData = JsonApiDataOf<ArticleResource, { author: UserResource }>;
 */
export type JsonApiDataOf<T extends AnyResource, R extends RelationsMap = {}> = JsonApiData<
    Resolve<T, R>
>;

/**
 * A read-only, type-safe wrapper around a single JSON:API resource object and
 * the `included` pool of its parent document. Created by `JsonApiResource.data()`.
 */
export class JsonApiData<T extends AnyResource> {
    private readonly resource: T;
    private readonly included: IncludedIndex;

    public constructor(resource: T, included: IncludedIndex) {
        this.resource = resource;
        this.included = included;
    }

    get id(): ResourceId {
        return this.resource.id;
    }

    get type(): T['type'] {
        return this.resource.type;
    }

    get links(): Links | undefined {
        return this.resource.links;
    }

    get meta(): Meta | undefined {
        return this.resource.meta;
    }

    /** Read a typed attribute value off the resource. */
    public attribute<K extends keyof T['attributes']>(key: K): T['attributes'][K] {
        return (this.resource.attributes as T['attributes'])[key];
    }

    /**
     * Resolve a relationship by name.
     *
     * - To-one: `JsonApiData<U>`, or `JsonApiData<U> | null` when declared `U | null`.
     * - To-many: `JsonApiData<U>[]` (identifiers missing from `included` are skipped).
     *
     * Resolved values share the same `included` pool, so nested
     * `.relationship(...)` calls keep working.
     */
    public relationship<K extends keyof NonNullable<T['__relations']>>(
        key: K,
    ): RelatedData<NonNullable<T['__relations']>[K]> {
        const rels = (this.resource.relationships ?? {}) as RawRelationshipMap;
        const rel = rels[key as string];

        if (!rel || rel.data == null) {
            // ponytail: no runtime cardinality info, so a missing to-many also yields null
            return null as never;
        }

        const wrap = (ident: ResourceIdentifier<AnyResource>) => {
            const found = this.included.get(indexKey(ident));
            return found ? new JsonApiData(found, this.included) : null;
        };

        if (Array.isArray(rel.data)) {
            return rel.data.map(wrap).filter((r) => r !== null) as never;
        }

        return wrap(rel.data) as never;
    }

    /** Access the underlying raw resource object. */
    public toJSON(): T {
        return this.resource;
    }
}
