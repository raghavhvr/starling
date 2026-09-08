import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertLLMConfigured, llmChat } from '../_shared/llm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    try {
      assertLLMConfigured()
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { trend_id, trend_title } = await req.json()
    if (!trend_id) {
      return new Response(JSON.stringify({ error: 'trend_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: comments, error } = await supabase
      .from('trend_comments')
      .select('platform, author, content, likes, replies, metadata')
      .eq('trend_id', trend_id)
      .order('likes', { ascending: false })
      .limit(50)

    if (error) throw error
    if (!comments || comments.length === 0) {
      return new Response(JSON.stringify({ summary: 'No comments available to analyze yet. Click "Scrape" to pull live social media posts first.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const platformCounts: Record<string, number> = {}
    comments.forEach((c: any) => {
      platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1
    })

    const commentDigest = comments.map((c: any, i: number) =>
      `[${c.platform}] @${c.author}: ${c.content?.slice(0, 300)} (${c.likes || 0} likes, ${c.replies || 0} replies)`
    ).join('\n')

    const systemPrompt = `You are a senior social media intelligence analyst for Nestlé's MENA influencer marketing team (Starling platform). You analyze social media conversations to extract actionable insights for food and beverage campaigns.

Your analysis should be concise, data-driven, and directly useful for campaign planning. Use markdown formatting.`

    const userPrompt = `Analyze these ${comments.length} social media posts about the food trend "${trend_title}" collected from ${Object.keys(platformCounts).join(', ')}.

Posts:
${commentDigest}

Provide a brief intelligence report with:
1. **Key Sentiment** — Overall mood (positive/negative/mixed) with a one-line summary
2. **Top Themes** — 3-5 recurring themes or talking points
3. **Platform Breakdown** — How conversation differs across platforms (${Object.entries(platformCounts).map(([p, c]) => `${p}: ${c} posts`).join(', ')})
4. **Creator Opportunity** — Specific angles or content ideas for Nestlé influencers in the MENA region
5. **Watch Out** — Any negative sentiment or risks to be aware of

Keep it under 300 words total. Be specific, cite actual comments where relevant.`

    const aiResp = await llmChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in Settings > Workspace > Usage.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const t = await aiResp.text()
      console.error('AI gateway error:', aiResp.status, t)
      throw new Error('AI analysis failed')
    }

    const aiData = await aiResp.json()
    const summary = aiData.choices?.[0]?.message?.content || 'Unable to generate summary.'

    return new Response(JSON.stringify({ summary, post_count: comments.length, platforms: platformCounts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
