import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERATE_COST = 1000;
const REDEPLOY_COST = 200;

async function chargeCredits(userId: string, amount: number, meta: Record<string, any>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("credit_ledger")
    .select("amount")
    .eq("user_id", userId);
  const balance = (data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
  if (balance < amount) throw new Error(`Not enough credits. Need ${amount}, have ${balance}.`);
  await supabaseAdmin.from("credit_ledger").insert({
    user_id: userId,
    kind: "spend",
    amount: -amount,
    meta,
  });
}

export const listMySites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_sites")
      .select("id, name, prompt, status, deployment_url, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    return { sites: data ?? [] };
  });

export const getSite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site } = await supabaseAdmin
      .from("user_sites")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!site) throw new Error("Not found");
    return { site };
  });

export const createAndDeploySite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(2).max(60),
        prompt: z.string().min(10).max(4000),
        styleNotes: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await chargeCredits(context.userId, GENERATE_COST, { kind: "site_generate", name: data.name });

    const { data: site, error } = await supabaseAdmin
      .from("user_sites")
      .insert({
        user_id: context.userId,
        name: data.name,
        prompt: data.prompt,
        style_notes: data.styleNotes ?? null,
        status: "generating",
      })
      .select("id")
      .single();
    if (error || !site) throw new Error(error?.message ?? "Failed to create site row");

    try {
      const { generateSiteFiles } = await import("./site-generator.server");
      const files = await generateSiteFiles({
        name: data.name,
        prompt: data.prompt,
        styleNotes: data.styleNotes,
      });

      await supabaseAdmin
        .from("user_sites")
        .update({ files, status: "deploying" })
        .eq("id", site.id);

      const { deployToNetlify } = await import("./netlify.server");
      const dep = await deployToNetlify({ name: data.name, files });

      await supabaseAdmin
        .from("user_sites")
        .update({
          deployment_url: dep.url,
          vercel_project_id: dep.projectId ?? null,
          status: "live",
          last_error: null,
        })
        .eq("id", site.id);

      return { id: site.id, url: dep.url };
    } catch (e: any) {
      await supabaseAdmin
        .from("user_sites")
        .update({ status: "failed", last_error: e?.message ?? String(e) })
        .eq("id", site.id);
      throw e;
    }
  });

export const redeploySite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site } = await supabaseAdmin
      .from("user_sites")
      .select("id, name, files, user_id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!site) throw new Error("Not found");
    await chargeCredits(context.userId, REDEPLOY_COST, { kind: "site_redeploy", site_id: site.id });
    await supabaseAdmin.from("user_sites").update({ status: "deploying" }).eq("id", site.id);
    try {
      const { deployToNetlify } = await import("./netlify.server");
      const dep = await deployToNetlify({
        name: site.name,
        files: site.files as any,
      });
      await supabaseAdmin
        .from("user_sites")
        .update({ deployment_url: dep.url, status: "live", last_error: null })
        .eq("id", site.id);
      return { url: dep.url };
    } catch (e: any) {
      await supabaseAdmin
        .from("user_sites")
        .update({ status: "failed", last_error: e?.message ?? String(e) })
        .eq("id", site.id);
      throw e;
    }
  });

export const deleteSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_sites")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });
