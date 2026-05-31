import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowUpRight, ArrowRight, Play, ChevronLeft, ChevronRight, Home, LayoutGrid, MessageSquare, TrendingUp, Settings } from "lucide-react";
import { JellyBlob } from "@/components/JellyBlob";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { agents } from "@/data/agents";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mythmind — AI Workforce OS" },
      { name: "description", content: "Mythmind brings together a team of AI employees that think, plan, and execute — so you can focus on what really matters." },
      { property: "og:title", content: "Mythmind — AI Workforce OS" },
      { property: "og:description", content: "A team of AI employees that specialize, collaborate, and deliver real work." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  component: Index,
});

const tasks = [
  { title: "Summer campaign strategy", agent: "Nova — Marketing", status: "In progress", color: "oklch(0.7 0.2 285)" },
  { title: "Competitor research", agent: "Orion — Research", status: "In progress", color: "oklch(0.6 0.18 250)" },
  { title: "Landing page concept", agent: "Iris — Design", status: "Review", color: "oklch(0.7 0.2 350)" },
  { title: "Lead scoring automation", agent: "Atlas — Sales", status: "Completed", color: "oklch(0.65 0.18 150)" },
];

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading]);
  if (loading || user) return null;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      <section className="max-w-[1240px] mx-auto px-8 pt-20 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-violet text-[11px] tracking-[0.22em] font-semibold mb-8">AI WORKFORCE OS</div>
          <h1 className="font-serif text-[68px] leading-[1.05] tracking-tight">
            Your business.<br />
            Amplified by<br />
            <span className="text-violet italic">AI employees.</span>
          </h1>
          <p className="mt-8 text-muted-foreground max-w-md leading-relaxed">
            Mythmind brings together a team of AI employees that think, plan, and execute — so you can focus on what really matters.
          </p>
          <div className="mt-12 flex items-center gap-10 flex-wrap">
            <Link to="/ai-employees" className="flex items-center gap-4 group">
              <span className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-105" style={{ background: "var(--ink)" }}>
                <ArrowUpRight className="w-5 h-5" />
              </span>
              <span>
                <div className="text-[11px] tracking-[0.18em] font-semibold">LAUNCH WORKSPACE</div>
                <div className="text-xs text-muted-foreground mt-0.5">Start building with your AI team</div>
              </span>
            </Link>
            <a href="#" className="flex items-center gap-3 group">
              <span>
                <div className="text-[11px] tracking-[0.18em] font-semibold">WATCH FILM</div>
                <div className="text-xs text-muted-foreground mt-0.5">See how it works</div>
              </span>
              <span className="w-10 h-10 rounded-full border border-border flex items-center justify-center">
                <Play className="w-3.5 h-3.5 fill-foreground" />
              </span>
            </a>
          </div>
        </div>
        <div className="relative">
          <JellyBlob />
        </div>
      </section>

      {/* Agents */}
      <section id="agents" className="bg-surface py-24">
        <div className="max-w-[1240px] mx-auto px-8">
          <div className="flex items-start justify-between mb-16 flex-wrap gap-6">
            <div>
              <div className="text-violet text-[11px] tracking-[0.22em] font-semibold mb-6">BUILT DIFFERENT</div>
              <h2 className="font-serif text-5xl leading-[1.1] max-w-md">
                AI employees that specialize, collaborate, and deliver.
              </h2>
            </div>
            <div className="flex gap-2 bg-background rounded-full p-1.5 shadow-sm">
              <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
              <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {agents.map((a) => (
              <Link
                key={a.id}
                to="/ai-employees/$agentId"
                params={{ agentId: a.id }}
                className="bg-background rounded-2xl p-6 border border-border/40 hover:shadow-xl transition-all hover:-translate-y-1 group"
              >
                <div className="relative mx-auto mb-5 w-24 h-24 rounded-full overflow-hidden ring-4 ring-white shadow-md animate-float"
                     style={{ background: a.accentSoft }}>
                  <img src={a.image} alt={a.name} loading="lazy" width={512} height={512} className="w-full h-full object-cover" />
                </div>
                <div className="text-center text-[10px] tracking-[0.18em] font-semibold mb-1" style={{ color: a.accent }}>{a.name.split(" ")[0].toUpperCase()}</div>
                <h3 className="font-semibold text-base text-center mb-3">{a.role}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed text-center mb-6">{a.tagline}</p>
                <div className="flex justify-center">
                  <ArrowRight className="w-4 h-4 text-foreground/70 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>

          {/* Dashboard preview */}
          <div className="mt-8 grid md:grid-cols-[80px_1fr_1.3fr] gap-4">
            <div className="bg-background rounded-2xl border border-border/40 p-4 flex flex-col items-center gap-6 py-6">
              <div className="font-serif text-2xl">m<span className="text-violet">.</span></div>
              <div className="flex flex-col gap-4 mt-4">
                {[Home, LayoutGrid, MessageSquare, TrendingUp].map((Icon, i) => (
                  <button key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center ${i===0 ? "bg-surface shadow-sm" : "text-muted-foreground hover:bg-surface"}`}>
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
              <button className="mt-auto w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground"><Settings className="w-4 h-4" /></button>
            </div>

            <div className="bg-background rounded-2xl border border-border/40 p-6">
              <div className="mb-1 font-semibold">Good morning, Arjun ☀️</div>
              <div className="text-xs text-muted-foreground mb-5">Here's what your team is working on.</div>
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.title} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in oklab, ${t.color} 18%, white)` }}>
                        <div className="w-4 h-4 rounded" style={{ background: t.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t.title}</div>
                        <div className="text-[11px] text-muted-foreground">{t.agent}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-medium" style={
                      t.status === "Completed" ? { background: "oklch(0.93 0.08 150)", color: "oklch(0.4 0.15 150)" } :
                      t.status === "Review" ? { background: "oklch(0.93 0.08 60)", color: "oklch(0.5 0.18 50)" } :
                      { background: "oklch(0.93 0.05 285)", color: "oklch(0.45 0.2 285)" }
                    }>{t.status}</span>
                  </div>
                ))}
              </div>
              <Link to="/ai-employees" className="mt-5 w-full flex items-center justify-between pt-4 border-t border-border/40 text-[11px] tracking-[0.18em] font-semibold">
                VIEW ALL TASKS <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-background rounded-2xl border border-border/40 p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold">Performance overview</div>
                <button className="text-xs text-muted-foreground flex items-center gap-1">This week ▾</button>
              </div>
              <div className="text-4xl font-serif">$24,600</div>
              <div className="text-xs text-muted-foreground mt-1">Revenue impact</div>
              <div className="text-xs mt-2"><span className="text-green-600 font-medium">↑ 18.6%</span> <span className="text-muted-foreground">vs last week</span></div>

              <svg viewBox="0 0 400 140" className="w-full mt-6">
                <defs>
                  <linearGradient id="chart-grad" x1="0" x2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.24 285)" />
                    <stop offset="100%" stopColor="oklch(0.7 0.2 350)" />
                  </linearGradient>
                  <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.2 320 / 0.3)" />
                    <stop offset="100%" stopColor="oklch(0.7 0.2 320 / 0)" />
                  </linearGradient>
                </defs>
                <path d="M0,110 C50,100 80,80 130,85 C180,90 220,60 270,45 C320,30 360,25 400,20 L400,140 L0,140 Z" fill="url(#chart-fill)" />
                <path d="M0,110 C50,100 80,80 130,85 C180,90 220,60 270,45 C320,30 360,25 400,20" stroke="url(#chart-grad)" strokeWidth="2.5" fill="none" />
                <circle cx="320" cy="30" r="6" fill="oklch(0.7 0.2 350)" />
                <circle cx="320" cy="30" r="10" fill="oklch(0.7 0.2 350 / 0.3)" />
              </svg>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <span key={d}>{d}</span>)}
              </div>

              <div className="absolute right-6 top-24 bg-background border border-border/40 rounded-xl p-3 shadow-sm">
                <div className="text-[10px] text-muted-foreground">Team efficiency</div>
                <div className="font-serif text-3xl">87%</div>
                <div className="text-[10px]"><span className="text-green-600">↑ 11%</span> <span className="text-muted-foreground">vs last week</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1240px] mx-auto px-8 py-16">
        <div className="rounded-3xl p-12 relative overflow-hidden" style={{ background: "oklch(0.13 0.02 270)" }}>
          <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-60"
               style={{ background: "radial-gradient(ellipse at right, oklch(0.5 0.25 320 / 0.4), transparent 70%)" }} />
          <div className="relative flex items-center justify-between flex-wrap gap-8">
            <div>
              <h3 className="font-serif text-4xl text-white leading-tight">
                Not just AI.<br />An AI workforce.
              </h3>
              <Link to="/ai-employees" className="mt-8 inline-flex w-12 h-12 rounded-full bg-white/10 backdrop-blur items-center justify-center text-white">
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {agents.slice(0,4).map((a) => (
                  <div key={a.id} className="w-10 h-10 rounded-full border-2 overflow-hidden" style={{ borderColor: "oklch(0.13 0.02 270)" }}>
                    <img src={a.image} alt={a.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="text-white/80 text-sm leading-relaxed max-w-[220px]">
                Trusted by forward-thinking teams building what's next.
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
