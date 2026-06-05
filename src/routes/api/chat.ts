import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";
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
import {
  canStartTurn,
  chargeTurn,
  computeFinalCost,
  inferComplexity,
} from "@/lib/credits.server";
import { getWynsaModel, type WynsaModelId } from "@/lib/plans";

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
  if (toolkitSlug?.toLowerCase() === "instagram" && schema.properties?.ig_user_id) {
    schema.properties = { ...schema.properties };
    schema.properties.ig_user_id = {
      ...schema.properties.ig_user_id,
      description:
        "Optional. Leave blank to use the Instagram Business Account already connected in Integrations. Do not ask the user for this ID when Instagram is connected.",
    };
    if (Array.isArray(schema.required)) {
      schema.required = schema.required.filter((key: string) => key !== "ig_user_id");
      if (!schema.required.length) delete schema.required;
    }
  }
  if (toolkitSlug?.toLowerCase() === "facebook" && schema.properties?.page_id) {
    schema.properties = { ...schema.properties };
    schema.properties.page_id = {
      ...schema.properties.page_id,
      description:
        "Optional. Leave blank to use the Facebook Page already connected in Integrations. Do not ask the user for this ID when Facebook is connected.",
    };
    if (Array.isArray(schema.required)) {
      schema.required = schema.required.filter((key: string) => key !== "page_id");
      if (!schema.required.length) delete schema.required;
    }
  }
  if (toolkitSlug?.toLowerCase() === "gmail" && schema.properties?.attachment) {
    schema.properties = { ...schema.properties };
    schema.properties.attachment = {
      ...schema.properties.attachment,
      anyOf: [
        { type: "string", description: "Artifact URL, /api/files URL, or public URL to attach." },
        {
          type: "array",
          items: { type: "string" },
          description: "Multiple artifact URLs, /api/files URLs, or public URLs to attach.",
        },
        schema.properties.attachment,
      ],
    };
  }
  return schema;
}

function firstStringByKeys(value: any, keys: string[]): string | null {
  return extractByKeys(value, keys.map((k) => k.toLowerCase()));
}

function absolutizeUrl(value: any, origin: string) {
  if (typeof value !== "string" || !value.trim()) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${origin}${value}`;
  return value;
}

async function resolveConnectedInstagramAccount(userId: string) {
  const res = await executeTool("INSTAGRAM_GET_USER_INFO", userId, {});
  const data = (res as any)?.data ?? res;
  const id = firstStringByKeys(data, ["id", "ig_user_id", "instagram_business_account_id"]);
  if (!id) throw new Error("Connected Instagram account did not return an account ID.");
  return {
    id,
    username: firstStringByKeys(data, ["username"]),
    accountType: firstStringByKeys(data, ["account_type"]),
  };
}

type FacebookPageInfo = {
  id: string;
  name?: string | null;
  accessToken?: string | null;
  tasks?: string[];
};

function extractFacebookPages(value: any): FacebookPageInfo[] {
  const data = value?.data ?? value;
  const responseData = data?.response_data ?? data?.responseData ?? data;
  const rawPages =
    (Array.isArray(responseData?.data) && responseData.data) ||
    (Array.isArray(responseData?.pages) && responseData.pages) ||
    (Array.isArray(data?.pages) && data.pages) ||
    (Array.isArray(data) && data) ||
    [];
  return rawPages
    .map((page: any) => ({
      id: String(page?.id || page?.page_id || "").trim(),
      name: page?.name ?? null,
      accessToken: page?.access_token || page?.accessToken || null,
      tasks: Array.isArray(page?.tasks) ? page.tasks.map((task: any) => String(task)) : undefined,
    }))
    .filter((page: FacebookPageInfo) => /^\d+$/.test(page.id));
}

function assertFacebookPageCanPublish(page: FacebookPageInfo) {
  const tasks = page.tasks ?? [];
  if (tasks.length && !tasks.includes("CREATE_CONTENT") && !tasks.includes("MANAGE")) {
    throw new Error(
      `Facebook page ${page.name ?? page.id} is connected, but it does not grant content publishing access. Reconnect Facebook from Integrations and approve page posting access.`,
    );
  }
}

async function resolveConnectedFacebookPage(
  userId: string,
  preferredPageId?: string,
): Promise<FacebookPageInfo> {
  const res = await executeTool("FACEBOOK_GET_USER_PAGES", userId, {});
  const pages = extractFacebookPages(res);
  const requested = preferredPageId ? String(preferredPageId).trim() : "";
  const page = (requested && pages.find((p: FacebookPageInfo) => p.id === requested)) || pages[0];
  if (page?.id) {
    assertFacebookPageCanPublish(page);
    return page;
  }
  const data = (res as any)?.data ?? res;
  const id = firstStringByKeys(data, ["page_id", "id"]);
  if (!id) throw new Error("No Facebook Page found on the connected account.");
  return { id: String(id), name: null };
}

function detectFacebookPermissionError(result: any): boolean {
  try {
    const s = typeof result === "string" ? result : JSON.stringify(result ?? "");
    return /pages_manage_posts|pages_read_engagement|permission|not allowed for this call|OAuthException|Forbidden/i.test(
      s,
    );
  } catch {
    return false;
  }
}

function redactSensitiveFields(value: any): any {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactSensitiveFields);
  const out: Record<string, any> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (/access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization/i.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = redactSensitiveFields(nested);
    }
  }
  return out;
}

async function postToFacebookPageDirect(args: any, userId: string) {
  const page = await resolveConnectedFacebookPage(userId, args?.page_id);
  if (!page.accessToken) {
    throw new Error("Facebook page access is connected, but no Page access token was returned. Reconnect Facebook from Integrations and approve page posting access.");
  }
  const params = new URLSearchParams({ access_token: page.accessToken });
  if (args?.message) params.set("message", String(args.message));
  if (args?.link) params.set("link", String(args.link));
  if (typeof args?.published === "boolean") params.set("published", String(args.published));
  if (args?.scheduled_publish_time) params.set("scheduled_publish_time", String(args.scheduled_publish_time));
  const res = await fetch(`https://graph.facebook.com/v20.0/${page.id}/feed`, {
    method: "POST",
    body: params,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || `Facebook post failed (${res.status})`;
    throw new Error(`${message}. Reconnect Facebook from Integrations and approve pages_read_engagement + pages_manage_posts if this continues.`);
  }
  return { successful: true, data: json, page_id: page.id, page_name: page.name, via: "facebook_page_access" };
}

async function postPhotoToFacebookPageDirect(args: any, userId: string) {
  if (!args?.url) return null;
  const page = await resolveConnectedFacebookPage(userId, args?.page_id);
  if (!page.accessToken) return null;
  const params = new URLSearchParams({ access_token: page.accessToken, url: String(args.url) });
  if (args?.message) params.set("caption", String(args.message));
  if (typeof args?.published === "boolean") params.set("published", String(args.published));
  const res = await fetch(`https://graph.facebook.com/v20.0/${page.id}/photos`, {
    method: "POST",
    body: params,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || `Facebook photo post failed (${res.status})`;
    throw new Error(`${message}. Reconnect Facebook from Integrations and approve pages_read_engagement + pages_manage_posts if this continues.`);
  }
  return { successful: true, data: json, page_id: page.id, page_name: page.name, via: "facebook_page_access" };
}


function composioToolsToAiSdkTools(tools: ComposioTool[], userId: string, origin: string) {
  const out: Record<string, any> = {};
  for (const t of tools) {
    const safeName = t.slug.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const raw =
      t.input_parameters && typeof t.input_parameters === "object"
        ? (t.input_parameters as any)
        : { type: "object", properties: {} };
    const schema = normalizeToolInputSchema(raw, t.toolkit?.slug);
    const isInstagram = (t.toolkit?.slug ?? "").toLowerCase() === "instagram";
    const isFacebook = (t.toolkit?.slug ?? "").toLowerCase() === "facebook";
    const isFacebookCreatePost = isFacebook && t.slug === "FACEBOOK_CREATE_POST";
    const isFacebookPhotoPost = isFacebook && t.slug === "FACEBOOK_CREATE_PHOTO_POST";
    const isInstagramSend = isInstagramSendTool(t);
    out[safeName] = tool({
      description: `[${t.toolkit?.slug ?? ""}] ${t.description ?? t.name}${
        (t.toolkit?.slug ?? "").toLowerCase() === "gmail"
          ? " For attachments, pass an /api/files/... URL or artifact object to attachment; the app will stage it correctly. Do not pass guessed s3key values."
          : ""
      }`.slice(0, 1000),
      inputSchema: jsonSchema(schema),
      execute: async (args: any) => {
        let preparedArgs: any = args ?? {};
        try {
          preparedArgs = await prepareComposioArgs(t, args ?? {}, userId, origin);
          const res = await executeTool(t.slug, userId, preparedArgs);
          if (isFacebookCreatePost && detectFacebookPermissionError(res)) {
            return await postToFacebookPageDirect(preparedArgs, userId);
          }
          if (isFacebookPhotoPost && detectFacebookPermissionError(res)) {
            return (await postPhotoToFacebookPageDirect(preparedArgs, userId)) ?? res;
          }
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
          return isFacebook ? redactSensitiveFields(res) : res;
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
          if (isFacebookCreatePost && detectFacebookPermissionError(msg)) {
            return await postToFacebookPageDirect(preparedArgs, userId);
          }
          if (isFacebookPhotoPost && detectFacebookPermissionError(msg)) {
            return (await postPhotoToFacebookPageDirect(preparedArgs, userId)) ?? { error: msg };
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

function instagramMediaSecret() {
  return process.env.LOVABLE_API_KEY || process.env.COMPOSIO_API_KEY || "";
}

function signInstagramMediaPath(path: string) {
  const secret = instagramMediaSecret();
  if (!secret) throw new Error("Instagram media signing is not configured.");
  return createHmac("sha256", secret).update(path).digest("base64url");
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

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function hasImageMagic(bytes: Uint8Array) {
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return { isPng, isJpeg };
}

function flattenAlphaToWhite(data: Uint8Array) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    out[i] = Math.round(data[i] * alpha + 255 * (1 - alpha));
    out[i + 1] = Math.round(data[i + 1] * alpha + 255 * (1 - alpha));
    out[i + 2] = Math.round(data[i + 2] * alpha + 255 * (1 - alpha));
    out[i + 3] = 255;
  }
  return out;
}

async function encodeInstagramJpeg(file: { bytes: Uint8Array; name: string; mimetype: string }) {
  const mime = file.mimetype.split(";")[0].toLowerCase();
  const lower = file.name.toLowerCase();
  const magic = hasImageMagic(file.bytes);
  let rgba: Uint8Array;
  let width = 0;
  let height = 0;

  if (mime === "image/png" || lower.endsWith(".png") || magic.isPng) {
    const mod: any = await import("@pdf-lib/upng");
    const UPNG = mod.default ?? mod;
    const decoded = UPNG.decode(exactArrayBuffer(file.bytes));
    const frame = UPNG.toRGBA8(decoded)?.[0];
    if (!frame) throw new Error("Instagram image conversion failed: PNG had no frame.");
    rgba = new Uint8Array(frame);
    width = decoded.width;
    height = decoded.height;
  } else if (
    mime === "image/jpeg" ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    magic.isJpeg
  ) {
    const jpegMod: any = await import("jpeg-js");
    const jpeg = jpegMod.default ?? jpegMod;
    const decoded = jpeg.decode(file.bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 25,
      maxMemoryUsageInMB: 256,
    });
    rgba = decoded.data;
    width = decoded.width;
    height = decoded.height;
  } else {
    throw new Error("Instagram image posting supports PNG or JPEG files only.");
  }

  const jpegMod: any = await import("jpeg-js");
  const jpeg = jpegMod.default ?? jpegMod;
  const flattened = flattenAlphaToWhite(rgba);
  const encoded = jpeg.encode({ data: flattened, width, height }, 90);
  return new Uint8Array(encoded.data);
}

async function prepareInstagramImageUrl(value: any, userId: string, origin: string) {
  const absolute = absolutizeUrl(value, origin);
  const file = await readFileReference(absolute);
  if (!file) return absolute;
  const looksLikeImage =
    file.mimetype.startsWith("image/") || Object.values(hasImageMagic(file.bytes)).some(Boolean);
  if (!looksLikeImage) return absolute;

  const bytes = await encodeInstagramJpeg(file);
  if (bytes.byteLength > 8 * 1024 * 1024) {
    throw new Error("Instagram image is too large after conversion (max 8MB).");
  }
  const base =
    file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 70) ||
    "image";
  const path = `${userId}/instagram/${Date.now()}-${base}.jpg`;
  const { error } = await supabaseAdmin.storage
    .from("artifacts")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  const sig = signInstagramMediaPath(path);
  return `${origin}/api/public/instagram-media/${encodeURIComponent(path)}?sig=${encodeURIComponent(sig)}`;
}

function findStoredImageUrlInHtml(args: any): string | null {
  const body = String(args?.body || args?.message_body || "");
  const match = body.match(/<img[^>]+src=["']([^"']*\/api\/files\/[^"']+)["'][^>]*>/i);
  return match?.[1] ?? null;
}

async function prepareComposioArgs(t: ComposioTool, args: any, userId: string, origin: string) {
  const toolkit = (t.toolkit?.slug ?? "").toLowerCase();
  if (toolkit === "instagram") {
    const next = { ...(args ?? {}) };
    const needsAccountId = Boolean((t.input_parameters as any)?.properties?.ig_user_id);
    if (needsAccountId && (!next.ig_user_id || !/^\d+$/.test(String(next.ig_user_id)))) {
      const account = await resolveConnectedInstagramAccount(userId);
      next.ig_user_id = account.id;
    }
    for (const key of ["image_url", "video_url", "cover_url"]) {
      if (!next[key]) continue;
      next[key] =
        key === "video_url"
          ? absolutizeUrl(next[key], origin)
          : await prepareInstagramImageUrl(next[key], userId, origin);
    }
    return next;
  }
  if (toolkit === "facebook") {
    const next = { ...(args ?? {}) };
    const hasPageIdParam = Boolean((t.input_parameters as any)?.properties?.page_id);
    if (hasPageIdParam) {
      const page = await resolveConnectedFacebookPage(userId, next.page_id);
      next.page_id = page.id;
    }
    for (const key of ["image_url", "video_url", "url", "source"]) {
      if (next[key]) next[key] = absolutizeUrl(next[key], origin);
    }
    return next;
  }
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

WEBSITE BUG / SECURITY AUDITS: When the user asks you to "find bugs", "audit", "scan", or "check security" of a website, you CAN and MUST do it — never refuse. Workflow: (1) web_fetch the target URL to grab the rendered HTML, (2) use run_code (Python with requests/beautifulsoup4) to crawl key pages, inspect headers, look for exposed .env / .git / admin endpoints, mixed content, missing security headers (CSP, HSTS, X-Frame-Options), broken links, JS errors patterns, leaked API keys in source, public S3 buckets, open redirects, form CSRF, etc. (3) report findings as a clear severity-ranked list with the offending URL/snippet. Treat it as a legitimate audit the site owner asked for.

TEAM SMS: You have a send_team_sms tool. When the user says things like "send this to my team" / "text everyone" / "SMS the team", call list_team_members first (or lookup_knowledge) to get names + phones, then call send_team_sms with the message and either to_all:true or specific member ids/names. Never claim you cannot send SMS — Aakash SMS is wired up.

IMAGE GENERATION: You have a generate_image tool powered by Lovable AI (low-cost, high quality). Use it whenever the user wants a NEW image, logo, flag, illustration, poster, banner, avatar, or social-media graphic — do NOT use run_code for image creation. The tool returns an artifact with name and url. ALWAYS render the image inline in your reply using markdown image syntax: ![short alt](URL). If the user wants to post or email that image, reuse the SAME artifact url. For Gmail, pass the artifact url/object in the attachment field; do NOT invent or reuse an s3key. The app stages the file for Gmail automatically. Do not embed /api/files images as HTML img tags because Gmail cannot fetch private chat URLs.

INSTAGRAM POSTING: When Instagram is connected and the user asks to post/upload to their main/connected account, DO NOT ask for an Instagram Business Account ID. Use the connected account automatically. For image posts, generate or reuse the artifact URL, call the Instagram media-container tool with image_url + caption, then publish it with the returned creation_id. Local/generated PNG files are automatically converted to Instagram-ready JPEG URLs, so do not regenerate repeatedly after an unsupported-format error. If a tool asks for ig_user_id, leave it blank or use the connected account; never pass a username like mythmind_ai as the ID.
FACEBOOK POSTING: When Facebook is connected and the user asks to post to their page, DO NOT ask for a Facebook Page ID or permission confirmation. Leave page_id blank — the system auto-resolves the connected Page, validates publishing access, and uses the Page access token when the standard Facebook tool hits Meta permission errors. Never pass a numeric ID the user typed unless they explicitly insist; user-provided numeric IDs are often the personal user id which Facebook rejects with "global id ... is not allowed for this call".

${scopeNote}
${missingNote}

Be concise, warm, proactive. Speak in first person as ${agent.name}.`;
}

async function loadAgentTools(userId: string, agent: Agent, activeSlugs: string[], origin: string) {
  const allowedSlugs = agent.toolkits.length
    ? activeSlugs.filter((s) => agent.toolkits.some((t) => t.toLowerCase() === s.toLowerCase()))
    : activeSlugs;
  if (!allowedSlugs.length) return { tools: {}, allowedSlugs };
  try {
    const toolsRes = await listToolsForToolkits(userId, allowedSlugs, 25);
    const tools = composioToolsToAiSdkTools(toolsRes.items ?? [], userId, origin);
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
          modelId?: WynsaModelId;
        };
        const requestOrigin = new URL(request.url).origin;
        if (!Array.isArray(body.messages)) {
          return new Response("messages required", { status: 400 });
        }

        // Credit + plan gate
        const requestedModelId = (body.modelId ?? "lady") as WynsaModelId;
        const wynsa = getWynsaModel(requestedModelId);
        const gate = await canStartTurn({ userId, modelId: wynsa.id });
        if (!gate.ok) {
          return new Response(
            JSON.stringify({
              error:
                gate.reason === "plan_locked"
                  ? `${wynsa.name} is available on Pro and Everest. Upgrade to use it.`
                  : `You're out of credits. Upgrade or wait for your next refill.`,
              code: gate.reason,
              tier: gate.plan.tier,
              balance: gate.balance,
            }),
            { status: 402, headers: { "Content-Type": "application/json" } },
          );
        }
        const isFree = gate.isFree;

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

        const { tools: ownTools, allowedSlugs } = await loadAgentTools(
          userId,
          agent,
          activeSlugs,
          requestOrigin,
        );
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

        // Team SMS tools (Aakash SMS). Always on.
        aiTools.list_team_members = tool({
          description:
            "List the user's team members with their name, role, and phone number. Call this BEFORE send_team_sms whenever the user wants to message their team.",
          inputSchema: jsonSchema({ type: "object", properties: {} }),
          execute: async () => {
            const { data, error } = await supabaseAdmin
              .from("business_team_members")
              .select("id, name, role, phone")
              .eq("user_id", userId);
            if (error) return { error: error.message };
            return { members: data ?? [] };
          },
        });
        aiTools.send_team_sms = tool({
          description:
            "Send an SMS via Aakash SMS to one or more team members. Pass to_all:true to send to every teammate with a phone, or member_ids (uuids) or names to target specific people. Use this whenever the user asks to text/SMS their team.",
          inputSchema: jsonSchema({
            type: "object",
            required: ["message"],
            properties: {
              message: { type: "string" },
              to_all: { type: "boolean" },
              member_ids: { type: "array", items: { type: "string" } },
              names: { type: "array", items: { type: "string" } },
            },
          }),
          execute: async (args: any) => {
            const parsed = z
              .object({
                message: z.string().min(1).max(1000),
                to_all: z.boolean().optional(),
                member_ids: z.array(z.string()).optional(),
                names: z.array(z.string()).optional(),
              })
              .safeParse(args);
            if (!parsed.success) return { error: "Invalid arguments" };
            const { data: team, error } = await supabaseAdmin
              .from("business_team_members")
              .select("id, name, phone")
              .eq("user_id", userId);
            if (error) return { error: error.message };
            let targets = (team ?? []).filter((m: any) => m.phone);
            if (!parsed.data.to_all) {
              const ids = new Set(parsed.data.member_ids ?? []);
              const names = new Set((parsed.data.names ?? []).map((n) => n.toLowerCase()));
              if (ids.size || names.size) {
                targets = targets.filter(
                  (m: any) => ids.has(m.id) || names.has((m.name ?? "").toLowerCase()),
                );
              }
            }
            if (!targets.length) return { error: "No team members with phone numbers matched." };
            const { sendAakashSMS } = await import("@/lib/aakash.server");
            const results: any[] = [];
            for (const m of targets) {
              const r = await sendAakashSMS({ to: m.phone!, text: parsed.data.message });
              results.push({ id: m.id, name: m.name, phone: m.phone, ok: r.ok, error: r.error });
            }
            return {
              ok: results.every((r) => r.ok),
              sent: results.filter((r) => r.ok).length,
              total: results.length,
              results,
            };
          },
        });

        // Load business knowledge context for the system prompt.
        const { getKnowledgeContext, searchKnowledge, recordKnowledgeEntry } = await import(
          "@/lib/knowledge.server"
        );
        const knowledgeContext = await getKnowledgeContext(userId).catch(() => "");

        // Knowledge tools — always on.
        aiTools.lookup_knowledge = tool({
          description:
            "Search the user's business knowledge base (profile, team, accounts, entries) by query string. Use BEFORE asking the user a factual question about their business.",
          inputSchema: jsonSchema({
            type: "object",
            required: ["query"],
            properties: { query: { type: "string" } },
          }),
          execute: async (args: any) => {
            const q = String(args?.query ?? "").trim();
            if (!q) return { error: "query required" };
            return { hits: await searchKnowledge(userId, q) };
          },
        });
        aiTools.record_knowledge = tool({
          description:
            "Save a new long-term fact about the user's business to the knowledge base so future chats remember it. Only use for durable facts (not chit-chat).",
          inputSchema: jsonSchema({
            type: "object",
            required: ["title", "body"],
            properties: {
              title: { type: "string" },
              body: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
            },
          }),
          execute: async (args: any) => {
            const parsed = z
              .object({
                title: z.string().min(1).max(200),
                body: z.string().min(1).max(20000),
                tags: z.array(z.string().max(40)).max(20).optional(),
              })
              .safeParse(args);
            if (!parsed.success) return { error: "Invalid arguments" };
            const id = await recordKnowledgeEntry(userId, parsed.data.title, parsed.data.body, parsed.data.tags);
            return { ok: true, id };
          },
        });

        // build_website tool — full generate + ZIP + Netlify deploy in one call.
        if (process.env.LOVABLE_API_KEY && process.env.NETLIFY_AUTH_TOKEN) {
          aiTools.build_website = tool({
            description:
              "Generate and deploy a complete Next.js 14 website. Use whenever the user asks to build/create a website, landing page, or marketing site for their business. Returns a live URL and a downloadable ZIP. Costs 1000 credits. Pulls real internet images (Unsplash/Pexels), videos (YouTube/Vimeo), icons (lucide), and Framer Motion animations. Tailor the prompt using everything you know about the user's business.",
            inputSchema: jsonSchema({
              type: "object",
              required: ["name", "prompt"],
              properties: {
                name: { type: "string", description: "Project slug (2-60 chars)." },
                prompt: { type: "string", description: "Detailed creative brief for the site." },
                styleNotes: { type: "string", description: "Optional visual direction." },
              },
            }),
            execute: async (args: any) => {
              const parsed = z
                .object({
                  name: z.string().min(2).max(60),
                  prompt: z.string().min(10).max(4000),
                  styleNotes: z.string().max(2000).optional(),
                })
                .safeParse(args);
              if (!parsed.success) return { error: "Invalid arguments" };
              try {
                // Charge 1000 credits up front via credit_ledger.
                const { data: bal } = await supabaseAdmin
                  .from("credit_ledger")
                  .select("amount")
                  .eq("user_id", userId);
                const balance = (bal ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
                if (balance < 1000) {
                  return { error: `Not enough credits — need 1000, have ${balance}.` };
                }
                await supabaseAdmin.from("credit_ledger").insert({
                  user_id: userId,
                  kind: "spend",
                  amount: -1000,
                  meta: { kind: "site_generate", name: parsed.data.name },
                });

                const { buildAndDeploySite } = await import("@/lib/site-build.server");
                const result = await buildAndDeploySite({
                  userId,
                  name: parsed.data.name,
                  prompt: parsed.data.prompt,
                  styleNotes: parsed.data.styleNotes,
                  businessContext: knowledgeContext || undefined,
                });
                return {
                  ok: true,
                  site_id: result.siteId,
                  live_url: result.liveUrl,
                  zip_url: result.zipUrl,
                  file_count: result.fileCount,
                  message: `Site is live at ${result.liveUrl} and the source ZIP is at ${result.zipUrl}. Share BOTH links in your reply as clickable markdown links.`,
                };
              } catch (e: any) {
                return { error: e?.message ?? "Site build failed" };
              }
            },
          });
        }

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

              const subLoaded = await loadAgentTools(userId, sub, activeSlugs, requestOrigin);
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

        const baseSystem = buildAgentSystem(agent, allowedSlugs, roster);
        const knowledgeBlock = knowledgeContext
          ? `\n\n=== USER BUSINESS KNOWLEDGE BASE ===\nThis is ground truth about the user's business. Treat it as already known — do NOT ask the user to repeat anything in here. When asked to do work (write copy, build a site, send a campaign, post to social, email someone…), pull names, tone, audience, team, accounts, and facts directly from this block.\n\n${knowledgeContext}\n=== END KNOWLEDGE BASE ===`
          : `\n\n=== USER BUSINESS KNOWLEDGE BASE ===\n(empty — the user has not completed onboarding yet)\n=== END KNOWLEDGE BASE ===`;
        const gapPolicy = `\n\nKNOWLEDGE-GAP POLICY (MANDATORY):\nBefore generating any non-trivial output (website, email, ad, post, campaign, strategy, document), check the knowledge base above + call lookup_knowledge if useful. If critical facts are missing (business name, what they actually sell, audience, brand tone, key URLs, contact info, team owner for the task), STOP and ask the user 2–5 short, numbered, targeted questions to fill those specific gaps first. Don't ask things already answered in the knowledge base. After the user answers, call record_knowledge to save the new durable facts, then proceed with the work. Never invent business facts.`;
        const system = baseSystem + knowledgeBlock + gapPolicy;
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

        // Route every turn through the Lovable AI Gateway using the Wynsa
        // model the user picked. Falls back to DeepSeek only if the gateway
        // key is missing.
        let model: any;
        if (process.env.LOVABLE_API_KEY) {
          const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);
          // Vision turns force Lady (Gemini Flash) because GPT can be slower
          // for image attachments and we only need quick vision parsing.
          const backendModel = hasImageAttachment
            ? "google/gemini-2.5-flash"
            : wynsa.backendModel;
          model = gateway(backendModel);
          console.log("[chat] Wynsa", wynsa.id, "→", backendModel);
        } else {
          console.log("[chat] Fallback DeepSeek model:", chosenModel);
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

        // Track tool usage during the stream for credit math.
        let toolCallCount = 0;
        let usedResearch = false;
        const delegatedAgentIds = new Set<string>();
        delegatedAgentIds.add(agent.id);

        const result = streamText({
          model,
          system,
          tools: aiTools,
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(outgoingMessages),
          onStepFinish: (step) => {
            for (const tc of step.toolCalls ?? []) {
              toolCallCount++;
              const t = String(tc.toolName ?? "").toLowerCase();
              if (
                t.includes("web_search") ||
                t.includes("web_fetch") ||
                t.includes("firecrawl") ||
                t.includes("research")
              )
                usedResearch = true;
              if (t === "delegate_to_employee") {
                const emp = (tc.input as any)?.employee;
                if (typeof emp === "string") delegatedAgentIds.add(emp);
              }
            }
          },
        });

        const threadId = body.threadId;
        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            try {
              const lastUser = body.messages[body.messages.length - 1];
              const newAssistant = messages[messages.length - 1];
              // Charge credits for this turn (always, even without thread).
              try {
                const outputChars = newAssistant?.role === "assistant"
                  ? ((newAssistant.parts as any[]) ?? [])
                      .map((p) => (p?.type === "text" ? String(p.text ?? "") : ""))
                      .join("").length
                  : 0;
                const complexity = inferComplexity({
                  outputChars,
                  toolCalls: toolCallCount,
                  delegatedAgents: delegatedAgentIds.size,
                });
                const cost = computeFinalCost({
                  modelId: wynsa.id,
                  complexity,
                  usedResearch,
                  delegatedAgents: delegatedAgentIds.size,
                  isFree,
                });
                await chargeTurn({
                  userId,
                  threadId: threadId ?? null,
                  modelId: wynsa.id,
                  agentId: agent.id,
                  complexity,
                  amount: cost,
                  meta: {
                    tool_calls: toolCallCount,
                    used_research: usedResearch,
                    delegated: Array.from(delegatedAgentIds),
                    output_chars: outputChars,
                  },
                });
              } catch (e) {
                console.error("credit charge failed", e);
              }
              if (!threadId) return;
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
