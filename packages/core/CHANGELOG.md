# @dumbshow/core

## 0.4.1

### Patch Changes

- [#11](https://github.com/avihut/dumbshow/pull/11) [`a882400`](https://github.com/avihut/dumbshow/commit/a88240055ffdc7a3bf70d133134ec873ed609851) Thanks [@avihut](https://github.com/avihut)! - `docSlug` trims its edge dashes without an ambiguous quantifier, and gets the
  tests it never had.
  
  No output changes — the slug for every title is byte-identical, verified
  against the old expression over the edge cases plus a fuzz sweep. What changes
  is the expression and what pins it.
  
  `docSlug` collapses each run of non-alphanumerics into a single dash, then
  trims the dashes left at the edges. The trim used `/^-+|-+$/g`, whose `-+$`
  is the shape CodeQL reports as polynomial ReDoS
  ([`js/polynomial-redos`](https://github.com/avihut/dumbshow/security/code-scanning/3),
  against `doc.title`, which the document format does not bound). The report
  reads the two replaces independently: the collapse cannot emit `--`, so no
  title can ever put more than one dash at either edge, and the quantifier had
  nothing to match. Dropping it to `/^-|-$/g` makes the expression say that,
  and leaves the query nothing to flag.
  
  The invariant is now a comment at the regex and a test — `docSlug` had no
  test at all, despite naming every export the editor hands the browser
  (`<slug>.png`, `<slug>.gif`, `<slug>.webm`, `<slug>.txt`,
  `<slug>.<tag>.json`). `tests/storage.test.ts` covers the casing, the collapse,
  the edge trim, the `"scenario"` fallback, the tag suffix, and the
  no-doubled-dash invariant that keeps the trim linear.

## 0.4.0

### Minor Changes

- [#9](https://github.com/avihut/dumbshow/pull/9) [`0562ec0`](https://github.com/avihut/dumbshow/commit/0562ec0afa2af74635bae528df0f056c31852d79) Thanks [@avihut](https://github.com/avihut)! - Host-agnostic theming (`--dx-*`) and document format v2, where a document's
  seed and placements belong to the language pack.
  
  Both are breaking for a host. The two changes are independent; a host can
  take the tokens first.
  
  ## Theming: one `--dx-*` token set, with defaults
  
  The editor chrome used to resolve its colors and fonts through the tokens of
  the site it was extracted from — `--vp-c-*`, `--vp-font-family-*`, and the
  brand pair `--daft-gold`/`--daft-rust`. It now reads only `--dx-*` names, and
  **ships a default for every one of them**, so a host that declares nothing
  gets a coherent editor in light and dark.
  
  | Token | Replaces | Light | Dark |
  | --- | --- | --- | --- |
  | `--dx-bg` | `--vp-c-bg` | `#ffffff` | `#1b1b1f` |
  | `--dx-bg-soft` | `--vp-c-bg-soft` | `#f6f6f7` | `[#202127](https://github.com/avihut/dumbshow/issues/202127)` |
  | `--dx-divider` | `--vp-c-divider` | `#e2e2e3` | `#2e2e32` |
  | `--dx-text-1` | `--vp-c-text-1` | `#3c3c43` | `#dfdfd6` |
  | `--dx-text-2` | `--vp-c-text-2` | `#67676c` | `#98989f` |
  | `--dx-text-3` | `--vp-c-text-3` | `[#929295](https://github.com/avihut/dumbshow/issues/929295)` | `#6a6a71` |
  | `--dx-font` | `--vp-font-family-base` | `ui-sans-serif, system-ui, sans-serif` | — |
  | `--dx-font-mono` | `--vp-font-family-mono` | `ui-monospace, "SF Mono", Menlo, monospace` | — |
  | `--dx-accent` | `--daft-gold` | `#bd8c26` | `#d1a54a` |
  | `--dx-accent-text` | `--daft-gold-text` | `#9a7115` | `#e0b866` |
  | `--dx-on-accent` | (was hard-coded `#241b09`) | `#241b09` | — |
  | `--dx-warn` | `--daft-rust` | `#c75c1e` | `#d9752f` |
  | `--dx-warn-text` | `--daft-rust-text` | `#b14e14` | `#e08a4a` |
  | `--dx-teal` / `--dx-purple` | unchanged | `#1b9aaa` / `#8a63d2` | — |
  | `--dx-teal-text` | unchanged | `#0e7280` | `#3fbccb` |
  | `--dx-purple-text` | unchanged | `#6d48c0` | `#ab8ce4` |
  | `--dx-sel` | unchanged | `color-mix(in srgb, var(--dx-accent) 12%, var(--dx-bg))` | — |
  
  The composer-local aliases `--dx-line`, `--dx-panel` and `--dx-well` are gone;
  their meanings are `--dx-divider`, `--dx-bg` and `--dx-bg-soft`.
  
  How the defaults behave, which is the part worth knowing:
  
  - They are declared behind `:where(html)` and `:where(html.dark)` —
    **specificity zero**. Any host declaration wins outright, including a plain
    `:root { --dx-accent: … }`, whichever stylesheet loads first.
  - They are declared **on `<html>`**, so a pack's `readPalette()` keeps
    resolving them through `getComputedStyle(document.documentElement)`.
  - Dark still keys off a `dark` class on `<html>`.
  - **An overridden token is the host's in both themes.** A `:root` declaration
    outranks the dark default too, so override a token in light and dark or in
    neither.
  - `--dx-sel` is an expression over `--dx-accent` and `--dx-bg`, not a literal:
    override only the accent and the selection tint follows.
  - `--dx-on-accent` is new, and is **the one token a host cannot skip if it
    changes `--dx-accent`**. It is the ink on an accent-filled surface — the
    primary toolbar button is the only one in the chrome — and it was previously
    a hard-coded `#241b09` tuned for gold. That literal reads at 5.6:1 on the
    default gold and 7.4:1 on its dark form, but drops to 4.1:1 on a mid blue;
    white is worse on gold (3.0:1). It is deliberately NOT `--dx-accent-text`,
    which is the accent used AS text on the page. Expect to set it per theme:
    a dark accent wants light ink, a pale dark-mode accent wants dark ink.
  
  For a host mapping an existing palette, the whole job is a block of
  `--dx-*: var(--your-token)` in both themes. Until it does, the editor chrome
  renders with these neutral defaults while its pack's canvas keeps whatever
  its own `readPalette()` reads — behavior unchanged, appearance mixed.
  
  The GIF exporter's background now reads `--dx-bg` instead of `--vp-c-bg`.
  
  ## Document format v2: seed and placements are pack-owned
  
  `ComposerDoc.seed` and `ComposerDoc.placements` are now **pack-defined JSON**,
  typed `unknown`. Core stores, serializes, and migrates them without reading
  their shape and hands them to the pack through its hooks. The rule that
  governs them:
  
  > They are carried across document-version bumps **verbatim**. A pack that
  > evolves its own schema versions it inside its own JSON.
  
  **Which is why v1 → v2 needs no data migration.** Under v1 the seed and
  placements already held the shape of the pack that wrote them and nobody
  else's, so a v1 document opened by that same pack is byte-identical. The
  migration bumps the version and passes both halves through untouched. The
  adaptation on a host's side is type-level.
  
  New hooks on `DiagramLanguage` — implement all four:
  
  ```ts
  seed: {
    empty(): unknown;                  // NEW — a fresh document's seed
    parse(raw: unknown): unknown;      // NEW — validate; throw a readable Error
    world(seed: unknown, placements: unknown): W;
    step(world: W, placements: unknown): Step | null;   // CHANGED: null = the
  }                                    // seed declares nothing, no opening step
  placements: {
    empty(): unknown;                  // NEW
    parse(raw: unknown): unknown;      // NEW
    patchStep(step: Step, placements: unknown): void;
    fromCompiled(compiled): unknown;
  }
  ```
  
  `step()` returning `Step | null` replaces the check core used to make against
  the seed's fields. Return a step whenever the seed declares anything — a seed
  carrying only relations between entities the timeline creates later still
  opens a scene, since the relation renders once both ends exist.
  
  A pack's `parse()` throw becomes the document's parse failure:
  `Error("a seed box has no name")` surfaces as
  `Not a composer document: seed — a seed box has no name`.
  
  Removed from `@dumbshow/core`, all of them daft-shaped:
  
  - types `Seed`, `SeedRepo`, `SeedWt`, `Placements`, `RepoPlacement`,
    `WtPlacement` — a pack declares its own
  - `setRepoPlacement`, `setWtPlacement` — use `setPlacements(doc, placements)`,
    which replaces the whole value; the pack computes it
  - `freezePlacements` — core cannot merge JSON whose schema it does not know.
    The rule (derived geometry fills gaps, author pins win) is a spread in pack
    code: `{ ...fromCompiled(compiled), ...doc.placements }`
  
  Added: `setSeed(doc, seed)` and `setPlacements(doc, placements)`, both pure
  whole-value writes, and the `DocSchema` type.
  
  Changed signatures — each now takes the pack, which any `DiagramLanguage`
  satisfies structurally:
  
  ```ts
  emptyDoc(lang)            // was emptyDoc()
  parseDoc(json, lang)      // was parseDoc(json)
  openDocFile(file, lang)   // was openDocFile(file)
  loadDraft(lang, tag?)     // was loadDraft(tag?)
  ```
  
  `ComposerApp` threads its `lang` prop through for you; a host that calls the
  document API directly passes its pack.
  
  `loadDraft` also migrates the localStorage draft across the bump: the slot is
  keyed by document version, so it reads the previous version's slot once,
  migrates it through `parseDoc`, re-saves under the new key, and retires the
  old one. Without that a format bump would silently orphan every in-progress
  draft.

## 0.3.0

### Minor Changes

- [#6](https://github.com/avihut/dumbshow/pull/6) [`ba053ee`](https://github.com/avihut/dumbshow/commit/ba053eee95d42704b01969d5b05bfa06ae39d43a) Thanks [@avihut](https://github.com/avihut)! - dumbshow is now two packages, published from one workspace in lockstep:
  
  - `@dumbshow/core` — everything framework-free: the `DiagramLanguage`
    contract, the engine and headless player, the render core, the transcript,
    the editor's document model and drag mechanics, the exporters, the
    editor-level types (`EditorSelection`, `ItemSelection`, `BackLink`,
    `ExportEntry`), and the editor chrome stylesheet as
    `@dumbshow/core/style.css`. `createDnd` takes its state container from the
    caller (a plain object by default).
  - `@dumbshow/vue` — the Vue editor: `ComposerApp` and `AttributesForm`, with
    `@dumbshow/core` and `vue` as peers. The theme binding is
    `v-model:isDark` (a boolean; absent = no toggle) instead of a writable ref.
  
  Migrating from `@avihut/dumbshow`: install both packages; import components
  from `@dumbshow/vue` and everything else — types included — from
  `@dumbshow/core`; replace `import "@avihut/dumbshow/style.css"` with
  `import "@dumbshow/core/style.css"`; bind the theme with
  `v-model:is-dark="dark"`. The stage's pointer affordances and live drag
  preview (0.2.0 of the old package) are part of this first release under the
  new names.
