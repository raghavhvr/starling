import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { assertLLMConfigured, llmChat } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractJsonObject(raw: string) {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("No valid JSON object found in AI response");
  }
}

function normalizeInsights(parsed: unknown, analysis: any) {
  const rawInsights = Array.isArray((parsed as any)?.insights) ? (parsed as any).insights : [];
  const insights = rawInsights
    .map((item: any) => ({
      insight: String(item?.insight || "").trim(),
      tip: String(item?.tip || "").trim(),
    }))
    .filter((item: { insight: string; tip: string }) => item.insight && item.tip)
    .slice(0, 4);

  if (insights.length) return { insights };

  const overview = analysis?.overview?.headline || "The creator shows a defined audience and content pattern.";
  const sentiment = analysis?.audience_sentiment?.summary || analysis?.sentiment?.summary || "Audience response should be monitored across recent posts.";
  const patterns = analysis?.posting_patterns || analysis?.content_patterns || {};
  const formats = Array.isArray(patterns?.best_formats) ? patterns.best_formats.join(", ") : "short-form beauty content";

  return {
    insights: [
      {
        insight: overview,
        tip: "Use this creator for briefs where the brand message can match their strongest recurring content angle.",
      },
      {
        insight: sentiment,
        tip: "Shape the campaign hook around the audience language and concerns that already appear in comments.",
      },
      {
        insight: `Top-performing formats appear to center on ${formats}.`,
        tip: "Prioritize these formats for Nestlé deliverables instead of forcing a new content structure.",
      },
      {
        insight: "Posting cadence and engagement windows can guide when campaign assets should go live.",
        tip: "Schedule launches around the creator's strongest posting windows and reserve one reactive post for optimization.",
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { creator, analysis } = await req.json();
    assertLLMConfigured();

    const systemPrompt = `You are a senior Nestlé MENA influencer strategist. From the creator analysis JSON, extract 4 KEY INSIGHTS.
Each insight = a sharp observation about the creator's audience behavior, content patterns, or engagement drivers (cite real evidence: comment quotes, view counts, formats).
Each insight gets a TIP = a tactical recommendation for Nestlé brand campaigns leveraging that insight.

Return ONLY a valid JSON object: { "insights": [{ "insight": "...", "tip": "..." }, ...] } — exactly 4 items. No markdown.
Do not use double quote characters inside insight or tip values; paraphrase comments instead of quoting them verbatim.
Insights should be 2-3 sentences, specific, with numbers/quotes. Tips should be 1-2 sentences, action-oriented, brand-relevant.`;

    const userPrompt = `Creator: ${creator?.name || "Unknown"} (@${creator?.handle || ""}) on ${creator?.platform || ""}\n\nAnalysis JSON:\n${JSON.stringify(analysis).slice(0, 12000)}`;

    const r = await llmChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `AI ${r.status}: ${t}` }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const d = await r.json();
    const content = d.choices?.[0]?.message?.content || "{}";
    let result;
    try {
      result = normalizeInsights(extractJsonObject(content), analysis);
    } catch (parseError) {
      console.error("Failed to parse AI insights JSON:", parseError, content.slice(0, 1200));
      result = normalizeInsights(null, analysis);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
