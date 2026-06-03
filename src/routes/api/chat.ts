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
  DEEPSEEK_MAIN_MODEL,
  DEEPSEEK_SUB_MODEL,
  pickDeepSeekModel,
} from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listToolsForToolkits, executeTool, type ComposioTool } from "@/lib/composio.server";
import { webSearch, webScrape } from "@/lib/firecrawl.server";
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

function composioToolsToAiSdkTools(tools: ComposioTool[], userId: string) {
  const out: Record<string, any> = {};
  for (const t of tools) {
    const safeName = t.slug.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const raw =
      t.input_parameters && typeof t.input_parameters === "object"
        ? (t.input_parameters as any)
        : { type: "object", properties: {} };
    const schema = raw.type ? raw : { type: "object", properties: raw };
    const isInstagram = (t.toolkit?.slug ?? "").toLowerCase() === "instagram";
    const isInstagramSend = isInstagramSendTool(t);
    out[safeName] = tool({
      description: `[${t.toolkit?.slug ?? ""}] ${t.description ?? t.name}`.slice(0, 1000),
      inputSchema: jsonSchema(schema),
      execute: async (args: any) => {
        try {
          const res = await executeTool(t.slug, userId, args ?? {});
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

              try {
                const result = streamText({
                  model: subModel,
                  system: subSystem,
                  tools: subLoaded.tools,
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
        console.log("[chat] DeepSeek model selected:", chosenModel);
        const model = deepseek(chosenModel);

        const result = streamText({
          model,
          system,
          tools: aiTools,
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(body.messages),
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
