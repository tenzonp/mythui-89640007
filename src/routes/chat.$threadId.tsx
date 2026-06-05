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
  Play,
  Video as VideoIcon,
  RotateCw,
  UploadCloud,
  FileCode2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { agents, getAgent } from "@/data/agents";
import { useChatActivity, type ThreadFile, type ThreadTask } from "@/lib/chat-context";
import { WYNSA_MODELS, getWynsaModel, type WynsaModelId, type PlanTier } from "@/lib/plans";
import { getMyPlan } from "@/lib/credits.functions";
import { Lock } from "lucide-react";

type TabKey = "chat" | "files" | "tasks" | "notes";

function friendlyToolLabel(name: string): { label: string; icon?: string } {
  const n = name.toLowerCase();
  if (n.includes("image") || n.includes("imagegen")) return { label: "Image generation" };
  if (n.includes("gmail") || n.includes("email") || n.includes("mail"))
    return { label: "Email" };
  if (n.includes("instagram")) return { label: "Instagram post" };
  if (n.includes("twitter") || n.includes("x_post")) return { label: "Twitter post" };
  if (n.includes("linkedin")) return { label: "LinkedIn post" };
  if (n.includes("youtube")) return { label: "YouTube" };
  if (n.includes("notion")) return { label: "Notion doc" };
  if (n.includes("slack")) return { label: "Slack message" };
  if (n.includes("calendar")) return { label: "Calendar event" };
  if (n.includes("sheet") || n.includes("excel")) return { label: "Spreadsheet" };
  if (n.includes("firecrawl") || n.includes("search") || n.includes("web_fetch") || n.includes("research"))
    return { label: "Research" };
  if (n.includes("run_code") || n.includes("e2b")) return { label: "Code execution" };
  if (n.includes("delegate")) return { label: "Delegate to teammate" };
  if (n.includes("video")) return { label: "Video generation" };
  return { label: name.replace(/_/g, " ") };
}

// Map a tool name → the AI employee who owns that kind of work.
function toolOwner(name: string): string | undefined {
  const n = name.toLowerCase();
  if (n.includes("build_website") || n.includes("site") || n.includes("design") || n.includes("figma") || n.includes("notion") || n.includes("linear") || n.includes("jira") || n.includes("research") || n.includes("firecrawl") || n.includes("web_fetch") || n.includes("image") || n.includes("video")) return "reyes";
  if (n.includes("instagram") || n.includes("twitter") || n.includes("x_post") || n.includes("tiktok") || n.includes("youtube") || n.includes("facebook") || n.includes("linkedin") || n.includes("mailchimp") || n.includes("hubspot") || n.includes("ads") || n.includes("analytics")) return "vale";
  if (n.includes("salesforce") || n.includes("apollo") || n.includes("calendly") || n.includes("calendar") || n.includes("gmail") || n.includes("mail")) return "bloom";
  if (n.includes("zapier") || n.includes("sheet") || n.includes("airtable") || n.includes("github") || n.includes("drive") || n.includes("run_code") || n.includes("e2b") || n.includes("slack")) return "kade";
  if (n.includes("intercom") || n.includes("zendesk") || n.includes("discord") || n.includes("support") || n.includes("ticket")) return "sage";
  if (n.includes("knowledge")) return "lin";
  return undefined;
}

function timeAgo(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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

  // Wynsa model selection
  const modelKey = `mythmind:model:${threadId}`;
  const [modelId, setModelId] = useState<WynsaModelId>(() => {
    if (typeof window === "undefined") return "lady";
    return (window.localStorage.getItem(modelKey) as WynsaModelId) ?? "lady";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(modelKey, modelId);
  }, [modelId, modelKey]);
  const modelRef = useRef(modelId);
  useEffect(() => {
    modelRef.current = modelId;
  }, [modelId]);

  // Plan tier (drives model gating)
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const fetchPlan = useServerFn(getMyPlan);
  useEffect(() => {
    fetchPlan()
      .then((p) => setPlanTier(p.tier as PlanTier))
      .catch(() => {});
  }, []);

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
          body: { messages, threadId: id, agentId: agentRef.current, modelId: modelRef.current },
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
  type Att = {
    id: string;
    name: string;
    mime: string;
    size: number;
    url?: string;
    isImage?: boolean;
    isPdf?: boolean;
    isVideo?: boolean;
    pageCount?: number;
    thumbnail?: string; // data URL for video preview / image preview
    status: "uploading" | "ready" | "error";
    progress: number; // 0..100
    error?: string;
    _file?: File;
  };
  const [attachments, setAttachments] = useState<Att[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fnUpload = useServerFn(uploadAttachment);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const uploading = attachments.some((a) => a.status === "uploading");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    taRef.current?.focus();
  }, [threadId, status === "ready"]);

  useEffect(() => {
    if (status === "ready") onRefreshPendingInstagram();
  }, [status]);

  const patchAtt = (id: string, patch: Partial<Att>) =>
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const uploadOne = async (att: Att, attempt = 1): Promise<void> => {
    const f = att._file!;
    try {
      // Reading phase progress: 0 → 25
      patchAtt(att.id, { status: "uploading", progress: 5, error: undefined });
      const buf = await f.arrayBuffer();
      patchAtt(att.id, { progress: 25 });
      let bin = "";
      const u8 = new Uint8Array(buf);
      const CHUNK = 0x8000;
      for (let i = 0; i < u8.length; i += CHUNK) {
        bin += String.fromCharCode.apply(
          null,
          Array.from(u8.subarray(i, i + CHUNK)) as any,
        );
      }
      const dataBase64 = btoa(bin);
      patchAtt(att.id, { progress: 55 });

      // Smooth progress while server fn runs
      const ticker = setInterval(() => {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === att.id && a.status === "uploading" && a.progress < 92
              ? { ...a, progress: a.progress + 3 }
              : a,
          ),
        );
      }, 350);

      try {
        const r = await fnUpload({
          data: { name: f.name, dataBase64, mime: f.type || undefined },
        });
        clearInterval(ticker);
        patchAtt(att.id, {
          status: "ready",
          progress: 100,
          url: r.url,
          mime: r.mime,
          size: r.size,
          isImage: r.isImage,
          isPdf: r.isPdf,
          pageCount: r.pageCount,
        });
      } finally {
        clearInterval(ticker);
      }
    } catch (e: any) {
      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, 600 * attempt));
        return uploadOne(att, attempt + 1);
      }
      patchAtt(att.id, { status: "error", error: e?.message ?? "Upload failed" });
      toast.error(`${f.name}: ${e?.message ?? "Upload failed"}`);
    }
  };

  const makeVideoThumb = (file: File): Promise<string | undefined> =>
    new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video");
        v.preload = "metadata";
        v.muted = true;
        v.playsInline = true;
        v.src = url;
        v.onloadedmetadata = () => {
          try {
            v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
          } catch {
            resolve(undefined);
          }
        };
        v.onseeked = () => {
          try {
            const c = document.createElement("canvas");
            c.width = v.videoWidth || 320;
            c.height = v.videoHeight || 180;
            const ctx = c.getContext("2d");
            if (!ctx) return resolve(undefined);
            ctx.drawImage(v, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", 0.7));
          } catch {
            resolve(undefined);
          } finally {
            URL.revokeObjectURL(url);
          }
        };
        v.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(undefined);
        };
      } catch {
        resolve(undefined);
      }
    });

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files as any as File[]).slice(0, 10);
    if (!arr.length) return;
    const fresh: Att[] = [];
    for (const f of arr) {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name} is over 20MB`);
        continue;
      }
      const mime = f.type || "";
      const att: Att = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        mime,
        size: f.size,
        isImage: mime.startsWith("image/"),
        isPdf: mime.includes("pdf"),
        isVideo: mime.startsWith("video/"),
        status: "uploading",
        progress: 0,
        _file: f,
      };
      if (att.isImage) {
        att.thumbnail = URL.createObjectURL(f);
      }
      fresh.push(att);
    }
    if (!fresh.length) return;
    setAttachments((p) => [...p, ...fresh]);
    // Kick off uploads + video thumbs in parallel
    for (const att of fresh) {
      if (att.isVideo) {
        makeVideoThumb(att._file!).then((thumb) => {
          if (thumb) patchAtt(att.id, { thumbnail: thumb });
        });
      }
      uploadOne(att);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const retryAtt = (id: string) => {
    const a = attachments.find((x) => x.id === id);
    if (a) uploadOne({ ...a, progress: 0, status: "uploading" });
  };

  // Window-level drag and drop
  useEffect(() => {
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      depth++;
      setDragOver(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragOver(false);
    };
    const onOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      depth = 0;
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [attachments.length]);

  const onPaste = (e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files && files.length) addFiles(files);
  };

  const submit = async () => {
    const text = input.trim();
    const ready = attachments.filter((a) => a.status === "ready" && a.url);
    if ((!text && ready.length === 0) || status === "submitted" || status === "streaming")
      return;
    if (attachments.some((a) => a.status === "uploading")) {
      toast.error("Wait for uploads to finish");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const atts = ready.map((a) => ({
      ...a,
      url: a.url!.startsWith("http") ? a.url! : `${origin}${a.url}`,
    }));
    const attLines = atts.length
      ? "\n\n📎 Attached files (use run_code with `requests` to download/inspect, or web_fetch for text URLs):\n" +
        atts
          .map(
            (a) =>
              `- ${a.name} (${a.mime}${a.pageCount ? `, ${a.pageCount} pages` : ""}) — ${a.url}`,
          )
          .join("\n")
      : "";
    const parts: any[] = [{ type: "text", text: (text || "(see attached files)") + attLines }];
    for (const a of atts) {
      parts.push({ type: "file", url: a.url, mediaType: a.mime, filename: a.name });
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

  const [tab, setTab] = useState<TabKey>("chat");

  const threadTitle = useMemo(() => {
    const first = messages.find((m) => m.role === "user");
    if (!first) return "New Conversation";
    const txt = (first.parts as any[])
      .map((p) => (p?.type === "text" ? p.text : ""))
      .join(" ")
      .trim();
    return txt ? txt.slice(0, 72) : "New Conversation";
  }, [messages]);
  void allowedSlugs;

  // Derive Files + Tasks + Employee activity from messages
  const { files, tasks, working, active, progress } = useMemo(() => {
    const files: ThreadFile[] = [];
    const tasks: ThreadTask[] = [];
    const working = new Set<string>();
    const active = new Set<string>();
    let totalTools = 0;
    let doneTools = 0;
    for (const m of messages) {
      for (const p of m.parts as any[]) {
        // user-attached files
        if (p.type === "file" && typeof p.url === "string") {
          files.push({
            name: p.filename ?? "file",
            mime: p.mediaType,
            url: p.url,
            isImage: (p.mediaType ?? "").startsWith("image/"),
            isPdf: (p.mediaType ?? "").includes("pdf"),
          });
        }
        // assistant tool calls
        if (typeof p.type === "string" && p.type.startsWith("tool-")) {
          totalTools++;
          const name = p.type.replace(/^tool-/, "");
          const state = p.state ?? "input-streaming";
          const queued = p.output?.status === "queued";
          const blocked = p.output?.status === "blocked" || p.output?.blocker;
          const isDone = state === "output-available";
          const isErr = state === "output-error";
          const tStatus: ThreadTask["status"] = isErr
            ? "error"
            : blocked
              ? "blocked"
              : queued
                ? "queued"
                : isDone
                  ? "done"
                  : "running";
          if (isDone || isErr) doneTools++;
          // delegation → record agent activity
          if (name === "delegate_to_employee") {
            const employeeId: string | undefined =
              p.output?.employee_id ?? p.input?.employee;
            if (employeeId) {
              if (tStatus === "running") working.add(employeeId);
              else active.add(employeeId);
            }
            const sub = employeeId ? getAgent(employeeId) : undefined;
            tasks.push({
              id: `${m.id}-${name}-${tasks.length}`,
              label: `Delegated to ${sub?.name ?? employeeId ?? "teammate"}`,
              detail: p.input?.task,
              agentId: employeeId,
              status: tStatus,
            });
          } else {
            const f = friendlyToolLabel(name);
            // Map tool → owning employee so the sidebar shows the right teammate working.
            const owner = toolOwner(name);
            if (owner) {
              if (tStatus === "running") working.add(owner);
              else active.add(owner);
            }
            tasks.push({
              id: `${m.id}-${name}-${tasks.length}`,
              label: f.label,
              detail: name,
              agentId: owner,
              status: tStatus,
            });
          }
          // collect artifacts from tool outputs
          const arts: any[] = Array.isArray(p.output?.artifacts) ? p.output.artifacts : [];
          for (const a of arts) {
            files.push({
              name: a.name ?? "file",
              mime: a.mime,
              size: a.size,
              url: a.url,
              isImage: a.isImage || (a.mime ?? "").startsWith("image/"),
              isPdf: a.isPdf || (a.mime ?? "").includes("pdf"),
            });
          }
        }
      }
    }
    const progress = totalTools === 0 ? (messages.length ? 100 : 0) : Math.round((doneTools / totalTools) * 100);
    return { files, tasks, working, active, progress };
  }, [messages]);

  const { setActivity } = useChatActivity();
  useEffect(() => {
    setActivity({
      threadTitle,
      files,
      tasks,
      working,
      active,
      progress,
      running: busy,
    });
  }, [threadTitle, files, tasks, working, active, progress, busy, setActivity]);


  return (
    <>
      <div className="border-b bg-white">
        <div className="px-6 pt-3 pb-1.5 flex items-center justify-between gap-3">
          <h1 className="text-[17px] font-semibold tracking-tight truncate">{threadTitle}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard?.writeText(window.location.href);
                  toast.success("Link copied");
                }
              }}
              className="inline-flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-lg border hover:bg-accent"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            <Link
              to="/integrations"
              className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border hover:bg-accent text-muted-foreground"
              title={`${activeCount} integrations connected`}
            >
              <Plug className="w-3 h-3" />
              {activeCount}
            </Link>
            <button
              className="w-7 h-7 rounded-lg border hover:bg-accent inline-flex items-center justify-center text-muted-foreground text-xs"
              aria-label="More"
            >
              ···
            </button>
          </div>
        </div>
        <div className="px-6 flex items-center gap-5 text-[13px]">
          {([
            { k: "chat", label: "Chat" },
            { k: "files", label: `Files${files.length ? ` (${files.length})` : ""}` },
            { k: "tasks", label: `Tasks${tasks.length ? ` (${tasks.length})` : ""}` },
            { k: "notes", label: "Notes" },
          ] as { k: TabKey; label: string }[]).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={
                "py-1.5 -mb-px border-b-2 transition-colors " +
                (tab === t.k
                  ? "border-violet text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <ModelPicker modelId={modelId} setModelId={setModelId} userTier={planTier} />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {tab === "chat" && (
          <div className="max-w-[760px] mx-auto px-6 py-5 space-y-5">
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
            {error && (() => {
              let parsed: any = null;
              try { parsed = JSON.parse(error.message); } catch {}
              if (parsed?.code === "insufficient_credits" || parsed?.code === "plan_locked") {
                return (
                  <div className="rounded-2xl border border-violet/30 bg-gradient-to-br from-violet/5 to-white p-4 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-violet shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {parsed.code === "plan_locked" ? "This model needs an upgrade" : "You've run out of credits"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {parsed.code === "plan_locked"
                          ? "Upgrade your plan to unlock this Wynsa model."
                          : `Your balance is ${parsed.balance ?? 0}. Upgrade for more monthly credits or wait for your next daily refill.`}
                      </div>
                      <Link
                        to="/billing"
                        className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-violet text-white text-xs font-medium hover:bg-violet/90"
                      >
                        Upgrade plan <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              }
              return (
                <div className="text-sm text-destructive border border-destructive/30 rounded-lg p-3">
                  {error.message}
                </div>
              );
            })()}
          </div>
        )}
        {tab === "files" && <FilesPane files={files} />}
        {tab === "tasks" && <TasksPane tasks={tasks} />}
        {tab === "notes" && <NotesPane />}
      </div>


      <div className="border-t bg-background">
        <div className="max-w-[760px] mx-auto px-4 py-3">

          <div className="relative rounded-2xl border bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 pb-0">
                {attachments.map((a) => {
                  const ext = (a.mime ?? "").split("/").pop()?.toUpperCase();
                  const meta = [
                    ext,
                    a.pageCount ? `${a.pageCount}p` : null,
                    bytesLabel(a.size),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div
                      key={a.id}
                      className="group relative flex items-center gap-2 border rounded-lg pl-1.5 pr-2 py-1 text-xs bg-muted/40 overflow-hidden"
                    >
                      <div className="relative w-8 h-8 rounded overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        {a.thumbnail ? (
                          <img src={a.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : a.isPdf ? (
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        ) : a.isVideo ? (
                          <VideoIcon className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <FileIcon className="w-4 h-4 text-muted-foreground" />
                        )}
                        {a.isVideo && a.thumbnail && (
                          <Play className="w-3 h-3 text-white absolute inset-0 m-auto drop-shadow" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="max-w-[160px] truncate">{a.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          {a.status === "uploading" && (
                            <>
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              {Math.round(a.progress)}%
                            </>
                          )}
                          {a.status === "ready" && meta}
                          {a.status === "error" && (
                            <span className="text-destructive">Failed</span>
                          )}
                        </div>
                      </div>
                      {a.status === "error" && (
                        <button
                          type="button"
                          onClick={() => retryAtt(a.id)}
                          className="opacity-70 hover:opacity-100"
                          aria-label="Retry"
                          title="Retry upload"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((p) => p.filter((x) => x.id !== a.id))
                        }
                        className="opacity-60 hover:opacity-100"
                        aria-label="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {a.status === "uploading" && (
                        <div
                          className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all"
                          style={{ width: `${a.progress}%` }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask your AI team anything… (drag & drop or paste files)"
              className="w-full resize-none bg-transparent px-4 py-3.5 pl-12 pr-14 text-sm outline-none max-h-48"
            />
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
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
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-primary/10 backdrop-blur-sm flex items-center justify-center">
          <div className="rounded-2xl border-2 border-dashed border-primary bg-background/95 px-8 py-6 flex flex-col items-center gap-2 shadow-xl">
            <UploadCloud className="w-8 h-8 text-primary" />
            <div className="text-sm font-medium">Drop files to attach</div>
            <div className="text-xs text-muted-foreground">
              Images, videos, PDFs, CSVs · up to 20MB each
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilesPane({ files }: { files: ThreadFile[] }) {
  if (!files.length) {
    return (
      <div className="max-w-[760px] mx-auto px-6 py-10 text-center text-sm text-muted-foreground">
        No files yet. Attach a file or ask the team to generate one.
      </div>
    );
  }
  return (
    <div className="max-w-[760px] mx-auto px-6 py-5">
      <div className="grid sm:grid-cols-2 gap-2">
        {files.map((f, i) => {
          const isImage = f.isImage;
          const isPdf = f.isPdf;
          const isCode = /\.(json|js|ts|tsx|py|html|css)$/i.test(f.name);
          return (
            <a
              key={i}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 border rounded-xl px-3 py-2.5 bg-background hover:bg-accent/40 transition-colors"
            >
              {isImage && f.url ? (
                <img
                  src={f.url}
                  alt={f.name}
                  className="w-10 h-10 rounded-lg object-cover border"
                />
              ) : (
                <div
                  className={
                    "w-10 h-10 rounded-lg flex items-center justify-center " +
                    (isPdf
                      ? "bg-rose-100 text-rose-700"
                      : isCode
                        ? "bg-amber-100 text-amber-700"
                        : "bg-primary/10 text-primary")
                  }
                >
                  {isPdf ? (
                    <FileText className="w-5 h-5" />
                  ) : isCode ? (
                    <FileCode2 className="w-5 h-5" />
                  ) : (
                    <FileIcon className="w-5 h-5" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {[(f.mime ?? "").split("/").pop()?.toUpperCase(), bytesLabel(f.size)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <Download className="w-4 h-4 text-muted-foreground" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

function TasksPane({ tasks }: { tasks: ThreadTask[] }) {
  if (!tasks.length) {
    return (
      <div className="max-w-[760px] mx-auto px-6 py-10 text-center text-sm text-muted-foreground">
        No tasks yet. Ask the team to research, draft, generate or post — tasks will show up here.
      </div>
    );
  }
  const dotFor = (s: ThreadTask["status"]) =>
    s === "running"
      ? "bg-amber-500 animate-pulse"
      : s === "done"
        ? "bg-emerald-500"
        : s === "queued"
          ? "bg-amber-400"
          : s === "blocked"
            ? "bg-rose-500"
            : "bg-rose-600";
  const labelFor = (s: ThreadTask["status"]) =>
    s === "running"
      ? "Working"
      : s === "done"
        ? "Done"
        : s === "queued"
          ? "Queued"
          : s === "blocked"
            ? "Blocked"
            : "Error";
  return (
    <div className="max-w-[760px] mx-auto px-6 py-5">
      <ul className="divide-y border rounded-xl bg-background overflow-hidden">
        {tasks.map((t) => {
          const sub = t.agentId ? getAgent(t.agentId) : undefined;
          return (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              {sub ? (
                <img src={sub.image} alt={sub.name} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{t.label}</div>
                {t.detail && (
                  <div className="text-[11px] text-muted-foreground truncate">{t.detail}</div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                <span className={cn("w-1.5 h-1.5 rounded-full", dotFor(t.status))} />
                {labelFor(t.status)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NotesPane() {
  return (
    <div className="max-w-[760px] mx-auto px-6 py-10 text-center text-sm text-muted-foreground">
      Notes coming soon. Pin key takeaways from this conversation here.
    </div>
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

function classifyFile(f: any) {
  const mime = (f.mediaType ?? f.mime ?? "").toLowerCase();
  const name = (f.filename ?? f.name ?? "").toLowerCase();
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/.test(name);
  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");
  return { isImage, isVideo, isPdf, viewable: isImage || isVideo || isPdf };
}

function FileGrid({
  files,
  align = "start",
}: {
  files: any[];
  align?: "start" | "end";
}) {
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  if (!files.length) return null;
  const viewable = files.filter((f) => classifyFile(f).viewable);
  const others = files.filter((f) => !classifyFile(f).viewable);
  const justify = align === "end" ? "justify-end" : "justify-start";
  const onlyImages = viewable.every((f) => classifyFile(f).isImage);

  return (
    <div className={`flex flex-col gap-2 ${align === "end" ? "items-end" : "items-start"} max-w-full`}>
      {viewable.length > 0 && (
        <div
          className={`grid gap-1.5 ${justify} ${
            viewable.length === 1
              ? "grid-cols-1"
              : viewable.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
          }`}
          style={{ maxWidth: 360 }}
        >
          {viewable.map((f, i) => {
            const { isImage, isVideo, isPdf } = classifyFile(f);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setViewerIdx(i)}
                className="relative block overflow-hidden rounded-lg border bg-muted/30 hover:opacity-90 transition group"
              >
                {isImage ? (
                  <img
                    src={f.url}
                    alt={f.filename ?? f.name ?? "image"}
                    className={`object-cover ${
                      onlyImages && viewable.length === 1 ? "max-h-72 w-auto" : "h-28 w-28"
                    }`}
                    loading="lazy"
                  />
                ) : isVideo ? (
                  <div className="h-28 w-28 relative bg-black flex items-center justify-center">
                    <video
                      src={f.url}
                      preload="metadata"
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition" />
                    <Play className="w-7 h-7 text-white relative drop-shadow" />
                  </div>
                ) : isPdf ? (
                  <div className="h-28 w-28 bg-card flex flex-col items-center justify-center text-center px-2">
                    <FileText className="w-6 h-6 text-primary mb-1" />
                    <div className="text-[10px] truncate w-full">{f.filename ?? f.name}</div>
                    {f.pageCount && (
                      <div className="text-[10px] text-muted-foreground">
                        {f.pageCount}p
                      </div>
                    )}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      {others.length > 0 && (
        <div className={`grid sm:grid-cols-2 gap-2 w-full max-w-[480px]`}>
          {others.map((f, i) => (
            <FileChip key={i} f={f} />
          ))}
        </div>
      )}
      {viewerIdx !== null && (
        <Lightbox
          images={viewable}
          index={viewerIdx}
          onClose={() => setViewerIdx(null)}
          onIndex={setViewerIdx}
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
      {(() => {
        const { isImage, isVideo, isPdf } = classifyFile(img);
        const name = img.filename ?? img.name ?? "file";
        if (isVideo) {
          return (
            <video
              key={img.url}
              src={img.url}
              controls
              autoPlay
              className="max-h-[90vh] max-w-[92vw] bg-black"
              onClick={(e) => e.stopPropagation()}
            />
          );
        }
        if (isPdf) {
          return (
            <PdfViewer key={img.url} file={img} name={name} />
          );
        }
        return (
          <img
            src={img.url}
            alt={isImage ? name : "preview"}
            className="max-h-[90vh] max-w-[92vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        );
      })()}
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

function PdfViewer({ file, name }: { file: any; name: string }) {
  const total: number =
    typeof file.pageCount === "number" && file.pageCount > 0 ? file.pageCount : 1;
  const [page, setPage] = useState(1);
  const go = (n: number) => setPage(Math.max(1, Math.min(total, n)));
  // Use #page=N hash to jump in the browser's built-in PDF viewer.
  const src = `${file.url}#page=${page}&view=FitH&toolbar=1`;
  return (
    <div
      className="flex flex-col items-stretch gap-2 w-[92vw] h-[90vh]"
      onClick={(e) => e.stopPropagation()}
    >
      <iframe src={src} title={name} className="flex-1 bg-white rounded" />
      <div className="flex items-center gap-2 bg-black/60 rounded-lg p-2">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="text-white/80 hover:text-white disabled:opacity-30 px-2"
          aria-label="Previous page"
        >
          ‹
        </button>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1.5 px-1">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
              const active = n === page;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => go(n)}
                  className={`shrink-0 w-12 h-16 rounded border text-[11px] flex flex-col items-center justify-end pb-1 transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white/10 text-white/80 border-white/20 hover:bg-white/20"
                  }`}
                  aria-label={`Go to page ${n}`}
                >
                  <FileText className="w-5 h-5 mb-0.5 opacity-80" />
                  {n}
                </button>
              );
            })}
          </div>
        </div>
        <input
          type="number"
          min={1}
          max={total}
          value={page}
          onChange={(e) => go(parseInt(e.target.value, 10) || 1)}
          className="w-14 text-center text-xs bg-white/10 text-white rounded px-1 py-1 border border-white/20"
          aria-label="Page"
        />
        <span className="text-white/70 text-xs">/ {total}</span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= total}
          className="text-white/80 hover:text-white disabled:opacity-30 px-2"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
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
  if (name === "build_website") {
    return <WebsiteBuildCard part={part} />;
  }
  return <GenericToolCall part={part} name={name} />;
}

const BUILD_STEPS = [
  { key: "brief", label: "Reading brief & business knowledge", emoji: "🧠" },
  { key: "design", label: "Designing layout & visual system", emoji: "🎨" },
  { key: "code", label: "Writing HTML, CSS & JS", emoji: "💻" },
  { key: "assets", label: "Sourcing imagery & icons", emoji: "🖼️" },
  { key: "zip", label: "Packaging static bundle", emoji: "📦" },
  { key: "deploy", label: "Deploying to Netlify", emoji: "🚀" },
] as const;
const STEP_DURATIONS = [4, 12, 25, 8, 4, 9999]; // seconds per step; last waits for completion

function WebsiteBuildCard({ part }: { part: any }) {
  const state = part.state ?? "input-streaming";
  const input = part.input ?? {};
  const output = part.output ?? {};
  const running = state !== "output-available" && state !== "output-error";
  const failed = state === "output-error" || output?.error;
  const liveUrl: string | undefined = output?.live_url;
  const zipUrl: string | undefined = output?.zip_url;
  const fileCount: number | undefined = output?.file_count;
  const siteName: string | undefined = input?.name;

  const startedAtRef = useRef<number>(Date.now());
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
  let activeIdx = 0;
  let acc = 0;
  for (let i = 0; i < BUILD_STEPS.length; i++) {
    acc += STEP_DURATIONS[i];
    if (secs < acc) { activeIdx = i; break; }
    activeIdx = i;
  }
  if (running && activeIdx >= BUILD_STEPS.length - 1) activeIdx = BUILD_STEPS.length - 1;
  if (!running && !failed) activeIdx = BUILD_STEPS.length;

  const statusLabel = running ? "Building & deploying…" : failed ? "Failed" : "Live";
  const statusColor = running ? "bg-amber-500" : failed ? "bg-destructive" : "bg-emerald-500";
  const reyes = getAgent("reyes");
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  const elapsedLabel = mins > 0 ? `${mins}m ${rem}s` : `${secs}s`;

  return (
    <div className="relative border rounded-2xl overflow-hidden bg-gradient-to-br from-violet/5 via-background to-background">
      {/* Blueprint grid backdrop when running */}
      {running && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
      )}

      <div className="relative px-4 py-3 flex items-center gap-3 border-b bg-background/60 backdrop-blur">
        <div className="relative shrink-0">
          {reyes?.image ? (
            <img src={reyes.image} alt={reyes.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-violet/30" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-violet/10 text-violet flex items-center justify-center">
              <FileCode2 className="w-4 h-4" />
            </div>
          )}
          {running && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate flex items-center gap-1.5">
            {siteName ? `Constructing · ${siteName}` : "Constructing your site"}
            {running && <span className="inline-block w-1.5 h-3 bg-violet/80 animate-pulse" />}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor} ${running ? "animate-pulse" : ""}`} />
            <span>{running ? "Hold on, crafting…" : statusLabel}</span>
            <span>·</span>
            <span>{reyes?.name ?? "Reyes"} — {reyes?.role ?? "Product & Innovation"}</span>
            {running && <><span>·</span><span className="tabular-nums">{elapsedLabel}</span></>}
            {fileCount ? <><span>·</span><span>{fileCount} files</span></> : null}
          </div>
        </div>
      </div>

      {input?.prompt && (
        <div className="relative px-4 py-2 text-xs text-muted-foreground border-b">
          <span className="font-medium text-foreground">Brief: </span>
          {String(input.prompt).slice(0, 220)}
          {String(input.prompt).length > 220 ? "…" : ""}
        </div>
      )}

      {running && (
        <BuildConsole stepKey={BUILD_STEPS[activeIdx]?.key ?? "brief"} siteName={siteName} />
      )}

      {(running || failed) && (
        <div className="relative px-4 py-3 border-b">
          <ol className="space-y-1.5">
            {BUILD_STEPS.map((s, i) => {
              const done = i < activeIdx;
              const active = running && i === activeIdx;
              return (
                <li key={s.key} className="flex items-center gap-2.5 text-xs">
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-colors",
                    done ? "bg-emerald-500/15 text-emerald-600" :
                    active ? "bg-violet/15 text-violet" :
                    "bg-muted text-muted-foreground/60",
                  )}>
                    {done ? <Check className="w-3 h-3" /> : active ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>{i + 1}</span>}
                  </span>
                  <span className={cn(
                    "truncate",
                    done ? "text-foreground/70" : active ? "text-foreground font-medium" : "text-muted-foreground/70",
                  )}>
                    <span className="mr-1.5">{s.emoji}</span>{s.label}
                  </span>
                </li>
              );
            })}
          </ol>
          {running && secs > 90 && (
            <div className="mt-3 text-[11px] text-muted-foreground italic">
              Production-grade sites can take 1–3 minutes. Hang tight — Reyes is hand-crafting your pages.
            </div>
          )}
        </div>
      )}

      {failed && (
        <div className="px-4 py-3 text-xs text-destructive">
          {String(output?.error ?? "Build failed")}
        </div>
      )}
      {!running && !failed && (
        <div className="px-4 py-3 grid sm:grid-cols-2 gap-2">
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2.5 hover:bg-accent/50 transition"
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Live URL</div>
                <div className="text-sm font-medium truncate">{liveUrl.replace(/^https?:\/\//, "")}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </a>
          )}
          {zipUrl && (
            <a
              href={`${zipUrl}${zipUrl.includes("?") ? "&" : "?"}download=1`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2.5 hover:bg-accent/50 transition"
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Source ZIP</div>
                <div className="text-sm font-medium truncate">Download project</div>
              </div>
              <Download className="w-4 h-4 text-muted-foreground shrink-0" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const STEP_CODE_LINES: Record<string, string[]> = {
  brief: [
    "// Reading brief & business knowledge",
    "const brief = await loadBrief(threadId);",
    "const knowledge = await fetchBusinessProfile();",
    "const audience = analyze(brief.tone, knowledge.voice);",
    "→ understood: tone='premium', sector='tea'",
  ],
  design: [
    "// Designing layout & visual system",
    "const palette = pickPalette('warm-earth', 'noir-gold');",
    "const type = pair('Cormorant', 'Inter');",
    "const layout = compose([hero, story, products, cta]);",
    "→ system: 12-col · radii: 14 · motion: gentle",
  ],
  code: [
    "// Writing HTML, CSS & JS",
    "<section class=\"hero relative overflow-hidden\">",
    "  <h1 class=\"font-serif text-6xl tracking-tight\">",
    "    A quiet ritual, brewed with care.",
    "  </h1>",
    "</section>",
    "@keyframes fadeUp { from { opacity:0; transform: translateY(8px); } }",
  ],
  assets: [
    "// Sourcing imagery & icons",
    "const hero = await sourceImage('steaming chai, soft light');",
    "const icons = lucide(['leaf','flame','cup-soda']);",
    "→ optimized 6 images · webp · lazy-loaded",
  ],
  zip: [
    "// Packaging static bundle",
    "zip.file('index.html', html);",
    "zip.file('styles.css', css);",
    "zip.file('script.js', js);",
    "→ bundle ready · 142 KB",
  ],
  deploy: [
    "// Deploying to Netlify",
    "POST /api/v1/sites { name, files }",
    "uploading deploy archive…",
    "polling deploy state…",
    "→ state: ready",
  ],
};

function BuildConsole({ stepKey, siteName }: { stepKey: string; siteName?: string }) {
  const lines = STEP_CODE_LINES[stepKey] ?? STEP_CODE_LINES.code;
  const [typed, setTyped] = useState<string[]>([]);
  const [cursor, setCursor] = useState("");

  useEffect(() => {
    setTyped([]);
    setCursor("");
    let cancelled = false;
    let lineIdx = 0;
    let charIdx = 0;
    const tick = () => {
      if (cancelled) return;
      const current = lines[lineIdx] ?? "";
      if (charIdx <= current.length) {
        setCursor(current.slice(0, charIdx));
        charIdx += Math.max(1, Math.round(current.length / 30));
        setTimeout(tick, 28);
      } else {
        setTyped((t) => [...t, current]);
        setCursor("");
        charIdx = 0;
        lineIdx = (lineIdx + 1) % lines.length;
        setTimeout(tick, 280);
      }
    };
    const id = setTimeout(tick, 120);
    return () => { cancelled = true; clearTimeout(id); };
  }, [stepKey]);

  return (
    <div className="relative px-4 py-3 border-b">
      <div className="rounded-lg bg-[#0d1117] text-[#e6edf3] font-mono text-[11px] leading-relaxed p-3 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-2 opacity-70">
          <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
          <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
          <span className="w-2 h-2 rounded-full bg-[#28c840]" />
          <span className="ml-2 text-[10px] tracking-wider">
            reyes@mythmind ~ {siteName ?? "site"}
          </span>
        </div>
        <div className="max-h-32 overflow-hidden">
          {typed.slice(-4).map((l, i) => (
            <div key={`${stepKey}-${typed.length - 4 + i}`} className="whitespace-pre">
              <span className="text-[#7d8590]">{String(typed.length - 4 + i + 1).padStart(2, "0")} </span>
              <span>{l}</span>
            </div>
          ))}
          <div className="whitespace-pre">
            <span className="text-[#7d8590]">{String(typed.length + 1).padStart(2, "0")} </span>
            <span>{cursor}</span>
            <span className="inline-block w-1.5 h-3 bg-[#e6edf3] align-middle animate-pulse ml-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtifactCard({ a }: { a: any }) {
  const isImage = (a.mime ?? "").startsWith("image/") || a.isImage;
  const isPdf = (a.mime ?? "").includes("pdf") || a.isPdf;
  const [open, setOpen] = useState(false);
  const downloadHref = `${a.url}${a.url.includes("?") ? "&" : "?"}download=1&name=${encodeURIComponent(a.name)}`;
  const meta = [
    (a.mime ?? "").split("/").pop()?.toUpperCase(),
    a.pageCount ? `${a.pageCount} page${a.pageCount === 1 ? "" : "s"}` : null,
    bytesLabel(a.size),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <div className="flex items-center gap-3 border rounded-xl px-3 py-2.5 bg-background hover:bg-accent/40 transition-colors">
        {isImage ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-12 h-12 rounded-lg overflow-hidden border shrink-0"
          >
            <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {isPdf ? <FileText className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{a.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{meta}</div>
          {a.employeeName && (
            <div className="text-[10px] text-muted-foreground/80 mt-0.5">
              Generated by {a.employeeName}
            </div>
          )}
        </div>
        <a
          href={downloadHref}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
          aria-label="Download"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
      {open && isImage && (
        <Lightbox images={[a]} index={0} onClose={() => setOpen(false)} onIndex={() => {}} />
      )}
    </>
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

function ModelPicker({
  modelId,
  setModelId,
  userTier,
}: {
  modelId: WynsaModelId;
  setModelId: (id: WynsaModelId) => void;
  userTier: PlanTier;
}) {
  const [open, setOpen] = useState(false);
  const current = getWynsaModel(modelId);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] border rounded-lg px-2 py-1 bg-background hover:bg-accent"
        aria-label="Choose model"
      >
        <Sparkles className="w-3 h-3 text-violet" />
        <span className="font-medium">{current.name}</span>
        <span className="text-muted-foreground">· {current.effort}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-[260px] rounded-xl border bg-card shadow-xl p-1.5">
            {WYNSA_MODELS.map((m) => {
              const locked = !m.allowedTiers.includes(userTier);
              const active = m.id === modelId;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (locked) return;
                    setModelId(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2 transition-colors",
                    active && "bg-violet/10",
                    locked ? "opacity-60 cursor-not-allowed" : "hover:bg-accent",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-medium">{m.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {m.effort}
                      </span>
                      {locked && <Lock className="w-3 h-3 text-muted-foreground ml-auto" />}
                      {active && !locked && (
                        <Check className="w-3 h-3 text-violet ml-auto" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {locked ? "Upgrade to Pro to unlock" : m.blurb}
                    </div>
                  </div>
                </button>
              );
            })}
            <Link
              to="/billing"
              className="block text-center text-[11px] text-violet hover:underline mt-1 py-1.5 border-t"
              onClick={() => setOpen(false)}
            >
              View plans →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
