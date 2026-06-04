// Server-only AI site generator. Calls the Lovable AI Gateway and asks for a
// strict JSON array of files for a Next.js 14 (app router) project.

export type GeneratedFile = { path: string; content: string };

const SYSTEM_PROMPT = `You are a senior front-end architect. Given a user's idea, you produce a COMPLETE, production-ready Next.js 14 (app router) website that is futuristic, original, visually striking, and ready to deploy to Vercel.

HARD REQUIREMENTS:
- Output ONLY valid JSON matching the requested schema. No prose, no markdown fences.
- Project must use Next.js 14 app router with TypeScript and Tailwind CSS v3.
- Use ONLY these dependencies (pin versions exactly):
  next 14.2.5, react 18.3.1, react-dom 18.3.1, typescript 5.5.4,
  tailwindcss 3.4.10, postcss 8.4.41, autoprefixer 10.4.20,
  @types/react 18.3.3, @types/react-dom 18.3.0, @types/node 20.14.10,
  framer-motion 11.3.19, lucide-react 0.427.0, clsx 2.1.1
- No external image URLs; use CSS gradients, SVG, or inline data URIs.
- No env vars, no API routes that require secrets.
- Keep total files <= 22.
- Always include: package.json, tsconfig.json, next.config.mjs, postcss.config.js, tailwind.config.ts, app/globals.css, app/layout.tsx, app/page.tsx.
- Design quality: futuristic, awwwards-grade. Custom typography pairings, bold hero, real micro-interactions via framer-motion, semantic sections, accessibility, mobile-first responsive.
- Include realistic copy tailored to the user's idea (no lorem ipsum).
- next.config.mjs must export default {}; no experimental flags.
- tsconfig.json strict: true, moduleResolution "bundler".

OUTPUT JSON SCHEMA:
{ "files": [ { "path": "string (relative)", "content": "string" } ] }`;

export async function generateSiteFiles(opts: {
  name: string;
  prompt: string;
  styleNotes?: string;
}): Promise<GeneratedFile[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const userMsg = `Project name: ${opts.name}
User idea: ${opts.prompt}
Style notes: ${opts.styleNotes ?? "(none — surprise with something futuristic and bold)"}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("AI rate limited — try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted on this workspace.");
    throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 400)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned empty content");
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to recover a JSON object from messy output
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("AI did not return JSON");
    parsed = JSON.parse(content.slice(start, end + 1));
  }
  const files = parsed.files;
  if (!Array.isArray(files) || files.length === 0) throw new Error("AI returned no files");
  const cleaned: GeneratedFile[] = files
    .filter((f: any) => f && typeof f.path === "string" && typeof f.content === "string")
    .map((f: any) => ({ path: String(f.path).replace(/^\/+/, ""), content: String(f.content) }));
  if (!cleaned.some((f) => f.path === "package.json")) {
    throw new Error("AI output missing package.json");
  }
  return cleaned;
}
