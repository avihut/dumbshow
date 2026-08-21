# CLAUDE.md

dumbshow is a semantic-animation composer: a **language pack** owns meaning
(entities, ops, acts, scene state, drawing), and this workspace owns
everything around it, split by framework into two published packages plus
two private projects:

- `packages/core` → **`@dumbshow/core`**, framework-free: `src/language.ts`
  is the whole pack contract; `src/engine.ts` the timeline compiler +
  headless player; `src/render-core.ts` the replay cursor, camera math, and
  canvas attachment; `src/transcript.ts` the shell projection;
  `src/editor/` the editor's document model (doc, derive, mutations,
  storage, vocabulary, drag mechanics, the editor-level types) and
  `editor.css`, the editor chrome stylesheet every framework's editor
  shares (shipped as `@dumbshow/core/style.css`); `src/export/` the
  exporters.
- `packages/vue` → **`@dumbshow/vue`**: the editor UI — `ComposerApp` and
  its panes — over `@dumbshow/core` and `vue`, both peers. A React (or
  other) editor would be a sibling package of the same shape; there is no
  umbrella package and the core never re-exports a framework.
- `packages/boxes` → `@dumbshow/boxes`, private: the **boxes** reference
  pack, the second consumer that keeps the contract honest (it owns a seed of
  `{ boxes, links }` and placements of `{ boxes }`, so document parsing, node
  drags, and every marker hook are exercised there too). Shared by the test
  suite and the harness apps.
- `apps/harness-vue`: the Vue editor mounted with boxes (`mise run dev`).

The production pack lives in its own host repo, which also carries the
Playwright/golden test net that pins this machinery's behavior; do not break
parity casually.

## Workspace mechanics

- **Names resolve to sources everywhere but the build.** `tsconfig.json`
  `paths`, `vitest.config.ts`, and the harness's `vite.config.ts` all map
  `@dumbshow/core|vue|boxes` (and `@dumbshow/core/style.css`) to `src/`
  through one definition, `workspace-aliases.ts` — typecheck, tests, and
  the dev app never need a build. Each package's `tsconfig.build.json`
  clears `paths` so emitted declarations reference the published names;
  `pnpm -r build` orders core before vue (vue devDepends on core) and vue's
  declaration build reads core's `dist/`.
- **One version.** The two public packages are a changesets `fixed` group:
  name the package(s) a change touches in the changeset and both bump
  together. `@dumbshow/boxes` and the harness are private and never
  versioned, tagged, or published (`privatePackages` in
  `.changeset/config.json`).
- **The core stays framework-free.** Its bundle may not import vue (the
  build job greps for it), its sources may not import any UI framework,
  and anything an editor needs that is not a component — selections, host
  chrome shapes, the dnd state container — lives in core so every
  framework's editor shares it.
- **The stylesheet entry.** Vite's library mode refuses a bare CSS entry,
  so `packages/core/src/style.ts` exists only to carry `editor.css` into
  `dist/style.css`; the build drops the empty `style.js` and the
  declaration build excludes the file. `index.js` never imports the CSS —
  hosts import `@dumbshow/core/style.css` themselves.
- **Peers through the workspace protocol.** `@dumbshow/vue` declares
  `@dumbshow/core` as `workspace:^` (peer) and `workspace:*` (dev); pnpm
  rewrites both at pack time and the build job asserts no `workspace:`
  survives in a tarball.

## Hard rules (proven by the production host's test net)

- **The seam is imports.** Nothing under `packages/core/src/` or
  `packages/vue/src/` may name a pack concept or import a host (the
  vitepress coupling was cut on extraction — keep it out), and nothing under
  `packages/core/src/` may import a UI framework at all. Meaning arrives
  only through the injected `DiagramLanguage`; pack components (the
  inspector) arrive as props, never imports. When the contract grows a
  hook, extend `packages/boxes/src/index.ts` in the same change — the boxes
  pack implementing every hook is the honesty check.
- **One document, no modes.** A document is `{ seed, timeline, placements }`
  (`packages/core/src/editor/doc.ts`, versioned — **v2**). The seed renders as
  scene only; placements are authoring data, never timeline events; a still is
  a document whose timeline never played.
- **The seed and the placements belong to the pack** (format v2). They are
  pack-defined JSON: core stores, serializes, and migrates them without
  reading their shape, and hands them to the pack through
  `seed.empty/parse/world/step` and
  `placements.empty/parse/patchStep/fromCompiled`. They cross document-version
  bumps VERBATIM — a pack that evolves its own schema versions it inside its
  own JSON. That is what made v1 → v2 a no-op for the data: v1's seed and
  placements already held the writing pack's shape and nobody else's, so only
  ownership moved. What follows from it: `emptyDoc(lang)` and
  `parseDoc(json, lang)` take the pack (`DocSchema`, which any
  `DiagramLanguage` satisfies structurally); a pack's parse error surfaces as
  the document's own parse failure; core offers no key-level helper for
  either half, only `setSeed` and `setPlacements`, which replace the whole
  value (a pack that pins geometry computes the next value itself — the
  freeze-before-rename merge is the pack's, not core's); and `seed.step()`
  returning null is how a pack says its seed declares nothing, so the story
  has no opening frame. A version bump must also carry the localStorage
  draft: `loadDraft` reads the previous version's slot once, migrates it,
  re-saves, and retires the old key — the slot is the author's only copy
  between sessions.
- **Everything derives.** `editor/derive.ts` (core) is the one road from document
  to playable steps; broken ops skip cleanly (`mapping` -1). Never build
  steps for the editor another way.
- **Mutations are pure** (`editor/mutations.ts` in core, doc in, doc out). The app
  swaps a shallowRef wholesale; mutations must receive plain objects, never
  deep-reactive proxies.
- **Rebuild, never remount; never autoplay.** Every content edit recreates
  the player (autoplay off) and lands settled + paused on the affected step;
  the DOM stays put — panes re-attach through the player prop.
- **Players are headless; viewers derive.** The player owns the clock only.
  Anything visual subscribes and replays from scratch when time moves
  backward. A viewer must never run its own timers.
- **The transcript is a projection.** Shell lines re-render from step args —
  keystrokes are never stored. The editor dims silent lines; only viewers
  and exports omit them.
- **Drag-and-drop law.** What a canvas drop MEANS belongs to the pack
  (`entities.canvasDrop`); rows reorder on the timeline; a canvas-entity
  drag has no timeline meaning. A node drag previews LIVE: each pointer
  move (coalesced to animation frames) applies the drop's own mutation to
  the base document as a preview — never persisted, `derived` prefers it —
  rebuilt with the base cameras (`withCamsOf`, so the frame never slides
  under the pointer) at the playhead's clock; release commits once,
  Escape/cancel restores the base. Drop targets resolve against the hits
  captured at press time (the preview moves the node under the pointer).
  Canvas edits keep the playhead; node drags show no DOM ghost.
- **Pointer affordances are pack-painted, editor-driven.** The stage sets
  `data-hover` / `data-dragging` on `.dx-canvas-wrap` (the cursor lives in
  core's editor.css) and composes the pack's `selectionOverlay`, `hoverOverlay`,
  and `dragOverlay` markers into one overlay per frame — all identity-based:
  a marker finds its entity in each frame's hits. `entities.draggable(hit)`
  makes a hit tap-only (edges that select but never move).
- **Exports never lie** (`packages/core/src/export/`). The offline renderer replays
  compiled events through the same `drawScene` as the live view; reduced
  motion is hard-coded OFF there. PNG = 2x transparent still; GIF composites
  onto a background, 12fps default, longest edge capped 900px; webm records
  real time and is offered only where MediaRecorder exists. Known nuance:
  detached canvases use grayscale text antialiasing — correct for portable
  files, don't "fix" it.
- **Host chrome is props.** `ComposerApp` takes `back`, `isDark` as a
  v-model (`v-model:isDark="dark"` — a boolean the host owns; absent = no
  toggle; the toggle emits `update:isDark` and the host flips its own
  class), `devHandle` (window player handle — hosts gate it on their own
  dev mode), and `fileTag` (draft key + `<slug>.<tag>.json` suffix; default
  "dumbshow"). Add host concerns as props with defaults, never as imports.
  The shapes those props take (`BackLink`, `ExportEntry`, the selection
  types) are `@dumbshow/core` exports so packs type against them without
  the framework.
- **The layout is locked** (settled in a design round with the production
  host — do not rearrange): LEFT the timeline over the docked catalog, each with a
  minimize chevron and edge-flap restore, both-minimized (or the direct
  control) collapsing the sidepane; CENTER canvas over the shell; RIGHT the
  host's inspector over the always-visible attributes form; BOTTOM the
  player bar only, hidden by the toolbar's Scrubber toggle.

## Theming contract (v1)

`packages/core/src/editor/editor.css` (shipped as `@dumbshow/core/style.css`)
resolves every color, font, and tone through ONE public token set, all
`--dx-` prefixed, and ships a default for each — a host that declares nothing
still gets a coherent editor in both themes.

| Token | Light | Dark |
| --- | --- | --- |
| `--dx-bg` | `#ffffff` | `#1b1b1f` |
| `--dx-bg-soft` | `#f6f6f7` | `#202127` |
| `--dx-divider` | `#e2e2e3` | `#2e2e32` |
| `--dx-text-1` | `#3c3c43` | `#dfdfd6` |
| `--dx-text-2` | `#67676c` | `#98989f` |
| `--dx-text-3` | `#929295` | `#6a6a71` |
| `--dx-font` | `ui-sans-serif, system-ui, sans-serif` | — |
| `--dx-font-mono` | `ui-monospace, "SF Mono", Menlo, monospace` | — |
| `--dx-accent` | `#bd8c26` | `#d1a54a` |
| `--dx-accent-text` | `#9a7115` | `#e0b866` |
| `--dx-warn` | `#c75c1e` | `#d9752f` |
| `--dx-warn-text` | `#b14e14` | `#e08a4a` |
| `--dx-teal` / `--dx-purple` | `#1b9aaa` / `#8a63d2` | — |
| `--dx-teal-text` | `#0e7280` | `#3fbccb` |
| `--dx-purple-text` | `#6d48c0` | `#ab8ce4` |
| `--dx-sel` | `color-mix(in srgb, var(--dx-accent) 12%, var(--dx-bg))` | — |

Four rules make that work, and none of them is incidental:

- **Defaults sit behind `:where(html)` / `:where(html.dark)`** — specificity
  ZERO. Any host declaration (`:root { … }`, specificity 0,0,1) wins no
  matter which stylesheet loads first. Defaults scoped to `.dx-app` would
  instead defeat a host's `:root` override.
- **Both default blocks are specificity 0, so source order decides between
  them**: the dark block must stay AFTER the light one in the file.
- **The tokens land on `<html>` itself**, so a pack's `readPalette()` can
  read them off `document.documentElement` — which is how packs actually
  read a theme.
- **`--dx-sel` stays an expression, not a literal**, so a host that overrides
  only `--dx-accent` still gets a matching selection tint.

Dark styling keys off a `dark` class on `<html>` (keep that convention). A
host that overrides a token owns it in BOTH themes — its declaration outranks
the dark default too. `apps/harness-vue/index.html` overrides exactly the
accent pair and lets the rest fall through, so the harness proves the
defaults and the override path at once.

## Toolchain

pnpm workspace via mise (`mise run dev|build|test|lint|format|typecheck|changeset|ci`;
`ci` runs exactly what the PR checks run). Tooling lives in the root
`package.json` — packages declare only what they ship (core: `gifenc`;
vue: its peers) — and devDeps are EXACT pins under a
7-day cooldown that is enforced, not just practiced: `pnpm-workspace.yaml`
sets `minimumReleaseAge: 10080` (strict — an exact pin on a too-young
release fails resolution instead of falling back) and Dependabot waits the
same 7 days before proposing a bump. `typescript` stays on the 6.x line (the last
JS-based one) on purpose: TypeScript 7 is the native compiler without the
programmatic API `vue-tsc` drives (typecheck and d.ts emit), so Dependabot
ignores `typescript >= 7` (`.github/dependabot.yml`) while 6.x minors keep
flowing; lift that the moment `vue-tsc` supports TS 7 — expected after TS
7.1's stable API — and bump both together. `vue-tsc --noEmit` at the root is
the only real typechecker and covers every package, app, and test (vite and
esbuild never typecheck); declarations are emitted per package after vite —
`tsc` for core, `vue-tsc` for vue; declarations first would lose their d.ts
to vite's emptyOutDir. Biome: the Vue domain is
active here (vue is a direct dep), and biome 2.5's Vue analysis cannot see
template usage — so `noUnusedImports`, `noUnusedVariables`, and
`useVueMultiWordComponentNames` are off for `*.vue` in `biome.json`;
re-enable when a Biome upgrade understands templates. The lint baseline is
ZERO diagnostics — keep it there; `tests/`, `apps/`, and every config file
are linted and typechecked too.

## Tests

`tests/*.test.ts` is the workspace suite (vitest, node environment,
`vitest.config.ts`): it imports `@dumbshow/core` and `@dumbshow/boxes` by
name — the aliases resolve them to sources — and covers the document model
(including v1 → v2 migration, proven verbatim against a stub pack whose
parsers are the identity), draft storage across a format bump, mutations,
derive, the engine compiler, the transcript, the catalog, and the boxes
pack's honesty (every optional hook implemented; both document schemas
parsed and rejected; every verb round-trips through its shell). Core behavior is tested through the
reference pack on purpose; there are no per-package test directories yet.
`tests/__snapshots__/boxes-board.golden.json` is a committed golden of a
scripted board derived + compiled — byte-for-byte timing, mapping, and step
shape. Update it with `pnpm vitest run -u` only deliberately and review the
diff like a contract change. The Playwright editor specs still run from the
production pack's host through its source link; porting the `editor.*`
groups onto the harness is the planned next step.

## CI, releases, and repository policy

**CI** (`.github/workflows/ci.yml`) runs on every PR and on master: `lint`,
`typecheck`, `build` (every package, then a tarball-shape check of both
published packages — `files`/`exports` drift, a source leak, a surviving
`workspace:` protocol, or vue in the core bundle fails there, not after a
publish), and `test`, each through the same `mise run` task a contributor
runs; plus `dco` (every human commit carries `Signed-off-by`; `*[bot]`
authors are exempt) and `changeset` (a PR that touches `packages/core/`,
`packages/vue/`, or the lockfile must add a `.changeset/*.md` — skipped for
the release bot's own PR, Dependabot, and the `skip-changeset` label). The master ruleset requires all
six by job name: rename a job here and the ruleset in the same change.

**Pull requests** follow `.claude/skills/open-pr/SKILL.md` — the repo's own
skill, which overrides the generic one. Two rules beyond the obvious: the
squash merge uses the PR title and body verbatim, so the body is written to be
read in `git log`; and **a change with visual expression carries before/after
images** — screenshots for a static change, a GIF when the point of the change
is that it moves. The "before" is captured from a throwaway
`daft start --fork <merge-base>` worktree (never in the `master` worktree, and
removed straight after), and images are published on the orphan `assets`
branch under `pr-<N>/`, which triggers no CI.

**Releases** are changesets-driven (`.changeset/`, `release.yml`):

1. Every user-facing change lands with a changeset (`pnpm changeset`; 0.x:
   a contract or document-format change is a minor bump, anything else a
   patch). Nothing bumps `package.json` by hand — ever.
2. On each push to master the release bot (the Wheatley GitHub App, via
   `changesets/action`) keeps a `chore: version packages` PR current: the
   lockstep version bump of both packages plus per-package `CHANGELOG.md`
   entries generated from the changesets
   (`@changesets/changelog-github` links each to its PR). CI runs on that
   PR because the App token opened it — PRs opened with `GITHUB_TOKEN`
   never trigger workflows.
3. Merging that PR is the release. The same workflow builds, publishes both
   packages with `pnpm publish` through npm trusted publishing (OIDC — no
   registry token exists anywhere, provenance is attested), creates one
   `<pkg>@<version>` tag per package through the GitHub API (the
   `release tags` ruleset covers `v*` and `@dumbshow/*` and lets only the
   App and the admin create one), and writes one GitHub Release per tag.

The publish step must run inside `release.yml` under that exact name: each
package's npm trusted-publisher record is `avihut/dumbshow` + `release.yml`,
and renaming the file breaks publishing until npm is updated on both.
`id-token: write` exists only in the publish job (the sub-actions are used
for that reason). `pnpm build` runs each package's build in dependency
order: core = `vite build` (ESM, gifenc bundled, `dist/style.css` from the
`style.ts` entry, exported as `./style.css`) then `tsc` declarations; vue =
`vite build` (vue and `@dumbshow/core` externalized) then `vue-tsc`
declarations. Downstream consumers pin the new versions themselves. License is FSL-1.1-MIT;
contributions need a DCO sign-off (`git commit -s`).

**Repository policy** — every setting is applied through `gh api` and the
payloads are recorded in the pipeline PR (#1) so it can be reproduced:
squash-only merges with the PR title/body as the commit, delete branch on
merge, auto-merge allowed, web commit sign-off required; rulesets on
`master` (PR-only, the six required checks, linear history, no force-push,
no deletion, bypass = admin + the release App) and on release tags — `v*`
and `@dumbshow/*` — (create, update, delete restricted to the same two); Actions policy requires
full-SHA pins (Dependabot moves the pins); Dependabot alerts + security
updates, private vulnerability reporting (`.github/SECURITY.md`), CodeQL
default setup, secret scanning + push protection.
