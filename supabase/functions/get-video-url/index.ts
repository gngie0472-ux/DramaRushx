import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const auth = req.headers.get('Authorization') || '';
    const jwt = auth.replace(/^Bearer\s+/i, '');
    let userId: string | null = null;
    if (jwt) {
      const { data: userData } = await admin.auth.getUser(jwt);
      userId = userData.user?.id || null;
    }

    const body = await req.json();
    const episodeId = String(body.episodeId || '');
    if (!episodeId) return Response.json({ error: 'Missing episodeId' }, { status: 400 });

    const { data: episode, error: episodeError } = await admin
      .from('episodes')
      .select('id, video_path')
      .eq('id', episodeId)
      .maybeSingle();
    if (episodeError) throw episodeError;
    if (!episode?.video_path) return Response.json({ error: 'Video is not uploaded yet' }, { status: 404 });

    let allowed = false;
    if (userId) {
      const { data, error: entitlementError } = await admin.rpc('can_watch_episode_for_user', {
        p_user_id: userId,
        p_episode_id: episodeId,
      });
      if (entitlementError) throw entitlementError;
      allowed = !!data;
    } else {
      const { data: freeData, error: freeError } = await admin
        .from('episodes')
        .select('is_free, series_id')
        .eq('id', episodeId)
        .maybeSingle();
      if (freeError) throw freeError;
      if (freeData?.is_free) allowed = true;
      if (!allowed && freeData?.series_id) {
        const { data: series } = await admin.from('series').select('is_free').eq('id', freeData.series_id).maybeSingle();
        allowed = !!series?.is_free;
      }
    }
    if (!allowed) return Response.json({ error: 'Not entitled to watch this episode' }, { status: 403 });

    const { data: signed, error: signedError } = await admin.storage
      .from('videos')
      .createSignedUrl(episode.video_path, 300);
    if (signedError || !signed?.signedUrl) throw signedError || new Error('Unable to create signed URL');

    return Response.json({ url: signed.signedUrl, expiresIn: 300 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Unable to authorize video' }, { status: 500 });
  }
});
