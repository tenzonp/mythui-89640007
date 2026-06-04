import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanTier } from "./plans";

export const startDodoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tier: PlanTier }) => d)
  .handler(async ({ context, data }) => {
    if (data.tier === "free") throw new Error("Free plan does not require checkout");
    const { createDodoCheckout } = await import("./dodo.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();
    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const returnUrl = `${proto}://${host}/billing?status=success`;
    const { url } = await createDodoCheckout({
      tier: data.tier,
      userId: context.userId,
      email: profile?.email ?? `${context.userId}@users.mythmind.app`,
      returnUrl,
    });
    return { url };
  });


export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getUserPlan, getBalance, ensureGrants } = await import("./credits.server");
    const plan = await getUserPlan(context.userId);
    await ensureGrants(context.userId, plan);
    const balance = await getBalance(context.userId);
    const def = PLANS[plan.tier];
    return {
      tier: plan.tier,
      planName: def.name,
      priceLabel: def.priceLabel,
      monthlyCredits: def.monthlyCredits,
      dailyFreeCredits: def.dailyFreeCredits,
      balance,
      renewsAt: plan.renews_at,
    };
  });

export const getMyLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("credit_ledger")
      .select("id, kind, amount, model, agent_id, complexity, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { entries: data ?? [] };
  });

/**
 * Dev-only: switch the current user's plan tier without payment so the rest
 * of the system can be tested end-to-end. Triggers a monthly grant on the
 * next chat call via ensureGrants.
 */
export const devSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tier: PlanTier }) => d)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allowed = ["free", "pro", "everest"] as const;
    if (!allowed.includes(data.tier as any)) throw new Error("Invalid tier");
    // Resetting renews_at to now forces ensureGrants to mint fresh credits on
    // the very next chat call.
    await supabaseAdmin
      .from("user_plans")
      .update({ tier: data.tier, renews_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true };
  });
