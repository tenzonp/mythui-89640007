import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Plus, Check, X, ArrowRight } from "lucide-react";
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
  head: () => ({ meta: [{ title: "Knowledge — Mythmind" }] }),
  component: KnowledgePage,
});

type Section = "profile" | "team" | "accounts" | "entries";

function KnowledgePage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getKnowledge);
  const { data } = useQuery({ queryKey: ["knowledge"], queryFn: () => fetchFn() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["knowledge"] });
  const [section, setSection] = useState<Section>("profile");

  const counts = {
    profile: data?.profile ? 1 : 0,
    team: data?.team?.length ?? 0,
    accounts: data?.accounts?.length ?? 0,
    entries: data?.entries?.length ?? 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        <header className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Knowledge base</div>
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight leading-[1.05]">
            What Wynsa knows about you.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Everything here is loaded into every chat as ground truth. Add what matters — the AI fills in the rest.
          </p>
          {!data?.profile?.onboarding_completed_at && (
            <Link
              to="/onboarding"
              className="mt-5 inline-flex items-center gap-2 text-sm border border-border rounded-full px-4 py-2 hover:bg-muted transition"
            >
              Run quick onboarding <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </header>

        <div className="grid md:grid-cols-[180px_1fr] gap-10">
          <nav className="flex md:flex-col gap-1 md:gap-0.5 overflow-x-auto md:overflow-visible -mx-6 px-6 md:mx-0 md:px-0">
            {([
              ["profile", "Business"],
              ["team", "Team"],
              ["accounts", "Accounts"],
              ["entries", "Notes"],
            ] as [Section, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`group flex items-center justify-between gap-3 text-left px-3 py-2 rounded-md text-sm whitespace-nowrap transition ${
                  section === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{label}</span>
                <span className="text-[10px] tabular-nums opacity-60">{counts[id]}</span>
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {section === "profile" && <ProfileSection initial={data?.profile} onSaved={refresh} />}
            {section === "team" && <TeamSection team={data?.team ?? []} onChanged={refresh} />}
            {section === "accounts" && <AccountsSection accounts={data?.accounts ?? []} onChanged={refresh} />}
            {section === "entries" && <EntriesSection entries={data?.entries ?? []} onChanged={refresh} />}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-medium">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function ProfileSection({ initial, onSaved }: { initial: any; onSaved: () => void }) {
  const save = useServerFn(upsertBusinessProfile);
  const [form, setForm] = useState<any>(initial ?? {});
  const mut = useMutation({
    mutationFn: () => save({ data: { ...form, complete: true } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const f = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <SectionHeader title="Business profile" hint="The core facts Wynsa uses in every reply." />
      <div className="grid gap-3">
        <Input placeholder="Business name" value={form.name ?? ""} onChange={f("name")} />
        <Input placeholder="Tagline" value={form.tagline ?? ""} onChange={f("tagline")} />
        <Textarea rows={4} placeholder="What you do — products, services, model." value={form.description ?? ""} onChange={f("description")} className="resize-none" />
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Industry" value={form.industry ?? ""} onChange={f("industry")} />
          <Input placeholder="Website" value={form.website ?? ""} onChange={f("website")} />
        </div>
        <Input placeholder="Target audience" value={form.target_audience ?? ""} onChange={f("target_audience")} />
        <Input placeholder="Primary goal right now" value={form.primary_goal ?? ""} onChange={f("primary_goal")} />
        <Input placeholder="Brand tone (warm, expert, playful…)" value={form.tone ?? ""} onChange={f("tone")} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="rounded-full">
          {mut.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}

function TeamSection({ team, onChanged }: { team: any[]; onChanged: () => void }) {
  const addFn = useServerFn(addTeamMember);
  const delFn = useServerFn(deleteTeamMember);
  const [open, setOpen] = useState(false);
  const [m, setM] = useState<any>({});
  const add = useMutation({
    mutationFn: () => addFn({ data: { name: m.name, role: m.role, email: m.email, phone: m.phone, notes: m.notes } }),
    onSuccess: () => { toast.success("Added"); setM({}); setOpen(false); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div>
      <SectionHeader title="Team" hint="People Wynsa can attribute work to or contact." />
      <div className="border border-border rounded-xl divide-y divide-border">
        {team.length === 0 && !open && (
          <EmptyRow label="No team members yet." />
        )}
        {team.map((t) => (
          <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {t.name}
                {t.role && <span className="text-muted-foreground font-normal"> · {t.role}</span>}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {[t.email, t.phone, t.notes].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={async () => { await delFn({ data: { id: t.id } }); onChanged(); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {open && (
          <div className="p-4 grid gap-2 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name *" value={m.name ?? ""} onChange={(e) => setM({ ...m, name: e.target.value })} />
              <Input placeholder="Role" value={m.role ?? ""} onChange={(e) => setM({ ...m, role: e.target.value })} />
              <Input placeholder="Email" value={m.email ?? ""} onChange={(e) => setM({ ...m, email: e.target.value })} />
              <Input placeholder="Phone" value={m.phone ?? ""} onChange={(e) => setM({ ...m, phone: e.target.value })} />
            </div>
            <Input placeholder="Notes" value={m.notes ?? ""} onChange={(e) => setM({ ...m, notes: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setM({}); }}><X className="w-4 h-4" /></Button>
              <Button size="sm" onClick={() => add.mutate()} disabled={!m.name || add.isPending}><Check className="w-4 h-4 mr-1" /> Add</Button>
            </div>
          </div>
        )}
      </div>
      {!open && (
        <div className="mt-4">
          <AddButton onClick={() => setOpen(true)} label="Add member" />
        </div>
      )}
    </div>
  );
}

function AccountsSection({ accounts, onChanged }: { accounts: any[]; onChanged: () => void }) {
  const addFn = useServerFn(addAccount);
  const delFn = useServerFn(deleteAccount);
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<any>({ kind: "gmail" });
  const add = useMutation({
    mutationFn: () => addFn({ data: { kind: a.kind, handle: a.handle, url: a.url, notes: a.notes } }),
    onSuccess: () => { toast.success("Added"); setA({ kind: "gmail" }); setOpen(false); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const kinds = ["gmail", "instagram", "x", "linkedin", "tiktok", "youtube", "phone", "other"];

  return (
    <div>
      <SectionHeader title="Accounts & channels" hint="Where your business lives online." />
      <div className="border border-border rounded-xl divide-y divide-border">
        {accounts.length === 0 && !open && <EmptyRow label="No accounts yet." />}
        {accounts.map((x) => (
          <div key={x.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{x.kind}</div>
              <div className="text-sm truncate">{[x.handle, x.url, x.notes].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={async () => { await delFn({ data: { id: x.id } }); onChanged(); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {open && (
          <div className="p-4 grid gap-2 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <select className="border rounded-md px-3 py-2 text-sm bg-background" value={a.kind} onChange={(e) => setA({ ...a, kind: e.target.value })}>
                {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <Input placeholder="Handle (@yourbiz, phone…)" value={a.handle ?? ""} onChange={(e) => setA({ ...a, handle: e.target.value })} />
            </div>
            <Input placeholder="URL (optional)" value={a.url ?? ""} onChange={(e) => setA({ ...a, url: e.target.value })} />
            <Input placeholder="Notes" value={a.notes ?? ""} onChange={(e) => setA({ ...a, notes: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setA({ kind: "gmail" }); }}><X className="w-4 h-4" /></Button>
              <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}><Check className="w-4 h-4 mr-1" /> Add</Button>
            </div>
          </div>
        )}
      </div>
      {!open && <div className="mt-4"><AddButton onClick={() => setOpen(true)} label="Add account" /></div>}
    </div>
  );
}

function EntriesSection({ entries, onChanged }: { entries: any[]; onChanged: () => void }) {
  const addFn = useServerFn(addEntry);
  const delFn = useServerFn(deleteEntry);
  const [open, setOpen] = useState(false);
  const [e, setE] = useState<any>({});
  const add = useMutation({
    mutationFn: () => addFn({ data: { title: e.title, body: e.body, tags: (e.tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean) } }),
    onSuccess: () => { toast.success("Saved"); setE({}); setOpen(false); onChanged(); },
    onError: (err: any) => toast.error(err?.message ?? "Failed"),
  });

  return (
    <div>
      <SectionHeader title="Notes & facts" hint="Pricing, policies, FAQ, brand rules — anything." />
      <div className="grid gap-3">
        {entries.length === 0 && !open && (
          <div className="border border-dashed border-border rounded-xl px-4 py-10 text-center text-sm text-muted-foreground">
            No notes yet.
          </div>
        )}
        {entries.map((x) => (
          <article key={x.id} className="border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium">{x.title}</h3>
                {Array.isArray(x.tags) && x.tags.length > 0 && (
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                    {x.tags.join(" · ")}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={async () => { await delFn({ data: { id: x.id } }); onChanged(); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap mt-2 text-muted-foreground">{x.body}</p>
          </article>
        ))}
        {open && (
          <div className="border border-border rounded-xl p-4 grid gap-2 bg-muted/30">
            <Input placeholder="Title" value={e.title ?? ""} onChange={(ev) => setE({ ...e, title: ev.target.value })} />
            <Textarea rows={5} placeholder="The facts Wynsa should know…" value={e.body ?? ""} onChange={(ev) => setE({ ...e, body: ev.target.value })} className="resize-none" />
            <Input placeholder="Tags, comma separated" value={e.tags ?? ""} onChange={(ev) => setE({ ...e, tags: ev.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setE({}); }}><X className="w-4 h-4" /></Button>
              <Button size="sm" onClick={() => add.mutate()} disabled={!e.title || !e.body || add.isPending}><Check className="w-4 h-4 mr-1" /> Save</Button>
            </div>
          </div>
        )}
      </div>
      {!open && <div className="mt-4"><AddButton onClick={() => setOpen(true)} label="Add note" /></div>}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 text-sm border border-border rounded-full px-4 py-2 hover:bg-muted transition"
    >
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}
