---
name: open-pr
description:
  Open a pull request on this repository. Use when the user asks to open, raise,
  or submit a PR for dumbshow, or when finished work on a branch needs one.
  Covers the repo's PR conventions (DCO, changesets, squash-merge semantics) and
  the visual-evidence rule: any change with visual expression carries before/after
  screenshots — a GIF when the change is an interaction or an animation — captured
  from a throwaway daft worktree and published through the assets branch.
---

# Opening a pull request on dumbshow

This replaces the generic `open-pr` skill for this repository. The mechanics of
`gh pr create` are unchanged; what follows is what dumbshow expects on top.

## The PR itself

- **One PR against `master`**, squash-merged by the owner. The merge uses the
  **PR title and body verbatim as the commit message** — so write the body as a
  document someone will read in `git log`, not as a summary of the diff.
- **Title is a conventional-commit subject** (`feat:`, `fix:`, `refactor:`,
  `docs:`, `chore:`…). Append `!` for a breaking change (`feat!:`).
- **Every commit carries `Signed-off-by`** (`git commit -s`). The `dco` check
  enforces it for human authors.
- **A change touching `packages/core/`, `packages/vue/`, or the lockfile needs a
  changeset** (`pnpm changeset`). The two public packages are a `fixed` group —
  name both. The changeset text is the handoff to downstream hosts; treat it as
  a deliverable, not paperwork.
- **`mise run ci` green before pushing.** It runs exactly what the six required
  checks run.

## The visual-evidence rule

**If the change has visual expression, the PR shows it.** Not a description of
it — the pixels, before and after.

- **Static change** (color, spacing, layout, typography, a new pane): a
  before/after **screenshot** pair.
- **Interaction or animation** (a drag, a transition, a player behaviour, a
  hover affordance, anything whose point is that it *moves*): a **GIF**. A still
  frame of a motion change is not evidence — if the thing you changed only
  exists over time, capture time.
- Both themes when the change touches theming: light and dark, four images.
- **Not every PR.** A pure refactor, a type-level change, a test-only change, a
  docs change — no images. Judge by whether a reviewer could see the difference
  by looking at the app.

Capture rules that make the pair honest:

- **Identical scene, identical viewport, identical content** on both sides. Drive
  the harness to the same state (`apps/harness-vue`, `mise run dev`), pin the
  viewport (1440×900 is the house size), and change exactly one variable: the
  code.
- Note that catalog chips and canvas nodes respond to **pointer events**, not
  `click` — a synthetic `element.click()` does nothing. Dispatch
  `pointerdown`/`pointerup`, or use a real driver click.
- Keep captured files **out of the repo working tree** — write them to a scratch
  directory. A stray PNG in `git status` is a mistake waiting to be committed.

## Capturing "before" — never on master

**Do not run capture code in the `master` worktree.** It is a live checkout
someone else may be standing in, and the divergence point is usually not
`master`'s tip anyway.

Take the before state from a **throwaway daft worktree pinned at the divergence
point** — the merge-base of this branch and `master`, which is what the reviewer
is actually comparing against:

```bash
BASE=$(git merge-base master HEAD)
FORK=$(daft start --fork "$BASE")      # stdout IS the path; narration is stderr
```

`daft start --fork` mints a private, always-fresh, detached worktree with hooks
run and dependencies in place. Use it rather than `daft go <commit-ish>`: `go`
gives the *shared canonical* sandbox for that commit, which another session may
be using and which you must therefore not delete. A fork is yours, so you can
remove it unconditionally — which is what makes the cleanup step safe.

Never `git worktree add --detach` by hand: it skips the hooks and yields a
half-configured checkout that cannot build.

### Labelling, so a leaked fork is obvious

Keep `daft.start.forkNaming` on its default, **`derived`**. It names the
directory `<short-sha>-fork` — e.g. `2e44ea924535-fork` — which says both *what
this is* (a disposable fork) and *what it is pinned to*, at a glance in
`daft list` or a directory listing. The `memorable` setting yields a random word
pair that records neither; do not use it for this workflow.

Do not drop a marker file inside the fork to label it. `daft remove` refuses a
dirty sandbox, so an untracked marker would block the very cleanup it was meant
to support. The name is the label. (Build output is fine — `node_modules/` is
ignored, so it does not count as dirty.)

### Cleaning up

Remove the fork as soon as the before-assets are captured, and stop any dev
server running inside it first:

```bash
daft remove "$(basename "$FORK")"
```

`daft prune` will **not** collect these — it removes branches whose remotes are
gone, and a fork has no branch. Cleanup is explicit or it does not happen.

If a stale fork is ever found lying around, sweep the fleet by pattern (quote
it; daft expands it against sandbox names, never branches):

```bash
daft list                       # anything matching *-fork is disposable
daft remove '*-fork'
```

A fork whose `HEAD` moved off its pinned commit refuses removal — that guards
commits that exist nowhere else. Promote them with `daft start <branch>` from
inside, or force it if you know they are worthless.

## Publishing images — the assets branch

GitHub's drag-and-drop upload needs the web UI, so images go on an orphan
`assets` branch in this repo and are referenced by raw URL. Build the commit
with plumbing — no checkout, so the daft "never `git checkout`" rule holds and
no worktree is disturbed:

```bash
ENTRIES=""
for f in before-light before-dark after-light after-dark; do
  sha=$(git hash-object -w "$SCRATCH/$f.png")
  ENTRIES="${ENTRIES}$(printf '100644 blob %s\t%s.png' "$sha" "$f")
"
done
SUB=$(printf '%s' "$ENTRIES" | git mktree)
ROOT=$(printf '040000 tree %s\tpr-<N>\n' "$SUB" | git mktree)
COMMIT=$(git commit-tree "$ROOT" -m "assets: PR #<N> …")   # add -p refs/heads/assets if it exists
git update-ref refs/heads/assets "$COMMIT"
git push origin assets
```

- One directory per PR (`pr-<N>/`) so PRs never collide.
- Reference them as
  `https://raw.githubusercontent.com/avihut/dumbshow/assets/pr-<N>/<file>.png`.
  Verify each returns 200 before putting it in the body — a broken image reads
  as carelessness and cannot be fixed by the reviewer.
- The `assets` branch triggers no CI: `ci.yml` fires on `pull_request` and on
  pushes to `master` only.
- The repo's rulesets cover `master` and the release tags, not `assets`.

Lay the pair out so the eye can compare — a two-column table, before on the
left, and a sentence saying what to look at:

```html
<table>
  <tr><th>Before (<code>&lt;sha&gt;</code>)</th><th>After</th></tr>
  <tr><td><img src="…/before-light.png"></td><td><img src="…/after-light.png"></td></tr>
</table>
```

## Order of operations

1. `mise run ci` green; changeset written; commits signed off.
2. Decide whether the change has visual expression. If yes: capture *after* from
   this worktree, then fork the merge-base, capture *before*, remove the fork.
3. Push the assets commit; verify every URL returns 200.
4. Push the branch; `gh pr create --base master`.
5. Watch the checks (`gh pr checks <N> --watch`).
