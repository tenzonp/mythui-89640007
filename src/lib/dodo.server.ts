// Dodo Payments helpers (server-only).
// Docs: https://docs.dodopayments.com

import { PLANS, type PlanTier } from "./plans";

const DODO_API_BASE = "https://live.dodopayments.com";

export function getDodoProductId(tier: PlanTier): string | null {
  if (tier === "pro") return process.env.DODO_PRO_PRODUCT_ID ?? null;
  if (tier === "everest") return process.env.DODO_EVEREST_PRODUCT_ID ?? null;
  return null;
}

export async function createDodoCheckout(opts: {
  tier: PlanTier;
  userId: string;
  email: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const apiKey = process.env.DODO_API_KEY;
  if (!apiKey) throw new Error("DODO_API_KEY not configured");
  const productId = getDodoProductId(opts.tier);
  if (!productId) throw new Error(`No Dodo product configured for ${opts.tier}`);

  const res = await fetch(`${DODO_API_BASE}/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      product_id: productId,
      quantity: 1,
      payment_link: true,
      return_url: opts.returnUrl,
      customer: { email: opts.email, name: opts.email.split("@")[0] },
      metadata: { user_id: opts.userId, tier: opts.tier },
      billing: { country: "US", state: "", city: "", street: "", zipcode: "" },
    }),

  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dodo checkout failed: ${res.status} ${text}`);
  }
  const data: any = await res.json();
  const url = data.payment_link ?? data.url ?? data.checkout_url;
  if (!url) throw new Error("Dodo did not return a payment link");
  return { url };
}

export function tierFromProductId(productId: string | undefined | null): PlanTier | null {
  if (!productId) return null;
  if (productId === process.env.DODO_PRO_PRODUCT_ID) return "pro";
  if (productId === process.env.DODO_EVEREST_PRODUCT_ID) return "everest";
  return null;
}

export function monthlyCreditsFor(tier: PlanTier) {
  return PLANS[tier].monthlyCredits;
}
