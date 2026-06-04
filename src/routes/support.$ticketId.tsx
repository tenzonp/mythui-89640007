import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { getTicket, replyTicket } from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/support/$ticketId")({
  head: () => ({ meta: [{ title: "Ticket — Mythmind Support" }] }),
  component: TicketPage,
});

function TicketPage() {
  const { ticketId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getTicket);
  const replyFn = useServerFn(replyTicket);
  const { data, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getFn({ data: { id: ticketId } }),
  });

  const [body, setBody] = useState("");
  const reply = useMutation({
    mutationFn: () => replyFn({ data: { ticketId, body } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticketId}` },
        () => qc.invalidateQueries({ queryKey: ["ticket", ticketId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ticketId, qc]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-8 py-12 grid gap-6">
        <Button variant="ghost" className="w-fit" onClick={() => nav({ to: "/support" })}>← Back</Button>
        {isLoading && <div>Loading…</div>}
        {data && (
          <>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Status: {data.ticket.status} · Priority: {data.ticket.priority}
              </div>
              <h1 className="font-serif text-3xl mt-1">{data.ticket.subject}</h1>
            </div>
            <div className="grid gap-3">
              {data.messages.map((m: any) => (
                <Card key={m.id} className={`p-4 ${m.is_staff ? "border-violet/50 bg-violet/5" : ""}`}>
                  <div className="text-xs text-muted-foreground mb-1">
                    {m.is_staff ? "Mythmind Support" : "You"} · {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{m.body}</div>
                </Card>
              ))}
            </div>
            <Card className="p-4 grid gap-3">
              <Textarea
                rows={4}
                placeholder="Write a reply…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <Button onClick={() => reply.mutate()} disabled={!body.trim() || reply.isPending}>
                {reply.isPending ? "Sending…" : "Send reply"}
              </Button>
            </Card>
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
