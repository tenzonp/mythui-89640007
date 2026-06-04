import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("support_tickets")
      .select("id, subject, status, priority, last_message_at, created_at")
      .eq("user_id", context.userId)
      .order("last_message_at", { ascending: false });
    return { tickets: data ?? [] };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ subject: z.string().min(2).max(200), body: z.string().min(2).max(5000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({ user_id: context.userId, subject: data.subject })
      .select("id")
      .single();
    if (error || !ticket) throw new Error(error?.message ?? "Failed to create ticket");
    await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: context.userId,
      is_staff: false,
      body: data.body,
    });
    return { id: ticket.id };
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, subject, status, priority, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!ticket) throw new Error("Not found");
    const { data: isAdminRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!isAdminRow;
    if (!isAdmin && ticket.user_id !== context.userId) throw new Error("Forbidden");
    const { data: messages } = await supabaseAdmin
      .from("ticket_messages")
      .select("id, sender_id, is_staff, body, created_at")
      .eq("ticket_id", data.id)
      .order("created_at", { ascending: true });
    return { ticket, messages: messages ?? [], isAdmin };
  });

export const replyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ticketId: z.string().uuid(), body: z.string().min(1).max(5000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new Error("Not found");
    const { data: isAdminRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!isAdminRow;
    if (!isAdmin && ticket.user_id !== context.userId) throw new Error("Forbidden");
    await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: data.ticketId,
      sender_id: context.userId,
      is_staff: isAdmin,
      body: data.body,
    });
    await supabaseAdmin
      .from("support_tickets")
      .update({
        last_message_at: new Date().toISOString(),
        status: isAdmin ? "answered" : "open",
      })
      .eq("id", data.ticketId);
    return { ok: true };
  });

export const adminListTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, subject, status, priority, last_message_at, created_at")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: tickets } = await q;
    const userIds = Array.from(new Set((tickets ?? []).map((t) => t.user_id)));
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, display_name").in("id", userIds)
      : { data: [] as any[] };
    const map = new Map(profiles?.map((p: any) => [p.id, p]) ?? []);
    return {
      tickets: (tickets ?? []).map((t) => ({
        ...t,
        userEmail: map.get(t.user_id)?.email ?? null,
        userName: map.get(t.user_id)?.display_name ?? null,
      })),
    };
  });

export const adminSetTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "answered", "closed"]).optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status?: string; priority?: string } = {};
    if (data.status) patch.status = data.status;
    if (data.priority) patch.priority = data.priority;
    if (Object.keys(patch).length === 0) return { ok: true };
    await supabaseAdmin.from("support_tickets").update(patch).eq("id", data.id);
    return { ok: true };
  });

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });
