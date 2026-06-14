# tanstack-query-keys

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
