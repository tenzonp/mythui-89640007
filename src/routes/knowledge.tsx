import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter, PageHero } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  getKnowledge,
  upsertBusinessProfile,
  addTeamMember,
  deleteTeamMember,
  addAccount,
  deleteAccount,
  addEntry,
  deleteEntry,
} from "@/lib/knowledge.functions";

export const Route = createFileRoute("/knowledge")({
  ssr: false,
  head: () => ({ meta: [{ title: "Knowledge base — Mythmind" }] }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getKnowledge);
  const { data } = useQuery({ queryKey: ["knowledge"], queryFn: () => fetchFn() });

  const refresh = () => qc.invalidateQueries({ queryKey: ["knowledge"] });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHero
        kicker="KNOWLEDGE BASE"
        title={<>Train Wynsa on your <em className="font-serif italic text-violet">business</em></>}
        subtitle="Everything you add here is loaded into every chat. The AI uses this as ground truth and only asks you when it genuinely doesn't know."
      />
      <div className="max-w-4xl mx-auto px-8 pb-20">
        <Tabs defaultValue="profile" className="grid gap-6">
          <TabsList>
            <TabsTrigger value="profile">Business</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="entries">Entries</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileForm initial={data?.profile} onSaved={refresh} />
          </TabsContent>
          <TabsContent value="team">
            <TeamSection team={data?.team ?? []} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="accounts">
            <AccountsSection accounts={data?.accounts ?? []} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="entries">
            <EntriesSection entries={data?.entries ?? []} onChanged={refresh} />
          </TabsContent>
        </Tabs>
      </div>
      <SiteFooter />
    </div>
  );
}

function ProfileForm({ initial, onSaved }: { initial: any; onSaved: () => void }) {
  const save = useServerFn(upsertBusinessProfile);
  const [form, setForm] = useState<any>(initial ?? {});
  const mut = useMutation({
    mutationFn: () => save({ data: { ...form, complete: true } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const f = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <Card className="p-6 grid gap-3">
      <Input placeholder="Business name" value={form.name ?? ""} onChange={f("name")} />
      <Input placeholder="Tagline (one line)" value={form.tagline ?? ""} onChange={f("tagline")} />
      <Textarea rows={4} placeholder="What does your business do? Products, services, model…" value={form.description ?? ""} onChange={f("description")} />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Industry" value={form.industry ?? ""} onChange={f("industry")} />
        <Input placeholder="Website" value={form.website ?? ""} onChange={f("website")} />
      </div>
      <Textarea rows={2} placeholder="Who is your target audience?" value={form.target_audience ?? ""} onChange={f("target_audience")} />
      <Textarea rows={2} placeholder="Primary goal right now (e.g. grow IG to 50k, launch v2…)" value={form.primary_goal ?? ""} onChange={f("primary_goal")} />
      <Input placeholder="Brand tone (e.g. warm, expert, playful)" value={form.tone ?? ""} onChange={f("tone")} />
      <div className="flex justify-end">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </Card>
  );
}

function TeamSection({ team, onChanged }: { team: any[]; onChanged: () => void }) {
  const addFn = useServerFn(addTeamMember);
  const delFn = useServerFn(deleteTeamMember);
  const [m, setM] = useState<any>({});
  const add = useMutation({
    mutationFn: () => addFn({ data: { name: m.name, role: m.role, email: m.email, phone: m.phone, notes: m.notes } }),
    onSuccess: () => { toast.success("Added"); setM({}); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <div className="grid gap-3">
      <Card className="p-4 grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Name *" value={m.name ?? ""} onChange={(e) => setM({ ...m, name: e.target.value })} />
          <Input placeholder="Role" value={m.role ?? ""} onChange={(e) => setM({ ...m, role: e.target.value })} />
          <Input placeholder="Email" value={m.email ?? ""} onChange={(e) => setM({ ...m, email: e.target.value })} />
          <Input placeholder="Phone" value={m.phone ?? ""} onChange={(e) => setM({ ...m, phone: e.target.value })} />
        </div>
        <Input placeholder="Notes" value={m.notes ?? ""} onChange={(e) => setM({ ...m, notes: e.target.value })} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => add.mutate()} disabled={!m.name || add.isPending}>Add member</Button>
        </div>
      </Card>
      {team.map((t) => (
        <Card key={t.id} className="p-3 flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium">{t.name} {t.role && <span className="text-muted-foreground">· {t.role}</span>}</div>
            <div className="text-xs text-muted-foreground">{[t.email, t.phone, t.notes].filter(Boolean).join(" · ")}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={async () => { await delFn({ data: { id: t.id } }); onChanged(); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </Card>
      ))}
    </div>
  );
}

function AccountsSection({ accounts, onChanged }: { accounts: any[]; onChanged: () => void }) {
  const addFn = useServerFn(addAccount);
  const delFn = useServerFn(deleteAccount);
  const [a, setA] = useState<any>({ kind: "gmail" });
  const add = useMutation({
    mutationFn: () => addFn({ data: { kind: a.kind, handle: a.handle, url: a.url, notes: a.notes } }),
    onSuccess: () => { toast.success("Added"); setA({ kind: "gmail" }); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const kinds = ["gmail", "instagram", "x", "linkedin", "tiktok", "youtube", "phone", "other"];
  return (
    <div className="grid gap-3">
      <Card className="p-4 grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          <select className="border rounded-md px-3 py-2 text-sm bg-background" value={a.kind} onChange={(e) => setA({ ...a, kind: e.target.value })}>
            {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <Input placeholder="Handle (@yourbiz, phone #, etc.)" value={a.handle ?? ""} onChange={(e) => setA({ ...a, handle: e.target.value })} />
        </div>
        <Input placeholder="URL (optional)" value={a.url ?? ""} onChange={(e) => setA({ ...a, url: e.target.value })} />
        <Input placeholder="Notes" value={a.notes ?? ""} onChange={(e) => setA({ ...a, notes: e.target.value })} />
        <div className="flex justify-end"><Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Add</Button></div>
      </Card>
      {accounts.map((x) => (
        <Card key={x.id} className="p-3 flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium uppercase text-xs tracking-wider">{x.kind}</div>
            <div>{[x.handle, x.url, x.notes].filter(Boolean).join(" · ")}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={async () => { await delFn({ data: { id: x.id } }); onChanged(); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </Card>
      ))}
    </div>
  );
}

function EntriesSection({ entries, onChanged }: { entries: any[]; onChanged: () => void }) {
  const addFn = useServerFn(addEntry);
  const delFn = useServerFn(deleteEntry);
  const [e, setE] = useState<any>({});
  const add = useMutation({
    mutationFn: () => addFn({ data: { title: e.title, body: e.body, tags: (e.tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean) } }),
    onSuccess: () => { toast.success("Saved"); setE({}); onChanged(); },
    onError: (err: any) => toast.error(err?.message ?? "Failed"),
  });
  return (
    <div className="grid gap-3">
      <Card className="p-4 grid gap-2">
        <Input placeholder="Title (e.g. Pricing, Refund policy, FAQ: shipping)" value={e.title ?? ""} onChange={(ev) => setE({ ...e, title: ev.target.value })} />
        <Textarea rows={6} placeholder="The facts the AI should know…" value={e.body ?? ""} onChange={(ev) => setE({ ...e, body: ev.target.value })} />
        <Input placeholder="Tags, comma separated" value={e.tags ?? ""} onChange={(ev) => setE({ ...e, tags: ev.target.value })} />
        <div className="flex justify-end"><Button size="sm" onClick={() => add.mutate()} disabled={!e.title || !e.body || add.isPending}>Save entry</Button></div>
      </Card>
      {entries.map((x) => (
        <Card key={x.id} className="p-3 grid gap-1">
          <div className="flex items-center justify-between">
            <div className="font-medium">{x.title}</div>
            <Button variant="ghost" size="icon" onClick={async () => { await delFn({ data: { id: x.id } }); onChanged(); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          {Array.isArray(x.tags) && x.tags.length > 0 && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{x.tags.join(" · ")}</div>
          )}
          <div className="text-sm whitespace-pre-wrap">{x.body}</div>
        </Card>
      ))}
    </div>
  );
}
