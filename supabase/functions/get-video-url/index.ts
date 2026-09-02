import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (req) => {
  /* ==========================================================
     CORS
     ========================================================== */

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  /* ==========================================================
     ONLY POST
     ========================================================== */

  if (req.method !== 'POST') {
    return json(
      {
        error: 'Method not allowed',
      },
      405,
    );
  }

  try {
    /* ========================================================
       AUTHENTICATION
       ======================================================== */

    const authorization = req.headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return json(
        {
          error: 'Authentication required',
        },
        401,
      );
    }

    const jwt = authorization
      .slice('Bearer '.length)
      .trim();

    if (!jwt) {
      return json(
        {
          error: 'Authentication required',
        },
        401,
      );
    }

    /*
      Validate the user's Supabase session.

      IMPORTANT:
      service_role_key stays on the server.
      It is NEVER returned to the application.
    */

    const {
      data: userData,
      error: userError,
    } = await admin.auth.getUser(jwt);

    if (userError || !userData.user) {
      return json(
        {
          error: 'Invalid or expired session',
        },
        401,
      );
    }

    /* ========================================================
       REQUEST BODY
       ======================================================== */

    const body = await req.json().catch(() => null);

    const episodeId =
      typeof body?.episodeId === 'string'
        ? body.episodeId.trim()
        : '';

    if (!episodeId) {
      return json(
        {
          error: 'Missing episodeId',
        },
        400,
      );
    }

    /* ========================================================
       GET EPISODE
       ======================================================== */

    const {
      data: episode,
      error: episodeError,
    } = await admin
      .from('episodes')
      .select(
        'id, series_id, video_path, is_free',
      )
      .eq('id', episodeId)
      .maybeSingle();

    if (episodeError) {
      console.error(
        'Episode lookup error:',
        episodeError,
      );

      return json(
        {
          error: 'Unable to load episode',
        },
        500,
      );
    }

    if (!episode) {
      return json(
        {
          error: 'Episode not found',
        },
        404,
      );
    }

    /* ========================================================
       VIDEO PATH CHECK
       ======================================================== */

    if (
      !episode.video_path ||
      !episode.video_path.trim()
    ) {
      return json(
        {
          error: 'Video is not uploaded yet',
        },
        404,
      );
    }

    /* ========================================================
       ENTITLEMENT CHECK
       ========================================================

       This calls the SQL function created in our database:

           public.can_watch_episode(uuid)

       It checks:

       - Free episode
       - Free series
       - Active subscription
       - Purchased/unlocked episode
       ======================================================== */

    const {
  data: allowed,
  error: entitlementError,
} = await admin.rpc(
  'can_watch_episode_for_user',
  {
    p_user_id: userData.user.id,
    p_episode_id: episodeId,
  },
);

    if (entitlementError) {
      console.error(
        'Entitlement error:',
        entitlementError,
      );

      return json(
        {
          error: 'Unable to verify viewing permission',
        },
        500,
      );
    }

    if (!allowed) {
      return json(
        {
          error:
            'Not entitled to watch this episode',
        },
        403,
      );
    }

    /* ========================================================
       CREATE SHORT-LIVED SIGNED URL
       ========================================================

       300 seconds = 5 minutes.

       The Storage bucket remains PRIVATE.

       The user receives only a temporary signed URL.
       ======================================================== */

    const expiresIn = 300;

    const {
      data: signed,
      error: signedError,
    } = await admin.storage
      .from('videos')
      .createSignedUrl(
        episode.video_path,
        expiresIn,
      );

    if (
      signedError ||
      !signed?.signedUrl
    ) {
      console.error(
        'Signed URL error:',
        signedError,
      );

      return json(
        {
          error:
            'Unable to create secure video URL',
        },
        500,
      );
    }

    /* ========================================================
       SUCCESS
       ======================================================== */

    return json({
      success: true,

      episodeId: episode.id,

      url: signed.signedUrl,

      expiresIn,
    });
  } catch (error) {
    /* ========================================================
       SERVER ERROR
       ======================================================== */

    console.error(
      'get-video-url error:',
      error,
    );

    return json(
      {
        error:
          'Unable to authorize video',
      },
      500,
    );
  }
});
