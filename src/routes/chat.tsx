import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  listThreads,
  createThread,
  deleteThread,
} from "@/lib/chat.functions";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agents, getAgent } from "@/data/agents";

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
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate()
  ) {
    return "Yesterday";
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ChatLayout() {
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

  const activeThread = useMemo(
    () => threads.find((t) => t.id === params.threadId) ?? null,
    [threads, params.threadId],
  );

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
      <aside className="w-[260px] shrink-0 border-r bg-white hidden md:flex flex-col">
        <div className="px-5 pt-5 pb-3">
          <Link to="/" className="font-serif text-[22px] tracking-tight">
            mythmind<span className="text-violet">.</span>
          </Link>
        </div>
        <div className="px-3 pb-3">
          <button
            onClick={newChat}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-white py-2.5 text-sm font-medium hover:bg-accent/60 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
          >
            <Plus className="w-4 h-4" /> New Conversation
          </button>
        </div>
        <div className="px-5 pt-2 pb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
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
                  "group flex items-start gap-2 rounded-lg px-2.5 py-2 text-sm cursor-pointer",
                  active ? "bg-violet/10" : "hover:bg-accent/60",
                )}
              >
                <CheckSquare
                  className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    active ? "text-violet" : "text-muted-foreground",
                  )}
                />
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  className="flex-1 min-w-0"
                >
                  <div className="truncate font-medium leading-tight">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
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
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t px-2 py-2 space-y-0.5">
          <Link
            to="/ai-employees"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/80 hover:bg-accent"
          >
            <Users className="w-4 h-4" /> AI Employees
          </Link>
          <Link
            to="/integrations"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/80 hover:bg-accent"
          >
            <Zap className="w-4 h-4" /> Automations
          </Link>
          <Link
            to="/resources"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/80 hover:bg-accent"
          >
            <BookOpen className="w-4 h-4" /> Knowledge Base
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/80 hover:bg-accent"
          >
            <SettingsIcon className="w-4 h-4" /> Settings
          </Link>
        </div>
        <div className="border-t p-3 relative">
          <button
            onClick={() => setUserMenu((v) => !v)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent"
          >
            {ceo?.image ? (
              <img src={ceo.image} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-sm font-semibold">
                {initial}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium truncate capitalize">{name}</div>
              <div className="text-[11px] text-muted-foreground">CEO</div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {userMenu && (
            <div className="absolute bottom-16 left-3 right-3 rounded-xl border bg-card shadow-xl overflow-hidden">
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
      {params.threadId && (
        <RightSidebar threadTitle={activeThread?.title ?? "Conversation"} />
      )}
    </div>
  );
}

function RightSidebar({ threadTitle }: { threadTitle: string }) {
  const statuses = ["Online", "Working", "Working", "Working", "Working", "Idle"] as const;
  return (
    <aside className="w-[300px] shrink-0 border-l bg-[#fafaf8] hidden xl:flex flex-col overflow-y-auto">
      {/* AI Employees */}
      <section className="p-4">
        <div className="bg-white rounded-2xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">AI Employees</div>
            <Link to="/ai-employees" className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {agents.map((a, i) => {
              const st = statuses[i % statuses.length];
              const dot =
                st === "Online"
                  ? "bg-emerald-500"
                  : st === "Working"
                    ? "bg-amber-500"
                    : "bg-muted-foreground/50";
              return (
                <div key={a.id} className="flex items-center gap-2.5">
                  <img
                    src={a.image}
                    alt={a.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight truncate">
                      {a.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {a.role}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                    {st}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Current Task */}
      <section className="px-4 pb-4">
        <div className="bg-white rounded-2xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Current Task</div>
            <button className="text-[11px] text-violet hover:underline">View all</button>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium leading-snug line-clamp-2">{threadTitle}</div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-[62%] bg-violet rounded-full" />
              </div>
              <span className="text-[11px] text-muted-foreground">62%</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">Running</div>
          </div>
        </div>
      </section>

      {/* Recent Artifacts */}
      <section className="px-4 pb-4">
        <div className="bg-white rounded-2xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Recent Artifacts</div>
            <button className="text-[11px] text-violet hover:underline">View all</button>
          </div>
          <ArtifactRow icon={<ImageIcon className="w-3.5 h-3.5" />} name="image.png" time="" tint="bg-violet/10 text-violet" />
          <ArtifactRow icon={<FileCode2 className="w-3.5 h-3.5" />} name="run_code_output.json" time="" tint="bg-amber-100 text-amber-700" />
          <ArtifactRow icon={<FileText className="w-3.5 h-3.5" />} name="email_draft.html" time="" tint="bg-rose-100 text-rose-700" />
        </div>
      </section>
    </aside>
  );
}

function ArtifactRow({
  icon,
  name,
  time,
  tint,
}: {
  icon: React.ReactNode;
  name: string;
  time: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", tint)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-sm truncate">{name}</div>
      <div className="text-[11px] text-muted-foreground">{time}</div>
    </div>
  );
}
