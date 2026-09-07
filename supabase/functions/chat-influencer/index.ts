import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BIGQUERY_FUNCTION_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bigquery-query`;

// ── Module-level BQ schema cache (1-hour TTL) ──
let cachedBQSchema: string | null = null;
let bqSchemaFetchedAt = 0;
const BQ_SCHEMA_TTL_MS = 60 * 60 * 1000;

async function fetchBQSchema(): Promise<string> {
  if (cachedBQSchema && Date.now() - bqSchemaFetchedAt < BQ_SCHEMA_TTL_MS) {
    console.log("schema cache hit");
    return cachedBQSchema;
  }
  const resp = await fetch(BIGQUERY_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ action: "get_schema" }),
  });
  if (!resp.ok) return "Schema unavailable";
  const data = await resp.json();
  const fields = data.schema?.fields || [];
  cachedBQSchema = fields.map((f: any) => `${f.name} (${f.type}${f.mode === "REPEATED" ? ", REPEATED" : ""})`).join("\n");
  bqSchemaFetchedAt = Date.now();
  return cachedBQSchema!;
}

function normalizeQuery(query: string): string {
  let q = query.replace(/(["'])(\d{3,4}-\d{2}-\d{2})\1/g, (_m, quote, dateStr) => {
    const fixed = dateStr.replace(/^2(\d{2})-/, "20$1-");
    return `${quote}${fixed}${quote}`;
  });
  q = q.replace(/\b([\w().]+)\s*\/\s*([\w().]+)/g, (match, a, b) => {
    if (/^\d/.test(a) || match.includes("//")) return match;
    return `SAFE_DIVIDE(${a}, ${b})`;
  });
  return q;
}

async function runBigQuery(query: string): Promise<any> {
  const resp = await fetch(BIGQUERY_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ query: normalizeQuery(query) }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || "Failed to execute BigQuery query");
  return data;
}

async function queryInfluencerData(supabase: any, query_type: string, params: any): Promise<any> {
  switch (query_type) {
    case "get_creator": {
      const { data } = await supabase
        .from("creators")
        .select("*")
        .or(`name.ilike.%${params.name}%,handle.ilike.%${params.name}%`)
        .limit(5);
      return data || [];
    }
    case "get_creator_posts": {
      const { data } = await supabase
        .from("creator_posts")
        .select("*")
        .eq("creator_id", params.creator_id)
        .order("post_date", { ascending: false })
        .limit(params.limit || 12);
      return data || [];
    }
    case "get_creator_collaborations": {
      const { data } = await supabase
        .from("creator_collaborations")
        .select("*")
        .eq("creator_id", params.creator_id)
        .order("post_date", { ascending: false })
        .limit(params.limit || 20);
      return data || [];
    }
    case "get_creator_platforms": {
      const { data } = await supabase
        .from("creator_platforms")
        .select("*")
        .eq("creator_id", params.creator_id);
      return data || [];
    }
    case "search_creators": {
      let q = supabase.from("creators").select("*");
      if (params.cluster) q = q.eq("cluster", params.cluster);
      if (params.brand) q = q.eq("brand", params.brand);
      if (params.country) q = q.eq("country", params.country);
      if (params.min_followers) q = q.gte("followers", params.min_followers);
      if (params.min_engagement) q = q.gte("engagement_rate", params.min_engagement);
      if (params.status) q = q.eq("status", params.status);
      if (params.name) q = q.or(`name.ilike.%${params.name}%,handle.ilike.%${params.name}%`);
      q = q.order("followers", { ascending: false }).limit(params.limit || 20);
      const { data } = await q;
      return data || [];
    }
    case "get_campaign_creators": {
      const { data } = await supabase
        .from("campaign_creators")
        .select("*, creators(*), campaigns(*)")
        .eq("creator_id", params.creator_id);
      return data || [];
    }
    case "list_campaigns": {
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(params.limit || 20);
      return data || [];
    }
    default:
      return { error: "Unknown query type" };
  }
}

// ── Parallel tool execution ──
async function executeToolCalls(toolCalls: any[], supabase: any): Promise<any[]> {
  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const args = JSON.parse(toolCall.function.arguments);
      let result: any;
      if (toolCall.function.name === "run_bigquery_query") {
        console.log("Executing BigQuery:", args.query);
        result = await runBigQuery(args.query);
      } else if (toolCall.function.name === "query_influencer_data") {
        console.log("Querying influencer data:", args.query_type, args.params);
        result = await queryInfluencerData(supabase, args.query_type, args.params);
      } else {
        result = { error: `Unknown tool: ${toolCall.function.name}` };
      }
      return {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      };
    })
  );
  return results;
}

const tools = [
  {
    type: "function",
    function: {
      name: "query_influencer_data",
      description: "Query the influencer database for creators, posts, collaborations, platforms, and campaigns.",
      parameters: {
        type: "object",
        properties: {
          query_type: {
            type: "string",
            enum: ["get_creator", "get_creator_posts", "get_creator_collaborations", "get_creator_platforms", "search_creators", "get_campaign_creators", "list_campaigns"],
            description: "Type of query to run",
          },
          params: {
            type: "object",
            description: "Parameters for the query. For get_creator: {name}. For get_creator_posts/collaborations/platforms/campaign_creators: {creator_id, limit?}. For search_creators: {cluster?, brand?, country?, min_followers?, min_engagement?, status?, name?, limit?}. For list_campaigns: {limit?}.",
          },
        },
        required: ["query_type", "params"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_bigquery_query",
      description: "Execute a BigQuery SQL SELECT query against the Nestlé media dataset.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "BigQuery SQL SELECT query" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error("messages array is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const todayUtc = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getUTCFullYear();

    let bqSchemaInfo = "";
    try {
      bqSchemaInfo = await fetchBQSchema();
    } catch {
      bqSchemaInfo = "BigQuery schema unavailable";
    }

    const systemPrompt = `You are an AI assistant for the Starling influencer management platform, built for Nestlé MENA.
You help users understand influencer performance, campaign data, and media analytics.

TODAY: ${todayUtc} | YEAR: ${currentYear}

IMPORTANT: The BigQuery dataset contains HISTORICAL data spanning multiple years (2020-${currentYear}). When users ask about past campaigns, historical spend, or what a creator has done "in the past" / "before", do NOT restrict queries to the current year. Query ALL available date ranges unless the user specifies a particular time period. Always use >= and <= date filters broadly, or omit date filters entirely when looking for all historical data.

You have access to TWO data sources:
1. **Influencer Database** (Supabase) — creators, their posts, collaborations, platform accounts, campaigns
2. **Media Analytics** (BigQuery) — Nestlé media spend, impressions, clicks, campaigns across clusters

CLUSTERS: CUL (Culinary), DAI (Dairy), BEV (Beverages), CNF (Confectionery)

BIGQUERY TABLE: \`wavemaker-mena-groupm.Nestle.Nestle_main_media\`
BIGQUERY SCHEMA:
${bqSchemaInfo}

TOOLS AVAILABLE:
- query_influencer_data: Query the influencer database (creators, posts, collaborations, campaigns)
- run_bigquery_query: Query BigQuery for media analytics data

INSTRUCTIONS:
- When asked about a specific influencer, first search for them using query_influencer_data with query_type "get_creator"
- Then fetch their posts, collaborations, and platform data for a complete picture
- When asked about media spend, campaigns performance metrics, use BigQuery
- **CROSS-REFERENCING CREATORS WITH BIGQUERY**: When a user asks what a creator has done with Nestlé, or their past campaigns/spend:
  1. First get the creator's name and handle from the influencer database (query_influencer_data → get_creator).
  2. **CRITICAL — name matching**: Ad/campaign names in BigQuery rarely contain the creator name with a space. They use variants like \`yaraaziz\`, \`yara-aziz\`, \`yara_aziz\`, \`yara.aziz\`, or just the handle. You MUST search for ALL of these variants, plus the handle (without @), plus the first name alone, across Campaign, Ad_Name, Ad_Group_Name, AND Account_Name. Use REGEXP_CONTAINS with a single pattern to cover them all.
     Example for "Yara Aziz" (handle @yaraaziz):
     SELECT Brand, Campaign, Ad_Name, Market, SUM(Spends) as spend, SUM(Impressions) as impressions, SUM(Video_Views) as views FROM \`wavemaker-mena-groupm.Nestle.Nestle_main_media\` WHERE REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(Campaign,''),' ',IFNULL(Ad_Name,''),' ',IFNULL(Ad_Group_Name,''),' ',IFNULL(Account_Name,''))), r'(yaraaziz|yara[-_. ]aziz)') GROUP BY Brand, Campaign, Ad_Name, Market ORDER BY spend DESC LIMIT 500
  3. ALWAYS aggregate by Brand first to show the FULL list of brands the creator has worked with (do not stop at the first brand you find). If the user asks about a creator generally, return ALL brands, not just one.
  4. Combine both data sources to give a complete picture of the creator's work with Nestlé.
- Format responses with markdown tables when showing data
- LEGACY DATA TRANSLATION: the underlying database still contains legacy cluster codes and brand names from a previous deployment. ALWAYS translate them in your responses and never show the legacy values: clusters CPD→CUL, LL/LLD→DAI, LDB→BEV, PPD→CNF; brands Maybelline/L'Oréal Paris→Maggi, Garnier/NYX→Cerelac, Lancôme→NIDO, YSL Beauty→Nesquik, Giorgio Armani→Carnation, La Roche-Posay→Nescafé, CeraVe→Milo, Vichy→Nestlé Pure Life, Kérastase/Urban Decay→KitKat, Shu Uemura/Redken→Aero.
- Be conversational and insightful — don't just dump data, analyze it
- For BigQuery queries, use SAFE_DIVIDE() for division operations
- Only generate SELECT queries for BigQuery
- **Always include LIMIT 1000 or smaller in every BigQuery query unless explicitly aggregating with GROUP BY.**
- IMPORTANT: Call ALL the tools you need in a SINGLE response. Do not make one tool call and wait — batch them together.

RESPONSE FORMAT:
- Use markdown tables for data
- Bold key metrics and findings
- Include actionable insights
- At the end of EVERY response, include 2-3 contextual follow-up suggestions formatted as:
FOLLOW_UP: [specific follow-up question]`;

    // Multi-round tool calling loop (max 3 rounds)
    let conversationMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];
    
    const MAX_ROUNDS = 3;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const isLastChance = round === MAX_ROUNDS - 1;
      
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: conversationMessages,
          tools,
          tool_choice: isLastChance ? "none" : "auto",
          ...(isLastChance ? { stream: true } : {}),
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errText);
        throw new Error(`AI gateway error [${aiResponse.status}]`);
      }

      // If last round, we requested stream: true — pipe it
      if (isLastChance) {
        return new Response(aiResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      const aiData = await aiResponse.json();
      const choice = aiData.choices?.[0];

      // If no tool calls, make a streaming follow-up for the final answer
      if (choice?.finish_reason !== "tool_calls" && !choice?.message?.tool_calls?.length) {
        const content = choice?.message?.content;
        if (content) {
          // We have the answer already — do a streaming relay for consistency
          const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: conversationMessages,
              stream: true,
            }),
          });

          if (streamResponse.ok) {
            return new Response(streamResponse.body, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
            });
          }
        }

        // Fallback: return JSON if streaming fails
        return new Response(
          JSON.stringify({ response: content || "I couldn't generate a response." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Execute tool calls in parallel and append to conversation
      const toolCalls = choice.message.tool_calls || [];
      console.log(`Round ${round + 1}: executing ${toolCalls.length} tool call(s) in parallel`);
      
      const toolResults = await executeToolCalls(toolCalls, supabase);
      conversationMessages.push(choice.message);
      conversationMessages.push(...toolResults);
    }

    // Should not reach here due to isLastChance streaming, but safety fallback
    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: conversationMessages,
        stream: true,
      }),
    });

    if (!finalResponse.ok) {
      const errText = await finalResponse.text();
      console.error("AI final error:", finalResponse.status, errText);
      throw new Error("Failed to generate final response");
    }

    return new Response(finalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat influencer error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
