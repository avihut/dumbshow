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

pnpm via mise (`mise run dev|build|test|lint|format|typecheck`). devDeps are
EXACT pins under a 7-day cooldown discipline — bump deliberately, never to a
release younger than a week. `vue-tsc` is the only real typechecker (vite
and esbuild never typecheck; the build runs it first). Biome: the Vue domain
is active here (vue is a direct dep), and biome 2.5's Vue analysis cannot
see template usage — so `noUnusedImports`, `noUnusedVariables`, and
`useVueMultiWordComponentNames` are off for `*.vue` in `biome.json`;
re-enable when a Biome upgrade understands templates. The lint baseline is
ZERO diagnostics — keep it there.

## Publishing

`@avihut/dumbshow`, published under the npm org `avihut` (`publishConfig`
already sets public access). `pnpm build` produces `dist/` (ESM, vue
externalized, gifenc bundled, d.ts via vue-tsc, `dist/dumbshow.css` exported
as `./style.css`). License is FSL-1.1-MIT; contributions need a DCO
sign-off (`git commit -s`).

Release process — manual today, no CI (there are no GitHub workflows yet; the
daft docs' Playwright/golden suite run through its `DUMBSHOW_SRC` source link
is the regression net):

1. Land the work on master (feature branch, DCO-signed conventional
   commits; `mise run lint`, `mise run typecheck`, `mise run build` green).
2. Bump `package.json` (0.x: a contract or document-format change is a
   minor bump, anything else a patch) in its own `chore: release X.Y.Z`
   commit.
3. `mise run build` on master, then `pnpm publish` — needs the maintainer's
   npm 2FA in a real terminal (the build's `vite build && vue-tsc` order
   matters: vue-tsc first would lose its d.ts to vite's emptyOutDir).
4. Tag the release commit `vX.Y.Z` (annotated — `tag.gpgsign` makes tags
   annotated, so pass `-m`) and push master + tags.
5. In daft: `cd docs && bun add --exact @avihut/dumbshow@X.Y.Z` (the package
   is excluded from the bun cooldown), run the suite against the registry
   build, commit the pin.

Planned: a CI workflow (lint/typecheck/build on push and PR), a tag-driven
publish with npm trusted publishing (OIDC, no 2FA dance), and the copied
`editor.*` specs so the package carries its own net.
