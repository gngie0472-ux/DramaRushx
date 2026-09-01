/* Secure monetization catalog, idempotent purchase grants, and exact owner metrics. */

CREATE TABLE IF NOT EXISTS public.store_products (
  product_id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('coins','subscription')),
  coins int NOT NULL DEFAULT 0 CHECK (coins >= 0),
  plan text CHECK (plan IN ('monthly','yearly')),
  price_usd numeric(10,2) NOT NULL CHECK (price_usd >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.store_products (product_id, kind, coins, price_usd) VALUES
  ('dramarush_coins_100', 'coins', 100, 0.99),
  ('dramarush_coins_550', 'coins', 550, 4.99),
  ('dramarush_coins_1200', 'coins', 1200, 9.99),
  ('dramarush_coins_2500', 'coins', 2500, 19.99)
ON CONFLICT (product_id) DO UPDATE SET coins = EXCLUDED.coins, price_usd = EXCLUDED.price_usd;

INSERT INTO public.store_products (product_id, kind, plan, price_usd) VALUES
  ('dramarush_premium_monthly', 'subscription', 'monthly', 4.99),
  ('dramarush_premium_yearly', 'subscription', 'yearly', 39.99)
ON CONFLICT (product_id) DO UPDATE SET plan = EXCLUDED.plan, price_usd = EXCLUDED.price_usd;

ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_active_store_products" ON public.store_products;
CREATE POLICY "public_read_active_store_products" ON public.store_products
  FOR SELECT TO anon, authenticated USING (active = true);

/* One store transaction must never grant coins twice. */
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_purchase_reference
  ON public.transactions(reference_id)
  WHERE type = 'purchase' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.owner_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users bigint;
  v_views bigint;
  v_coins bigint;
  v_revenue numeric;
  v_withdrawn numeric;
  v_reserved numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT count(*) INTO v_users FROM profiles;
  SELECT COALESCE(sum(view_count),0) INTO v_views FROM episodes;
  SELECT COALESCE(sum(coins),0) INTO v_coins FROM transactions WHERE type='purchase' AND status='completed';
  SELECT COALESCE(sum(amount),0) INTO v_revenue FROM transactions WHERE type='purchase' AND status='completed';
  SELECT COALESCE(sum(amount),0) INTO v_withdrawn FROM revenue_withdrawals WHERE status='paid';
  SELECT COALESCE(sum(amount),0) INTO v_reserved FROM revenue_withdrawals WHERE status IN ('pending','processing');

  RETURN jsonb_build_object(
    'users', v_users,
    'total_views', v_views,
    'coins_sold', v_coins,
    'revenue', v_revenue,
    'withdrawn', v_withdrawn,
    'pending_withdrawals', v_reserved,
    'withdrawable', GREATEST(0, v_revenue - v_withdrawn - v_reserved)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_metrics() TO authenticated;

/* Service-role-only function used by the purchase verification Edge Function. */
CREATE OR REPLACE FUNCTION public.grant_verified_purchase(
  p_user_id uuid,
  p_product_id text,
  p_reference_id text,
  p_amount numeric,
  p_store text DEFAULT 'google_play',
  p_expiry_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product store_products%ROWTYPE;
  v_existing transactions%ROWTYPE;
  v_expiry timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_reference_id IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION 'missing purchase fields';
  END IF;

  SELECT * INTO v_product FROM store_products WHERE product_id = p_product_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive product';
  END IF;

  SELECT * INTO v_existing FROM transactions WHERE reference_id = p_reference_id LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'coins', v_existing.coins);
  END IF;

  IF v_product.kind = 'coins' THEN
    UPDATE profiles SET coins = coins + v_product.coins WHERE id = p_user_id;
    INSERT INTO transactions(user_id, type, amount, coins, status, description, reference_id)
    VALUES (p_user_id, 'purchase', COALESCE(p_amount, v_product.price_usd), v_product.coins, 'completed', 'Google Play: ' || p_product_id, p_reference_id);
    RETURN jsonb_build_object('success', true, 'coins', v_product.coins, 'kind', 'coins');
  END IF;

  IF v_product.kind = 'subscription' THEN
    v_expiry := COALESCE(p_expiry_date, CASE WHEN v_product.plan = 'yearly' THEN now() + interval '1 year' ELSE now() + interval '1 month' END);
    INSERT INTO subscriptions(user_id, plan, status, start_date, expiry_date, reference_id)
    VALUES (p_user_id, v_product.plan, 'active', now(), v_expiry, p_reference_id)
    ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, status='active', start_date=EXCLUDED.start_date, expiry_date=EXCLUDED.expiry_date, reference_id=EXCLUDED.reference_id;
    INSERT INTO transactions(user_id, type, amount, coins, status, description, reference_id)
    VALUES (p_user_id, 'purchase', COALESCE(p_amount, v_product.price_usd), 0, 'completed', 'Google Play subscription: ' || p_product_id, p_reference_id);
    RETURN jsonb_build_object('success', true, 'kind', 'subscription', 'plan', v_product.plan, 'expiry_date', v_expiry);
  END IF;

  RAISE EXCEPTION 'unsupported product kind';
END;
$$;

REVOKE ALL ON FUNCTION public.grant_verified_purchase(uuid,text,text,numeric,text,timestamptz) FROM PUBLIC, anon, authenticated;
