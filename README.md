# AI Hashtag Generator

A privacy-first hashtag generator that runs entirely in your browser. Paste any article, blog post, or text and get relevant hashtags instantly — no server, no signup, no data leaves your device.

Three AI methods let you compare results side by side:

| Method | Model | Download | How it runs |
|--------|-------|----------|-------------|
| **KeyBERT** | all-MiniLM-L6-v2 | ~23 MB | Web Worker + WASM |
| **Chrome AI** | Gemini Nano | Ships with Chrome | Browser process |
| **WebLLM** | Llama-3.2-3B | ~1.4 GB | WebGPU (GPU compute) |

## Getting Started

```bash
npm install
npm run dev
```

Open the dev server URL in your browser. All three methods work locally — no API keys needed.

## Production Build

```bash
npm run build
npm run preview
```

## How It Works

1. Paste text (or upload a `.txt` file) and optionally add a title
2. Switch between the three method tabs
3. Click **Generate Hashtags** — results appear with timing info
4. Click a hashtag to copy it, or **Copy All** at once
5. Form input, selected tab, and results persist across page reloads via localStorage

### KeyBERT (Web Worker + WASM)

A KeyBERT-style pipeline using [Transformers.js](https://huggingface.co/docs/transformers.js). Runs in a Web Worker so the main thread stays free.

1. Extract 1-2 word n-gram candidates, filter stop words
2. Embed the document and candidates using `all-MiniLM-L6-v2`
3. Rank by cosine similarity to the document
4. Diversify with Maximal Marginal Relevance (MMR)
5. Format as `#hashtag`

### Chrome AI (Gemini Nano)

Uses Chrome's built-in `LanguageModel` Prompt API. The model runs in a separate browser process — not in page JavaScript. Requires Chrome 127+ with flags:

1. `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
2. `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
3. Relaunch Chrome

### WebLLM (Llama-3.2-3B via WebGPU)

Uses [WebLLM](https://github.com/mlc-ai/web-llm) to run Llama-3.2-3B-Instruct locally via WebGPU. All inference happens on the GPU — the main thread only submits work and awaits results. Requires Chrome/Edge 113+.

The system prompt uses few-shot examples to guide the model toward specific, argument-level hashtags rather than broad topic words.

## Architecture

All methods implement a common `GenerationMethod` interface, making it straightforward to add new methods:

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

### Off-main-thread design

No AI inference runs on the main thread. The UI stays responsive during generation.

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

| Method | Where inference runs | Mechanism |
|--------|---------------------|-----------|
| **KeyBERT** | Web Worker | `postMessage()` sends text to worker; worker runs WASM inference and posts hashtags back |
| **Chrome AI** | Separate browser process | Chrome's `LanguageModel` API is async; the LLM runs in an isolated process managed by the browser |
| **WebLLM** | GPU via WebGPU | MLC Engine dispatches compute shaders to the GPU; main thread only submits work and awaits the result |

## Project Structure

```
├── index.html                  # Static HTML shell (form inlined to prevent layout shift)
├── vite.config.ts              # Vite + Tailwind v4 config
├── public/
│   ├── favicon.svg             # SVG favicon (hashtag icon)
│   └── favicon.png             # PNG fallback (192x192)
├── src/
│   ├── main.ts                 # App coordinator: wires methods, tabs, persistence
│   ├── types.ts                # GenerationMethod interface, MethodId, GenerationResult
│   ├── storage.ts              # localStorage: save/load/clear with debounced writes
│   ├── clipboard.ts            # Clipboard API with legacy execCommand fallback
│   ├── vitals.ts               # Web Vitals monitoring (dev only)
│   ├── style.css               # Tailwind v4 + Buffer theme + component styles
│   ├── keybert.ts              # Pure functions: candidate extraction, cosine similarity, MMR
│   ├── stopwords.ts            # English stop word list
│   ├── worker.ts               # Web Worker: model loading, embedding pipeline
│   ├── ui/
│   │   ├── form.ts             # FormElements type + DOM queries + file upload
│   │   ├── tabs.ts             # Accessible tab component (ARIA, keyboard nav)
│   │   └── results.ts          # Hashtag chip rendering, copy feedback, timing display
│   ├── methods/
│   │   ├── keybert.ts          # Worker lifecycle wrapped in GenerationMethod
│   │   ├── nano.ts             # Chrome AI detection + session + availability banner
│   │   └── webllm.ts           # MLC Engine lifecycle + WebGPU detection
│   └── utils/
│       ├── parse-hashtags.ts   # Shared hashtag parser (regex + fallback)
│       └── status-html.ts      # Spinner/status HTML helper
```

## Privacy

All three methods run entirely in your browser. No text is ever sent to any server. The only network requests are one-time model downloads (KeyBERT from Hugging Face CDN, WebLLM from MLC CDN), which are cached by the browser for future visits.

## Browser Support

| Method | Browsers |
|--------|----------|
| **KeyBERT** | Chrome/Edge 90+, Firefox 90+, Safari 15+ |
| **Chrome AI** | Chrome 127+ with experimental flags |
| **WebLLM** | Chrome/Edge 113+ (WebGPU required) |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |
| `npm run lighthouse` | Run Lighthouse audit with HTML report |
