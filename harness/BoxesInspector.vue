<script setup lang="ts">
import { computed } from "vue";
import {
  AttributesForm,
  type EditorSelection,
  type ItemSelection,
  type VerbArgs,
  type VocabLang,
} from "../src";
import type { World } from "./boxes-pack";

/**
 * The boxes inspector — the minimal pack pane: the live world as a list,
 * plus the generic attributes form for timeline selections. Its job is to
 * prove the inspector-as-prop seam with a second, trivial implementation.
 */

const props = defineProps<{
  lang: VocabLang;
  selection: EditorSelection | null;
  doc: unknown;
  world: unknown;
  viewWorld: unknown;
  compiled: unknown;
}>();

const emit = defineEmits<{
  setArgs: [index: number, args: VerbArgs];
  setSilent: [index: number, silent: boolean];
  setChapter: [index: number, title: string];
  setBeat: [index: number, secs: number];
  remove: [index: number];
}>();

const item = computed<ItemSelection | null>(() =>
  props.selection?.type === "item" ? props.selection : null,
);
const view = computed(() => props.viewWorld as World);
</script>

<template>
  <div class="bx-inspector">
    <section aria-label="World">
      <h3>World</h3>
      <p v-if="!view.boxes.length">Nothing yet — add a box.</p>
      <ul v-else>
        <li v-for="b in view.boxes" :key="b.name">
          {{ b.name }} <small>({{ b.x }}, {{ b.y }})</small>
        </li>
      </ul>
      <p v-if="view.links.length">
        {{ view.links.map(([a, b]) => `${a} — ${b}`).join(", ") }}
      </p>
    </section>
    <AttributesForm
      :lang="lang"
      :selection="item"
      @set-args="(i, a) => emit('setArgs', i, a)"
      @set-silent="(i, s) => emit('setSilent', i, s)"
      @set-chapter="(i, t) => emit('setChapter', i, t)"
      @set-beat="(i, s) => emit('setBeat', i, s)"
      @remove="(i) => emit('remove', i)"
    />
  </div>
</template>

<style scoped>
.bx-inspector {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow: auto;
}
.bx-inspector h3 {
  margin: 0 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}
.bx-inspector ul {
  margin: 0;
  padding-left: 18px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}
.bx-inspector > section > p {
  margin: 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
</style>
