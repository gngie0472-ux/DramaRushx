/* DramaRush production hardening
   - Secure admin access at database level
   - Make subscriptions actually grant access
   - Treat free series as free
   - Prevent concurrent coin-spend races
   - Add atomic episode view counting
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Admin policies. These are enforced by Postgres, not merely by the UI.
DROP POLICY IF EXISTS "admin_read_profiles" ON profiles;
CREATE POLICY "admin_read_profiles" ON profiles FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_categories" ON categories;
CREATE POLICY "admin_read_categories" ON categories FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_categories" ON categories;
CREATE POLICY "admin_insert_categories" ON categories FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_categories" ON categories;
CREATE POLICY "admin_update_categories" ON categories FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_categories" ON categories;
CREATE POLICY "admin_delete_categories" ON categories FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_series" ON series;
CREATE POLICY "admin_insert_series" ON series FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_series" ON series;
CREATE POLICY "admin_update_series" ON series FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_series" ON series;
CREATE POLICY "admin_delete_series" ON series FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_episodes" ON episodes;
CREATE POLICY "admin_insert_episodes" ON episodes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_episodes" ON episodes;
CREATE POLICY "admin_update_episodes" ON episodes FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_episodes" ON episodes;
CREATE POLICY "admin_delete_episodes" ON episodes FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_transactions" ON transactions;
CREATE POLICY "admin_read_transactions" ON transactions FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "admin_read_subscriptions" ON subscriptions;
CREATE POLICY "admin_read_subscriptions" ON subscriptions FOR SELECT TO authenticated
  USING (public.is_admin());

-- Replace unlock logic with entitlement checks and a row lock around the balance.
CREATE OR REPLACE FUNCTION public.unlock_episode(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.episodes%ROWTYPE;
  v_user_coins int;
  v_is_subscriber boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;

  SELECT * INTO v_episode
  FROM public.episodes
  WHERE id = p_episode_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Episode not found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.unlocked_episodes
    WHERE user_id = auth.uid() AND episode_id = p_episode_id
  ) INTO v_is_subscriber;
  IF v_is_subscriber THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already unlocked');
  END IF;

  IF v_episode.is_free OR EXISTS (
    SELECT 1 FROM public.series s
    WHERE s.id = v_episode.series_id AND s.is_free = true
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Episode is free');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND expiry_date > now()
  ) INTO v_is_subscriber;
  IF v_is_subscriber THEN
    RETURN jsonb_build_object('success', true, 'message', 'Unlocked by subscription');
  END IF;

  -- Lock the profile row so two simultaneous unlocks cannot spend the same coins.
  SELECT coins INTO v_user_coins
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF v_user_coins IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found');
  END IF;

  IF v_episode.coin_price <= 0 THEN
    INSERT INTO public.unlocked_episodes (user_id, episode_id)
    VALUES (auth.uid(), p_episode_id)
    ON CONFLICT (user_id, episode_id) DO NOTHING;
    RETURN jsonb_build_object('success', true, 'message', 'Episode unlocked');
  END IF;

  IF v_user_coins < v_episode.coin_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient coins',
      'coins_needed', v_episode.coin_price,
      'coins_balance', v_user_coins
    );
  END IF;

  UPDATE public.profiles
  SET coins = coins - v_episode.coin_price
  WHERE id = auth.uid();

  INSERT INTO public.unlocked_episodes (user_id, episode_id)
  VALUES (auth.uid(), p_episode_id)
  ON CONFLICT (user_id, episode_id) DO NOTHING;

  INSERT INTO public.transactions (user_id, type, coins, description)
  VALUES (auth.uid(), 'spend', -v_episode.coin_price, 'Unlock episode: ' || v_episode.title);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Episode unlocked',
    'coins_remaining', v_user_coins - v_episode.coin_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_episode(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_episode_view(p_episode_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series_id uuid;
BEGIN
  SELECT series_id INTO v_series_id FROM public.episodes WHERE id = p_episode_id;
  IF v_series_id IS NULL THEN RETURN false; END IF;

  UPDATE public.episodes SET view_count = view_count + 1 WHERE id = p_episode_id;
  UPDATE public.series SET view_count = view_count + 1 WHERE id = v_series_id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_episode_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_episode_view(uuid) TO authenticated;
