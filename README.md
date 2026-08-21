# dumbshow

[![CI](https://github.com/avihut/dumbshow/actions/workflows/ci.yml/badge.svg)](https://github.com/avihut/dumbshow/actions/workflows/ci.yml)
[![npm: @dumbshow/core](https://img.shields.io/npm/v/%40dumbshow%2Fcore?label=%40dumbshow%2Fcore)](https://www.npmjs.com/package/@dumbshow/core)
[![npm: @dumbshow/vue](https://img.shields.io/npm/v/%40dumbshow%2Fvue?label=%40dumbshow%2Fvue)](https://www.npmjs.com/package/@dumbshow/vue)
[![License: FSL-1.1-MIT](https://img.shields.io/badge/license-FSL--1.1--MIT-3b5bdb)](./LICENSE.md)

A semantic-animation composer. A **language pack** defines what exists
(entities), what can be said about it (verbs and events), and what happenings
look like (acts, scene state, drawing). dumbshow provides everything around
that meaning: the document model, a deterministic event-sourced player, a
full visual editor (timeline, catalog, canvas, shell, attributes), paired
viewers, and offline exports (PNG, GIF, webm, compiled scripts).

The name is the old theatre term: a *dumbshow* is the story acted out without
words — which is exactly what a pack's scenes do.

## Packages

One workspace, split by framework so the editor can exist for more than one:

| Package | What it is |
| --- | --- |
| [`@dumbshow/core`](./packages/core) | Framework-free: the `DiagramLanguage` contract, the engine and headless player, the render core, the transcript, the editor's document model and drag mechanics, the exporters, and the editor chrome stylesheet (`@dumbshow/core/style.css`). |
| [`@dumbshow/vue`](./packages/vue) | The Vue editor — `ComposerApp` and `AttributesForm` — with `@dumbshow/core` and `vue` as peers. |
| `@dumbshow/boxes` (private) | The **boxes** reference pack: the second language that keeps the contract honest; shared by the tests and the harness. |
| `apps/harness-vue` (private) | The Vue editor mounted with the boxes pack (`mise run dev`). |

The two public packages are released together and share one version.

## Status

Pre-release. The machinery was built and hardened inside the
[daft](https://github.com/avihut/daft) documentation composer behind a
language-pack seam with a full characterization test net, and now lives
here. Earlier releases shipped as a single package, `@avihut/dumbshow`
(deprecated in favor of the packages above).

## Using it

```sh
pnpm add @dumbshow/vue @dumbshow/core vue
```

```ts
import { compile, createPlayer, type DiagramLanguage } from "@dumbshow/core";
import "@dumbshow/core/style.css";
import { ComposerApp } from "@dumbshow/vue";
```

A language pack implements the `DiagramLanguage` contract — the op registry,
world model, seed semantics, scene hooks (apply + draw), entity semantics,
and optionally a shell grammar. The daft pack in the daft repository is the
reference production pack; `packages/boxes` here is the minimal one. Mount
the editor with a pack and its inspector component:

```ts
createApp(ComposerApp, { lang: MY_PACK, inspector: MyInspector }).mount("#app");
```

## Developing

Requires [mise](https://mise.jdx.dev) (or match the tool versions in
`mise.toml` by hand).

```sh
mise run dev        # the Vue harness app (apps/harness-vue)
mise run build      # every package to its dist/ (vite, then declarations)
mise run test       # the workspace vitest suite (tests/)
mise run lint       # biome check
mise run format     # biome write
mise run typecheck  # vue-tsc, no emit, over everything
mise run changeset  # declare a change and its semver bump
mise run ci         # everything the PR checks run
```

Typecheck, tests, and the harness resolve the package names to their
sources (`workspace-aliases.ts`), so only `build` produces `dist/`.

Changes ship through [changesets](./.changeset/README.md): a PR that changes
a published package adds a changeset, the release bot keeps a "Version
Packages" PR current, and merging that PR publishes both packages to npm
(trusted publishing, with provenance), tags them, and writes the GitHub
Releases. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[FSL-1.1-MIT](./LICENSE.md) — the Functional Source License. You may use,
copy, modify, and redistribute dumbshow for any purpose other than a
competing use, and each release becomes MIT two years after it ships.
Contributions require a DCO sign-off (see
[CONTRIBUTING.md](./CONTRIBUTING.md)).
