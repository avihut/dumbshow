# dumbshow

A semantic-animation composer. A **language pack** defines what exists
(entities), what can be said about it (verbs and events), and what happenings
look like (acts, scene state, drawing). dumbshow provides everything around
that meaning: the document model, a deterministic event-sourced player, a
full visual editor (timeline, catalog, canvas, shell, attributes), paired
viewers, and offline exports (PNG, GIF, webm, compiled scripts).

The name is the old theatre term: a *dumbshow* is the story acted out without
words — which is exactly what a pack's scenes do.

## Status

Pre-release. The machinery was built and hardened inside the
[daft](https://github.com/avihut/daft) documentation composer behind a
language-pack seam with a full characterization test net, and now lives
here. The first release is `0.1.0` on npm as `@avihut/dumbshow`.

- `src/` — the package: the language contract, engine, render core,
  transcript, the editor and its document model, and the exports.
- `harness/` — a small dev app mounting the editor with the **boxes**
  reference pack: the second language that keeps the pack interface honest
  (`mise run dev`).

## Using it

```sh
pnpm add @avihut/dumbshow vue
```

```ts
import { /* editor, engine, language types */ } from "@avihut/dumbshow";
import "@avihut/dumbshow/style.css";
```

A language pack implements the `DiagramLanguage` contract — the op registry,
world model, seed semantics, scene hooks (apply + draw), entity semantics,
and optionally a shell grammar. The daft pack in the daft repository is the
reference production pack; `harness/boxes-pack.ts` here is the minimal one.

## Developing

Requires [mise](https://mise.jdx.dev) (or match the tool versions in
`mise.toml` by hand).

```sh
mise run dev        # harness dev app
mise run build      # typecheck + library build to dist/
mise run test       # test suite
mise run lint       # biome check
mise run format     # biome write
mise run typecheck  # vue-tsc, no emit
```

## License

[FSL-1.1-MIT](./LICENSE.md) — the Functional Source License. You may use,
copy, modify, and redistribute dumbshow for any purpose other than a
competing use, and each release becomes MIT two years after it ships.
Contributions require a DCO sign-off (see
[CONTRIBUTING.md](./CONTRIBUTING.md)).
