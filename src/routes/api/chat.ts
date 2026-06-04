import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  createDeepSeekProvider,
  createLovableAiGatewayProvider,
  DEEPSEEK_MAIN_MODEL,
  DEEPSEEK_SUB_MODEL,
  pickDeepSeekModel,
} from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  listToolsForToolkits,
  executeTool,
  stageFileBufferForTool,
  type ComposioTool,
} from "@/lib/composio.server";
import { webSearch, webScrape } from "@/lib/firecrawl.server";
import { runCode } from "@/lib/e2b.server";
import { agents, getAgent, type Agent } from "@/data/agents";

function createWebSearchTool() {
  return tool({
    description:
      "Search the live web for real-time / latest info (news, current events, prices, people, recent changes). Use this whenever the user asks about anything that may have changed recently or that you don't reliably know. Returns titles, URLs and snippets — cite the URLs in your answer.",
    inputSchema: jsonSchema({
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Natural language search query." },
        limit: { type: "number", description: "Max results (1-10). Default 5." },
        recency: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year"],
          description: "Optional time filter for fresh results.",
        },
      },
    }),
    execute: async (args: any) => {
      const parsed = z
        .object({
          query: z.string().min(1).max(500),
          limit: z.number().int().min(1).max(10).optional(),
          recency: z.enum(["hour", "day", "week", "month", "year"]).optional(),
        })
        .safeParse(args);
      if (!parsed.success) return { error: "Invalid arguments" };
      const tbsMap = { hour: "qdr:h", day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" } as const;
      try {
        const results = await webSearch(parsed.data.query, {
          limit: parsed.data.limit ?? 5,
          tbs: parsed.data.recency ? tbsMap[parsed.data.recency] : undefined,
        });
        return { results };
      } catch (e: any) {
        return { error: e?.message ?? "Web search failed" };
      }
    },
  });
}

function createWebFetchTool() {
  return tool({
    description:
      "Fetch a specific URL and return its main content as markdown. Use after web_search when you need the full text of a result.",
    inputSchema: jsonSchema({
      type: "object",
      required: ["url"],
      properties: { url: { type: "string", description: "Absolute URL to fetch." } },
    }),
    execute: async (args: any) => {
      const parsed = z.object({ url: z.string().url() }).safeParse(args);
      if (!parsed.success) return { error: "Invalid URL" };
      try {
        return await webScrape(parsed.data.url);
      } catch (e: any) {
        return { error: e?.message ?? "Fetch failed" };
      }
    },
  });
}

function createRunCodeTool(userId: string, employeeId?: string, employeeName?: string) {
  return tool({
    description:
      "Run real code in a live Linux sandbox VM (E2B). Use this WHENEVER the user asks you to: generate a PDF / PPTX / DOCX / XLSX / CSV / chart / image, do data analysis, run a calculation, scrape+process data, convert files, or execute arbitrary Python/JavaScript. Files you write inside the script will be uploaded automatically and returned as downloadable URLs — ALWAYS save outputs to a filename (e.g. `report.pdf`). Preinstalled Python libs include reportlab, python-pptx, python-docx, openpyxl, pandas, numpy, matplotlib, pillow, pypdf, requests. After the run, share the returned artifact URLs with the user as clickable links.",
    inputSchema: jsonSchema({
      type: "object",
      required: ["code"],
      properties: {
        code: {
          type: "string",
          description:
            "Full source code to execute. Save any output files with a clear filename (e.g. `report.pdf`, `slides.pptx`) — do NOT print binary data.",
        },
        language: {
          type: "string",
          enum: ["python", "javascript"],
          description: "Default 'python'.",
        },
      },
    }),
    execute: async (args: any) => {
      const parsed = z
        .object({
          code: z.string().min(1).max(60_000),
          language: z.enum(["python", "javascript"]).optional(),
        })
        .safeParse(args);
      if (!parsed.success) return { error: "Invalid arguments" };
      try {
        return await runCode({
          userId,
          code: parsed.data.code,
          language: parsed.data.language ?? "python",
          employeeId,
          employeeName,
        });
      } catch (e: any) {
        return { error: e?.message ?? "Sandbox execution failed" };
      }
    },
  });
}

function createGenerateImageTool(
  lovableApiKey: string,
  userId: string,
  employeeId?: string,
  employeeName?: string,
) {
  return tool({
    description:
      "Generate a NEW image from a text prompt using Lovable AI (low-cost, high quality). Use this whenever the user asks to create / make / draw / design an image, logo, flag, illustration, poster, banner, social-media graphic, or any visual. Returns an artifact with a public URL — share that URL as a markdown image link `![alt](url)` so it renders inline, and also reuse the URL in follow-up tool calls (e.g. posting to Instagram, attaching to Gmail).",
    inputSchema: jsonSchema({
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "Describe the image to generate in detail." },
        size: {
          type: "string",
          enum: ["1024x1024", "1024x1536", "1536x1024"],
          description: "Image dimensions. Default 1024x1024.",
        },
        filename: {
          type: "string",
          description: "Optional file name (without extension) for the saved image.",
        },
      },
    }),
    execute: async (args: any) => {
      const parsed = z
        .object({
          prompt: z.string().min(1).max(4000),
          size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
          filename: z.string().max(80).optional(),
        })
        .safeParse(args);
      if (!parsed.success) return { error: "Invalid arguments" };
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            "Lovable-API-Key": lovableApiKey,
            "Content-Type": "application/json",
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          body: JSON.stringify({
            model: "openai/gpt-image-2",
            prompt: parsed.data.prompt,
            quality: "low",
            size: parsed.data.size ?? "1024x1024",
            n: 1,
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          return { error: `Image generation failed (${res.status}): ${txt.slice(0, 300)}` };
        }
        const json: any = await res.json();
        const b64 = json?.data?.[0]?.b64_json;
        if (!b64) return { error: "No image returned by provider" };
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const safe = (parsed.data.filename ?? "generated")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(0, 60);
        const path = `${userId}/generated/${Date.now()}-${safe}.png`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("artifacts")
          .upload(path, bytes, { contentType: "image/png", upsert: false });
        if (upErr) return { error: upErr.message };
        const url = `/api/files/${encodeURIComponent(path)}`;
        return {
          ok: true,
          artifacts: [
            {
              name: `${safe}.png`,
              path,
              url,
              mime: "image/png",
              size: bytes.byteLength,
              isImage: true,
              employeeId,
              employeeName,
            },
          ],
          message: `Generated image saved. Share \`![${safe}](${url})\` in the reply so the user sees it inline.`,
        };
      } catch (e: any) {
        return { error: e?.message ?? "Image generation failed" };
      }
    },
  });
}

function createListRecentFilesTool(userId: string) {
  return tool({
    description:
      "List the user's stored chat artifacts/uploads so you can reuse a previous generated image, PDF, or uploaded file instead of regenerating it. Use before attaching an older file to Gmail/Instagram/Slack/etc.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum files to return. Default 20, max 50." },
      },
    }),
    execute: async (args: any) => {
      const limit = Math.max(1, Math.min(Number(args?.limit ?? 20) || 20, 50));
      const prefixes = [userId, `${userId}/generated`, `${userId}/uploads`];
      const rows: any[] = [];
      for (const prefix of prefixes) {
        const { data, error } = await supabaseAdmin.storage.from("artifacts").list(prefix, {
          limit,
          sortBy: { column: "created_at", order: "desc" },
        });
        if (error) continue;
        for (const item of data ?? []) {
          if (!item.name || !item.id) continue;
          const path = `${prefix}/${item.name}`;
          rows.push({
            name: item.name,
            path,
            url: `/api/files/${encodeURIComponent(path)}`,
            mime: guessMimeFromName(item.name),
            size: item.metadata?.size,
            created_at: item.created_at,
          });
        }
      }
      rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
      return { files: rows.slice(0, limit) };
    },
  });
}



function extractByKeys(value: any, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [key, nested] of Object.entries(value)) {
    if (keys.includes(key.toLowerCase()) && typeof nested === "string" && nested.trim()) {
      return nested.trim();
    }
    if (nested && typeof nested === "object") {
      const found = extractByKeys(nested, keys);
      if (found) return found;
    }
  }
  return null;
}

function extractInstagramRecipient(args: any) {
  return extractByKeys(args, [
    "recipient_id",
    "recipientid",
    "user_id",
    "userid",
    "ig_user_id",
    "instagram_user_id",
    "id",
  ]);
}

function extractInstagramMessage(args: any) {
  return extractByKeys(args, [
    "message",
    "message_text",
    "messagetext",
    "text",
    "content",
    "body",
    "reply",
  ]);
}

function isInstagramSendTool(t: ComposioTool) {
  const haystack = `${t.slug} ${t.name ?? ""} ${t.description ?? ""}`.toLowerCase();
  return (
    (t.toolkit?.slug ?? "").toLowerCase() === "instagram" && /send|reply|message|dm/.test(haystack)
  );
}

async function queueInstagramPendingReply(args: {
  userId: string;
  recipientId: string;
  messageText: string;
  toolSlug: string;
  raw: any;
  toolArgs: any;
}) {
  const { data, error } = await (supabaseAdmin as any)
    .from("instagram_pending_replies")
    .insert({
      user_id: args.userId,
      recipient_id: args.recipientId,
      message_text: args.messageText,
      tool_slug: args.toolSlug,
      status: "pending",
      error_subcode: 2534022,
      last_error: "Instagram 24-hour messaging window is closed for this recipient.",
      raw_error: { raw: args.raw, arguments: args.toolArgs },
      next_retry_at: null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

function buildInstagramWindowResponse(userId: string, args: any, raw: any) {
  const recipientId = extractInstagramRecipient(args);
  const messageText = extractInstagramMessage(args);
  return { recipientId, messageText, raw, userId };
}

function hasInstagram(activeSlugs: string[]) {
  return activeSlugs.some((s) => s.toLowerCase() === "instagram");
}

function createPendingInstagramReplyTool(userId: string) {
  return tool({
    description:
      "Send pending Instagram replies for a recipient after they have messaged first and reopened Meta's 24-hour window. Use only when the user says the recipient replied or asks to send queued/pending Instagram replies.",
    inputSchema: jsonSchema({
      type: "object",
      required: ["recipient_id"],
      properties: {
        recipient_id: {
          type: "string",
          description: "Instagram recipient/user ID whose pending replies should be sent.",
        },
        limit: { type: "number", description: "Maximum pending replies to send. Default 5." },
      },
    }),
    execute: async (args: any) => {
      const recipientId = String(args?.recipient_id ?? "").trim();
      if (!recipientId) return { error: "recipient_id is required" };
      const limit = Math.max(1, Math.min(Number(args?.limit ?? 5) || 5, 10));
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("instagram_pending_replies")
        .select("id, recipient_id, message_text, tool_slug, raw_error, created_at")
        .eq("user_id", userId)
        .eq("recipient_id", recipientId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) return { error: error.message };
      if (!rows?.length)
        return {
          status: "empty",
          recipient_id: recipientId,
          message: "No pending Instagram replies for this recipient.",
        };

      const results: any[] = [];
      for (const row of rows) {
        const rawArgs = row.raw_error?.arguments ?? {};
        const toolArgs = { ...rawArgs };
        const messageKey = extractByKeys(toolArgs, [
          "message",
          "message_text",
          "messagetext",
          "text",
          "content",
          "body",
          "reply",
        ])
          ? null
          : "message";
        if (messageKey) toolArgs[messageKey] = row.message_text;
        try {
          if (!row.tool_slug) {
            results.push({
              id: row.id,
              status: "failed",
              error: "Missing original Instagram send tool.",
            });
            continue;
          }
          const res = await executeTool(row.tool_slug, userId, toolArgs);
          if (detectInstagramWindowClosed(res)) {
            await (supabaseAdmin as any)
              .from("instagram_pending_replies")
              .update({
                last_error: "Instagram 24-hour window is still closed.",
                raw_error: { raw: res, arguments: toolArgs },
              })
              .eq("id", row.id)
              .eq("user_id", userId);
            results.push({ id: row.id, status: "still_blocked", error_subcode: 2534022, raw: res });
            break;
          }
          await (supabaseAdmin as any)
            .from("instagram_pending_replies")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              reopened_at: new Date().toISOString(),
              raw_error: { raw: res, arguments: toolArgs },
            })
            .eq("id", row.id)
            .eq("user_id", userId);
          results.push({ id: row.id, status: "sent", raw: res });
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          await (supabaseAdmin as any)
            .from("instagram_pending_replies")
            .update({ last_error: msg, raw_error: { error: msg, arguments: toolArgs } })
            .eq("id", row.id)
            .eq("user_id", userId);
          if (msg.includes("2534022") || /24.?hour/i.test(msg)) {
            results.push({
              id: row.id,
              status: "still_blocked",
              error_subcode: 2534022,
              error: msg,
            });
            break;
          }
          results.push({ id: row.id, status: "failed", error: msg });
        }
      }
      return {
        status: results.some((r) => r.status === "sent") ? "sent" : "blocked",
        recipient_id: recipientId,
        results,
        message: results.some((r) => r.status === "still_blocked")
          ? "The queued reply is still blocked by Instagram's 24-hour rule. Wait until this recipient sends a new message, then run pending replies again."
          : "Pending Instagram replies processed.",
      };
    },
  });
}

function normalizeToolInputSchema(raw: any, toolkitSlug?: string) {
  const schema = raw?.type ? { ...raw } : { type: "object", properties: raw ?? {} };
  if (toolkitSlug?.toLowerCase() === "gmail" && schema.properties?.attachment) {
    schema.properties = { ...schema.properties };
    schema.properties.attachment = {
      ...schema.properties.attachment,
      anyOf: [
        { type: "string", description: "Artifact URL, /api/files URL, or public URL to attach." },
        schema.properties.attachment,
      ],
    };
  }
  return schema;
}

function composioToolsToAiSdkTools(tools: ComposioTool[], userId: string) {
  const out: Record<string, any> = {};
  for (const t of tools) {
    const safeName = t.slug.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const raw =
      t.input_parameters && typeof t.input_parameters === "object"
        ? (t.input_parameters as any)
        : { type: "object", properties: {} };
    const schema = normalizeToolInputSchema(raw, t.toolkit?.slug);
    const isInstagram = (t.toolkit?.slug ?? "").toLowerCase() === "instagram";
    const isInstagramSend = isInstagramSendTool(t);
    out[safeName] = tool({
      description: `[${t.toolkit?.slug ?? ""}] ${t.description ?? t.name}${
        (t.toolkit?.slug ?? "").toLowerCase() === "gmail"
          ? " For attachments, pass an /api/files/... URL or artifact object to attachment; the app will stage it correctly. Do not pass guessed s3key values."
          : ""
      }`.slice(0, 1000),
      inputSchema: jsonSchema(schema),
      execute: async (args: any) => {
        try {
          const preparedArgs = await prepareComposioArgs(t, args ?? {});
          const res = await executeTool(t.slug, userId, preparedArgs);
          if (isInstagram && detectInstagramWindowClosed(res)) {
            const blocked = buildInstagramWindowResponse(userId, args, res);
            if (isInstagramSend && blocked.recipientId && blocked.messageText) {
              const pendingId = await queueInstagramPendingReply({
                userId,
                recipientId: blocked.recipientId,
                messageText: blocked.messageText,
                toolSlug: t.slug,
                raw: res,
                toolArgs: args ?? {},
              });
              return {
                status: "queued",
                blocker: "instagram_24h_window_closed",
                error_subcode: 2534022,
                pending_reply_id: pendingId,
                recipient_id: blocked.recipientId,
                message:
                  "Instagram's 24-hour messaging window is closed, so this reply has been saved in the pending queue. Do NOT retry now; send it after the recipient messages first and reopens the window.",
                raw: res,
              };
            }
            return {
              status: "blocked",
              blocker: "instagram_24h_window_closed",
              error_subcode: 2534022,
              recipient_id: blocked.recipientId,
              message:
                "Instagram's 24-hour messaging window is closed for this recipient. Do NOT retry this send — the recipient must message us first to reopen the window.",
              raw: res,
            };
          }
          return res;
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          if (isInstagram && (msg.includes("2534022") || /24.?hour/i.test(msg))) {
            const blocked = buildInstagramWindowResponse(userId, args, { error: msg });
            if (isInstagramSend && blocked.recipientId && blocked.messageText) {
              const pendingId = await queueInstagramPendingReply({
                userId,
                recipientId: blocked.recipientId,
                messageText: blocked.messageText,
                toolSlug: t.slug,
                raw: { error: msg },
                toolArgs: args ?? {},
              });
              return {
                status: "queued",
                blocker: "instagram_24h_window_closed",
                error_subcode: 2534022,
                pending_reply_id: pendingId,
                recipient_id: blocked.recipientId,
                message:
                  "Instagram's 24-hour messaging window is closed, so this reply has been saved in the pending queue. Do NOT retry now; send it after the recipient messages first and reopens the window.",
              };
            }
            return {
              status: "blocked",
              blocker: "instagram_24h_window_closed",
              error_subcode: 2534022,
              recipient_id: blocked.recipientId,
              message:
                "Instagram's 24-hour messaging window is closed. Do NOT retry — wait for the recipient to message us first.",
            };
          }
          return { error: msg };
        }
      },
    });
  }
  return out;
}

function detectInstagramWindowClosed(result: any): boolean {
  try {
    const s = typeof result === "string" ? result : JSON.stringify(result ?? "");
    return s.includes("2534022") || /outside.*(24|allowed).*window/i.test(s);
  } catch {
    return false;
  }
}

function guessMimeFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function storagePathFromFileUrl(value: string): string | null {
  try {
    const u = new URL(value, "https://app.local");
    const marker = "/api/files/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

async function readFileReference(value: any) {
  const raw =
    typeof value === "string" ? value : value?.url || value?.href || value?.s3key || value?.path || "";
  if (!raw || typeof raw !== "string") return null;
  const name = String(value?.name || value?.filename || raw.split("/").pop() || "attachment").replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
  const explicitMime = value?.mimetype || value?.mime || value?.mediaType;
  const storagePath = storagePathFromFileUrl(raw) || (raw.includes("/") && !/^https?:/i.test(raw) ? raw : null);
  if (storagePath) {
    const { data, error } = await supabaseAdmin.storage.from("artifacts").download(storagePath);
    if (error || !data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    return { bytes, name, mimetype: explicitMime || data.type || guessMimeFromName(name) };
  }
  if (/^https?:\/\//i.test(raw)) {
    const res = await fetch(raw);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, name, mimetype: explicitMime || res.headers.get("content-type") || guessMimeFromName(name) };
  }
  return null;
}

function findStoredImageUrlInHtml(args: any): string | null {
  const body = String(args?.body || args?.message_body || "");
  const match = body.match(/<img[^>]+src=["']([^"']*\/api\/files\/[^"']+)["'][^>]*>/i);
  return match?.[1] ?? null;
}

async function prepareComposioArgs(t: ComposioTool, args: any) {
  const toolkit = (t.toolkit?.slug ?? "").toLowerCase();
  if (toolkit !== "gmail") return args ?? {};
  const next = { ...(args ?? {}) };
  const attachmentSource = next.attachment ?? findStoredImageUrlInHtml(next);
  if (!attachmentSource) return next;
  if (Array.isArray(attachmentSource)) {
    const staged = [];
    for (const item of attachmentSource) {
      const file = await readFileReference(item);
      if (!file) continue;
      if (file.bytes.byteLength > 24 * 1024 * 1024) {
        throw new Error("Attachment is too large for Gmail (max ~24MB before encoding).");
      }
      staged.push(
        await stageFileBufferForTool({
          bytes: file.bytes,
          filename: file.name,
          mimetype: file.mimetype,
          toolSlug: t.slug,
          toolkitSlug: t.toolkit?.slug ?? "gmail",
        }),
      );
    }
    if (staged.length) next.attachment = staged.length === 1 ? staged[0] : staged;
    return next;
  }
  if (
    typeof attachmentSource === "object" &&
    typeof attachmentSource?.s3key === "string" &&
    attachmentSource?.name &&
    attachmentSource?.mimetype
  ) {
    return next;
  }
  const file = await readFileReference(attachmentSource);
  if (!file) return next;
  if (file.bytes.byteLength > 24 * 1024 * 1024) {
    throw new Error("Attachment is too large for Gmail (max ~24MB before encoding).");
  }
  next.attachment = await stageFileBufferForTool({
    bytes: file.bytes,
    filename: file.name,
    mimetype: file.mimetype,
    toolSlug: t.slug,
    toolkitSlug: t.toolkit?.slug ?? "gmail",
  });
  for (const key of ["body", "message_body"]) {
    if (typeof next[key] === "string") {
      next[key] = next[key].replace(
        /<img[^>]+src=["'][^"']*\/api\/files\/[^"']+["'][^>]*>/gi,
        `<p><strong>AI image attached:</strong> ${next.attachment.name}</p>`,
      );
    }
  }
  return next;
}

function buildAgentSystem(agent: Agent, allowedSlugs: string[], roster: string) {
  const missingForRole = agent.toolkits.filter(
    (t) => !allowedSlugs.some((s) => s.toLowerCase() === t.toLowerCase()),
  );
  const scopeNote = agent.canDelegate
    ? `As CEO you can answer strategy yourself OR delegate hands-on work to a teammate using the delegate_to_employee tool. Use it whenever the task requires a specialist's tools (instagram → Vale, sales CRMs → Bloom, support tickets → Sage, automations → Kade, product/roadmap → Reyes).\n\nCRITICAL HONESTY RULES after delegating:\n- If the result has status="blocked", status="queued", or an error, DO NOT say the task was done. Tell the user plainly what happened and what must happen next.\n- For Instagram status="queued" with blocker="instagram_24h_window_closed", explain that the reply is saved and will only send after that recipient messages first; do not retry immediately.\n- Only say work is "done" / "shipped" / "created" when the timeline shows successful tool_result entries proving the action happened.\n- Always summarize what actually happened using the timeline + result fields — never invent outcomes.`
    : `You are scoped to ${agent.role}. Only use the tools you've been given. If asked for work outside your scope, say so briefly and name the right teammate.`;

  const missingNote = missingForRole.length
    ? `Integrations your role normally uses but are NOT connected yet: ${missingForRole.join(", ")}. Ask the user to connect them on the Integrations page if needed.`
    : "";
  return `You are ${agent.name}, ${agent.role} on the Mythmind AI team.
Tagline: ${agent.tagline}
Responsibilities:
${agent.responsibilities.map((r) => `- ${r}`).join("\n")}
KPIs:
${agent.kpis.map((k) => `- ${k.label}: ${k.target}`).join("\n")}

Team roster:
${roster}

Connected integrations available to you right now: ${allowedSlugs.join(", ") || "none"}.

LIVE WEB ACCESS: You have a web_search tool (real-time web results) and a web_fetch tool (read a full page). ALWAYS use web_search for anything time-sensitive, current, "latest", "today", news, prices, recent appointments, who-is-X-now type questions, or anything you're not certain about. NEVER claim you lack web/internet access — you have it. Cite the source URLs from the results in your reply.

LIVE CODE SANDBOX: You have a run_code tool that executes Python or JavaScript in a real Linux VM. USE IT whenever the user asks to: generate a PDF, PPTX, DOCX, XLSX, CSV, chart, run data analysis, do a non-trivial calculation, scrape & process data, or "run this code". Save outputs to a filename like report.pdf (do NOT print binary). The returned artifacts array contains name and url — you MUST share every artifact URL in your reply as a markdown link, e.g. [report.pdf](URL). User files persist as stored artifacts in chat; each run_code execution is fresh, so download prior file URLs inside the same script when needed. Preinstalled Python libs: reportlab, python-pptx, python-docx, openpyxl, pandas, numpy, matplotlib, pillow, pypdf, requests — just import them, no pip install needed.

IMAGE GENERATION: You have a generate_image tool powered by Lovable AI (low-cost, high quality). Use it whenever the user wants a NEW image, logo, flag, illustration, poster, banner, avatar, or social-media graphic — do NOT use run_code for image creation. The tool returns an artifact with name and url. ALWAYS render the image inline in your reply using markdown image syntax: ![short alt](URL). If the user wants to post or email that image, reuse the SAME artifact url. For Gmail, pass the artifact url/object in the attachment field; do NOT invent or reuse an s3key. The app stages the file for Gmail automatically. Do not embed /api/files images as HTML img tags because Gmail cannot fetch private chat URLs.

${scopeNote}
${missingNote}

Be concise, warm, proactive. Speak in first person as ${agent.name}.`;
}

async function loadAgentTools(userId: string, agent: Agent, activeSlugs: string[]) {
  const allowedSlugs = agent.toolkits.length
    ? activeSlugs.filter((s) => agent.toolkits.some((t) => t.toLowerCase() === s.toLowerCase()))
    : activeSlugs;
  if (!allowedSlugs.length) return { tools: {}, allowedSlugs };
  try {
    const toolsRes = await listToolsForToolkits(userId, allowedSlugs, 25);
    const tools = composioToolsToAiSdkTools(toolsRes.items ?? [], userId);
    if (hasInstagram(allowedSlugs)) {
      tools["send_pending_instagram_replies"] = createPendingInstagramReplyTool(userId);
    }
    return {
      tools,
      allowedSlugs,
    };
  } catch (e) {
    console.error("Composio tools fetch failed", e);
    return { tools: {}, allowedSlugs };
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);
        const { data: claims, error: claimErr } = await supabaseAdmin.auth.getClaims(token);
        if (claimErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        const body = (await request.json()) as {
          messages: UIMessage[];
          threadId?: string;
          agentId?: string;
        };
        if (!Array.isArray(body.messages)) {
          return new Response("messages required", { status: 400 });
        }

        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        if (!deepseekKey) return new Response("Missing DEEPSEEK_API_KEY", { status: 500 });
        const deepseek = createDeepSeekProvider(deepseekKey);

        // ALL prompts flow through Lin (CEO) by default. If the user explicitly
        // picked another employee, honor it (direct DM mode).
        const requestedId = body.agentId ?? "lin";
        const agent = getAgent(requestedId) ?? getAgent("lin")!;

        const { data: conns } = await supabaseAdmin
          .from("composio_connections")
          .select("toolkit_slug, status")
          .eq("user_id", userId);
        const activeSlugs =
          conns?.filter((c) => c.status === "ACTIVE").map((c) => c.toolkit_slug) ?? [];

        const roster = agents
          .map(
            (a) =>
              `- ${a.id} → ${a.name} (${a.role}): ${a.responsibilities[0].toLowerCase()}; tools: ${
                a.toolkits.length ? a.toolkits.join(", ") : "all"
              }`,
          )
          .join("\n");

        const { tools: ownTools, allowedSlugs } = await loadAgentTools(userId, agent, activeSlugs);
        const aiTools: Record<string, any> = { ...ownTools };
        if (hasInstagram(activeSlugs) && !aiTools.send_pending_instagram_replies) {
          aiTools.send_pending_instagram_replies = createPendingInstagramReplyTool(userId);
        }
        // Always-on live web tools (powered by Firecrawl).
        if (process.env.FIRECRAWL_API_KEY) {
          aiTools.web_search = createWebSearchTool();
          aiTools.web_fetch = createWebFetchTool();
        }
        // Always-on live code sandbox (E2B) for PDFs, PPTX, charts, data crunching.
        if (process.env.E2B_API_KEY) {
          aiTools.run_code = createRunCodeTool(userId, agent.id, agent.name);
        }
        // Always-on image generation (Lovable AI Gateway, low-cost).
        if (process.env.LOVABLE_API_KEY) {
          aiTools.generate_image = createGenerateImageTool(
            process.env.LOVABLE_API_KEY,
            userId,
            agent.id,
            agent.name,
          );
        }
        aiTools.list_recent_files = createListRecentFilesTool(userId);

        // Give the CEO a delegate_to_employee tool that actually runs the
        // specialist in the background and returns a timeline + final result.
        if (agent.canDelegate) {
          const subModel = deepseek(DEEPSEEK_SUB_MODEL);

          aiTools["delegate_to_employee"] = tool({
            description:
              "Hand a concrete task to a specialist teammate. They will execute it using their integrations and return a timeline + final result. Use for any hands-on work outside strategy. employee must be one of: reyes, vale, bloom, kade, sage.",
            inputSchema: jsonSchema({
              type: "object",
              required: ["employee", "task"],
              properties: {
                employee: {
                  type: "string",
                  enum: ["reyes", "vale", "bloom", "kade", "sage"],
                  description: "Which teammate should do this.",
                },
                task: {
                  type: "string",
                  description:
                    "The full, self-contained task brief for the teammate (what to do, why, any constraints).",
                },
              },
            }),
            execute: async (args: any) => {
              const parsed = z
                .object({ employee: z.string(), task: z.string().min(1) })
                .safeParse(args);
              if (!parsed.success) return { error: "Invalid arguments" };
              const sub = getAgent(parsed.data.employee);
              if (!sub) return { error: `Unknown employee ${parsed.data.employee}` };

              const subLoaded = await loadAgentTools(userId, sub, activeSlugs);
              const missingTools = sub.toolkits.filter(
                (t) => !activeSlugs.some((s) => s.toLowerCase() === t.toLowerCase()),
              );
              const hasNoTools = subLoaded.allowedSlugs.length === 0;

              // If the specialist has zero connected integrations, do NOT
              // pretend the work was done. Return a structured "blocked" result
              // so the CEO surfaces it honestly to the user.
              if (hasNoTools) {
                return {
                  employee: sub.name,
                  employee_id: sub.id,
                  role: sub.role,
                  status: "blocked",
                  blocker: "no_integrations_connected",
                  missing_integrations: sub.toolkits,
                  result: "",
                  timeline: [
                    {
                      kind: "route",
                      from: "lin",
                      to: sub.id,
                      employee: sub.name,
                      role: sub.role,
                      tools: [],
                      at: Date.now(),
                    },
                    {
                      kind: "blocked",
                      reason: `${sub.name} has no connected integrations for this task. Needs one of: ${sub.toolkits.join(", ")}.`,
                      at: Date.now(),
                    },
                  ],
                };
              }

              const subSystem =
                buildAgentSystem(sub, subLoaded.allowedSlugs, roster) +
                `\n\nIMPORTANT: You MUST actually use your tools to complete the task. Do NOT just describe what you would do — call the relevant tool(s) and act on the result. If the available tools genuinely cannot accomplish the task, say so explicitly and name what integration is missing.`;

              const timeline: any[] = [
                {
                  kind: "route",
                  from: "lin",
                  to: sub.id,
                  employee: sub.name,
                  role: sub.role,
                  tools: subLoaded.allowedSlugs,
                  missing: missingTools,
                  at: Date.now(),
                },
              ];

              const subTools: Record<string, any> = { ...subLoaded.tools };
              if (process.env.E2B_API_KEY) {
                subTools.run_code = createRunCodeTool(userId, sub.id, sub.name);
              }
              if (process.env.LOVABLE_API_KEY) {
                subTools.generate_image = createGenerateImageTool(
                  process.env.LOVABLE_API_KEY,
                  userId,
                  sub.id,
                  sub.name,
                );
              }
              subTools.list_recent_files = createListRecentFilesTool(userId);
              try {
                const result = streamText({
                  model: subModel,
                  system: subSystem,
                  tools: subTools,
                  stopWhen: stepCountIs(20),
                  messages: [{ role: "user", content: parsed.data.task }],
                  onStepFinish: (step) => {
                    for (const tc of step.toolCalls ?? []) {
                      timeline.push({
                        kind: "tool_call",
                        tool: tc.toolName,
                        input: tc.input,
                        at: Date.now(),
                      });
                    }
                    for (const tr of step.toolResults ?? []) {
                      timeline.push({
                        kind: "tool_result",
                        tool: tr.toolName,
                        output: tr.output,
                        at: Date.now(),
                      });
                    }
                    if (step.text) {
                      timeline.push({ kind: "thought", text: step.text, at: Date.now() });
                    }
                  },
                });
                const finalText = await result.text;
                timeline.push({ kind: "done", at: Date.now() });
                return {
                  employee: sub.name,
                  employee_id: sub.id,
                  role: sub.role,
                  result: finalText,
                  timeline,
                };
              } catch (e: any) {
                timeline.push({ kind: "error", error: String(e?.message ?? e), at: Date.now() });
                return {
                  employee: sub.name,
                  employee_id: sub.id,
                  role: sub.role,
                  result: "",
                  timeline,
                  error: String(e?.message ?? e),
                };
              }
            },
          });
        }

        const system = buildAgentSystem(agent, allowedSlugs, roster);
        // Auto-pick the right DeepSeek model based on the latest user turn,
        // tool surface area, and whether the agent can delegate.
        const lastUserText = (() => {
          for (let i = body.messages.length - 1; i >= 0; i--) {
            const m = body.messages[i];
            if (m.role === "user") {
              const parts: any[] = (m as any).parts ?? [];
              return parts
                .map((p) => (typeof p?.text === "string" ? p.text : ""))
                .join(" ")
                .trim();
            }
          }
          return "";
        })();
        const chosenModel = pickDeepSeekModel({
          taskText: lastUserText,
          isDelegated: false,
          toolCount: Object.keys(aiTools).length,
        });

        // Detect image attachments in the latest user turn — DeepSeek can't see
        // images, so route those turns through the Lovable AI Gateway (Gemini).
        const hasImageAttachment = (() => {
          for (let i = body.messages.length - 1; i >= 0; i--) {
            const m = body.messages[i] as any;
            if (m.role !== "user") continue;
            const parts: any[] = m.parts ?? [];
            return parts.some(
              (p) => p?.type === "file" && typeof p.mediaType === "string" && p.mediaType.startsWith("image/"),
            );
          }
          return false;
        })();

        let model: any;
        if (hasImageAttachment && process.env.LOVABLE_API_KEY) {
          const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);
          model = gateway("google/gemini-3-flash-preview");
          console.log("[chat] Vision routing → gemini-3-flash-preview");
        } else {
          console.log("[chat] DeepSeek model selected:", chosenModel);
          model = deepseek(chosenModel);
        }

        // For vision turns, inline image attachments as base64 data URIs so the
        // model never has to reach back over the network to a preview URL
        // (which often fails with "Provider returned error" on Gemini).
        let outgoingMessages = body.messages;
        if (hasImageAttachment) {
          outgoingMessages = await Promise.all(
            body.messages.map(async (m: any) => {
              if (m.role !== "user" || !Array.isArray(m.parts)) return m;
              const parts = await Promise.all(
                m.parts.map(async (p: any) => {
                  if (
                    p?.type !== "file" ||
                    typeof p.url !== "string" ||
                    typeof p.mediaType !== "string" ||
                    !p.mediaType.startsWith("image/") ||
                    p.url.startsWith("data:")
                  )
                    return p;
                  try {
                    const u = new URL(p.url);
                    const marker = "/api/files/";
                    const idx = u.pathname.indexOf(marker);
                    if (idx === -1) return p;
                    const storagePath = decodeURIComponent(u.pathname.slice(idx + marker.length));
                    const { data, error } = await supabaseAdmin.storage
                      .from("artifacts")
                      .download(storagePath);
                    if (error || !data) return p;
                    const buf = new Uint8Array(await data.arrayBuffer());
                    let bin = "";
                    const CHUNK = 0x8000;
                    for (let i = 0; i < buf.length; i += CHUNK) {
                      bin += String.fromCharCode.apply(
                        null,
                        Array.from(buf.subarray(i, i + CHUNK)) as any,
                      );
                    }
                    const b64 = btoa(bin);
                    return { ...p, url: `data:${p.mediaType};base64,${b64}` };
                  } catch {
                    return p;
                  }
                }),
              );
              return { ...m, parts };
            }),
          );
        }

        const result = streamText({
          model,
          system,
          tools: aiTools,
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(outgoingMessages),
        });

        const threadId = body.threadId;
        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            if (!threadId) return;
            try {
              const lastUser = body.messages[body.messages.length - 1];
              const newAssistant = messages[messages.length - 1];
              const rows: any[] = [];
              if (lastUser && lastUser.role === "user") {
                rows.push({
                  thread_id: threadId,
                  user_id: userId,
                  role: "user",
                  parts: lastUser.parts as any,
                });
              }
              if (newAssistant && newAssistant.role === "assistant") {
                rows.push({
                  thread_id: threadId,
                  user_id: userId,
                  role: "assistant",
                  parts: newAssistant.parts as any,
                });
              }
              if (rows.length) {
                const { error } = await supabaseAdmin.from("messages").insert(rows);
                if (error) console.error("Message insert failed", error);
              }
              const updates: any = { updated_at: new Date().toISOString() };
              const { data: existing } = await supabaseAdmin
                .from("threads")
                .select("title")
                .eq("id", threadId)
                .single();
              if (existing?.title === "New chat" && lastUser?.role === "user") {
                const text = (lastUser.parts as any[])
                  .map((p) => (p.type === "text" ? p.text : ""))
                  .join(" ")
                  .trim()
                  .slice(0, 60);
                if (text) updates.title = text;
              }
              await supabaseAdmin.from("threads").update(updates).eq("id", threadId);
            } catch (e) {
              console.error("onFinish persist error", e);
            }
          },
        });
      },
    },
  },
});
