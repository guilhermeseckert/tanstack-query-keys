import type { DataTag, DefaultError, InfiniteData, UseQueryOptions } from '@tanstack/react-query';

/* -------------------------------------------------------------------------- */
/*                                   Inputs                                    */
/* -------------------------------------------------------------------------- */

/** A relative key — the dynamic suffix appended after the hierarchical prefix. */
type RelativeKey = readonly unknown[] | null | undefined;

/**
 * Loose fetcher constraint. We accept any function so that an infinite query's
 * hand-annotated `queryFn: (ctx: { pageParam: number }) => ...` is allowed —
 * the strict `QueryFunction` context type would otherwise reject it.
 */
type AnyFetcher = (...args: never[]) => unknown;

/**
 * `_def` and `_ctx` are reserved for the handles this library emits — schemas
 * may not use them as scope, leaf, or option names. Enforced again at runtime
 * for untyped callers.
 */
type ReservedKeyGuard = { _def?: never; _ctx?: never };

/**
 * A leaf query definition. You may pass any option `queryOptions()` accepts
 * (`staleTime`, `select`, `enabled`, `placeholderData`, …). `queryKey` here is
 * the *relative* suffix — the scope/leaf prefix is composed for you.
 */
type QueryLeafConfig = {
  queryKey?: RelativeKey;
  queryFn?: AnyFetcher;
  contextQueries?: QuerySchema;
} & Record<string, unknown> &
  ReservedKeyGuard;

type DynamicLeaf = (...args: never[]) => readonly unknown[] | QueryLeafConfig;

type AnyLeaf = null | readonly unknown[] | QueryLeafConfig | DynamicLeaf;

type QuerySchema = Record<string, AnyLeaf> & ReservedKeyGuard;

type StoreSchema = Record<string, QuerySchema | null> & ReservedKeyGuard;

/* -------------------------------------------------------------------------- */
/*                              Output type model                             */
/* -------------------------------------------------------------------------- */

type Key = readonly unknown[];

/** Extract the data type a leaf's `queryFn` resolves to. */
type DataOf<L> = L extends { queryFn: (...args: never[]) => infer R } ? Awaited<R> : unknown;

/** Extract the relative-key suffix declared on a leaf (defaults to `[]`). */
type SuffixOf<L> = L extends { queryKey: infer K }
  ? K extends Key
    ? K
    : readonly []
  : readonly [];

type ComposeKey<Path extends Key, L> = readonly [...Path, ...SuffixOf<L>];

type DefHandle<Path extends Key> = { _def: Readonly<Path> };

/** Nested `_ctx` block produced by `contextQueries`. */
type ContextOf<Path extends Key, L> = L extends { contextQueries: infer Ctx }
  ? Ctx extends QuerySchema
    ? {
        _ctx: {
          [P in keyof Ctx & string]: LeafOutput<readonly [...ComposeKey<Path, L>, P], Ctx[P]>;
        };
      }
    : { _ctx: Record<string, never> }
  : { _ctx?: undefined };

/** Key-only output (for `null` entries or relative-array entries). */
type KeyOnlyOutput<Def extends Key, FullKey extends Key> = {
  queryKey: Readonly<FullKey>;
} & DefHandle<Def>;

/** Output for a leaf carrying a `queryFn` — branded so `getQueryData` is typed. */
type QueryOutput<Path extends Key, L> = (L extends { getNextPageParam: unknown }
  ? Omit<L, 'queryKey' | 'contextQueries'> & {
      queryKey: DataTag<ComposeKey<Path, L>, InfiniteData<DataOf<L>>, DefaultError>;
    }
  : Omit<L, 'queryKey' | 'contextQueries'> & {
      queryKey: DataTag<ComposeKey<Path, L>, DataOf<L>, DefaultError>;
    }) &
  DefHandle<Path> &
  ContextOf<Path, L>;

/** Resolve the output of a dynamic leaf's return value. */
type DynamicReturnOutput<Path extends Key, R> = R extends Key
  ? KeyOnlyOutput<Path, readonly [...Path, ...R]>
  : R extends QueryLeafConfig
    ? QueryOutput<Path, R>
    : never;

type LeafOutput<Path extends Key, L> = L extends null | undefined
  ? KeyOnlyOutput<Path, Path>
  : L extends DynamicLeaf
    ? ((...args: Parameters<L>) => DynamicReturnOutput<Path, ReturnType<L>>) & DefHandle<Path>
    : L extends Key
      ? KeyOnlyOutput<Path, readonly [...Path, ...L]>
      : L extends QueryLeafConfig
        ? QueryOutput<Path, L>
        : never;

type QueryKeysOutput<Scope extends string, S extends QuerySchema> = {
  [P in keyof S & string]: LeafOutput<readonly [Scope, P], S[P]>;
} & DefHandle<readonly [Scope]>;

type StoreOutput<S extends StoreSchema> = {
  [Scope in keyof S & string]: S[Scope] extends QuerySchema
    ? QueryKeysOutput<Scope, S[Scope]>
    : DefHandle<readonly [Scope]>;
};

/* -------------------------------------------------------------------------- */
/*                               Mutation model                               */
/* -------------------------------------------------------------------------- */

type MutationLeafConfig = {
  mutationKey?: RelativeKey;
  mutationFn?: AnyFetcher;
  contextMutations?: MutationSchema;
} & Record<string, unknown> &
  ReservedKeyGuard;

type DynamicMutationLeaf = (...args: never[]) => readonly unknown[] | MutationLeafConfig;

type AnyMutationLeaf = null | readonly unknown[] | MutationLeafConfig | DynamicMutationLeaf;

type MutationSchema = Record<string, AnyMutationLeaf> & ReservedKeyGuard;

type MutationSuffixOf<L> = L extends { mutationKey: infer K }
  ? K extends Key
    ? K
    : readonly []
  : readonly [];

type MutationContextOf<Path extends Key, L> = L extends { contextMutations: infer Ctx }
  ? Ctx extends MutationSchema
    ? {
        _ctx: {
          [P in keyof Ctx & string]: MutationLeafOutput<
            readonly [...Path, ...MutationSuffixOf<L>, P],
            Ctx[P]
          >;
        };
      }
    : { _ctx: Record<string, never> }
  : { _ctx?: undefined };

type MutationKeyOnlyOutput<Def extends Key, FullKey extends Key> = {
  mutationKey: Readonly<FullKey>;
} & DefHandle<Def>;

type MutationConfigOutput<Path extends Key, L> = Omit<L, 'mutationKey' | 'contextMutations'> & {
  mutationKey: readonly [...Path, ...MutationSuffixOf<L>];
} & DefHandle<Path> &
  MutationContextOf<Path, L>;

type DynamicMutationReturnOutput<Path extends Key, R> = R extends Key
  ? MutationKeyOnlyOutput<Path, readonly [...Path, ...R]>
  : R extends MutationLeafConfig
    ? MutationConfigOutput<Path, R>
    : never;

type MutationLeafOutput<Path extends Key, L> = L extends null | undefined
  ? MutationKeyOnlyOutput<Path, Path>
  : L extends DynamicMutationLeaf
    ? ((...args: Parameters<L>) => DynamicMutationReturnOutput<Path, ReturnType<L>>) &
        DefHandle<Path>
    : L extends Key
      ? MutationKeyOnlyOutput<Path, readonly [...Path, ...L]>
      : L extends MutationLeafConfig
        ? MutationConfigOutput<Path, L>
        : never;

type MutationKeysOutput<Scope extends string, S extends MutationSchema> = {
  [P in keyof S & string]: MutationLeafOutput<readonly [Scope, P], S[P]>;
} & DefHandle<readonly [Scope]>;

/* -------------------------------------------------------------------------- */
/*                                  Runtime                                    */
/* -------------------------------------------------------------------------- */

/**
 * Strip the prototype so the resulting plain key/options object can be safely
 * spread into `useQuery` and hashed by TanStack Query without inherited props.
 */
const omitPrototype = <T extends Record<string, unknown>>(value: T): T =>
  Object.assign(Object.create(null), value);

const isArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const RESERVED_NAMES = new Set(['_def', '_ctx']);

/** Runtime mirror of `ReservedKeyGuard` — catches untyped callers and casts. */
const assertNotReserved = (name: string): void => {
  if (RESERVED_NAMES.has(name)) {
    throw new Error(
      `"${name}" is reserved for the handles this library emits and cannot be used as a scope or leaf name`,
    );
  }
};

const composeKey = (path: Key, suffix: RelativeKey): Key =>
  suffix == null ? [...path] : [...path, ...suffix];

const buildContext = (
  baseKey: Key,
  schema: Record<string, unknown>,
  keyField: 'queryKey' | 'mutationKey',
  ctxField: 'contextQueries' | 'contextMutations',
): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  for (const name of Object.keys(schema)) {
    assertNotReserved(name);
    output[name] = buildLeaf([...baseKey, name], schema[name], keyField, ctxField);
  }
  return omitPrototype(output);
};

const buildConfig = (
  path: Key,
  config: Record<string, unknown>,
  keyField: 'queryKey' | 'mutationKey',
  ctxField: 'contextQueries' | 'contextMutations',
): Record<string, unknown> => {
  const { [keyField]: relativeKey, [ctxField]: context, ...rest } = config;
  const fullKey = composeKey(path, relativeKey as RelativeKey);
  const built: Record<string, unknown> = { ...rest, [keyField]: fullKey, _def: path };
  if (context != null) {
    built._ctx = buildContext(fullKey, context as Record<string, unknown>, keyField, ctxField);
  }
  return omitPrototype(built);
};

function buildLeaf(
  path: Key,
  value: unknown,
  keyField: 'queryKey' | 'mutationKey',
  ctxField: 'contextQueries' | 'contextMutations',
): unknown {
  if (value == null) {
    return omitPrototype({ [keyField]: path, _def: path });
  }

  if (isArray(value)) {
    return omitPrototype({ [keyField]: [...path, ...value], _def: path });
  }

  if (typeof value === 'function') {
    const callback = (...args: never[]) => {
      const result = (value as (...a: never[]) => unknown)(...args);
      return isArray(result)
        ? omitPrototype({ [keyField]: [...path, ...result], _def: path })
        : buildConfig(path, result as Record<string, unknown>, keyField, ctxField);
    };
    return Object.assign(callback, { _def: path });
  }

  return buildConfig(path, value as Record<string, unknown>, keyField, ctxField);
}

const buildGroup = (
  scope: string,
  schema: Record<string, unknown>,
  keyField: 'queryKey' | 'mutationKey',
  ctxField: 'contextQueries' | 'contextMutations',
): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  for (const leaf of Object.keys(schema)) {
    assertNotReserved(leaf);
    output[leaf] = buildLeaf([scope, leaf], schema[leaf], keyField, ctxField);
  }
  output._def = [scope];
  return omitPrototype(output);
};

/* -------------------------------------------------------------------------- */
/*                                 Public API                                  */
/* -------------------------------------------------------------------------- */

/**
 * Define a hierarchical group of query keys under a single `scope`.
 * Leaves emit native-v5-shaped (`DataTag`-branded) query options, support
 * nested `contextQueries` (`_ctx`), and expose a `_def` handle at every level
 * for scoped/partial-key invalidation.
 */
export function createQueryKeys<Scope extends string>(scope: Scope): DefHandle<readonly [Scope]>;
export function createQueryKeys<Scope extends string, S extends QuerySchema>(
  scope: Scope,
  schema: S,
): QueryKeysOutput<Scope, S>;
export function createQueryKeys(scope: string, schema?: QuerySchema): unknown {
  if (schema == null) {
    return omitPrototype({ _def: [scope] });
  }
  return buildGroup(scope, schema, 'queryKey', 'contextQueries');
}

/**
 * Define a hierarchical group of mutation keys. Mirrors `createQueryKeys` but
 * emits `mutationKey`/`mutationFn` and supports nested `contextMutations`.
 */
export function createMutationKeys<Scope extends string>(scope: Scope): DefHandle<readonly [Scope]>;
export function createMutationKeys<Scope extends string, S extends MutationSchema>(
  scope: Scope,
  schema: S,
): MutationKeysOutput<Scope, S>;
export function createMutationKeys(scope: string, schema?: MutationSchema): unknown {
  if (schema == null) {
    return omitPrototype({ _def: [scope] });
  }
  return buildGroup(scope, schema, 'mutationKey', 'contextMutations');
}

/**
 * Merge feature-colocated query/mutation groups into one store object.
 * Throws on duplicate scope names — two groups sharing a scope is almost
 * certainly a bug, and silently keeping one of them would corrupt the store.
 */
export function mergeQueryKeys<Groups extends ReadonlyArray<DefHandle<readonly [string]>>>(
  ...groups: Groups
): { [G in Groups[number] as G['_def'][0]]: G } {
  const output: Record<string, unknown> = Object.create(null);
  for (const group of groups) {
    const scope = group._def[0] as string;
    if (scope in output) {
      throw new Error(`Duplicate scope "${scope}" passed to mergeQueryKeys`);
    }
    output[scope] = group;
  }
  return output as never;
}

/** Define the whole store in one object. Scopes with `null` are key-only. */
export function createQueryStore<S extends StoreSchema>(schema: S): StoreOutput<S> {
  const output: Record<string, unknown> = {};
  for (const scope of Object.keys(schema)) {
    assertNotReserved(scope);
    const leaves = schema[scope];
    output[scope] = leaves ? createQueryKeys(scope, leaves) : createQueryKeys(scope);
  }
  return omitPrototype(output) as StoreOutput<S>;
}

/* -------------------------------------------------------------------------- */
/*                             Inference helpers                              */
/* -------------------------------------------------------------------------- */

type Prettify<T> = { [K in keyof T]: T[K] } & {};

/** Infer the key structure of a single `createQueryKeys`/`createMutationKeys` group. */
export type inferQueryKeys<Group> = Prettify<Group>;

/** Infer the key structure of a whole store. */
export type inferQueryKeyStore<Store> = { [Scope in keyof Store]: Prettify<Store[Scope]> };

type LooseOptions = { queryKey: Key; queryFn: AnyFetcher };
type LooseOptionsGenerator = (...args: never[]) => LooseOptions;

/**
 * Turn a factory entry (static options or a dynamic generator) into a fully
 * typed `UseQueryOptions`, inferring the data type from its `queryFn`.
 */
export type TypedUseQueryOptions<
  Options extends LooseOptions | LooseOptionsGenerator,
  Data = Options extends LooseOptionsGenerator
    ? Awaited<ReturnType<ReturnType<Options>['queryFn']>>
    : Options extends LooseOptions
      ? Awaited<ReturnType<Options['queryFn']>>
      : never,
> = Options extends LooseOptionsGenerator
  ? UseQueryOptions<
      Awaited<ReturnType<ReturnType<Options>['queryFn']>>,
      DefaultError,
      Data,
      ReturnType<Options>['queryKey']
    >
  : Options extends LooseOptions
    ? UseQueryOptions<
        Awaited<ReturnType<Options['queryFn']>>,
        DefaultError,
        Data,
        Options['queryKey']
      >
    : never;

export type {
  MutationKeysOutput,
  MutationLeafConfig,
  QueryKeysOutput,
  QueryLeafConfig,
  StoreOutput,
};
