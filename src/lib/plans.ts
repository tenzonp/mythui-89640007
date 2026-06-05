// Shared plan + model constants used by client and server.
// We never expose underlying provider/model names in the UI.

export type PlanTier = "free" | "pro" | "everest";

export type WynsaModelId = "lady" | "yeti" | "mt";

export type WynsaModel = {
  id: WynsaModelId;
  name: string;
  effort: "Smart" | "Expert" | "Executive";
  blurb: string;
  baseCost: number; // credit weight multiplier
  allowedTiers: PlanTier[];
  // Internal — never shown to users.
  backendModel: string;
};

export const WYNSA_MODELS: WynsaModel[] = [
  {
    id: "lady",
    name: "Wynsa Lady",
    effort: "Smart",
    blurb: "Fast everyday assistant. Great for quick drafts and ideas.",
    baseCost: 1,
    allowedTiers: ["free", "pro", "everest"],
    backendModel: "google/gemini-2.5-flash",
  },
  {
    id: "yeti",
    name: "Wynsa Yeti",
    effort: "Expert",
    blurb: "Deeper reasoning for campaigns, analysis and longer work.",
    baseCost: 2,
    allowedTiers: ["pro", "everest"],
    backendModel: "openai/gpt-5-mini",
  },
  {
    id: "mt",
    name: "Wynsa Mt.",
    effort: "Executive",
    blurb: "Top-tier strategy, research and multi-step planning.",
    baseCost: 4,
    allowedTiers: ["pro", "everest"],
    backendModel: "openai/gpt-5",
  },
];

export const getWynsaModel = (id: string | undefined): WynsaModel =>
  WYNSA_MODELS.find((m) => m.id === id) ?? WYNSA_MODELS[0];

export const PLANS: Record<
  PlanTier,
  {
    id: PlanTier;
    name: string;
    priceLabel: string;
    monthlyCredits: number;
    dailyFreeCredits: number;
    blurb: string;
    perks: string[];
  }
> = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    monthlyCredits: 0,
    dailyFreeCredits: 100,
    blurb: "Try Mythmind with daily credits.",
    perks: [
      "100 credits every day",
      "Wynsa Lady model",
      "1 AI employee at a time",
      "Community support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "Free",
    monthlyCredits: 15000,
    dailyFreeCredits: 0,
    blurb: "Launch offer — grab it now.",
    perks: [
      "15,000 credits / month",
      "All Wynsa models (Lady, Yeti, Mt.)",
      "All 6 AI employees",
      "Web research + code sandbox",
      "Priority support",
    ],
  },
  everest: {
    id: "everest",
    name: "Everest",
    priceLabel: "$1.99",
    monthlyCredits: 40000,
    dailyFreeCredits: 0,
    blurb: "Just one tap away.",
    perks: [
      "40,000 credits / month",
      "All Wynsa models",
      "Multi-agent collaboration",
      "Deep research workflows",
      "Longer memory + faster execution",
      "Priority everything",
    ],
  },
};

export const planAllowsModel = (tier: PlanTier, modelId: WynsaModelId) =>
  getWynsaModel(modelId).allowedTiers.includes(tier);

// Complexity buckets used for hidden credit math.
export type Complexity = "quick" | "standard" | "deep" | "heavy" | "multi";
export const COMPLEXITY_WEIGHT: Record<Complexity, number> = {
  quick: 5,
  standard: 20,
  deep: 60,
  heavy: 150,
  multi: 300,
};

export const RESEARCH_BONUS = 20;
export const MULTI_AGENT_BONUS = 30;
export const FREE_USER_MIN_SPEND = 10;

/**
 * Estimate credits a turn will cost. Inputs come from observed tool calls +
 * token usage after the turn. For the pre-flight gate we just need a minimum.
 */
export function computeTurnCost(opts: {
  modelId: WynsaModelId;
  complexity: Complexity;
  usedResearch?: boolean;
  delegatedAgentCount?: number; // total agents involved including primary
  isFree?: boolean;
}) {
  const model = getWynsaModel(opts.modelId);
  const base = model.baseCost;
  const complexity = COMPLEXITY_WEIGHT[opts.complexity];
  let cost = base * complexity;
  if (opts.usedResearch) cost += RESEARCH_BONUS;
  const agents = Math.max(1, opts.delegatedAgentCount ?? 1);
  if (agents > 1) cost += (agents - 1) * MULTI_AGENT_BONUS;
  if (opts.isFree) cost = Math.max(cost, FREE_USER_MIN_SPEND);
  return Math.ceil(cost);
}

export const minTurnCost = (modelId: WynsaModelId, isFree: boolean) =>
  computeTurnCost({ modelId, complexity: "quick", isFree });
