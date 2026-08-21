<!-- Thanks for the change. A short summary of WHAT and WHY is enough; the diff says how. -->

## Summary

## Checklist

- [ ] Commits are signed off (`git commit -s`) — the DCO check enforces it
- [ ] A changeset is included if the package changed (`pnpm changeset`), or the
      `skip-changeset` label applies
- [ ] `mise run ci` passes locally (lint, typecheck, build, test)
- [ ] The language-pack seam holds: nothing under `src/` names a concrete
      language's concepts; `harness/boxes-pack.ts` implements any new hook
