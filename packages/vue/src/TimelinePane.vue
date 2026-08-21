<script setup lang="ts">
import {
  type DndController,
  type DocItem,
  isEventOp,
  rowLabel,
  type VocabLang,
} from "@dumbshow/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{
  lang: VocabLang;
  items: DocItem[];
  /** Timeline index → step index (derived.mapping). */
  mapping: number[];
  selected: number | null;
  /** Compiled step index at the playhead; -1 when idle. */
  activeStep: number;
  dnd: DndController;
}>();

const emit = defineEmits<{
  select: [index: number];
  remove: [index: number];
  move: [index: number, dir: -1 | 1];
  minimize: [];
  collapsePane: [];
}>();

const vtlEl = ref<HTMLElement | null>(null);
let unregister: (() => void) | null = null;

onMounted(() => {
  if (!vtlEl.value) return;
  unregister = props.dnd.registerZone({
    id: "timeline",
    el: vtlEl.value,
    scrollEl: vtlEl.value,
    resolve(_x, y) {
      const rows = [...(vtlEl.value?.querySelectorAll("[data-idx]") ?? [])];
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (y < r.top + r.height / 2)
          return {
            kind: "timeline",
            index: Number((row as HTMLElement).dataset.idx),
          };
      }
      return { kind: "timeline", index: props.items.length };
    },
  });
});

onBeforeUnmount(() => {
  unregister?.();
});

/** Pixel offset of the drag insertion line inside the rail container. */
const lineTop = computed<number | null>(() => {
  const active = props.dnd.state.active;
  if (active?.target?.kind !== "timeline") return null;
  const container = vtlEl.value;
  if (!container) return null;
  const rows = [...container.querySelectorAll("[data-idx]")] as HTMLElement[];
  const index = active.target.index;
  if (!rows.length) return 10;
  if (index < rows.length) return rows[index].offsetTop - 2;
  const last = rows[rows.length - 1];
  return last.offsetTop + last.offsetHeight + 1;
});

function onRowDown(event: PointerEvent, index: number): void {
  if ((event.target as HTMLElement).closest(".dx-row-acts")) return;
  props.dnd.start(event, { kind: "row", index }, () => emit("select", index));
}

/** Chapter ordinal per timeline index — staggers the name bloom. */
const chapterOrdinal = computed(() => {
  const map = new Map<number, number>();
  let n = 0;
  props.items.forEach((item, i) => {
    if (item.kind === "chapter") map.set(i, n++);
  });
  return map;
});

function isSkipped(i: number): boolean {
  return props.items[i]?.kind === "op" && props.mapping[i] < 0;
}

function isLive(i: number): boolean {
  return (
    props.items[i]?.kind === "op" &&
    props.mapping[i] >= 0 &&
    props.mapping[i] === props.activeStep
  );
}
</script>

<template>
  <section class="dx-seq" aria-label="Timeline">
    <div class="dx-side-label-row">
      <h3 class="dx-side-label">Timeline</h3>
      <span class="dx-label-btns">
        <button
          class="dx-min"
          type="button"
          aria-label="Collapse the sidepane"
          title="Collapse the sidepane"
          @click="emit('collapsePane')"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <path d="m8.5 3.5-5 4.5 5 4.5M13 3.5 8 8l5 4.5" />
          </svg>
        </button>
        <button
          class="dx-min"
          type="button"
          aria-label="Minimize the timeline"
          title="Minimize the timeline"
          @click="emit('minimize')"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <path d="m10.5 3.5-5 4.5 5 4.5" />
          </svg>
        </button>
      </span>
    </div>
    <div
      ref="vtlEl"
      class="dx-vtl"
      tabindex="0"
      aria-label="Sequence; chapter notches sit on the rail"
    >
      <span class="dx-rail" aria-hidden="true" />
      <span
        v-if="lineTop !== null"
        class="dx-drop-line"
        :style="{ top: `${lineTop}px` }"
        aria-hidden="true"
      />
      <div v-if="items.length" class="dx-vrows">
        <template v-for="(item, i) in items" :key="i">
          <div
            v-if="item.kind === 'chapter'"
            class="dx-chap"
            :class="{ sel: selected === i }"
            :data-idx="i"
            @pointerdown="onRowDown($event, i)"
          >
            <button
              class="dx-notch"
              type="button"
              :aria-label="`Chapter: ${item.title}`"
              @keydown.enter.prevent="emit('select', i)"
            />
            <button
              class="dx-chap-name"
              type="button"
              tabindex="-1"
              :style="{ transitionDelay: `${(chapterOrdinal.get(i) ?? 0) * 50}ms` }"
            >
              {{ item.title }}
            </button>
          </div>
          <div
            v-else
            class="dx-vrow"
            :class="{
              sel: selected === i,
              dead: isSkipped(i),
              live: isLive(i),
              beat: item.kind === 'beat',
              event: item.kind === 'op' && isEventOp(lang, item.op),
              agent: item.kind === 'op' && item.op.startsWith('agent'),
            }"
            :data-idx="i"
            role="button"
            tabindex="0"
            @pointerdown="onRowDown($event, i)"
            @keydown.enter.prevent="emit('select', i)"
          >
            <i
              v-if="item.kind === 'op' && isEventOp(lang, item.op)"
              class="dx-edot"
              aria-hidden="true"
            />
            <b>{{ rowLabel(lang, item).verb }}</b>
            <span class="dx-vrest">{{ rowLabel(lang, item).rest }}</span>
            <span v-if="isSkipped(i)" class="dx-skipped">skipped</span>
            <span class="dx-row-acts">
              <button
                type="button"
                aria-label="Move up"
                :disabled="i === 0"
                @click.stop="emit('move', i, -1)"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m4 9.5 4-4 4 4" /></svg>
              </button>
              <button
                type="button"
                aria-label="Move down"
                :disabled="i === items.length - 1"
                @click.stop="emit('move', i, 1)"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m4 6.5 4 4 4-4" /></svg>
              </button>
              <button type="button" aria-label="Remove" @click.stop="emit('remove', i)">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
              </button>
            </span>
          </div>
        </template>
      </div>
      <p v-else class="dx-empty" style="padding: 6px 2px">
        An empty story. Click or drag operations from the catalog below — or
        build a starting scene and leave the timeline still.
      </p>
    </div>
  </section>
</template>
