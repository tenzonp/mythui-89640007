import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Sparkles } from "lucide-react";
import {
  getKnowledge,
  upsertBusinessProfile,
  addTeamMember,
  deleteTeamMember,
  addAccount,
  deleteAccount,
  addEntry,
} from "@/lib/knowledge.functions";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "Onboarding — Mythmind" }] }),
  component: OnboardingPage,
});

type StepKey = "business" | "audience" | "team" | "accounts" | "facts" | "done";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "business", label: "Business" },
  { key: "audience", label: "Audience & tone" },
  { key: "team", label: "Team" },
  { key: "accounts", label: "Accounts" },
  { key: "facts", label: "Knowledge" },
  { key: "done", label: "Done" },
];

function OnboardingPage() {
  const nav = useNavigate();
  const fetchFn = useServerFn(getKnowledge);
  const { data, refetch } = useQuery({ queryKey: ["knowledge"], queryFn: () => fetchFn() });
  const [step, setStep] = useState<StepKey>("business");
  const idx = STEPS.findIndex((s) => s.key === step);
  const goto = (k: StepKey) => setStep(k);
  const next = () => goto(STEPS[Math.min(idx + 1, STEPS.length - 1)].key);
  const prev = () => goto(STEPS[Math.max(idx - 1, 0)].key);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-violet mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Onboarding
          </div>
          <h1 className="text-3xl md:text-4xl font-serif">
            Train Wynsa on <em className="italic text-violet">your business</em>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-xl mx-auto">
            5 quick steps. Everything you add here becomes ground truth for every chat — the AI will use it before asking you anything.
          </p>
        </div>

        <Stepper current={idx} />

        <div className="mt-8">
          {step === "business" && <BusinessStep initial={data?.profile} onSaved={() => { refetch(); next(); }} />}
          {step === "audience" && <AudienceStep initial={data?.profile} onSaved={() => { refetch(); next(); }} onBack={prev} />}
          {step === "team" && <TeamStep team={data?.team ?? []} onChanged={refetch} onNext={next} onBack={prev} />}
          {step === "accounts" && <AccountsStep accounts={data?.accounts ?? []} onChanged={refetch} onNext={next} onBack={prev} />}
          {step === "facts" && <FactsStep entries={data?.entries ?? []} onChanged={refetch} onNext={next} onBack={prev} />}
          {step === "done" && (
            <Card className="p-8 text-center grid gap-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-medium">Wynsa is trained.</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  You can edit or add more facts anytime on the Knowledge page.
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => nav({ to: "/knowledge" })}>Open Knowledge</Button>
                <Button onClick={() => nav({ to: "/chat" })}>Start chatting</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 justify-center flex-wrap">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium border ${
              i < current ? "bg-violet text-white border-violet" : i === current ? "border-violet text-violet" : "text-muted-foreground"
            }`}
          >
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={`text-xs ${i === current ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
          {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

function BusinessStep({ initial, onSaved }: { initial: any; onSaved: () => void }) {
  const save = useServerFn(upsertBusinessProfile);
  const [f, setF] = useState<any>(initial ?? {});
  const mut = useMutation({
    mutationFn: () => save({ data: {
      name: f.name, tagline: f.tagline, description: f.description,
      industry: f.industry, website: f.website,
    } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const canNext = (f.name ?? "").trim().length > 0 && (f.description ?? "").trim().length > 0;
  return (
    <Card className="p-6 grid gap-3">
      <h2 className="text-lg font-medium">Tell us about your business</h2>
      <Input placeholder="Business name *" value={f.name ?? ""} onChange={set("name")} />
      <Input placeholder="One-line tagline" value={f.tagline ?? ""} onChange={set("tagline")} />
      <Textarea rows={4} placeholder="What does your business do? Products, services, model… *" value={f.description ?? ""} onChange={set("description")} />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Industry" value={f.industry ?? ""} onChange={set("industry")} />
        <Input placeholder="Website" value={f.website ?? ""} onChange={set("website")} />
      </div>
      <div className="flex justify-end mt-2">
        <Button onClick={() => mut.mutate()} disabled={!canNext || mut.isPending}>
          {mut.isPending ? "Saving…" : "Continue"} <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    </Card>
  );
}

function AudienceStep({ initial, onSaved, onBack }: { initial: any; onSaved: () => void; onBack: () => void }) {
  const save = useServerFn(upsertBusinessProfile);
  const [f, setF] = useState<any>(initial ?? {});
  const mut = useMutation({
    mutationFn: () => save({ data: {
      target_audience: f.target_audience, primary_goal: f.primary_goal, tone: f.tone,
    } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Card className="p-6 grid gap-3">
      <h2 className="text-lg font-medium">Audience & brand voice</h2>
      <Textarea rows={2} placeholder="Who is your target audience?" value={f.target_audience ?? ""} onChange={set("target_audience")} />
      <Textarea rows={2} placeholder="Primary goal right now (e.g. grow IG to 50k, launch v2, hit $20k MRR…)" value={f.primary_goal ?? ""} onChange={set("primary_goal")} />
      <Input placeholder="Brand tone (warm, expert, playful, premium…)" value={f.tone ?? ""} onChange={set("tone")} />
      <div className="flex justify-between mt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Saving…" : "Continue"} <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    </Card>
  );
}

function TeamStep({ team, onChanged, onNext, onBack }: { team: any[]; onChanged: () => void; onNext: () => void; onBack: () => void }) {
  const addFn = useServerFn(addTeamMember);
  const delFn = useServerFn(deleteTeamMember);
  const [m, setM] = useState<any>({});
  const add = useMutation({
    mutationFn: () => addFn({ data: { name: m.name, role: m.role, email: m.email, phone: m.phone, notes: m.notes } }),
    onSuccess: () => { setM({}); onChanged(); toast.success("Added"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <Card className="p-6 grid gap-3">
      <h2 className="text-lg font-medium">Your team</h2>
      <p className="text-sm text-muted-foreground -mt-1">Add the humans Wynsa might mention, email or coordinate with. Skip if it's just you.</p>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Name" value={m.name ?? ""} onChange={(e) => setM({ ...m, name: e.target.value })} />
        <Input placeholder="Role" value={m.role ?? ""} onChange={(e) => setM({ ...m, role: e.target.value })} />
        <Input placeholder="Email" value={m.email ?? ""} onChange={(e) => setM({ ...m, email: e.target.value })} />
        <Input placeholder="Phone" value={m.phone ?? ""} onChange={(e) => setM({ ...m, phone: e.target.value })} />
      </div>
      <Input placeholder="Notes (e.g. owns marketing, handles support)" value={m.notes ?? ""} onChange={(e) => setM({ ...m, notes: e.target.value })} />
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => add.mutate()} disabled={!m.name || add.isPending}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add member
        </Button>
      </div>
      {team.length > 0 && (
        <div className="grid gap-2 pt-2 border-t">
          {team.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-medium">{t.name} <span className="text-muted-foreground font-normal">· {t.role}</span></div>
                <div className="text-xs text-muted-foreground">{[t.email, t.phone].filter(Boolean).join(" · ")}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={async () => { await delFn({ data: { id: t.id } }); onChanged(); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between mt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
        <Button onClick={onNext}>Continue <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
      </div>
    </Card>
  );
}

function AccountsStep({ accounts, onChanged, onNext, onBack }: { accounts: any[]; onChanged: () => void; onNext: () => void; onBack: () => void }) {
  const addFn = useServerFn(addAccount);
  const delFn = useServerFn(deleteAccount);
  const [a, setA] = useState<any>({ kind: "gmail" });
  const kinds = ["gmail", "instagram", "x", "linkedin", "tiktok", "youtube", "phone", "whatsapp", "other"];
  const add = useMutation({
    mutationFn: () => addFn({ data: { kind: a.kind, handle: a.handle, url: a.url, notes: a.notes } }),
    onSuccess: () => { setA({ kind: "gmail" }); onChanged(); toast.success("Added"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <Card className="p-6 grid gap-3">
      <h2 className="text-lg font-medium">Accounts & contact channels</h2>
      <p className="text-sm text-muted-foreground -mt-1">Wynsa will use these as the right reply-from address / handle when posting or replying.</p>
      <div className="grid grid-cols-2 gap-2">
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={a.kind} onChange={(e) => setA({ ...a, kind: e.target.value })}>
          {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <Input placeholder="Handle (@yourbiz, phone #, address…)" value={a.handle ?? ""} onChange={(e) => setA({ ...a, handle: e.target.value })} />
      </div>
      <Input placeholder="URL (optional)" value={a.url ?? ""} onChange={(e) => setA({ ...a, url: e.target.value })} />
      <Input placeholder="Notes" value={a.notes ?? ""} onChange={(e) => setA({ ...a, notes: e.target.value })} />
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => add.mutate()} disabled={add.isPending}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add account
        </Button>
      </div>
      {accounts.length > 0 && (
        <div className="grid gap-2 pt-2 border-t">
          {accounts.map((x) => (
            <div key={x.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-medium uppercase text-[10px] tracking-wider text-muted-foreground">{x.kind}</div>
                <div>{[x.handle, x.url].filter(Boolean).join(" · ")}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={async () => { await delFn({ data: { id: x.id } }); onChanged(); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between mt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
        <Button onClick={onNext}>Continue <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
      </div>
    </Card>
  );
}

function FactsStep({ entries, onChanged, onNext, onBack }: { entries: any[]; onChanged: () => void; onNext: () => void; onBack: () => void }) {
  const addFn = useServerFn(addEntry);
  const save = useServerFn(upsertBusinessProfile);
  const [e, setE] = useState<any>({});
  const add = useMutation({
    mutationFn: () => addFn({ data: { title: e.title, body: e.body, tags: (e.tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean) } }),
    onSuccess: () => { setE({}); onChanged(); toast.success("Saved"); },
    onError: (err: any) => toast.error(err?.message ?? "Failed"),
  });
  const finish = useMutation({
    mutationFn: () => save({ data: { complete: true } }),
    onSuccess: () => onNext(),
    onError: (err: any) => toast.error(err?.message ?? "Failed"),
  });
  return (
    <Card className="p-6 grid gap-3">
      <h2 className="text-lg font-medium">Anything else Wynsa should know?</h2>
      <p className="text-sm text-muted-foreground -mt-1">
        Pricing, refund policy, FAQs, brand story, key partners, product details… add as many entries as you want.
      </p>
      <Input placeholder="Title (e.g. Pricing, Refund policy, FAQ: shipping)" value={e.title ?? ""} onChange={(ev) => setE({ ...e, title: ev.target.value })} />
      <Textarea rows={5} placeholder="The facts…" value={e.body ?? ""} onChange={(ev) => setE({ ...e, body: ev.target.value })} />
      <Input placeholder="Tags, comma separated" value={e.tags ?? ""} onChange={(ev) => setE({ ...e, tags: ev.target.value })} />
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => add.mutate()} disabled={!e.title || !e.body || add.isPending}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Save entry
        </Button>
      </div>
      {entries.length > 0 && (
        <div className="grid gap-2 pt-2 border-t">
          {entries.slice(0, 6).map((x) => (
            <div key={x.id} className="text-sm">
              <span className="font-medium">{x.title}</span>
              <span className="text-muted-foreground"> — {String(x.body).slice(0, 100)}…</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between mt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
        <Button onClick={() => finish.mutate()} disabled={finish.isPending}>
          {finish.isPending ? "Finishing…" : "Finish onboarding"} <Check className="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    </Card>
  );
}
