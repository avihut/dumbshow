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

- `mise run ci` passes — lint, typecheck, build, test. The PR checks run
  exactly these tasks, so a red check names the task that fails locally.
- If the package changed (anything under `src/`, `package.json`, the
  lockfile, or the build/TypeScript config), add a changeset:

  ```sh
  pnpm changeset
  ```

  Answer the two prompts and commit the file it writes under `.changeset/`.
  Rule of thumb while dumbshow is 0.x: a change to the `DiagramLanguage`
  contract or the document format is a **minor** bump, anything else a
  **patch**. Write the summary for the CHANGELOG reader. The `changeset`
  check enforces this; a maintainer applies the `skip-changeset` label when
  nothing user-facing changed.
- Keep the language-pack seam honest: nothing in the generic machinery may
  name a concrete language's concepts. The reference `boxes` pack in
  `harness/` exists to prove the interface — if your change only works for
  one pack, it belongs in that pack. When you add a hook to the contract,
  implement it in the boxes pack in the same change.
- Conventional commit subjects (`feat:`, `fix:`, `docs:`, …); PRs are
  squash-merged with the PR title as the commit subject.
- Every GitHub Action reference stays pinned to a full commit SHA (the
  repository's Actions policy rejects anything else).

## How releases happen

You never bump the version. Merged changesets accumulate in a
`chore: version packages` pull request that the release bot keeps current;
a maintainer merging it publishes to npm through trusted publishing, tags
the release, and writes the GitHub Release. Your changeset summary is what
appears in the CHANGELOG and the release notes.

## License of contributions

By contributing you agree your contribution is licensed under
[FSL-1.1-MIT](./LICENSE.md), including the Future License grant that
converts each release to MIT two years after it ships.
