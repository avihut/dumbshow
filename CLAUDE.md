# CLAUDE.md

dumbshow is a semantic-animation composer: a **language pack** owns meaning
(entities, ops, acts, scene state, drawing), and this package owns everything
around it. `src/language.ts` is the whole pack contract; `src/engine.ts` the
timeline compiler + headless player; `src/render-core.ts` the replay cursor,
camera math, and canvas attachment; `src/transcript.ts` the shell projection;
`src/composer/` the editor (panes, document model, exports). `harness/` mounts
the editor with the **boxes** reference pack — the second consumer that keeps
the contract honest (boxes pin through `placements.repos`, so node drags and
every marker hook are exercised there too). The production pack (daft's) lives in the daft repo,
which also carries the Playwright/golden test net that pins this machinery's
behavior; do not break parity casually.

## Hard rules (proven by the daft test net)

- **The seam is imports.** Nothing under `src/` may name a pack concept or
  import a host framework (the vitepress coupling was cut on extraction —
  keep it out). Meaning arrives only through the injected `DiagramLanguage`;
  pack components (the inspector) arrive as props, never imports. When the
  contract grows a hook, extend `harness/boxes-pack.ts` in the same change —
  the boxes pack implementing every hook is the honesty check.
- **One document, no modes.** A document is `{ seed, timeline, placements }`
  (`composer/doc.ts`, versioned). The seed renders as scene only; placements
  are authoring data, never timeline events; a still is a document whose
  timeline never played. Format v1 deliberately carries the daft-shaped seed
  schema — a generic seed is a document-version bump owned here (the boxes
  pack keeps seeds empty until then).
- **Everything derives.** `composer/derive.ts` is the one road from document
  to playable steps; broken ops skip cleanly (`mapping` -1). Never build
  steps for the editor another way.
- **Mutations are pure** (`composer/mutations.ts`, doc in, doc out). The app
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
  composer.css) and composes the pack's `selectionOverlay`, `hoverOverlay`,
  and `dragOverlay` markers into one overlay per frame — all identity-based:
  a marker finds its entity in each frame's hits. `entities.draggable(hit)`
  makes a hit tap-only (edges that select but never move).
- **Exports never lie** (`composer/export/`). The offline renderer replays
  compiled events through the same `drawScene` as the live view; reduced
  motion is hard-coded OFF there. PNG = 2x transparent still; GIF composites
  onto a background, 12fps default, longest edge capped 900px; webm records
  real time and is offered only where MediaRecorder exists. Known nuance:
  detached canvases use grayscale text antialiasing — correct for portable
  files, don't "fix" it.
- **Host chrome is props.** `ComposerApp` takes `back`, `isDark` (a writable
  ref — hosts must pass the ref itself, e.g. bound as a property access so
  Vue's template unwrapping doesn't collapse it to a boolean), `devHandle`
  (window player handle — hosts gate it on their own dev mode), and
  `fileTag` (draft key + `<slug>.<tag>.json` suffix; default "dumbshow").
  Add host concerns as props with defaults, never as imports.
- **The layout is locked** (settled in a design round with the daft docs —
  do not rearrange): LEFT the timeline over the docked catalog, each with a
  minimize chevron and edge-flap restore, both-minimized (or the direct
  control) collapsing the sidepane; CENTER canvas over the shell; RIGHT the
  host's inspector over the always-visible attributes form; BOTTOM the
  player bar only, hidden by the toolbar's Scrubber toggle.

## Theming contract (v0)

`composer.css` reads these host tokens: `--vp-c-bg`, `--vp-c-bg-soft`,
`--vp-c-divider`, `--vp-c-text-1/2/3`, `--vp-font-family-base/mono`,
`--daft-gold`, `--daft-gold-text`, `--daft-rust`, `--daft-rust-text`; dark
styling keys off a `dark` class on `<html>`. The names are inherited from
the daft docs host and renaming them to a dumbshow-owned prefix (with
fallbacks) is a planned follow-up coordinated with that host —
`harness/index.html` documents the set by defining it.

## Toolchain

pnpm via mise (`mise run dev|build|test|lint|format|typecheck|changeset|ci`;
`ci` runs exactly what the PR checks run). devDeps are EXACT pins under a
7-day cooldown that is enforced, not just practiced: `pnpm-workspace.yaml`
sets `minimumReleaseAge: 10080` (strict — an exact pin on a too-young
release fails resolution instead of falling back) and Dependabot waits the
same 7 days before proposing a bump. `typescript` stays on the 6.x line (the last
JS-based one) on purpose: TypeScript 7 is the native compiler without the
programmatic API `vue-tsc` drives (typecheck and d.ts emit), so Dependabot
ignores `typescript >= 7` (`.github/dependabot.yml`) while 6.x minors keep
flowing; lift that the moment `vue-tsc` supports TS 7 — expected after TS
7.1's stable API — and bump both together. `vue-tsc` is the only real typechecker
(vite and esbuild never typecheck; the build runs it after vite — vue-tsc
first would lose its d.ts to vite's emptyOutDir). Biome: the Vue domain is
active here (vue is a direct dep), and biome 2.5's Vue analysis cannot see
template usage — so `noUnusedImports`, `noUnusedVariables`, and
`useVueMultiWordComponentNames` are off for `*.vue` in `biome.json`;
re-enable when a Biome upgrade understands templates. The lint baseline is
ZERO diagnostics — keep it there; `tests/` is linted and typechecked too.

## Tests

`tests/*.test.ts` (vitest, node environment, `vitest.config.ts` — the vite
config roots the dev server at `harness/` and suits neither discovery nor
the node environment) cover the document model, mutations, derive, the
engine compiler, the transcript, the catalog, and the boxes pack's honesty
(every optional hook implemented; every verb round-trips through its shell).
`tests/__snapshots__/boxes-board.golden.json` is a committed golden of a
scripted board derived + compiled — byte-for-byte timing, mapping, and step
shape. Update it with `pnpm vitest run -u` only deliberately and review the
diff like a contract change. The Playwright editor specs still run from the
production pack's host through its source link; porting the `editor.*`
groups onto the harness is the planned next step.

## CI, releases, and repository policy

**CI** (`.github/workflows/ci.yml`) runs on every PR and on master: `lint`,
`typecheck`, `build` (plus a tarball-shape check — `files`/`exports` drift or
a source leak fails there, not after a publish), and `test`, each through
the same `mise run` task a contributor runs; plus `dco` (every human commit
carries `Signed-off-by`; `*[bot]` authors are exempt) and `changeset` (a PR
that touches `src/`, `package.json`, the lockfile, or the build/TS config
must add a `.changeset/*.md` — skipped for the release bot's own PR,
Dependabot, and the `skip-changeset` label). The master ruleset requires all
six by job name: rename a job here and the ruleset in the same change.

**Releases** are changesets-driven (`.changeset/`, `release.yml`):

1. Every user-facing change lands with a changeset (`pnpm changeset`; 0.x:
   a contract or document-format change is a minor bump, anything else a
   patch). Nothing bumps `package.json` by hand — ever.
2. On each push to master the release bot (the Wheatley GitHub App, via
   `changesets/action`) keeps a `chore: version packages` PR current: the
   version bump plus `CHANGELOG.md` entries generated from the changesets
   (`@changesets/changelog-github` links each to its PR). CI runs on that
   PR because the App token opened it — PRs opened with `GITHUB_TOKEN`
   never trigger workflows.
3. Merging that PR is the release. The same workflow builds, publishes with
   `pnpm publish` through npm trusted publishing (OIDC — no registry token
   exists anywhere, provenance is attested), creates the `vX.Y.Z` tag
   through the GitHub API (the `release tags` ruleset lets only the App and
   the admin create one), and writes the GitHub Release.

The publish step must run inside `release.yml` under that exact name: npm's
trusted-publisher record is `avihut/dumbshow` + `release.yml`, and renaming
the file breaks publishing until npm is updated. `id-token: write` exists
only in the publish job (the sub-actions are used for that reason). `pnpm
build` produces `dist/` (ESM, vue externalized, gifenc bundled, d.ts via
vue-tsc, `dist/dumbshow.css` exported as `./style.css`). Downstream
consumers pin the new version themselves. License is FSL-1.1-MIT;
contributions need a DCO sign-off (`git commit -s`).

**Repository policy** — every setting is applied through `gh api` and the
payloads are recorded in the pipeline PR (#1) so it can be reproduced:
squash-only merges with the PR title/body as the commit, delete branch on
merge, auto-merge allowed, web commit sign-off required; rulesets on
`master` (PR-only, the six required checks, linear history, no force-push,
no deletion, bypass = admin + the release App) and on `v*` tags (create,
update, delete restricted to the same two); Actions policy requires
full-SHA pins (Dependabot moves the pins); Dependabot alerts + security
updates, private vulnerability reporting (`.github/SECURITY.md`), CodeQL
default setup, secret scanning + push protection.
