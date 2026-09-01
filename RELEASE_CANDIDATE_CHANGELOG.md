# DramaRush v1.0 Release Candidate

## Security and content-management changes

1. **Coins protected**
   - Normal authenticated clients can no longer update `profiles.coins` or `profiles.role`.
   - Only server-side purchase verification and trusted database functions can change coin balances.

2. **Private episode videos**
   - Added `episodes.video_path`.
   - Added a private Supabase Storage bucket named `videos`.
   - Client playback no longer consumes `video_url`.
   - Added `get-video-url` Edge Function to verify entitlement and issue a 5-minute signed URL.

3. **Owner video upload**
   - Owner Dashboard now has **Choose & Upload Video**.
   - Videos are selected directly from the phone and uploaded to private Storage.

4. **Playback entitlement**
   - Free episodes/series, active subscriptions, and coin-unlocked episodes are supported.
   - Auto-next now recognizes coin-unlocked episodes too.

5. **View analytics**
   - Views are recorded after meaningful playback: 30 seconds or 10% of the episode, whichever comes first.
   - A playback session is counted once.

6. **Legacy episodes**
   - Existing `video_url` values are no longer exposed to clients.
   - Existing episodes should be re-uploaded from Owner Dashboard to populate `video_path`.

## Important

This is access control, not DRM. A valid signed URL can still be used until it expires. For stronger anti-copy protection, a DRM-capable video/CDN service would be required.
