# AI Hashtag Generator

A client-side hashtag generator that extracts keywords from text using AI — entirely in your browser. No data is sent to any server.

Paste text (or upload a `.txt` file), and the tool generates 3–10 relevant, diverse hashtags using a KeyBERT-style algorithm powered by [Transformers.js](https://huggingface.co/docs/transformers.js).

## How It Works

1. You paste text into the input (or upload a `.txt` file)
2. A small AI model (~23 MB, cached after first download) runs locally in a Web Worker
3. The model extracts keyword candidates and ranks them by relevance and diversity
4. You get clickable hashtags — click one to copy it, or copy all at once

The ML model (`all-MiniLM-L6-v2`) downloads from the Hugging Face CDN on first use and is cached by the browser for future visits.

## Tech Stack

- **TypeScript** + **Vite** (vanilla, no UI framework)
- **Tailwind CSS** via Play CDN
- **Transformers.js** (v3+) for in-browser ML inference
- **Web Worker** to keep the UI responsive during inference

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Building for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
├── index.html          # Semantic HTML with SEO content and mount point
├── vite.config.ts      # Vite config (ES module workers)
├── src/
│   ├── main.ts         # UI: form, events, worker communication, rendering
│   ├── worker.ts       # Web Worker: model loading, embedding pipeline
│   ├── keybert.ts      # Pure functions: candidate extraction, cosine similarity, MMR
│   ├── stopwords.ts    # English stop word list
│   ├── clipboard.ts    # Clipboard API with legacy fallback
│   └── style.css       # Minimal custom styles (animations, transitions)
```

## Algorithm

The app reimplements the core [KeyBERT](https://github.com/MaartenGr/KeyBERT) algorithm in JavaScript:

1. **Candidate extraction** — Generate 1–3 word n-grams, filter stop words, deduplicate
2. **Embedding** — Encode the document and all candidates using a sentence-transformer model
3. **Ranking** — Score candidates by cosine similarity to the document embedding
4. **Diversification** — Apply Maximal Marginal Relevance (MMR) to avoid near-synonyms
5. **Formatting** — Convert top candidates to `#hashtag` format

The number of hashtags scales with input length (3–5 for short text, up to 10 for long articles), and a minimum similarity threshold filters out low-quality results.

## Privacy

All processing happens in your browser. The only network request is the one-time model download from the Hugging Face CDN. No text is ever sent to a server.

## Browser Support

Chrome/Edge 90+, Firefox 90+, Safari 15+.
