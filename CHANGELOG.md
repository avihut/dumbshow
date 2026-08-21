# @avihut/dumbshow

> Historical — the changelog of the single package (0.1.0 to 0.2.0). The
> packages that continue it, `@dumbshow/core` and `@dumbshow/vue`, keep their
> changelogs under `packages/core/CHANGELOG.md` and `packages/vue/CHANGELOG.md`.

## 0.2.0

### Minor Changes

- [#1](https://github.com/avihut/dumbshow/pull/1) [`7f1a5f3`](https://github.com/avihut/dumbshow/commit/7f1a5f3b8c9f88e7f186cc5742188c306d892548) Thanks [@avihut](https://github.com/avihut)! - Pointer affordances and a live drag preview on the stage. Hovering a scene
  entity now shows a pointer cursor and the pack's hover marker; dragging a
  node previews the move live against the base cameras, commits once on
  release, and cancels on Escape; relations and other tap-only entities stay
  selectable without moving. The contract grows the optional `hoverOverlay`,
  `dragOverlay`, and `draggable` entity hooks, `DiagramView` gains `setPlayer`
  and `hits`, and `withCamsOf` joins the derive helpers. Canvas edits now land
  settled on the playhead's step instead of the last step.
