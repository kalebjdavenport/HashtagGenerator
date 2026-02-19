import { STOP_WORDS } from "./stopwords.ts";

// Max characters for a hashtag (excluding #). Longer candidates get filtered out.
const MAX_HASHTAG_LENGTH = 20;

/**
 * Extract candidate n-grams (1–2 words) from text, filtering stop words.
 */
export function extractCandidates(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const candidates = new Set<string>();

  for (let n = 1; n <= 2; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const gram = words.slice(i, i + n);

      // Skip if all words are stop words
      if (gram.every((w) => STOP_WORDS.has(w))) continue;

      // Trim leading/trailing stop words
      while (gram.length > 0 && STOP_WORDS.has(gram[0])) gram.shift();
      while (gram.length > 0 && STOP_WORDS.has(gram[gram.length - 1]))
        gram.pop();

      if (gram.length === 0) continue;

      // Skip candidates that would produce overly long hashtags
      const joined = gram.join("");
      if (joined.length > MAX_HASHTAG_LENGTH) continue;

      candidates.add(gram.join(" "));
    }
  }

  return Array.from(candidates);
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Maximal Marginal Relevance: select diverse, relevant candidates.
 *
 * @param docSim - cosine similarity of each candidate to the document
 * @param candidateEmbeddings - embedding vectors for each candidate
 * @param lambda - relevance vs. diversity tradeoff (0–1, higher = more relevant)
 * @param topN - max number of results to return
 * @param minSimilarity - minimum similarity threshold to include a candidate
 * @returns indices of selected candidates
 */
export function mmr(
  docSim: number[],
  candidateEmbeddings: Float32Array[],
  lambda: number,
  topN: number,
  minSimilarity: number,
): number[] {
  const eligible = docSim
    .map((sim, idx) => ({ sim, idx }))
    .filter(({ sim }) => sim >= minSimilarity);

  if (eligible.length === 0) return [];

  const selected: number[] = [];
  const remaining = new Set(eligible.map((e) => e.idx));

  // Seed with the most relevant candidate
  const best = eligible.reduce((a, b) => (a.sim > b.sim ? a : b));
  selected.push(best.idx);
  remaining.delete(best.idx);

  while (selected.length < topN && remaining.size > 0) {
    let bestScore = -Infinity;
    let bestIdx = -1;

    for (const idx of remaining) {
      const relevance = docSim[idx];
      let maxSimToSelected = -Infinity;
      for (const selIdx of selected) {
        const sim = cosineSimilarity(
          candidateEmbeddings[idx],
          candidateEmbeddings[selIdx],
        );
        if (sim > maxSimToSelected) maxSimToSelected = sim;
      }
      const score = lambda * relevance - (1 - lambda) * maxSimToSelected;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    if (bestIdx === -1) break;
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }

  return selected;
}

/**
 * Get the target hashtag count range based on word count.
 */
export function getTagCount(wordCount: number): { min: number; max: number } {
  if (wordCount < 100) return { min: 3, max: 4 };
  if (wordCount <= 500) return { min: 4, max: 6 };
  return { min: 5, max: 8 };
}

/**
 * Convert candidate phrases to hashtag format.
 * "machine learning" → "#machinelearning"
 */
export function formatHashtags(phrases: string[]): string[] {
  return phrases
    .map((phrase) => {
      const clean = phrase.toLowerCase().replace(/[^a-z0-9]/g, "");
      return clean ? `#${clean}` : "";
    })
    .filter(Boolean);
}
