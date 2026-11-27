import type {
    AnyResource,
    JsonApiObject,
    Links,
    Meta,
    RelationsMap,
    Resolved,
    ResourceBase,
} from './Document.ts';
import { indexIncluded, JsonApiData } from './JsonApiData.ts';

/**
 * Recursively collects every resource type transitively reachable through a
 * resource's relationships. Used to type the `included` array.
 *
 * @example
 *   // ArticleResource with { author: UserResource, tags: TagResource[] }
 *   // CollectIncludes<ArticleResource> === UserResource | TagResource
 */
export type CollectIncludes<T> = T extends { __relations?: infer R }
    ? R extends RelationsMap
        ? {
              [K in keyof R]: R[K] extends Array<infer U>
                  ? U extends AnyResource
                      ? U | CollectIncludes<U>
                      : never
                  : NonNullable<R[K]> extends AnyResource
                    ? NonNullable<R[K]> | CollectIncludes<NonNullable<R[K]>>
                    : never;
          }[keyof R]
        : never
    : never;

/** The wire shape of a JSON:API document after relationships have been applied. */
export interface ResolvedJsonApiDocument<T extends AnyResource | AnyResource[]> {
    jsonapi?: JsonApiObject;
    links?: Links;
    meta?: Meta;
    data: T;
    included?: Array<CollectIncludes<ResourceBase<T>>>;
}

/**
 * Typed shape of a JSON:API document, used to annotate API responses (e.g.
 * Inertia page props) before wrapping them in `JsonApiResource`.
 *
 * The phantom fields are never present at runtime; they let TypeScript infer
 * the primary resource type and relations map.
 *
 * @example
 *   article: JsonApiDocument<ArticleResource, { author: UserResource }>;
 */
export interface JsonApiDocument<
    T extends AnyResource | AnyResource[],
    R extends RelationsMap = {},
> extends ResolvedJsonApiDocument<Resolved<T, R>> {
    readonly __resourceType?: T;
    readonly __relationsType?: R;
}

type DataOf<D> = D extends AnyResource[]
    ? JsonApiData<D[number]>[]
    : D extends AnyResource
      ? JsonApiData<D>
      : never;

/**
 * Entry point for consuming a JSON:API document. Wrap the raw document once,
 * then call `.data()` to get `JsonApiData` wrapper(s) for the primary resource(s).
 *
 * @example
 *   const article = new JsonApiResource(pageProps.article).data();
 *   article.attribute('title');
 *   article.relationship('author'); // JsonApiData<UserResource>
 */
export class JsonApiResource<D extends AnyResource | AnyResource[]> {
    private readonly doc: ResolvedJsonApiDocument<D>;
    private readonly wrapped: DataOf<D>;

    public constructor(raw: ResolvedJsonApiDocument<D>) {
        this.doc = raw;

        const index = indexIncluded((raw.included ?? []) as AnyResource[]);
        const d = raw.data as AnyResource | AnyResource[];

        this.wrapped = (
            Array.isArray(d) ? d.map((r) => new JsonApiData(r, index)) : new JsonApiData(d, index)
        ) as DataOf<D>;
    }

    /** Top-level links from the document (e.g. pagination links on collections). */
    public links(): Links | undefined {
        return this.doc.links;
    }

    /** Top-level meta from the document (e.g. pagination totals). */
    public meta(): Meta | undefined {
        return this.doc.meta;
    }

    /** All sideloaded resources from the `included` array of the document. */
    public included(): ReadonlyArray<CollectIncludes<ResourceBase<D>>> {
        return this.doc.included ?? [];
    }

    /**
     * `JsonApiData` wrapper(s) for the primary resource(s). Returns the same
     * instance(s) on every call, so it is safe to use in React dependencies.
     */
    public data(): DataOf<D> {
        return this.wrapped;
    }
}
