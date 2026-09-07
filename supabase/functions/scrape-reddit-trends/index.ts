import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN')
    if (!APIFY_API_TOKEN) {
      return new Response(JSON.stringify({ error: 'APIFY_API_TOKEN not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json().catch(() => ({}))
    const brand = body.brand || null
    // Limit posts to keep Apify costs very low
    const maxPosts = body.maxPosts || 15

    // Food-focused subreddits
    const subreddits = [
      'https://www.reddit.com/r/Cooking/hot/',
      'https://www.reddit.com/r/food/hot/',
      'https://www.reddit.com/r/recipes/hot/',
      'https://www.reddit.com/r/MealPrepSunday/hot/',
      'https://www.reddit.com/r/EatCheapAndHealthy/hot/',
    ]

    console.log('Scraping Reddit food trends, maxPosts per sub:', Math.ceil(maxPosts / subreddits.length))

    // Use Apify's Reddit Scraper Lite — very cheap, ~$0.25 per 1000 results
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: subreddits.map(url => ({ url })),
          maxItems: maxPosts,
          sort: 'hot',
          time: 'week',
        }),
      }
    )

    if (!runResponse.ok) {
      const errText = await runResponse.text()
      console.error('Apify error:', runResponse.status, errText)
      return new Response(JSON.stringify({ error: `Apify request failed [${runResponse.status}]`, details: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const posts = await runResponse.json()
    console.log(`Got ${posts.length} Reddit posts from Apify`)

    if (!posts.length) {
      return new Response(JSON.stringify({ success: true, trends: [], message: 'No posts found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Format posts for AI analysis — keep it lean
    const postSummaries = posts.slice(0, 30).map((p: any) => ({
      title: p.title || '',
      subreddit: p.subreddit || p.communityName || '',
      score: p.score || p.upVotes || 0,
      comments: p.numberOfComments || p.numComments || 0,
      text: (p.body || p.selftext || '').slice(0, 200),
    }))

    // Use AI to extract beauty trends from the posts
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You are a food industry trend analyst for Nestlé MENA. Analyze Reddit posts and extract 5-8 distinct food trends.
${brand ? `Focus on trends relevant to: ${brand}` : 'Cover home cooking, recipes, family meals, nutrition, and beverages.'}

For each trend, provide:
- title: concise trend name (3-6 words)
- description: 1-2 sentence explanation of what's trending and why it matters for food brands
- category: one of "Cooking", "Recipes", "Nutrition", "Beverages", "Snacking", "Ingredients", "Technology"
- relevance_score: 1-100 based on engagement and brand relevance

Respond ONLY with JSON, no markdown:
{ "trends": [{ "title": "...", "description": "...", "category": "...", "relevance_score": 80 }] }`,
          },
          {
            role: 'user',
            content: `Reddit food posts from this week:\n${JSON.stringify(postSummaries)}`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!aiResponse.ok) {
      const t = await aiResponse.text()
      console.error('AI error:', aiResponse.status, t)
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices?.[0]?.message?.content
    let parsed: { trends: any[] }

    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('Failed to parse AI response:', content)
      parsed = { trends: [] }
    }

    if (!parsed.trends?.length) {
      return new Response(JSON.stringify({ success: true, trends: [], message: 'AI found no trends' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Store trends in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const trendRows = parsed.trends.map((t: any) => ({
      title: t.title,
      description: t.description,
      category: t.category,
      source: 'reddit',
      relevance_score: Math.min(100, Math.max(0, t.relevance_score || 50)),
      brand: brand || null,
    }))

    // Clear old Reddit trends before inserting fresh ones
    await supabase.from('trends').delete().eq('source', 'reddit')

    const { error: insertErr } = await supabase.from('trends').insert(trendRows)
    if (insertErr) {
      console.error('DB insert error:', insertErr)
      return new Response(JSON.stringify({ error: 'Failed to store trends', details: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Stored ${trendRows.length} beauty trends from Reddit`)

    return new Response(JSON.stringify({ success: true, trends: trendRows, count: trendRows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
