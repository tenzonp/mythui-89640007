// Composio v3 REST wrapper. Server-only.
import { createHash } from "crypto";

const BASE = "https://backend.composio.dev/api/v3";

export type FileUploadable = { name: string; mimetype: string; s3key: string };

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

const REQUIRED_SCOPES: Record<string, string[]> = {
  facebook: [
    "public_profile",
    "email",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "pages_manage_engagement",
    "pages_read_user_content",
    "pages_manage_metadata",
    "pages_messaging",
    "read_insights",
    "business_management",
  ],
};

function hasRequiredScopes(config: any, required: string[]) {
  if (!required.length) return true;
  const scopes = new Set((config?.credentials?.scopes ?? config?.auth_config?.scopes ?? []).map(String));
  return required.every((scope) => scopes.has(scope));
}

export async function getOrCreateManagedAuthConfig(toolkitSlug: string): Promise<string> {
  const requiredScopes = REQUIRED_SCOPES[toolkitSlug.toLowerCase()] ?? [];
  // Try existing managed auth config
  const list = await call<{ items: any[] }>(
    `/auth_configs?toolkit_slug=${encodeURIComponent(toolkitSlug)}&is_composio_managed=true&limit=20`,
  );
  const matching = (list.items ?? []).find((config) => hasRequiredScopes(config, requiredScopes));
  if (matching?.id) return matching.id;
  if (list.items?.[0]?.id && !requiredScopes.length) return list.items[0].id;
  // Create a managed one
  const created = await call<{ auth_config: { id: string } }>(`/auth_configs`, {
    method: "POST",
    body: JSON.stringify({
      toolkit: { slug: toolkitSlug },
      auth_config: {
        type: "use_composio_managed_auth",
        ...(requiredScopes.length ? { scopes: requiredScopes } : {}),
      },
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
  // Composio v3 /tools filters by a single `toolkit_slug`; iterate per toolkit.
  const all: ComposioTool[] = [];
  await Promise.all(
    toolkitSlugs.map(async (slug) => {
      const params = new URLSearchParams({
        toolkit_slug: slug,
        user_id: userId,
        limit: String(limit),
      });
      try {
        const res = await call<{ items: ComposioTool[] }>(`/tools?${params}`);
        for (const t of res.items ?? []) all.push(t);
      } catch (e) {
        console.error(`Composio tools fetch failed for ${slug}`, e);
      }
    }),
  );
  return { items: all };
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

export async function stageFileBufferForTool(args: {
  bytes: Uint8Array;
  filename: string;
  mimetype: string;
  toolSlug: string;
  toolkitSlug: string;
}): Promise<FileUploadable> {
  const fileArrayBuffer = args.bytes.buffer.slice(
    args.bytes.byteOffset,
    args.bytes.byteOffset + args.bytes.byteLength,
  ) as ArrayBuffer;
  const fileBuffer = Buffer.from(fileArrayBuffer);
  const md5 = createHash("md5").update(fileBuffer).digest("hex");
  const upload = await call<{
    key: string;
    new_presigned_url?: string;
    newPresignedUrl?: string;
    metadata?: { storage_backend?: "s3" | "azure_blob_storage" };
  }>(`/files/upload/request`, {
    method: "POST",
    body: JSON.stringify({
      md5,
      filename: args.filename,
      mimetype: args.mimetype,
      tool_slug: args.toolSlug,
      toolkit_slug: args.toolkitSlug,
    }),
  });
  const uploadUrl = upload.new_presigned_url || upload.newPresignedUrl;
  if (!upload.key || !uploadUrl) throw new Error("Composio did not return an upload URL");
  const headers: Record<string, string> = { "Content-Type": args.mimetype };
  if (upload.metadata?.storage_backend === "azure_blob_storage") {
    headers["x-ms-blob-type"] = "BlockBlob";
  }
  const uploadBody = new Blob([fileArrayBuffer], { type: args.mimetype });
  const res = await fetch(uploadUrl, { method: "PUT", headers, body: uploadBody });
  if (!res.ok) throw new Error(`Composio file upload failed (${res.status})`);
  return { name: args.filename, mimetype: args.mimetype, s3key: upload.key };
}
