import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminListTickets,
  adminSetTicket,
  amIAdmin,
  getTicket,
  replyTicket,
} from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/grow/admin")({
  head: () => ({ meta: [{ title: "Admin · Support Inbox — Mythmind" }] }),
  component: AdminPage,
});

function AdminPage() {
  const nav = useNavigate();
  const adminFn = useServerFn(amIAdmin);
  const { data: who, isLoading: whoLoading } = useQuery({ queryKey: ["amIAdmin"], queryFn: () => adminFn() });

  if (whoLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-5xl mx-auto px-8 py-20">Checking access…</div>
      </div>
    );
  }
  if (!who?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-5xl mx-auto px-8 py-20 grid gap-3">
          <h1 className="font-serif text-3xl">Not authorized</h1>
          <p className="text-muted-foreground">
            This area is restricted to Mythmind staff. If you should have access,
            ask an existing admin to grant your account the <code>admin</code> role.
          </p>
          <Button className="w-fit" onClick={() => nav({ to: "/" })}>Back home</Button>
        </div>
      </div>
    );
  }

  return <AdminInbox />;
}

function AdminInbox() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListTickets);
  const setFn = useServerFn(adminSetTicket);
  const [status, setStatus] = useState<string>("open");
  const [selected, setSelected] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["adminTickets", status],
    queryFn: () => listFn({ data: { status } }),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        qc.invalidateQueries({ queryKey: ["adminTickets"] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, () =>
        qc.invalidateQueries({ queryKey: ["adminTickets"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="ADMIN"
        title={<>Support <em className="font-serif italic text-violet">Inbox</em></>}
        subtitle="Tickets from Mythmind users. Reply, change status, and close them out."
      />
      <div className="max-w-6xl mx-auto px-8 pb-20 grid lg:grid-cols-[360px_1fr] gap-6">
        <div className="grid gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="answered">Answered</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid gap-2 max-h-[70vh] overflow-auto">
            {(data?.tickets ?? []).map((t: any) => (
              <button key={t.id} onClick={() => setSelected(t.id)} className="text-left">
                <Card className={`p-3 ${selected === t.id ? "border-violet" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">{t.subject}</div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border capitalize shrink-0">{t.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{t.userEmail ?? t.user_id.slice(0, 8)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(t.last_message_at).toLocaleString()}
                  </div>
                </Card>
              </button>
            ))}
            {(data?.tickets ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground p-4">No tickets in this view.</div>
            )}
          </div>
        </div>
        <div>
          {selected ? (
            <AdminTicketDetail ticketId={selected} onStatusChange={(s) => {
              setFn({ data: { id: selected, status: s as any } }).then(() => {
                qc.invalidateQueries({ queryKey: ["adminTickets"] });
                qc.invalidateQueries({ queryKey: ["ticket", selected] });
              });
            }} />
          ) : (
            <Card className="p-8 text-sm text-muted-foreground">Pick a ticket to view the thread.</Card>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function AdminTicketDetail({ ticketId, onStatusChange }: { ticketId: string; onStatusChange: (s: string) => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getTicket);
  const replyFn = useServerFn(replyTicket);
  const { data } = useQuery({ queryKey: ["ticket", ticketId], queryFn: () => getFn({ data: { id: ticketId } }) });
  const [body, setBody] = useState("");
  const reply = useMutation({
    mutationFn: () => replyFn({ data: { ticketId, body } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["adminTickets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`admin-ticket-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticketId}` },
        () => qc.invalidateQueries({ queryKey: ["ticket", ticketId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticketId, qc]);

  if (!data) return <Card className="p-6">Loading…</Card>;

  return (
    <Card className="p-6 grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Status: {data.ticket.status}
          </div>
          <h2 className="font-serif text-2xl mt-1">{data.ticket.subject}</h2>
        </div>
        <Select value={data.ticket.status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="answered">Answered</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 max-h-[50vh] overflow-auto">
        {data.messages.map((m: any) => (
          <div key={m.id} className={`p-3 rounded-lg border ${m.is_staff ? "bg-violet/5 border-violet/40" : "bg-muted/30"}`}>
            <div className="text-xs text-muted-foreground mb-1">
              {m.is_staff ? "Staff" : "Customer"} · {new Date(m.created_at).toLocaleString()}
            </div>
            <div className="whitespace-pre-wrap text-sm">{m.body}</div>
          </div>
        ))}
      </div>
      <Textarea rows={4} placeholder="Reply as Mythmind support…" value={body} onChange={(e) => setBody(e.target.value)} />
      <Button onClick={() => reply.mutate()} disabled={!body.trim() || reply.isPending}>
        {reply.isPending ? "Sending…" : "Send reply"}
      </Button>
    </Card>
  );
}
