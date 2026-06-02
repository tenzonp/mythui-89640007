import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeTool } from "@/lib/composio.server";

// Meta/Instagram Messaging webhook.
// - GET: subscription verification (hub.challenge)
// - POST: incoming messages from users — reopens their 24h window and
//   auto-flushes any queued replies for that sender.

function extractByKeys(value: any, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [k, v] of Object.entries(value)) {
    if (keys.includes(k.toLowerCase()) && typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const found = extractByKeys(v, keys);
      if (found) return found;
    }
  }
  return null;
}

function detectWindowClosed(res: any) {
  const text = typeof res === "string" ? res : JSON.stringify(res ?? {});
  return text.includes("2534022") || /outside.*(24|allowed).*window/i.test(text);
}

async function flushPendingForRecipient(recipientId: string) {
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("instagram_pending_replies")
    .select("id, user_id, message_text, tool_slug, raw_error")
    .eq("recipient_id", recipientId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error || !rows?.length) return { flushed: 0 };

  let flushed = 0;
  // Group by user_id; stop that user's queue on first still-blocked/failure.
  const blockedUsers = new Set<string>();
  for (const row of rows) {
    if (blockedUsers.has(row.user_id)) continue;
    if (!row.tool_slug) continue;

    const rawArgs = row.raw_error?.arguments ?? {};
    const toolArgs = { ...rawArgs };
    const hasMsg = extractByKeys(toolArgs, [
      "message", "message_text", "messagetext", "text", "content", "body", "reply",
    ]);
    if (!hasMsg) toolArgs.message = row.message_text;

    try {
      const res = await executeTool(row.tool_slug, row.user_id, toolArgs);
      if (detectWindowClosed(res)) {
        blockedUsers.add(row.user_id);
        await (supabaseAdmin as any)
          .from("instagram_pending_replies")
          .update({
            last_error: "Instagram 24-hour window still closed at webhook flush.",
            raw_error: { raw: res, arguments: toolArgs },
          })
          .eq("id", row.id);
        continue;
      }
      await (supabaseAdmin as any)
        .from("instagram_pending_replies")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          reopened_at: new Date().toISOString(),
          raw_error: { raw: res, arguments: toolArgs },
        })
        .eq("id", row.id);
      flushed++;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const blocked = msg.includes("2534022") || /24.?hour/i.test(msg);
      if (blocked) blockedUsers.add(row.user_id);
      await (supabaseAdmin as any)
        .from("instagram_pending_replies")
        .update({
          status: blocked ? "pending" : "failed",
          last_error: msg,
          raw_error: { error: msg, arguments: toolArgs },
        })
        .eq("id", row.id);
    }
  }
  return { flushed };
}

function collectSenderIds(payload: any): string[] {
  const ids = new Set<string>();
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const m of messaging) {
      const sender = m?.sender?.id;
      // Ignore echoes (messages WE sent).
      if (sender && !m?.message?.is_echo) ids.add(String(sender));
    }
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const c of changes) {
      const from = c?.value?.from?.id || c?.value?.sender?.id;
      if (from) ids.add(String(from));
    }
  }
  return [...ids];
}

export const Route = createFileRoute("/api/public/instagram/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.INSTAGRAM_VERIFY_TOKEN;
        if (mode === "subscribe" && expected && token === expected && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        let payload: any = null;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const senderIds = collectSenderIds(payload);
        let totalFlushed = 0;
        for (const sid of senderIds) {
          try {
            const r = await flushPendingForRecipient(sid);
            totalFlushed += r.flushed;
          } catch (e) {
            console.error("[ig-webhook] flush failed", sid, e);
          }
        }

        // Always 200 so Meta doesn't disable the subscription.
        return Response.json({ ok: true, senders: senderIds.length, flushed: totalFlushed });
      },
    },
  },
});
