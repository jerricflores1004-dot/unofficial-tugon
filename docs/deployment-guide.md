# Deployment guide

## Vercel

1. Import the repository and set the project root to `web` (or use the root workspace scripts).
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, and the server-only integration keys in Vercel. Keep `SUPABASE_SERVICE_ROLE_KEY` and `FIREBASE_SERVER_KEY` in server-only environment scope.
3. Set `NEXT_PUBLIC_DEMO_MODE=false` in every deployed environment.
4. Add the Vercel URL to Supabase Auth redirect URLs.
5. Run `npm run build` as the deployment check.

## Supabase

Link the project and run `supabase db push` followed by `supabase db seed`. Confirm RLS is enabled, Realtime includes the four published tables, and `incident-photos` is private. Enable Auth email confirmation and configure SMTP for production.

## Firebase Cloud Messaging

Create Android and iOS apps in Firebase, add the platform files to `mobile/android` and `mobile/ios`, enable FCM, and set the public Firebase configuration values. The FCM server key stays server-only. Register device tokens through `/api/notifications/register-device`; delivery workers must use a server-side Firebase Admin deployment and write notification history before sending.

## Google Maps

Create separate restricted browser and server keys. Restrict the browser key to the deployed host and Maps JavaScript API; restrict server keys to Geocoding/Places/Directions as needed. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` only after restrictions are in place. The current map panel is a safe operational fallback until the key is configured.

## Mobile builds

```bash
cd mobile
cp .env.example .env
flutter pub get
flutter build apk --release
flutter build ipa --release
```

Configure Android notification permissions, iOS Push Notifications capability, background modes, signing, and production Supabase redirect URLs before distributing builds.
