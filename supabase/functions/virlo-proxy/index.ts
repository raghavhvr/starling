// Virlo API proxy with 7-day caching to protect $25 budget.
// All paid endpoints go through here. Cache hit = $0 spent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VIRLO_BASE = "https://api.virlo.ai/v1";
const CACHE_DAYS = 7;

// Allowlist endpoints we permit so the client can never hit arbitrary paid routes.
const ALLOWED: Record<string, { method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string }> = {
  trends_digest: { method: "GET", path: "/trends/digest" },
  trends: { method: "GET", path: "/trends" },
  videos_digest: { method: "GET", path: "/videos/digest" },
  orbit_create: { method: "POST", path: "/orbit" },
  orbit_get: { method: "GET", path: "/orbit" }, // path suffix added below
  orbit_videos: { method: "GET", path: "/orbit" },
  // ─── Tracking API ───
  tracking_create_creator: { method: "POST", path: "/tracking/creators" },
  tracking_get_creator: { method: "GET", path: "/tracking/creators" }, // suffix /:id
  tracking_creator_report: { method: "GET", path: "/tracking/creators" }, // suffix /:id/report
  tracking_creator_snapshots: { method: "GET", path: "/tracking/creators" }, // suffix /:id/snapshots
  tracking_creator_posts: { method: "GET", path: "/tracking/creators" }, // suffix /:id/posts
  tracking_creator_cadence: { method: "GET", path: "/tracking/creators" }, // suffix /:id/posting-cadence
  // ─── Comet (Custom Niche) API ───
  comet_create: { method: "POST", path: "/comet" },
  comet_list: { method: "GET", path: "/comet" },
  comet_get: { method: "GET", path: "/comet" }, // suffix /:id
  comet_update: { method: "PUT", path: "/comet" }, // suffix /:id
  comet_delete: { method: "DELETE", path: "/comet" }, // suffix /:id
  comet_videos: { method: "GET", path: "/comet" }, // suffix /:id/videos
  comet_slideshows: { method: "GET", path: "/comet" }, // suffix /:id/slideshows
  comet_ads: { method: "GET", path: "/comet" }, // suffix /:id/ads
  comet_outliers: { method: "GET", path: "/comet" }, // suffix /:id/creators/outliers
  comet_analysis_latest: { method: "GET", path: "/comet" }, // suffix /:id/analysis/latest
  comet_trends_latest: { method: "GET", path: "/comet" }, // suffix /:id/trends/latest
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const VIRLO_API_KEY = Deno.env.get("VIRLO_API_KEY");
    if (!VIRLO_API_KEY) throw new Error("VIRLO_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const {
      action,
      params = {},
      orbit_id,
      force_refresh = false,
    }: {
      action: keyof typeof ALLOWED;
      params?: Record<string, unknown>;
      orbit_id?: string;
      force_refresh?: boolean;
    } = body;

    const spec = ALLOWED[action];
    if (!spec) throw new Error(`Unknown action: ${action}`);
    const trackingActions = [
      "tracking_get_creator",
      "tracking_creator_report",
      "tracking_creator_snapshots",
      "tracking_creator_posts",
      "tracking_creator_cadence",
    ];
    const trackingId = (body as any).tracking_id as string | undefined;
    if (trackingActions.includes(action) && !trackingId) {
      return new Response(
        JSON.stringify({ error: "Missing tracking_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Apply required defaults per Virlo API
    if (action === "orbit_create" && !(params as any).time_period) {
      (params as any).time_period = "this_month";
    }
    if ((action === "trends_digest" || action === "trends") && !(params as any).time_period) {
      (params as any).time_period = "this_week";
    }

    // Virlo caps paginated reads at 100. Clamp here as a server-side safety net
    // so stale clients or future UI changes cannot trigger a 400/blank screen.
    if (spec.method === "GET" && (params as any).limit !== undefined) {
      const numericLimit = Number((params as any).limit);
      if (!Number.isFinite(numericLimit) || numericLimit < 1) {
        (params as any).limit = 100;
      } else {
        (params as any).limit = Math.min(Math.trunc(numericLimit), 100);
      }
    }

    const cometId = (body as any).comet_id as string | undefined;

    // Tracking endpoints must include the tracking ID in the cache key.
    const cacheScope = trackingId ?? cometId ?? orbit_id ?? "";
    const cache_key = `${action}:${cacheScope}:${JSON.stringify(params)}`;

    if (!force_refresh) {
      const { data: cached } = await supabase
        .from("virlo_cache")
        .select("payload, expires_at")
        .eq("cache_key", cache_key)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        return new Response(
          JSON.stringify({ cached: true, expires_at: cached.expires_at, data: cached.payload }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Build URL
    let url = `${VIRLO_BASE}${spec.path}`;
    if (action === "orbit_get" && orbit_id) url += `/${orbit_id}`;
    if (action === "orbit_videos" && orbit_id) url += `/${orbit_id}/videos`;
    // Tracking endpoints use `tracking_id` (passed via body.tracking_id)
    if (action === "tracking_get_creator" && trackingId) url += `/${trackingId}`;
    if (action === "tracking_creator_report" && trackingId) url += `/${trackingId}/report`;
    if (action === "tracking_creator_snapshots" && trackingId) url += `/${trackingId}/snapshots`;
    if (action === "tracking_creator_posts" && trackingId) url += `/${trackingId}/posts`;
    if (action === "tracking_creator_cadence" && trackingId) url += `/${trackingId}/posting-cadence`;
    // Comet endpoints
    if (cometId) {
      if (action === "comet_get" || action === "comet_update" || action === "comet_delete") url += `/${cometId}`;
      if (action === "comet_videos") url += `/${cometId}/videos`;
      if (action === "comet_slideshows") url += `/${cometId}/slideshows`;
      if (action === "comet_ads") url += `/${cometId}/ads`;
      if (action === "comet_outliers") url += `/${cometId}/creators/outliers`;
      if (action === "comet_analysis_latest") url += `/${cometId}/analysis/latest`;
      if (action === "comet_trends_latest") url += `/${cometId}/trends/latest`;
    }

    let fetchInit: RequestInit = {
      method: spec.method,
      headers: {
        Authorization: `Bearer ${VIRLO_API_KEY}`,
        "Content-Type": "application/json",
      },
    };

    if (spec.method === "GET" || spec.method === "DELETE") {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) qs.append(k, String(v));
      }
      const q = qs.toString();
      if (q) url += `?${q}`;
    } else {
      fetchInit.body = JSON.stringify(params);
    }

    console.log(`[virlo-proxy] ${spec.method} ${url}`);
    const res = await fetch(url, fetchInit);
    const text = await res.text();

    if (!res.ok) {
      console.error(`[virlo-proxy] Error ${res.status}: ${text}`);
      return new Response(
        JSON.stringify({ error: `Virlo ${res.status}: ${text}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = JSON.parse(text);

    // Don't cache transient/empty results — only cache when we have real data
    const inner = json?.data ?? json;
    const videoCount = Array.isArray(inner?.videos) ? inner.videos.length : -1;
    const orbitStatus = inner?.status;
    const isTransient =
      action === "orbit_get" && (orbitStatus === "queued" || orbitStatus === "processing");
    const isEmptyVideos = action === "orbit_videos" && videoCount === 0;
    // NEVER cache writes — must always hit live API
    const noCacheActions = ["orbit_create", "tracking_create_creator", "comet_create", "comet_update", "comet_delete"];
    // Reports/feeds update each cycle — short cache (1h) so users see fresh data
    const shortCacheActions = [
      "tracking_get_creator",
      "tracking_creator_report",
      "tracking_creator_snapshots",
      "tracking_creator_posts",
      "tracking_creator_cadence",
      "comet_list",
      "comet_get",
      "comet_videos",
      "comet_slideshows",
      "comet_ads",
      "comet_outliers",
      "comet_analysis_latest",
      "comet_trends_latest",
    ];
    const shouldCache = !noCacheActions.includes(action) && !isTransient && !isEmptyVideos;
    const shortCache = shortCacheActions.includes(action);

    let expires_at = new Date(Date.now() + (shortCache ? 3_600_000 : CACHE_DAYS * 86_400_000)).toISOString();
    if (shouldCache) {
      await supabase
        .from("virlo_cache")
        .upsert(
          { cache_key, endpoint: action, params, payload: json, expires_at },
          { onConflict: "cache_key" },
        );
    } else {
      expires_at = new Date(Date.now() + 30_000).toISOString(); // signal "not cached"
    }

    return new Response(
      JSON.stringify({ cached: false, expires_at, data: json }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[virlo-proxy] Fatal:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
