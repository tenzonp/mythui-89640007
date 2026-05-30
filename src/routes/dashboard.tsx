import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { agents } from "@/data/agents";
import {
  Activity,
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
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Mythmind" }] }),
  component: Dashboard,
});

type Profile = { display_name: string | null; email: string | null; avatar_url: string | null };

const sidebarLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ai-employees", label: "AI Employees", icon: Users },
  { to: "/solutions", label: "Solutions", icon: Briefcase },
  { to: "/pricing", label: "Billing", icon: Zap },
];

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

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

  const stats = [
    { label: "Tasks completed", value: "248", icon: CheckCircle2, trend: "+12%" },
    { label: "Active agents", value: "5", icon: Sparkles, trend: "All online" },
    { label: "Hours saved", value: "94h", icon: Clock, trend: "this week" },
    { label: "Output quality", value: "98%", icon: TrendingUp, trend: "+3%" },
  ];

  const recentTasks = [
    { title: "Q3 marketing plan drafted by Nova", agent: "Nova", time: "2m ago", status: "done" },
    { title: "Customer churn analysis by Orion", agent: "Orion", time: "15m ago", status: "done" },
    { title: "Blog post SEO optimized by Iris", agent: "Iris", time: "32m ago", status: "done" },
    { title: "Sales pipeline review by Atlas", agent: "Atlas", time: "1h ago", status: "in-progress" },
    { title: "User feedback summary by Echo", agent: "Echo", time: "2h ago", status: "done" },
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
                      className="group rounded-xl border bg-card p-5 hover:shadow-lg transition-shadow"
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
                      <p className="mt-4 text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                      <div className="mt-4 flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Online
                        </span>
                        <span className="text-muted-foreground">
                          <Activity className="inline w-3 h-3 mr-1" />
                          Active now
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h2 className="font-serif text-2xl mb-5">Recent work</h2>
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  {recentTasks.map((task) => (
                    <div key={task.title} className="flex items-start gap-3">
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
