import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function scrapeReddit(topic: string, token: string): Promise<any[]> {
  const searchUrl = `https://www.reddit.com/search/?q=${encodeURIComponent(topic)}&sort=relevance&t=month`
  const resp = await fetch(
    `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: searchUrl }],
        maxItems: 10,
        sort: 'relevance',
        time: 'month',
      }),
    }
  )
  if (!resp.ok) {
    console.error('Reddit scrape failed:', resp.status)
    return []
  }
  const posts = await resp.json()
  return posts.map((p: any) => ({
    platform: 'reddit',
    author: p.author || p.username || 'anonymous',
    content: (p.title || '') + (p.body || p.selftext ? '\n' + (p.body || p.selftext || '').slice(0, 500) : ''),
    source_url: p.url || p.permalink ? `https://reddit.com${p.permalink}` : null,
    likes: p.score || p.upVotes || 0,
    replies: p.numberOfComments || p.numComments || 0,
    posted_at: p.createdAt || p.created || null,
    metadata: { subreddit: p.subreddit || p.communityName || '' },
  }))
}

async function scrapeInstagram(topic: string, token: string): Promise<any[]> {
  const hashtag = topic.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags: [hashtag],
          resultsLimit: 8,
        }),
      }
    )
    if (!resp.ok) {
      console.error('Instagram scrape failed:', resp.status)
      return []
    }
    const posts = await resp.json()
    return posts.slice(0, 8).map((p: any) => ({
      platform: 'instagram',
      author: p.ownerUsername || p.owner?.username || 'unknown',
      content: (p.caption || '').slice(0, 500),
      source_url: p.url || p.shortCode ? `https://instagram.com/p/${p.shortCode}` : null,
      likes: p.likesCount || p.likes || 0,
      replies: p.commentsCount || p.comments || 0,
      posted_at: p.timestamp || p.takenAtTimestamp ? new Date((p.takenAtTimestamp || 0) * 1000).toISOString() : null,
      metadata: { hashtag },
    }))
  } catch (e) {
    console.error('Instagram scrape error:', e)
    return []
  }
}

async function scrapeTikTok(topic: string, token: string): Promise<any[]> {
  try {
    // Using get-leads/all-in-one-tiktok-scraper with search mode
    const resp = await fetch(
      `https://api.apify.com/v2/acts/get-leads~all-in-one-tiktok-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scrapeMode: 'tiktok-search-scraper',
          searchQueries: [topic],
          resultsPerPage: 8,
        }),
      }
    )
    if (!resp.ok) {
      console.error('TikTok scrape failed:', resp.status, await resp.text().catch(() => ''))
      return []
    }
    const posts = await resp.json()
    return posts.slice(0, 8).map((p: any) => ({
      platform: 'tiktok',
      author: p.authorMeta?.name || p.author?.uniqueId || p.authorName || p.username || 'unknown',
      content: (p.text || p.desc || p.description || '').slice(0, 500),
      source_url: p.webVideoUrl || p.url || null,
      likes: p.diggCount || p.stats?.diggCount || p.likes || 0,
      replies: p.commentCount || p.stats?.commentCount || p.comments || 0,
      posted_at: p.createTime ? new Date(p.createTime * 1000).toISOString() : p.createdAt || null,
      metadata: { views: p.playCount || p.stats?.playCount || p.views || 0 },
    }))
  } catch (e) {
    console.error('TikTok scrape error:', e)
    return []
  }
}

async function scrapeFacebook(topic: string, token: string): Promise<any[]> {
  try {
    // Using apify/facebook-posts-scraper with search URL
    const searchUrl = `https://www.facebook.com/search/posts/?q=${encodeURIComponent(topic)}`
    const resp = await fetch(
      `https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: searchUrl }],
          resultsLimit: 8,
        }),
      }
    )
    if (!resp.ok) {
      console.error('Facebook scrape failed:', resp.status, await resp.text().catch(() => ''))
      return []
    }
    const posts = await resp.json()
    return posts.slice(0, 8).map((p: any) => ({
      platform: 'facebook',
      author: p.authorName || p.pageName || p.user?.name || p.author || 'unknown',
      content: (p.text || p.postText || p.message || '').slice(0, 500),
      source_url: p.url || p.postUrl || null,
      likes: p.likes || p.likesCount || p.reactions || 0,
      replies: p.comments || p.commentsCount || 0,
      posted_at: p.time || p.timestamp || p.date || null,
      metadata: { shares: p.shares || p.sharesCount || 0 },
    }))
  } catch (e) {
    console.error('Facebook scrape error:', e)
    return []
  }
}

async function scrapeTwitter(topic: string, token: string): Promise<any[]> {
  try {
    // Using get-leads/all-in-one-x-scraper with tweet search mode
    const resp = await fetch(
      `https://api.apify.com/v2/acts/get-leads~all-in-one-x-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scrapeMode: 'x-tweet-scraper',
          searchQueries: [topic],
          maxResults: 8,
        }),
      }
    )
    if (!resp.ok) {
      console.error('Twitter/X scrape failed:', resp.status, await resp.text().catch(() => ''))
      return []
    }
    const posts = await resp.json()
    return posts.slice(0, 8).map((p: any) => ({
      platform: 'twitter',
      author: p.author?.userName || p.user?.screen_name || p.username || p.authorName || 'unknown',
      content: (p.text || p.full_text || p.tweetText || '').slice(0, 500),
      source_url: p.url || p.tweetUrl || null,
      likes: p.likeCount || p.favorite_count || p.likes || 0,
      replies: p.replyCount || p.reply_count || p.replies || 0,
      posted_at: p.createdAt || p.created_at || null,
      metadata: { retweets: p.retweetCount || p.retweet_count || 0, views: p.viewCount || p.views || 0 },
    }))
  } catch (e) {
    console.error('Twitter/X scrape error:', e)
    return []
  }
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

    const { trend_id, topic, platforms = ['reddit', 'instagram', 'tiktok', 'facebook', 'twitter'] } = await req.json()
    if (!trend_id || !topic) {
      return new Response(JSON.stringify({ error: 'trend_id and topic are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Scraping comments for trend "${topic}" on platforms:`, platforms)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Scrape platforms in parallel
    const scrapePromises: Promise<any[]>[] = []
    if (platforms.includes('reddit')) scrapePromises.push(scrapeReddit(topic, APIFY_API_TOKEN))
    if (platforms.includes('instagram')) scrapePromises.push(scrapeInstagram(topic, APIFY_API_TOKEN))
    if (platforms.includes('tiktok')) scrapePromises.push(scrapeTikTok(topic, APIFY_API_TOKEN))
    if (platforms.includes('facebook')) scrapePromises.push(scrapeFacebook(topic, APIFY_API_TOKEN))
    if (platforms.includes('twitter')) scrapePromises.push(scrapeTwitter(topic, APIFY_API_TOKEN))

    const results = await Promise.allSettled(scrapePromises)
    const allComments = results
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    console.log(`Total comments scraped: ${allComments.length}`)

    if (allComments.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: 'No comments found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Clear old comments for this trend, then insert new ones
    await supabase.from('trend_comments').delete().eq('trend_id', trend_id)

    const rows = allComments.map(c => ({
      trend_id,
      platform: c.platform,
      author: c.author,
      content: c.content,
      source_url: c.source_url,
      likes: c.likes || 0,
      replies: c.replies || 0,
      posted_at: c.posted_at,
      metadata: c.metadata || {},
    }))

    const { error: insertErr } = await supabase.from('trend_comments').insert(rows)
    if (insertErr) {
      console.error('Insert error:', insertErr)
      return new Response(JSON.stringify({ error: 'Failed to store comments' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const platformCounts = allComments.reduce((acc: Record<string, number>, c) => {
      acc[c.platform] = (acc[c.platform] || 0) + 1
      return acc
    }, {})

    return new Response(JSON.stringify({
      success: true,
      count: allComments.length,
      platforms: platformCounts,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
