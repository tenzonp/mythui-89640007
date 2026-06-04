// Server-only AI site generator. Calls the Lovable AI Gateway and asks for a
// strict JSON array of files for a fully-static website (HTML/CSS/JS, no
// build step). The output is uploaded as-is to Netlify for instant serving.

export type GeneratedFile = { path: string; content: string };

const SYSTEM_PROMPT = `You are a senior front-end architect. Given a user's idea, you produce a COMPLETE, production-ready STATIC website (plain HTML + CSS + vanilla JS) that is futuristic, original, visually striking, and ready to serve directly from a CDN. No build step. No frameworks. No npm.

HARD REQUIREMENTS:
- Output ONLY valid JSON matching the requested schema. No prose, no markdown fences.
- The site MUST be a static site: index.html at the root, plus styles.css, optional script.js, and optional extra .html pages (about.html, contact.html, etc).
- ALWAYS include "index.html" at the project root.
- index.html must include <!doctype html>, <meta name="viewport" ...>, a unique <title>, and a <meta name="description">.
- Pull CSS resets and fonts from CDNs in <link> tags. Use Google Fonts via <link href="https://fonts.googleapis.com/..."> for custom typography pairings.
- For icons use lucide via CDN: <script src="https://unpkg.com/lucide@latest"></script> then <i data-lucide="..."></i> + <script>lucide.createIcons()</script>.
- For animations, use CSS keyframes + small vanilla JS (IntersectionObserver, requestAnimationFrame). You may use GSAP via CDN if helpful: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>.
- Keep total files <= 12.
- Add a "_redirects" file at root with the single line "/*    /index.html   200" only if you create extra HTML pages and want SPA fallback; otherwise omit it (multi-page static works fine on Netlify by default).

INTERNET ASSETS — USE THEM LIBERALLY:
- Images: pull real photography from Unsplash (https://images.unsplash.com/photo-...?w=1600&q=80) or Pexels. Use descriptive alt text. Use loading="lazy" on below-the-fold images.
- Videos: embed YouTube/Vimeo via <iframe>, or <video autoplay muted playsinline loop> with a public MP4 from coverr.co / mixkit.co.
- Backgrounds: gradients, CSS, SVG, and real internet photography are all encouraged.

DESIGN QUALITY:
- Futuristic, awwwards-grade. Bold hero, custom typography pairings, real micro-interactions, semantic sections (header, hero, features, social proof, CTA, footer), accessibility, mobile-first responsive.
- Realistic copy tailored to the user's idea and business knowledge — no lorem ipsum.

OUTPUT JSON SCHEMA:
{ "files": [ { "path": "string (relative, e.g. index.html)", "content": "string" } ] }`;

export async function generateSiteFiles(opts: {
  name: string;
  prompt: string;
  styleNotes?: string;
  businessContext?: string;
}): Promise<GeneratedFile[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const userMsg = `Project name: ${opts.name}
User idea: ${opts.prompt}
Style notes: ${opts.styleNotes ?? "(none — surprise with something futuristic and bold)"}
${opts.businessContext ? `\nBUSINESS CONTEXT (use to write real, tailored copy):\n${opts.businessContext}` : ""}`;

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
  if (!cleaned.some((f) => f.path === "index.html")) {
    throw new Error("AI output missing index.html");
  }
  return cleaned;
}
