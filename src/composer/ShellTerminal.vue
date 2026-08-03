<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import type { Compiled, Player, TermLine } from "../engine";
import type { ActLike } from "../language";
import { transcriptAt } from "../transcript";

/**
 * The composer's shell — a projection of the compiled transcript at the
 * playhead, and an editor of it. Commands are clickable to jump to their
 * step; clicking the parked step's command again swaps the line for a
 * prefilled input, and Enter re-parses it in place. Typed lines at the
 * tail insert new ops at the insertion point. Silent steps' lines render
 * dimmed with an eye-off here (exports and viewers omit them entirely);
 * the eye button toggles that per step. Invalid lines print ephemeral
 * rust rows — never stored, never exported.
 */

const props = defineProps<{
  player: Player<ActLike> | null;
  compiled: Compiled<ActLike> | null;
  minimized: boolean;
  /**
   * Makes the shell an editor: parse a typed line, insert it as a timeline
   * op on success, return the error to print ephemerally on failure.
   */
  parseLine?: (line: string) => { ok: boolean; error?: string };
  /** Re-parse an edited command into the step's own item. */
  editLine?: (step: number, line: string) => { ok: boolean; error?: string };
  /** The pack's highlighted verb prefix for a command ("" = none). */
  verbOf?: (text: string) => string;
  /** Aria copy for the input line — the language's own invitation. */
  inputLabel?: string;
}>();

const emit = defineEmits<{
  /** A command line was clicked: its compiled step index. */
  jump: [step: number];
  toggleMinimize: [];
  /** The eye: flip a step's terminal visibility (the silent flag). */
  toggleSilent: [step: number];
}>();

const lines = ref<TermLine[]>([]);
const typing = ref<string | null>(null);
const activeStep = ref(-1);
const termEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const editEl = ref<HTMLInputElement | null>(null);
const input = ref("");
/** The step whose command is being edited in place, with its draft text. */
const editing = ref<{ step: number; text: string } | null>(null);
/** Error rows printed for invalid lines — never stored, never exported. */
const ephemerals = ref<string[]>([]);
let lastSig = "";
let disposers: (() => void)[] = [];

function scrollTerm(force: boolean): void {
  nextTick(() => {
    const el = termEl.value;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
    if (force || nearBottom) el.scrollTop = el.scrollHeight;
  });
}

function onTick(t: number): void {
  const term = props.compiled?.term ?? [];
  const shown = transcriptAt(term, t);
  const sig = `${shown.count}:${shown.typing === null ? -1 : shown.typing.length}`;
  if (sig === lastSig) return;
  lastSig = sig;
  const grew =
    shown.count > lines.value.length ||
    (shown.typing !== null && shown.typing.length > 0);
  // The editor shows silent lines dimmed rather than hiding them — only
  // viewers and exports omit them — so slice, don't filter.
  lines.value = term.slice(0, shown.count);
  typing.value = shown.typing;
  if (grew) scrollTerm(false);
}

function attach(p: Player<ActLike> | null): void {
  for (const off of disposers) off();
  disposers = [];
  lastSig = "";
  if (!p) {
    lines.value = [];
    typing.value = null;
    activeStep.value = -1;
    return;
  }
  disposers = [
    p.onFrame(onTick),
    p.onStep((i) => {
      activeStep.value = i;
    }),
  ];
  activeStep.value = p.current();
  onTick(p.clock());
  scrollTerm(true);
}

onMounted(() => {
  watch(() => props.player, attach, { immediate: true });
  // A new derivation replaces the transcript; stale errors would lie.
  watch(
    () => props.compiled,
    () => {
      ephemerals.value = [];
      editing.value = null;
    },
  );
});

onBeforeUnmount(() => {
  for (const off of disposers) off();
  disposers = [];
});

function setEditEl(el: unknown): void {
  // Template refs inside v-for arrive per element, not as an array here.
  editEl.value = (el as HTMLInputElement | null) ?? null;
}

function onCmdClick(line: TermLine): void {
  if (line.step === activeStep.value && props.editLine) {
    // Second click on the parked step: swap the line for an input.
    editing.value = { step: line.step, text: line.text };
    nextTick(() => editEl.value?.focus());
    return;
  }
  editing.value = null;
  emit("jump", line.step);
}

function submitEdit(): void {
  const e = editing.value;
  if (!e || !props.editLine) return;
  const line = e.text.trim();
  if (!line) return;
  const outcome = props.editLine(e.step, line);
  if (outcome.ok) {
    editing.value = null;
    ephemerals.value = [];
  } else if (outcome.error) {
    ephemerals.value = [...ephemerals.value, outcome.error];
  }
}

function submit(): void {
  const line = input.value.trim();
  if (!line || !props.parseLine) return;
  const outcome = props.parseLine(line);
  if (outcome.ok) {
    input.value = "";
    ephemerals.value = [];
  } else if (outcome.error) {
    ephemerals.value = [...ephemerals.value, outcome.error];
    scrollTerm(true);
  }
}

function focusInput(event: MouseEvent): void {
  // Let text selection and command clicks behave; focus on plain clicks.
  if ((event.target as HTMLElement).closest(".dx-tline, .dx-min, button"))
    return;
  inputEl.value?.focus();
}

const hasLines = computed(
  () => lines.value.length > 0 || typing.value !== null,
);

function verbPart(text: string): string {
  return props.verbOf?.(text) ?? "";
}
function restPart(text: string): string {
  return text.slice(verbPart(text).length);
}
</script>

<template>
  <div
    v-if="!minimized"
    ref="termEl"
    class="dx-term"
    aria-label="Shell"
    @click="focusInput"
  >
    <button
      class="dx-min dx-term-min"
      type="button"
      aria-label="Minimize the terminal"
      @click="emit('toggleMinimize')"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
        <path d="m3.5 6 4.5 4.5L12.5 6" />
      </svg>
    </button>
    <template v-for="(line, i) in lines" :key="i">
      <div
        v-if="editing && line.kind === 'cmd' && line.step === editing.step && line.checkpoint"
        class="dx-tline dx-shell-input"
      >
        <span class="dx-prompt">$ </span>
        <input
          :ref="setEditEl"
          v-model="editing.text"
          type="text"
          spellcheck="false"
          autocomplete="off"
          aria-label="Edit this command"
          @keydown.enter.prevent="submitEdit"
          @keydown.escape.prevent="editing = null"
        />
      </div>
      <div
        v-else
        class="dx-tline"
        :class="[
          `is-${line.kind}`,
          { live: line.step === activeStep, hiddenop: line.hidden },
        ]"
        :role="line.kind === 'cmd' ? 'button' : undefined"
        :tabindex="line.kind === 'cmd' ? 0 : undefined"
        @click="line.kind === 'cmd' && onCmdClick(line)"
        @keydown.enter.prevent="line.kind === 'cmd' && onCmdClick(line)"
      >
        <template v-if="line.kind === 'cmd'"><span class="dx-prompt">$ </span><span class="dx-verb">{{ verbPart(line.text) }}</span>{{ restPart(line.text) }}<button
            class="dx-eye"
            type="button"
            :aria-label="line.hidden ? 'Show in exports' : 'Hide from exports'"
            :title="line.hidden ? 'Hidden from exports — world effects still apply' : 'Hide from exports'"
            @click.stop="emit('toggleSilent', line.step)"
          >
            <svg v-if="line.hidden" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
              <path d="M2 8s2.2-3.8 6-3.8S14 8 14 8s-2.2 3.8-6 3.8S2 8 2 8z" />
              <circle cx="8" cy="8" r="1.7" />
              <path d="m3 13 10-10" />
            </svg>
            <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
              <path d="M2 8s2.2-3.8 6-3.8S14 8 14 8s-2.2 3.8-6 3.8S2 8 2 8z" />
              <circle cx="8" cy="8" r="1.7" />
            </svg>
          </button></template>
        <template v-else>{{ line.text }}</template>
      </div>
    </template>
    <div v-if="typing !== null" class="dx-tline is-cmd">
      <span class="dx-prompt">$ </span><span class="dx-verb">{{ verbPart(typing) }}</span>{{ restPart(typing) }}<span class="dx-caret" />
    </div>
    <div
      v-for="(e, i) in ephemerals"
      :key="`e-${i}`"
      class="dx-tline is-rust"
    >
      {{ e }}
    </div>
    <div v-if="parseLine && !editing" class="dx-tline dx-shell-input">
      <span class="dx-prompt">$ </span>
      <input
        ref="inputEl"
        v-model="input"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :aria-label="inputLabel ?? 'Type a command — it lands on the timeline'"
        @keydown.enter.prevent="submit"
      />
    </div>
    <p v-else-if="!hasLines && !parseLine" class="dx-term-hint">
      The story's shell — commands appear as the timeline plays them.
    </p>
  </div>
  <button
    v-else
    class="dx-term-flap"
    type="button"
    @click="emit('toggleMinimize')"
  >
    Terminal
  </button>
</template>
