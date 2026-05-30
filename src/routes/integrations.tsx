import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  listComposioToolkits,
  listMyConnections,
  startComposioConnection,
  refreshComposioStatuses,
  disconnectComposio,
} from "@/lib/chat.functions";
import { Search, Plug, Check, Loader2, ExternalLink, ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [{ title: "Integrations · Mythmind" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    connected: typeof s.connected === "string" ? s.connected : undefined,
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/integrations" });
  const [query, setQuery] = useState("");
  const [toolkits, setToolkits] = useState<any[]>([]);
  const [loadingTk, setLoadingTk] = useState(true);
  const [conns, setConns] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const fnToolkits = useServerFn(listComposioToolkits);
  const fnConns = useServerFn(listMyConnections);
  const fnStart = useServerFn(startComposioConnection);
  const fnRefresh = useServerFn(refreshComposioStatuses);
  const fnDisconnect = useServerFn(disconnectComposio);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading]);

  const loadToolkits = async (q: string) => {
    setLoadingTk(true);
    try {
      const r = await fnToolkits({ data: { search: q || undefined } });
      setToolkits(r.items ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load toolkits");
    } finally {
      setLoadingTk(false);
    }
  };

  const loadConns = async () => {
    try {
      const r = await fnConns();
      setConns(r.connections);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    loadToolkits("");
    loadConns();
  }, [user]);

  // After returning from OAuth, refresh statuses
  useEffect(() => {
    if (!user || !search.connected) return;
    (async () => {
      await fnRefresh();
      await loadConns();
      toast.success(`Connected ${search.connected}`);
      navigate({ to: "/integrations", search: {} as any, replace: true });
    })();
  }, [user, search.connected]);

  const connect = async (slug: string) => {
    setBusy(slug);
    try {
      const r = await fnStart({
        data: { toolkitSlug: slug, origin: window.location.origin },
      });
      if (r.redirectUrl) {
        window.location.href = r.redirectUrl;
      } else {
        toast.success("Connected");
        loadConns();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start connection");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (id: string) => {
    setBusy(id);
    try {
      await fnDisconnect({ data: { id } });
      loadConns();
    } finally {
      setBusy(null);
    }
  };

  const connBySlug = new Map(conns.map((c) => [c.toolkit_slug, c]));

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-[1100px] mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/chat" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-serif text-2xl">Integrations</h1>
              <p className="text-xs text-muted-foreground">
                Powered by Composio · 1,000+ tools your AI team can use
              </p>
            </div>
          </div>
          <Link to="/chat" className="text-sm text-muted-foreground hover:text-foreground">
            Back to chat →
          </Link>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-8">
        {conns.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
              Connected
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {conns.map((c) => (
                <div
                  key={c.id}
                  className="border rounded-xl p-4 bg-card flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium capitalize">{c.toolkit_slug.replace(/_/g, " ")}</div>
                    <div className="text-xs mt-0.5">
                      <span
                        className={
                          c.status === "ACTIVE"
                            ? "text-green-600"
                            : "text-amber-600"
                        }
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => disconnect(c.id)}
                    disabled={busy === c.id}
                    className="text-xs text-muted-foreground hover:text-destructive p-1.5 rounded hover:bg-accent"
                    aria-label="Disconnect"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadToolkits(query)}
                placeholder="Search 1,000+ integrations…"
                className="w-full h-10 pl-9 pr-3 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={() => loadToolkits(query)}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Search
            </button>
          </div>

          {loadingTk ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading integrations…
            </div>
          ) : toolkits.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No integrations found.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {toolkits.map((t) => {
                const conn = connBySlug.get(t.slug);
                const isActive = conn?.status === "ACTIVE";
                return (
                  <div key={t.slug} className="border rounded-xl p-4 bg-card flex flex-col">
                    <div className="flex items-start gap-3">
                      {t.meta?.logo ? (
                        <img
                          src={t.meta.logo}
                          alt=""
                          className="w-10 h-10 rounded-lg bg-white object-contain p-1 border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Plug className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{t.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate">
                          {t.slug}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2 flex-1">
                      {t.meta?.description ?? "Connect this tool to your AI team."}
                    </p>
                    <div className="mt-4">
                      {isActive ? (
                        <button
                          onClick={() => disconnect(conn.id)}
                          disabled={busy === conn.id}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs h-8 rounded-md border bg-green-500/10 text-green-700 hover:bg-green-500/20"
                        >
                          <Check className="w-3.5 h-3.5" /> Connected
                        </button>
                      ) : conn ? (
                        <button
                          onClick={() => connect(t.slug)}
                          disabled={busy === t.slug}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs h-8 rounded-md border hover:bg-accent"
                        >
                          {busy === t.slug ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                          Finish connecting
                        </button>
                      ) : (
                        <button
                          onClick={() => connect(t.slug)}
                          disabled={busy === t.slug}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs h-8 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {busy === t.slug ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plug className="w-3.5 h-3.5" />
                          )}
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
