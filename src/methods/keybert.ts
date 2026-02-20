import type {
  GenerationMethod,
  GenerationInput,
  GenerationResult,
} from "../types.ts";
import { spinnerStatus } from "../utils/status-html.ts";

type WorkerMessage = { type: string; [key: string]: unknown };

export function createKeybertMethod(): GenerationMethod {
  let worker: Worker | null = null;
  let modelReady = false;
  let onStatusCb: ((html: string) => void) | undefined;

  // Pending generation promise
  let pendingResolve: ((result: GenerationResult) => void) | null = null;
  let pendingReject: ((err: Error) => void) | null = null;
  let generateStartTime = 0;

  function ensureWorker(): Worker {
    if (worker) return worker;

    worker = new Worker(new URL("../worker.ts", import.meta.url), {
      type: "module",
    });

    worker.addEventListener("error", (e) => {
      console.error("KeyBERT worker error:", e);
      const errMsg = e.message || "Worker error";
      onStatusCb?.(
        `<p class="text-sm text-red-600 font-medium">Worker error: ${errMsg}</p>`,
      );
      if (pendingReject) {
        pendingReject(new Error(errMsg));
        pendingResolve = null;
        pendingReject = null;
      }
    });

    worker.addEventListener("message", (e: MessageEvent) => {
      const msg = e.data as WorkerMessage;

      switch (msg.type) {
        case "progress": {
          const data = msg.data as Record<string, unknown> | undefined;
          if (
            data &&
            typeof data.progress === "number" &&
            data.status === "progress"
          ) {
            const pct = Math.round(data.progress as number);
            const file = typeof data.file === "string" ? data.file : "";
            const shortFile = file.split("/").pop() ?? file;
            onStatusCb?.(
              `${spinnerStatus(`Downloading ${shortFile}... ${pct}%`)}
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
          onStatusCb?.(
            `<p class="text-sm text-buffer-green font-medium">AI model ready.</p>`,
          );
          setTimeout(() => onStatusCb?.(""), 3000);
          break;

        case "status":
          onStatusCb?.(spinnerStatus(msg.message as string));
          break;

        case "results": {
          const hashtags = msg.hashtags as string[];
          const durationMs = Date.now() - generateStartTime;
          if (pendingResolve) {
            pendingResolve({ hashtags, durationMs, method: "keybert" });
            pendingResolve = null;
            pendingReject = null;
          }
          break;
        }

        case "error": {
          const errMessage = (msg.message as string) || "An error occurred.";
          onStatusCb?.(
            `<p class="text-sm text-red-600">${errMessage}</p>`,
          );
          if (pendingReject) {
            pendingReject(new Error(errMessage));
            pendingResolve = null;
            pendingReject = null;
          }
          break;
        }
      }
    });

    return worker;
  }

  return {
    id: "keybert",
    label: "KeyBERT",
    description:
      "Local NLP model using semantic embeddings. Runs entirely in your browser.",

    isAvailable(): boolean {
      return modelReady;
    },

    async generate(input: GenerationInput): Promise<GenerationResult> {
      const w = ensureWorker();

      if (pendingResolve) {
        throw new Error("A generation is already in progress.");
      }

      return new Promise<GenerationResult>((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
        generateStartTime = Date.now();
        w.postMessage({ type: "generate", text: input.text, title: input.title });
      });
    },

    renderPanel(): string {
      return `<div class="text-sm text-buffer-muted py-2">
        <p>Uses a compact transformer model (<strong>all-MiniLM-L6-v2</strong>) that runs entirely in your browser via WebAssembly. Your text never leaves your device.</p>
      </div>`;
    },

    onActivate(): void {
      ensureWorker();
    },

    destroy(): void {
      worker?.terminate();
      worker = null;
      modelReady = false;
    },

    set onStatus(cb: ((html: string) => void) | undefined) {
      onStatusCb = cb;
    },

    get onStatus(): ((html: string) => void) | undefined {
      return onStatusCb;
    },
  };
}
