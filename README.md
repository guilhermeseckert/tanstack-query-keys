# tanstack-query-keys

<p align="center">
  <a href="https://www.npmjs.com/package/tanstack-query-keys"><img src="https://img.shields.io/npm/v/tanstack-query-keys?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://github.com/guilhermeseckert/tanstack-query-keys/actions/workflows/ci.yml"><img src="https://github.com/guilhermeseckert/tanstack-query-keys/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://bundlephobia.com/package/tanstack-query-keys"><img src="https://img.shields.io/bundlephobia/minzip/tanstack-query-keys" alt="Bundle size"></a>
  <a href="https://www.npmjs.com/package/tanstack-query-keys"><img src="https://img.shields.io/npm/types/tanstack-query-keys" alt="Types"></a>
  <a href="./LICENSE.md"><img src="https://img.shields.io/npm/l/tanstack-query-keys" alt="License"></a>
</p>

> **Type-safe query key factory & store for [TanStack Query](https://tanstack.com/query) v5 (React Query).**
> Organize your **query keys** in a typed hierarchy, emit native
> `queryOptions` / `infiniteQueryOptions`, and invalidate the cache by scope with
> `_def` handles — everything you need for clean **cache management** in React Query v5.

A modern, v5-first take on the **query-key-factory** pattern. TanStack Query v5
already solves colocation and typing with `queryOptions()`; what it _doesn't_
give you is an organized **key hierarchy** with scoped invalidation handles.
This library adds exactly that — with full `DataTag` typing and zero runtime deps.

```ts
queryClient.invalidateQueries({ queryKey: queries.users._def });        // everything user-related
queryClient.invalidateQueries({ queryKey: queries.users.detail._def }); // all user details
```

## Why

- ✅ **v5-native types.** Keys are branded with `DataTag`, so
  `queryClient.getQueryData(queries.users.detail(id).queryKey)` is fully typed —
  no `unknown`.
- ✅ **Colocate any option.** `staleTime`, `select`, `enabled`, `placeholderData`,
  `getNextPageParam`, … — anything `useQuery` / `useInfiniteQuery` accepts.
- ✅ **Infinite queries work.** Pass `initialPageParam` + `getNextPageParam`
  right in the definition.
- ✅ **Scoped `_def` handles** at every level for partial-key invalidation.
- ✅ **Contextual queries** (`contextQueries` → `_ctx`) for related sub-queries.
- ✅ **Mutation keys** (`createMutationKeys`) with the same ergonomics.
- ✅ **Inference helpers** — `inferQueryKeyStore`, `inferQueryKeys`,
  `TypedUseQueryOptions`.
- ✅ **Zero runtime deps.** Just plain key/options objects.

## Install

```bash
npm install tanstack-query-keys
# peer: @tanstack/react-query >= 5
```

## Usage

### One store

```ts
import { createQueryStore } from 'tanstack-query-keys';

export const queries = createQueryStore({
  users: {
    all: null,
    list: {
      queryKey: null,
      queryFn: () => api.getUsers(),
      staleTime: 60_000,
    },
    detail: (id: string) => ({
      queryKey: [id] as const, // `as const` → exact tuple key
      queryFn: () => api.getUser(id),
    }),
  },
  todos: {
    feed: (filter: string) => ({
      queryKey: [filter] as const,
      queryFn: (ctx: { pageParam: number }) => api.getTodos(ctx.pageParam),
      initialPageParam: 0,
      getNextPageParam: (last) => last.nextCursor,
    }),
  },
});
```

### Consume

```ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

useQuery(queries.users.detail(id));            // spread-free — it's already options
useInfiniteQuery(queries.todos.feed(filter));  // infinite options included

// typed cache access, no casts
const user = queryClient.getQueryData(queries.users.detail(id).queryKey); // User | undefined
```

### Feature-colocated (merge)

```ts
// queries/users.ts
export const users = createQueryKeys('users', { all: null, /* … */ });
// queries/todos.ts
export const todos = createQueryKeys('todos', { /* … */ });
// queries/index.ts
export const queries = mergeQueryKeys(users, todos);
```

### Contextual queries (`_ctx`)

Group sub-queries that depend on a parent context (e.g. a user's likes):

```ts
export const users = createQueryKeys('users', {
  detail: (id: string) => ({
    queryKey: [id] as const,
    queryFn: () => api.getUser(id),
    contextQueries: {
      likes: { queryKey: null, queryFn: () => api.getUserLikes(id) },
      comments: (page: number) => ({
        queryKey: [page] as const,
        queryFn: () => api.getUserComments(id, page),
      }),
    },
  }),
});

users.detail('1')._ctx.likes.queryKey;        // ['users','detail','1','likes']
users.detail('1')._ctx.comments(2).queryKey;  // ['users','detail','1','comments',2]
useQuery(users.detail('1')._ctx.likes);       // typed, ready to use
```

### Mutation keys

```ts
import { createMutationKeys } from 'tanstack-query-keys';

export const userMutations = createMutationKeys('users', {
  update: (id: string) => ({
    mutationKey: [id] as const,
    mutationFn: (patch: Partial<User>) => api.updateUser(id, patch),
  }),
  delete: null,
});

useMutation(userMutations.update(id));
userMutations.update._def; // ['users','update'] — handle for all update mutations
```

### Typed inference helpers

```ts
import type { inferQueryKeyStore, TypedUseQueryOptions } from 'tanstack-query-keys';

export type QueryKeys = inferQueryKeyStore<typeof queries>;

// Type a custom hook's options, inferring data from the factory's queryFn:
type DetailOptions = TypedUseQueryOptions<typeof queries.users.detail>;
// transform with `select`? pass the result type as the 2nd arg:
type Name = TypedUseQueryOptions<typeof queries.users.detail, string>;
```

## Key shape

```
createQueryStore({ users: { detail: (id) => ({ queryKey: [id] }) } })

queries.users._def              → ['users']
queries.users.detail._def       → ['users', 'detail']
queries.users.detail(7).queryKey→ ['users', 'detail', 7]
```

## Credit

The hierarchical-store + `_def` ergonomics are inspired by
[@lukemorales/query-key-factory](https://github.com/lukemorales/query-key-factory).
This is an independent, v5-first reimplementation built around native
`queryOptions`/`DataTag` typing.

## License

MIT
