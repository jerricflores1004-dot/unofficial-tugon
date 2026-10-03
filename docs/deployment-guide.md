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

For the Android-only resident app, register an Android app in Firebase using the generated Android project's `applicationId`. Download `google-services.json` to `mobile/android/app/google-services.json`, keep it untracked, and enable Firebase Cloud Messaging (FCM). Apply the Google Services Gradle plugin to the Android app module according to the Firebase Android setup instructions; keep the `firebase_core` and `firebase_messaging` Flutter dependencies. Register this app's device tokens through `/api/notifications/register-device` with `platform: 'android'`.

The FCM server key stays server-only. Delivery workers must use a server-side Firebase Admin deployment and write notification history before sending. Android-only mobile distribution does not change the cross-platform web/backend notification architecture: the registration API and `user_devices` schema still accept `android`, `ios`, and `web`, preserving support for future iOS clients.

## Google Maps

Create separate restricted browser and server keys. Restrict the browser key to the deployed host and Maps JavaScript API; restrict server keys to Geocoding/Places/Directions as needed. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` only after restrictions are in place. The current map panel is a safe operational fallback until the key is configured.

## Mobile builds (Android-only)

TUGON mobile distribution from `/mobile` is **Android-only**. Android Studio on Windows is supported for development and release builds. No iOS or macOS build is part of the current deployment path. This scope applies only to the resident app, not to the web dashboard or backend platform support. Supabase Auth, database, Realtime, Storage, and offline report sync remain unchanged.

### Windows / Android Studio setup

1. Install the Flutter SDK, add `flutter` to `PATH`, and install Android Studio with the Android SDK, command-line tools, and a compatible JDK. Use `flutter doctor` to resolve any Android toolchain issues.
2. Start an Android emulator with Google APIs/Google Play services, or connect an Android device with USB debugging enabled, for FCM testing.
3. From the repository root in PowerShell, accept the Android licenses and generate only the Android runner (native platform folders are not included in this checkout):

   ```powershell
   flutter doctor --android-licenses
   cd mobile
   flutter create . --org ph.gov.mabini --platforms=android
   Copy-Item .env.example .env
   flutter pub get
   ```

   Keep `--platforms=android` when generating the project; do not add other mobile, desktop, or web build targets under `/mobile`.
4. Set the local `.env` values for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the deployed HTTPS `API_BASE_URL`. Configure the Android Firebase app and local `google-services.json` as described above.

### Required Android release configuration

- Ensure `mobile/android/app/src/main/AndroidManifest.xml` declares `android.permission.INTERNET` so release builds can reach Supabase and the API.
- Android notification permissions are required for push delivery. Ensure the merged manifest declares `android.permission.POST_NOTIFICATIONS` and request permission at runtime on Android 13+ using `FirebaseMessaging.instance.requestPermission()`. Verify Android FCM token registration and notification delivery on a device; handle permission denial without blocking report submission.
- Configure **Android release signing** before distribution. Create and securely back up the release/upload keystore outside the repository, keep signing properties and passwords local (for example, in the ignored `mobile/android/key.properties`), and wire the app module's Gradle release signing configuration to that key. Do not distribute builds signed with the debug key. Use the signed APK for direct distribution or the signed Android App Bundle with Play App Signing for Google Play.
- Configure production Supabase Auth redirect URLs and matching Android deep-link intent filters. Verify sign-in, database access, Realtime updates, Storage uploads, and queued report sync after reconnecting.

Never commit `google-services.json`, signing keys, keystores, signing passwords, or real environment values. The mobile `.env` is bundled into the app and must contain only client-safe configuration, never a Supabase service-role key, Firebase server key, or service-account credentials. Keep those credentials server-only.

### Validate and build

After Firebase, environment, permissions, and release signing are configured, run from `mobile`:

```powershell
flutter analyze
flutter test
flutter build apk --release
flutter build appbundle --release
```

The release artifacts are `mobile/build/app/outputs/flutter-apk/app-release.apk` and `mobile/build/app/outputs/bundle/release/app-release.aab`. Keep generated builds out of Git.
