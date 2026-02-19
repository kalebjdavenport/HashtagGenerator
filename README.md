# AI Hashtag Generator

Generate relevant hashtags from any text using three AI methods — compare results side by side and pick the best.

| Method | Runs where | Privacy | Setup |
|--------|-----------|---------|-------|
| **KeyBERT** | In-browser (Web Worker) | Text never leaves your device | None |
| **Chrome AI (Gemini Nano)** | In-browser (Chrome built-in) | Text never leaves your device | Chrome flags required |
| **OpenAI (GPT-4o-mini)** | Server-side (Vercel Edge Function) | Text sent to OpenAI API | `OPENAI_API_KEY` in `.env.local` |

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

### OpenAI (GPT-4o-mini)

Calls GPT-4o-mini via a Vercel Edge Function proxy at `/api/generate`. The API key is stored server-side — never exposed to the client.

## Getting Started

```bash
npm install
npm run dev
```

This starts the Vite dev server. KeyBERT and Chrome AI work immediately. For OpenAI, you need the Vercel dev server:

```bash
# Create .env.local with your OpenAI key
echo "OPENAI_API_KEY=sk-..." > .env.local

# Run with Vercel dev (serves both Vite and the edge function)
npm run dev:vercel
```

## Building for Production

```bash
npm run build
npm run preview
```

The `api/` directory is deployed as a Vercel Edge Function automatically when using Vercel hosting.

## Project Structure

```
├── api/
│   ├── generate.ts           # Vercel Edge Function (OpenAI proxy)
│   └── tsconfig.json         # Separate TS config for edge runtime
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
│   ├── methods/
│   │   ├── keybert.ts        # Worker lifecycle wrapped in GenerationMethod
│   │   ├── nano.ts           # Chrome AI detection + session + fallback banner
│   │   └── openai.ts         # fetch to /api/generate
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

Session state (title, text, selected tab, per-method results) is persisted to localStorage via `src/storage.ts` with a versioned schema and debounced writes.

## Privacy

- **KeyBERT** and **Chrome AI**: All processing happens in your browser. No text is sent to any server.
- **OpenAI**: Text is sent to OpenAI's API via the Vercel Edge Function proxy. The API key is stored server-side.

## Browser Support

- **KeyBERT**: Chrome/Edge 90+, Firefox 90+, Safari 15+
- **Chrome AI**: Chrome 127+ with experimental flags enabled
- **OpenAI**: Any modern browser (requires internet)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run dev:vercel` | Start Vercel dev server (includes edge functions) |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |
| `npm run lighthouse` | Run Lighthouse audit with HTML report |
