// Server-only Vercel deployment helper. Uses VERCEL_TOKEN to deploy
// inline file projects via the v13 deployments API.

type DeployFile = { file: string; data: string; encoding?: "utf-8" | "base64" };

export async function deployToVercel(opts: {
  name: string;
  files: { path: string; content: string }[];
  framework?: string;
}): Promise<{ url: string; deploymentId: string; projectId?: string }> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not configured");

  // Normalize project name to vercel-safe slug
  const slug =
    opts.name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `site-${Date.now()}`;

  const files: DeployFile[] = opts.files.map((f) => ({
    file: f.path.replace(/^\/+/, ""),
    data: f.content,
    encoding: "utf-8",
  }));

  const body = {
    name: slug,
    files,
    target: "production",
    projectSettings: {
      framework: opts.framework ?? "nextjs",
    },
  };

  const res = await fetch("https://api.vercel.com/v13/deployments?forceNew=1", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Vercel deploy failed: ${res.status} ${text.slice(0, 600)}`);
  }
  const json = JSON.parse(text);
  const host = json.url ?? json.alias?.[0];
  if (!host) throw new Error("Vercel did not return a URL");
  return {
    url: host.startsWith("http") ? host : `https://${host}`,
    deploymentId: json.id,
    projectId: json.projectId,
  };
}
