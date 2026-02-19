import type { MethodId, GenerationResult } from "./types.ts";

const STORAGE_KEY = "hashtag-generator-state";
const SCHEMA_VERSION = 1;

export interface StoredState {
  version: number;
  title: string;
  text: string;
  selectedMethod: MethodId;
  results: Partial<Record<MethodId, GenerationResult>>;
}

function defaultState(): StoredState {
  return {
    version: SCHEMA_VERSION,
    title: "",
    text: "",
    selectedMethod: "keybert",
    results: {},
  };
}

export function load(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw) as StoredState;
    if (parsed.version !== SCHEMA_VERSION) return defaultState();

    return parsed;
  } catch {
    return defaultState();
  }
}

export function save(state: StoredState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage quota exceeded — degrade gracefully
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
