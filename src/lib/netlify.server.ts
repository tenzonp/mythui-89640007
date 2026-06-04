// Server-only Netlify deployment helper. Uses NETLIFY_AUTH_TOKEN to deploy a
// pre-built static site via a ZIP upload. Fast path: create a site, POST the
// ZIP to its deploys endpoint, poll until ready.

import JSZip from "jszip";

export type DeployFile = { path: string; content: string };

async function zipFiles(files: DeployFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.path.replace(/^\/+/, ""), f.content);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 7);
  return (base || "site") + "-" + rand;
}

export async function deployToNetlify(opts: {
  name: string;
  files: DeployFile[];
}): Promise<{ url: string; deploymentId: string; projectId?: string }> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) throw new Error("NETLIFY_AUTH_TOKEN is not configured");

  const headers = { Authorization: `Bearer ${token}` };

  // 1. Create site with a unique-ish name.
  const siteRes = await fetch("https://api.netlify.com/api/v1/sites", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: slugify(opts.name) }),
  });
  if (!siteRes.ok) {
    throw new Error(`Netlify site create failed: ${siteRes.status} ${(await siteRes.text()).slice(0, 400)}`);
  }
  const site = await siteRes.json();
  const siteId: string = site.id;
  const sslUrl: string = site.ssl_url || site.url;

  // 2. POST zip to deploys endpoint. Netlify extracts and serves it.
  const zipBytes = await zipFiles(opts.files);
  const depRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/zip" },
    body: zipBytes as unknown as BodyInit,
  });
  if (!depRes.ok) {
    throw new Error(`Netlify deploy failed: ${depRes.status} ${(await depRes.text()).slice(0, 400)}`);
  }
  const deploy = await depRes.json();
  const deployId: string = deploy.id;

  // 3. Poll until ready (typically a few seconds for static).
  const deadline = Date.now() + 60_000;
  let state: string = deploy.state;
  let liveUrl: string = deploy.ssl_url || deploy.deploy_ssl_url || sslUrl;
  while (state !== "ready" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deployId}`, { headers });
    if (!r.ok) break;
    const j = await r.json();
    state = j.state;
    liveUrl = j.ssl_url || j.deploy_ssl_url || liveUrl;
    if (state === "error") throw new Error(`Netlify deploy errored: ${j.error_message ?? "unknown"}`);
  }

  return {
    url: liveUrl.startsWith("http") ? liveUrl : `https://${liveUrl}`,
    deploymentId: deployId,
    projectId: siteId,
  };
}
