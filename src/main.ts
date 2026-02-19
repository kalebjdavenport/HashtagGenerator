import "./style.css";

import type { GenerationMethod, MethodId, GenerationResult } from "./types.ts";
import { load, save, clear as storageClear, debounce } from "./storage.ts";
import { formTemplate, getFormElements, setupFileUpload } from "./ui/form.ts";
import {
  setStatus,
  renderHashtags,
  showTiming,
  setupCopyAll,
  createShowCopyFeedback,
} from "./ui/results.ts";
import { createTabs } from "./ui/tabs.ts";
import { createKeybertMethod } from "./methods/keybert.ts";
import { createNanoMethod } from "./methods/nano.ts";
import { createOpenaiMethod } from "./methods/openai.ts";

if (import.meta.env.DEV) {
  import("./vitals.ts").then((m) => m.initVitals());
}

// ── Mount Point ─────────────────────────────────────────────

const root = document.getElementById("hashtag-generator")!;
root.innerHTML = formTemplate();

const el = getFormElements();

// ── Methods ─────────────────────────────────────────────────

const methods: GenerationMethod[] = [
  createKeybertMethod(),
  createNanoMethod(),
  createOpenaiMethod(),
];

let activeMethod: GenerationMethod = methods[0];
let currentHashtags: string[] = [];
let isGenerating = false;

// Per-method cached results
const cachedResults: Partial<Record<MethodId, GenerationResult>> = {};

// ── Status Callback ─────────────────────────────────────────

function statusCallback(html: string): void {
  setStatus(el.statusDiv, html);
}

for (const method of methods) {
  method.onStatus = statusCallback;
}

// ── Tabs ────────────────────────────────────────────────────

const tabs = createTabs(methods);
el.tabsContainer.appendChild(tabs.element);

tabs.onTabChange((id: MethodId) => {
  const prev = activeMethod;
  if (prev.id !== id) prev.onDeactivate?.();

  activeMethod = methods.find((m) => m.id === id)!;
  updateGenerateButton();

  // Show cached results for the new tab
  const cached = cachedResults[id];
  if (cached && cached.hashtags.length > 0) {
    currentHashtags = cached.hashtags;
    renderHashtags(el.hashtagContainer, cached.hashtags, showFeedback);
    showTiming(el.timingDiv, cached);
    el.resultsDiv.classList.remove("hidden");
  } else {
    currentHashtags = [];
    el.hashtagContainer.innerHTML = "";
    el.timingDiv.classList.add("hidden");
    el.resultsDiv.classList.add("hidden");
  }

  // Persist tab selection
  const state = load();
  state.selectedMethod = id;
  save(state);
});

// ── UI Helpers ──────────────────────────────────────────────

const showFeedback = createShowCopyFeedback(el.copyFeedback);

function updateGenerateButton(): void {
  if (isGenerating) {
    el.generateBtn.disabled = true;
    el.generateBtn.setAttribute("aria-disabled", "true");
    el.generateBtn.textContent = "Analyzing...";
    return;
  }

  const textOk = el.textInput.value.trim().length >= 20;
  const methodOk = activeMethod.isAvailable();

  // KeyBERT needs model loaded; Nano needs availability; OpenAI always available
  if (activeMethod.id === "keybert" && !methodOk) {
    el.generateBtn.disabled = true;
    el.generateBtn.setAttribute("aria-disabled", "true");
    el.generateBtn.textContent = "Loading AI model...";
  } else if (activeMethod.id === "nano" && !methodOk) {
    el.generateBtn.disabled = true;
    el.generateBtn.setAttribute("aria-disabled", "true");
    el.generateBtn.textContent = "Chrome AI unavailable";
  } else if (!textOk) {
    el.generateBtn.disabled = true;
    el.generateBtn.setAttribute("aria-disabled", "true");
    el.generateBtn.textContent = "Generate Hashtags";
  } else {
    el.generateBtn.disabled = false;
    el.generateBtn.removeAttribute("aria-disabled");
    el.generateBtn.textContent = "Generate Hashtags";
  }
}

// Poll for KeyBERT readiness (model loads async in worker)
const readyPoller = setInterval(() => {
  if (activeMethod.id === "keybert" || !methods[0].isAvailable()) {
    updateGenerateButton();
  }
  if (methods[0].isAvailable()) {
    clearInterval(readyPoller);
    updateGenerateButton();
  }
}, 500);

// ── File Upload ─────────────────────────────────────────────

setupFileUpload(el.fileInput, el.textInput, () => {
  updateGenerateButton();
  debouncedSave();
});

// ── Form Submission ─────────────────────────────────────────

el.form.addEventListener("submit", async (e: Event) => {
  e.preventDefault();

  const text = el.textInput.value.trim();
  const title = el.titleInput.value.trim();
  if (text.length < 20 || isGenerating) return;

  // For methods that aren't available (except OpenAI which always is)
  if (!activeMethod.isAvailable() && activeMethod.id !== "openai") return;

  isGenerating = true;
  updateGenerateButton();
  el.resultsDiv.classList.add("hidden");
  el.timingDiv.classList.add("hidden");

  try {
    const result = await activeMethod.generate({ title, text });
    currentHashtags = result.hashtags;
    cachedResults[activeMethod.id] = result;

    setStatus(el.statusDiv, "");

    if (result.hashtags.length === 0) {
      setStatus(
        el.statusDiv,
        `<p class="text-sm text-buffer-muted">No strong keywords found. Try providing more text.</p>`,
      );
    } else {
      renderHashtags(el.hashtagContainer, result.hashtags, showFeedback);
      showTiming(el.timingDiv, result);
      el.resultsDiv.classList.remove("hidden");
      el.resultsDiv.focus();
    }

    // Persist results
    const state = load();
    state.results[activeMethod.id] = result;
    save(state);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An error occurred.";
    setStatus(
      el.statusDiv,
      `<p class="text-sm text-red-600">${message}</p>`,
    );
  } finally {
    isGenerating = false;
    updateGenerateButton();
  }
});

// ── Copy All ────────────────────────────────────────────────

setupCopyAll(el.copyAllBtn, () => currentHashtags, showFeedback);

// ── Clear ───────────────────────────────────────────────────

el.clearBtn.addEventListener("click", () => {
  currentHashtags = [];
  cachedResults[activeMethod.id] = undefined;
  el.hashtagContainer.innerHTML = "";
  el.resultsDiv.classList.add("hidden");
  el.timingDiv.classList.add("hidden");
  setStatus(el.statusDiv, "");

  // Update persisted results
  const state = load();
  delete state.results[activeMethod.id];
  save(state);
});

// ── Reset (clears everything) ───────────────────────────────

el.resetBtn.addEventListener("click", () => {
  el.titleInput.value = "";
  el.textInput.value = "";
  el.fileInput.value = "";
  currentHashtags = [];

  // Clear all cached results
  for (const key of Object.keys(cachedResults) as MethodId[]) {
    cachedResults[key] = undefined;
  }

  el.hashtagContainer.innerHTML = "";
  el.resultsDiv.classList.add("hidden");
  el.timingDiv.classList.add("hidden");
  setStatus(el.statusDiv, "");
  storageClear();
  tabs.selectTab("keybert");
  el.textInput.focus();
  updateGenerateButton();
});

// ── Input Tracking ──────────────────────────────────────────

el.textInput.addEventListener("input", () => {
  updateGenerateButton();
  debouncedSave();
});

el.titleInput.addEventListener("input", () => {
  debouncedSave();
});

// ── Session Persistence ─────────────────────────────────────

function saveState(): void {
  const state = load();
  state.title = el.titleInput.value;
  state.text = el.textInput.value;
  state.selectedMethod = activeMethod.id;
  save(state);
}

const debouncedSave = debounce(saveState, 500);

// Restore on startup
(function restore(): void {
  const state = load();

  if (state.title) el.titleInput.value = state.title;
  if (state.text) el.textInput.value = state.text;

  // Restore cached results
  if (state.results) {
    for (const [id, result] of Object.entries(state.results)) {
      if (result) cachedResults[id as MethodId] = result;
    }
  }

  // Restore selected tab
  if (state.selectedMethod && state.selectedMethod !== "keybert") {
    tabs.selectTab(state.selectedMethod);
  }

  // Show cached results for active tab
  const cached = cachedResults[activeMethod.id];
  if (cached && cached.hashtags.length > 0) {
    currentHashtags = cached.hashtags;
    renderHashtags(el.hashtagContainer, cached.hashtags, showFeedback);
    showTiming(el.timingDiv, cached);
    el.resultsDiv.classList.remove("hidden");
  }

  updateGenerateButton();
})();
