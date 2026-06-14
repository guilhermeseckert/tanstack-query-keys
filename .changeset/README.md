# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

When you make a change worth releasing, run:

```bash
pnpm changeset
```

Pick the bump type (patch / minor / major) and write a short summary. Commit the
generated markdown file alongside your change. On merge to `main`, the Release
workflow opens a versioning PR; merging that PR publishes to npm.
