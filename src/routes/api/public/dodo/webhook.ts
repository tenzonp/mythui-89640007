import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tierFromProductId, monthlyCreditsFor } from "@/lib/dodo.server";

// Dodo (Svix-style) webhook signature verification.
// Headers: webhook-id, webhook-timestamp, webhook-signature
// Signed payload: `${id}.${timestamp}.${body}` with HMAC-SHA256 using secret
// (base64 portion after "whsec_").
function verifyDodoSignature(opts: {
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  body: string;
  secret: string;
}) {
  const { id, timestamp, signatureHeader, body, secret } = opts;
  if (!id || !timestamp || !signatureHeader) return false;
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    key = Buffer.from(raw);
  }
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  // header: "v1,<sig> v1,<sig2>"
  const parts = signatureHeader.split(" ");
  for (const p of parts) {
    const [, sig] = p.split(",");
    if (!sig) continue;
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {}
  }
  return false;
}

export const Route = createFileRoute("/api/public/dodo/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.DODO_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret not configured", { status: 500 });

        const body = await request.text();
        const ok = verifyDodoSignature({
          id: request.headers.get("webhook-id"),
          timestamp: request.headers.get("webhook-timestamp"),
          signatureHeader: request.headers.get("webhook-signature"),
          body,
          secret,
        });
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const type: string = payload.type ?? payload.event_type ?? "";
        const data = payload.data ?? payload;
        const userId: string | undefined =
          data?.metadata?.user_id ?? data?.subscription?.metadata?.user_id;
        const productId: string | undefined =
          data?.product_id ?? data?.subscription?.product_id ?? data?.items?.[0]?.product_id;
        const subscriptionId: string | undefined =
          data?.subscription_id ?? data?.id ?? data?.subscription?.id;

        const tier = tierFromProductId(productId);

        if (!userId) {
          // Nothing to map — acknowledge so Dodo doesn't retry forever.
          return new Response("ok (no user_id)", { status: 200 });
        }

        if (
          tier &&
          (type.startsWith("subscription.active") ||
            type.startsWith("subscription.renewed") ||
            type === "payment.succeeded")
        ) {
          const credits = monthlyCreditsFor(tier);
          const next = new Date();
          next.setUTCDate(next.getUTCDate() + 30);

          await supabaseAdmin
            .from("user_plans")
            .upsert(
              {
                user_id: userId,
                tier,
                monthly_credits: credits,
                renews_at: next.toISOString(),
                dodo_subscription_id: subscriptionId ?? null,
              },
              { onConflict: "user_id" },
            );

          await supabaseAdmin.from("credit_ledger").insert({
            user_id: userId,
            kind: "grant_monthly",
            amount: credits,
            meta: {
              tier,
              source: "dodo",
              event: type,
              subscription_id: subscriptionId,
            },
          });
        }

        if (type.startsWith("subscription.cancelled") || type.startsWith("subscription.failed")) {
          await supabaseAdmin
            .from("user_plans")
            .update({ tier: "free", monthly_credits: 0, renews_at: null })
            .eq("user_id", userId);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
