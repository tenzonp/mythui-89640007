// Server-only helpers for the per-user business knowledge base.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type KnowledgeBundle = {
  profile: any | null;
  team: any[];
  accounts: any[];
  entries: any[];
};

export async function loadKnowledgeBundle(userId: string): Promise<KnowledgeBundle> {
  const [profile, team, accounts, entries] = await Promise.all([
    supabaseAdmin.from("business_profile").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("business_team_members").select("*").eq("user_id", userId).order("created_at"),
    supabaseAdmin.from("business_accounts").select("*").eq("user_id", userId).order("created_at"),
    supabaseAdmin
      .from("business_knowledge_entries")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);
  return {
    profile: profile.data ?? null,
    team: team.data ?? [],
    accounts: accounts.data ?? [],
    entries: entries.data ?? [],
  };
}

/**
 * Render the user's knowledge bundle as compact markdown for the chat
 * system prompt. Returns "" if nothing is known yet.
 */
export function renderKnowledgeContext(bundle: KnowledgeBundle): string {
  const p = bundle.profile;
  const lines: string[] = [];
  if (p) {
    lines.push("## Business profile");
    if (p.name) lines.push(`- Name: ${p.name}`);
    if (p.tagline) lines.push(`- Tagline: ${p.tagline}`);
    if (p.industry) lines.push(`- Industry: ${p.industry}`);
    if (p.website) lines.push(`- Website: ${p.website}`);
    if (p.description) lines.push(`- What they do: ${p.description}`);
    if (p.target_audience) lines.push(`- Target audience: ${p.target_audience}`);
    if (p.primary_goal) lines.push(`- Primary goal: ${p.primary_goal}`);
    if (p.tone) lines.push(`- Brand tone: ${p.tone}`);
    if (Array.isArray(p.value_props) && p.value_props.length) {
      lines.push(`- Value props: ${p.value_props.filter(Boolean).join("; ")}`);
    }
  }
  if (bundle.team.length) {
    lines.push("\n## Team");
    for (const t of bundle.team) {
      const bits = [t.name, t.role && `(${t.role})`, t.email && `<${t.email}>`, t.phone && `📞 ${t.phone}`]
        .filter(Boolean)
        .join(" ");
      lines.push(`- ${bits}${t.notes ? ` — ${t.notes}` : ""}`);
    }
  }
  if (bundle.accounts.length) {
    lines.push("\n## Accounts & channels");
    for (const a of bundle.accounts) {
      const bits = [
        a.kind?.toUpperCase(),
        a.handle && `@${a.handle.replace(/^@/, "")}`,
        a.url && `(${a.url})`,
      ]
        .filter(Boolean)
        .join(" ");
      lines.push(`- ${bits}${a.notes ? ` — ${a.notes}` : ""}`);
    }
  }
  if (bundle.entries.length) {
    lines.push("\n## Knowledge entries");
    for (const e of bundle.entries.slice(0, 30)) {
      lines.push(`### ${e.title}${Array.isArray(e.tags) && e.tags.length ? ` [${e.tags.join(", ")}]` : ""}`);
      lines.push(String(e.body).slice(0, 1200));
    }
  }
  return lines.join("\n");
}

export async function getKnowledgeContext(userId: string): Promise<string> {
  const bundle = await loadKnowledgeBundle(userId);
  return renderKnowledgeContext(bundle);
}

export async function searchKnowledge(userId: string, query: string) {
  const bundle = await loadKnowledgeBundle(userId);
  const q = query.toLowerCase();
  const hits: { kind: string; title: string; body: string }[] = [];
  if (bundle.profile) {
    const blob = JSON.stringify(bundle.profile).toLowerCase();
    if (blob.includes(q)) hits.push({ kind: "profile", title: "Business profile", body: JSON.stringify(bundle.profile, null, 2) });
  }
  for (const t of bundle.team) {
    if (JSON.stringify(t).toLowerCase().includes(q))
      hits.push({ kind: "team", title: t.name, body: `${t.role ?? ""} — ${t.email ?? ""} — ${t.phone ?? ""} ${t.notes ?? ""}` });
  }
  for (const a of bundle.accounts) {
    if (JSON.stringify(a).toLowerCase().includes(q))
      hits.push({ kind: "account", title: `${a.kind} ${a.handle ?? ""}`, body: `${a.url ?? ""} ${a.notes ?? ""}` });
  }
  for (const e of bundle.entries) {
    if (
      e.title.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q) ||
      (e.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
    ) {
      hits.push({ kind: "entry", title: e.title, body: e.body });
    }
  }
  return hits.slice(0, 12);
}

export async function recordKnowledgeEntry(userId: string, title: string, body: string, tags?: string[]) {
  const { data, error } = await supabaseAdmin
    .from("business_knowledge_entries")
    .insert({ user_id: userId, title, body, tags: tags ?? [], source: "chat" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
