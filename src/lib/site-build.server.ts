// High-level helper that goes from a user prompt -> generated files -> ZIP
// uploaded to Supabase Storage -> live Netlify deployment. Used by the chat
// build_website tool and by the /sites page.

import JSZip from "jszip";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateSiteFiles, type GeneratedFile } from "./site-generator.server";
import { deployToNetlify } from "./netlify.server";

export type BuildResult = {
  siteId: string;
  liveUrl: string;
  zipUrl: string;
  zipPath: string;
  fileCount: number;
};

async function packageZip(files: GeneratedFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.content);
  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return buf;
}

export async function buildAndDeploySite(opts: {
  userId: string;
  name: string;
  prompt: string;
  styleNotes?: string;
  businessContext?: string;
}): Promise<BuildResult> {
  const { userId, name, prompt, styleNotes, businessContext } = opts;

  // 1. Insert row early so failures are visible in /sites.
  const { data: site, error: insertErr } = await supabaseAdmin
    .from("user_sites")
    .insert({
      user_id: userId,
      name,
      prompt,
      style_notes: styleNotes ?? null,
      status: "generating",
    })
    .select("id")
    .single();
  if (insertErr || !site) throw new Error(insertErr?.message ?? "Failed to create site row");

  try {
    // 2. Generate Next.js project via AI.
    const files = await generateSiteFiles({ name, prompt, styleNotes, businessContext });

    // 3. Package ZIP and upload to artifacts bucket.
    const zipBytes = await packageZip(files);
    const safe = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "site";
    const zipPath = `${userId}/sites/${site.id}-${safe}.zip`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("artifacts")
      .upload(zipPath, zipBytes, { contentType: "application/zip", upsert: true });
    if (upErr) throw new Error(`ZIP upload failed: ${upErr.message}`);

    await supabaseAdmin
      .from("user_sites")
      .update({ files: files as any, status: "deploying" })
      .eq("id", site.id);

    // 4. Deploy to Netlify.
    const dep = await deployToNetlify({ name, files });

    await supabaseAdmin
      .from("user_sites")
      .update({
        deployment_url: dep.url,
        vercel_project_id: dep.projectId ?? null,
        status: "live",
        last_error: null,
      })
      .eq("id", site.id);

    const zipUrl = `/api/files/${encodeURIComponent(zipPath)}`;

    return {
      siteId: site.id,
      liveUrl: dep.url,
      zipUrl,
      zipPath,
      fileCount: files.length,
    };
  } catch (e: any) {
    await supabaseAdmin
      .from("user_sites")
      .update({ status: "failed", last_error: e?.message ?? String(e) })
      .eq("id", site.id);
    throw e;
  }
}
