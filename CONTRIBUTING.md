# Contributing to dumbshow

Thanks for wanting to help. Two ground rules keep the project sustainable:

## Sign your work (DCO)

Every commit must carry a `Signed-off-by` line certifying the
[Developer Certificate of Origin](https://developercertificate.org/):

```sh
git commit -s
```

The sign-off asserts you wrote the change (or have the right to submit it)
and that you understand it is contributed under the project's license,
including its delayed conversion to MIT. Because dumbshow is licensed under
FSL-1.1-MIT, the sign-off is what preserves the project's ability to keep
every release converting cleanly.

Unsigned commits cannot be merged.

## Before you open a PR

- `mise run lint`, `mise run typecheck`, and `mise run test` must pass.
- Keep the language-pack seam honest: nothing in the generic machinery may
  name a concrete language's concepts. The reference `boxes` pack in
  `harness/` exists to prove the interface — if your change only works for
  one pack, it belongs in that pack.
- Conventional commit subjects (`feat:`, `fix:`, `docs:`, …).

## License of contributions

By contributing you agree your contribution is licensed under
[FSL-1.1-MIT](./LICENSE.md), including the Future License grant that
converts each release to MIT two years after it ships.
