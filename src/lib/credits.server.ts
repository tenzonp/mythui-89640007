// Server-only credit + plan helpers. Uses the admin client to bypass RLS
// for ledger writes and to grant credits.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  COMPLEXITY_WEIGHT,
  FREE_USER_MIN_SPEND,
  MULTI_AGENT_BONUS,
  PLANS,
  RESEARCH_BONUS,
  getWynsaModel,
  planAllowsModel,
  type Complexity,
  type PlanTier,
  type WynsaModelId,
} from "./plans";

export type UserPlanRow = {
  user_id: string;
  tier: PlanTier;
  monthly_credits: number;
  renews_at: string | null;
};

export async function getUserPlan(userId: string): Promise<UserPlanRow> {
  const { data } = await supabaseAdmin
    .from("user_plans")
    .select("user_id, tier, monthly_credits, renews_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as UserPlanRow;
  // Backfill safety: insert a free plan row if trigger somehow missed it.
  await supabaseAdmin
    .from("user_plans")
    .insert({ user_id: userId, tier: "free" })
    .select()
    .maybeSingle();
  return { user_id: userId, tier: "free", monthly_credits: 0, renews_at: null };
}

export async function getBalance(userId: string): Promise<number> {
  // Sum the ledger directly. (RPC is service_role-only.)
  const { data } = await supabaseAdmin
    .from("credit_ledger")
    .select("amount")
    .eq("user_id", userId);
  if (!data) return 0;
  return data.reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
}

/**
 * Mint daily credits for free users (idempotent per UTC date) and monthly
 * credits when the renew window has elapsed. Safe to call before every chat.
 */
export async function ensureGrants(userId: string, plan: UserPlanRow) {
  const planDef = PLANS[plan.tier];

  if (plan.tier === "free") {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabaseAdmin
      .from("daily_grants")
      .select("grant_date")
      .eq("user_id", userId)
      .eq("grant_date", today)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabaseAdmin.from("daily_grants").insert({
        user_id: userId,
        grant_date: today,
      });
      // If unique-violation, another request beat us — no double grant.
      if (!error) {
        await supabaseAdmin.from("credit_ledger").insert({
          user_id: userId,
          kind: "grant_daily",
          amount: planDef.dailyFreeCredits,
          meta: { date: today },
        });
      }
    }
    return;
  }

  // Paid plans: monthly grant on first call or after renews_at passed.
  const now = new Date();
  const renews = plan.renews_at ? new Date(plan.renews_at) : null;
  if (!renews || renews.getTime() <= now.getTime()) {
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + 30);
    await supabaseAdmin.from("credit_ledger").insert({
      user_id: userId,
      kind: "grant_monthly",
      amount: planDef.monthlyCredits,
      meta: { tier: plan.tier, granted_at: now.toISOString() },
    });
    await supabaseAdmin
      .from("user_plans")
      .update({
        monthly_credits: planDef.monthlyCredits,
        renews_at: next.toISOString(),
      })
      .eq("user_id", userId);
  }
}

export function inferComplexity(opts: {
  outputChars: number;
  toolCalls: number;
  delegatedAgents: number;
}): Complexity {
  const { outputChars, toolCalls, delegatedAgents } = opts;
  if (delegatedAgents >= 2) return "multi";
  if (toolCalls >= 6 || outputChars > 12_000) return "heavy";
  if (toolCalls >= 3 || outputChars > 4_000) return "deep";
  if (toolCalls >= 1 || outputChars > 800) return "standard";
  return "quick";
}

export function computeFinalCost(opts: {
  modelId: WynsaModelId;
  complexity: Complexity;
  usedResearch: boolean;
  delegatedAgents: number;
  isFree: boolean;
}) {
  const base = getWynsaModel(opts.modelId).baseCost;
  let cost = base * COMPLEXITY_WEIGHT[opts.complexity];
  if (opts.usedResearch) cost += RESEARCH_BONUS;
  if (opts.delegatedAgents > 1) cost += (opts.delegatedAgents - 1) * MULTI_AGENT_BONUS;
  if (opts.isFree) cost = Math.max(cost, FREE_USER_MIN_SPEND);
  return Math.ceil(cost);
}

export async function chargeTurn(opts: {
  userId: string;
  threadId?: string | null;
  modelId: WynsaModelId;
  agentId?: string;
  complexity: Complexity;
  amount: number;
  meta?: Record<string, any>;
}) {
  await supabaseAdmin.from("credit_ledger").insert({
    user_id: opts.userId,
    thread_id: opts.threadId ?? null,
    kind: "spend",
    amount: -Math.abs(opts.amount),
    model: opts.modelId,
    agent_id: opts.agentId ?? null,
    complexity: opts.complexity,
    meta: opts.meta ?? {},
  });
}

/**
 * Pre-flight gate: ensure user can use this model and has enough credits for
 * at least the minimum cost.
 */
export async function canStartTurn(opts: { userId: string; modelId: WynsaModelId }): Promise<
  | { ok: true; plan: UserPlanRow; balance: number; isFree: boolean }
  | { ok: false; reason: "plan_locked" | "insufficient_credits"; plan: UserPlanRow; balance: number }
> {
  const plan = await getUserPlan(opts.userId);
  if (!planAllowsModel(plan.tier, opts.modelId)) {
    const balance = await getBalance(opts.userId);
    return { ok: false, reason: "plan_locked", plan, balance };
  }
  await ensureGrants(opts.userId, plan);
  const balance = await getBalance(opts.userId);
  const isFree = plan.tier === "free";
  const min = computeFinalCost({
    modelId: opts.modelId,
    complexity: "quick",
    usedResearch: false,
    delegatedAgents: 1,
    isFree,
  });
  if (balance < min) {
    return { ok: false, reason: "insufficient_credits", plan, balance };
  }
  return { ok: true, plan, balance, isFree };
}
