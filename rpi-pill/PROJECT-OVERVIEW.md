# RPi-Pill Project Overview

Handover document for AI agents. This project is a RAPT Pill BLE relay running on a Raspberry Pi 3 B+, with a Brewfather integration and an Android home screen widget.

## What This Project Does

1. **Raspberry Pi service** (`server.js`) scans for **multiple RAPT Pill** hydrometers via Bluetooth Low Energy
2. Decodes gravity, temperature, and battery from BLE advertisements, tracked per-Pill
3. Forwards each Pill's readings to Brewfather every 15 minutes as separate devices via Custom Stream API
4. Serves a local web dashboard (per-Pill sections), per-Pill gravity graphs, and JSON API on port 3000
5. **Android widget** displays a dual-axis fermentation chart on the phone's home screen

## Architecture

```
RAPT Pill "Pastilla" (90:38:0c:12:64:4a)  ─┐
RAPT Pill "Nuevo"    (ec:62:60:28:3e:4a)  ──┤  BLE advertisements
                                             ▼
Raspberry Pi 3 B+ (rpi3 / 192.168.1.107)
    │  Node.js service (systemd: rpi-pill)
    │  @abandonware/noble for BLE scanning
    │  Per-pill state: readings[], dedupe, Brewfather timestamps
    │  Express for HTTP
    │
    ├──► Brewfather Custom Stream (every 15 min per device)
    │    POST https://log.brewfather.net/stream?id=xHtKkpMiN3AKwL
    │    Device names: "Pastilla", "Nuevo" (attachable to different batches)
    │
    ├──► Dashboard:  http://rpi3:3000/           (all Pills)
    ├──► Graph:      http://rpi3:3000/graph?pill=Pastilla
    ├──► JSON API:   http://rpi3:3000/api/pills
    │                http://rpi3:3000/api/readings?pill=Nuevo&limit=100
    │                http://rpi3:3000/api/readings/latest?pill=Pastilla
    │
    ▼
Android Widget (Kotlin)
    Fetches from /api/readings?pill=<name> every 30 min
    Renders dual-axis chart via Canvas → Bitmap
    Supports primary + fallback URL
```

## File Structure

```
rpi-pill/
├── server.js              # Main entry: Express + BLE scanner + Brewfather
├── ble.js                 # RAPT Pill BLE scanner (noble, V2 protocol decoder)
├── brewfather.js          # Brewfather Custom Stream HTTP client
├── package.json           # Dependencies: @abandonware/noble, express
├── .env.example           # Configuration template
├── INSTALL.md             # Step-by-step RPi installation guide
├── PROJECT-OVERVIEW.md    # This file
├── SESSION-LOG.md         # Detailed session log of what was built and why
├── KNOWN-ISSUES.md        # Bugs found, fixes applied, gotchas
├── rapt-pill-ble.md       # Research: RAPT Pill BLE protocol details
├── brewfather-custom-stream.md  # Research: Brewfather API docs
├── android-widget-plan.md # Android widget design/architecture plan
└── android-widget/        # Android Studio project
    ├── app/src/main/java/com/brewery/pillwidget/
    │   ├── ApiClient.kt          # OkHttp client with fallback URL
    │   ├── ChartRenderer.kt      # Canvas-based dual-axis chart → Bitmap
    │   ├── ConfigActivity.kt     # Widget config (primary + fallback URL)
    │   ├── DataFetchWorker.kt    # WorkManager background fetcher
    │   ├── DetailActivity.kt     # Full-screen view on widget tap
    │   ├── PillWidgetProvider.kt # AppWidgetProvider lifecycle
    │   ├── PrefsRepository.kt    # SharedPreferences for URLs
    │   └── Reading.kt            # Data model (ReadingDto, Reading)
    ├── app/src/main/res/
    │   ├── layout/widget_pill.xml       # Widget layout
    │   ├── layout/activity_config.xml   # Config screen
    │   ├── layout/activity_detail.xml   # Detail screen
    │   ├── xml/pill_widget_info.xml     # Widget metadata
    │   ├── xml/network_security_config.xml  # Allow cleartext HTTP
    │   └── values/strings.xml, colors.xml
    ├── app/build.gradle.kts      # compileSdk 35, minSdk 26
    ├── build.gradle.kts          # Root gradle (AGP 8.7.3, Kotlin 2.1.0)
    ├── settings.gradle.kts
    └── local.properties          # SDK path (machine-specific)
```

## Key Configuration

### RPi service (.env on the Pi at ~/rpi-pill/.env)
- `BREWFATHER_LOGGING_ID=xHtKkpMiN3AKwL`
- `PORT=3000`
- `BREWFATHER_INTERVAL=15` (minutes, minimum 15)
- Dedupe window: 4 minutes per pill (in ble.js constant)

#### Multi-Pill config (current):
- `PILL_1_MAC=90:38:0c:12:64:4a` / `PILL_1_NAME=Pastilla`
- `PILL_2_MAC=ec:62:60:28:3e:4a` / `PILL_2_NAME=Nuevo`
- Optional per-pill: `PILL_<n>_BREWFATHER_NAME`, `PILL_<n>_GRAVITY_OFFSET`, `PILL_<n>_TEMP_OFFSET`
- Supports up to 10 pills (PILL_1 through PILL_10)

#### Legacy single-pill config (fallback if no PILL_<n> vars set):
- `PILL_MAC`, `DEVICE_NAME`, `GRAVITY_OFFSET`, `TEMP_OFFSET`

### RAPT Pill inventory
| Name | RAPT MAC | BLE MAC | Notes |
|------|----------|---------|-------|
| Pastilla | `90:38:0c:12:64:48` | `90:38:0c:12:64:4a` | Paired with RAPT Temperature Controller |
| Nuevo | `ec:62:60:28:3e:48` | `ec:62:60:28:3e:4a` | — |

### RPi access
- Host: `rpi3` / `192.168.1.107`
- User: `koger`
- SSH: `ssh koger@rpi3`
- WiFi networks configured: "preconfigured" (active), "a", "benko"

### Android widget
- Package: `com.brewery.pillwidget`
- APK: `app/build/outputs/apk/debug/app-debug.apk`
- Build: `./gradlew assembleDebug` (from android-widget/)
- Install: `adb install -r app/build/outputs/apk/debug/app-debug.apk`
- Config fields: primary URL, fallback URL, **pill name** (e.g. "Nuevo" or "Pastilla")
- Leave pill name empty to show the first configured Pill (default)
- Can add two widget instances, each showing a different Pill

## Related Files Outside This Directory

- `/Users/gekovacs/workspace/brewery/CLAUDE.md` — project-level instructions
- `/Users/gekovacs/.claude/projects/-Users-gekovacs-workspace-brewery/memory/MEMORY.md` — persistent memory
- RAPT Pill hydrometers owned: "Pastilla" (most recent) and "Nuevo"
