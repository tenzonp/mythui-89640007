import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { agents, getAgent } from "@/data/agents";

export const Route = createFileRoute("/ai-employees/$agentId")({
  loader: ({ params }) => {
    const agent = getAgent(params.agentId);
    if (!agent) throw notFound();
    return { agent };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.agent.name} — ${loaderData.agent.role} | Mythmind` },
      { name: "description", content: loaderData.agent.description },
      { property: "og:title", content: `${loaderData.agent.name} — Mythmind` },
      { property: "og:description", content: loaderData.agent.description },
    ] : [],
  }),
  component: AgentPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">Agent not found</div>
  ),
  errorComponent: ({ error }) => <div className="p-10">Error: {error.message}</div>,
});

function AgentPage() {
  const { agent } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="max-w-[1240px] mx-auto px-8 pt-12 pb-20">
        <Link to="/ai-employees" className="inline-flex items-center gap-2 text-xs tracking-[0.18em] font-semibold mb-10 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> ALL EMPLOYEES
        </Link>

        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="relative aspect-square rounded-3xl overflow-hidden"
               style={{ background: `linear-gradient(135deg, ${agent.accentSoft}, white)` }}>
            <img src={agent.image} alt={agent.name} width={512} height={512} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-[11px] tracking-[0.22em] font-semibold mb-4" style={{ color: agent.accent }}>
              {agent.role.toUpperCase()}
            </div>
            <h1 className="font-serif text-6xl leading-[1.05]">{agent.name}</h1>
            <p className="mt-3 italic text-muted-foreground">{agent.tagline}</p>
            <p className="mt-8 text-lg text-foreground/80 leading-relaxed">{agent.description}</p>

            <div className="mt-10">
              <div className="text-[11px] tracking-[0.18em] font-semibold mb-4">CORE SKILLS</div>
              <div className="space-y-2">
                {agent.skills.map((s: string) => (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: agent.accentSoft }}>
                      <Check className="w-3 h-3" style={{ color: agent.accent }} />
                    </span>
                    <span className="text-sm">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="mt-10 inline-flex items-center gap-3 px-6 py-3 rounded-full text-white text-sm" style={{ background: agent.accent }}>
              Hire {agent.name.split(" ")[0]}
            </button>
          </div>
        </div>

        <div className="mt-24">
          <div className="text-[11px] tracking-[0.18em] font-semibold mb-6 text-muted-foreground">MORE EMPLOYEES</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {agents.filter(a => a.id !== agent.id).map(a => (
              <Link key={a.id} to="/ai-employees/$agentId" params={{ agentId: a.id }} className="group flex items-center gap-3 p-4 rounded-2xl border border-border/40 hover:bg-surface transition-colors">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0" style={{ background: a.accentSoft }}>
                  <img src={a.image} alt={a.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{a.name.split(" ")[0]}</div>
                  <div className="text-[11px] text-muted-foreground">{a.role}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
