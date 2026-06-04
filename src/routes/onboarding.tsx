import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2 } from "lucide-react";
import { upsertBusinessProfile, inferProfile, addEntry } from "@/lib/knowledge.functions";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "Onboarding — Mythmind" }] }),
  component: OnboardingPage,
});

type Inferred = {
  tagline?: string;
  industry?: string;
  target_audience?: string;
  primary_goal?: string;
  tone?: string;
  value_props?: string[];
};

function OnboardingPage() {
  const nav = useNavigate();
  const saveProfile = useServerFn(upsertBusinessProfile);
  const inferFn = useServerFn(inferProfile);
  const addEntryFn = useServerFn(addEntry);

  const [step, setStep] = useState(0); // 0,1,2
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [extra, setExtra] = useState("");
  const [inferred, setInferred] = useState<Inferred | null>(null);
  const [busy, setBusy] = useState(false);

  const goStep1 = () => {
    if (name.trim().length < 2 || description.trim().length < 12) {
      toast.error("A name and a sentence about what you do — that's all I need.");
      return;
    }
    setStep(1);
  };

  const runInference = async () => {
    setBusy(true);
    try {
      const r = await inferFn({ data: { name, description, extra: extra || undefined } });
      setInferred(r);
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't reach the AI — saving what we have.");
      setInferred({});
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    setBusy(true);
    try {
      await saveProfile({
        data: {
          name,
          description,
          tagline: inferred?.tagline,
          industry: inferred?.industry,
          target_audience: inferred?.target_audience,
          primary_goal: inferred?.primary_goal,
          tone: inferred?.tone,
          value_props: inferred?.value_props,
          complete: true,
        },
      });
      if (extra.trim()) {
        try {
          await addEntryFn({ data: { title: "Founder notes", body: extra.trim(), tags: ["onboarding"] } });
        } catch {}
      }
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.5 }, colors: ["#111", "#888", "#fde68a"] });
      nav({ to: "/chat" });
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TopBar step={step} onSkip={() => nav({ to: "/chat" })} />
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          {step === 0 && (
            <StepCard
              eyebrow="Step 1 of 3"
              title="Tell me about your business."
              subtitle="Just the essentials — I'll figure out the rest."
            >
              <Field label="Business name">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pluto Coffee Co."
                  className="h-12 text-base"
                />
              </Field>
              <Field label="What do you do?">
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="We roast single-origin beans in Brooklyn and ship subscriptions to home brewers nationwide."
                  className="text-base resize-none"
                />
              </Field>
              <Footer onNext={goStep1} canNext={name.trim().length > 1 && description.trim().length > 11} />
            </StepCard>
          )}

          {step === 1 && (
            <StepCard
              eyebrow="Step 2 of 3"
              title="Anything else I should know?"
              subtitle="Team, links, goals, anything off the top of your head. Or skip — I'll guess."
            >
              <Field label="Notes (optional)">
                <Textarea
                  autoFocus
                  rows={7}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="Co-founders: Ana (CEO, ana@plutocoffee.com), Theo (Ops). IG @plutocoffee. Goal: hit 1k subscribers by Q4."
                  className="text-base resize-none"
                />
              </Field>
              <Footer
                onBack={() => setStep(0)}
                onNext={runInference}
                nextLabel={extra.trim() ? "Continue" : "Skip — let AI guess"}
                busy={busy}
                busyLabel="Thinking…"
                icon={<Sparkles className="w-4 h-4" />}
              />
            </StepCard>
          )}

          {step === 2 && (
            <StepCard
              eyebrow="Step 3 of 3"
              title="Here's what I picked up."
              subtitle="You can edit anything in the knowledge base later."
            >
              <SummaryList
                rows={[
                  { k: "Name", v: name },
                  { k: "Tagline", v: inferred?.tagline },
                  { k: "Industry", v: inferred?.industry },
                  { k: "Audience", v: inferred?.target_audience },
                  { k: "Primary goal", v: inferred?.primary_goal },
                  { k: "Tone", v: inferred?.tone },
                  inferred?.value_props?.length
                    ? { k: "Value props", v: inferred.value_props.join(" · ") }
                    : null,
                ].filter(Boolean) as { k: string; v?: string }[]}
              />
              <Footer
                onBack={() => setStep(1)}
                onNext={launch}
                nextLabel="Launch Wynsa"
                busy={busy}
                busyLabel="Saving…"
                icon={<Check className="w-4 h-4" />}
              />
            </StepCard>
          )}
        </div>
      </main>
    </div>
  );
}

function TopBar({ step, onSkip }: { step: number; onSkip: () => void }) {
  return (
    <div className="border-b border-border/50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Wynsa · Onboarding</div>
        <div className="flex items-center gap-3">
          <Dots step={step} />
          <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function Dots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === step ? "w-6 bg-foreground" : i < step ? "w-1.5 bg-foreground/60" : "w-1.5 bg-foreground/15"
          }`}
        />
      ))}
    </div>
  );
}

function StepCard({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">{eyebrow}</div>
      <h1 className="text-3xl md:text-4xl font-serif tracking-tight leading-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-8 grid gap-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SummaryList({ rows }: { rows: { k: string; v?: string }[] }) {
  return (
    <div className="border border-border rounded-xl divide-y divide-border">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[120px_1fr] gap-4 px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground self-center">{r.k}</div>
          <div className="text-sm">{r.v || <span className="text-muted-foreground italic">—</span>}</div>
        </div>
      ))}
    </div>
  );
}

function Footer({
  onBack,
  onNext,
  canNext = true,
  nextLabel = "Next",
  busy = false,
  busyLabel = "Working…",
  icon,
}: {
  onBack?: () => void;
  onNext: () => void;
  canNext?: boolean;
  nextLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex items-center justify-between">
      {onBack ? (
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      ) : (
        <span />
      )}
      <Button onClick={onNext} disabled={!canNext || busy} className="h-11 px-6 rounded-full">
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {busyLabel}
          </>
        ) : (
          <>
            {nextLabel} {icon ?? <ArrowRight className="w-4 h-4 ml-1.5" />}
          </>
        )}
      </Button>
    </div>
  );
}
