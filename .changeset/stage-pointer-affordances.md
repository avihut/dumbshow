---
"@avihut/dumbshow": minor
---

Pointer affordances and a live drag preview on the stage. Hovering a scene
entity now shows a pointer cursor and the pack's hover marker; dragging a
node previews the move live against the base cameras, commits once on
release, and cancels on Escape; relations and other tap-only entities stay
selectable without moving. The contract grows the optional `hoverOverlay`,
`dragOverlay`, and `draggable` entity hooks, `DiagramView` gains `setPlayer`
and `hits`, and `withCamsOf` joins the derive helpers. Canvas edits now land
settled on the playhead's step instead of the last step.
