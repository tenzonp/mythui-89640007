import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyPlan, getMyLedger } from "@/lib/credits.functions";
import { PLANS, WYNSA_MODELS } from "@/lib/plans";
import { ArrowLeft, Sparkles, CreditCard, LogOut, User, UserPlus, Users, Copy, Send, Trash2, Check, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { listTeam, inviteTeamMember, removeTeamMember, resendInviteSms } from "@/lib/team.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · Mythmind" }] }),
  component: ProfilePage,
});

function modelLabel(id?: string | null) {
  if (!id) return "—";
  const m = WYNSA_MODELS.find((x) => x.backendModel === id || x.id === id);
  return m?.name ?? id;
}

function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const fetchPlan = useServerFn(getMyPlan);
  const fetchLedger = useServerFn(getMyLedger);
  const [plan, setPlan] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    fetchPlan().then(setPlan).catch(() => {});
    fetchLedger().then((r) => setEntries(r.entries)).catch(() => {});
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  const name = user.email?.split("@")[0] ?? "User";
  const initial = name[0]?.toUpperCase() ?? "U";
  const planDef = plan ? PLANS[plan.tier as keyof typeof PLANS] : null;
  const spends = entries.filter((e) => e.kind === "spend");
  const todaySpend = spends
    .filter((e) => new Date(e.created_at).toDateString() === new Date().toDateString())
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const monthSpend = spends
    .filter((e) => {
      const d = new Date(e.created_at);
      const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    })
    .reduce((s, e) => s + Math.abs(e.amount), 0);

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link
          to="/chat"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to chat
        </Link>

        {/* Profile header */}
        <div className="bg-white border rounded-2xl p-6 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-2xl font-semibold">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-2xl capitalize">{name}</h1>
            <div className="text-sm text-muted-foreground truncate">{user.email}</div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-accent"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>

        {/* Plan + Billing */}
        {plan && planDef && (
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Current plan
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-2xl font-semibold">{planDef.name}</div>
                  <span className="text-sm text-muted-foreground">{planDef.priceLabel}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{planDef.blurb}</div>
              </div>
              <Link
                to="/billing"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-violet text-white hover:bg-violet/90"
              >
                <CreditCard className="w-4 h-4" />
                {plan.tier === "free" ? "Upgrade plan" : "Manage billing"}
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-5">
              <Stat
                label="Balance"
                value={plan.balance.toLocaleString()}
                icon={<Sparkles className="w-4 h-4 text-violet" />}
              />
              <Stat
                label={plan.tier === "free" ? "Daily allowance" : "Monthly allowance"}
                value={(plan.tier === "free"
                  ? plan.dailyFreeCredits
                  : plan.monthlyCredits
                ).toLocaleString()}
              />
              <Stat
                label={plan.tier === "free" ? "Spent today" : "Spent this month"}
                value={(plan.tier === "free" ? todaySpend : monthSpend).toLocaleString()}
              />
            </div>
          </div>
        )}

        {/* Per-turn usage */}
        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Per-turn credit usage</h2>
            <span className="text-xs text-muted-foreground">{entries.length} entries</span>
          </div>
          {entries.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              No activity yet. Start a chat to see your credit usage broken down per task.
            </div>
          ) : (
            <div className="divide-y">
              {entries.map((e) => (
                <div key={e.id} className="py-2.5 flex items-center text-sm">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mr-3 shrink-0",
                      e.kind === "spend"
                        ? "bg-violet"
                        : e.kind.startsWith("grant")
                          ? "bg-emerald-500"
                          : "bg-muted-foreground",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {e.kind === "spend"
                        ? `${modelLabel(e.model)} · ${e.complexity ?? "turn"}`
                        : e.kind === "grant_daily"
                          ? "Daily free credits"
                          : e.kind === "grant_monthly"
                            ? "Monthly plan credits"
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
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums mt-1 flex items-center gap-1">
        {icon}
        {value}
      </div>
    </div>
  );
}
