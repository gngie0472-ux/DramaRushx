/*
# DramaRush Triggers and Server-Side Functions

1. Triggers
- `handle_new_user`: Auto-creates a profile row when a new auth.users row is inserted.
  - Uses a SECURITY DEFINER function so it runs with elevated privileges.
  - Sets default role='user', coins=0.

2. SECURITY DEFINER Functions
- `unlock_episode(p_episode_id uuid)`: Atomically unlocks a paid episode for the calling user.
  - Validates the episode exists and is not free (free episodes need no unlock).
  - Checks the user has enough coins and the episode is not already unlocked.
  - Deducts coins from profiles, inserts into unlocked_episodes, logs a transaction.
  - All in one atomic operation. Returns success/failure with message.
  - Search path set to 'public' to prevent search_path injection.

- `has_active_subscription()`: Returns boolean indicating if the calling user has an active subscription.
  - Checks subscriptions table for status='active' and expiry_date > now().
  - Search path set to 'public'.

- `get_user_coins()`: Returns the calling user's coin balance.
  - Search path set to 'public'.

3. Security
- All functions are SECURITY DEFINER so they run with the function owner's privileges.
- All functions set search_path = 'public' to prevent search_path injection attacks.
- EXECUTE on unlock_episode and has_active_subscription granted to authenticated.
- EXECUTE on get_user_coins granted to authenticated.
- The handle_new_user trigger function has EXECUTE granted to the postgres role (trigger execution).
*/

-- Trigger function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, coins)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    'user',
    0
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Unlock an episode by spending coins
CREATE OR REPLACE FUNCTION public.unlock_episode(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_episode episodes%ROWTYPE;
  v_user_coins int;
  v_already_unlocked boolean;
  v_result jsonb;
BEGIN
  -- Fetch the episode
  SELECT * INTO v_episode FROM episodes WHERE id = p_episode_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Episode not found');
  END IF;

  -- Free episodes don't need unlocking
  IF v_episode.is_free THEN
    RETURN jsonb_build_object('success', true, 'message', 'Episode is free');
  END IF;

  -- Check if already unlocked
  SELECT EXISTS(
    SELECT 1 FROM unlocked_episodes
    WHERE user_id = auth.uid() AND episode_id = p_episode_id
  ) INTO v_already_unlocked;

  IF v_already_unlocked THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already unlocked');
  END IF;

  -- Check coin balance
  SELECT coins INTO v_user_coins FROM profiles WHERE id = auth.uid();
  IF v_user_coins < v_episode.coin_price THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins', 'coins_needed', v_episode.coin_price, 'coins_balance', v_user_coins);
  END IF;

  -- Deduct coins
  UPDATE profiles SET coins = coins - v_episode.coin_price WHERE id = auth.uid();

  -- Record unlock
  INSERT INTO unlocked_episodes (user_id, episode_id)
  VALUES (auth.uid(), p_episode_id);

  -- Log transaction
  INSERT INTO transactions (user_id, type, coins, description)
  VALUES (auth.uid(), 'spend', -v_episode.coin_price, 'Unlock episode: ' || v_episode.title);

  RETURN jsonb_build_object('success', true, 'message', 'Episode unlocked', 'coins_remaining', v_user_coins - v_episode.coin_price);
END;
$$;

-- Check if user has active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_has boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM subscriptions
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND expiry_date > now()
  ) INTO v_has;
  RETURN v_has;
END;
$$;

-- Get user's coin balance
CREATE OR REPLACE FUNCTION public.get_user_coins()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_coins int;
BEGIN
  SELECT coins INTO v_coins FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(v_coins, 0);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.unlock_episode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_coins() TO authenticated;
