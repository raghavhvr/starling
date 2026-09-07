import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const API_KEY = Deno.env.get('SCRAPECREATORS_API_KEY')
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'SCRAPECREATORS_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const { handles, creatorIds } = await req.json()
    if (!Array.isArray(handles) || handles.length === 0) {
      return new Response(JSON.stringify({ error: 'handles array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const cleanHandles = handles.slice(0, 30).map((h: string) =>
      h.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '').replace(/\/$/, '')
    )
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const results: any[] = []

    for (let i = 0; i < cleanHandles.length; i++) {
      const username = cleanHandles[i]
      const passedId = creatorIds?.[i] || null
      try {
        const r = await fetch(`https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(username)}`, {
          headers: { 'x-api-key': API_KEY }
        })
        const j = await r.json()
        const u = j?.user
        const stats = j?.stats || j?.statsV2 || {}
        if (!u) {
          results.push({ username, status: j?.message || 'not_found' })
          continue
        }
        const followers = Number(stats.followerCount || stats.followers || 0)
        const hearts = Number(stats.heartCount || stats.heart || 0)
        const videos = Number(stats.videoCount || 0)
        const engRate = followers > 0 && videos > 0 ? Math.round(((hearts / videos) / followers) * 100 * 100) / 100 : 0
        const picSrc = u.avatarLarger || u.avatarMedium || u.avatarThumb || null
        let storedAvatarUrl: string | null = null
        if (picSrc) {
          try {
            const img = await fetch(picSrc)
            if (img.ok) {
              const blob = await img.blob()
              const filePath = `${username}.jpg`
              await supabase.storage.from('avatars').remove([filePath])
              const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })
              if (!upErr) storedAvatarUrl = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl
            }
          } catch (e) { console.error('avatar dl', username, e) }
        }
        const creatorData: Record<string, unknown> = {
          name: u.nickname || username,
          handle: `@${username}`,
          platform: 'tiktok',
          followers,
          engagement_rate: engRate,
          total_posts: videos,
          bio: u.signature || null,
          status: 'active',
        }
        if (storedAvatarUrl) creatorData.avatar_url = storedAvatarUrl
        let resolvedId = passedId
        if (passedId) {
          await supabase.from('creators').update(creatorData).eq('id', passedId)
        } else {
          const { data: newRow } = await supabase.from('creators')
            .upsert(creatorData, { onConflict: 'handle', ignoreDuplicates: false })
            .select('id').single()
          resolvedId = newRow?.id || null
        }
        if (resolvedId) {
          await supabase.from('creator_platforms').upsert({
            creator_id: resolvedId, platform: 'tiktok', handle: `@${username}`,
            followers, engagement_rate: engRate,
            avatar_url: storedAvatarUrl || picSrc || null, bio: u.signature || null,
            profile_url: `https://www.tiktok.com/@${username}`,
            platform_data: { hearts, videos, verified: u.verified || false, nickname: u.nickname || username },
          }, { onConflict: 'creator_id,platform', ignoreDuplicates: false })
        }
        results.push({ username, status: 'ok', followers, avatar_stored: !!storedAvatarUrl })
      } catch (e: any) {
        console.error('TT', username, e)
        results.push({ username, status: 'error', error: e?.message })
      }
    }
    return new Response(JSON.stringify({ success: true, count: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
