import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { deleteSite, getSite, redeploySite } from "@/lib/sites.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/sites/$siteId")({
  head: () => ({ meta: [{ title: "Site — Mythmind" }] }),
  component: SiteDetailPage,
});

function SiteDetailPage() {
  const { siteId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getSite);
  const redeployFn = useServerFn(redeploySite);
  const deleteFn = useServerFn(deleteSite);
  const { data, isLoading } = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getFn({ data: { id: siteId } }),
  });

  const redeploy = useMutation({
    mutationFn: () => redeployFn({ data: { id: siteId } }),
    onSuccess: () => {
      toast.success("Redeployed");
      qc.invalidateQueries({ queryKey: ["site", siteId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id: siteId } }),
    onSuccess: () => {
      toast.success("Deleted");
      nav({ to: "/sites" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-8 py-12">Loading…</div>
      </div>
    );
  }
  const site = data?.site;
  if (!site) return <div className="p-8">Not found</div>;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-4xl mx-auto px-8 py-12 grid gap-6">
        <Button variant="ghost" className="w-fit" onClick={() => nav({ to: "/sites" })}>← All sites</Button>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{site.status}</div>
          <h1 className="font-serif text-3xl mt-1">{site.name}</h1>
          {site.deployment_url && (
            <a
              href={site.deployment_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-violet hover:underline text-sm"
            >
              {site.deployment_url} <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {site.last_error && (
            <div className="mt-3 text-sm text-red-500 whitespace-pre-wrap">{site.last_error}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => redeploy.mutate()} disabled={redeploy.isPending}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {redeploy.isPending ? "Redeploying…" : "Redeploy (200 credits)"}
          </Button>
          <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="w-4 h-4 mr-1" />Delete
          </Button>
        </div>

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Prompt</div>
          <div className="text-sm whitespace-pre-wrap">{site.prompt}</div>
          {site.style_notes && (
            <>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-2">Style notes</div>
              <div className="text-sm whitespace-pre-wrap">{site.style_notes}</div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Files ({Array.isArray(site.files) ? (site.files as any[]).length : 0})
          </div>
          <ul className="text-xs font-mono grid gap-1 max-h-72 overflow-auto">
            {Array.isArray(site.files) &&
              (site.files as any[]).map((f: any) => (
                <li key={f.path} className="text-muted-foreground">{f.path}</li>
              ))}
          </ul>
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
