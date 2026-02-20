import type {
  GenerationMethod,
  GenerationInput,
  GenerationResult,
} from "../types.ts";
import { parseHashtags } from "../utils/parse-hashtags.ts";
import { spinnerStatus } from "../utils/status-html.ts";

import { CreateMLCEngine, type MLCEngineInterface } from "@mlc-ai/web-llm";

const MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

const MAX_HASHTAGS = 10;

const SYSTEM_PROMPT = `Extract 8 hashtags from the article. Output only hashtags separated by spaces on a single line, nothing else. Capture specific ideas and arguments, not broad topics. Every hashtag must start with a noun or adjective, never a verb, adverb, or filler word.

Format: #word #word #word #word #word #word #word #word
Do not number them. Do not add explanations.

Input: Stop measuring developers by lines of code. The best engineers don't ship more, they ship less. They simplify systems, delete unused features, and push back on unnecessary requirements. A team's real output is not volume, it is the impact of what they choose to build. The best decision is often choosing not to build something at all.
Output: #devproductivity #lessismore #impactoveroutput #scopereduction #codequality #featurecreep #simplicity #engineeringmetrics

Input: Remote teams consistently outperform office teams when they lean into asynchronous communication. Deep work demands long uninterrupted focus blocks that open offices destroy. Most meetings could be a document. Writing decisions down creates a searchable record and lets people contribute on their own schedule instead of synchronizing calendars.
Output: #remotework #asyncfirst #deepwork #documentculture #writtenrecords #focustime #meetingfree #teamcommunication

Input: Microservices sound great in conference talks but most teams adopt them too early. A well-structured monolith handles more traffic than people expect and is far easier to debug. Distributed systems introduce network failures, data consistency headaches, and operational complexity that small teams cannot afford. Start simple and split services only when you have a clear proven reason to do so.
Output: #monolithfirst #microservices #systemdesign #scalability #operationalcomplexity #distributedsystems #startsimple #technicaldebt`;

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
      "Runs Llama-3.2-3B locally in your browser via WebGPU. No data sent to any server.",

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
        max_tokens: 150,
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
                 <p>Uses <strong>Llama-3.2-3B</strong> running locally in your browser via WebGPU. Your text never leaves your device.</p>
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
