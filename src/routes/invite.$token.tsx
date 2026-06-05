import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getInviteByToken, acceptInvite } from "@/lib/team.functions";
import { Check, Loader2, UserPlus, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Team invitation · Mythmind" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchInvite = useServerFn(getInviteByToken);
  const accept = useServerFn(acceptInvite);

  const [invite, setInvite] = useState<any>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchInvite({ data: { token } })
      .then((r) => setInvite(r.invite))
      .catch((e) => setError(e?.message ?? "Failed to load invite"))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  const onAccept = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/invite/${token}` } as any });
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      await accept({ data: { token } });
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not accept invite");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-background to-pink-50 px-4">
      <div className="w-full max-w-md bg-white border rounded-3xl shadow-xl p-8">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 mx-auto mb-4">
          <UserPlus className="w-7 h-7" />
        </div>
        <h1 className="font-serif text-2xl text-center">Team invitation</h1>

        {loadingInvite ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !invite ? (
          <div className="text-center text-sm text-muted-foreground mt-6">
            This invite link is invalid or has expired.
          </div>
        ) : done ? (
          <div className="text-center mt-6 space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600">
              <Check className="w-6 h-6" />
            </div>
            <div className="text-sm">
              You're in. Welcome to the team as <span className="font-medium">{invite.role}</span>.
            </div>
            <Link
              to="/chat"
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-violet text-white hover:bg-violet/90"
            >
              Go to chat <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-center text-muted-foreground">
              <span className="font-medium text-foreground">{invite.inviter.name}</span> invited you
              to join as <span className="font-medium text-foreground">{invite.role}</span>.
            </p>

            {invite.permissions?.length > 0 && (
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" /> Permissions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {invite.permissions.map((p: string) => (
                    <span key={p} className="text-[11px] px-2 py-0.5 rounded-full bg-white border">
                      {p.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {invite.status === "accepted" && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                This invite has already been accepted.
              </div>
            )}

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-2 text-center">
                {error}
              </div>
            )}

            <button
              onClick={onAccept}
              disabled={accepting || invite.status === "accepted"}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet text-white hover:bg-violet/90 disabled:opacity-50"
            >
              {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {loading
                ? "Loading…"
                : !user
                  ? "Sign in to accept"
                  : invite.status === "accepted"
                    ? "Already accepted"
                    : "Accept invitation"}
            </button>
            {!user && !loading && (
              <p className="text-[11px] text-center text-muted-foreground">
                You'll be redirected back here after sign in.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
