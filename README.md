# AI Hashtag Generator

Generate relevant hashtags from any text using three local AI methods — compare results side by side and pick the best. Everything runs in your browser.

| Method | Model | Size | Privacy |
|--------|-------|------|---------|
| **KeyBERT** | all-MiniLM-L6-v2 (Transformers.js) | ~23 MB | Local — text never leaves your device |
| **Chrome AI** | Gemini Nano (built into Chrome) | Ships with Chrome | Local — text never leaves your device |
| **WebLLM** | TinyLlama-1.1B (WebGPU) | ~697 MB | Local — text never leaves your device |

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

### WebLLM (TinyLlama-1.1B)

Uses [WebLLM](https://github.com/mlc-ai/web-llm) to run TinyLlama-1.1B-Chat locally in the browser via WebGPU. The model (~697 MB) downloads on first use and is cached. Requires a WebGPU-capable browser (Chrome 113+, Edge 113+).

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
