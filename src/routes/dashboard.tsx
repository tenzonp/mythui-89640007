import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { agents } from "@/data/agents";
import { getMyPlan } from "@/lib/credits.functions";
import {
  CheckCircle2,
  Clock,
  LogOut,
  Sparkles,
  TrendingUp,
  LayoutDashboard,
  Users,
  Briefcase,
  Settings,
  Zap,
  ChevronRight,
  MessageSquare,
  Plug,
  UserCircle,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Mythmind" }] }),
  component: Dashboard,
});

type Profile = { display_name: string | null; email: string | null; avatar_url: string | null };

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const sidebarLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/ai-employees", label: "AI Employees", icon: Users },
  { to: "/solutions", label: "Solutions", icon: Briefcase },
  { to: "/billing", label: "Plan & Billing", icon: Zap },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [tasksCompleted, setTasksCompleted] = useState<number>(0);
  const [recentTasks, setRecentTasks] = useState<
    { id: string; title: string; agent: string; time: string; status: string }[]
  >([]);
  const fetchPlan = useServerFn(getMyPlan);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
    const load = () => {
      fetchPlan().then(setPlan).catch(() => {});
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("role", "assistant")
        .then(({ count }) => setTasksCompleted(count ?? 0));
      supabase
        .from("messages")
        .select("id, parts, created_at, thread_id, threads(title)")
        .eq("user_id", user.id)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(6)
        .then(({ data }) => {
          if (!data) return;
          const items = data.map((m: any) => {
            const parts = Array.isArray(m.parts) ? m.parts : [];
            const toolPart = parts.find((p: any) => typeof p?.type === "string" && p.type.startsWith("tool-"));
            const textPart = [...parts].reverse().find((p: any) => p?.type === "text" && p.text);
            const toolName = toolPart?.type?.replace("tool-", "").replace(/_/g, " ");
            const title = textPart?.text
              ? String(textPart.text).slice(0, 90)
              : toolName
                ? `Ran ${toolName}`
                : m.threads?.title || "AI task";
            const running = toolPart && toolPart.state !== "output-available" && toolPart.state !== "done";
            return {
              id: m.id,
              title,
              agent: toolName ? `Tool · ${toolName}` : "Assistant",
              time: timeAgo(new Date(m.created_at)),
              status: running ? "in-progress" : "done",
            };
          });
          setRecentTasks(items);
        });
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "there";
  const initial = name[0]?.toUpperCase() ?? "U";

  const creditsMax = plan
    ? plan.tier === "free"
      ? plan.dailyFreeCredits
      : plan.monthlyCredits
    : 0;

  // Saved hours = tasks * (avg human minutes per task - avg AI minutes per task) / 60
  // Assume 30 min human vs ~1 min AI = 29 min saved per task.
  const HUMAN_MIN = 30;
  const AI_MIN = 1;
  const hoursSaved = ((tasksCompleted * (HUMAN_MIN - AI_MIN)) / 60).toFixed(1);

  const stats = [
    {
      label: plan?.tier === "free" ? "Credits today" : "Credits this month",
      value: plan ? plan.balance.toLocaleString() : "—",
      icon: Sparkles,
      trend: plan ? `of ${creditsMax.toLocaleString()}` : "loading",
    },
    { label: "Tasks completed", value: tasksCompleted.toLocaleString(), icon: CheckCircle2, trend: "all time" },
    { label: "Active agents", value: String(agents.length), icon: Users, trend: "All online" },
    { label: "Hours saved", value: `${hoursSaved}h`, icon: Clock, trend: `${HUMAN_MIN - AI_MIN}m per task` },
  ];


  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-[240px] border-r bg-card hidden lg:flex flex-col">
        <div className="p-6">
          <Link to="/" className="font-serif text-xl tracking-tight">
            mythmind<span style={{ color: "var(--violet, #7c5cff)" }}>.</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {sidebarLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeProps={{ className: "bg-accent text-foreground" }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="font-serif text-lg tracking-tight">
            mythmind<span style={{ color: "var(--violet, #7c5cff)" }}>.</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
              {initial}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="hidden lg:flex items-center justify-between px-8 py-5 border-b">
          <div>
            <h1 className="font-serif text-lg">Hi {name}</h1>
            <p className="text-xs text-muted-foreground">Your AI team is on the clock.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-semibold">
              {initial}
            </div>
          </div>
        </div>

        <div className="pt-16 lg:pt-0">
          <div className="max-w-[1100px] mx-auto px-6 lg:px-8 py-8">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <s.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.trend}</span>
                  </div>
                  <div className="mt-4 text-3xl font-serif">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
              {/* Agents */}
              <div className="xl:col-span-2">
                <div className="flex items-end justify-between mb-5">
                  <div>
                    <h2 className="font-serif text-2xl">Your AI employees</h2>
                    <p className="text-xs text-muted-foreground mt-1">Tap any agent to assign work</p>
                  </div>
                  <Link to="/ai-employees" className="text-sm text-muted-foreground hover:text-foreground">
                    View all →
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agents.map((a) => (
                    <Link
                      key={a.id}
                      to="/ai-employees/$agentId"
                      params={{ agentId: a.id }}
                      className="group rounded-xl border bg-card p-5 hover:shadow-lg transition-shadow flex flex-col"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={a.image}
                          alt={a.name}
                          className="w-14 h-14 rounded-full object-cover ring-2"
                          style={{ boxShadow: `0 0 0 2px ${a.accent}` }}
                        />
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.role}</div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                          Responsibilities
                        </div>
                        <ul className="space-y-1">
                          {a.responsibilities.slice(0, 3).map((r) => (
                            <li key={r} className="text-xs text-muted-foreground flex gap-1.5">
                              <span style={{ color: a.accent }}>•</span>
                              <span className="line-clamp-1">{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                          KPIs
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {a.kpis.map((k) => (
                            <span
                              key={k.label}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border"
                              style={{ borderColor: a.accent, color: a.accent }}
                              title={k.label}
                            >
                              <span className="opacity-70">{k.label}:</span>
                              <span className="font-medium">{k.target}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Online
                        </span>
                        {a.canDelegate && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary">
                            Can delegate
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h2 className="font-serif text-2xl mb-5">Recent work</h2>
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  {recentTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">No work yet — start a chat to put your AI team to work.</p>
                  )}
                  {recentTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                          task.status === "done" ? "bg-green-500" : "bg-amber-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{task.agent}</span>
                          <span>·</span>
                          <span>{task.time}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
