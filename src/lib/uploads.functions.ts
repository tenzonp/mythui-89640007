import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  if (n.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (n.endsWith(".pptx"))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

async function readPdfMeta(bytes: Uint8Array) {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    return {
      pageCount: doc.getPageCount(),
      title: doc.getTitle() || undefined,
      author: doc.getAuthor() || undefined,
    };
  } catch {
    return { pageCount: undefined as number | undefined };
  }
}

export const uploadAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; dataBase64: string; mime?: string }) => d)
  .handler(async ({ data, context }) => {
    const safe = data.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "upload.bin";
    const mime = data.mime || guessMime(safe);
    const path = `${context.userId}/uploads/${Date.now()}-${safe}`;
    const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 20 * 1024 * 1024) {
      throw new Error("File too large (max 20MB)");
    }
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(error.message);

    const isImage = mime.startsWith("image/");
    const isPdf = mime.includes("pdf");
    const pdfMeta = isPdf ? await readPdfMeta(bytes) : { pageCount: undefined };

    const url = `/api/files/${encodeURIComponent(path)}`;
    return {
      name: safe,
      path,
      url,
      mime,
      size: bytes.byteLength,
      isImage,
      isPdf,
      pageCount: pdfMeta.pageCount,
      title: (pdfMeta as any).title,
      author: (pdfMeta as any).author,
    };
  });
