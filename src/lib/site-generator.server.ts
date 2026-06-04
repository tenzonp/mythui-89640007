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
- next.config.mjs must include images.remotePatterns allowing images.unsplash.com, images.pexels.com, cdn.pixabay.com, plus generic https. Example:
  /** @type {import('next').NextConfig} */
  export default { images: { remotePatterns: [{ protocol: "https", hostname: "**" }] } };
- tsconfig.json strict: true, moduleResolution "bundler".
- No env vars, no API routes that require secrets.
- Keep total files <= 24.
- Always include: package.json, tsconfig.json, next.config.mjs, postcss.config.js, tailwind.config.ts, app/globals.css, app/layout.tsx, app/page.tsx.

INTERNET ASSETS — USE THEM LIBERALLY:
- Images: pull real photography from Unsplash (https://images.unsplash.com/photo-...) or Pexels (https://images.pexels.com/photos/...). Pick URLs you are confident exist. Use Next.js <Image /> with width/height. Provide descriptive alt text.
- Icons: import from lucide-react (already a dependency).
- Animations: prefer framer-motion. You may also embed a Lottie animation by URL via <DotLottieReact src="https://lottie.host/..." /> only if you also add @lottiefiles/dotlottie-react to dependencies (otherwise skip Lottie).
- Videos: embed YouTube or Vimeo via <iframe>, or use <video> with a public MP4 URL from coverr.co / mixkit.co / pexels.com videos. Always include controls or autoPlay + muted + playsInline + loop for background video.
- Backgrounds: gradients, CSS, SVG, and real internet photography are all encouraged.

DESIGN QUALITY:
- Futuristic, awwwards-grade. Bold hero, custom typography pairings (Google Fonts via next/font), real micro-interactions via framer-motion, semantic sections (header, hero, features, social proof, CTA, footer), accessibility, mobile-first responsive.
- Realistic copy tailored to the user's idea and business knowledge — no lorem ipsum.

OUTPUT JSON SCHEMA:
{ "files": [ { "path": "string (relative)", "content": "string" } ] }`;

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
  if (!cleaned.some((f) => f.path === "package.json")) {
    throw new Error("AI output missing package.json");
  }
  return cleaned;
}
