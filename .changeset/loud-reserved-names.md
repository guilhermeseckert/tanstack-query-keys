---
'tanstack-query-keys': minor
---

Fail loudly on schema footguns instead of silently corrupting keys:

- `_def` and `_ctx` are now rejected as scope/leaf names — both at the type level (compile error) and at runtime (descriptive `Error`). Previously a leaf named `_def` was silently overwritten by the scope handle.
- `mergeQueryKeys` now throws on duplicate scope names instead of letting the last group win.
