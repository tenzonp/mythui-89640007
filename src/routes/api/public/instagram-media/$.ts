import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "artifacts";

function signingSecret() {
  return process.env.LOVABLE_API_KEY || process.env.COMPOSIO_API_KEY || "";
}

function expectedSignature(path: string) {
  const secret = signingSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(path).digest("base64url");
}

function isValidSignature(path: string, sig: string | null) {
  if (!sig) return false;
  const expected = expectedSignature(path);
  if (!expected) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/instagram-media/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const splat = (params as any)._splat ?? "";
        const path = decodeURIComponent(splat);
        const sig = new URL(request.url).searchParams.get("sig");
        if (!path || path.includes("..") || !isValidSignature(path, sig)) {
          return new Response("Not found", { status: 404 });
        }
        if (!/^[^/]+\/instagram\/[^/]+\.jpe?g$/i.test(path)) {
          return new Response("Not found", { status: 404 });
        }

        const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(data, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      },
    },
  },
});