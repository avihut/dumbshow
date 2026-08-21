<script setup lang="ts">
import { type Ref, ref } from "vue";

export interface ExportEntry {
  id: string;
  label: string;
  hint: string;
  run: () => void | Promise<void>;
}

/** The host's corner link out of the editor — absent hides the corner. */
export interface BackLink {
  href: string;
  /** Accessible label ("Back to …"). */
  label: string;
  /** The visible text beside the chevron. */
  text: string;
}

const props = defineProps<{
  title: string;
  filename: string;
  playerBar: boolean;
  /** Export menu entries — the menu renders whatever the app can do. */
  exporters: ExportEntry[];
  /** Host chrome: the back link (absent = hidden). */
  back?: BackLink | null;
  /** Host theme binding — a writable dark-mode ref (absent = no toggle). */
  isDark?: Ref<boolean> | null;
}>();

const emit = defineEmits<{
  rename: [title: string];
  togglePlayerBar: [];
  save: [];
  open: [file: File];
}>();

const fileEl = ref<HTMLInputElement | null>(null);
const showExport = ref(false);

function commitTitle(event: Event): void {
  emit("rename", (event.target as HTMLInputElement).value);
}

function onPickFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("open", file);
  input.value = "";
}

async function runExport(entry: ExportEntry): Promise<void> {
  showExport.value = false;
  await entry.run();
}

function toggleTheme(): void {
  const dark = props.isDark;
  if (dark) dark.value = !dark.value;
}
</script>

<template>
  <header class="dx-chrome">
    <a v-if="back" class="dx-back" :href="back.href" :aria-label="back.label">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
        <path d="M10.5 3 5.5 8l5 5" />
      </svg>
      {{ back.text }}
    </a>
    <div class="dx-doc">
      <input
        class="dx-title"
        :value="title"
        aria-label="Scenario title"
        spellcheck="false"
        @change="commitTitle"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
      <span class="dx-filename">{{ filename }}</span>
    </div>
    <div class="dx-spacer" />
    <input
      ref="fileEl"
      type="file"
      accept=".json,application/json"
      hidden
      @change="onPickFile"
    />
    <button class="dx-chrome-btn" type="button" @click="fileEl?.click()">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M2.5 13.5v-11h5l2 2h4v9z" />
      </svg>
      Open
    </button>
    <button class="dx-chrome-btn" type="button" @click="emit('save')">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M3 3h8.5L13 4.5V13H3zM5.5 3v3.5h4.6V3M5 13V9h6v4" />
      </svg>
      Save
    </button>
    <div class="dx-export-wrap">
      <button
        class="dx-chrome-btn primary"
        type="button"
        :disabled="!exporters.length"
        :aria-expanded="showExport"
        @click="showExport = !showExport"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12v2h10v-2" />
        </svg>
        Export
      </button>
      <div v-if="showExport" class="dx-export-pop" aria-label="Export options">
        <button
          v-for="entry in exporters"
          :key="entry.id"
          type="button"
          @click="runExport(entry)"
        >
          {{ entry.label }}<span class="dx-ex-hint">{{ entry.hint }}</span>
        </button>
        <p class="dx-ex-note">
          Stills work on any document. GIF and video render the timeline
          offline, frame by frame — replay is deterministic, so the file
          matches the screen.
        </p>
      </div>
    </div>
    <button
      class="dx-chrome-btn"
      :class="{ toggled: playerBar }"
      type="button"
      :aria-pressed="playerBar"
      @click="emit('togglePlayerBar')"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M2 8h12" />
        <rect x="6.9" y="6.9" width="2.2" height="2.2" transform="rotate(45 8 8)" fill="currentColor" stroke="none" />
        <path d="M4.5 5.8v4.4M11.5 5.8v4.4" opacity="0.5" />
      </svg>
      Scrubber
    </button>
    <button
      v-if="isDark"
      class="dx-icon-btn"
      type="button"
      :aria-label="isDark.value ? 'Switch to light theme' : 'Switch to dark theme'"
      @click="toggleTheme"
    >
      <svg v-if="isDark.value" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="8" cy="8" r="3.2" />
        <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" />
      </svg>
      <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M13.5 9.5A5.8 5.8 0 0 1 6.5 2.5a5.8 5.8 0 1 0 7 7z" />
      </svg>
    </button>
  </header>
</template>
