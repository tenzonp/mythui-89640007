## Goals

1. Remove the "Websites" link from the main site header.
2. Move website generation out of its own page and into the chat agent as a tool. When a user says "build me a site for my coffee business," the AI itself generates the Next.js project, deploys it to Vercel, and returns both a downloadable ZIP and a live URL inside the chat message.
3. Allow the generated sites to pull from the open internet for images, icons, animations, and videos (Unsplash, Pexels, Lucide CDN, Lottiefiles, YouTube embeds, etc.) instead of being restricted to inline SVG/CSS only.
4. Expand onboarding into a real "business knowledge base" so Wynsa always has context about the user's business before answering — only asks follow-ups when something is genuinely missing.

## 1. Remove Websites nav entry

- `src/components/SiteChrome.tsx`: delete the `<Link to="/sites">Websites</Link>` entry from the header.
- Keep the `/sites` and `/sites/$siteId` routes available (they still work if visited directly) so the database/work already done isn't wasted, but they're no longer surfaced in nav.

## 2. Chat-driven website builder

New chat tool `build_website` exposed to the agent, defined in the chat server route:

```ts
build_website({
  name: string,        // 2–60 chars
  prompt: string,      // full creative brief, derived by the LLM from the conversation
  styleNotes?: string,
})
→ { siteId, liveUrl, zipUrl, files: [{path,bytes}] }
```

Implementation:

- New `src/lib/site-build.server.ts` that wraps the existing `generateSiteFiles` + `deployToVercel` flow, plus:
  - Packages the generated files into a ZIP (using `jszip`) and uploads it to the `artifacts` Supabase storage bucket under `sites/{userId}/{siteId}.zip`.
  - Returns a short-lived signed URL for the ZIP.
- Update `src/lib/site-generator.server.ts` system prompt:
  - Allow (and encourage) using real internet assets:
    - Images from `https://images.unsplash.com/...` and `https://images.pexels.com/...`
    - Icons via `lucide-react` (already in deps)
    - Animations: small inline Framer Motion + optional Lottie via `https://lottie.host/...`
    - Videos: YouTube/Vimeo iframes or `<video>` with public MP4 URLs
  - Drop the "no external image URLs" rule. Keep "no secrets / no env vars".
- In `src/routes/api/chat.ts` (or wherever the chat tools live), register `build_website` as an AI SDK `tool` whose `execute` calls the server-side wrapper, deducts credits, and persists a `user_sites` row exactly like the page-based flow does today.
- In the chat UI, render the tool result with a small "Website ready" card showing:
  - Live URL (open in new tab)
  - Download ZIP button (signed URL)
  - "Open project" link to `/sites/$siteId` for redeploys
- Toast/error states for AI rate limits (429), credits (402), and Vercel failures.

## 3. Business knowledge base

New durable per-user knowledge that the chat agent always loads.

Database (new migration):

- `business_profile` (one row per user)
  - `user_id uuid pk`, `name`, `tagline`, `description`, `industry`, `website`, `primary_goal`,
  - `tone`, `target_audience`, `value_props text[]`,
  - `onboarding_completed_at timestamptz`, timestamps.
- `business_team_members`
  - `id`, `user_id`, `name`, `role`, `email`, `phone`, `notes`, timestamps.
- `business_accounts`
  - `id`, `user_id`, `kind` (`gmail` | `instagram` | `x` | `linkedin` | `tiktok` | `youtube` | `phone` | `other`), `handle`, `url`, `notes`, timestamps.
- `business_knowledge_entries` (free-form facts: products, pricing, FAQs, internal policies)
  - `id`, `user_id`, `title`, `body`, `tags text[]`, timestamps.

All tables: RLS scoped to `auth.uid() = user_id`, GRANTs to `authenticated` + `service_role`, `updated_at` trigger.

Server functions (`src/lib/knowledge.functions.ts`):

- `getBusinessKnowledge()` — returns full bundle for current user.
- `upsertBusinessProfile(...)`, `addTeamMember`, `updateTeamMember`, `deleteTeamMember`, `addAccount`, `deleteAccount`, `addEntry`, `updateEntry`, `deleteEntry`.
- `getKnowledgeContext()` — server-only helper (used by chat route) that returns a compact markdown string suitable for the system prompt.

Onboarding flow (new `src/routes/_authenticated/onboarding.tsx`):

- Multi-step wizard:
  1. Business basics (name, tagline, what you do, industry, website)
  2. Audience & goals (target customers, primary goal, tone)
  3. Team (add members with role/email/phone)
  4. Accounts (Gmail, Instagram, X, LinkedIn, TikTok, YouTube, phone)
  5. Knowledge dump (free-form text → split into entries, plus quick-add list)
- "Skip for now" allowed at any step; sets `onboarding_completed_at` on finish or skip-final.
- Route gate: after sign-in, if `business_profile.onboarding_completed_at` is null, redirect to `/onboarding` from the authenticated layout. Existing users can revisit from a new `/knowledge` page to edit anytime.

Knowledge management page (`src/routes/_authenticated/knowledge.tsx`):

- Tabs: Business, Team, Accounts, Entries.
- CRUD on each via the server functions above.

Chat integration:

- In the chat server route, before calling the model, load `getKnowledgeContext(userId)` and prepend it to the system prompt as:
  ```
  ## Business knowledge base
  <markdown bundle>
  Use this context as ground truth. Only ask the user for details that are NOT present here.
  ```
- Also expose two read-only chat tools:
  - `lookup_knowledge({ query })` — fuzzy search across entries/team/accounts.
  - `record_knowledge({ title, body, tags? })` — let the AI persist new facts it learns mid-conversation (writes to `business_knowledge_entries`).

## 4. Cleanups

- Remove the "Websites" CTA card from `/dashboard` if present.
- Update home-page copy that mentioned "Websites" in the nav.
- Keep `/sites` reachable by direct link so existing sites remain manageable.

## Files touched (high-level)

- New: `supabase/migrations/<ts>_business_knowledge.sql`, `src/lib/site-build.server.ts`, `src/lib/knowledge.functions.ts`, `src/lib/knowledge.server.ts`, `src/routes/_authenticated/onboarding.tsx`, `src/routes/_authenticated/knowledge.tsx`, chat tool definitions.
- Edited: `src/components/SiteChrome.tsx`, `src/lib/site-generator.server.ts`, `src/routes/api/chat.ts`, `src/routes/_authenticated/route.tsx` (onboarding gate), chat message renderer for the website tool result.
- Dependency: add `jszip`.

## Open questions

1. ZIP delivery — happy with a signed Supabase Storage URL (expires in ~1h) embedded in the chat message, or do you want a permanent public link?
2. For "internet assets," should I allow `<video>` with arbitrary MP4 URLs, or restrict to YouTube/Vimeo embeds only (safer, no broken hotlinks)?
3. Onboarding: should it block first chat (forced wizard) or just nudge with a banner the user can dismiss?
