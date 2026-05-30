import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Mythmind" },
      { name: "description", content: "Simple pricing for AI employees. Start with one agent, scale to a full workforce." },
      { property: "og:title", content: "Pricing — Mythmind" },
      { property: "og:description", content: "Plans for solo founders, growing teams and enterprises." },
    ],
  }),
  component: Page,
});

const plans = [
  { name: "Solo", price: "$29", period: "/mo", desc: "One AI employee, all the essentials.", features: ["1 AI employee", "Unlimited tasks", "Integrations: 3", "Email support"], highlight: false },
  { name: "Team", price: "$99", period: "/mo", desc: "Your full AI workforce, ready to ship.", features: ["All 5 AI employees", "Unlimited tasks", "Unlimited integrations", "Priority support", "Workflows & automations"], highlight: true },
  { name: "Enterprise", price: "Custom", period: "", desc: "Tailored deployment, security and SLAs.", features: ["Everything in Team", "Custom AI employees", "SSO + SOC2", "Dedicated success manager"], highlight: false },
];

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="PRICING"
        title={<>Hire one. Or the <span className="italic text-violet">whole team.</span></>}
        subtitle="Transparent pricing. Cancel any time. Your agents stay on board as long as the work keeps coming."
      />
      <section className="max-w-[1180px] mx-auto px-8 pb-24 grid md:grid-cols-3 gap-6">
        {plans.map(p => (
          <div key={p.name} className={`rounded-3xl p-8 border ${p.highlight ? "border-violet shadow-xl scale-[1.02]" : "border-border/40"} bg-card`}>
            {p.highlight && <div className="text-[10px] tracking-[0.22em] font-semibold text-violet mb-3">MOST POPULAR</div>}
            <h3 className="font-serif text-3xl mb-2">{p.name}</h3>
            <p className="text-sm text-muted-foreground mb-6">{p.desc}</p>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="font-serif text-5xl">{p.price}</span>
              <span className="text-muted-foreground text-sm">{p.period}</span>
            </div>
            <button className={`w-full py-3 rounded-full text-sm font-medium mb-8 ${p.highlight ? "text-white" : "border border-border"}`}
                    style={p.highlight ? { background: "var(--violet)" } : {}}>
              {p.name === "Enterprise" ? "Talk to us" : "Get started"}
            </button>
            <div className="space-y-3">
              {p.features.map(f => (
                <div key={f} className="flex items-center gap-3 text-sm">
                  <Check className="w-4 h-4 text-violet" /> {f}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}
