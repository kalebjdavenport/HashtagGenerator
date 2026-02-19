import type {
  GenerationMethod,
  GenerationInput,
  GenerationResult,
} from "../types.ts";

// Chrome Built-in AI types (no official TS types yet)
// New API: global `LanguageModel`  |  Legacy: `window.ai.languageModel`
type NanoSession = {
  prompt(input: string): Promise<string>;
  destroy(): void;
};

interface LanguageModelAPI {
  availability(options?: Record<string, unknown>): Promise<string>;
  capabilities?(): Promise<{ available: string }>;
  create(options?: {
    systemPrompt?: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<NanoSession>;
}

declare const LanguageModel: LanguageModelAPI | undefined;

declare global {
  interface Window {
    ai?: {
      languageModel?: LanguageModelAPI;
    };
  }
}

/** Resolve whichever API surface is present, or null. */
function getAPI(): LanguageModelAPI | null {
  if (typeof LanguageModel !== "undefined") return LanguageModel;
  if (window.ai?.languageModel) return window.ai.languageModel;
  return null;
}

const SYSTEM_PROMPT =
  "Generate 5 hashtags for the given text. Rules: output ONLY hashtags, each starting with #, separated by spaces. No numbering, no explanations. Maximum 8 hashtags. Example output: #ai #machinelearning #tech #coding #webdev";

const MAX_HASHTAGS = 8;

function parseHashtags(raw: string): string[] {
  // Try extracting #hashtag patterns first
  const hashMatches = raw.match(/#[a-zA-Z][a-zA-Z0-9_]*/g);
  const candidates = hashMatches
    ? hashMatches.map((t) => t.toLowerCase())
    : // Fallback: split on commas, newlines, or spaces and format as hashtags
      raw
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 40)
        .map((s) => "#" + s.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter((s) => s.length > 1);

  // Deduplicate
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of candidates) {
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

export function createNanoMethod(): GenerationMethod {
  let available: boolean | null = null; // null = not yet checked
  let session: NanoSession | null = null;
  let onStatusCb: ((html: string) => void) | undefined;

  async function checkAvailability(): Promise<boolean> {
    if (available !== null) return available;
    try {
      const api = getAPI();
      if (!api) {
        console.log("[Chrome AI] No API found. LanguageModel:", typeof LanguageModel, "window.ai:", typeof window.ai);
        available = false;
        return false;
      }

      // New API uses availability(), legacy uses capabilities()
      let status: string;
      if (typeof api.availability === "function") {
        status = await api.availability();
      } else if (typeof api.capabilities === "function") {
        const caps = await api.capabilities!();
        status = caps.available;
      } else {
        available = false;
        return false;
      }

      console.log("[Chrome AI] Status:", status);
      // New: "available" / "downloading"  |  Legacy: "readily" / "after-download"
      available = ["available", "downloadable", "downloading", "readily", "after-download"].includes(status);
      return available;
    } catch (err) {
      console.log("[Chrome AI] Detection error:", err);
      available = false;
      return false;
    }
  }

  async function getSession(): Promise<NanoSession> {
    if (session) return session;
    const api = getAPI()!;
    session = await api.create({
      systemPrompt: SYSTEM_PROMPT,
    });
    return session;
  }

  // Eagerly check on creation
  checkAvailability();

  return {
    id: "nano",
    label: "Chrome AI",
    description: "Uses Chrome's built-in Gemini Nano model. No network required.",

    isAvailable(): boolean {
      return available === true;
    },

    async generate(input: GenerationInput): Promise<GenerationResult> {
      const isReady = await checkAvailability();
      if (!isReady) {
        throw new Error("Chrome AI Nano is not available in this browser.");
      }

      onStatusCb?.(
        `<div class="flex items-center gap-2 text-sm text-buffer-muted">
          <svg class="spinner w-4 h-4 shrink-0 text-buffer-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="15" />
          </svg>
          <span>Generating with Chrome AI...</span>
        </div>`,
      );

      const start = Date.now();
      const s = await getSession();

      const prompt = input.title
        ? `Title: ${input.title}\n\nText: ${input.text}`
        : input.text;

      const raw = await s.prompt(prompt);
      console.log("[Chrome AI] Raw response:", raw);
      const hashtags = parseHashtags(raw).slice(0, MAX_HASHTAGS);
      const durationMs = Date.now() - start;

      return { hashtags, durationMs, method: "nano" };
    },

    renderPanel(): string {
      // Always render the panel; availability banner shown dynamically
      return `<div id="nano-panel-content" class="py-2">
        <div id="nano-available" class="text-sm text-buffer-muted hidden">
          <p>Uses Chrome's built-in <strong>Gemini Nano</strong> model. Runs locally on your device — no data sent to any server.</p>
        </div>
        <div id="nano-unavailable" class="nano-banner rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm hidden">
          <p class="font-semibold text-amber-800 mb-2">Chrome AI Nano is not available</p>
          <p class="text-amber-700 mb-3">This feature requires Chrome 127+ with experimental flags enabled. Follow these steps:</p>
          <ol class="list-decimal list-inside space-y-2 text-amber-700">
            <li>Open Chrome (version 127 or newer)</li>
            <li>
              Navigate to <code class="select-all bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 text-xs font-mono">chrome://flags/#optimization-guide-on-device-model</code>
              and set to <strong>Enabled BypassPerfRequirement</strong>
            </li>
            <li>
              Navigate to <code class="select-all bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 text-xs font-mono">chrome://flags/#prompt-api-for-gemini-nano</code>
              and set to <strong>Enabled</strong>
            </li>
            <li>Relaunch Chrome</li>
          </ol>
        </div>
      </div>`;
    },

    onActivate(): void {
      // Re-check each time tab is activated (don't use cached false)
      available = null;
      checkAvailability().then((ready) => {
        const availEl = document.getElementById("nano-available");
        const unavailEl = document.getElementById("nano-unavailable");
        if (availEl) availEl.classList.toggle("hidden", !ready);
        if (unavailEl) unavailEl.classList.toggle("hidden", ready);
      });
    },

    destroy(): void {
      session?.destroy();
      session = null;
    },

    set onStatus(cb: ((html: string) => void) | undefined) {
      onStatusCb = cb;
    },

    get onStatus(): ((html: string) => void) | undefined {
      return onStatusCb;
    },
  };
}
