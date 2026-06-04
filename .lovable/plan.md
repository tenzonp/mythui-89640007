# Wynsa Models + Plans + Credits

## 1. Models (Wynsa branding, hidden GPT/Gemini under the hood)

Replace the agent dropdown in the chat top bar with a model picker:

| User-facing | Backend model            | Plan access            | Effort label |
|-------------|--------------------------|------------------------|--------------|
| Wynsa Lady  | google/gemini-2.5-flash  | Free, Pro, Everest     | Smart        |
| Wynsa Yeti  | openai/gpt-5-mini        | Pro, Everest           | Expert       |
| Wynsa Mt.   | openai/gpt-5             | Pro, Everest           | Executive    |

- Locked tiers show a lock icon + "Upgrade" hover state.
- Agent selection (Lin/Reyes/Vale/…) moves to a small chevron next to the model — same dropdown UX but a separate field. Keeps existing agent-routing logic intact.

## 2. Plans

| Plan    | Price        | Monthly credits | Daily free credits | Notes                       |
|---------|--------------|-----------------|--------------------|-----------------------------|
| Free    | $0           | —               | 100 / day          | Lady only                   |
| Pro     | $29 / mo     | 15,000          | —                  | Lady + Yeti + Mt.           |
| Everest | $99 / mo     | 40,000          | —                  | All models + priority + multi-agent |

## 3. Credit system (complexity-weighted, hidden model cost)

Credits charged per assistant turn using:

```
credits = base(model) × complexity(turn) × time_factor + research_bonus + (agents − 1) × multi_agent_bonus
```

- `base(model)`: Lady=1, Yeti=2, Mt.=4
- `complexity`: derived from output token count + tool-call count (5/20/60/150/300 buckets → Quick/Standard/Deep/Heavy/Multi)
- `research_bonus`: +20 if firecrawl/web_search tool used
- `multi_agent_bonus`: +30 per additional employee delegated to
- Free users: minimum 10 credits per turn (so 100/day ≈ ~10 meaningful tasks, prevents abuse).

Charged **after** the assistant turn completes, in a single ledger insert. Insufficient balance → soft block with upgrade CTA before the turn starts (estimate = base × 10 floor).

UI shows only an **Effort meter** (Basic/Smart/Expert/Executive) — never a token count.

## 4. Database (new migration)

```sql
-- Plans / subscriptions
create type public.plan_tier as enum ('free','pro','everest');
create table public.user_plans (
  user_id uuid primary key references auth.users on delete cascade,
  tier plan_tier not null default 'free',
  monthly_credits int not null default 0,
  renews_at timestamptz,
  dodo_subscription_id text,
  updated_at timestamptz not null default now()
);

-- Credit ledger (append-only)
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  thread_id uuid references public.threads on delete set null,
  kind text not null check (kind in ('grant_monthly','grant_daily','spend','refund','adjust')),
  amount int not null,           -- positive = credit, negative = spend
  model text,
  agent_id text,
  complexity text,               -- 'quick'|'standard'|'deep'|'heavy'|'multi'
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.credit_ledger (user_id, created_at desc);

-- Daily free-credit anchor (so we know when to mint new 100)
create table public.daily_grants (
  user_id uuid not null references auth.users on delete cascade,
  grant_date date not null,
  primary key (user_id, grant_date)
);
```

All three get GRANTs + RLS scoped to `auth.uid()`. A SECURITY DEFINER function `get_balance(uid)` returns `sum(amount)` from the ledger.

## 5. Server functions / routes

- `getMyPlan()` → plan tier, balance, daily grant info.
- `pickModel({ modelId })` → validates user is allowed for tier.
- `/api/chat` (existing): before streaming, call `ensureGrants(userId)` (mints daily 100 for free users if today missing, mints monthly on plan-renews_at flip). Then estimate min cost, return 402 if insufficient. After stream completes, compute final credits and insert spend row.
- `/api/public/dodo/webhook` — verifies Dodo signature, handles `subscription.created/renewed/cancelled` → updates `user_plans` + mints monthly grant.

## 6. UI changes

- **Top bar (chat)**: model picker (3 tiles in dropdown with Effort label, locks on gated tiers) + small agent picker.
- **Right sidebar**: replace progress with **Credits** card — balance, plan tier badge, "Upgrade" button when free.
- **New `/billing` route**: shows current plan, balance, ledger (last 30), three plan cards with Upgrade buttons → Dodo checkout link.
- **Settings entry** in left rail renamed to "Plan & Billing".

## 7. Dodo Payments

Dodo isn't a Lovable built-in. To go live we need:
- `DODO_API_KEY` and `DODO_WEBHOOK_SECRET` (I'll request via `add_secret`).
- Three product/price IDs (Pro monthly, Everest monthly) created in Dodo dashboard — user pastes IDs.

Until those are provided, the Upgrade buttons hit a stub that toggles the tier in dev so the rest is testable end-to-end. The webhook handler ships in this change so flipping the live key just works.

## 8. Out of scope for this turn

- Annual plans / proration.
- Team seats.
- In-app credit purchases (top-ups).
- Per-agent credit limits.

---

**Files touched (≈11)**

- `supabase/migrations/<new>.sql`
- `src/lib/plans.ts` (shared constants: models, plans, pricing)
- `src/lib/credits.server.ts` (estimate/charge/grant helpers)
- `src/lib/credits.functions.ts` (getMyPlan, getLedger)
- `src/lib/dodo.server.ts`
- `src/routes/api/chat.ts` (credit gate + post-turn charge)
- `src/routes/api/public/dodo/webhook.ts` (new)
- `src/routes/chat.$threadId.tsx` (model picker, hide agent select behind chevron)
- `src/routes/chat.tsx` (sidebar: Credits card)
- `src/routes/billing.tsx` (new)
- `src/data/agents.ts` (effort labels, untouched names)

If this looks right I'll start with the migration + plans constants + UI, then layer the credit engine and Dodo last. **Confirm or tell me what to change** (e.g. pricing, model mapping, skip Dodo for now).
