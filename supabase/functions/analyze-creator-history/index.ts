import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { creator, ads, totals } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const sample = (ads || []).slice(0, 40).map((a: any) => ({
      brand: a.brand,
      market: a.market,
      date: a.date,
      ad: a.ad_name,
      spend: a.spend,
      impressions: a.impressions,
      views: a.views,
      engagements: a.engagements,
      cpm: a.cpm,
      cpv: a.cpv,
    }));

    const systemPrompt = `You are a senior Nestlé MENA media strategist. You receive an influencer's profile plus their actual paid-media ad lines from BigQuery (wavemaker_mena groupm).
Write a sharp, evidence-based read on this creator for Nestlé brand teams. Cite real numbers (spend tiers, CPM, CPV, markets, brands) — do not invent.

Return ONLY this JSON shape, no markdown:
{
 "verdict": "1-2 sentence headline read on this creator",
 "strengths": ["...", "..."],
 "watchouts": ["...", "..."],
 "spend_efficiency": "How performance scales with budget. Compare low-spend vs high-spend ads from the data.",
 "best_fit_brands": ["BrandA","BrandB"],
 "recommendation": "1-2 sentences: how a brand team should use her next."
}`;

    const userPrompt = `Creator: ${creator?.name} (@${creator?.handle || ""}) · ${creator?.country || ""}
Followers: ${creator?.followers || "unknown"}  ER: ${creator?.engagement_rate || "?"}%

Aggregate Nestlé history: spend $${totals?.spend?.toFixed(0)} across ${totals?.adCount} ad lines, ${totals?.brandCount} brands, ${totals?.marketCount} markets.
Total impressions ${totals?.impressions}, views ${totals?.views}, engagements ${totals?.engagements}.
Blended CPM $${totals?.cpm?.toFixed(2)}, CPV $${totals?.cpv?.toFixed(3)}.

Ad lines (sample):
${JSON.stringify(sample, null, 1)}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `AI ${r.status}: ${t}` }), {
        status: r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const d = await r.json();
    const content = d.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
    } catch {
      const s = content.indexOf("{");
      const e = content.lastIndexOf("}");
      if (s >= 0 && e > s) parsed = JSON.parse(content.slice(s, e + 1));
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
