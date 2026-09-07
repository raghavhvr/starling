// Streams a remote image through our origin so TikTok / IG signed CDN URLs
// (which block browser hotlinking via referer checks) render in <img> tags.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");
    if (!target) return new Response("missing url", { status: 400, headers: corsHeaders });

    // Only allow http(s) targets
    const parsed = new URL(target);
    if (!/^https?:$/.test(parsed.protocol)) {
      return new Response("bad protocol", { status: 400, headers: corsHeaders });
    }

    const range = req.headers.get("range");
    const upstream = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Referer: "https://www.tiktok.com/",
        Accept: "image/avif,image/webp,image/apng,image/*,video/*,*/*;q=0.8",
        ...(range ? { Range: range } : {}),
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(`upstream ${upstream.status}`, {
        status: upstream.status,
        headers: corsHeaders,
      });
    }

    const passthroughHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400, immutable",
      "Accept-Ranges": "bytes",
    };
    const cl = upstream.headers.get("content-length");
    if (cl) passthroughHeaders["Content-Length"] = cl;
    const cr = upstream.headers.get("content-range");
    if (cr) passthroughHeaders["Content-Range"] = cr;

    return new Response(upstream.body, {
      status: upstream.status,
      headers: passthroughHeaders,
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
