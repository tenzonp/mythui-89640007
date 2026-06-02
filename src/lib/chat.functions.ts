import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  listToolkits,
  initiateConnection,
  listConnectedAccounts,
  deleteConnectedAccount,
  getConnectedAccount,
} from "./composio.server";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { threads: data ?? [] };
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("threads")
      .insert({ user_id: context.userId, title: data.title || "New chat" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      messages: (rows ?? []).map((r: any) => ({
        id: r.id,
        role: r.role,
        parts: r.parts,
      })),
    };
  });

// ============ Composio ============

export const listComposioToolkits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; cursor?: string }) => d)
  .handler(async ({ data }) => {
    return await listToolkits({ search: data.search, cursor: data.cursor, limit: 60 });
  });

export const listMyConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("composio_connections")
      .select("id, toolkit_slug, status, connected_account_id");
    if (error) throw new Error(error.message);
    return { connections: data ?? [] };
  });

export const listInstagramPendingReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("instagram_pending_replies")
      .select("id, recipient_id, message_text, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return { pendingReplies: data ?? [] };
  });

export const startComposioConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { toolkitSlug: string; origin: string }) => d)
  .handler(async ({ data, context }) => {
    const callbackUrl = `${data.origin}/integrations?connected=${encodeURIComponent(data.toolkitSlug)}`;
    const res = await initiateConnection({
      userId: context.userId,
      toolkitSlug: data.toolkitSlug,
      callbackUrl,
    });
    await context.supabase.from("composio_connections").upsert(
      {
        user_id: context.userId,
        toolkit_slug: data.toolkitSlug,
        connected_account_id: res.id,
        status: res.status,
        redirect_url: res.redirectUrl ?? null,
      },
      { onConflict: "user_id,toolkit_slug" },
    );
    return { redirectUrl: res.redirectUrl, status: res.status, id: res.id };
  });

export const refreshComposioStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const remote = await listConnectedAccounts(context.userId);
    const map = new Map<string, any>();
    for (const c of remote.items ?? []) {
      const slug = c.toolkit?.slug;
      if (slug) map.set(slug, c);
    }
    const { data: local } = await context.supabase
      .from("composio_connections")
      .select("id, toolkit_slug");
    for (const row of local ?? []) {
      const r = map.get(row.toolkit_slug);
      if (r) {
        await context.supabase
          .from("composio_connections")
          .update({ status: r.status, connected_account_id: r.id })
          .eq("id", row.id);
      }
    }
    return { ok: true };
  });

export const disconnectComposio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("composio_connections")
      .select("connected_account_id")
      .eq("id", data.id)
      .single();
    if (row?.connected_account_id) {
      try {
        await deleteConnectedAccount(row.connected_account_id);
      } catch (e) {
        console.error("Composio delete failed", e);
      }
    }
    await context.supabase.from("composio_connections").delete().eq("id", data.id);
    return { ok: true };
  });
