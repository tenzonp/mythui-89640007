// Thin Firecrawl v2 REST client (no SDK to keep the worker bundle slim).
// Used by chat tools to answer live / real-time questions.

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

function requireKey(): string {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY is not configured");
  return k;
}

async function fc(path: string, body: unknown) {
  const res = await fetch(`${FIRECRAWL_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(
      `Firecrawl ${path} ${res.status}: ${(json && (json.error || json.message)) || text.slice(0, 300)}`,
    );
  }
  return json;
}

export type WebSearchResult = {
  title: string;
  url: string;
  description?: string;
  markdown?: string;
};

export async function webSearch(
  query: string,
  opts: { limit?: number; scrape?: boolean; tbs?: string } = {},
): Promise<WebSearchResult[]> {
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 10);
  const body: any = { query, limit };
  if (opts.tbs) body.tbs = opts.tbs;
  if (opts.scrape) {
    body.scrapeOptions = { formats: ["markdown"], onlyMainContent: true };
  }
  const json = await fc("/search", body);
  // v2 returns { data: { web: [...] } } most commonly; tolerate older shapes.
  const items: any[] =
    json?.data?.web ?? json?.data?.results ?? (Array.isArray(json?.data) ? json.data : []) ?? [];
  return items.slice(0, limit).map((r) => ({
    title: r.title ?? r.url,
    url: r.url,
    description: r.description ?? r.snippet,
    markdown: r.markdown,
  }));
}

export async function webScrape(url: string): Promise<{ markdown?: string; title?: string }> {
  const json = await fc("/scrape", {
    url,
    formats: ["markdown"],
    onlyMainContent: true,
  });
  const d = json?.data ?? json;
  return { markdown: d?.markdown, title: d?.metadata?.title };
}
