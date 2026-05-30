import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Mythmind" },
      { name: "description", content: "Mythmind is building the operating system for an AI workforce — specialists that collaborate, decide and deliver." },
      { property: "og:title", content: "About — Mythmind" },
      { property: "og:description", content: "The story and mission behind Mythmind." },
    ],
  }),
  component: Page,
});

const values = [
  { k: "Specialists, not chatbots", v: "Each agent is shaped around a real role with real outputs — not a one-size assistant." },
  { k: "Work, not answers", v: "Mythmind closes the loop. Plans become campaigns, research becomes decisions, ideas become assets." },
  { k: "Quiet by design", v: "Your team gets superpowers without the noise. Less context-switching, more shipping." },
];

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="ABOUT"
        title={<>An <span className="italic text-violet">AI workforce</span> for the rest of us.</>}
        subtitle="We believe the next decade of work belongs to small teams with great taste — amplified by AI employees who actually do the job."
      />
      <section className="max-w-[1100px] mx-auto px-8 pb-20 grid md:grid-cols-3 gap-6">
        {values.map(v => (
          <div key={v.k} className="rounded-3xl bg-surface p-8">
            <h3 className="font-serif text-2xl mb-3">{v.k}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{v.v}</p>
          </div>
        ))}
      </section>
      <section className="max-w-[900px] mx-auto px-8 pb-24 text-center">
        <h2 className="font-serif text-4xl mb-6">Our story</h2>
        <p className="text-muted-foreground leading-relaxed">
          Mythmind started with a simple frustration: AI tools that talk a lot but ship little.
          We wanted a team — not a chat window. So we built one. Today Nova, Orion, Iris, Atlas
          and Echo work side-by-side with founders, marketers and operators all over the world.
        </p>
      </section>
      <SiteFooter />
    </div>
  );
}
