import { createFileRoute, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getThreadMessages, listMyConnections, deleteMessage } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUp, Loader2, Plug, Sparkles, Wrench, ChevronDown, Copy, Share2, Trash2, Flag, Check, ArrowRight, Brain, CheckCircle2, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { agents, getAgent } from "@/data/agents";

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatThread,
});

function ChatThread() {
  const { threadId } = useParams({ from: "/chat/$threadId" });
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [conns, setConns] = useState<any[]>([]);
  const loadMsgs = useServerFn(getThreadMessages);
  const loadConns = useServerFn(listMyConnections);

  useEffect(() => {
    setInitial(null);
    (async () => {
      try {
        const r = await loadMsgs({ data: { threadId } });
        setInitial(r.messages as UIMessage[]);
      } catch {
        setInitial([]);
      }
    })();
    loadConns().then((r) => setConns(r.connections)).catch(() => {});
  }, [threadId]);

  if (initial === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading conversation…
      </div>
    );
  }

  return <ChatWindow key={threadId} threadId={threadId} initial={initial} conns={conns} />;
}

function ChatWindow({
  threadId,
  initial,
  conns,
}: {
  threadId: string;
  initial: UIMessage[];
  conns: any[];
}) {
  const activeCount = conns.filter((c) => c.status === "ACTIVE").length;
  const storageKey = `mythmind:agent:${threadId}`;
  const [agentId, setAgentId] = useState<string>(() => {
    if (typeof window === "undefined") return "lin";
    return window.localStorage.getItem(storageKey) ?? "lin";
  });
  const agent = getAgent(agentId) ?? agents[0];
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, agentId);
  }, [agentId, storageKey]);

  const agentRef = useRef(agentId);
  useEffect(() => {
    agentRef.current = agentId;
  }, [agentId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        },
        prepareSendMessagesRequest: ({ messages, id }) => ({
          body: { messages, threadId: id, agentId: agentRef.current },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: threadId,
    messages: initial,
    transport,
  });
  const fnDeleteMsg = useServerFn(deleteMessage);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    taRef.current?.focus();
  }, [threadId, status === "ready"]);

  const submit = async () => {
    const text = input.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    setInput("");
    await sendMessage({ text });
  };

  const busy = status === "submitted" || status === "streaming";

  const allowedSlugs = agent.toolkits.length
    ? conns
        .filter((c) => c.status === "ACTIVE")
        .filter((c) =>
          agent.toolkits.some((t) => t.toLowerCase() === String(c.toolkit_slug).toLowerCase()),
        )
    : conns.filter((c) => c.status === "ACTIVE");

  return (
    <>
      <div className="border-b px-6 py-3 flex items-center justify-between bg-background/80 backdrop-blur gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={agent.image}
            alt={agent.name}
            className="w-8 h-8 rounded-full object-cover ring-2"
            style={{ boxShadow: `0 0 0 2px ${agent.accent}` }}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight">{agent.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{agent.role}</div>
          </div>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="ml-2 text-xs border rounded-lg px-2 py-1 bg-background hover:bg-accent"
            aria-label="Choose employee"
          >
            <option value="lin">Lin — CEO (auto-routes the team)</option>
            {agents
              .filter((a) => a.id !== "lin")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.role} (direct)
                </option>
              ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] px-2 py-1 rounded-full border text-muted-foreground"
            title={
              agent.toolkits.length
                ? `Allowed: ${agent.toolkits.join(", ")}`
                : "CEO has access to all your integrations"
            }
          >
            <Wrench className="inline w-3 h-3 mr-1" />
            {allowedSlugs.length}/{agent.toolkits.length || activeCount} tools
          </span>
          <Link
            to="/integrations"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border hover:bg-accent"
          >
            <Plug className="w-3 h-3" />
            {activeCount} connected
          </Link>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-6 py-8 space-y-6">
          {messages.length === 0 && <EmptyState onPick={(t) => setInput(t)} />}
          {messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              onDelete={async () => {
                setMessages((prev) => prev.filter((x) => x.id !== m.id));
                try {
                  await fnDeleteMsg({ data: { id: m.id } });
                } catch {}
              }}
            />
          ))}
          {busy && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive border border-destructive/30 rounded-lg p-3">
              {error.message}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-background">
        <div className="max-w-[760px] mx-auto p-4">
          <div className="relative rounded-2xl border bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask your AI team anything…"
              className="w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-sm outline-none max-h-48"
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy || !input.trim()}
              className="absolute right-2 bottom-2 w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Send"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Mythmind can use your connected integrations to take real actions.
          </p>
        </div>
      </div>
    </>
  );
}

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  const suggestions = [
    "Draft a friendly cold outreach email to a SaaS founder",
    "Summarize the latest unread emails in my inbox",
    "Create a Notion page outlining a launch plan",
    "Find recent issues in my GitHub repo and propose fixes",
  ];
  return (
    <div className="text-center pt-10">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4">
        <Sparkles className="w-6 h-6" />
      </div>
      <h2 className="font-serif text-3xl">How can the team help?</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Connect your tools on the Integrations page, then assign real work.
      </p>
      <div className="mt-6 grid sm:grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="text-left text-sm border rounded-xl px-3 py-2.5 hover:bg-accent transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ m, onDelete }: { m: UIMessage; onDelete: () => void }) {
  const text = m.parts.map((p: any) => (p.type === "text" ? p.text : "")).join("");

  if (m.role === "user") {
    return (
      <div className="group flex flex-col items-end gap-1">
        <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
          {text}
        </div>
        <MessageActions text={text} onDelete={onDelete} role="user" />
      </div>
    );
  }
  return (
    <div className="group space-y-3">
      {m.parts.map((p: any, i: number) => {
        if (p.type === "text") {
          return (
            <div key={i} className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{p.text}</ReactMarkdown>
            </div>
          );
        }
        if (p.type?.startsWith("tool-")) {
          return <ToolCall key={i} part={p} />;
        }
        return null;
      })}
      <MessageActions text={text} onDelete={onDelete} role="assistant" />
    </div>
  );
}

function MessageActions({
  text,
  onDelete,
  role,
}: {
  text: string;
  onDelete: () => void;
  role: "user" | "assistant";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied — share anywhere");
      }
    } catch {}
  };

  const report = () => toast.success("Thanks — feedback noted");

  return (
    <div
      className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${
        role === "user" ? "justify-end" : ""
      }`}
    >
      <ActionBtn label="Copy" onClick={copy}>
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </ActionBtn>
      <ActionBtn label="Share" onClick={share}>
        <Share2 className="w-3.5 h-3.5" />
      </ActionBtn>
      {role === "assistant" && (
        <ActionBtn label="Report" onClick={report}>
          <Flag className="w-3.5 h-3.5" />
        </ActionBtn>
      )}
      <ActionBtn label="Delete" onClick={onDelete} danger>
        <Trash2 className="w-3.5 h-3.5" />
      </ActionBtn>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`p-1.5 rounded-md text-muted-foreground hover:bg-accent ${
        danger ? "hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ToolCall({ part }: { part: any }) {
  const name = part.type?.replace(/^tool-/, "") ?? "tool";
  if (name === "delegate_to_employee") {
    return <DelegationCard part={part} />;
  }
  return <GenericToolCall part={part} name={name} />;
}

function GenericToolCall({ part, name }: { part: any; name: string }) {
  const [open, setOpen] = useState(false);
  const state = part.state ?? "input-streaming";
  const statusLabel =
    state === "output-available"
      ? "Done"
      : state === "output-error"
        ? "Error"
        : "Running…";
  return (
    <div className="border rounded-xl bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs"
      >
        <span className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono">{name}</span>
          <span className="text-muted-foreground">· {statusLabel}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs space-y-2">
          {part.input && (
            <pre className="bg-background rounded p-2 overflow-auto max-h-48">
              {JSON.stringify(part.input, null, 2)}
            </pre>
          )}
          {part.output && (
            <pre className="bg-background rounded p-2 overflow-auto max-h-64">
              {JSON.stringify(part.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function DelegationCard({ part }: { part: any }) {
  const state = part.state ?? "input-streaming";
  const input = part.input ?? {};
  const output = part.output ?? {};
  const employeeId: string | undefined = output.employee_id ?? input.employee;
  const sub = employeeId ? getAgent(employeeId) : undefined;
  const lin = getAgent("lin")!;
  const timeline: any[] = Array.isArray(output.timeline) ? output.timeline : [];
  const running = state !== "output-available" && state !== "output-error";

  return (
    <div className="border rounded-2xl bg-gradient-to-br from-muted/40 to-background overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b bg-background/60">
        <img src={lin.image} alt="Lin" className="w-7 h-7 rounded-full object-cover ring-2"
             style={{ boxShadow: `0 0 0 2px ${lin.accent}` }} />
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        {sub ? (
          <img src={sub.image} alt={sub.name} className="w-7 h-7 rounded-full object-cover ring-2"
               style={{ boxShadow: `0 0 0 2px ${sub.accent}` }} />
        ) : (
          <div className="w-7 h-7 rounded-full bg-muted" />
        )}
        <div className="text-xs min-w-0 flex-1">
          <div className="font-medium">
            Lin → {sub?.name ?? input.employee ?? "teammate"}
          </div>
          <div className="text-muted-foreground truncate">{sub?.role ?? "Delegated task"}</div>
        </div>
        {running ? (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Working…
          </span>
        ) : output.error ? (
          <span className="text-[11px] text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        ) : (
          <span className="text-[11px] text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" /> Delivered
          </span>
        )}
      </div>

      {input.task && (
        <div className="px-4 py-2 text-xs border-b">
          <span className="text-muted-foreground">Brief: </span>
          <span>{input.task}</span>
        </div>
      )}

      {(timeline.length > 0 || running) && (
        <ol className="px-4 py-3 space-y-2">
          {timeline.map((ev, i) => (
            <TimelineRow key={i} ev={ev} />
          ))}
          {running && (
            <li className="text-[11px] text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {sub?.name ?? "Teammate"} is working…
            </li>
          )}
        </ol>
      )}

      {output.result && (
        <div className="px-4 py-3 border-t bg-background/40">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
            {sub?.name ?? "Result"}
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{String(output.result)}</ReactMarkdown>
          </div>
        </div>
      )}
      {output.error && (
        <div className="px-4 py-2 text-xs text-destructive border-t">{String(output.error)}</div>
      )}
    </div>
  );
}

function TimelineRow({ ev }: { ev: any }) {
  if (ev.kind === "route") {
    return (
      <li className="text-[11px] flex items-center gap-2 text-muted-foreground">
        <ArrowRight className="w-3 h-3" />
        Routed to <span className="font-medium text-foreground">{ev.employee}</span>
        {ev.tools?.length ? (
          <span>· tools: <span className="font-mono">{ev.tools.join(", ")}</span></span>
        ) : (
          <span>· no integrations</span>
        )}
      </li>
    );
  }
  if (ev.kind === "tool_call") {
    return (
      <li className="text-[11px] flex items-center gap-2">
        <Wrench className="w-3 h-3 text-muted-foreground" />
        <span className="font-mono">{ev.tool}</span>
        <span className="text-muted-foreground">called</span>
      </li>
    );
  }
  if (ev.kind === "tool_result") {
    const ok = !ev.output?.error;
    return (
      <li className="text-[11px] flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        ) : (
          <AlertCircle className="w-3 h-3 text-destructive" />
        )}
        <span className="font-mono">{ev.tool}</span>
        <span className="text-muted-foreground">{ok ? "succeeded" : "failed"}</span>
      </li>
    );
  }
  if (ev.kind === "thought") {
    return (
      <li className="text-[11px] flex items-start gap-2 text-muted-foreground">
        <Brain className="w-3 h-3 mt-0.5 shrink-0" />
        <span className="line-clamp-2">{ev.text}</span>
      </li>
    );
  }
  if (ev.kind === "error") {
    return (
      <li className="text-[11px] flex items-center gap-2 text-destructive">
        <AlertCircle className="w-3 h-3" /> {ev.error}
      </li>
    );
  }
  if (ev.kind === "done") {
    return (
      <li className="text-[11px] flex items-center gap-2 text-emerald-600">
        <CheckCircle2 className="w-3 h-3" /> Finished
      </li>
    );
  }
  return null;
}
