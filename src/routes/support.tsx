import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { listMyTickets, createTicket, amIAdmin } from "@/lib/support.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support — Mythmind" }] }),
  component: SupportPage,
});

function SupportPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyTickets);
  const createFn = useServerFn(createTicket);
  const adminFn = useServerFn(amIAdmin);
  const { data } = useQuery({ queryKey: ["myTickets"], queryFn: () => listFn() });
  const { data: adm } = useQuery({ queryKey: ["amIAdmin"], queryFn: () => adminFn() });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const create = useMutation({
    mutationFn: () => createFn({ data: { subject, body } }),
    onSuccess: () => {
      toast.success("Ticket created");
      setSubject("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["myTickets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="HELP CENTER"
        title={<>Talk to <em className="font-serif italic text-violet">support</em></>}
        subtitle="We usually reply within a few hours. Be specific so we can help fast."
      />
      <div className="max-w-3xl mx-auto px-8 pb-20 grid gap-8">
        {adm?.isAdmin && (
          <Card className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">You have admin access</div>
              <div className="text-sm text-muted-foreground">Open the support inbox to handle customer tickets.</div>
            </div>
            <Button asChild><Link to="/grow/admin">Open Admin</Link></Button>
          </Card>
        )}

        <Card className="p-6">
          <h2 className="font-serif text-2xl mb-4">New ticket</h2>
          <div className="grid gap-3">
            <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Textarea
              placeholder="Describe your issue, what you tried, and what you expected to happen"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || subject.length < 2 || body.length < 2}
            >
              {create.isPending ? "Submitting…" : "Submit ticket"}
            </Button>
          </div>
        </Card>

        <div>
          <h2 className="font-serif text-2xl mb-4">Your tickets</h2>
          <div className="grid gap-3">
            {(data?.tickets ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">No tickets yet.</div>
            )}
            {(data?.tickets ?? []).map((t: any) => (
              <Link
                key={t.id}
                to="/support/$ticketId"
                params={{ ticketId: t.id }}
                className="block"
              >
                <Card className="p-4 hover:bg-accent transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(t.last_message_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full border capitalize">{t.status}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
