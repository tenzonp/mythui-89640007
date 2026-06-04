import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  listThreads,
  createThread,
  deleteThread,
} from "@/lib/chat.functions";
import { getMyPlan, getMyLedger } from "@/lib/credits.functions";
import { WYNSA_MODELS } from "@/lib/plans";
import {
  Plus,
  Trash2,
  Settings as SettingsIcon,
  BookOpen,
  Users,
  Zap,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  FileText,
  Image as ImageIcon,
  FileCode2,
  File as FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agents, getAgent } from "@/data/agents";
import {
  ChatActivityProvider,
  useChatActivity,
  type ThreadFile,
} from "@/lib/chat-context";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat · Mythmind" }] }),
  component: ChatLayout,
});

type Thread = { id: string; title: string; updated_at?: string };

function formatWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate()
  )
    return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ChatLayout() {
  return (
    <ChatActivityProvider>
      <ChatLayoutInner />
    </ChatActivityProvider>
  );
}

function ChatLayoutInner() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [threads, setThreads] = useState<Thread[]>([]);
  const [userMenu, setUserMenu] = useState(false);
  const fetchThreads = useServerFn(listThreads);
  const fnCreate = useServerFn(createThread);
  const fnDelete = useServerFn(deleteThread);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const refresh = async () => {
    try {
      const r = await fetchThreads();
      setThreads(r.threads as any);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) refresh();
  }, [user, params.threadId]);

  const newChat = async () => {
    const { id } = await fnCreate({ data: {} });
    await refresh();
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
  };

  const removeThread = async (id: string) => {
    await fnDelete({ data: { id } });
    if (params.threadId === id) navigate({ to: "/chat" });
    refresh();
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  const name = user.email?.split("@")[0] ?? "User";
  const initial = name[0]?.toUpperCase() ?? "U";
  const ceo = getAgent("lin");

  return (
    <div className="h-screen flex bg-[#f7f7f5] overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="w-[240px] shrink-0 border-r bg-white hidden md:flex flex-col">
        <div className="px-4 pt-4 pb-2">
          <Link to="/" className="font-serif text-[20px] tracking-tight">
            mythmind<span className="text-violet">.</span>
          </Link>
        </div>
        <div className="px-3 pb-2">
          <button
            onClick={newChat}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-foreground/10 bg-white py-2 text-[13px] font-medium hover:bg-accent/60 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
          >
            <Plus className="w-4 h-4" /> New Conversation
          </button>
        </div>
        <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Conversations
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {threads.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No chats yet.</div>
          )}
          {threads.map((t) => {
            const active = params.threadId === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  "group flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] cursor-pointer",
                  active ? "bg-violet/10" : "hover:bg-accent/60",
                )}
              >
                <CheckSquare
                  className={cn(
                    "w-3.5 h-3.5 mt-0.5 shrink-0",
                    active ? "text-violet" : "text-muted-foreground",
                  )}
                />
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  className="flex-1 min-w-0"
                >
                  <div className="truncate font-medium leading-tight">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {formatWhen(t.updated_at)}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    removeThread(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive mt-0.5"
                  aria-label="Delete chat"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t px-2 py-1.5 space-y-0.5">
          <Link
            to="/resources"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-foreground/80 hover:bg-accent"
          >
            <BookOpen className="w-4 h-4" /> Knowledge Base
          </Link>
          <Link
            to="/billing"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-foreground/80 hover:bg-accent"
          >
            <Zap className="w-4 h-4" /> Plan & Billing
          </Link>
          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-foreground/80 hover:bg-accent"
          >
            <SettingsIcon className="w-4 h-4" /> Profile
          </Link>
        </div>
        <div className="border-t p-2 relative">
          <button
            onClick={() => setUserMenu((v) => !v)}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent"
          >
            {ceo?.image ? (
              <img src={ceo.image} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                {initial}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[13px] font-medium truncate capitalize">{name}</div>
              <div className="text-[10px] text-muted-foreground">CEO</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          {userMenu && (
            <div className="absolute bottom-14 left-2 right-2 rounded-xl border bg-card shadow-xl overflow-hidden">
              <div className="px-3 py-2 border-b text-xs text-muted-foreground truncate">
                {user.email}
              </div>
              <button
                onClick={async () => {
                  setUserMenu(false);
                  await signOut();
                  navigate({ to: "/auth" });
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 min-w-0 flex flex-col bg-white">
        <Outlet />
      </main>

      {/* RIGHT SIDEBAR */}
      {params.threadId && <RightSidebar />}
    </div>
  );
}

function RightSidebar() {
  const { activity } = useChatActivity();
  return (
    <aside className="w-[280px] shrink-0 border-l bg-[#fafaf8] hidden xl:flex flex-col overflow-y-auto">
      {/* AI Employees */}
      <section className="p-3">
        <div className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[13px] font-semibold">AI Employees</div>
            <Link to="/ai-employees" className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {agents.map((a) => {
              const isLin = a.id === "lin";
              const working = activity.working.has(a.id);
              const active = activity.active.has(a.id);
              const st = working
                ? "Working"
                : isLin
                  ? "Online"
                  : active
                    ? "Online"
                    : "Idle";
              const dot =
                st === "Online"
                  ? "bg-emerald-500"
                  : st === "Working"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-muted-foreground/40";
              return (
                <div key={a.id} className="flex items-center gap-2">
                  <img
                    src={a.image}
                    alt={a.name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium leading-tight truncate">
                      {a.name}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground truncate">
                      {a.role}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                    <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                    {st}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Credits */}
      <section className="px-3 pb-3">
        <CreditsCard />
      </section>

      {/* Usage breakdown */}
      <section className="px-3 pb-3">
        <UsageBreakdown />
      </section>


      {/* Recent Artifacts */}
      <section className="px-3 pb-3">
        <div className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold">Recent Artifacts</div>
            <span className="text-[10.5px] text-muted-foreground">
              {activity.files.length}
            </span>
          </div>
          {activity.files.length === 0 && (
            <div className="text-[11px] text-muted-foreground py-2">No files yet.</div>
          )}
          {activity.files.slice(0, 6).map((f, i) => (
            <ArtifactRow key={i} f={f} />
          ))}
        </div>
      </section>
    </aside>
  );
}

function ArtifactRow({ f }: { f: ThreadFile }) {
  const isImage = f.isImage || (f.mime ?? "").startsWith("image/");
  const isPdf = f.isPdf || (f.mime ?? "").includes("pdf");
  const isCode = /\.(json|js|ts|tsx|py|html|css)$/i.test(f.name);
  const { Icon, tint } = isImage
    ? { Icon: ImageIcon, tint: "bg-violet/10 text-violet" }
    : isCode
      ? { Icon: FileCode2, tint: "bg-amber-100 text-amber-700" }
      : isPdf
        ? { Icon: FileText, tint: "bg-rose-100 text-rose-700" }
        : { Icon: FileIcon, tint: "bg-muted text-muted-foreground" };
  const content = (
    <div className="flex items-center gap-2 py-1">
      <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", tint)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0 text-[12px] truncate">{f.name}</div>
      <div className="text-[10px] text-muted-foreground">{f.time ?? ""}</div>
    </div>
  );
  return f.url ? (
    <a href={f.url} target="_blank" rel="noreferrer" className="block hover:bg-accent/40 rounded-md px-1">
      {content}
    </a>
  ) : (
    <div className="px-1">{content}</div>
  );
}

function CreditsCard() {
  const fetchPlan = useServerFn(getMyPlan);
  const { activity } = useChatActivity();
  const [plan, setPlan] = useState<any>(null);
  const load = () => fetchPlan().then(setPlan).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  const workingCount = activity.working.size;
  const prevWorking = useRef(workingCount);
  useEffect(() => {
    if (prevWorking.current > 0 && workingCount === 0) load();
    prevWorking.current = workingCount;
  }, [workingCount]);
  if (!plan) return null;
  const max =
    plan.tier === "free" ? plan.dailyFreeCredits : plan.monthlyCredits;
  const pct = max > 0 ? Math.min(100, Math.round((plan.balance / max) * 100)) : 0;
  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] font-semibold flex items-center gap-1.5">
          Credits
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live" />
        </div>
        <span className="text-[10.5px] uppercase tracking-wider text-violet font-medium">
          {plan.planName}
        </span>
      </div>
      <div className="rounded-lg border p-2.5">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold tabular-nums">
            {plan.balance.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground">
            / {max.toLocaleString()} {plan.tier === "free" ? "today" : "this month"}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-violet rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <Link
          to="/billing"
          className="mt-2.5 block text-center text-[11px] py-1.5 rounded-md bg-violet text-white hover:bg-violet/90"
        >
          {plan.tier === "free" ? "Upgrade plan" : "Manage plan"}
        </Link>
      </div>
    </div>
  );
}

function modelLabel(id?: string | null) {
  if (!id) return "—";
  const m = WYNSA_MODELS.find((x) => x.backendModel === id || x.id === id);
  return m?.name ?? id;
}

function UsageBreakdown() {
  const fetchLedger = useServerFn(getMyLedger);
  const [entries, setEntries] = useState<any[]>([]);
  useEffect(() => {
    fetchLedger().then((r) => setEntries(r.entries)).catch(() => {});
    const t = setInterval(() => {
      fetchLedger().then((r) => setEntries(r.entries)).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, []);
  const spends = entries.filter((e) => e.kind === "spend").slice(0, 8);
  const todaySpend = entries
    .filter(
      (e) =>
        e.kind === "spend" &&
        new Date(e.created_at).toDateString() === new Date().toDateString(),
    )
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] font-semibold">Usage breakdown</div>
        <span className="text-[10.5px] text-muted-foreground">
          {todaySpend} today
        </span>
      </div>
      {spends.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-1.5">
          No turns spent yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {spends.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-[11.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{modelLabel(e.model)}</div>
                <div className="text-[10px] text-muted-foreground truncate capitalize">
                  {e.complexity ?? "turn"} ·{" "}
                  {new Date(e.created_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <span className="tabular-nums text-foreground">{e.amount}</span>
            </div>
          ))}
          <Link
            to="/profile"
            className="block text-center text-[11px] py-1 mt-1 text-violet hover:underline"
          >
            View all activity
          </Link>
        </div>
      )}
    </div>
  );
}
