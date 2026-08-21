<script setup lang="ts">
import type { ActLike, DerivedChapter, Player } from "@dumbshow/core";
import { computed, ref } from "vue";

/**
 * The player bar — transport, time, and the scrubber with chapter
 * notches. Pure playback: nothing here edits the document, and nothing
 * here ever starts playing on its own.
 */

const props = defineProps<{
  player: Player<ActLike> | null;
  playing: boolean;
  time: number;
  duration: number;
  chapters: DerivedChapter[];
}>();

const RATES = [0.25, 0.5, 1, 2];
const rate = ref(1);
const loop = ref(false);
const scrubEl = ref<HTMLElement | null>(null);

const notches = computed(() => {
  const p = props.player;
  if (!p || !props.duration) return [];
  return props.chapters
    .filter((c) => c.step >= 0 && p.compiled.steps[c.step])
    .map((c) => ({
      title: c.title,
      at: p.compiled.steps[c.step].at,
      pct: (p.compiled.steps[c.step].at / props.duration) * 100,
    }));
});

const pct = computed(() =>
  props.duration ? Math.min((props.time / props.duration) * 100, 100) : 0,
);

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

function togglePlay(): void {
  const p = props.player;
  if (!p) return;
  if (!props.playing && p.clock() >= p.compiled.duration - 0.01) p.seek(0);
  p.toggle();
}

function seekFromPointer(event: PointerEvent): void {
  const p = props.player;
  const el = scrubEl.value;
  if (!p || !el || !props.duration) return;
  const rect = el.getBoundingClientRect();
  const f = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  p.seek(f * props.duration);
}

function onScrubDown(event: PointerEvent): void {
  if (!props.player) return;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // Synthetic events carry no capturable pointer; seeking still works.
  }
  seekFromPointer(event);
}

function onScrubMove(event: PointerEvent): void {
  if ((event.currentTarget as HTMLElement).hasPointerCapture?.(event.pointerId))
    seekFromPointer(event);
}

function setRate(event: Event): void {
  rate.value = Number((event.target as HTMLSelectElement).value);
  props.player?.setRate(rate.value);
}

function toggleLoop(): void {
  loop.value = !loop.value;
  props.player?.setLoop(loop.value);
}
</script>

<template>
  <div class="dx-playbar" aria-label="Player">
    <button
      class="dx-tbtn"
      type="button"
      aria-label="Jump to start"
      :disabled="!player"
      @click="player?.seek(0)"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 3h1.8v10H3zM13 3 6.4 8 13 13z" /></svg>
    </button>
    <button
      class="dx-tbtn"
      type="button"
      aria-label="Previous step"
      :disabled="!player"
      @click="player?.prev()"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11 3 4.8 8 11 13z" /><rect x="4" y="3" width="1.6" height="10" /></svg>
    </button>
    <button
      class="dx-tbtn big"
      type="button"
      :aria-label="playing ? 'Pause' : 'Play'"
      :disabled="!player"
      @click="togglePlay"
    >
      <svg v-if="playing" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3.6" y="3" width="3.2" height="10" rx="0.8" /><rect x="9.2" y="3" width="3.2" height="10" rx="0.8" /></svg>
      <svg v-else viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" /></svg>
    </button>
    <button
      class="dx-tbtn"
      type="button"
      aria-label="Next step"
      :disabled="!player"
      @click="player?.next()"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3l6.2 5L5 13z" /><rect x="10.4" y="3" width="1.6" height="10" /></svg>
    </button>
    <button
      class="dx-tbtn"
      type="button"
      aria-label="Jump to end"
      :disabled="!player"
      @click="player?.seek(duration)"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11.2 3H13v10h-1.8zM3 3l6.6 5L3 13z" /></svg>
    </button>
    <span class="dx-ttime">{{ fmt(time) }} <span>/ {{ fmt(duration) }}</span></span>
    <div
      ref="scrubEl"
      class="dx-scrub"
      tabindex="0"
      role="slider"
      aria-label="Timeline scrubber; chapter notches"
      :aria-valuemin="0"
      :aria-valuemax="Math.round(duration * 10) / 10"
      :aria-valuenow="Math.round(time * 10) / 10"
      @pointerdown="onScrubDown"
      @pointermove="onScrubMove"
      @keydown.left.prevent="player?.seek(time - 1)"
      @keydown.right.prevent="player?.seek(time + 1)"
    >
      <span class="dx-sbase" />
      <span class="dx-sfill" :style="{ width: `${pct}%` }" />
      <template v-for="(n, i) in notches" :key="i">
        <button
          class="dx-snotch"
          type="button"
          tabindex="-1"
          :style="{ left: `${n.pct}%` }"
          :aria-label="`Chapter: ${n.title}`"
          @pointerdown.stop
          @click.stop="player?.seek(n.at)"
        />
        <span
          class="dx-chap-name dx-schap"
          :style="{ left: `${n.pct}%`, transitionDelay: `${i * 50}ms` }"
        >
          {{ n.title }}
        </span>
      </template>
      <span class="dx-knob" :style="{ left: `${pct}%` }" />
    </div>
    <select
      class="dx-speed"
      :value="rate"
      aria-label="Playback speed"
      @change="setRate"
    >
      <option v-for="r in RATES" :key="r" :value="r">{{ r }}×</option>
    </select>
    <button
      class="dx-tbtn"
      :class="{ toggled: loop }"
      type="button"
      :aria-label="loop ? 'Loop on' : 'Loop off'"
      :aria-pressed="loop"
      @click="toggleLoop"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M3 6.5v-1A2.5 2.5 0 0 1 5.5 3h7M13 9.5v1a2.5 2.5 0 0 1-2.5 2.5h-7" />
        <path d="m10.8 1 2.2 2-2.2 2M5.2 15 3 13l2.2-2" />
      </svg>
    </button>
  </div>
</template>
