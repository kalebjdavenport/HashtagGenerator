import type {
  GenerationMethod,
  GenerationInput,
  GenerationResult,
} from "../types.ts";
import { parseHashtags } from "../utils/parse-hashtags.ts";
import { spinnerStatus } from "../utils/status-html.ts";

import type { MLCEngineInterface } from "@mlc-ai/web-llm";

const MODEL_ID = "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC";

const MAX_HASHTAGS = 8;

const SYSTEM_PROMPT = `## Task
Extract 5 hashtags from the text.
## Format
#word #word #word #word #word
## Examples
Input: A guide to training neural networks with PyTorch
Output: #pytorch #neuralnetworks #deeplearning #machinelearning #ai
##
Input: Easy pasta recipes for busy weeknights
Output: #pasta #recipes #weeknightdinner #cooking #easymeals
##`;

function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function createWebllmMethod(): GenerationMethod {
  let engine: MLCEngineInterface | null = null;
  let engineReady = false;
  let engineLoading = false;
  let onStatusCb: ((html: string) => void) | undefined;

  async function loadEngine(): Promise<MLCEngineInterface> {
    if (engine && engineReady) return engine;
    if (engineLoading) {
      // Wait for in-progress load
      return new Promise<MLCEngineInterface>((resolve) => {
        const check = setInterval(() => {
          if (engineReady && engine) {
            clearInterval(check);
            resolve(engine);
          }
        }, 200);
      });
    }

    engineLoading = true;

    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (progress) => {
        const text = progress.text || "Loading model...";
        onStatusCb?.(
          `${spinnerStatus(text)}
          ${typeof progress.progress === "number" ? `<div class="w-full bg-buffer-light rounded-full h-1.5 mt-2">
            <div class="progress-fill bg-buffer-blue h-1.5 rounded-full" style="width: ${Math.round(progress.progress * 100)}%"></div>
          </div>` : ""}`,
        );

        // Update panel progress text
        const progressEl = document.getElementById("webllm-progress");
        if (progressEl) {
          progressEl.textContent = text;
          progressEl.classList.remove("hidden");
        }
      },
    });

    engineReady = true;
    engineLoading = false;

    // Update panel to show ready state
    const progressEl = document.getElementById("webllm-progress");
    const descEl = document.getElementById("webllm-ready");
    if (progressEl) progressEl.classList.add("hidden");
    if (descEl) descEl.classList.remove("hidden");

    onStatusCb?.("");

    return engine;
  }

  return {
    id: "webllm",
    label: "WebLLM",
    description:
      "Runs TinyLlama-1.1B locally in your browser via WebGPU. No data sent to any server.",

    isAvailable(): boolean {
      return engineReady;
    },

    async generate(input: GenerationInput): Promise<GenerationResult> {
      if (!hasWebGPU()) {
        throw new Error("WebGPU is not supported in this browser.");
      }

      onStatusCb?.(spinnerStatus("Generating with WebLLM..."));

      const start = Date.now();
      const e = await loadEngine();

      const titleLine = input.title ? `Title: ${input.title}\n` : "";
      const userMessage = `## Input\n${titleLine}${input.text}\n## Output`;

      const reply = await e.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 100,
      });

      const raw = reply.choices[0]?.message?.content ?? "";
      console.log("[WebLLM] Raw response:", raw);
      const hashtags = parseHashtags(raw, MAX_HASHTAGS);
      const durationMs = Date.now() - start;

      return { hashtags, durationMs, method: "webllm" };
    },

    renderPanel(): string {
      const webgpuOk = hasWebGPU();

      return `<div class="py-2">
        ${
          webgpuOk
            ? `<p id="webllm-progress" class="text-sm text-buffer-muted">Click <strong>Generate Hashtags</strong> or switch to this tab to start loading the model.</p>
               <div id="webllm-ready" class="text-sm text-buffer-muted hidden">
                 <p>Uses <strong>TinyLlama-1.1B</strong> running locally in your browser via WebGPU. Your text never leaves your device.</p>
               </div>`
            : `<div class="nano-banner rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
                 <p class="font-semibold text-amber-800 mb-2">WebGPU is not available</p>
                 <p class="text-amber-700">This feature requires a browser with WebGPU support (Chrome 113+, Edge 113+). Firefox and Safari do not currently support WebGPU.</p>
               </div>`
        }
      </div>`;
    },

    onActivate(): void {
      if (hasWebGPU() && !engineReady && !engineLoading) {
        loadEngine();
      }
    },

    destroy(): void {
      engine = null;
      engineReady = false;
    },

    set onStatus(cb: ((html: string) => void) | undefined) {
      onStatusCb = cb;
    },

    get onStatus(): ((html: string) => void) | undefined {
      return onStatusCb;
    },
  };
}
