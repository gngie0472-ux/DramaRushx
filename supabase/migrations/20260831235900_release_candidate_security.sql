/* DramaRush v1.0 Release Candidate security + private video storage. */

-- Coins are server-owned. Users may edit profile text/avatar, never the balance or role.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (name, avatar_url) ON public.profiles TO authenticated;

-- Replace the legacy public video URL with an internal Storage path.
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS video_path text;
ALTER TABLE public.episodes ALTER COLUMN video_url DROP NOT NULL;

-- Legacy URLs must not be used by the client. New/updated episodes should use video_path.
-- Existing legacy video_url values are intentionally retained for migration/backfill visibility to admins only.
REVOKE SELECT (video_url) ON public.episodes FROM anon, authenticated;
GRANT SELECT (video_path) ON public.episodes TO anon, authenticated;

-- Private bucket. Actual playback URLs are issued only by the signed-url Edge Function.
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "admin_upload_videos" ON storage.objects;
CREATE POLICY "admin_upload_videos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos' AND public.is_admin());

DROP POLICY IF EXISTS "admin_update_videos" ON storage.objects;
CREATE POLICY "admin_update_videos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'videos' AND public.is_admin())
WITH CHECK (bucket_id = 'videos' AND public.is_admin());

DROP POLICY IF EXISTS "admin_delete_videos" ON storage.objects;
CREATE POLICY "admin_delete_videos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'videos' AND public.is_admin());

-- Track one view event per user/session only after meaningful playback.
CREATE TABLE IF NOT EXISTS public.episode_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, episode_id, session_id)
);
ALTER TABLE public.episode_view_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no_direct_episode_view_events" ON public.episode_view_events;
CREATE INDEX IF NOT EXISTS idx_episode_view_events_episode ON public.episode_view_events(episode_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_episode_view(p_episode_id uuid, p_session_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series_id uuid;
  v_session uuid := COALESCE(p_session_id, gen_random_uuid());
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT series_id INTO v_series_id FROM public.episodes WHERE id = p_episode_id;
  IF v_series_id IS NULL THEN RETURN false; END IF;

  INSERT INTO public.episode_view_events(user_id, episode_id, session_id)
  VALUES (auth.uid(), p_episode_id, v_session)
  ON CONFLICT (user_id, episode_id, session_id) DO NOTHING;

  IF FOUND THEN
    UPDATE public.episodes SET view_count = view_count + 1 WHERE id = p_episode_id;
    UPDATE public.series SET view_count = view_count + 1 WHERE id = v_series_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_episode_view(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_episode_view(uuid, uuid) TO authenticated;

-- A single secure RPC centralizes entitlement checks for clients and the video Edge Function.
CREATE OR REPLACE FUNCTION public.can_watch_episode(p_episode_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.episodes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_episode FROM public.episodes WHERE id = p_episode_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_episode.is_free OR EXISTS (SELECT 1 FROM public.series WHERE id=v_episode.series_id AND is_free=true) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id=auth.uid() AND status='active' AND expiry_date > now()) THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM public.unlocked_episodes WHERE user_id=auth.uid() AND episode_id=p_episode_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.can_watch_episode(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_watch_episode(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_watch_episode_for_user(p_user_id uuid, p_episode_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.episodes%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_episode_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_episode FROM public.episodes WHERE id = p_episode_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_episode.is_free OR EXISTS (SELECT 1 FROM public.series WHERE id=v_episode.series_id AND is_free=true) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id=p_user_id AND status='active' AND expiry_date > now()) THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM public.unlocked_episodes WHERE user_id=p_user_id AND episode_id=p_episode_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.can_watch_episode_for_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_watch_episode_for_user(uuid, uuid) TO service_role;
