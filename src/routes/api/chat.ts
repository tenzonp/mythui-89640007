import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
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

function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  // Lightweight passthrough — let AI SDK forward JSON schema via z.any().
  // For richer typing one could expand this. Here, accept any object input.
  return z.any();
}

function composioToolsToAiSdkTools(tools: ComposioTool[], userId: string) {
  const out: Record<string, any> = {};
  for (const t of tools) {
    const safeName = t.slug.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    out[safeName] = tool({
      description: `[${t.toolkit?.slug ?? ""}] ${t.description ?? t.name}`.slice(0, 500),
      inputSchema: jsonSchemaToZod(t.input_parameters),
      execute: async (args: any) => {
        try {
          const res = await executeTool(t.slug, userId, args);
          return res;
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
        };
        if (!Array.isArray(body.messages)) {
          return new Response("messages required", { status: 400 });
        }

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Load user's active Composio connections + tools (capped)
        const { data: conns } = await supabaseAdmin
          .from("composio_connections")
          .select("toolkit_slug, status")
          .eq("user_id", userId);
        const activeSlugs =
          conns?.filter((c) => c.status === "ACTIVE").map((c) => c.toolkit_slug) ?? [];

        let aiTools: Record<string, any> = {};
        if (activeSlugs.length) {
          try {
            const toolsRes = await listToolsForToolkits(userId, activeSlugs, 25);
            aiTools = composioToolsToAiSdkTools(toolsRes.items ?? [], userId);
          } catch (e) {
            console.error("Composio tools fetch failed", e);
          }
        }

        const gateway = createLovableAiGatewayProvider(lovableKey);
        const model = gateway("google/gemini-2.5-pro");

        const system = `You are Mythmind — a team of specialist AI employees that delivers real work, not just answers.
You have access to ${activeSlugs.length} connected integrations (${activeSlugs.join(", ") || "none yet"}) via Composio tools.
When the user asks for an action (send an email, create an issue, search docs, etc.), call the relevant tool. If no tool is connected for the request, tell the user to connect that integration in the Integrations page.
Be concise, friendly, and proactive.`;

        const result = streamText({
          model,
          system,
          tools: aiTools,
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(body.messages),
        });

        // Persist on finish
        const threadId = body.threadId;
        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            if (!threadId) return;
            try {
              // Save only the newly-added messages (last user msg + assistant)
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
              // Bump thread updated_at + auto-title from first user msg
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
