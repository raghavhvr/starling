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
    const { handles } = await req.json()
    if (!Array.isArray(handles) || handles.length === 0) {
      return new Response(JSON.stringify({ error: 'handles array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const cleanHandles = handles.slice(0, 30).map((h: string) =>
      h.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
    )
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const results: any[] = []

    for (const username of cleanHandles) {
      try {
        const r = await fetch(`https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(username)}`, {
          headers: { 'x-api-key': API_KEY }
        })
        const j = await r.json()
        const u = j?.data?.user
        if (!u) {
          results.push({ name: username, status: j?.error || 'not_found' })
          continue
        }
        const followers = u.edge_followed_by?.count ?? 0
        const picSrc = u.profile_pic_url_hd || u.profile_pic_url || null
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
          name: u.full_name || username,
          handle: `@${username}`,
          platform: 'instagram',
          followers,
          bio: u.biography || null,
          status: 'active',
        }
        if (storedAvatarUrl) creatorData.avatar_url = storedAvatarUrl
        await supabase.from('creators').upsert(creatorData, { onConflict: 'handle', ignoreDuplicates: false })
        const { data: row } = await supabase.from('creators').select('id').eq('handle', `@${username}`).single()
        if (row) {
          await supabase.from('creator_platforms').upsert({
            creator_id: row.id, platform: 'instagram', handle: `@${username}`,
            followers, engagement_rate: 0,
            avatar_url: storedAvatarUrl || picSrc || null, bio: u.biography || null,
            profile_url: `https://instagram.com/${username}`,
            platform_data: { full_name: u.full_name || username, verified: u.is_verified },
          }, { onConflict: 'creator_id,platform', ignoreDuplicates: false })
        }
        results.push({ name: u.full_name || username, status: 'ok', avatar_stored: !!storedAvatarUrl })
      } catch (e: any) {
        console.error('IG', username, e)
        results.push({ name: username, status: 'error', error: e?.message })
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
