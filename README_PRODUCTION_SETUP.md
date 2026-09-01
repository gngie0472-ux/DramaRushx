# DramaRush — Production Monetization Setup

This build includes:
- Owner-only analytics dashboard.
- Google Play purchase verification on Supabase Edge Functions.
- Consumable coin packs and monthly/yearly subscriptions.
- Idempotent server-side entitlement granting.
- Owner withdrawal requests.

## Important billing architecture

Coins and subscriptions are digital goods. On Android, the app uses Google Play Billing. Expo's current guidance requires a development/production native build for IAP; Expo Go is not sufficient. `expo-iap` is included in `package.json`.

Google Play itself pays the developer according to the developer account's payout schedule. The in-app `Withdraw` screen does **not** withdraw Google Play funds directly. It creates a withdrawal request for an independently configured payout provider. Do not promise instant withdrawals from Google Play revenue.

## Before the first production build

1. Create/configure the Android app in Google Play Console with package `com.dramarush.app`.
2. Create these one-time products:
   - `dramarush_coins_100`
   - `dramarush_coins_550`
   - `dramarush_coins_1200`
   - `dramarush_coins_2500`
3. Create subscriptions:
   - `dramarush_premium_monthly`
   - `dramarush_premium_yearly`
4. Prices in the SQL catalog are the accounting baseline. Update them to match your Play Console base pricing if you choose different prices.
5. Create a Google Cloud service account, enable Google Play Developer API, and grant the service account the required Play Console permissions.
6. Set Supabase Edge Function secrets:
   - `GOOGLE_PLAY_PACKAGE_NAME=com.dramarush.app`
   - `GOOGLE_SERVICE_ACCOUNT_JSON=<service account JSON>`
   - `SUPABASE_URL=<your project URL>`
   - `SUPABASE_SERVICE_ROLE_KEY=<service role key>`
7. Deploy migrations and the `verify-google-purchase` function.
8. Set the single owner in Supabase:
   ```sql
   INSERT INTO public.app_owner (owner_user_id)
   VALUES ('YOUR_AUTH_USER_UUID')
   ON CONFLICT (id) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id;
   ```
9. Install dependencies and create a native development/production build. Do not use Expo Go for IAP testing.

## Owner dashboard

The `/admin` route is checked against the single `app_owner` record through `is_admin()`. The financial metrics are read through the `owner_metrics()` security-definer function, so users cannot query the owner's financial data directly.

## Video delivery

For production, do not expose permanent public video URLs for paid episodes. Put paid video behind signed URLs/CDN access and issue short-lived URLs only after entitlement checks.


### Private video setup (Release Candidate)

Deploy both Supabase functions:
- `verify-google-purchase`
- `get-video-url`

The `videos` bucket is created as private by the migration. The app's Owner Dashboard uploads video files to it. Do not make the bucket public and do not put permanent MP4 URLs in the app.
