import { copyToClipboard } from "../clipboard.ts";
import type { GenerationResult } from "../types.ts";

const METHOD_LABELS: Record<string, string> = {
  keybert: "KeyBERT",
  nano: "Chrome AI",
  webllm: "WebLLM",
};

export function setStatus(statusDiv: HTMLElement, html: string): void {
  statusDiv.innerHTML = html;
}

export function renderHashtags(
  container: HTMLElement,
  hashtags: string[],
  showCopyFeedback: (msg: string) => void,
): void {
  container.innerHTML = "";

  for (const tag of hashtags) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "hashtag-chip inline-flex items-center gap-1.5 bg-buffer-light text-buffer-dark text-sm font-semibold px-3.5 py-2 rounded-xl border border-buffer-border cursor-pointer";
    btn.setAttribute("data-hashtag", tag);
    btn.setAttribute("aria-label", `Copy hashtag ${tag}`);
    btn.innerHTML = `${tag} <span class="text-xs opacity-60" aria-hidden="true">\u{1F4CB}</span>`;

    btn.addEventListener("click", async () => {
      const success = await copyToClipboard(tag);
      if (success) {
        btn.classList.add("copied");
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `${tag} <span class="text-xs" aria-hidden="true">\u2713</span>`;
        showCopyFeedback(`Copied ${tag}`);
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = originalHTML;
        }, 1500);
      }
    });

    container.appendChild(btn);
  }
}

export function showTiming(
  timingDiv: HTMLElement,
  result: GenerationResult,
): void {
  const seconds = (result.durationMs / 1000).toFixed(1);
  const count = result.hashtags.length;
  const label = METHOD_LABELS[result.method] ?? result.method;
  timingDiv.textContent = `Generated ${count} hashtag${count !== 1 ? "s" : ""} in ${seconds}s using ${label}`;
  timingDiv.classList.remove("hidden");
}

export function setupCopyAll(
  copyAllBtn: HTMLElement,
  getCurrentHashtags: () => string[],
  showFeedback: (msg: string) => void,
): void {
  copyAllBtn.addEventListener("click", async () => {
    const hashtags = getCurrentHashtags();
    if (hashtags.length === 0) return;
    const text = hashtags.join(" ");
    const success = await copyToClipboard(text);
    showFeedback(success ? "Copied all hashtags!" : "Failed to copy.");
  });
}

export function createShowCopyFeedback(
  feedbackEl: HTMLElement,
): (msg: string) => void {
  return (message: string) => {
    feedbackEl.textContent = message;
    feedbackEl.classList.remove("hidden");
    setTimeout(() => feedbackEl.classList.add("hidden"), 2000);
  };
}
