import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createThread } from "@/lib/chat.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/chat/")({
  component: NewChatRedirect,
});

function NewChatRedirect() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const fn = useServerFn(createThread);
  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      const { id } = await fn({ data: {} });
      navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
    })();
  }, [user, loading]);
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Starting a new chat…
    </div>
  );
}
