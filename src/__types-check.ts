/* Type-level verification. Excluded from the published build. */
import { QueryClient } from '@tanstack/react-query';

import {
  createMutationKeys,
  createQueryKeys,
  createQueryStore,
  type inferQueryKeyStore,
  mergeQueryKeys,
  type TypedUseQueryOptions,
} from './index';

type User = { id: string; name: string };
type Todo = { id: string; title: string };
type Page<T> = { items: T[]; nextCursor: number | null };

const api = {
  getUsers: async (): Promise<User[]> => [],
  getUser: async (_id: string): Promise<User> => ({ id: '1', name: 'a' }),
  getTodos: async (_p: number): Promise<Page<Todo>> => ({ items: [], nextCursor: null }),
};

const queries = createQueryStore({
  users: {
    all: null,
    list: {
      queryKey: null,
      queryFn: () => api.getUsers(),
      staleTime: 60_000,
    },
    detail: (id: string) => ({
      queryKey: [id] as const,
      queryFn: () => api.getUser(id),
    }),
  },
  todos: {
    infinite: (filter: string) => ({
      queryKey: [filter],
      queryFn: (ctx: { pageParam: number }) => api.getTodos(ctx.pageParam),
      initialPageParam: 0,
      getNextPageParam: (last: Page<Todo>) => last.nextCursor,
    }),
  },
});

const client = new QueryClient();

/* 1. Composed hierarchical keys ------------------------------------------- */
const k1: readonly ['users', 'all'] = queries.users.all.queryKey;
const k2: readonly ['users', 'detail', string] = queries.users.detail('x').queryKey;
void k1;
void k2;

/* 2. Partial-key `_def` handles for scoped invalidation ------------------- */
const scopeDef: readonly ['users'] = queries.users._def;
const leafDef: readonly ['users', 'detail'] = queries.users.detail._def;
client.invalidateQueries({ queryKey: queries.users._def }); // wipe everything user-related
client.invalidateQueries({ queryKey: queries.users.detail._def }); // wipe all details
void scopeDef;
void leafDef;

/* 3. DataTag branding → getQueryData is typed (issue #38/#40/#100) --------- */
const cachedUser = client.getQueryData(queries.users.detail('1').queryKey);
const _assertUser: User | undefined = cachedUser; // must be User, not unknown
void _assertUser;

const cachedUsers = client.getQueryData(queries.users.list.queryKey);
const _assertUsers: User[] | undefined = cachedUsers;
void _assertUsers;

/* 4. Arbitrary colocated options survive on the output -------------------- */
const _staleTime: number = queries.users.list.staleTime;
void _staleTime;

/* 5. Feature-colocated + merge path --------------------------------------- */
const usersGroup = createQueryKeys('users', { all: null });
const todosGroup = createQueryKeys('todos', { all: null });
const merged = mergeQueryKeys(usersGroup, todosGroup);
const _mergedKey: readonly ['users'] = merged.users._def;
void _mergedKey;

/* 6. contextQueries / `_ctx` nesting -------------------------------------- */
const withCtx = createQueryKeys('users', {
  detail: (id: string) => ({
    queryKey: [id] as const,
    queryFn: () => api.getUser(id),
    contextQueries: {
      likes: {
        queryKey: null,
        queryFn: () => api.getUsers(),
      },
      comments: (page: number) => ({
        queryKey: [page] as const,
        queryFn: () => api.getUsers(),
      }),
    },
  }),
});

const likesKey: readonly ['users', 'detail', string, 'likes'] =
  withCtx.detail('x')._ctx.likes.queryKey;
const commentsKey: readonly ['users', 'detail', string, 'comments', number] = withCtx
  .detail('x')
  ._ctx.comments(2).queryKey;
const ctxLeafDef: readonly ['users', 'detail', string, 'likes'] =
  withCtx.detail('x')._ctx.likes._def;
void likesKey;
void commentsKey;
void ctxLeafDef;

// _ctx leaf is also DataTag-branded → typed cache access
const cachedLikes = client.getQueryData(withCtx.detail('x')._ctx.likes.queryKey);
const _assertLikes: User[] | undefined = cachedLikes;
void _assertLikes;

/* 7. Mutation keys -------------------------------------------------------- */
const mutations = createMutationKeys('users', {
  update: (id: string) => ({
    mutationKey: [id] as const,
    mutationFn: (name: string) => api.getUser(name),
  }),
  delete: null,
});

const updateKey: readonly ['users', 'update', string] = mutations.update('x').mutationKey;
const deleteKey: readonly ['users', 'delete'] = mutations.delete.mutationKey;
const mutScopeDef: readonly ['users'] = mutations._def;
void updateKey;
void deleteKey;
void mutScopeDef;

/* 8. inferQueryKeyStore + TypedUseQueryOptions ---------------------------- */
type StoreKeys = inferQueryKeyStore<typeof queries>;

// default Data = queryFn result (User)
const _opts: TypedUseQueryOptions<typeof queries.users.detail> = {
  ...queries.users.detail('1'),
  enabled: true,
  select: (user) => user, // `user` is typed as User
};
void _opts;

// transform via `select` → pass the transformed Data type as the 2nd arg
const _optsTransformed: TypedUseQueryOptions<typeof queries.users.detail, string> = {
  ...queries.users.detail('1'),
  select: (user) => user.name, // User -> string
};
void _optsTransformed;
const _storeProbe: StoreKeys['users'] = queries.users;
void _storeProbe;
