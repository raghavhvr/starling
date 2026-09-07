// Public TikTok oEmbed proxy — returns thumbnail_url for a given video.
// Used to render evidence video thumbnails in the Virlo creator analysis.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const { handle, video_id } = body;
    if (!handle || !video_id) {
      return new Response(JSON.stringify({ thumbnail_url: null, error: "handle and video_id required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cleanHandle = String(handle).replace(/^@/, "");
    const url = `https://www.tiktok.com/@${cleanHandle}/video/${video_id}`;
    let data: any = null;
    try {
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
        },
      });
      const text = await res.text();
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        try { data = JSON.parse(text); } catch { data = null; }
      }
    } catch (_e) {
      data = null;
    }
    let pageMeta: any = null;
    if (!data?.thumbnail_url) {
      try {
        const pageRes = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        const html = await pageRes.text();
        const meta = (name: string) => {
          const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
          return html.match(re)?.[1]?.replace(/&amp;/g, "&") ?? null;
        };
        pageMeta = {
          thumbnail_url: meta("og:image") || meta("twitter:image"),
          video_url: meta("og:video") || meta("og:video:url") || meta("twitter:player:stream"),
          title: meta("og:title") || meta("twitter:title"),
        };
      } catch {
        pageMeta = null;
      }
    }

    // Always return 200 with null fields if TikTok blocks metadata —
    // the client still embeds the post by ID and falls back gracefully.
    return new Response(
      JSON.stringify({
        thumbnail_url: data?.thumbnail_url ?? pageMeta?.thumbnail_url ?? null,
        video_url: pageMeta?.video_url ?? null,
        title: data?.title ?? pageMeta?.title ?? null,
        author_name: data?.author_name ?? null,
        author_url: data?.author_url ?? null,
        post_url: url,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
        },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
