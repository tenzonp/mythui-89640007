// Server-only: ask the AI to fill in profile fields from free-text input.

export type InferredProfile = {
  tagline?: string;
  industry?: string;
  target_audience?: string;
  primary_goal?: string;
  tone?: string;
  value_props?: string[];
};

const SYSTEM = `You are a brand strategist. Given a business name and a free-form description of what the business does (plus optional extra notes), infer a concise brand brief.

Return ONLY valid JSON matching this exact schema (no prose, no markdown):
{
  "tagline": "string (one short punchy line, <= 80 chars)",
  "industry": "string (1-3 words, e.g. 'Coffee / F&B', 'SaaS', 'Agency')",
  "target_audience": "string (one sentence describing the ideal customer)",
  "primary_goal": "string (one sentence — best-guess primary business goal right now)",
  "tone": "string (2-4 comma-separated adjectives, e.g. 'warm, playful, premium')",
  "value_props": ["string", "string", "string"]
}

Keep it grounded in what the user said. Don't invent specifics that contradict the input.`;

export async function inferProfileFields(input: {
  name?: string;
  description: string;
  extra?: string;
}): Promise<InferredProfile> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const userMsg = `Business name: ${input.name ?? "(unknown)"}
Description: ${input.description}
${input.extra ? `Extra notes: ${input.extra}` : ""}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    const s = content.indexOf("{");
    const e = content.lastIndexOf("}");
    if (s !== -1 && e !== -1) parsed = JSON.parse(content.slice(s, e + 1));
  }
  return {
    tagline: typeof parsed.tagline === "string" ? parsed.tagline : undefined,
    industry: typeof parsed.industry === "string" ? parsed.industry : undefined,
    target_audience: typeof parsed.target_audience === "string" ? parsed.target_audience : undefined,
    primary_goal: typeof parsed.primary_goal === "string" ? parsed.primary_goal : undefined,
    tone: typeof parsed.tone === "string" ? parsed.tone : undefined,
    value_props: Array.isArray(parsed.value_props)
      ? parsed.value_props.filter((s: any) => typeof s === "string").slice(0, 6)
      : undefined,
  };
}
