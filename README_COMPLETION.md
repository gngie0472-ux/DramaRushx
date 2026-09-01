# DramaRush — Completion Notes

This version completes the application core and hardens the Supabase authorization layer.

## Included

- Database-level admin authorization for categories, series, episodes, profiles, transactions and subscriptions.
- Atomic episode unlocking with row locking to prevent double-spending during concurrent requests.
- Free-series entitlement: every episode of a series marked `is_free` is watchable without coins.
- Active subscriptions now grant access to paid episodes.
- Atomic episode + series view counters through `record_episode_view()`.
- Player navigation respects subscription/free-series access.
- Native sharing for series pages instead of the previous placeholder.

## Supabase

Apply all migrations in `supabase/migrations/` in filename order. The new migration is:

`20260831210000_hardening_and_admin.sql`

## Important: real payments

Google Play Billing / Apple billing cannot be safely activated only from this ZIP. Production billing requires:

1. Google Play Console products/subscriptions.
2. A billing implementation for the target platform.
3. Server-side purchase verification.
4. A secure server/Edge Function that credits coins or activates subscriptions only after verification.
5. Matching product IDs configured in the app.

The existing UI still keeps the coin-purchase and subscription entry points, but they must not be treated as real purchases until that external billing setup is connected.

## Video security

The release candidate now stores new episode videos in a private Storage bucket and issues short-lived signed URLs after entitlement verification. This is access control, not DRM: a signed URL can still be used by a client until it expires.


## DramaRush v1.0 Release Candidate security changes

- User clients can no longer update `profiles.coins` or `profiles.role`; coin grants/spends remain server-side.
- Episode videos use the private `videos` Storage bucket and `episodes.video_path`.
- Playback calls the `get-video-url` Edge Function, which checks entitlement and returns a 5-minute signed URL.
- Owner Dashboard can choose a video from the phone and upload it directly to private Storage.
- Views are recorded only after meaningful playback (30 seconds or 10% of the episode, whichever comes first) and are deduplicated per user/playback session.
- Auto-next recognizes free, subscription, and coin-unlocked episodes.

Existing legacy `video_url` values are no longer exposed to clients. Existing episodes should be re-uploaded through Owner Dashboard so they receive a private `video_path`.
