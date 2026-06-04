import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Sparkles, Brain, Rocket, Zap, X } from "lucide-react";
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

// ─────────────────────────────────────────────────────────────────────────────
// Step definitions — single question per step, playful copy, custom inputs.
// ─────────────────────────────────────────────────────────────────────────────

type StepId =
  | "intro"
  | "name"
  | "tagline"
  | "description"
  | "industry"
  | "website"
  | "audience"
  | "goal"
  | "tone"
  | "team"
  | "accounts"
  | "facts"
  | "done";

const FLOW: StepId[] = [
  "intro",
  "name",
  "tagline",
  "description",
  "industry",
  "website",
  "audience",
  "goal",
  "tone",
  "team",
  "accounts",
  "facts",
  "done",
];

const TONES = ["warm", "expert", "playful", "premium", "bold", "calm", "witty", "minimal"];
const INDUSTRIES = ["SaaS", "E-commerce", "Coffee / F&B", "Agency", "Creator", "Health", "Education", "Other"];

function OnboardingPage() {
  const nav = useNavigate();
  const fetchFn = useServerFn(getKnowledge);
  const saveProfile = useServerFn(upsertBusinessProfile);
  const { data, refetch } = useQuery({ queryKey: ["knowledge"], queryFn: () => fetchFn() });

  const [stepIdx, setStepIdx] = useState(0);
  const [profile, setProfile] = useState<any>({});
  useEffect(() => { if (data?.profile) setProfile((p: any) => ({ ...data.profile, ...p })); }, [data?.profile]);

  const step = FLOW[stepIdx];
  const pct = Math.round((stepIdx / (FLOW.length - 1)) * 100);

  const next = () => setStepIdx((i) => Math.min(i + 1, FLOW.length - 1));
  const prev = () => setStepIdx((i) => Math.max(i - 1, 0));

  // Auto-save profile fields as the user moves forward.
  const persistProfile = async (patch: any) => {
    const merged = { ...profile, ...patch };
    setProfile(merged);
    try { await saveProfile({ data: patch }); } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  };

  const finish = async () => {
    try { await saveProfile({ data: { complete: true } }); } catch {}
    confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 }, colors: ["#7c3aed", "#a78bfa", "#fde68a", "#34d399"] });
    setTimeout(() => confetti({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0 } }), 200);
    setTimeout(() => confetti({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1 } }), 400);
    next();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0410] text-white">
      <BackdropFX />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-violet-300">
          <Brain className="w-4 h-4" /> wynsa // brain upload
        </div>
        <button onClick={() => nav({ to: "/chat" })} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1">
          skip <X className="w-3 h-3" />
        </button>
      </div>

      {/* Progress neuron bar */}
      <div className="relative z-10 px-6">
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", damping: 25, stiffness: 120 }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-widest text-white/30">
          <span>signal {String(stepIdx).padStart(2, "0")} / {String(FLOW.length - 1).padStart(2, "0")}</span>
          <span>{pct}% trained</span>
        </div>
      </div>

      {/* Stage */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-24 min-h-[70vh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -30, filter: "blur(8px)" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === "intro" && <IntroScreen onStart={next} />}

            {step === "name" && (
              <Prompt
                kicker="01 // identity"
                label="What's your business called?"
                hint="The name Wynsa will use everywhere."
                value={profile.name ?? ""}
                onChange={(v) => setProfile({ ...profile, name: v })}
                onBack={prev}
                onNext={async () => { await persistProfile({ name: profile.name }); next(); }}
                canNext={(profile.name ?? "").trim().length > 1}
                placeholder="e.g. Pluto Coffee Co."
              />
            )}

            {step === "tagline" && (
              <Prompt
                kicker="02 // hook"
                label="Drop your tagline."
                hint="One punchy line. Skip if you don't have one."
                value={profile.tagline ?? ""}
                onChange={(v) => setProfile({ ...profile, tagline: v })}
                onBack={prev}
                onNext={async () => { await persistProfile({ tagline: profile.tagline }); next(); }}
                optional
                placeholder="Slow coffee. Loud mornings."
              />
            )}

            {step === "description" && (
              <Prompt
                kicker="03 // payload"
                label="Tell Wynsa what you actually do."
                hint="Products, services, business model, who pays you. Spill it."
                value={profile.description ?? ""}
                onChange={(v) => setProfile({ ...profile, description: v })}
                onBack={prev}
                onNext={async () => { await persistProfile({ description: profile.description }); next(); }}
                canNext={(profile.description ?? "").trim().length > 10}
                multiline
                placeholder="We roast single-origin beans in Brooklyn and ship subscriptions to home brewers nationwide…"
              />
            )}

            {step === "industry" && (
              <ChipPicker
                kicker="04 // domain"
                label="Pick your world."
                options={INDUSTRIES}
                value={profile.industry ?? ""}
                onChange={(v) => setProfile({ ...profile, industry: v })}
                onBack={prev}
                onNext={async () => { await persistProfile({ industry: profile.industry }); next(); }}
                allowCustom
              />
            )}

            {step === "website" && (
              <Prompt
                kicker="05 // signal"
                label="Got a website?"
                hint="If yes, paste the URL. If not, smash next — Wynsa can build you one."
                value={profile.website ?? ""}
                onChange={(v) => setProfile({ ...profile, website: v })}
                onBack={prev}
                onNext={async () => { await persistProfile({ website: profile.website }); next(); }}
                optional
                placeholder="https://yourbiz.com"
              />
            )}

            {step === "audience" && (
              <Prompt
                kicker="06 // target"
                label="Who are you for?"
                hint="Describe your customer like you'd describe a friend."
                value={profile.target_audience ?? ""}
                onChange={(v) => setProfile({ ...profile, target_audience: v })}
                onBack={prev}
                onNext={async () => { await persistProfile({ target_audience: profile.target_audience }); next(); }}
                multiline
                placeholder="25–40 yo design nerds in big cities who care about ethically sourced beans."
                optional
              />
            )}

            {step === "goal" && (
              <Prompt
                kicker="07 // mission"
                label="What's your #1 goal right now?"
                hint="Wynsa optimizes everything for this."
                value={profile.primary_goal ?? ""}
                onChange={(v) => setProfile({ ...profile, primary_goal: v })}
                onBack={prev}
                onNext={async () => { await persistProfile({ primary_goal: profile.primary_goal }); next(); }}
                multiline
                placeholder="Hit $20k MRR, launch the new site, grow IG to 50k…"
                optional
              />
            )}

            {step === "tone" && (
              <ChipPicker
                kicker="08 // voice"
                label="Pick your brand vibe."
                options={TONES}
                value={profile.tone ?? ""}
                onChange={(v) => setProfile({ ...profile, tone: v })}
                onBack={prev}
                onNext={async () => { await persistProfile({ tone: profile.tone }); next(); }}
                multi
                allowCustom
              />
            )}

            {step === "team" && (
              <TeamStage team={data?.team ?? []} onChanged={refetch} onBack={prev} onNext={next} />
            )}

            {step === "accounts" && (
              <AccountsStage accounts={data?.accounts ?? []} onChanged={refetch} onBack={prev} onNext={next} />
            )}

            {step === "facts" && (
              <FactsStage entries={data?.entries ?? []} onChanged={refetch} onBack={prev} onFinish={finish} />
            )}

            {step === "done" && <DoneScreen onGoChat={() => nav({ to: "/chat" })} onGoKnowledge={() => nav({ to: "/knowledge" })} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable funky bits
// ─────────────────────────────────────────────────────────────────────────────

function BackdropFX() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(124,58,237,0.35),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.25),transparent_55%),radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.18),transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] [background-size:40px_40px]" />
      <FloatingOrbs />
    </>
  );
}

function FloatingOrbs() {
  const orbs = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    s: 100 + Math.random() * 240,
    d: 6 + Math.random() * 8,
  })), []);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((o) => (
        <motion.div
          key={o.id}
          className="absolute rounded-full blur-3xl"
          style={{
            left: `${o.x}%`,
            top: `${o.y}%`,
            width: o.s,
            height: o.s,
            background: o.id % 2 ? "rgba(167,139,250,0.18)" : "rgba(244,114,182,0.14)",
          }}
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: o.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-violet-300/80 mb-3 inline-flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
      {children}
    </div>
  );
}

function NavButtons({ onBack, onNext, canNext = true, nextLabel = "Next", busy = false }: any) {
  return (
    <div className="mt-8 flex items-center justify-between">
      <button onClick={onBack} className="text-sm text-white/40 hover:text-white inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> back
      </button>
      <Button
        onClick={onNext}
        disabled={!canNext || busy}
        className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white border-0 shadow-[0_0_30px_-5px_rgba(168,85,247,0.6)] px-6 h-11 rounded-xl"
      >
        {nextLabel} <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </div>
  );
}

function Prompt({ kicker, label, hint, value, onChange, onBack, onNext, canNext, optional, multiline, placeholder }: any) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const ok = optional ? true : (canNext ?? (String(value ?? "").trim().length > 0));
  const onKey = (e: any) => {
    if (e.key === "Enter" && !e.shiftKey && !multiline && ok) { e.preventDefault(); onNext(); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && ok) { e.preventDefault(); onNext(); }
  };
  return (
    <div>
      <Kicker>{kicker}</Kicker>
      <h2 className="text-3xl md:text-5xl font-serif leading-tight tracking-tight text-white">{label}</h2>
      {hint && <p className="mt-3 text-white/50 text-sm md:text-base">{hint}</p>}
      <div className="mt-7">
        {multiline ? (
          <Textarea
            ref={ref as any}
            rows={5}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-base rounded-2xl px-5 py-4 focus-visible:ring-violet-400/60"
          />
        ) : (
          <Input
            ref={ref as any}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-lg h-14 rounded-2xl px-5 focus-visible:ring-violet-400/60"
          />
        )}
      </div>
      <NavButtons onBack={onBack} onNext={onNext} canNext={ok} nextLabel={optional && !String(value ?? "").trim() ? "Skip" : "Next"} />
    </div>
  );
}

function ChipPicker({ kicker, label, options, value, onChange, onBack, onNext, multi, allowCustom }: any) {
  const selected: string[] = multi ? String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean) : (value ? [value] : []);
  const toggle = (opt: string) => {
    if (multi) {
      const set = new Set(selected);
      set.has(opt) ? set.delete(opt) : set.add(opt);
      onChange(Array.from(set).join(", "));
    } else {
      onChange(opt);
    }
  };
  const [custom, setCustom] = useState("");
  const addCustom = () => {
    if (!custom.trim()) return;
    if (multi) onChange([...selected, custom.trim()].join(", "));
    else onChange(custom.trim());
    setCustom("");
  };
  return (
    <div>
      <Kicker>{kicker}</Kicker>
      <h2 className="text-3xl md:text-5xl font-serif leading-tight tracking-tight text-white">{label}</h2>
      <div className="mt-7 flex flex-wrap gap-2.5">
        {options.map((o: string) => {
          const on = selected.includes(o);
          return (
            <motion.button
              key={o}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggle(o)}
              className={`px-4 py-2.5 rounded-full text-sm border transition-all ${
                on
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 border-transparent text-white shadow-[0_0_25px_-5px_rgba(168,85,247,0.7)]"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {o}
            </motion.button>
          );
        })}
      </div>
      {allowCustom && (
        <div className="mt-4 flex gap-2 max-w-md">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="or type your own…"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 rounded-xl"
          />
          <Button onClick={addCustom} variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 h-11 rounded-xl"><Plus className="w-4 h-4" /></Button>
        </div>
      )}
      <NavButtons onBack={onBack} onNext={onNext} canNext={selected.length > 0} />
    </div>
  );
}

function TeamStage({ team, onChanged, onBack, onNext }: any) {
  const addFn = useServerFn(addTeamMember);
  const delFn = useServerFn(deleteTeamMember);
  const [m, setM] = useState<any>({});
  const add = useMutation({
    mutationFn: () => addFn({ data: { name: m.name, role: m.role, email: m.email, phone: m.phone, notes: m.notes } }),
    onSuccess: () => { setM({}); onChanged(); toast.success("Synced to the brain ✨"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <div>
      <Kicker>09 // crew</Kicker>
      <h2 className="text-3xl md:text-5xl font-serif leading-tight tracking-tight text-white">Who's on your team?</h2>
      <p className="mt-3 text-white/50 text-sm">Add humans Wynsa might email, mention, or coordinate with. Solo? Just hit next.</p>

      <div className="mt-6 grid gap-2 p-4 rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="grid grid-cols-2 gap-2">
          <FieldInput placeholder="Name" value={m.name} onChange={(v) => setM({ ...m, name: v })} />
          <FieldInput placeholder="Role" value={m.role} onChange={(v) => setM({ ...m, role: v })} />
          <FieldInput placeholder="Email" value={m.email} onChange={(v) => setM({ ...m, email: v })} />
          <FieldInput placeholder="Phone" value={m.phone} onChange={(v) => setM({ ...m, phone: v })} />
        </div>
        <FieldInput placeholder="Notes (owns marketing, handles support…)" value={m.notes} onChange={(v) => setM({ ...m, notes: v })} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => add.mutate()} disabled={!m.name || add.isPending}
            className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-500/30 rounded-lg">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add to crew
          </Button>
        </div>
      </div>

      {team.length > 0 && (
        <div className="mt-4 grid gap-2">
          {team.map((t: any) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="text-sm">
                <div className="font-medium text-white">{t.name} <span className="text-white/40 font-normal">· {t.role}</span></div>
                <div className="text-xs text-white/40">{[t.email, t.phone].filter(Boolean).join(" · ")}</div>
              </div>
              <button onClick={async () => { await delFn({ data: { id: t.id } }); onChanged(); }} className="text-white/40 hover:text-rose-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

function AccountsStage({ accounts, onChanged, onBack, onNext }: any) {
  const addFn = useServerFn(addAccount);
  const delFn = useServerFn(deleteAccount);
  const [a, setA] = useState<any>({ kind: "gmail" });
  const kinds = ["gmail", "instagram", "x", "linkedin", "tiktok", "youtube", "phone", "whatsapp", "other"];
  const add = useMutation({
    mutationFn: () => addFn({ data: { kind: a.kind, handle: a.handle, url: a.url, notes: a.notes } }),
    onSuccess: () => { setA({ kind: "gmail" }); onChanged(); toast.success("Plugged in 🔌"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <div>
      <Kicker>10 // channels</Kicker>
      <h2 className="text-3xl md:text-5xl font-serif leading-tight tracking-tight text-white">Where do you live online?</h2>
      <p className="mt-3 text-white/50 text-sm">Handles, emails, phone numbers — so Wynsa replies from the right account.</p>

      <div className="mt-6 grid gap-2 p-4 rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button key={k} onClick={() => setA({ ...a, kind: k })}
              className={`px-3 py-1.5 rounded-full text-xs ${a.kind === k ? "bg-fuchsia-500/30 text-white border border-fuchsia-400/50" : "bg-white/5 text-white/60 border border-white/10 hover:text-white"}`}>
              {k}
            </button>
          ))}
        </div>
        <FieldInput placeholder="Handle (@yourbiz, phone, address…)" value={a.handle} onChange={(v) => setA({ ...a, handle: v })} />
        <FieldInput placeholder="URL (optional)" value={a.url} onChange={(v) => setA({ ...a, url: v })} />
        <FieldInput placeholder="Notes" value={a.notes} onChange={(v) => setA({ ...a, notes: v })} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => add.mutate()} disabled={!a.handle || add.isPending}
            className="bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-200 border border-fuchsia-500/30 rounded-lg">
            <Plus className="w-3.5 h-3.5 mr-1" /> Plug it in
          </Button>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="mt-4 grid gap-2">
          {accounts.map((x: any) => (
            <motion.div key={x.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="text-sm">
                <div className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300/80">{x.kind}</div>
                <div className="text-white">{[x.handle, x.url].filter(Boolean).join(" · ")}</div>
              </div>
              <button onClick={async () => { await delFn({ data: { id: x.id } }); onChanged(); }} className="text-white/40 hover:text-rose-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

function FactsStage({ entries, onChanged, onBack, onFinish }: any) {
  const addFn = useServerFn(addEntry);
  const [e, setE] = useState<any>({});
  const add = useMutation({
    mutationFn: () => addFn({ data: { title: e.title, body: e.body, tags: (e.tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean) } }),
    onSuccess: () => { setE({}); onChanged(); toast.success("Knowledge absorbed 🧠"); },
    onError: (err: any) => toast.error(err?.message ?? "Failed"),
  });
  return (
    <div>
      <Kicker>11 // secrets</Kicker>
      <h2 className="text-3xl md:text-5xl font-serif leading-tight tracking-tight text-white">Drop your secret sauce.</h2>
      <p className="mt-3 text-white/50 text-sm">Pricing, refund policy, FAQs, brand story, killer facts. Add as many as you want.</p>

      <div className="mt-6 grid gap-2 p-4 rounded-2xl border border-white/10 bg-white/[0.04]">
        <FieldInput placeholder="Title (e.g. Pricing, Refund policy)" value={e.title} onChange={(v) => setE({ ...e, title: v })} />
        <Textarea rows={4} value={e.body ?? ""} onChange={(ev) => setE({ ...e, body: ev.target.value })}
          placeholder="The facts…"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl" />
        <FieldInput placeholder="Tags, comma separated" value={e.tags} onChange={(v) => setE({ ...e, tags: v })} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => add.mutate()} disabled={!e.title || !e.body || add.isPending}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-lg">
            <Plus className="w-3.5 h-3.5 mr-1" /> Save fact
          </Button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="mt-4 grid gap-1.5">
          {entries.slice(0, 6).map((x: any) => (
            <div key={x.id} className="text-sm text-white/70 truncate">
              <span className="text-white font-medium">{x.title}</span>
              <span className="text-white/40"> — {String(x.body).slice(0, 90)}…</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-white/40 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> back
        </button>
        <Button onClick={onFinish}
          className="bg-gradient-to-r from-amber-400 via-fuchsia-500 to-violet-500 text-white border-0 px-7 h-12 rounded-xl shadow-[0_0_40px_-5px_rgba(217,70,239,0.7)]">
          <Rocket className="w-4 h-4 mr-2" /> Launch Wynsa
        </Button>
      </div>
    </div>
  );
}

function FieldInput({ value, onChange, placeholder }: any) {
  return (
    <Input
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl h-10"
    />
  );
}

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center pt-10">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 12 }}
        className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 flex items-center justify-center shadow-[0_0_60px_-10px_rgba(168,85,247,0.8)]"
      >
        <Brain className="w-10 h-10 text-white" />
      </motion.div>
      <h1 className="mt-8 text-4xl md:text-6xl font-serif leading-[1.05] tracking-tight">
        Let's <em className="italic bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">hack</em><br />
        Wynsa's brain with <em className="italic bg-gradient-to-r from-amber-200 to-fuchsia-300 bg-clip-text text-transparent">your business.</em>
      </h1>
      <p className="mt-5 text-white/50 max-w-md mx-auto">
        11 quick signals. ~90 seconds. Then your AI workforce already knows everything before you open your mouth.
      </p>
      <Button onClick={onStart}
        className="mt-9 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0 px-8 h-12 rounded-xl shadow-[0_0_40px_-5px_rgba(168,85,247,0.8)]">
        <Zap className="w-4 h-4 mr-2" /> Start the upload
      </Button>
      <div className="mt-6 text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">press enter to begin</div>
    </div>
  );
}

function DoneScreen({ onGoChat, onGoKnowledge }: any) {
  return (
    <div className="text-center pt-10">
      <motion.div
        initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 10 }}
        className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-violet-500 flex items-center justify-center shadow-[0_0_80px_-10px_rgba(52,211,153,0.6)]"
      >
        <Check className="w-12 h-12 text-white" strokeWidth={3} />
      </motion.div>
      <h1 className="mt-8 text-4xl md:text-6xl font-serif">
        Wynsa is <em className="italic bg-gradient-to-r from-emerald-300 to-violet-300 bg-clip-text text-transparent">awake.</em>
      </h1>
      <p className="mt-4 text-white/50 max-w-md mx-auto">
        Your AI team is briefed and online. Go give them something to do.
      </p>
      <div className="mt-9 flex flex-wrap gap-3 justify-center">
        <Button onClick={onGoChat}
          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0 px-7 h-12 rounded-xl shadow-[0_0_40px_-5px_rgba(168,85,247,0.7)]">
          <Sparkles className="w-4 h-4 mr-2" /> Start chatting
        </Button>
        <Button onClick={onGoKnowledge} variant="outline"
          className="bg-white/5 border-white/15 text-white hover:bg-white/10 h-12 rounded-xl px-6">
          Edit knowledge
        </Button>
      </div>
    </div>
  );
}
