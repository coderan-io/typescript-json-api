/** Free-form meta object, allowed on documents, resources and relationships. */
export type Meta = Record<string, unknown>;

/**
 * Subset of JSON:API link objects. All fields are optional because a given
 * document or resource may include only some of them (e.g. a resource object
 * typically only has `self`, while a collection has `first`/`last`/`next`/`prev`).
 */
export type Links = Partial<{
    self: string;
    related: string;
    first: string;
    last: string;
    prev: string;
    next: string;
}>;

/** Top-level `jsonapi` object describing the server's implementation. */
export type JsonApiObject = {
    version?: string;
    ext?: string[];
    profile?: string[];
    meta?: Meta;
};

/** Numeric identifier used as the `id` field on every JSON:API resource. */
export type ResourceId = number;

/** Attributes object — an arbitrary string-keyed record of unknown values. */
export type AnyAttributes = Record<string, unknown>;

/**
 * Describes the relationships a resource can have. Each key maps to either a
 * single related resource (to-one) or an array of related resources (to-many).
 * Add `| null` to a to-one relation that may be empty (e.g. deleted).
 */
export type RelationsMap = Record<string, AnyResource | AnyResource[] | null>;

/**
 * The minimal `{ type, id }` pair used inside `relationships.data` to
 * reference another resource without embedding its full attributes.
 */
export type ResourceIdentifier<T extends AnyResource> = {
    type: T['type'];
    id: ResourceId;
};

/**
 * The wire-format shape of the `relationships` block of a JSON:API resource
 * object. To-one relationships may be `null` (empty), to-many are arrays.
 */
export type RelationshipsPayload<TRelations extends RelationsMap> = {
    [K in keyof TRelations]: {
        links?: Links;
        meta?: Meta;
        data: TRelations[K] extends Array<infer U>
            ? U extends AnyResource
                ? Array<ResourceIdentifier<U>>
                : never
            : NonNullable<TRelations[K]> extends AnyResource
              ? ResourceIdentifier<NonNullable<TRelations[K]>> | Extract<TRelations[K], null>
              : never;
    };
};

/**
 * Base shape every JSON:API resource object conforms to.
 *
 * The `__relations` field is a phantom (purely type-level) marker used to
 * preserve the *full* related resource types so that we can later flatten
 * them into `included` and resolve them in `relationship()` calls.
 */
export interface BaseResource<
    TType extends string = string,
    TAttributes extends AnyAttributes = AnyAttributes,
    TRelations extends RelationsMap = {},
> {
    type: TType;
    id: ResourceId;
    attributes: TAttributes;
    links?: Links;
    meta?: Meta;
    relationships?: RelationshipsPayload<TRelations>;
    /** Phantom type marker – not present at runtime. */
    __relations?: TRelations;
}

/** Convenience alias for a `BaseResource` with unconstrained type parameters. */
export type AnyResource = BaseResource<string, AnyAttributes, any>;

/**
 * Unwraps an array or scalar resource type to its element type.
 * Returns `never` if `T` is not a valid resource shape.
 */
export type ResourceBase<T> =
    T extends Array<infer U>
        ? U extends AnyResource
            ? U
            : never
        : T extends AnyResource
          ? T
          : never;

/**
 * Define a reusable resource type with a `type` discriminator and a typed
 * attributes bag. Use this as the canonical way to declare domain resources.
 *
 * @example
 *   type UserResource = DefineResource<'users', { username: string }>;
 */
export type DefineResource<TType extends string, TAttributes extends AnyAttributes> = BaseResource<
    TType,
    TAttributes
>;

/**
 * Augments an existing resource type with a concrete `relationships` block and
 * a phantom `__relations` marker so that `JsonApiData.relationship()` can
 * return fully-typed related resources. Use it for nested relationship trees.
 *
 * @example
 *   JsonApiDocument<ArticleResource, {
 *       author: UserResource;
 *       emojiReactions: WithRelations<EmojiReactionResource, { user: UserResource }>[];
 *   }>;
 */
export type WithRelations<TResource extends AnyResource, TRelations extends RelationsMap> = Omit<
    TResource,
    'relationships' | '__relations'
> & {
    relationships: RelationshipsPayload<TRelations>;
    __relations?: TRelations;
};

/**
 * If a relations map `R` was supplied, apply it on top of `T` via
 * `WithRelations`; otherwise use `T` as-is.
 */
export type Resolve<T extends AnyResource, R extends RelationsMap> = keyof R extends never
    ? T
    : WithRelations<T, R>;

/**
 * Applies `Resolve` to either a single resource or an array of resources,
 * preserving the cardinality of `T`.
 */
export type Resolved<
    T extends AnyResource | AnyResource[],
    R extends RelationsMap,
> = T extends AnyResource[] ? Resolve<ResourceBase<T>, R>[] : Resolve<ResourceBase<T>, R>;
