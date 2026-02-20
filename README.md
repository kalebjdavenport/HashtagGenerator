# AI Hashtag Generator

Generate relevant hashtags from any text using three local AI methods — compare results side by side and pick the best. Everything runs in your browser.

| Method | Model | Size | Privacy |
|--------|-------|------|---------|
| **KeyBERT** | all-MiniLM-L6-v2 (Transformers.js) | ~23 MB | Local — text never leaves your device |
| **Chrome AI** | Gemini Nano (built into Chrome) | Ships with Chrome | Local — text never leaves your device |
| **WebLLM** | Llama-3.2-3B (WebGPU) | ~1.4 GB | Local — text never leaves your device |

## How It Works

1. Paste text (or upload a `.txt` file) and optionally add a title
2. Switch between the three method tabs to choose a generation approach
3. Click **Generate Hashtags** — results appear with timing info
4. Click a hashtag to copy it, or **Copy All** at once
5. Your form input, selected tab, and results per method are saved to localStorage and restored on reload

### KeyBERT (local NLP)

A KeyBERT-style algorithm powered by [Transformers.js](https://huggingface.co/docs/transformers.js). The `all-MiniLM-L6-v2` model (~23 MB) downloads from the Hugging Face CDN on first use and is cached by the browser. Runs in a Web Worker to keep the UI responsive.

1. **Candidate extraction** — Generate 1–3 word n-grams, filter stop words, deduplicate
2. **Embedding** — Encode the document and all candidates using a sentence-transformer model
3. **Ranking** — Score candidates by cosine similarity to the document embedding
4. **Diversification** — Apply Maximal Marginal Relevance (MMR) to avoid near-synonyms
5. **Formatting** — Convert top candidates to `#hashtag` format

### Chrome AI (Gemini Nano)

Uses Chrome's built-in `LanguageModel` Prompt API to generate hashtags locally. Requires Chrome 127+ with experimental flags enabled:

1. Navigate to `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
2. Navigate to `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
3. Relaunch Chrome

### WebLLM (Llama-3.2-3B)

Uses [WebLLM](https://github.com/mlc-ai/web-llm) to run Llama-3.2-3B-Instruct locally in the browser via WebGPU. The model (~1.4 GB) downloads on first use and is cached. Requires a WebGPU-capable browser (Chrome 113+, Edge 113+).

## Getting Started

```bash
npm install
npm run dev
```

Open the dev server URL in your browser. All three methods work locally — no API keys or server configuration needed.

## Building for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
├── index.html                # Semantic HTML with SEO/structured data
├── vite.config.ts            # Vite config (Tailwind, ES module workers)
├── src/
│   ├── main.ts               # App coordinator: wires methods, tabs, persistence
│   ├── types.ts              # GenerationMethod interface, MethodId, GenerationResult
│   ├── storage.ts            # localStorage: save/load/clear with debounce
│   ├── ui/
│   │   ├── tabs.ts           # Accessible tab component (ARIA, keyboard nav)
│   │   ├── form.ts           # Form HTML template + element helpers
│   │   └── results.ts        # Hashtag rendering, copy, timing display
│   ├── utils/
│   │   ├── parse-hashtags.ts # Shared hashtag parser (regex + fallback)
│   │   └── status-html.ts    # Shared spinner/status HTML helper
│   ├── methods/
│   │   ├── keybert.ts        # Worker lifecycle wrapped in GenerationMethod
│   │   ├── nano.ts           # Chrome AI detection + session + fallback banner
│   │   └── webllm.ts         # WebLLM engine lifecycle + WebGPU detection
│   ├── worker.ts             # Web Worker: model loading, embedding pipeline
│   ├── keybert.ts            # Pure functions: candidate extraction, cosine similarity, MMR
│   ├── stopwords.ts          # English stop word list
│   ├── clipboard.ts          # Clipboard API with legacy fallback
│   ├── vitals.ts             # Web Vitals monitoring (dev only)
│   └── style.css             # Theme, tab styles, animations
```

## Architecture

All three methods implement a common `GenerationMethod` interface (`src/types.ts`), making it straightforward to add new methods:

```typescript
interface GenerationMethod {
  id: MethodId;
  label: string;
  isAvailable(): boolean;
  generate(input: GenerationInput): Promise<GenerationResult>;
  renderPanel(): string;
  onActivate?(): void;
  destroy?(): void;
}
```

### How it stays off the main thread

Every AI method runs its heavy computation outside the main thread, keeping the UI responsive at all times. No inference work happens on the main thread — it only coordinates inputs, displays results, and manages state.

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                            │
│                                                                     │
│  ┌───────────────────────────────────────┐                          │
│  │         MAIN THREAD                   │                          │
│  │                                       │                          │
│  │  index.html ──► main.ts               │                          │
│  │   (static      (attach listeners,     │                          │
│  │    form)        tabs, persistence)     │                          │
│  │         │                              │                          │
│  │         ▼                              │                          │
│  │  User pastes text + clicks Generate   │                          │
│  │         │                              │                          │
│  │         ├──────────────────────────────┼──► Web Worker (KeyBERT) │
│  │         │  postMessage(text)           │    ┌──────────────────┐ │
│  │         │                              │    │ Transformers.js  │ │
│  │         │                              │    │ (WASM runtime)   │ │
│  │         │                              │    │                  │ │
│  │         │                              │    │ 1. Extract       │ │
│  │         │                              │    │    n-grams       │ │
│  │         │                              │    │ 2. Embed doc +   │ │
│  │         │                              │    │    candidates    │ │
│  │         │                              │    │ 3. Cosine sim    │ │
│  │         │                              │    │ 4. MMR ranking   │ │
│  │         │  postMessage(hashtags)       │    │ 5. Format tags   │ │
│  │         │◄─────────────────────────────┼────┘──────────────────┘ │
│  │         │                              │                          │
│  │         ├──────────────────────────────┼──► Chrome Process       │
│  │         │  LanguageModel.prompt(text)  │    (Gemini Nano)        │
│  │         │  (async — returns Promise)   │    ┌──────────────────┐ │
│  │         │                              │    │ Built-in LLM     │ │
│  │         │                              │    │ managed by       │ │
│  │         │  Promise resolves            │    │ Chrome — runs    │ │
│  │         │◄─────────────────────────────┼────┤ in a separate    │ │
│  │         │                              │    │ browser process  │ │
│  │         │                              │    └──────────────────┘ │
│  │         │                              │                          │
│  │         ├──────────────────────────────┼──► GPU (WebLLM)         │
│  │         │  engine.chat.completions     │    ┌──────────────────┐ │
│  │         │  .create() (async)           │    │ Llama-3.2-3B     │ │
│  │         │                              │    │ via WebGPU       │ │
│  │         │                              │    │                  │ │
│  │         │                              │    │ Shader compute   │ │
│  │         │  Promise resolves            │    │ runs entirely    │ │
│  │         │◄─────────────────────────────┼────┤ on the GPU       │ │
│  │         │                              │    └──────────────────┘ │
│  │         ▼                              │                          │
│  │  parseHashtags(raw) ──► render chips  │                          │
│  │  save to localStorage                 │                          │
│  └───────────────────────────────────────┘                          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  NETWORK (first visit only — cached after)                    │  │
│  │                                                               │  │
│  │  HuggingFace CDN ──► all-MiniLM-L6-v2 (~23 MB)  ──► Cache API│  │
│  │  MLC CDN ──────────► Llama-3.2-3B-q4f16 (~1.4 GB) ► Cache API│  │
│  │  Chrome built-in ──► Gemini Nano (ships with browser)         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  PERSISTENCE (localStorage)                                   │  │
│  │  title, text, selected tab, per-method results                │  │
│  │  Versioned schema · debounced writes · restored on reload     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  No data ever leaves the browser. Zero server requests after        │
│  one-time model downloads.                                          │
└─────────────────────────────────────────────────────────────────────┘
```

**Why the main thread stays free:**

| Method | Where inference runs | Mechanism |
|--------|---------------------|-----------|
| **KeyBERT** | Web Worker (separate thread) | `postMessage()` sends text to worker; worker runs WASM inference and posts hashtags back. Main thread never touches the model. |
| **Chrome AI** | Separate browser process | Chrome's `LanguageModel` API is async. The LLM runs in an isolated process managed by the browser, not in page JavaScript. |
| **WebLLM** | GPU via WebGPU | `MLC Engine` dispatches compute shaders to the GPU. The main thread only submits work and awaits the result — all matrix math runs on GPU hardware. |

**How text is processed (no server involved):**

1. User pastes text into the `<textarea>` (or uploads a `.txt` file via `FileReader`)
2. On submit, the main thread passes the raw text to the active method's `generate()` function
3. Each method processes the text using its own off-thread approach (see diagram above)
4. Results return as a `string[]` of hashtags, which are parsed by `parseHashtags()` (regex extraction, lowercase, deduplicate) and rendered as clickable chips
5. Results are saved to `localStorage` so they persist across page reloads

Shared utilities live in `src/utils/`:
- **`parse-hashtags.ts`** — Robust hashtag parser used by both LLM methods (Chrome AI, WebLLM). Tries `#word` regex first, falls back to comma/newline splitting.
- **`status-html.ts`** — Spinner + message HTML template used by all three methods for status updates.

Session state (title, text, selected tab, per-method results) is persisted to localStorage via `src/storage.ts` with a versioned schema and debounced writes.

## Privacy

All three methods run entirely in your browser. No text is ever sent to any server. The only network requests are one-time model downloads (KeyBERT from Hugging Face CDN, WebLLM from MLC CDN), which are cached by the browser for future visits.

## Browser Support

- **KeyBERT**: Chrome/Edge 90+, Firefox 90+, Safari 15+
- **Chrome AI**: Chrome 127+ with experimental flags enabled
- **WebLLM**: Chrome/Edge 113+ (requires WebGPU)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |
| `npm run lighthouse` | Run Lighthouse audit with HTML report |
