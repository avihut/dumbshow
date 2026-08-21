<script setup lang="ts">
import {
  type ActLike,
  applyDrop,
  type Chip,
  type ComposerDoc,
  createDnd,
  createPlayer,
  type DiagramLanguage,
  type DragState,
  derive,
  docSlug,
  downloadDoc,
  dragLabel,
  emptyDoc,
  insertItem,
  loadDraft,
  moveItem,
  openDocFile,
  type Player,
  removeItem,
  renderGifBlob,
  renderPngBlob,
  renderWebmBlob,
  replaceOp,
  type StepDef,
  saveBlob,
  saveDraft,
  scriptJson,
  seedMetaItem,
  seedOpItem,
  setArgs,
  setBeatSecs,
  setChapterTitle,
  setSilent,
  setTitle,
  suggestedFilename,
  type VerbArgs,
  webmMimeType,
  withCamsOf,
} from "@dumbshow/core";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  type Ref,
  ref,
  shallowRef,
  watch,
} from "vue";
import type { EditorSelection } from "./AttributesForm.vue";
import CatalogPane from "./CatalogPane.vue";
import PlayerBar from "./PlayerBar.vue";
import ShellTerminal from "./ShellTerminal.vue";
import StageCanvas from "./StageCanvas.vue";
import TimelinePane from "./TimelinePane.vue";
import Toolbar, { type BackLink, type ExportEntry } from "./Toolbar.vue";

const props = defineProps<{
  /** The language pack this editor speaks — its only source of meaning. */
  lang: DiagramLanguage<unknown, ActLike, unknown, StepDef<ActLike>>;
  /** The pack's inspector pane (state views + entity attributes). */
  inspector: unknown;
  /** Host chrome: the toolbar's corner link (absent = hidden). */
  back?: BackLink | null;
  /** Host theme binding — a writable dark-mode ref (absent = no toggle). */
  isDark?: Ref<boolean> | null;
  /** Window handle for the player (console/test driving). Hosts gate it
   * on their own dev mode — passing a name always assigns it. */
  devHandle?: string;
  /** Brands persistence: the localStorage draft slot and the
   * `<slug>.<fileTag>.json` download suffix. Default: "dumbshow". */
  fileTag?: string;
}>();

/**
 * The composer — a full-window visual editor for diagrams and
 * stories. This component owns the document and everything derived from
 * it; panes are presentation over that single state. It mounts client-only
 * (see docs/composer.md) and locks the page behind it while open.
 *
 * The document is a shallowRef on purpose: every mutation returns a fresh
 * plain document that replaces `.value` wholesale, so nothing needs deep
 * reactivity — and the mutation layer (structuredClone) must receive plain
 * objects, never deep-reactive proxies.
 *
 * Editing rebuilds the player, never the DOM: each edit derives the new
 * document, creates a fresh player (autoplay off — the composer never
 * autoplays), and lands settled + paused on the affected step. The stage
 * and shell watch the player prop and re-attach in place.
 *
 * A node drag previews live: every pointer move applies the very mutation
 * the drop would (`applyDrop` against the base document) to a preview
 * document, rebuilt with the base cameras so the frame never slides under
 * the pointer and landed settled on the playhead's step; release commits
 * that mutation once, cancel restores the base. Canvas edits keep the
 * playhead's step — they never jump it to the end.
 */

const doc = shallowRef<ComposerDoc>(emptyDoc());
/* The live-drag preview: the document a node drag would commit if released
 * right now — derived and played exactly like the real one, never
 * persisted. Everything downstream reads `derived`, which prefers it. */
const preview = shallowRef<ComposerDoc | null>(null);
const baseDerived = computed(() => derive(doc.value, props.lang));
const previewDerived = computed(() =>
  preview.value ? derive(preview.value, props.lang) : null,
);
const derived = computed(() => previewDerived.value ?? baseDerived.value);
const showPlayerBar = ref(true);
const termMin = ref(false);

/* Selection: a timeline item, or an entity picked on the canvas. */
type SelState =
  | { type: "item"; index: number }
  | { type: "entity"; sel: unknown };
const selected = ref<SelState | null>(null);
const itemIndex = computed(() =>
  selected.value?.type === "item" ? selected.value.index : null,
);

/* Pane minimize state. Both left sections minimized — or a direct pane
 * collapse — folds the sidepane to a slim rail of restore flaps. */
const tlMin = ref(false);
const catMin = ref(false);
const paneMin = ref(false);
const sideCollapsed = computed(
  () => paneMin.value || (tlMin.value && catMin.value),
);

/* ------------------------------ player ---------------------------------- */

const player = shallowRef<Player<ActLike> | null>(null);
const playing = ref(false);
const time = ref(0);
const duration = ref(0);
const activeStep = ref(-1);
let playerDisposers: (() => void)[] = [];

function teardownPlayer(): void {
  for (const off of playerDisposers) off();
  playerDisposers = [];
  player.value?.destroy();
  player.value = null;
  playing.value = false;
}

/** Recreate the player over `steps` (default: the current derivation),
 * landing settled and paused on `land` (a compiled step index). */
function rebuild(
  land: number,
  steps: StepDef<ActLike>[] = derived.value.steps,
): void {
  teardownPlayer();
  if (!steps.length) {
    duration.value = 0;
    time.value = 0;
    activeStep.value = -1;
    return;
  }
  const p = createPlayer({
    script: steps,
    autoplay: false,
    loop: false,
    devHandle: props.devHandle,
  });
  playerDisposers = [
    p.onFrame((t) => {
      time.value = t;
    }),
    p.onStep((i) => {
      activeStep.value = i;
    }),
    p.onPlayState((on) => {
      playing.value = on;
    }),
  ];
  duration.value = p.compiled.duration;
  p.settle(land >= 0 ? land : steps.length - 1);
  player.value = p;
  activeStep.value = p.current();
  time.value = p.clock();
}

/** The step an edit at `itemIdx` should land on: its own step, else the
 * nearest earlier one that still exists. */
function landStepFor(itemIdx: number | null): number {
  const d = derived.value;
  if (itemIdx === null) return d.steps.length - 1;
  for (let i = Math.min(itemIdx, d.mapping.length - 1); i >= 0; i--) {
    const m = d.mapping[i];
    if (m >= 0) return m;
  }
  return d.seedStep ? 0 : d.steps.length - 1;
}

/** Apply a content edit: swap the document, rebuild, land on the edit. */
function applyEdit(next: ComposerDoc, focusItem: number | null): void {
  doc.value = next;
  rebuild(landStepFor(focusItem));
}

/** Apply a metadata-only change (title): no rebuild, playhead untouched. */
function applyMeta(next: ComposerDoc): void {
  doc.value = next;
}

/* ------------------------------ editing --------------------------------- */

/** The world as it stands where the next insertion would land. */
function worldAt(index: number): unknown {
  const d = derived.value;
  return index < d.worlds.length ? d.worlds[index] : d.world;
}

const insertIndex = computed(() =>
  itemIndex.value === null ? doc.value.timeline.length : itemIndex.value + 1,
);

function addChip(chip: Chip): void {
  const at = insertIndex.value;
  const item =
    chip.kind === "op"
      ? seedOpItem(props.lang, chip.id, worldAt(at))
      : chip.kind === "meta"
        ? seedMetaItem(chip.id)
        : null;
  if (!item) return;
  applyEdit(insertItem(doc.value, at, item), at);
  selected.value = { type: "item", index: at };
}

function removeAt(index: number): void {
  applyEdit(removeItem(doc.value, index), index > 0 ? index - 1 : null);
  const i = itemIndex.value;
  if (i !== null) {
    if (i === index) selected.value = null;
    else if (i > index) selected.value = { type: "item", index: i - 1 };
  }
}

function moveBy(index: number, dir: -1 | 1): void {
  const to = index + dir;
  if (to < 0 || to >= doc.value.timeline.length) return;
  applyEdit(moveItem(doc.value, index, to), to);
  const i = itemIndex.value;
  if (i === index) selected.value = { type: "item", index: to };
  else if (i === to) selected.value = { type: "item", index };
}

/** Selecting a row parks the playhead on that step, settled and paused. */
function selectItem(index: number): void {
  if (itemIndex.value === index) {
    selected.value = null;
    return;
  }
  selected.value = { type: "item", index };
  const m = derived.value.mapping[index];
  if (m >= 0 && player.value) {
    player.value.pause();
    player.value.settle(m);
  }
}

/* Drag-and-drop: chips land on the timeline or (elements) on the canvas,
 * rows reorder, nodes move; every drop funnels through applyDrop. A node
 * drag is previewed live (below), and its drop commits the same mutation
 * against the base document. Canvas edits keep the playhead's step. */
function commitCanvasEdit(next: ComposerDoc): void {
  preview.value = null;
  doc.value = next;
  rebuild(activeStep.value);
}

/** Back to the base document, settled on the playhead's step. */
function dropPreview(): void {
  if (!preview.value) return;
  preview.value = null;
  rebuild(activeStep.value);
}

const dnd = createDnd((source, target) => {
  cancelPreviewFrame();
  const result = applyDrop(
    props.lang,
    doc.value,
    baseDerived.value,
    source,
    target,
  );
  if (!result) {
    dropPreview();
    return;
  }
  if ("error" in result) {
    dropPreview();
    showNotice(result.error);
    return;
  }
  if (target.kind === "canvas") commitCanvasEdit(result.doc);
  else applyEdit(result.doc, result.focus);
  if (result.selectItem !== undefined)
    selected.value = { type: "item", index: result.selectItem };
  else if (result.selectEntity)
    selected.value = { type: "entity", sel: result.selectEntity };
});

/* The live preview. Pointer moves coalesce to animation frames; each
 * frame applies the drop the pointer describes to the base document and
 * plays the result — with the base cameras, so the frame never slides
 * under the pointer, settled on the playhead's step, so nothing jumps. A
 * move that describes no valid drop (off the canvas, a refused target)
 * shows the base document again. */
let previewFrame = 0;
let previewState: DragState | null = null;

function cancelPreviewFrame(): void {
  if (previewFrame) cancelAnimationFrame(previewFrame);
  previewFrame = 0;
}

function applyPreview(active: DragState | null): void {
  if (active?.source.kind !== "node" || active.target?.kind !== "canvas") {
    dropPreview();
    return;
  }
  const result = applyDrop(
    props.lang,
    doc.value,
    baseDerived.value,
    active.source,
    active.target,
  );
  if (!result || "error" in result) {
    dropPreview();
    return;
  }
  preview.value = result.doc;
  const steps = previewDerived.value?.steps ?? [];
  rebuild(activeStep.value, withCamsOf(steps, baseDerived.value.steps));
}

watch(
  () => dnd.state.active,
  (active) => {
    previewState = active;
    if (previewFrame) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      applyPreview(previewState);
    });
  },
);

/** A shell command was clicked: select its item, park on its checkpoint. */
function jumpToStep(step: number): void {
  const d = derived.value;
  const item = d.mapping.findIndex(
    (m, i) => m === step && doc.value.timeline[i]?.kind === "op",
  );
  if (item >= 0) selected.value = { type: "item", index: item };
  player.value?.seekCheckpoint(step);
}

/** A typed shell line: parse against the world at the insertion point;
 * valid lines become timeline ops, invalid ones print ephemerally. */
function shellParse(line: string): { ok: boolean; error?: string } {
  const at = insertIndex.value;
  const world = worldAt(at);
  const outcome = props.lang.parseCommand?.(line, world);
  if (!outcome) return { ok: false, error: "this language has no shell" };
  if (!outcome.ok) return { ok: false, error: outcome.error };
  applyEdit(
    insertItem(doc.value, at, {
      kind: "op",
      op: outcome.op,
      args: outcome.args,
    }),
    at,
  );
  selected.value = { type: "item", index: at };
  return { ok: true };
}

/** An edited past command: re-parse against the world before its own item.
 * Same op updates args; a different verb replaces the op with the parsed
 * args (the parser's world-aware resolution IS the reseeding). */
function shellEdit(
  step: number,
  line: string,
): { ok: boolean; error?: string } {
  const d = derived.value;
  const idx = d.mapping.findIndex(
    (m, i) => m === step && doc.value.timeline[i]?.kind === "op",
  );
  if (idx < 0) return { ok: false, error: "that line has no editable step" };
  const item = doc.value.timeline[idx];
  if (item.kind !== "op") return { ok: false, error: "not an operation" };
  const world = worldAt(idx);
  const outcome = props.lang.parseCommand?.(line, world);
  if (!outcome) return { ok: false, error: "this language has no shell" };
  if (!outcome.ok) return { ok: false, error: outcome.error };
  if (outcome.op === item.op) {
    applyEdit(setArgs(doc.value, idx, outcome.args), idx);
  } else {
    applyEdit(replaceOp(doc.value, idx, outcome.op, outcome.args), idx);
    showNotice(`${item.op} became ${outcome.op}`);
  }
  selected.value = { type: "item", index: idx };
  return { ok: true };
}

/** The eye: flip a step's silent flag from the terminal. */
function toggleSilentStep(step: number): void {
  const d = derived.value;
  const idx = d.mapping.findIndex(
    (m, i) => m === step && doc.value.timeline[i]?.kind === "op",
  );
  if (idx < 0) return;
  const item = doc.value.timeline[idx];
  if (item.kind !== "op") return;
  applyEdit(setSilent(doc.value, idx, !item.silent), idx);
}

/* ---------------------------- attributes -------------------------------- */

const selection = computed<EditorSelection | null>(() => {
  const s = selected.value;
  if (!s) return null;
  if (s.type === "entity") return s;
  const item = doc.value.timeline[s.index];
  if (!item) return null;
  return {
    type: "item",
    index: s.index,
    item,
    world: worldAt(s.index),
    skipped: item.kind === "op" && derived.value.mapping[s.index] < 0,
  };
});

/** The world after the last step the playhead has passed — what the
 * state views read. */
const playheadWorld = computed<unknown>(() => {
  const d = derived.value;
  const s = activeStep.value;
  if (s < 0) return d.world;
  let last = -1;
  d.mapping.forEach((m, i) => {
    if (m >= 0 && m <= s) last = i;
  });
  return last + 1 < d.worlds.length ? d.worlds[last + 1] : d.world;
});

function selectEntity(sel: unknown): void {
  selected.value = { type: "entity", sel };
}

function editArgs(index: number, args: VerbArgs): void {
  applyEdit(setArgs(doc.value, index, args), index);
}

function editSilent(index: number, silent: boolean): void {
  applyEdit(setSilent(doc.value, index, silent), index);
}

function editChapter(index: number, title: string): void {
  applyEdit(setChapterTitle(doc.value, index, title), index);
}

function editBeat(index: number, secs: number): void {
  applyEdit(setBeatSecs(doc.value, index, secs), index);
}

/* --------------------------- entity editing ----------------------------- */

/** A pack-applied edit (rename, seed change) coming up from the inspector. */
function onInspectorEdit(next: ComposerDoc, land: number | null): void {
  applyEdit(next, land);
}

function onInspectorSelect(sel: EditorSelection | null): void {
  if (sel && sel.type !== "entity") return;
  selected.value = sel;
}

function onPick(picked: unknown): void {
  selected.value =
    picked === null
      ? null
      : { type: "entity", sel: props.lang.entities.select(picked) };
}

/** The selection marker, pack-painted over every frame from its hits. */
const overlay = computed(() => {
  const s = selected.value;
  if (s?.type !== "entity") return null;
  return props.lang.entities.selectionOverlay(s.sel);
});

/* --------------------------- save / open / draft ------------------------- */

const notice = ref<string | null>(null);
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function showNotice(message: string): void {
  notice.value = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = null;
  }, 4000);
}

function save(): void {
  downloadDoc(doc.value, props.fileTag);
}

async function openFile(file: File): Promise<void> {
  try {
    const next = await openDocFile(file);
    doc.value = next;
    selected.value = null;
    rebuild(-1);
    showNotice(`Opened ${file.name}`);
  } catch (error) {
    showNotice((error as Error).message);
  }
}

/* ------------------------------- exports --------------------------------- */

/** The stage's current CSS size — exports frame what the author sees. */
function stageSize(): { width: number; height: number } {
  const el = document.querySelector(".dx-canvas-wrap canvas");
  const r = el?.getBoundingClientRect();
  return {
    width: Math.max(320, Math.round(r?.width ?? 800)),
    height: Math.max(240, Math.round(r?.height ?? 600)),
  };
}

async function doExportPng(): Promise<void> {
  const p = player.value;
  if (!p) return;
  try {
    const blob = await renderPngBlob(
      props.lang.scene,
      p.compiled,
      p.clock(),
      stageSize(),
    );
    saveBlob(blob, `${docSlug(doc.value)}.png`);
    showNotice("PNG exported");
  } catch (error) {
    showNotice((error as Error).message);
  }
}

const exporting = ref(false);

async function doExportGif(): Promise<void> {
  const p = player.value;
  if (!p || exporting.value) return;
  exporting.value = true;
  try {
    showNotice("Rendering GIF…");
    const blob = await renderGifBlob(props.lang.scene, p.compiled, {
      ...stageSize(),
      onProgress: (frame, total) => {
        if (frame % 24 === 0)
          showNotice(`Rendering GIF… ${Math.round((frame / total) * 100)}%`);
      },
    });
    saveBlob(blob, `${docSlug(doc.value)}.gif`);
    showNotice("GIF exported");
  } catch (error) {
    showNotice((error as Error).message);
  } finally {
    exporting.value = false;
  }
}

async function doExportWebm(): Promise<void> {
  const p = player.value;
  if (!p || exporting.value) return;
  exporting.value = true;
  try {
    showNotice("Recording webm — this runs in real time…");
    const blob = await renderWebmBlob(props.lang.scene, p.compiled, {
      ...stageSize(),
      onProgress: (frame, total) => {
        if (frame % 60 === 0)
          showNotice(`Recording webm… ${Math.round((frame / total) * 100)}%`);
      },
    });
    saveBlob(blob, `${docSlug(doc.value)}.webm`);
    showNotice("webm exported");
  } catch (error) {
    showNotice((error as Error).message);
  } finally {
    exporting.value = false;
  }
}

const exporters = computed<ExportEntry[]>(() => {
  if (!player.value) return [];
  const entries: ExportEntry[] = [
    {
      id: "png",
      label: "PNG still",
      hint: "the current state, exactly as framed, at 2x",
      run: doExportPng,
    },
    {
      id: "gif",
      label: "GIF",
      hint: "the full animation, looping, rendered offline",
      run: doExportGif,
    },
  ];
  if (webmMimeType())
    entries.push({
      id: "webm",
      label: "Video · webm",
      hint: "the full animation, recorded in real time",
      run: doExportWebm,
    });
  entries.push({
    id: "script",
    label: "Compiled script",
    hint: "the derived engine StepDef[], as JSON",
    run: () => copyText(scriptJson(derived.value.steps), "Script copied"),
  });
  const embed = props.lang.embedSnippet;
  if (embed)
    entries.push({
      id: "embed",
      label: "Docs embed",
      hint: "a ready snippet for any docs page",
      run: () => copyText(embed(derived.value.steps), "Embed copied"),
    });
  return entries;
});

async function copyText(text: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showNotice(done);
  } catch {
    // Clipboard unavailable (permissions, insecure context) — download.
    saveBlob(
      new Blob([text], { type: "text/plain" }),
      `${docSlug(doc.value)}.txt`,
    );
    showNotice("Clipboard unavailable — downloaded instead");
  }
}

/* The localStorage draft is a crash net: debounced writes on every change,
 * silently restored on the next visit. */
let draftTimer: ReturnType<typeof setTimeout> | undefined;
watch(doc, () => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => saveDraft(doc.value, props.fileTag), 800);
});

function restoreTimeline(): void {
  tlMin.value = false;
  paneMin.value = false;
}

function restoreCatalog(): void {
  catMin.value = false;
  paneMin.value = false;
}

onMounted(() => {
  document.documentElement.classList.add("dx-lock");
  const draft = loadDraft(props.fileTag);
  if (draft) {
    doc.value = draft;
    showNotice("Draft restored");
  }
  rebuild(-1);
});
onBeforeUnmount(() => {
  document.documentElement.classList.remove("dx-lock");
  clearTimeout(draftTimer);
  clearTimeout(noticeTimer);
  cancelPreviewFrame();
  teardownPlayer();
});
</script>

<template>
  <div class="dx-app">
    <Toolbar
      :title="doc.title"
      :filename="suggestedFilename(doc, fileTag)"
      :player-bar="showPlayerBar"
      :exporters="exporters"
      :back="back"
      :is-dark="isDark"
      @rename="applyMeta(setTitle(doc, $event))"
      @toggle-player-bar="showPlayerBar = !showPlayerBar"
      @save="save"
      @open="openFile"
    />
    <transition name="dx-fade">
      <div v-if="notice" class="dx-notice" role="status">{{ notice }}</div>
    </transition>
    <div class="dx-body" :class="{ 'side-min': sideCollapsed }">
      <aside class="dx-side" aria-label="Timeline and catalog">
        <template v-if="sideCollapsed">
          <button class="dx-flap" type="button" @click="restoreTimeline">
            Timeline
          </button>
          <button class="dx-flap" type="button" @click="restoreCatalog">
            Catalog
          </button>
        </template>
        <template v-else>
          <TimelinePane
            v-if="!tlMin"
            :lang="lang"
            :items="doc.timeline"
            :mapping="derived.mapping"
            :selected="itemIndex"
            :active-step="activeStep"
            :dnd="dnd"
            @select="selectItem"
            @remove="removeAt"
            @move="moveBy"
            @minimize="tlMin = true"
            @collapse-pane="paneMin = true"
          />
          <button
            v-else
            class="dx-flap in-pane"
            type="button"
            @click="tlMin = false"
          >
            Timeline
          </button>
          <CatalogPane
            :lang="lang"
            :minimized="catMin"
            :dnd="dnd"
            @add="addChip"
            @toggle-minimize="catMin = !catMin"
          />
        </template>
      </aside>
      <main class="dx-stage" aria-label="Stage">
        <StageCanvas
          :lang="lang"
          :player="player"
          :overlay="overlay"
          :dnd="dnd"
          @pick="onPick"
        />
        <ShellTerminal
          :player="player"
          :compiled="player?.compiled ?? null"
          :verb-of="lang.shellVerb"
          :input-label="lang.shellInputLabel"
          :minimized="termMin"
          :parse-line="shellParse"
          :edit-line="shellEdit"
          @jump="jumpToStep"
          @toggle-silent="toggleSilentStep"
          @toggle-minimize="termMin = !termMin"
        />
      </main>
      <aside class="dx-insp" aria-label="State and attributes">
        <component
          :is="inspector"
          :lang="lang"
          :selection="selection"
          :doc="doc"
          :world="derived.world"
          :view-world="playheadWorld"
          :compiled="derived.compiled"
          @select-entity="selectEntity"
          @set-args="editArgs"
          @set-silent="editSilent"
          @set-chapter="editChapter"
          @set-beat="editBeat"
          @remove="removeAt"
          @edit="onInspectorEdit"
          @select="onInspectorSelect"
          @notice="showNotice"
        />
      </aside>
    </div>
    <PlayerBar
      v-if="showPlayerBar"
      :player="player"
      :playing="playing"
      :time="time"
      :duration="duration"
      :chapters="derived.chapters"
    />
    <div
      v-if="dnd.state.active && dnd.state.active.source.kind !== 'node'"
      class="dx-ghost"
      :style="{
        left: `${dnd.state.active.x + 10}px`,
        top: `${dnd.state.active.y + 8}px`,
      }"
      aria-hidden="true"
    >
      <b>{{ dragLabel(lang, dnd.state.active.source, doc) }}</b>
    </div>
  </div>
</template>
