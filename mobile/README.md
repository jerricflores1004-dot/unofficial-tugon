# TUGON mobile (Flutter)

Resident incident reporting for MDRRMO Mabini. Reports, announcements and
notifications are read live from Supabase; nothing renders sample records.

## App icon and branding

The logo lives in exactly one place:

```
mobile/assets/icon/tugon_icon_1024.png   # master artwork (1024x1024, full-bleed)
```

Every platform icon is generated from that master:

| Platform | Files |
| --- | --- |
| Android (legacy) | `android/app/src/main/res/mipmap-*/ic_launcher.png`, `ic_launcher_round.png` |
| Android (adaptive, 8.0+) | `mipmap-anydpi-v26/ic_launcher*.xml` + `mipmap-*/ic_launcher_foreground.png` |
| Android 12+ splash | `drawable-*/splash_icon.png` + `values-v31/styles.xml` |
| Android launch screen (<12) | `res/drawable*/launch_background.xml` |
| Web / PWA | `web/icons/Icon-*.png`, `web/favicon.png`, `web/manifest.json` |
| Windows | `windows/runner/resources/app_icon.ico` |
| In app | `LogoMark` in `lib/main.dart` (same asset) |

To change the icon, replace the master image (square PNG) and re-run:

```bash
cd mobile
pip install pillow
python3 tool/generate_app_icons.py
```

The brand background colour `#022C93` is used for the adaptive-icon background
(`res/values/colors.xml`), the launch screen and the web/PWA theme colour, so
the icon blends seamlessly into the splash.

## Build

```bash
cd mobile
flutter pub get
flutter run                       # debug, uses .env
flutter build apk --release --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
```

Android labels the app `TUGON` (see `android/app/src/main/AndroidManifest.xml`).
