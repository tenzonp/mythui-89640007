import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";
import { Check, Sparkles } from "lucide-react";
import { PLANS, type PlanTier } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Mythmind" },
      {
        name: "description",
        content:
          "Free, Pro and Everest plans. Credits scale with task complexity, not message count.",
      },
      { property: "og:title", content: "Pricing — Mythmind" },
      {
        property: "og:description",
        content:
          "Start free with 100 daily credits. Upgrade to Pro or Everest for the full Wynsa model lineup.",
      },
    ],
  }),
  component: Page,
});

const order: PlanTier[] = ["free", "pro", "everest"];

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="PRICING"
        title={
          <>
            Pay for <span className="italic text-violet">outcomes</span>, not messages.
          </>
        }
        subtitle="Credits scale with task complexity. A quick rewrite costs a few credits — a multi-agent research workflow costs more. You'll always see what you spent."
      />
      <section className="max-w-[1180px] mx-auto px-8 pb-10 grid md:grid-cols-3 gap-6">
        {order.map((tier) => {
          const p = PLANS[tier];
          const highlight = tier === "pro";
          return (
            <div
              key={tier}
              className={cn(
                "rounded-3xl p-8 border bg-card flex flex-col",
                highlight ? "border-violet shadow-xl scale-[1.02]" : "border-border/40",
                tier === "everest" && "bg-gradient-to-b from-violet/5 to-card",
              )}
            >
              {highlight && (
                <div className="text-[10px] tracking-[0.22em] font-semibold text-violet mb-3">
                  MOST POPULAR
                </div>
              )}
              <h3 className="font-serif text-3xl mb-2">{p.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">{p.blurb}</p>
              <div className="mb-2">
                <span className="font-serif text-5xl">{p.priceLabel}</span>
                {tier === "pro" && (
                  <span className="ml-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Launch offer
                  </span>
                )}
                {tier === "everest" && (
                  <span className="ml-2 text-sm font-medium text-violet bg-violet/10 px-2 py-0.5 rounded-full">
                    Just one tap away
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mb-6 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-violet" />
                {tier === "free"
                  ? `${p.dailyFreeCredits} credits / day`
                  : `${p.monthlyCredits.toLocaleString()} credits / month`}
              </div>
              <Link
                to="/billing"
                className={cn(
                  "w-full py-3 rounded-full text-sm font-medium mb-8 text-center",
                  highlight
                    ? "bg-violet text-white hover:bg-violet/90"
                    : tier === "everest"
                      ? "bg-foreground text-background hover:opacity-90"
                      : "border border-border hover:bg-accent",
                )}
              >
                {tier === "free" ? "Start free" : `Get ${p.name}`}
              </Link>
              <div className="space-y-3">
                {p.perks.map((f) => (
                  <div key={f} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-violet shrink-0 mt-0.5" /> {f}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="max-w-[1180px] mx-auto px-8 pb-24">
        <div className="rounded-3xl border bg-card p-8">
          <h2 className="font-serif text-2xl mb-2">How credits work</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
            One message isn't one credit. Each turn is weighted by how much work
            actually happened — research, multi-agent collaboration, and deep
            reasoning cost more than quick rewrites.
          </p>
          <div className="grid md:grid-cols-5 gap-3">
            {[
              { name: "Quick", desc: "Rewrite, short idea", credits: "5–10" },
              { name: "Standard", desc: "Marketing copy, emails", credits: "20–40" },
              { name: "Deep", desc: "Strategy, analysis", credits: "60–120" },
              { name: "Heavy", desc: "Research, GTM plan", credits: "150–300" },
              { name: "Multi-agent", desc: "Team workflow", credits: "300–700" },
            ].map((b) => (
              <div key={b.name} className="rounded-xl border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {b.name}
                </div>
                <div className="font-serif text-xl mt-1">{b.credits}</div>
                <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
