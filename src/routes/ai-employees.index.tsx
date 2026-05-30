import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";
import { agents } from "@/data/agents";

export const Route = createFileRoute("/ai-employees/")({
  head: () => ({
    meta: [
      { title: "AI Employees — Mythmind" },
      { name: "description", content: "Meet the AI employees who run your work — Nova, Orion, Iris, Atlas and Echo." },
      { property: "og:title", content: "AI Employees — Mythmind" },
      { property: "og:description", content: "Specialists for marketing, research, design, sales and operations." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="THE TEAM"
        title={<>Meet your <span className="italic text-violet">AI employees.</span></>}
        subtitle="Five specialists, one workforce. Each one is purpose-built for a role, fluent in your context, and ready to ship real work."
      />

      <section className="max-w-[1240px] mx-auto px-8 pb-20 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((a) => (
          <Link
            key={a.id}
            to="/ai-employees/$agentId"
            params={{ agentId: a.id }}
            className="group rounded-3xl p-8 border border-border/50 hover:shadow-xl hover:-translate-y-1 transition-all bg-card"
          >
            <div
              className="w-full aspect-square rounded-2xl overflow-hidden mb-6 relative"
              style={{ background: `linear-gradient(135deg, ${a.accentSoft}, white)` }}
            >
              <img src={a.image} alt={a.name} loading="lazy" width={512} height={512} className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/80 backdrop-blur text-[10px] tracking-[0.18em] font-semibold" style={{ color: a.accent }}>
                {a.role.replace(" Agent","").toUpperCase()}
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h2 className="font-serif text-3xl">{a.name}</h2>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="text-xs text-muted-foreground italic mb-4">{a.tagline}</div>
            <p className="text-sm text-foreground/80 leading-relaxed">{a.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-5">
              {a.skills.slice(0,3).map(s => (
                <span key={s} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: a.accentSoft, color: a.accent }}>{s}</span>
              ))}
            </div>
          </Link>
        ))}
      </section>

      <SiteFooter />
    </div>
  );
}
