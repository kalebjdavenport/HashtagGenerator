import type {
  GenerationMethod,
  GenerationInput,
  GenerationResult,
} from "../types.ts";

function parseHashtags(raw: string): string[] {
  const matches = raw.match(/#[a-zA-Z][a-zA-Z0-9_]*/g);
  if (!matches) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of matches) {
    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }
  return result;
}

export function createOpenaiMethod(): GenerationMethod {
  let onStatusCb: ((html: string) => void) | undefined;

  return {
    id: "openai",
    label: "OpenAI",
    description: "Uses GPT-4o-mini via server proxy. Requires internet connection.",

    isAvailable(): boolean {
      return true; // Always available (server-side key)
    },

    async generate(input: GenerationInput): Promise<GenerationResult> {
      onStatusCb?.(
        `<div class="flex items-center gap-2 text-sm text-buffer-muted">
          <svg class="spinner w-4 h-4 shrink-0 text-buffer-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="15" />
          </svg>
          <span>Generating with OpenAI...</span>
        </div>`,
      );

      const start = Date.now();

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.text, title: input.title }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `OpenAI request failed (${res.status}): ${body || res.statusText}`,
        );
      }

      const data = (await res.json()) as { hashtags: string[] };
      const hashtags = data.hashtags.every((t: string) => t.startsWith("#"))
        ? data.hashtags.map((t: string) => t.toLowerCase())
        : parseHashtags(data.hashtags.join(" "));

      const durationMs = Date.now() - start;

      return { hashtags, durationMs, method: "openai" };
    },

    renderPanel(): string {
      return `<div class="text-sm text-buffer-muted py-2">
        <p>Uses OpenAI's <strong>GPT-4o-mini</strong> model via a server-side proxy. Your text is sent to OpenAI's API for processing.</p>
        <p class="mt-1 text-xs text-buffer-muted/70">Requires an internet connection. The API key is stored securely on the server.</p>
      </div>`;
    },

    set onStatus(cb: ((html: string) => void) | undefined) {
      onStatusCb = cb;
    },

    get onStatus(): ((html: string) => void) | undefined {
      return onStatusCb;
    },
  };
}
