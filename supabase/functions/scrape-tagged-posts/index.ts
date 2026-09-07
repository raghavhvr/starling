import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { handles, creatorIds, maxItems = 30 } = await req.json()
    if (!handles || !Array.isArray(handles) || handles.length === 0) {
      return new Response(JSON.stringify({ error: 'handles array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const cleanHandles = handles.slice(0, 20).map((h: string) =>
      h.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
    )

    console.log('Scraping tagged posts for:', cleanHandles)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const results: { username: string; status: string; error?: string; collaborations_found?: number }[] = []

    // Process each handle individually since the actor takes usernames array
    // but we need to map results back to creator IDs
    for (let i = 0; i < cleanHandles.length; i++) {
      const username = cleanHandles[i]
      const creatorId = creatorIds?.[i] || null

      // Resolve creator ID if not provided
      let resolvedCreatorId = creatorId
      if (!resolvedCreatorId) {
        const { data: creatorRow } = await supabase
          .from('creators')
          .select('id')
          .eq('handle', `@${username}`)
          .single()
        resolvedCreatorId = creatorRow?.id
      }

      if (!resolvedCreatorId) {
        results.push({ username, status: 'skipped', error: 'Creator not found in database' })
        continue
      }

      try {
        // Call the thenetaji/instagram-user-tagged-posts-scraper actor
        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/thenetaji~instagram-user-tagged-posts-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usernames: [username],
              maxItems: maxItems,
            }),
          }
        )

        if (!runResponse.ok) {
          const errText = await runResponse.text()
          console.error(`Apify tagged posts error for ${username}:`, errText)
          results.push({ username, status: 'error', error: `Apify request failed [${runResponse.status}]` })
          continue
        }

        const taggedPosts = await runResponse.json()
        console.log(`Got ${taggedPosts.length} tagged posts for ${username}`)

        let collaborationsFound = 0

        for (const post of taggedPosts) {
          const shortcode = post.shortCode || post.shortcode || post.code || post.id
          if (!shortcode) continue

          // The user who made the post (the tagger) is the brand/collaborator
          const taggerUsername = post.ownerUsername || post.owner?.username || post.user?.username || ''
          const taggerFullName = post.ownerFullName || post.owner?.full_name || post.user?.full_name || ''
          const brandName = taggerFullName || taggerUsername || 'Unknown Brand'

          // Skip if the tagger is the creator themselves
          if (taggerUsername.toLowerCase() === username.toLowerCase()) continue

          const caption = post.caption || post.text || ''
          const postImgUrl = post.displayUrl || post.imageUrl || post.url || post.thumbnailUrl || null

          // Determine collaboration type from caption signals
          const isPaidPartnership = post.isPaidPartnership || /paid partnership/i.test(caption)
          const isSponsored = /(?:#ad\b|#sponsored|#partner\b)/i.test(caption)
          const isGifted = /(?:#gifted\b|#pr\b|#seeded)/i.test(caption)
          const isAmbassador = /ambassador/i.test(caption)

          const collabType = isPaidPartnership ? 'paid_partnership' :
            isSponsored ? 'sponsored' :
            isAmbassador ? 'ambassador' :
            isGifted ? 'gifted' : 'tagged'

          // Download and store post image
          let storedPostUrl: string | null = null
          if (postImgUrl) {
            try {
              const imgResp = await fetch(postImgUrl)
              if (imgResp.ok) {
                const imgBlob = await imgResp.blob()
                const postPath = `posts/${username}/tagged_${shortcode}.jpg`
                const { error: upErr } = await supabase.storage
                  .from('avatars')
                  .upload(postPath, imgBlob, { contentType: 'image/jpeg', upsert: true })
                if (!upErr) {
                  storedPostUrl = supabase.storage.from('avatars').getPublicUrl(postPath).data.publicUrl
                }
              }
            } catch (e) {
              console.error(`Failed to download tagged post image ${shortcode}:`, e)
            }
          }

          const { error: collabErr } = await supabase
            .from('creator_collaborations')
            .upsert({
              creator_id: resolvedCreatorId,
              brand_name: brandName,
              platform: 'instagram',
              post_url: `https://www.instagram.com/p/${shortcode}/`,
              post_date: post.timestamp ? new Date(post.timestamp).toISOString() :
                post.takenAtTimestamp ? new Date(post.takenAtTimestamp * 1000).toISOString() : null,
              likes: post.likesCount ?? post.likes ?? 0,
              comments: post.commentsCount ?? post.comments ?? 0,
              views: post.videoViewCount ?? post.views ?? 0,
              collaboration_type: collabType,
              image_url: storedPostUrl || postImgUrl,
              caption: caption.slice(0, 2000),
              shortcode: `tagged_${shortcode}`,
            }, { onConflict: 'creator_id,shortcode', ignoreDuplicates: false })

          if (!collabErr) collaborationsFound++
          else console.error(`Error upserting tagged collab ${shortcode}:`, collabErr)
        }

        results.push({ username, status: 'ok', collaborations_found: collaborationsFound })
      } catch (e) {
        console.error(`Error processing tagged posts for ${username}:`, e)
        results.push({ username, status: 'error', error: e instanceof Error ? e.message : 'Unknown error' })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
