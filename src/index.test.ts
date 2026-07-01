import { describe, expect, it, vi } from 'vitest';

import { createMutationKeys, createQueryKeys, createQueryStore, mergeQueryKeys } from './index';

const noop = async () => undefined;

/* ========================================================================== */
/*                          createQueryKeys — basics                          */
/* ========================================================================== */

describe('createQueryKeys: shapes', () => {
  it('returns only a _def when no schema is given', () => {
    const users = createQueryKeys('users');
    expect(users._def).toEqual(['users']);
    expect(Object.keys(users)).toEqual(['_def']);
  });

  it('handles an empty schema (only _def, no leaves)', () => {
    const users = createQueryKeys('users', {});
    expect(users._def).toEqual(['users']);
    expect(Object.keys(users)).toEqual(['_def']);
  });

  it('null leaf → key-only with matching _def', () => {
    const users = createQueryKeys('users', { all: null });
    expect(users.all.queryKey).toEqual(['users', 'all']);
    expect(users.all._def).toEqual(['users', 'all']);
  });

  it('array leaf appends its segments to the key but not to _def', () => {
    const users = createQueryKeys('users', { byTeam: ['team', 42] });
    expect(users.byTeam.queryKey).toEqual(['users', 'byTeam', 'team', 42]);
    expect(users.byTeam._def).toEqual(['users', 'byTeam']);
  });

  it('empty array leaf behaves like a key-only leaf', () => {
    const users = createQueryKeys('users', { weird: [] });
    expect(users.weird.queryKey).toEqual(['users', 'weird']);
  });
});

/* ========================================================================== */
/*                       Edge cases: keys & key segments                      */
/* ========================================================================== */

describe('createQueryKeys: weird key segments', () => {
  it('preserves falsy-but-valid segments (0, empty string, false)', () => {
    const s = createQueryKeys('s', { f: [0, '', false] });
    expect(s.f.queryKey).toEqual(['s', 'f', 0, '', false]);
  });

  it('keeps object segments untouched (serializable variable keys)', () => {
    const filters = { status: 'open', page: 1 };
    const todos = createQueryKeys('todos', {
      list: (f: typeof filters) => ({ queryKey: [{ f }] as const, queryFn: noop }),
    });
    expect(todos.list(filters).queryKey).toEqual(['todos', 'list', { f: filters }]);
  });

  it('config with queryKey: null composes to just the leaf path', () => {
    const s = createQueryKeys('s', { x: { queryKey: null, queryFn: noop } });
    expect(s.x.queryKey).toEqual(['s', 'x']);
  });

  it('config with omitted queryKey behaves the same as queryKey: null', () => {
    const s = createQueryKeys('s', { x: { queryFn: noop } });
    expect(s.x.queryKey).toEqual(['s', 'x']);
  });

  it('throws when a leaf uses a reserved name (_def/_ctx)', () => {
    expect(() => createQueryKeys('s', { _def: null } as never)).toThrow(/reserved/);
    expect(() => createQueryKeys('s', { _ctx: null } as never)).toThrow(/reserved/);
  });

  it('throws when a contextQueries entry uses a reserved name', () => {
    expect(() =>
      createQueryKeys('s', {
        x: { queryKey: null, queryFn: noop, contextQueries: { _def: null } },
      } as never),
    ).toThrow(/reserved/);
  });

  it('throws lazily when a dynamic leaf builds a reserved contextQueries entry', () => {
    const s = createQueryKeys('s', {
      x: (id: string) => ({
        queryKey: [id] as const,
        queryFn: noop,
        contextQueries: { _ctx: null },
      }),
    } as never) as unknown as { x: (id: string) => unknown };
    expect(() => s.x('1')).toThrow(/reserved/);
  });
});

/* ========================================================================== */
/*                           Dynamic (function) leaves                        */
/* ========================================================================== */

describe('createQueryKeys: dynamic leaves', () => {
  it('dynamic returning an array composes the key with the args', () => {
    const users = createQueryKeys('users', { detail: (id: string) => [id] });
    expect(users.detail('7').queryKey).toEqual(['users', 'detail', '7']);
    expect(users.detail._def).toEqual(['users', 'detail']);
  });

  it('dynamic returning a config exposes queryKey + queryFn', () => {
    const users = createQueryKeys('users', {
      detail: (id: number) => ({ queryKey: [id] as const, queryFn: noop }),
    });
    const out = users.detail(9);
    expect(out.queryKey).toEqual(['users', 'detail', 9]);
    expect(typeof out.queryFn).toBe('function');
  });

  it('supports multiple args and zero args', () => {
    const s = createQueryKeys('s', {
      pair: (a: string, b: number) => [a, b],
      none: () => ['fixed'],
    });
    expect(s.pair('a', 2).queryKey).toEqual(['s', 'pair', 'a', 2]);
    expect(s.none().queryKey).toEqual(['s', 'none', 'fixed']);
  });

  it('the per-call _def is the partial key, not including the args', () => {
    const users = createQueryKeys('users', { detail: (id: string) => [id] });
    expect(users.detail('1')._def).toEqual(['users', 'detail']);
  });

  it('each call produces a fresh object/array — no shared mutation', () => {
    const users = createQueryKeys('users', { detail: (id: number) => [id] });
    const a = users.detail(1);
    const b = users.detail(2);
    expect(a.queryKey).not.toBe(b.queryKey);
    // mutating one result must not leak into the factory or other results
    expect(users.detail._def).toEqual(['users', 'detail']);
    expect(b.queryKey).toEqual(['users', 'detail', 2]);
  });

  it('queryFn from a dynamic leaf is callable and returns its value', async () => {
    const users = createQueryKeys('users', {
      detail: (id: string) => ({ queryKey: [id] as const, queryFn: () => Promise.resolve(id) }),
    });
    await expect(users.detail('z').queryFn()).resolves.toBe('z');
  });
});

/* ========================================================================== */
/*                       Colocated options pass-through                       */
/* ========================================================================== */

describe('createQueryKeys: arbitrary options', () => {
  it('passes through extra options and strips queryKey/contextQueries internals', () => {
    const select = vi.fn();
    const users = createQueryKeys('users', {
      list: { queryKey: null, queryFn: noop, staleTime: 1000, select, enabled: false },
    });
    expect(users.list.staleTime).toBe(1000);
    expect(users.list.select).toBe(select);
    expect(users.list.enabled).toBe(false);
    expect('contextQueries' in users.list).toBe(false);
    expect(users.list.queryKey).toEqual(['users', 'list']);
  });

  it('keeps infinite-query options on the output', () => {
    const getNextPageParam = vi.fn();
    const todos = createQueryKeys('todos', {
      feed: (f: string) => ({
        queryKey: [f] as const,
        queryFn: noop,
        initialPageParam: 0,
        getNextPageParam,
      }),
    });
    const out = todos.feed('x');
    expect(out.initialPageParam).toBe(0);
    expect(out.getNextPageParam).toBe(getNextPageParam);
  });
});

/* ========================================================================== */
/*                       contextQueries / _ctx nesting                        */
/* ========================================================================== */

describe('createQueryKeys: contextQueries', () => {
  it('builds nested _ctx keys based on the parent composed key', () => {
    const users = createQueryKeys('users', {
      detail: (id: string) => ({
        queryKey: [id] as const,
        queryFn: noop,
        contextQueries: {
          likes: { queryKey: null, queryFn: noop },
          comments: (page: number) => ({ queryKey: [page] as const, queryFn: noop }),
        },
      }),
    });
    const d = users.detail('1');
    expect(d.queryKey).toEqual(['users', 'detail', '1']);
    expect(d._ctx.likes.queryKey).toEqual(['users', 'detail', '1', 'likes']);
    expect(d._ctx.likes._def).toEqual(['users', 'detail', '1', 'likes']);
    expect(d._ctx.comments(3).queryKey).toEqual(['users', 'detail', '1', 'comments', 3]);
  });

  it('supports contextQueries on a key-only parent (no parent queryFn)', () => {
    const users = createQueryKeys('users', {
      detail: (id: string) => ({
        queryKey: [id] as const,
        contextQueries: { likes: { queryKey: null, queryFn: noop } },
      }),
    });
    const d = users.detail('1');
    expect('queryFn' in d).toBe(false);
    expect(d._ctx.likes.queryKey).toEqual(['users', 'detail', '1', 'likes']);
  });

  it('an empty contextQueries object yields an empty _ctx', () => {
    const users = createQueryKeys('users', {
      detail: (id: string) => ({ queryKey: [id] as const, queryFn: noop, contextQueries: {} }),
    });
    expect(users.detail('1')._ctx).toEqual({});
  });

  it('supports multi-level nesting at runtime', () => {
    const s = createQueryKeys('s', {
      a: {
        queryKey: null,
        queryFn: noop,
        contextQueries: {
          b: {
            queryKey: null,
            queryFn: noop,
            contextQueries: { c: { queryKey: null, queryFn: noop } },
          },
        },
      },
    });
    expect((s.a._ctx.b as { _ctx: { c: { queryKey: unknown } } })._ctx.c.queryKey).toEqual([
      's',
      'a',
      'b',
      'c',
    ]);
  });
});

/* ========================================================================== */
/*                           Prototype-less outputs                           */
/* ========================================================================== */

describe('omitPrototype behaviour', () => {
  it('group, leaf and dynamic results have a null prototype', () => {
    const users = createQueryKeys('users', {
      all: null,
      detail: (id: string) => ({ queryKey: [id] as const, queryFn: noop }),
    });
    expect(Object.getPrototypeOf(users)).toBeNull();
    expect(Object.getPrototypeOf(users.all)).toBeNull();
    expect(Object.getPrototypeOf(users.detail('1'))).toBeNull();
  });

  it('keys themselves are real arrays (not prototype-less)', () => {
    const users = createQueryKeys('users', { all: null });
    expect(Array.isArray(users.all.queryKey)).toBe(true);
    expect(Array.isArray(users.all._def)).toBe(true);
  });

  it('outputs remain spreadable into a query options object', () => {
    const users = createQueryKeys('users', {
      detail: (id: string) => ({ queryKey: [id] as const, queryFn: noop, staleTime: 5 }),
    });
    const spread = { ...users.detail('1') };
    expect(spread.queryKey).toEqual(['users', 'detail', '1']);
    expect(typeof spread.queryFn).toBe('function');
    expect(spread.staleTime).toBe(5);
  });
});

/* ========================================================================== */
/*                                mergeQueryKeys                              */
/* ========================================================================== */

describe('mergeQueryKeys', () => {
  it('merges groups under their scope names', () => {
    const users = createQueryKeys('users', { all: null });
    const todos = createQueryKeys('todos', { all: null });
    const store = mergeQueryKeys(users, todos);
    expect(store.users).toBe(users);
    expect(store.todos).toBe(todos);
    expect(Object.getPrototypeOf(store)).toBeNull();
  });

  it('merging an empty list yields an empty store', () => {
    expect(mergeQueryKeys()).toEqual({});
  });

  it('throws on a duplicated scope name instead of silently overwriting', () => {
    const a = createQueryKeys('dup', { x: null });
    const b = createQueryKeys('dup', { y: null });
    expect(() => mergeQueryKeys(a, b)).toThrow(/Duplicate scope "dup"/);
  });

  it('can merge query groups and mutation groups together', () => {
    const q = createQueryKeys('users', { all: null });
    const m = createMutationKeys('userActions', { delete: null });
    const store = mergeQueryKeys(q, m as never) as unknown as {
      users: { _def: unknown };
      userActions: { _def: unknown };
    };
    expect(store.users._def).toEqual(['users']);
    expect(store.userActions._def).toEqual(['userActions']);
  });
});

/* ========================================================================== */
/*                               createQueryStore                             */
/* ========================================================================== */

describe('createQueryStore', () => {
  it('builds every scope and supports null (key-only) scopes', () => {
    const store = createQueryStore({
      users: { all: null, detail: (id: string) => [id] },
      health: null,
    });
    expect(store.users.all.queryKey).toEqual(['users', 'all']);
    expect((store.users.detail as (id: string) => { queryKey: unknown })('1').queryKey).toEqual([
      'users',
      'detail',
      '1',
    ]);
    expect(store.health._def).toEqual(['health']);
  });

  it('throws when a scope uses a reserved name', () => {
    expect(() => createQueryStore({ _def: null } as never)).toThrow(/reserved/);
  });
});

/* ========================================================================== */
/*                              createMutationKeys                            */
/* ========================================================================== */

describe('createMutationKeys', () => {
  it('emits mutationKey/_def instead of queryKey', () => {
    const m = createMutationKeys('users', {
      delete: null,
      update: (id: string) => ({ mutationKey: [id] as const, mutationFn: noop }),
    });
    expect(m.delete.mutationKey).toEqual(['users', 'delete']);
    expect(m.update('7').mutationKey).toEqual(['users', 'update', '7']);
    expect(m.update._def).toEqual(['users', 'update']);
    expect(m._def).toEqual(['users']);
  });

  it('supports contextMutations → _ctx', () => {
    const m = createMutationKeys('users', {
      manage: (id: string) => ({
        mutationKey: [id] as const,
        contextMutations: { ban: { mutationKey: null, mutationFn: noop } },
      }),
    });
    expect(m.manage('1')._ctx.ban.mutationKey).toEqual(['users', 'manage', '1', 'ban']);
  });

  it('returns only a _def when no schema is given', () => {
    expect(createMutationKeys('users')._def).toEqual(['users']);
  });

  it('throws when a mutation leaf uses a reserved name', () => {
    expect(() => createMutationKeys('users', { _ctx: null } as never)).toThrow(/reserved/);
  });
});
