import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  listThreads,
  createThread,
  deleteThread,
} from "@/lib/chat.functions";
import { Plus, MessageSquare, Trash2, Plug, LayoutDashboard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat · Mythmind" }] }),
  component: ChatLayout,
});

function ChatLayout() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [threads, setThreads] = useState<{ id: string; title: string }[]>([]);
  const fetchThreads = useServerFn(listThreads);
  const fnCreate = useServerFn(createThread);
  const fnDelete = useServerFn(deleteThread);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const refresh = async () => {
    try {
      const r = await fetchThreads();
      setThreads(r.threads as any);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) refresh();
  }, [user, params.threadId]);

  const newChat = async () => {
    const { id } = await fnCreate({ data: {} });
    await refresh();
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
  };

  const removeThread = async (id: string) => {
    await fnDelete({ data: { id } });
    if (params.threadId === id) navigate({ to: "/chat" });
    refresh();
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <aside className="w-[260px] border-r bg-card hidden md:flex flex-col">
        <div className="p-4 border-b">
          <Link to="/" className="font-serif text-lg tracking-tight">
            mythmind<span style={{ color: "var(--violet, #7c5cff)" }}>.</span>
          </Link>
        </div>
        <div className="p-3">
          <button
            onClick={newChat}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            History
          </div>
          {threads.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No chats yet.</div>
          )}
          {threads.map((t) => {
            const active = params.threadId === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2 py-2 text-sm",
                  active ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  className="flex-1 min-w-0 flex items-center gap-2 truncate"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{t.title}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => removeThread(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  aria-label="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="p-2 border-t space-y-1">
          <Link
            to="/integrations"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plug className="w-4 h-4" /> Integrations
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
