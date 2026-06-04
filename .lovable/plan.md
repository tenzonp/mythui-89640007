## Scope

Three features in one batch. Iscilla Technologies / iscillatechnologies@gmail.com / Nepal as legal entity.

### 1. Legal pages
- `/terms` and `/privacy` routes — full content for SaaS (accounts, payments via Dodo, AI usage, cookies, data retention, Nepal jurisdiction, contact email).
- Footer links added to `SiteChrome`.

### 2. Admin support system (`/grow/admin`)
- Migration: `app_role` enum (`admin`, `moderator`, `user`), `user_roles` table, `has_role()` security-definer fn, `support_tickets` table (id, user_id, subject, status, priority, created_at), `ticket_messages` table (id, ticket_id, sender_id, body, created_at) + RLS + GRANTs.
- User-facing `/support` route: list own tickets, create new, reply thread.
- Admin route `/grow/admin`: gated by `has_role(uid,'admin')` — ticket inbox, filter by status, open ticket detail, reply as staff, change status/priority, basic user lookup (email → tickets + plan + credits).
- Realtime updates via Supabase channels on `ticket_messages`.
- You'll seed your own admin role manually (I'll provide one-line SQL after migration).

### 3. AI website builder + Vercel deploy
- New secret: `VERCEL_TOKEN` (your token; sites deploy under your Vercel account).
- Migration: `user_sites` table (id, user_id, name, prompt, files jsonb, vercel_project_id, deployment_url, status, created_at).
- `/sites` route — list user sites + "Create new site" form (name + freeform prompt + style notes).
- Server fn `generateSite`: calls Lovable AI Gateway (Gemini Pro) with a structured prompt that returns JSON `{ files: [{path, content}] }` for a **Next.js 14 app-router project** (package.json, app/layout.tsx, app/page.tsx, components/*, tailwind config, etc.). Charges credits (heavy tier).
- Server fn `deploySite`: POSTs files to `https://api.vercel.com/v13/deployments` with `projectSettings: { framework: 'nextjs' }`. Saves returned URL (`https://<name>-<hash>.vercel.app`) to `user_sites.deployment_url`.
- `/sites/$siteId` detail page: file tree preview, live URL button, "Regenerate" and "Redeploy" actions.
- Cost: 1000 credits per generate, 200 per redeploy (configurable).

### Technical notes
- Vercel v13 deployments accept inline file uploads (`files: [{file, data, encoding}]`) — no git required. Each deploy creates a new immutable URL; we store the latest.
- AI is prompted to keep projects small (<25 files) so the JSON fits within model output limits. Larger projects can be iterated via follow-up "edit site" prompts later.
- All Vercel calls happen server-side via `process.env.VERCEL_TOKEN`; token never touches client.
- Admin gate uses `requireSupabaseAuth` middleware + `has_role` RPC check inside each admin server fn.

### Out of scope (call out for follow-up)
- Per-user Vercel accounts (sites deploy under your team for now).
- Custom domains on generated sites.
- Live in-browser site editor (only regenerate from new prompt this round).
- Ticket email notifications.
