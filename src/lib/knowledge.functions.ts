import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inferProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().max(200).optional(),
        description: z.string().min(1).max(4000),
        extra: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { inferProfileFields } = await import("./profile-infer.server");
    return await inferProfileFields(data);
  });

export const getKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadKnowledgeBundle } = await import("./knowledge.server");
    return await loadKnowledgeBundle(context.userId);
  });

export const upsertBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().max(200).optional().nullable(),
        tagline: z.string().max(300).optional().nullable(),
        description: z.string().max(4000).optional().nullable(),
        industry: z.string().max(120).optional().nullable(),
        website: z.string().max(300).optional().nullable(),
        primary_goal: z.string().max(500).optional().nullable(),
        tone: z.string().max(120).optional().nullable(),
        target_audience: z.string().max(500).optional().nullable(),
        value_props: z.array(z.string().max(200)).max(20).optional(),
        complete: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row: any = { user_id: context.userId, ...data };
    if (data.complete) row.onboarding_completed_at = new Date().toISOString();
    delete row.complete;
    const { error } = await supabaseAdmin.from("business_profile").upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(200),
        role: z.string().max(200).optional().nullable(),
        email: z.string().max(300).optional().nullable(),
        phone: z.string().max(60).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("business_team_members").insert({ user_id: context.userId, ...data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("business_team_members").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const addAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.string().min(1).max(40),
        handle: z.string().max(200).optional().nullable(),
        url: z.string().max(500).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("business_accounts").insert({ user_id: context.userId, ...data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("business_accounts").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const addEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(20000),
        tags: z.array(z.string().max(40)).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("business_knowledge_entries")
      .insert({ user_id: context.userId, title: data.title, body: data.body, tags: data.tags ?? [], source: "manual" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("business_knowledge_entries").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });
