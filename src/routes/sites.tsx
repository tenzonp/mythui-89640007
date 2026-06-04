import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, ExternalLink } from "lucide-react";
import { createAndDeploySite, listMySites } from "@/lib/sites.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/sites")({
  head: () => ({ meta: [{ title: "Websites — Mythmind" }] }),
  component: SitesPage,
});

function SitesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMySites);
  const createFn = useServerFn(createAndDeploySite);
  const { data } = useQuery({ queryKey: ["mySites"], queryFn: () => listFn() });

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [styleNotes, setStyleNotes] = useState("");

  const create = useMutation({
    mutationFn: () => createFn({ data: { name, prompt, styleNotes: styleNotes || undefined } }),
    onSuccess: (r) => {
      toast.success("Site deployed!");
      setName(""); setPrompt(""); setStyleNotes("");
      qc.invalidateQueries({ queryKey: ["mySites"] });
      window.open(r.url, "_blank");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to build site"),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="WEBSITE BUILDER"
        title={<>Generate any <em className="font-serif italic text-violet">website</em> in minutes</>}
        subtitle="Describe what you want. Mythmind generates a futuristic static site and deploys it live to Netlify — you get a real URL in seconds."
      />
      <div className="max-w-4xl mx-auto px-8 pb-20 grid gap-8">
        <Card className="p-6 grid gap-3">
          <h2 className="font-serif text-2xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet" /> Build a new site
          </h2>
          <Input
            placeholder="Project name (e.g. nova-studio)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            rows={5}
            placeholder="Describe the website. Who is it for? What sections? What should it do? Be specific — the more detail, the better."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Textarea
            rows={3}
            placeholder="Style notes (optional). E.g. 'dark mode, neon cyan accents, glassmorphism, Space Grotesk + Inter, awwwards energy'"
            value={styleNotes}
            onChange={(e) => setStyleNotes(e.target.value)}
          />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-muted-foreground">
              Costs 1000 credits per build. Includes generation + live Netlify deploy.
            </div>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || name.length < 2 || prompt.length < 10}
            >
              {create.isPending ? "Generating & deploying…" : "Generate & Deploy"}
            </Button>
          </div>
          {create.isPending && (
            <div className="text-xs text-muted-foreground">
              Static-site builds typically take 15–40 seconds. AI writes the pages, we ZIP them, and ship to Netlify.
            </div>
          )}
        </Card>

        <div>
          <h2 className="font-serif text-2xl mb-4">Your sites</h2>
          <div className="grid gap-3">
            {(data?.sites ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">No sites yet — build your first one above.</div>
            )}
            {(data?.sites ?? []).map((s: any) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.prompt}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1">
                      <span className="px-1.5 py-0.5 rounded border capitalize">{s.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.deployment_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={s.deployment_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3 h-3 mr-1" />Live
                        </a>
                      </Button>
                    )}
                    <Button size="sm" asChild>
                      <Link to="/sites/$siteId" params={{ siteId: s.id }}>Manage</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
