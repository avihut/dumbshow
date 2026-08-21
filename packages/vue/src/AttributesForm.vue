<script setup lang="ts">
import type { DocItem, VerbArgs, VocabLang } from "@dumbshow/core";
import { computed } from "vue";

/**
 * The Attributes form for timeline items — one slot, one rule: the
 * selected item shows its editable truth here. An op re-resolves its spec
 * fields against the world as it stood before the op ran (the world value
 * is pack data, carried opaquely); chapters and beats edit their own
 * fields. Entity selections render through the pack's own attributes
 * component instead — the pane composing this form decides which shows.
 */

export interface ItemSelection {
  type: "item";
  index: number;
  item: DocItem;
  /** World before the item ran (derived.worlds[index]) — pack data. */
  world: unknown;
  skipped: boolean;
}

/**
 * Everything the editor can have selected: a timeline item, or a scene
 * entity — a pack-shaped value (entities.select) carried opaquely.
 */
export type EditorSelection = ItemSelection | { type: "entity"; sel: unknown };

const props = defineProps<{
  lang: VocabLang;
  selection: ItemSelection | null;
}>();

const emit = defineEmits<{
  setArgs: [index: number, args: VerbArgs];
  setSilent: [index: number, silent: boolean];
  setChapter: [index: number, title: string];
  setBeat: [index: number, secs: number];
  remove: [index: number];
}>();

const op = computed(() => {
  const s = props.selection;
  if (s?.item.kind !== "op") return null;
  const item = s.item;
  const spec = props.lang.ops.find((o) => o.id === item.op) ?? null;
  if (!spec) return { spec: null, fields: [], item };
  return { spec, fields: spec.fields(s.world), item };
});

function argValue(key: string, fallback: string): string {
  const s = props.selection;
  if (s?.item.kind !== "op") return fallback;
  const v = s.item.args[key];
  return typeof v === "string" && v ? v : fallback;
}

function commitArg(key: string, value: string): void {
  const s = props.selection;
  if (s?.item.kind !== "op") return;
  emit("setArgs", s.index, { ...s.item.args, [key]: value });
}

function onField(key: string, event: Event): void {
  commitArg(key, (event.target as HTMLInputElement | HTMLSelectElement).value);
}
</script>

<template>
  <section class="dx-attrs" aria-label="Attributes">
    <h3>Attributes</h3>

    <p v-if="!selection" class="dx-attrs-hint">
      Select a timeline row, a canvas node, or a state row to edit it here.
    </p>

    <!-- Timeline item -->
    <template v-else>
      <div class="dx-insp-head">
        <span class="dx-tag">{{
          selection.item.kind === "op" ? selection.item.op : selection.item.kind
        }}</span>
        <b v-if="op?.spec">{{ op.spec.label }}</b>
        <span class="dx-mini">
          <button
            type="button"
            aria-label="Remove this item"
            @click="emit('remove', selection.index)"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
              <path d="M3.5 5h9M6.5 5V3.5h3V5m-5 0 .6 7.5h5.8L11.5 5" />
            </svg>
          </button>
        </span>
      </div>

      <p v-if="selection.skipped" class="dx-attrs-skip">
        Skipped — its prerequisites are gone at this point in the story.
        Edit the arguments or move the row.
      </p>

      <template v-if="selection.item.kind === 'op'">
        <code v-if="op?.spec" class="dx-syntax">{{ op.spec.syntax }}</code>
        <div v-for="f in op?.fields ?? []" :key="f.key" class="dx-field">
          <label :for="`dx-f-${f.key}`">{{ f.label }}</label>
          <select
            v-if="f.kind === 'choice'"
            :id="`dx-f-${f.key}`"
            :value="argValue(f.key, f.value)"
            @change="onField(f.key, $event)"
          >
            <option
              v-if="f.choices && !f.choices.includes(argValue(f.key, f.value))"
              :value="argValue(f.key, f.value)"
            >
              {{ argValue(f.key, f.value) }} (gone)
            </option>
            <option v-for="c in f.choices" :key="c" :value="c">{{ c }}</option>
          </select>
          <input
            v-else
            :id="`dx-f-${f.key}`"
            type="text"
            spellcheck="false"
            :value="argValue(f.key, f.value)"
            @change="onField(f.key, $event)"
          />
        </div>
        <div class="dx-swrow">
          <span>Visible in the terminal</span>
          <button
            class="dx-sw"
            :class="{ on: !selection.item.silent }"
            type="button"
            role="switch"
            :aria-checked="!selection.item.silent"
            aria-label="Visible in the terminal"
            @click="emit('setSilent', selection.index, !selection.item.silent)"
          >
            <i />
          </button>
        </div>
      </template>

      <template v-else-if="selection.item.kind === 'chapter'">
        <div class="dx-field">
          <label for="dx-f-chapter">Title</label>
          <input
            id="dx-f-chapter"
            type="text"
            spellcheck="false"
            :value="selection.item.title"
            @change="
              emit(
                'setChapter',
                selection.index,
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </div>
        <p class="dx-attrs-note">
          A chapter marks the step that follows it — a notch on the rail and
          the scrubber.
        </p>
      </template>

      <template v-else>
        <div class="dx-field">
          <label for="dx-f-beat">Seconds</label>
          <input
            id="dx-f-beat"
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            :value="selection.item.secs"
            @change="
              emit(
                'setBeat',
                selection.index,
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
        <p class="dx-attrs-note">
          A beat stretches the step before it — breathing room in the story.
        </p>
      </template>
    </template>
  </section>
</template>
