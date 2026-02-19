/// <reference lib="webworker" />

import { pipeline } from "@huggingface/transformers";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import {
  extractCandidates,
  cosineSimilarity,
  mmr,
  getTagCount,
  formatHashtags,
} from "./keybert.ts";

// Configuration — swap model ID here to experiment
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const MMR_LAMBDA = 0.7;
const MIN_SIMILARITY = 0.3;
const MAX_INPUT_WORDS = 2000;

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractor = (await (pipeline as any)("feature-extraction", MODEL_ID, {
    progress_callback: (data: Record<string, unknown>) => {
      self.postMessage({ type: "progress", data });
    },
  })) as FeatureExtractionPipeline;

  return extractor;
}

// Preload model immediately on worker creation
getExtractor()
  .then(() => self.postMessage({ type: "ready" }))
  .catch((err: unknown) => {
    self.postMessage({
      type: "error",
      message:
        err instanceof Error ? err.message : "Failed to load the AI model.",
    });
  });

function truncateText(text: string): string {
  const words = text.split(/\s+/);
  if (words.length <= MAX_INPUT_WORDS) return text;
  return words.slice(0, MAX_INPUT_WORDS).join(" ");
}

function toFloat32(arr: number[]): Float32Array {
  return new Float32Array(arr);
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type, text, title } = event.data as {
    type: string;
    text: string;
    title?: string;
  };

  if (type !== "generate") return;

  try {
    const ext = await getExtractor();
    const truncated = truncateText(text);

    // 1. Extract candidate n-grams from text (and title if provided)
    const candidateSource = title
      ? `${title} ${truncated}`
      : truncated;
    const candidates = extractCandidates(candidateSource);
    if (candidates.length === 0) {
      self.postMessage({ type: "results", hashtags: [] });
      return;
    }

    self.postMessage({ type: "status", message: "Analyzing your text..." });

    // 2. Embed the document — prepend title to bias toward the topic
    const docText = title
      ? `${title}. ${truncated}`
      : truncated;
    const docOutput = await ext(docText, {
      pooling: "mean",
      normalize: true,
    });
    const docList = docOutput.tolist() as number[][];
    const docEmbedding = toFloat32(docList[0]);

    // 3. Embed all candidates in a batch
    const candidateOutput = await ext(candidates, {
      pooling: "mean",
      normalize: true,
    });
    const candidateList = candidateOutput.tolist() as number[][];
    const candidateEmbeddings = candidateList.map(toFloat32);

    // 4. Compute cosine similarities to document
    const docSimilarities = candidateEmbeddings.map((emb) =>
      cosineSimilarity(emb, docEmbedding),
    );

    // 5. Apply MMR diversification
    const wordCount = truncated.split(/\s+/).filter(Boolean).length;
    const { max: topN } = getTagCount(wordCount);
    const selectedIndices = mmr(
      docSimilarities,
      candidateEmbeddings,
      MMR_LAMBDA,
      topN,
      MIN_SIMILARITY,
    );

    // 6. Format as hashtags
    const selectedPhrases = selectedIndices.map((i) => candidates[i]);
    const hashtags = formatHashtags(selectedPhrases);

    self.postMessage({ type: "results", hashtags });
  } catch (err: unknown) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "An error occurred.",
    });
  }
});
