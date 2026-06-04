import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlan, getMyLedger, devSetPlan, startDodoCheckout } from "@/lib/credits.functions";
import { PLANS, type PlanTier } from "@/lib/plans";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Plan & Billing · Mythmind" }] }),
  component: BillingPage,
});

function BillingPage() {
  const fetchPlan = useServerFn(getMyPlan);
  const fetchLedger = useServerFn(getMyLedger);
  const switchPlan = useServerFn(devSetPlan);
  const checkout = useServerFn(startDodoCheckout);
  const [plan, setPlan] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  const refresh = () => {
    fetchPlan().then(setPlan).catch(() => {});
    fetchLedger().then((r) => setEntries(r.entries)).catch(() => {});
  };
  useEffect(refresh, []);

  const upgrade = async (tier: PlanTier) => {
    if (tier === "free") {
      try {
        await switchPlan({ data: { tier } });
        toast.success("Downgraded to Free");
        refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed");
      }
      return;
    }
    setLoadingTier(tier);
    try {
      const { url } = await checkout({ data: { tier } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
      setLoadingTier(null);
    }
  };


  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link to="/chat" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to chat
        </Link>
        <h1 className="font-serif text-3xl mb-1">Plan & Billing</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Choose how much horsepower your AI team gets each month.
        </p>

        {plan && (
          <div className="bg-white border rounded-2xl p-5 mb-8 flex items-center gap-6">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</div>
              <div className="text-xl font-semibold mt-0.5">{plan.planName}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {plan.tier === "free"
                  ? `${plan.dailyFreeCredits} free credits every day`
                  : `${plan.monthlyCredits.toLocaleString()} credits / month`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Balance</div>
              <div className="text-2xl font-semibold text-violet flex items-center gap-1 justify-end">
                <Sparkles className="w-4 h-4" /> {plan.balance.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {(["free", "pro", "everest"] as PlanTier[]).map((t) => {
            const p = PLANS[t];
            const current = plan?.tier === t;
            return (
              <div
                key={t}
                className={cn(
                  "bg-white border rounded-2xl p-5 flex flex-col",
                  current && "ring-2 ring-violet border-violet",
                  t === "everest" && "bg-gradient-to-b from-violet/5 to-white",
                )}
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.name}</div>
                <div className="text-2xl font-semibold mt-1">{p.priceLabel}</div>
                <div className="text-xs text-muted-foreground mt-1 mb-4">{p.blurb}</div>
                <ul className="space-y-1.5 text-[13px] flex-1">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <Check className="w-4 h-4 text-violet shrink-0 mt-0.5" /> {perk}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={current || loadingTier === t}
                  onClick={() => upgrade(t)}
                  className={cn(
                    "mt-4 w-full py-2 rounded-lg text-sm font-medium",
                    current
                      ? "bg-muted text-muted-foreground cursor-default"
                      : t === "free"
                        ? "border hover:bg-accent"
                        : "bg-violet text-white hover:bg-violet/90",
                  )}
                >
                  {current
                    ? "Current plan"
                    : loadingTier === t
                      ? "Redirecting…"
                      : t === "free"
                        ? "Downgrade"
                        : `Upgrade to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground mb-2">
          Secure payments by Dodo. Subscriptions activate instantly after checkout.
        </div>


        <h2 className="font-semibold text-lg mb-3 mt-8">Recent activity</h2>
        <div className="bg-white border rounded-2xl divide-y">
          {entries.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No activity yet.</div>
          )}
          {entries.map((e) => (
            <div key={e.id} className="px-4 py-2.5 flex items-center text-[13px]">
              <div className="flex-1">
                <div className="font-medium">
                  {e.kind === "spend"
                    ? `${e.model ?? "model"} · ${e.complexity ?? ""}`
                    : e.kind.replace("_", " ")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </div>
              </div>
              <div
                className={cn(
                  "tabular-nums font-medium",
                  e.amount >= 0 ? "text-emerald-600" : "text-foreground",
                )}
              >
                {e.amount >= 0 ? `+${e.amount}` : e.amount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
