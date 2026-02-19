import "./style.css";
import { copyToClipboard } from "./clipboard.ts";

if (import.meta.env.DEV) {
  import("./vitals.ts").then((m) => m.initVitals());
}

// ── Mount Point ─────────────────────────────────────────────

const root = document.getElementById("hashtag-generator")!;

root.innerHTML = `
  <form id="hashtag-form" aria-label="Hashtag generator input" class="space-y-5">
    <div>
      <label for="title-input" class="block text-sm font-semibold text-buffer-dark mb-1.5">
        Title or topic <span class="text-buffer-muted font-normal">(optional)</span>
      </label>
      <input
        id="title-input"
        name="title"
        type="text"
        class="w-full rounded-xl border border-buffer-border bg-white p-3.5 text-buffer-dark placeholder-buffer-muted/50 focus:border-buffer-blue transition-colors"
        placeholder="e.g. How to Build an AI-Powered Log Parser"
        aria-describedby="title-input-help"
      />
      <p id="title-input-help" class="text-xs text-buffer-muted mt-1.5">
        Helps generate hashtags that match your content's theme.
      </p>
    </div>

    <div>
      <label for="text-input" class="block text-sm font-semibold text-buffer-dark mb-1.5">
        Paste your text
      </label>
      <textarea
        id="text-input"
        name="text"
        rows="6"
        class="w-full rounded-xl border border-buffer-border bg-white p-4 text-buffer-dark placeholder-buffer-muted/50 focus:border-buffer-blue resize-y transition-colors"
        placeholder="Paste an article, blog post, or any text here..."
        aria-describedby="text-input-help"
        required
        minlength="20"
      ></textarea>
      <p id="text-input-help" class="text-xs text-buffer-muted mt-1.5">
        Minimum 20 characters. The more text you provide, the better the results.
      </p>
    </div>

    <div>
      <label for="file-input" class="block text-sm font-semibold text-buffer-dark mb-1.5">
        Or upload a .txt file
      </label>
      <input
        id="file-input"
        type="file"
        accept=".txt,text/plain"
        aria-describedby="file-input-help"
        class="block w-full text-sm text-buffer-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-buffer-border file:text-sm file:font-semibold file:bg-buffer-light file:text-buffer-dark hover:file:bg-white file:cursor-pointer file:transition-colors"
      />
      <p id="file-input-help" class="text-xs text-buffer-muted mt-1.5">Plain text files only (.txt)</p>
    </div>

    <button
      type="submit"
      id="generate-btn"
      class="w-full bg-buffer-blue text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-buffer-blue-hover active:bg-buffer-blue-active disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      disabled
      aria-disabled="true"
    >
      Loading AI model...
    </button>
  </form>

  <div id="status" role="status" aria-live="polite" class="mt-5">
  </div>

  <div id="results" role="region" aria-live="polite" aria-label="Generated hashtags" class="mt-8 hidden">
    <h2 class="text-lg font-bold text-buffer-dark mb-3">Your Hashtags</h2>
    <div id="hashtag-container" class="flex flex-wrap gap-2 mb-5"></div>
    <div class="flex gap-3">
      <button
        id="copy-all-btn"
        type="button"
        class="flex-1 bg-buffer-dark text-white font-semibold py-2.5 px-5 rounded-xl hover:opacity-90 transition-opacity"
      >
        Copy All
      </button>
      <button
        id="clear-btn"
        type="button"
        class="px-5 py-2.5 text-buffer-muted font-semibold border border-buffer-border rounded-xl hover:bg-buffer-light transition-colors"
      >
        Clear
      </button>
    </div>
    <p id="copy-feedback" class="text-sm text-buffer-green mt-2 hidden" role="status" aria-live="polite"></p>
  </div>
`;

// ── Element References ──────────────────────────────────────

const form = document.getElementById("hashtag-form") as HTMLFormElement;
const titleInput = document.getElementById("title-input") as HTMLInputElement;
const textInput = document.getElementById("text-input") as HTMLTextAreaElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const generateBtn = document.getElementById("generate-btn") as HTMLButtonElement;
const statusDiv = document.getElementById("status")!;
const resultsDiv = document.getElementById("results")!;
const hashtagContainer = document.getElementById("hashtag-container")!;
const copyAllBtn = document.getElementById("copy-all-btn")!;
const clearBtn = document.getElementById("clear-btn")!;
const copyFeedback = document.getElementById("copy-feedback")!;

let currentHashtags: string[] = [];
let modelReady = false;

// ── Worker Setup ────────────────────────────────────────────

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

worker.addEventListener("error", (e) => {
  console.error("Worker error:", e);
  setStatus(`<p class="text-sm text-red-600 font-medium">Worker error: ${e.message}</p>`);
  generateBtn.disabled = !modelReady;
  generateBtn.textContent = modelReady ? "Generate Hashtags" : "Loading AI model...";
});

worker.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as { type: string; [key: string]: unknown };

  switch (msg.type) {
    case "progress": {
      const data = msg.data as Record<string, unknown> | undefined;
      if (data && typeof data.progress === "number" && data.status === "progress") {
        const pct = Math.round(data.progress as number);
        const file = typeof data.file === "string" ? data.file : "";
        const shortFile = file.split("/").pop() ?? file;
        setStatus(
          `<div class="flex items-center gap-2 text-sm text-buffer-muted">
            <svg class="spinner w-4 h-4 shrink-0 text-buffer-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="15" />
            </svg>
            <span>Downloading ${shortFile}... ${pct}%</span>
          </div>
          <div class="w-full bg-buffer-light rounded-full h-1.5 mt-2">
            <div class="progress-fill bg-buffer-blue h-1.5 rounded-full" style="width: ${pct}%"></div>
          </div>
          <p class="text-xs text-buffer-muted/70 mt-1">First visit only — the model will be cached for future use.</p>`,
        );
      }
      break;
    }

    case "ready":
      modelReady = true;
      generateBtn.disabled = false;
      generateBtn.removeAttribute("aria-disabled");
      generateBtn.textContent = "Generate Hashtags";
      setStatus(
        `<p class="text-sm text-buffer-green font-medium">AI model ready.</p>`,
      );
      setTimeout(() => setStatus(""), 3000);
      break;

    case "status":
      setStatus(
        `<div class="flex items-center gap-2 text-sm text-buffer-muted">
          <svg class="spinner w-4 h-4 shrink-0 text-buffer-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="15" />
          </svg>
          <span>${msg.message as string}</span>
        </div>`,
      );
      break;

    case "results": {
      const hashtags = msg.hashtags as string[];
      currentHashtags = hashtags;
      renderHashtags(hashtags);
      generateBtn.disabled = false;
      generateBtn.removeAttribute("aria-disabled");
      generateBtn.textContent = "Generate Hashtags";
      setStatus("");

      if (hashtags.length === 0) {
        setStatus(
          `<p class="text-sm text-buffer-muted">No strong keywords found. Try providing more text.</p>`,
        );
      } else {
        resultsDiv.classList.remove("hidden");
        resultsDiv.focus();
      }
      break;
    }

    case "error":
      generateBtn.disabled = !modelReady;
      if (modelReady) {
        generateBtn.removeAttribute("aria-disabled");
      }
      generateBtn.textContent = modelReady
        ? "Generate Hashtags"
        : "Loading AI model...";
      setStatus(
        `<p class="text-sm text-red-600">${msg.message as string}</p>`,
      );
      break;
  }
});

// ── Event Handlers ──────────────────────────────────────────

// File upload → populate textarea
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") {
      textInput.value = reader.result;
    }
  };
  reader.readAsText(file);
});

// Form submission → generate hashtags
form.addEventListener("submit", (e: Event) => {
  e.preventDefault();
  const text = textInput.value.trim();
  const title = titleInput.value.trim();
  if (text.length < 20 || !modelReady) return;

  generateBtn.disabled = true;
  generateBtn.setAttribute("aria-disabled", "true");
  generateBtn.textContent = "Analyzing...";
  resultsDiv.classList.add("hidden");

  worker.postMessage({ type: "generate", text, title });
});

// Copy all hashtags
copyAllBtn.addEventListener("click", async () => {
  if (currentHashtags.length === 0) return;
  const text = currentHashtags.join(" ");
  const success = await copyToClipboard(text);
  showCopyFeedback(success ? "Copied all hashtags!" : "Failed to copy.");
});

// Clear
clearBtn.addEventListener("click", () => {
  titleInput.value = "";
  textInput.value = "";
  fileInput.value = "";
  currentHashtags = [];
  hashtagContainer.innerHTML = "";
  resultsDiv.classList.add("hidden");
  setStatus("");
  textInput.focus();
});

// ── Render Functions ────────────────────────────────────────

function setStatus(html: string): void {
  statusDiv.innerHTML = html;
}

function renderHashtags(hashtags: string[]): void {
  hashtagContainer.innerHTML = "";

  for (const tag of hashtags) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "hashtag-chip inline-flex items-center gap-1.5 bg-buffer-light text-buffer-dark text-sm font-semibold px-3.5 py-2 rounded-xl border border-buffer-border cursor-pointer";
    btn.setAttribute("data-hashtag", tag);
    btn.setAttribute("aria-label", `Copy hashtag ${tag}`);
    btn.innerHTML = `${tag} <span class="text-xs opacity-60" aria-hidden="true">📋</span>`;

    btn.addEventListener("click", async () => {
      const success = await copyToClipboard(tag);
      if (success) {
        btn.classList.add("copied");
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `${tag} <span class="text-xs" aria-hidden="true">✓</span>`;
        showCopyFeedback(`Copied ${tag}`);
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = originalHTML;
        }, 1500);
      }
    });

    hashtagContainer.appendChild(btn);
  }
}

function showCopyFeedback(message: string): void {
  copyFeedback.textContent = message;
  copyFeedback.classList.remove("hidden");
  setTimeout(() => {
    copyFeedback.classList.add("hidden");
  }, 2000);
}
