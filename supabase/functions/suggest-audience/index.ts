import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { assertLLMConfigured, llmChat, LLM_MODEL_LITE } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword, brand, existingKeywords } = await req.json();
    assertLLMConfigured();

    const systemPrompt = `You are a marketing audience strategist for Nestlé's food and beverage brands in the MENA region.
Given a raw audience keyword typed by a user, you must:
1. Fix any spelling errors in the original keyword
2. Generate 4-5 refined, more specific audience segment suggestions based on what the user likely meant
3. Each suggestion should be concise (2-6 words) and actionable for influencer targeting

Context: Nestlé operates across Culinary (Maggi, Cerelac), Dairy (NIDO, Nesquik), Beverages (Nescafé, Milo), and Confectionery (KitKat) clusters.
Markets include UAE, KSA, Kuwait, Qatar, Bahrain, Oman, Jordan, Lebanon, India.
${brand ? `Current brand: ${brand}` : ""}
${existingKeywords?.length ? `Already selected keywords: ${existingKeywords.join(", ")}` : ""}

Respond ONLY with a JSON object, no markdown:
{
  "corrected": "the spelling-corrected version of the original keyword",
  "suggestions": [
    { "label": "suggestion text", "reason": "brief 5-word reason why this is relevant" }
  ]
}`;

    const response = await llmChat({
      model: LLM_MODEL_LITE,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Keyword: "${keyword}"` },
      ],
      response_format: { type: "json_object" },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { corrected: keyword, suggestions: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-audience error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
