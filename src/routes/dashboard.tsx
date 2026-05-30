import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { agents } from "@/data/agents";
import { Activity, CheckCircle2, Clock, LogOut, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Mythmind" }] }),
  component: Dashboard,
});

type Profile = { display_name: string | null; email: string | null; avatar_url: string | null };

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
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "there";

  const stats = [
    { label: "Tasks completed", value: "248", icon: CheckCircle2, trend: "+12%" },
    { label: "Active agents", value: "5", icon: Sparkles, trend: "All online" },
    { label: "Hours saved", value: "94h", icon: Clock, trend: "this week" },
    { label: "Output quality", value: "98%", icon: TrendingUp, trend: "+3%" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-[1240px] mx-auto px-8 py-5 flex items-center justify-between">
          <Link to="/" className="font-serif text-xl tracking-tight">
            mythmind<span style={{ color: "var(--violet, #7c5cff)" }}>.</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-semibold">
              {name[0]?.toUpperCase()}
            </div>
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1240px] mx-auto px-8 py-10">
        <div className="text-[11px] tracking-[0.22em] font-semibold mb-3" style={{ color: "var(--violet, #7c5cff)" }}>
          YOUR WORKSPACE
        </div>
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight">Hi {name} 👋</h1>
        <p className="mt-3 text-muted-foreground">Your AI team is on the clock. Here's what's happening today.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
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

        <section className="mt-12">
          <div className="flex items-end justify-between mb-5">
            <h2 className="font-serif text-2xl">Your AI employees</h2>
            <Link to="/ai-employees" className="text-sm text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a) => (
              <Link
                key={a.id}
                to="/ai-employees/$agentId"
                params={{ agentId: a.id }}
                className="group rounded-xl border bg-card p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <img src={a.image} alt={a.name} className="w-14 h-14 rounded-full object-cover ring-2" style={{ boxShadow: `0 0 0 2px ${a.accent}` }} />
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
                  <span className="text-muted-foreground"><Activity className="inline w-3 h-3 mr-1" />Active now</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
