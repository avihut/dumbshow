# Changesets

This folder is how releases are declared. A *changeset* is a small markdown
file describing one change and the semver bump it deserves; the release
pipeline collects them into the "Version Packages" PR (version bump +
CHANGELOG.md), and merging that PR publishes.

```sh
pnpm changeset        # answer two prompts; commit the file it writes
```

Name the package(s) a change touches — `@dumbshow/core`, `@dumbshow/vue`,
or both; they are a `fixed` group and version together. Rules of thumb for
a 0.x package: a change to the `DiagramLanguage` contract or the document
format is a **minor** bump; anything else a **patch**. Write the summary for the CHANGELOG reader — what changed for a
consumer, not how.

Docs: https://github.com/changesets/changesets
