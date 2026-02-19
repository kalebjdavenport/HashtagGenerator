declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: "edge" };

const SYSTEM_PROMPT =
  "You are a hashtag generator. Given text, return ONLY relevant hashtags separated by spaces. Each hashtag must start with #. Return between 3 and 8 hashtags. No explanations, no other text.";

const MAX_TEXT_LENGTH = 10000;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let text: string;
  let title: string;
  try {
    const body = (await req.json()) as { text?: string; title?: string };
    text = typeof body.text === "string" ? body.text.trim() : "";
    title = typeof body.title === "string" ? body.title.trim() : "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!text || text.length < 20) {
    return new Response(
      JSON.stringify({ error: "Text must be at least 20 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Truncate to prevent abuse
  const truncated = text.slice(0, MAX_TEXT_LENGTH);
  const userMessage = title
    ? `Title: ${title}\n\nText: ${truncated}`
    : truncated;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("OpenAI API error:", res.status, errBody);
      return new Response(
        JSON.stringify({ error: "OpenAI API request failed" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";

    // Parse hashtags from response
    const matches = content.match(/#[a-zA-Z][a-zA-Z0-9_]*/g) ?? [];
    const seen = new Set<string>();
    const hashtags: string[] = [];
    for (const tag of matches) {
      const lower = tag.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        hashtags.push(lower);
      }
    }

    return new Response(JSON.stringify({ hashtags }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
