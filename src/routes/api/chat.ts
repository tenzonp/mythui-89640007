import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  listToolsForToolkits,
  executeTool,
  type ComposioTool,
} from "@/lib/composio.server";
import { agents, getAgent } from "@/data/agents";

function composioToolsToAiSdkTools(tools: ComposioTool[], userId: string) {
  const out: Record<string, any> = {};
  for (const t of tools) {
    const safeName = t.slug.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const raw =
      t.input_parameters && typeof t.input_parameters === "object"
        ? (t.input_parameters as any)
        : { type: "object", properties: {} };
    const schema = raw.type ? raw : { type: "object", properties: raw };
    out[safeName] = tool({
      description: `[${t.toolkit?.slug ?? ""}] ${t.description ?? t.name}`.slice(0, 1000),
      inputSchema: jsonSchema(schema),
      execute: async (args: any) => {
        try {
          return await executeTool(t.slug, userId, args ?? {});
        } catch (e: any) {
          return { error: String(e?.message ?? e) };
        }
      },
    });
  }
  return out;
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

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Resolve active employee (default Lin/CEO)
        const agent = getAgent(body.agentId ?? "lin") ?? getAgent("lin")!;

        // Load user's active Composio connections
        const { data: conns } = await supabaseAdmin
          .from("composio_connections")
          .select("toolkit_slug, status")
          .eq("user_id", userId);
        const activeSlugs =
          conns?.filter((c) => c.status === "ACTIVE").map((c) => c.toolkit_slug) ?? [];

        // Filter to toolkits this employee is allowed to use.
        // Empty toolkits[] (CEO) = access to all active connections.
        const allowedSlugs = agent.toolkits.length
          ? activeSlugs.filter((s) =>
              agent.toolkits.some(
                (t) => t.toLowerCase() === s.toLowerCase(),
              ),
            )
          : activeSlugs;

        // Toolkits this employee is built for but the user hasn't connected.
        const missingForRole = agent.toolkits.filter(
          (t) => !activeSlugs.some((s) => s.toLowerCase() === t.toLowerCase()),
        );

        let aiTools: Record<string, any> = {};
        if (allowedSlugs.length) {
          try {
            const toolsRes = await listToolsForToolkits(userId, allowedSlugs, 25);
            aiTools = composioToolsToAiSdkTools(toolsRes.items ?? [], userId);
          } catch (e) {
            console.error("Composio tools fetch failed", e);
          }
        }

        // Team roster for delegation hints
        const roster = agents
          .map(
            (a) =>
              `- ${a.name} (${a.role}): handles ${a.responsibilities[0].toLowerCase()}; tools: ${
                a.toolkits.length ? a.toolkits.join(", ") : "all"
              }`,
          )
          .join("\n");

        const delegationNote = agent.canDelegate
          ? `As CEO you can answer strategy yourself, but when work requires a specialist tool, recommend the right employee by name (Reyes/Vale/Bloom/Kade/Sage) and tell the user to open a chat with them. You may still call any connected tool directly if the user asks.`
          : `You are scoped to ${agent.role}. You may ONLY use tools from: ${agent.toolkits.join(", ") || "(none)"}. If the user asks for work outside your scope (e.g. ${agent.id === "vale" ? "closing a sales deal" : agent.id === "bloom" ? "running a marketing campaign" : "another team's job"}), do NOT attempt it — name the right teammate from the roster and ask the user to switch to that employee (or to Lin, the CEO, to coordinate).`;

        const missingNote = missingForRole.length
          ? `Your role normally uses these integrations that are NOT yet connected: ${missingForRole.join(", ")}. If the user asks for those, tell them to connect that integration on the Integrations page.`
          : "";

        const system = `You are ${agent.name}, the ${agent.role} on the Mythmind AI team.
Tagline: ${agent.tagline}
Responsibilities:
${agent.responsibilities.map((r) => `- ${r}`).join("\n")}
KPIs you are measured on:
${agent.kpis.map((k) => `- ${k.label}: ${k.target}`).join("\n")}

Team roster (use for delegation):
${roster}

Connected integrations available to you right now: ${allowedSlugs.join(", ") || "none"}.
${delegationNote}
${missingNote}

When the user asks for a real action that maps to one of your tools, call the tool. Be concise, warm, and proactive. Always speak in first person as ${agent.name}.`;

        const gateway = createLovableAiGatewayProvider(lovableKey);
        const model = gateway("google/gemini-2.5-pro");

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
