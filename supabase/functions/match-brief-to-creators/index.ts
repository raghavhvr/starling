// Brief → Influencer Match
// 1. Gemini extracts Virlo keywords + audience signals from a brief
// 2. Calls existing virlo-proxy to spawn an Orbit and poll for videos
// 3. Re-ranks Virlo creators by fit + scores trusted partners from local DB
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertLLMConfigured, llmChat } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BriefInput {
  brand?: string;
  objective?: string;
  markets?: string[];
  audience?: string;
  deliverables?: string;
  notes?: string;
  rawText?: string; // when uploaded as a doc
}

async function extractKeywords(brief: BriefInput) {
  const sys = `You are a MENA influencer-marketing strategist for Nestlé.
Given a campaign brief, output:
- 3 to 5 short Virlo search keywords (1-3 words each) tailored to MENA food & lifestyle creators
- A concise "ideal creator" description (1 sentence)
- Audience signals (age, gender, interests) as short tags

Respond ONLY with JSON, no prose.`;

  const user = JSON.stringify(brief);

  const res = await llmChat({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_match_plan",
            parameters: {
              type: "object",
              properties: {
                keywords: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 5,
                },
                ideal_creator: { type: "string" },
                audience_tags: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["keywords", "ideal_creator", "audience_tags"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_match_plan" } },
  });

  if (!res.ok) throw new Error(`AI keyword extract failed: ${res.status}`);
  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return JSON.parse(args);
}

async function rankCreators(
  ideal: string,
  audienceTags: string[],
  brief: BriefInput,
  candidates: Array<{ source: "virlo" | "trusted"; data: any }>,
) {
  if (candidates.length === 0) return [];

  const sys = `You score creators against a brief. For each candidate, return:
- score (0-100)
- reason (12-word max sentence)
- angle (suggested outreach angle, 8 words max)
Return all candidates, ordered by score desc.`;

  const compactCandidates = candidates.map((c, i) => ({
    idx: i,
    src: c.source,
    handle: c.data.creator_handle || c.data.handle,
    name: c.data.creator_name || c.data.name,
    bio: c.data.bio || "",
    platform: c.data.platform,
    followers: c.data.creator_followers || c.data.followers,
    sample: c.data.title || c.data.caption || "",
    brand_fit: c.data.brand,
    cluster: c.data.cluster,
    country: c.data.country,
  }));

  const res = await llmChat({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: JSON.stringify({
            ideal_creator: ideal,
            audience_tags: audienceTags,
            brand: brief.brand,
            objective: brief.objective,
            markets: brief.markets,
            candidates: compactCandidates,
          }),
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "rank",
            parameters: {
              type: "object",
              properties: {
                rankings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      idx: { type: "number" },
                      score: { type: "number" },
                      reason: { type: "string" },
                      angle: { type: "string" },
                    },
                    required: ["idx", "score", "reason", "angle"],
                  },
                },
              },
              required: ["rankings"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "rank" } },
  });

  if (!res.ok) throw new Error(`AI ranking failed: ${res.status}`);
  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const { rankings } = JSON.parse(args) as {
    rankings: Array<{ idx: number; score: number; reason: string; angle: string }>;
  };

  return rankings
    .map((r) => ({
      ...candidates[r.idx],
      score: r.score,
      reason: r.reason,
      angle: r.angle,
    }))
    .sort((a, b) => b.score - a.score);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    assertLLMConfigured();
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { brief, action = "start", orbit_id } = await req.json() as {
      brief: BriefInput;
      action?: "start" | "poll";
      orbit_id?: string;
    };

    // ─── ACTION: start ───
    if (action === "start") {
      const plan = await extractKeywords(brief);

      // Trusted partners — local DB
      let q = supabase.from("creators").select("*").limit(50);
      if (brief.brand) q = q.eq("brand", brief.brand);
      if (brief.markets?.length) q = q.in("country", brief.markets);
      const { data: trusted } = await q.order("soi_score", { ascending: false });

      // Spawn Virlo Orbit
      const virloRes = await fetch(`${SUPABASE_URL}/functions/v1/virlo-proxy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "orbit_create",
          params: {
            name: `Brief: ${brief.brand ?? "campaign"} ${Date.now()}`,
            keywords: plan.keywords,
          },
        }),
      });
      const virloJson = await virloRes.json();
      const newOrbitId =
        virloJson?.data?.data?.orbit_id ||
        virloJson?.data?.orbit_id ||
        virloJson?.data?.id;

      // Score trusted partners now (we have them already)
      const trustedRanked = await rankCreators(
        plan.ideal_creator,
        plan.audience_tags,
        brief,
        (trusted ?? []).map((t) => ({ source: "trusted" as const, data: t })),
      );

      return new Response(
        JSON.stringify({
          plan,
          orbit_id: newOrbitId,
          trusted: trustedRanked.slice(0, 12),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── ACTION: poll ───
    if (action === "poll" && orbit_id) {
      // status check
      const statusRes = await fetch(`${SUPABASE_URL}/functions/v1/virlo-proxy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "orbit_get",
          orbit_id,
          force_refresh: true,
        }),
      });
      const statusJson = await statusRes.json();
      const inner = statusJson?.data?.data ?? statusJson?.data;
      const status = inner?.status;

      if (status !== "completed") {
        return new Response(
          JSON.stringify({ status: status ?? "queued" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // fetch videos
      const vidsRes = await fetch(`${SUPABASE_URL}/functions/v1/virlo-proxy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "orbit_videos",
          orbit_id,
          params: { page: 1, limit: 30 },
          force_refresh: true,
        }),
      });
      const vidsJson = await vidsRes.json();
      const videos: any[] =
        vidsJson?.data?.data?.videos || vidsJson?.data?.videos || [];

      // Dedupe by handle
      const seen = new Set<string>();
      const unique = videos.filter((v) => {
        const h = (v.creator_handle || v.creator_name || "").toLowerCase();
        if (!h || seen.has(h)) return false;
        seen.add(h);
        return true;
      });

      const ranked = await rankCreators(
        "MENA beauty creator matching the brief",
        [],
        { brand: "" },
        unique.slice(0, 24).map((v) => ({ source: "virlo" as const, data: v })),
      );

      return new Response(
        JSON.stringify({ status: "completed", discoveries: ranked.slice(0, 12) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[match-brief] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
