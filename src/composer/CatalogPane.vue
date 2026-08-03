<script setup lang="ts">
import { computed, ref } from "vue";
import type { DndController } from "./dnd";
import {
  type Chip,
  catalogGroups,
  searchChips,
  type VocabLang,
} from "./vocabulary";

const props = defineProps<{
  lang: VocabLang;
  minimized: boolean;
  dnd: DndController;
}>();

const emit = defineEmits<{
  add: [chip: Chip];
  toggleMinimize: [];
}>();

const query = ref("");
const groups = computed(() =>
  searchChips(catalogGroups(props.lang), query.value),
);

function activate(chip: Chip): void {
  if (chip.kind === "element") return;
  emit("add", chip);
}

function onChipDown(event: PointerEvent, chip: Chip): void {
  props.dnd.start(event, { kind: "chip", chip }, () => activate(chip));
}
</script>

<template>
  <section class="dx-cat" aria-label="Catalog">
    <div class="dx-cat-head">
      <span class="dx-cat-search">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" />
        </svg>
        <input
          v-model="query"
          type="search"
          placeholder="Search…"
          aria-label="Search the catalog"
          spellcheck="false"
        />
      </span>
      <button
        class="dx-min dx-cat-min"
        :class="{ closed: props.minimized }"
        type="button"
        :aria-expanded="!props.minimized"
        aria-label="Minimize the catalog"
        @click="emit('toggleMinimize')"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <path d="m3.5 10 4.5-4.5L12.5 10" />
        </svg>
      </button>
    </div>
    <div v-if="!props.minimized" class="dx-cat-body">
      <template v-for="group in groups" :key="group.title">
        <template v-if="group.chips.length">
          <h4>{{ group.title }}</h4>
          <div class="dx-chips">
            <button
              v-for="chip in group.chips"
              :key="chip.id"
              class="dx-chip"
              :class="{
                ent: chip.kind === 'element',
                meta: chip.kind === 'meta',
                ev: chip.event,
              }"
              type="button"
              :title="
                chip.kind === 'element'
                  ? 'Drag it onto the stage to build the scene'
                  : chip.hint
              "
              @pointerdown="onChipDown($event, chip)"
              @keydown.enter.prevent="activate(chip)"
            >
              <i v-if="chip.icon" :class="`dx-i-${chip.icon}`" aria-hidden="true" />
              <i
                v-else-if="chip.event"
                class="dx-evdot"
                :class="{ agent: chip.id.startsWith('agent') }"
                aria-hidden="true"
              />
              {{ chip.label }}
            </button>
          </div>
        </template>
      </template>
      <p v-if="!groups.length" class="dx-empty" style="padding: 8px 2px">
        Nothing matches "{{ query }}".
      </p>
    </div>
    <p v-if="!props.minimized" class="dx-cat-hint">
      Elements drop on the canvas · operations land on the timeline
    </p>
  </section>
</template>
