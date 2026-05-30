import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";
import { BookOpen, FileText, Video, Newspaper } from "lucide-react";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources — Mythmind" },
      { name: "description", content: "Guides, playbooks, films and articles on building an AI workforce." },
      { property: "og:title", content: "Resources — Mythmind" },
      { property: "og:description", content: "Learn to work alongside AI employees." },
    ],
  }),
  component: Page,
});

const items = [
  { icon: BookOpen, kind: "GUIDE", title: "The AI Workforce playbook", desc: "How modern teams structure work around AI specialists." },
  { icon: Video, kind: "FILM", title: "A day with Mythmind", desc: "5-minute behind-the-scenes look at agents in action." },
  { icon: FileText, kind: "CASE STUDY", title: "How Lumen shipped 4x faster", desc: "A two-person team running like a ten-person studio." },
  { icon: Newspaper, kind: "ARTICLE", title: "Beyond chat: AI that does the job", desc: "Why answers aren't enough — and what comes next." },
  { icon: BookOpen, kind: "GUIDE", title: "Hiring your first AI employee", desc: "A practical onboarding framework for Nova, Orion and friends." },
  { icon: FileText, kind: "TEMPLATES", title: "20 workflows to steal", desc: "Plug-and-play automations across marketing, sales and ops." },
];

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="RESOURCES"
        title={<>Learn the craft of an <span className="italic text-violet">AI workforce.</span></>}
        subtitle="Guides, case studies and films to help you get the most out of your agents."
      />
      <section className="max-w-[1240px] mx-auto px-8 pb-24 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(i => (
          <a key={i.title} href="#" className="group rounded-3xl border border-border/40 p-8 bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center">
                <i.icon className="w-4 h-4 text-violet" />
              </div>
              <span className="text-[10px] tracking-[0.22em] font-semibold text-violet">{i.kind}</span>
            </div>
            <h3 className="font-serif text-2xl mb-3 group-hover:text-violet transition-colors">{i.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{i.desc}</p>
          </a>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}
