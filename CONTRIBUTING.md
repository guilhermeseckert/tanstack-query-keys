# Contributing

Thanks for your interest in improving `tanstack-query-keys`! 🎉

## Getting started

This project uses [pnpm](https://pnpm.io) (v9+) and Node 20+.

```bash
pnpm install        # install dependencies
pnpm run check      # lint + typecheck + test (run this before pushing)
```

### Useful scripts

| Script | What it does |
| --- | --- |
| `pnpm run lint` | Biome lint + format check |
| `pnpm run lint:fix` | Auto-fix lint/format issues |
| `pnpm run typecheck` | `tsc --noEmit` (lib + type tests) |
| `pnpm run test` | Run the vitest suite once |
| `pnpm run test:watch` | Watch mode |
| `pnpm run test:coverage` | Tests with coverage |
| `pnpm run build` | Build `dist/` with tsup |

## Tests

Runtime behaviour lives in `src/index.test.ts`. Type-level guarantees live in
`src/__types-check.ts` (compiled by `tsc`, not executed). **Both must pass.**
When you change behaviour, add a test for it — including the weird edge cases.

## Submitting changes

1. Fork and create a branch.
2. Make your change with tests.
3. Run `pnpm run check`.
4. Add a changeset describing the change:
   ```bash
   pnpm changeset
   ```
5. Open a pull request.

## Releases

Releases are automated with [changesets](https://github.com/changesets/changesets).
Merging the auto-generated "release" PR publishes to npm — maintainers only.
