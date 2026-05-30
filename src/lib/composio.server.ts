// Composio v3 REST wrapper. Server-only.
const BASE = "https://backend.composio.dev/api/v3";

function key() {
  const k = process.env.COMPOSIO_API_KEY;
  if (!k) throw new Error("Missing COMPOSIO_API_KEY");
  return k;
}

async function call<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": key(),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Composio ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

export type Toolkit = {
  slug: string;
  name: string;
  meta?: { description?: string; logo?: string; categories?: { name: string }[] };
  no_auth?: boolean;
};

export async function listToolkits(opts: { search?: string; limit?: number; cursor?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  params.set("limit", String(opts.limit ?? 50));
  if (opts.cursor) params.set("cursor", opts.cursor);
  return call<{ items: Toolkit[]; next_cursor?: string }>(`/toolkits?${params}`);
}

export async function getOrCreateManagedAuthConfig(toolkitSlug: string): Promise<string> {
  // Try existing managed auth config
  const list = await call<{ items: any[] }>(
    `/auth_configs?toolkit_slug=${encodeURIComponent(toolkitSlug)}&is_composio_managed=true&limit=1`,
  );
  if (list.items?.[0]?.id) return list.items[0].id;
  // Create a managed one
  const created = await call<{ auth_config: { id: string } }>(`/auth_configs`, {
    method: "POST",
    body: JSON.stringify({
      toolkit: { slug: toolkitSlug },
      auth_config: { type: "use_composio_managed_auth" },
    }),
  });
  return created.auth_config.id;
}

export async function initiateConnection(args: {
  userId: string;
  toolkitSlug: string;
  callbackUrl: string;
}) {
  const authConfigId = await getOrCreateManagedAuthConfig(args.toolkitSlug);
  const res = await call<{
    id?: string;
    connected_account_id?: string;
    status?: string;
    redirect_url?: string;
    redirect_uri?: string;
    connection_data?: { val?: { redirectUrl?: string } };
  }>(`/connected_accounts/link`, {
    method: "POST",
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_id: args.userId,
      callback_url: args.callbackUrl,
    }),
  });
  return {
    id: (res.connected_account_id || res.id) as string,
    status: res.status ?? "INITIATED",
    redirectUrl:
      res.redirect_url ||
      res.redirect_uri ||
      res.connection_data?.val?.redirectUrl,
  };
}

export async function getConnectedAccount(id: string) {
  return call<{ id: string; status: string; toolkit?: { slug: string } }>(`/connected_accounts/${id}`);
}

export async function listConnectedAccounts(userId: string) {
  const params = new URLSearchParams({ user_ids: userId, limit: "100" });
  return call<{ items: any[] }>(`/connected_accounts?${params}`);
}

export async function deleteConnectedAccount(id: string) {
  return call(`/connected_accounts/${id}`, { method: "DELETE" });
}

export type ComposioTool = {
  slug: string;
  name: string;
  description?: string;
  input_parameters?: any;
  toolkit?: { slug: string };
};

export async function listToolsForToolkits(userId: string, toolkitSlugs: string[], limit = 30) {
  if (!toolkitSlugs.length) return { items: [] as ComposioTool[] };
  const params = new URLSearchParams({
    toolkit_slugs: toolkitSlugs.join(","),
    user_id: userId,
    limit: String(limit),
  });
  return call<{ items: ComposioTool[] }>(`/tools?${params}`);
}

export async function executeTool(slug: string, userId: string, args: any) {
  return call<{ data?: any; error?: any; successful?: boolean }>(
    `/tools/execute/${encodeURIComponent(slug)}`,
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId, arguments: args }),
    },
  );
}
