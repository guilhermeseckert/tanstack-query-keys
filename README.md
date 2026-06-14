# @guilhermeseckert/query-store

> Thin, type-safe **hierarchical query-key store** for **TanStack Query v5**.
> Emits native `queryOptions`-shaped (`DataTag`-branded) options, and gives every
> level a `_def` handle for **partial-key invalidation** — the one thing v5's
> built-in `queryOptions()` doesn't do for you.

TanStack Query v5 already solves colocation and typing with `queryOptions()`.
What it _doesn't_ give you is an organized **key hierarchy** with scoped
invalidation handles. This library adds exactly that — and nothing else.

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
npm install @guilhermeseckert/query-store
# peer: @tanstack/react-query >= 5
```

## Usage

### One store

```ts
import { createQueryStore } from '@guilhermeseckert/query-store';

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
import { createMutationKeys } from '@guilhermeseckert/query-store';

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
import type { inferQueryKeyStore, TypedUseQueryOptions } from '@guilhermeseckert/query-store';

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
