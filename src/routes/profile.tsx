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

        {/* Team */}
        <TeamSection />
      </div>
    </div>
  );
}

const PERMISSION_OPTIONS = [
  { id: "view", label: "View" },
  { id: "edit_knowledge", label: "Edit knowledge" },
  { id: "manage_sites", label: "Manage sites" },
  { id: "manage_team", label: "Manage team" },
  { id: "send_messages", label: "Send messages" },
];

function TeamSection() {
  const fetchTeam = useServerFn(listTeam);
  const invite = useServerFn(inviteTeamMember);
  const remove = useServerFn(removeTeamMember);
  const resend = useServerFn(resendInviteSms);
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Staff");
  const [phone, setPhone] = useState("");
  const [perms, setPerms] = useState<string[]>(["view"]);
  const [busy, setBusy] = useState(false);

  const reload = () => fetchTeam().then((r) => setMembers(r.members)).catch(() => {});
  useEffect(() => { reload(); }, []);

  const togglePerm = (p: string) =>
    setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const doInvite = async (sendSms: boolean) => {
    if (!name.trim() || !role.trim() || perms.length === 0) {
      toast.error("Name, role, and at least one permission are required");
      return;
    }
    if (sendSms && !phone.trim()) {
      toast.error("Phone number required to send SMS");
      return;
    }
    setBusy(true);
    try {
      const r = await invite({
        data: {
          name: name.trim(),
          role: role.trim(),
          phone: phone.trim(),
          permissions: perms as any,
          sendSms,
          origin: window.location.origin,
        },
      });
      if (sendSms) {
        if (r.sms?.ok) toast.success("Invite sent via SMS");
        else toast.error(`SMS failed: ${r.sms?.error ?? "unknown"}. Link copied instead.`);
        await navigator.clipboard.writeText(r.link).catch(() => {});
      } else {
        await navigator.clipboard.writeText(r.link).catch(() => {});
        toast.success("Invite link copied to clipboard");
      }
      setName(""); setPhone(""); setRole("Staff"); setPerms(["view"]); setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to invite");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };

  return (
    <div className="bg-white border rounded-2xl p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Users className="w-4 h-4" /> Team
        </h2>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-violet text-white hover:bg-violet/90"
        >
          <UserPlus className="w-4 h-4" /> Invite
        </button>
      </div>

      {open && (
        <div className="border rounded-xl p-4 mb-4 bg-muted/30 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Member name"
              className="px-3 py-2 rounded-lg border bg-white text-sm"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role (e.g. Manager, Staff)"
              className="px-3 py-2 rounded-lg border bg-white text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (e.g. 98XXXXXXXX) — required for SMS"
              className="px-3 py-2 rounded-lg border bg-white text-sm sm:col-span-2"
            />
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Permissions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PERMISSION_OPTIONS.map((p) => {
                const on = perms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePerm(p.id)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition",
                      on ? "bg-violet text-white border-violet" : "bg-white hover:bg-accent",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => doInvite(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send via SMS (Aakash)
            </button>
            <button
              onClick={() => doInvite(false)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border bg-white hover:bg-accent disabled:opacity-50"
            >
              <Copy className="w-4 h-4" /> Copy invite link
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-sm px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          No team members yet. Invite teammates to collaborate.
        </div>
      ) : (
        <div className="divide-y">
          {members.map((m) => (
            <div key={m.id} className="py-3 flex items-center gap-3 text-sm">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 text-white flex items-center justify-center text-sm font-medium shrink-0">
                {(m.name ?? "?")[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {m.name} <span className="text-xs text-muted-foreground font-normal">· {m.role}</span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  {m.phone && <span>{m.phone}</span>}
                  {m.permissions?.length > 0 && (
                    <span className="truncate">· {m.permissions.join(", ").replace(/_/g, " ")}</span>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "text-[10.5px] px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                  m.status === "accepted"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700",
                )}
              >
                {m.status === "accepted" ? <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> joined</span> : "pending"}
              </span>
              {m.status !== "accepted" && m.invite_token && (
                <>
                  <button
                    onClick={() => copyLink(m.invite_token)}
                    title="Copy invite link"
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {m.phone && (
                    <button
                      onClick={async () => {
                        const r = await resend({ data: { id: m.id, origin: window.location.origin } });
                        if (r.ok) toast.success("SMS resent");
                        else toast.error(r.error ?? "SMS failed");
                      }}
                      title="Resend SMS"
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
              <button
                onClick={async () => {
                  if (!confirm(`Remove ${m.name}?`)) return;
                  await remove({ data: { id: m.id } });
                  reload();
                }}
                title="Remove"
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
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
