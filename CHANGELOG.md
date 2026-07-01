# tanstack-query-keys

## 0.2.0

### Minor Changes

- [`0591644`](https://github.com/guilhermeseckert/tanstack-query-keys/commit/0591644d5e5f815ad2cbd9e74a704283a76c3b32) Thanks [@guilhermeseckert](https://github.com/guilhermeseckert)! - Fail loudly on schema footguns instead of silently corrupting keys:

  - `_def` and `_ctx` are now rejected as scope/leaf names — both at the type level (compile error) and at runtime (descriptive `Error`). Previously a leaf named `_def` was silently overwritten by the scope handle.
  - `mergeQueryKeys` now throws on duplicate scope names instead of letting the last group win.

## 0.1.2

### Patch Changes

- Docs: remove emoji from README.

## 0.1.1

### Patch Changes

- Docs: switch the size badge to a registry-direct `unpacked-size` badge (avoids bundlephobia/packagephobia indexing lag), plus README polish.

## 0.1.0

### Minor Changes

- Initial release.
  - `createQueryKeys`, `createQueryStore`, `mergeQueryKeys`
  - `createMutationKeys` with `contextMutations` → `_ctx`
  - `contextQueries` → `_ctx` nested contextual queries
  - `DataTag`-branded keys (typed `getQueryData` / `setQueryData`)
  - Scoped `_def` handles for partial-key invalidation at every level
  - Native v5 query options, including infinite-query options
  - Inference helpers: `inferQueryKeys`, `inferQueryKeyStore`, `TypedUseQueryOptions`
