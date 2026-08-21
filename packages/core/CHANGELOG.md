# @dumbshow/core

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
