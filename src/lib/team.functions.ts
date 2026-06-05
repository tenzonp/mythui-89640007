import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERMISSIONS = ["view", "edit_knowledge", "manage_sites", "manage_team", "send_messages"] as const;
export type Permission = (typeof PERMISSIONS)[number];

function makeToken() {
  // url-safe 32-char token
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("business_team_members")
      .select("id, name, role, phone, email, status, permissions, invite_token, invited_at, accepted_at, member_user_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { members: data ?? [] };
  });

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        role: z.string().trim().min(1).max(60),
        phone: z.string().trim().min(7).max(20).optional().or(z.literal("")),
        permissions: z.array(z.enum(PERMISSIONS)).min(1).max(10),
        sendSms: z.boolean().default(false),
        origin: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const token = makeToken();
    const { data: row, error } = await context.supabase
      .from("business_team_members")
      .insert({
        user_id: context.userId,
        name: data.name,
        role: data.role,
        phone: data.phone || null,
        permissions: data.permissions,
        status: "pending",
        invite_token: token,
        invited_at: new Date().toISOString(),
      })
      .select("id, invite_token")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to create invite");

    const link = `${data.origin.replace(/\/$/, "")}/invite/${token}`;

    let sms: { ok: boolean; error?: string } | null = null;
    if (data.sendSms && data.phone) {
      const { sendAakashSMS } = await import("./aakash.server");
      const text = `You've been invited to join the team as ${data.role} on Mythmind. Accept your invitation: ${link}`;
      const r = await sendAakashSMS({ to: data.phone, text });
      sms = { ok: r.ok, error: r.error };
    }

    return { id: row.id, link, sms };
  });

export const getInviteByToken = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("business_team_members")
      .select("id, name, role, permissions, status, user_id, member_user_id")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!row) return { invite: null as null };
    // get inviter display name
    const { data: inviter } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email")
      .eq("id", (row as any).user_id)
      .maybeSingle();
    return {
      invite: {
        id: row.id,
        name: row.name,
        role: row.role,
        permissions: row.permissions,
        status: row.status,
        alreadyClaimedByOther: !!row.member_user_id,
        inviter: inviter
          ? { name: (inviter as any).display_name ?? (inviter as any).email ?? "A teammate" }
          : { name: "A teammate" },
      },
    };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: rErr } = await supabaseAdmin
      .from("business_team_members")
      .select("id, user_id, member_user_id, status")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row) throw new Error("Invite not found or expired");
    if (row.user_id === context.userId) throw new Error("You cannot accept your own invite");
    if (row.member_user_id && row.member_user_id !== context.userId)
      throw new Error("Invite already claimed by another account");

    const { error } = await supabaseAdmin
      .from("business_team_members")
      .update({
        member_user_id: context.userId,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true, ownerId: row.user_id };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("business_team_members")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendInviteSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("business_team_members")
      .select("phone, role, invite_token")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Not found");
    if (!row.phone) throw new Error("No phone on file for this member");
    if (!row.invite_token) throw new Error("No active invite token");
    const link = `${data.origin.replace(/\/$/, "")}/invite/${row.invite_token}`;
    const { sendAakashSMS } = await import("./aakash.server");
    const r = await sendAakashSMS({
      to: row.phone,
      text: `Reminder: You've been invited as ${row.role} on Mythmind. Accept: ${link}`,
    });
    return { ok: r.ok, error: r.error, link };
  });
