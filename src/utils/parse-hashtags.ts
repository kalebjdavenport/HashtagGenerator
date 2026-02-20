/**
 * Parse hashtags from LLM output.
 *
 * Tries `#word` regex first. If no matches, falls back to splitting on
 * commas / newlines and formatting each chunk as a hashtag.
 * Results are lowercased and deduplicated.
 */
export function parseHashtags(raw: string, max?: number): string[] {
  const hashMatches = raw.match(/#[a-zA-Z][a-zA-Z0-9_]*/g);

  const candidates = hashMatches
    ? hashMatches.map((t) => t.toLowerCase())
    : raw
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 40)
        .map((s) => "#" + s.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter((s) => s.length > 1);

  // Deduplicate
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of candidates) {
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }

  return max ? result.slice(0, max) : result;
}
