import { readStored, removeStored, writeStored } from '../lib/storage';
import { LIMITS, coerceLetter, createLetter, type Letter } from './model';
import { cleanMessageDraft, cleanNameDraft, truncateGraphemes } from './text';

const STORAGE_KEY = 'living-letter.draft.v1';
const SAVE_DELAY = 350;

/** Typed text is cleaned and held to the limits as it enters the draft. */
const cleanDraft = {
  message: (raw: string) => truncateGraphemes(cleanMessageDraft(raw), LIMITS.messageGraphemes),
  name: (raw: string) => truncateGraphemes(cleanNameDraft(raw), LIMITS.nameGraphemes),
};

function load(): Letter | null {
  const raw = readStored(STORAGE_KEY);
  if (!raw || raw.length > 20_000) return null;
  try {
    return coerceLetter(JSON.parse(raw), cleanDraft);
  } catch {
    return null;
  }
}

const saved = load();
let current: Letter = saved ?? createLetter();
let restored = saved !== null && saved.message.trim().length > 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function save(): void {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  writeStored(STORAGE_KEY, JSON.stringify(current));
}

function changed(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, SAVE_DELAY);
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  // Don't lose the last few keystrokes if the tab is closed mid-debounce.
  window.addEventListener('pagehide', () => {
    if (saveTimer !== undefined) save();
  });
}

/**
 * The letter being written. It lives outside React so that it survives route
 * changes, and is mirrored to localStorage (when available) so a refresh does
 * not cost anyone their words. Nothing here ever leaves the device.
 */
export const draftStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: (): Letter => current,
  /** True once per session if a non-empty draft was brought back from storage. */
  wasRestored: (): boolean => restored,
  acknowledgeRestored(): void {
    restored = false;
  },
  /**
   * Applies a change. Pass `composing` while an input method is mid-composition
   * (Japanese, Korean, dead keys…): rewriting the text under it would break the
   * composition, so cleaning waits for the composition to end.
   */
  patch(change: Partial<Letter>, composing = false): void {
    const next = { ...current, ...change };
    if (!composing) {
      if (change.message !== undefined) next.message = cleanDraft.message(change.message);
      if (change.to !== undefined) next.to = cleanDraft.name(change.to);
      if (change.from !== undefined) next.from = cleanDraft.name(change.from);
    }
    current = next;
    changed();
  },
  reset(): void {
    current = createLetter();
    restored = false;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    removeStored(STORAGE_KEY);
    for (const listener of listeners) listener();
  },
};
