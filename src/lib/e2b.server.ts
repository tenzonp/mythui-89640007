// Live sandbox VM (E2B Code Interpreter) for running real code:
// Python / Node, generating PDFs, PPTX, XLSX, charts, data crunching, etc.
//
// Files the sandbox writes to /home/user/out/ are uploaded to the private
// `artifacts` Supabase Storage bucket, and we return signed URLs (7 days).

import { Sandbox } from "@e2b/code-interpreter";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "artifacts";
const OUT_DIR = "/home/user/out";

export type Artifact = {
  name: string;
  path: string; // path inside the bucket
  url: string; // proxy URL (/api/files/...)
  size: number;
  mime: string;
  pageCount?: number;
  isImage?: boolean;
  isPdf?: boolean;
  employeeId?: string;
  employeeName?: string;
};

export type RunCodeResult = {
  ok: boolean;
  language: "python" | "javascript";
  stdout: string;
  stderr: string;
  text?: string; // last cell text result
  error?: string;
  artifacts: Artifact[];
  duration_ms: number;
};

function guessMime(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".pptx"))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (n.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (n.endsWith(".csv")) return "text/csv";
  if (n.endsWith(".json")) return "application/json";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".svg")) return "image/svg+xml";
  if (n.endsWith(".html")) return "text/html";
  if (n.endsWith(".md")) return "text/markdown";
  if (n.endsWith(".txt")) return "text/plain";
  if (n.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

async function uploadArtifact(
  userId: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<Artifact> {
  const ts = Date.now();
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${ts}-${safe}`;
  const mime = guessMime(safe);
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`Upload failed for ${fileName}: ${error.message}`);
  const isImage = mime.startsWith("image/");
  const isPdf = mime.includes("pdf");
  let pageCount: number | undefined;
  if (isPdf) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes, { updateMetadata: false });
      pageCount = doc.getPageCount();
    } catch {}
  }
  const url = `/api/files/${encodeURIComponent(path)}`;
  return { name: safe, path, url, size: bytes.byteLength, mime, isImage, isPdf, pageCount };
}

export async function runCode(opts: {
  userId: string;
  code: string;
  language?: "python" | "javascript";
  timeoutMs?: number;
  employeeId?: string;
  employeeName?: string;
}): Promise<RunCodeResult> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) throw new Error("E2B_API_KEY not configured");

  const language = opts.language ?? "python";
  const started = Date.now();
  const sandbox = await Sandbox.create({ apiKey, timeoutMs: opts.timeoutMs ?? 300_000 });

  try {
    // Ensure output dir exists, set as CWD by convention.
    await sandbox.commands.run(`mkdir -p ${OUT_DIR}`);

    // Pre-install common Python libs (each runCode call gets a fresh sandbox,
    // so we cannot rely on a previous install persisting). Run quietly; if a
    // package is already present pip is a no-op. Skip for JS.
    if (language === "python") {
      try {
        await sandbox.commands.run(
          "pip install -q reportlab python-pptx python-docx openpyxl pypdf 2>&1 | tail -n 3 || true",
          { timeoutMs: 120_000 },
        );
      } catch (e) {
        console.error("[e2b] preinstall failed (continuing):", e);
      }
    }

    let stdout = "";
    let stderr = "";
    let textResult: string | undefined;
    let errorText: string | undefined;

    // Prepend a small helper so users can also just `open(filename, "wb")`
    // and have it land in OUT_DIR by default.
    const prelude =
      language === "python"
        ? `import os\nos.chdir(${JSON.stringify(OUT_DIR)})\n`
        : `process.chdir(${JSON.stringify(OUT_DIR)});\n`;

    const exec = await sandbox.runCode(prelude + opts.code, {
      language,
      timeoutMs: 240_000,
    });
    stdout = (exec.logs?.stdout ?? []).join("");
    stderr = (exec.logs?.stderr ?? []).join("");
    if (exec.error) {
      errorText = `${exec.error.name}: ${exec.error.value}\n${exec.error.traceback ?? ""}`;
    }
    if (exec.results?.length) {
      const last = exec.results[exec.results.length - 1];
      textResult = last.text ?? undefined;
    }

    // Collect any files written into OUT_DIR and upload to Supabase Storage.
    const ls = await sandbox.commands.run(
      `find ${OUT_DIR} -maxdepth 3 -type f -size -25M -printf "%P\\n" 2>/dev/null || true`,
    );
    const files = (ls.stdout ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    const artifacts: Artifact[] = [];
    for (const rel of files) {
      try {
        const bytes = await sandbox.files.read(`${OUT_DIR}/${rel}`, { format: "bytes" });
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
        const art = await uploadArtifact(opts.userId, rel, u8);
        art.employeeId = opts.employeeId;
        art.employeeName = opts.employeeName;
        artifacts.push(art);
      } catch (e) {
        console.error("[e2b] artifact read/upload failed:", rel, e);
      }
    }

    return {
      ok: !errorText,
      language,
      stdout: stdout.slice(0, 8000),
      stderr: stderr.slice(0, 4000),
      text: textResult,
      error: errorText,
      artifacts,
      duration_ms: Date.now() - started,
    };
  } finally {
    try {
      await sandbox.kill();
    } catch {}
  }
}
