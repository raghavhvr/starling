import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { brief, trends } = await req.json();

    if (!brief || typeof brief !== "object") {
      return new Response(JSON.stringify({ error: "brief is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trendsSummary = (trends || [])
      .map((t: any) => `- ${t.title} (${t.category || "general"}, relevance: ${t.relevance_score}/100): ${t.description || ""}`)
      .join("\n");

    const briefSummary = `
Campaign: ${brief.name || "Untitled"}
Brand: ${brief.brand || "Unknown"} (Division: ${brief.cluster || "N/A"})
Objectives: ${brief.objective || "Not set"}
Target Audience: ${brief.target_audience || "Not set"}
KPIs: ${brief.kpis || "Not set"}
Deliverables: ${brief.deliverables || "Not set"}
Budget: $${brief.budget || 0}
Markets: ${(brief.markets || []).join(", ") || "Not set"}
Age Range: ${brief.age_range || "Not set"}
Timeline: ${brief.start_date || "?"} to ${brief.end_date || "?"}
Notes: ${brief.notes || "None"}
`.trim();

    const systemPrompt = `You are an expert Nestlé MENA influencer marketing strategist. You analyze campaign briefs and current social/food trends to generate SPECIFIC, data-driven optimization suggestions.

Your suggestions should be actionable, referencing the specific brand, objectives, audience, and trends provided. Never give generic advice.

Return EXACTLY 5 suggestions as a JSON array. Each suggestion must have:
- "title": short headline (max 8 words)
- "desc": specific explanation referencing campaign data and trends (2-3 sentences)
- "icon": one of "target", "users", "clock", "star", "dollar"
- "deliverables": array of deliverable types to add (empty array if none). Valid types: "IG Reel", "IG Story", "IG Post", "TikTok Video", "UGC / Whitelisted Ad", "YouTube Short", "Snapchat Lens"
- "note": if no deliverables, a note string to append to campaign notes (empty string if deliverables exist)

Be SPECIFIC to this brand, market, audience, and the trending topics provided. Reference actual trend titles and data.`;

    const userPrompt = `Here is the campaign brief:
${briefSummary}

${trendsSummary ? `Here are the current trending topics in beauty/skincare:\n${trendsSummary}` : "No trending data available."}

Generate 5 specific, actionable optimization suggestions for this campaign. Reference the actual trends and brief data. Return ONLY a JSON array, no markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errText}`);
    }

    const aiData = await response.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";
    
    // Strip markdown code fences if present
    content = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    
    const suggestions = JSON.parse(content);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
