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
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  listToolsForToolkits,
  executeTool,
  type ComposioTool,
} from "@/lib/composio.server";
import { agents, getAgent, type Agent } from "@/data/agents";

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

function buildAgentSystem(agent: Agent, allowedSlugs: string[], roster: string) {
  const missingForRole = agent.toolkits.filter(
    (t) => !allowedSlugs.some((s) => s.toLowerCase() === t.toLowerCase()),
  );
  const scopeNote = agent.canDelegate
    ? `As CEO you can answer strategy yourself OR delegate hands-on work to a teammate using the delegate_to_employee tool. Use it whenever the task requires a specialist's tools (instagram → Vale, sales CRMs → Bloom, support tickets → Sage, automations → Kade, product/roadmap → Reyes). After delegation, summarize the result for the user.`
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
    ? activeSlugs.filter((s) =>
        agent.toolkits.some((t) => t.toLowerCase() === s.toLowerCase()),
      )
    : activeSlugs;
  if (!allowedSlugs.length) return { tools: {}, allowedSlugs };
  try {
    const toolsRes = await listToolsForToolkits(userId, allowedSlugs, 25);
    return {
      tools: composioToolsToAiSdkTools(toolsRes.items ?? [], userId),
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

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

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

        // Give the CEO a delegate_to_employee tool that actually runs the
        // specialist in the background and returns a timeline + final result.
        if (agent.canDelegate) {
          const gateway = createLovableAiGatewayProvider(lovableKey);
          const subModel = gateway("google/gemini-2.5-flash");

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
              const subSystem = buildAgentSystem(sub, subLoaded.allowedSlugs, roster);

              const timeline: any[] = [
                {
                  kind: "route",
                  from: "lin",
                  to: sub.id,
                  employee: sub.name,
                  role: sub.role,
                  tools: subLoaded.allowedSlugs,
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
