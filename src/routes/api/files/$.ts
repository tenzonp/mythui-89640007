// Proxy download route for stored files. Hides the underlying storage
// signed URL from the UI and gives us a clean /api/files/<path> link.
//
// Paths look like "<userId>/<timestamp>-<name>" or
// "<userId>/uploads/<timestamp>-<name>" — already unguessable since they
// include the user UUID + millisecond timestamp.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "artifacts";

function guessMime(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".svg")) return "image/svg+xml";
  if (n.endsWith(".csv")) return "text/csv";
  if (n.endsWith(".json")) return "application/json";
  if (n.endsWith(".txt") || n.endsWith(".md")) return "text/plain";
  if (n.endsWith(".html")) return "text/html";
  if (n.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (n.endsWith(".pptx"))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

export const Route = createFileRoute("/api/files/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const splat = (params as any)._splat ?? "";
        const path = decodeURIComponent(splat);
        if (!path || path.includes("..")) {
          return new Response("Bad path", { status: 400 });
        }
        const url = new URL(request.url);
        const download = url.searchParams.get("download") === "1";
        const filename = url.searchParams.get("name") || path.split("/").pop() || "file";

        const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }
        const mime = data.type || guessMime(filename);
        const headers = new Headers({
          "Content-Type": mime,
          "Cache-Control": "private, max-age=3600",
        });
        if (download) {
          headers.set(
            "Content-Disposition",
            `attachment; filename="${filename.replace(/"/g, "")}"`,
          );
        }
        return new Response(data, { status: 200, headers });
      },
    },
  },
});
