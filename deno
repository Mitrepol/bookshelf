// AO3 proxy worker for Deno Deploy
// Go to dash.deno.com, create a new Playground, paste this entire file, click Save & Deploy

const ALLOWED_ORIGIN = "*";

// Simple in-memory cache to reduce AO3 requests
// Deno Deploy instances are ephemeral so this resets occasionally — that's fine
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

function cached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}
function fromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    if (url.pathname === "/search") {
      const q = url.searchParams.get("q");
      if (!q) return json({ error: "missing q param" }, 400);
      const cacheKey = "search:" + q.toLowerCase().trim();
      const hit = fromCache(cacheKey);
      if (hit) return json(hit);
      const results = await searchAO3(q);
      cached(cacheKey, results);
      return json(results);
    }

    if (url.pathname === "/work") {
      const id = url.searchParams.get("id");
      if (!id || !/^\d+$/.test(id)) return json({ error: "missing or invalid id" }, 400);
      const cacheKey = "work:" + id;
      const hit = fromCache(cacheKey);
      if (hit) return json(hit);
      const work = await fetchWork(id);
      cached(cacheKey, work);
      return json(work);
    }

    return json({ error: "unknown endpoint" }, 404);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "server error";
    return json({ error: message }, 500);
  }
});

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

async function fetchAO3(url: string): Promise<Response> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers, redirect: "follow" });
    if (res.ok) return res;
    if (res.status === 429 && attempt < 2) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error("AO3 returned " + res.status);
  }
  throw new Error("AO3 returned 429 after retries");
}

async function searchAO3(query: string) {
  const searchUrl =
    "https://archiveofourown.org/works/search?work_search%5Bquery%5D=" +
    encodeURIComponent(query) +
    "&work_search%5Bsort_column%5D=_score";

  const res = await fetchAO3(searchUrl);
  const html = await res.text();

  const results: object[] = [];
  const workBlocks = html.split(/<li[^>]*class="[^"]*work blurb[^"]*"[^>]*id="work_(\d+)"/);

  for (let i = 1; i < workBlocks.length && results.length < 10; i += 2) {
    const id = workBlocks[i];
    const block = workBlocks[i + 1].split(/<\/li>/)[0];

    const titleMatch = block.match(/<h4[^>]*class="heading"[^>]*>\s*<a[^>]*href="\/works\/\d+"[^>]*>([^<]+)<\/a>/);
    const authorMatch = block.match(/<a[^>]*rel="author"[^>]*>([^<]+)<\/a>/);
    const fandomMatch = block.match(/<h5[^>]*class="fandoms[^"]*"[^>]*>[\s\S]*?<a[^>]*class="tag"[^>]*>([^<]+)<\/a>/);
    const wordsMatch = block.match(/<dd[^>]*class="words"[^>]*>([0-9,]+)<\/dd>/);
    const chaptersMatch = block.match(/<dd[^>]*class="chapters"[^>]*>([\s\S]*?)<\/dd>/);

    let chapters = "";
    if (chaptersMatch) chapters = chaptersMatch[1].replace(/<[^>]+>/g, "").trim();

    const ships: string[] = [];
    const shipRegex = /<li[^>]*class="relationships"[^>]*>\s*<a[^>]*class="tag"[^>]*>([^<]+)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = shipRegex.exec(block)) !== null) ships.push(decodeEntities(m[1]));

    results.push({
      id,
      title: titleMatch ? decodeEntities(titleMatch[1].trim()) : "(untitled)",
      author: authorMatch ? decodeEntities(authorMatch[1].trim()) : "Anonymous",
      fandom: fandomMatch ? decodeEntities(fandomMatch[1].trim()) : "",
      ship: ships[0] || "",
      wordCount: wordsMatch ? wordsMatch[1].replace(/,/g, "") : "",
      chapters,
      url: "https://archiveofourown.org/works/" + id,
    });
  }

  return { results };
}

async function fetchWork(id: string) {
  const workUrl = "https://archiveofourown.org/works/" + id + "?view_adult=true";
  const res = await fetchAO3(workUrl);
  const html = await res.text();

  const title = matchOne(html, /<h2[^>]*class="title heading"[^>]*>([\s\S]*?)<\/h2>/);
  const author = matchOne(html, /<a[^>]*rel="author"[^>]*>([^<]+)<\/a>/);
  const fandom = matchOne(html, /<dd[^>]*class="fandom tags"[^>]*>[\s\S]*?<a[^>]*class="tag"[^>]*>([^<]+)<\/a>/);
  const wordCount = matchOne(html, /<dd[^>]*class="words"[^>]*>([0-9,]+)<\/dd>/);
  const chaptersRaw = matchOne(html, /<dd[^>]*class="chapters"[^>]*>([\s\S]*?)<\/dd>/);
  const shipMatch = html.match(/<dd[^>]*class="relationship tags"[^>]*>[\s\S]*?<a[^>]*class="tag"[^>]*>([^<]+)<\/a>/);

  return {
    id,
    title: title ? decodeEntities(title.replace(/<[^>]+>/g, "").trim()) : "",
    author: author ? decodeEntities(author.trim()) : "",
    fandom: fandom ? decodeEntities(fandom.trim()) : "",
    ship: shipMatch ? decodeEntities(shipMatch[1].trim()) : "",
    wordCount: wordCount ? wordCount.replace(/,/g, "") : "",
    chapters: chaptersRaw ? chaptersRaw.replace(/<[^>]+>/g, "").trim() : "",
    url: "https://archiveofourown.org/works/" + id,
  };
}

function matchOne(html: string, regex: RegExp): string {
  const m = html.match(regex);
  return m ? m[1] : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}
