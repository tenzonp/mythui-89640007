import { createFileRoute, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getThreadMessages,
  listMyConnections,
  deleteMessage,
  listInstagramPendingReplies,
} from "@/lib/chat.functions";
import { uploadAttachment } from "@/lib/uploads.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowUp,
  Loader2,
  Plug,
  Sparkles,
  Wrench,
  ChevronDown,
  Copy,
  Share2,
  Trash2,
  Flag,
  Check,
  ArrowRight,
  Brain,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Download,
  X,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
} from "lucide-react";
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
  const [pendingInstagram, setPendingInstagram] = useState<any[]>([]);
  const loadMsgs = useServerFn(getThreadMessages);
  const loadConns = useServerFn(listMyConnections);
  const loadPendingInstagram = useServerFn(listInstagramPendingReplies);

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
    loadConns()
      .then((r) => setConns(r.connections))
      .catch(() => {});
    loadPendingInstagram()
      .then((r) => setPendingInstagram(r.pendingReplies))
      .catch(() => {});
  }, [threadId]);

  if (initial === null) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading conversation…
      </div>
    );
  }

  return (
    <ChatWindow
      key={threadId}
      threadId={threadId}
      initial={initial}
      conns={conns}
      pendingInstagram={pendingInstagram}
      onRefreshPendingInstagram={() =>
        loadPendingInstagram()
          .then((r) => setPendingInstagram(r.pendingReplies))
          .catch(() => {})
      }
    />
  );
}

function ChatWindow({
  threadId,
  initial,
  conns,
  pendingInstagram,
  onRefreshPendingInstagram,
}: {
  threadId: string;
  initial: UIMessage[];
  conns: any[];
  pendingInstagram: any[];
  onRefreshPendingInstagram: () => void;
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
  const [attachments, setAttachments] = useState<
    { name: string; url: string; mime: string; size: number; isImage: boolean }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const fnUpload = useServerFn(uploadAttachment);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    taRef.current?.focus();
  }, [threadId, status === "ready"]);

  useEffect(() => {
    if (status === "ready") onRefreshPendingInstagram();
  }, [status]);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const next = [...attachments];
      for (const f of Array.from(files).slice(0, 6)) {
        if (f.size > 20 * 1024 * 1024) {
          toast.error(`${f.name} is over 20MB`);
          continue;
        }
        const buf = await f.arrayBuffer();
        let bin = "";
        const u8 = new Uint8Array(buf);
        for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        const dataBase64 = btoa(bin);
        try {
          const r = await fnUpload({
            data: { name: f.name, dataBase64, mime: f.type || undefined },
          });
          next.push(r);
        } catch (e: any) {
          toast.error(e?.message ?? "Upload failed");
        }
      }
      setAttachments(next);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || status === "submitted" || status === "streaming")
      return;
    const atts = attachments;
    const attLines = atts.length
      ? "\n\n📎 Attached files (use run_code with `requests` to download/inspect, or web_fetch for text URLs):\n" +
        atts.map((a) => `- ${a.name} (${a.mime}) — ${a.url}`).join("\n")
      : "";
    const parts: any[] = [{ type: "text", text: (text || "(see attached files)") + attLines }];
    for (const a of atts) {
      if (a.isImage) {
        parts.push({ type: "file", url: a.url, mediaType: a.mime, filename: a.name });
      }
    }
    setInput("");
    setAttachments([]);
    await sendMessage({ parts });
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
          {pendingInstagram.length > 0 && <InstagramPendingBanner pending={pendingInstagram} />}
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
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 pb-0">
                {attachments.map((a, i) => (
                  <div
                    key={i}
                    className="group relative flex items-center gap-2 border rounded-lg px-2 py-1.5 text-xs bg-muted/40"
                  >
                    {a.isImage ? (
                      <img src={a.url} alt={a.name} className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <FileIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="max-w-[160px] truncate">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                      className="opacity-60 hover:opacity-100"
                      aria-label="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              className="w-full resize-none bg-transparent px-4 py-3.5 pl-12 pr-14 text-sm outline-none max-h-48"
            />
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute left-2 bottom-2 w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground disabled:opacity-40"
              aria-label="Attach files"
              title="Attach files (images, PDFs, CSVs…)"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || (!input.trim() && attachments.length === 0)}
              className="absolute right-2 bottom-2 w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Send"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Mythmind can read your attachments, see images, and ship real files back.
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

function InstagramPendingBanner({ pending }: { pending: any[] }) {
  const first = pending[0];
  return (
    <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">Instagram reply waiting for 24-hour window</div>
          <div className="text-xs text-muted-foreground mt-1">
            {pending.length} queued reply{pending.length === 1 ? "" : "ies"}. When recipient{" "}
            {first?.recipient_id} messages you first, ask the team to send pending Instagram replies
            for that recipient.
          </div>
        </div>
      </div>
    </div>
  );
}

function bytesLabel(n?: number) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FileGrid({
  files,
  align = "start",
}: {
  files: any[];
  align?: "start" | "end";
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  if (!files.length) return null;
  const images = files.filter((f) => (f.mediaType ?? f.mime ?? "").startsWith("image/"));
  const others = files.filter((f) => !(f.mediaType ?? f.mime ?? "").startsWith("image/"));
  const justify = align === "end" ? "justify-end" : "justify-start";

  return (
    <div className={`flex flex-col gap-2 ${align === "end" ? "items-end" : "items-start"} max-w-full`}>
      {images.length > 0 && (
        <div
          className={`grid gap-1.5 ${justify} ${
            images.length === 1
              ? "grid-cols-1"
              : images.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
          }`}
          style={{ maxWidth: 360 }}
        >
          {images.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxIdx(i)}
              className="block overflow-hidden rounded-lg border bg-muted/30 hover:opacity-90 transition"
            >
              <img
                src={f.url}
                alt={f.filename ?? f.name ?? "image"}
                className={`object-cover ${
                  images.length === 1 ? "max-h-72 w-auto" : "h-28 w-28"
                }`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className={`grid sm:grid-cols-2 gap-2 w-full max-w-[480px]`}>
          {others.map((f, i) => (
            <FileChip key={i} f={f} />
          ))}
        </div>
      )}
      {lightboxIdx !== null && (
        <Lightbox
          images={images}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onIndex={setLightboxIdx}
        />
      )}
    </div>
  );
}

function FileChip({ f }: { f: any }) {
  const mime = f.mediaType ?? f.mime ?? "";
  const name = f.filename ?? f.name ?? "file";
  const isPdf = mime.includes("pdf") || name.toLowerCase().endsWith(".pdf");
  const size = bytesLabel(f.size);
  const meta = [
    mime.split("/").pop()?.toUpperCase(),
    f.pageCount ? `${f.pageCount} page${f.pageCount === 1 ? "" : "s"}` : null,
    size,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <a
      href={`${f.url}${f.url.includes("?") ? "&" : "?"}download=1&name=${encodeURIComponent(name)}`}
      className="flex items-center gap-3 border rounded-xl px-3 py-2.5 bg-background hover:bg-accent transition-colors group/card"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {isPdf ? <FileText className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{meta || mime}</div>
      </div>
      <Download className="w-4 h-4 text-muted-foreground group-hover/card:text-foreground" />
    </a>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: any[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length]);
  const img = images[index];
  if (!img) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      <a
        href={`${img.url}${img.url.includes("?") ? "&" : "?"}download=1&name=${encodeURIComponent(img.filename ?? img.name ?? "image")}`}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 right-16 text-white/80 hover:text-white p-2"
        aria-label="Download"
      >
        <Download className="w-5 h-5" />
      </a>
      <img
        src={img.url}
        alt={img.filename ?? "image"}
        className="max-h-[90vh] max-w-[92vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + images.length) % images.length);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-white/10"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % images.length);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-white/10"
            aria-label="Next"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs">
            {index + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
}

function renderFileParts(parts: any[]) {
  const files = parts.filter((p) => p.type === "file" && typeof p.url === "string");
  if (!files.length) return null;
  return <FileGrid files={files} align="end" />;
}

function Message({ m, onDelete }: { m: UIMessage; onDelete: () => void }) {
  const visibleText = m.parts
    .map((p: any) => (p.type === "text" ? p.text : ""))
    .join("")
    .replace(/\n\n📎 Attached files[\s\S]*$/, "")
    .trim();

  if (m.role === "user") {
    return (
      <div className="group flex flex-col items-end gap-1 max-w-full">
        {renderFileParts(m.parts as any[])}
        {visibleText && (
          <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
            {visibleText}
          </div>
        )}
        <MessageActions text={visibleText} onDelete={onDelete} role="user" />
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
      <MessageActions text={visibleText} onDelete={onDelete} role="assistant" />
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

function ArtifactCard({ a }: { a: any }) {
  const isImage = (a.mime ?? "").startsWith("image/");
  const isPdf = (a.mime ?? "").includes("pdf");
  const sizeKb = a.size ? `${(a.size / 1024).toFixed(1)} KB` : "";
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      download={a.name}
      className="flex items-center gap-3 border rounded-xl px-3 py-2.5 bg-background hover:bg-accent transition-colors group/card"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {isImage ? (
          <ImageIcon className="w-5 h-5" />
        ) : isPdf ? (
          <FileText className="w-5 h-5" />
        ) : (
          <FileIcon className="w-5 h-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{a.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {a.mime} {sizeKb && `· ${sizeKb}`}
        </div>
      </div>
      <Download className="w-4 h-4 text-muted-foreground group-hover/card:text-foreground" />
    </a>
  );
}

function GenericToolCall({ part, name }: { part: any; name: string }) {
  const [open, setOpen] = useState(false);
  const state = part.state ?? "input-streaming";
  const queued = part.output?.status === "queued";
  const blocked = part.output?.status === "blocked" || part.output?.blocker;
  const artifacts: any[] = Array.isArray(part.output?.artifacts) ? part.output.artifacts : [];
  const statusLabel = queued
    ? "Queued"
    : blocked
      ? "Blocked"
      : state === "output-available"
        ? "Done"
        : state === "output-error"
          ? "Error"
          : "Running…";
  return (
    <div className="space-y-2">
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
            {artifacts.length > 0 && (
              <span className="text-muted-foreground">
                · {artifacts.length} file{artifacts.length === 1 ? "" : "s"}
              </span>
            )}
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
            {part.output &&
              (part.output?.message ? (
                <div className="bg-background rounded p-2 text-muted-foreground">
                  {String(part.output.message)}
                </div>
              ) : (
                <pre className="bg-background rounded p-2 overflow-auto max-h-64">
                  {JSON.stringify(part.output, null, 2)}
                </pre>
              ))}
          </div>
        )}
      </div>
      {artifacts.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2">
          {artifacts.map((a, i) => (
            <ArtifactCard key={i} a={a} />
          ))}
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
  const queued =
    output.status === "queued" || timeline.some((ev) => ev.output?.status === "queued");
  const blocked =
    output.status === "blocked" ||
    timeline.some((ev) => ev.output?.status === "blocked" || ev.output?.status === "still_blocked");

  return (
    <div className="border rounded-2xl bg-gradient-to-br from-muted/40 to-background overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b bg-background/60">
        <img
          src={lin.image}
          alt="Lin"
          className="w-7 h-7 rounded-full object-cover ring-2"
          style={{ boxShadow: `0 0 0 2px ${lin.accent}` }}
        />
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        {sub ? (
          <img
            src={sub.image}
            alt={sub.name}
            className="w-7 h-7 rounded-full object-cover ring-2"
            style={{ boxShadow: `0 0 0 2px ${sub.accent}` }}
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-muted" />
        )}
        <div className="text-xs min-w-0 flex-1">
          <div className="font-medium">Lin → {sub?.name ?? input.employee ?? "teammate"}</div>
          <div className="text-muted-foreground truncate">{sub?.role ?? "Delegated task"}</div>
        </div>
        {running ? (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Working…
          </span>
        ) : queued ? (
          <span className="text-[11px] text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" /> Queued
          </span>
        ) : output.error || blocked ? (
          <span className="text-[11px] text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" /> Blocked
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
          <span>
            · tools: <span className="font-mono">{ev.tools.join(", ")}</span>
          </span>
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
    const queued = ev.output?.status === "queued";
    const blocked =
      ev.output?.status === "blocked" ||
      ev.output?.status === "still_blocked" ||
      ev.output?.blocker;
    const ok = !ev.output?.error && !blocked && !queued;
    return (
      <li className="text-[11px] flex items-center gap-2">
        {queued ? (
          <AlertCircle className="w-3 h-3 text-amber-600" />
        ) : ok ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        ) : (
          <AlertCircle className="w-3 h-3 text-destructive" />
        )}
        <span className="font-mono">{ev.tool}</span>
        <span className="text-muted-foreground">
          {queued ? "queued until recipient replies" : ok ? "succeeded" : "blocked"}
        </span>
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
