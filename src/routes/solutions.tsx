import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";
import { Megaphone, Search, Palette, TrendingUp, Cog, Sparkles } from "lucide-react";

export const Route = createFileRoute("/solutions")({
  head: () => ({
    meta: [
      { title: "Solutions — Mythmind" },
      { name: "description", content: "Solutions for startups, agencies, and growing teams. Replace busywork with an AI workforce." },
      { property: "og:title", content: "Solutions — Mythmind" },
      { property: "og:description", content: "From go-to-market to ops — AI employees that ship real work." },
    ],
  }),
  component: Page,
});

const solutions = [
  { icon: Megaphone, title: "Go-to-market", desc: "Plan launches, write copy, schedule campaigns, monitor reception." },
  { icon: Search, title: "Research & intelligence", desc: "Map markets, track competitors, distill interviews into action." },
  { icon: Palette, title: "Brand & design", desc: "Concept, design and ship visual systems consistent with your brand." },
  { icon: TrendingUp, title: "Revenue ops", desc: "Score leads, draft follow-ups, automate the boring half of sales." },
  { icon: Cog, title: "Workflow automation", desc: "Connect your stack and let agents handle the in-between." },
  { icon: Sparkles, title: "Creative production", desc: "From idea to asset — campaigns, posts and decks at studio quality." },
];

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="SOLUTIONS"
        title={<>Built for the work you <span className="italic text-violet">actually ship.</span></>}
        subtitle="Mythmind drops into the workflows you already run. Pick a use case, plug in your agents, see real output."
      />
      <section className="max-w-[1240px] mx-auto px-8 pb-24 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {solutions.map(s => (
          <div key={s.title} className="rounded-3xl border border-border/40 p-8 bg-card hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mb-6">
              <s.icon className="w-5 h-5 text-violet" />
            </div>
            <h3 className="font-serif text-2xl mb-3">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}
