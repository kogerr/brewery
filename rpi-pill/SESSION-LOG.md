# Session Log — RPi-Pill Development

Chronological record of what was built, decisions made, and problems solved.

## Phase 1: Research (Agent Team)

Two research agents ran in parallel:

### BLE Research → `rapt-pill-ble.md`
- RAPT Pill BLE protocol: manufacturer ID `0x5241` ("RA"), V2 message type `505402`
- 25-byte manufacturer data: gravity (float32 BE, divide by 1000), temp (uint16 BE, Kelvin*128), battery (uint16 BE, /256)
- Recommended `@abandonware/noble` for Node.js BLE scanning on RPi
- Identified existing projects: raptpill2mqtt, ferm2mqtt

### Brewfather Research → `brewfather-custom-stream.md`
- Custom Stream endpoint: `POST https://log.brewfather.net/stream?id=<LOGGING_ID>`
- Required field: `name` (device identifier) + at least one value
- Rate limit: 1 POST per 15 minutes per device (more frequent posts silently ignored)
- Logging ID obtained from user: `xHtKkpMiN3AKwL`

## Phase 2: Node.js App Implementation

Created three files:
- `ble.js` — `RaptPillScanner` class using `@abandonware/noble`, emits `reading` events
- `brewfather.js` — `postToBrewfather()` using Node.js `https` module
- `server.js` — Express server wiring BLE→Brewfather + dashboard/API/graph

### Dashboard (GET /)
- SSR HTML with cards showing latest SG, temp, battery, last updated
- Table of recent 50 readings
- Dark theme (#1a1a2e background), auto-refresh every 60s
- Link to graph page

### Graph Page (GET /graph)
- Server-generated inline SVG chart
- Dual axes: gravity (red, left), temperature (teal, right)
- Grid lines, time labels, legend, dot markers (if <200 readings)
- Auto-refresh every 5 minutes

### API Endpoints
- `GET /api/readings` — JSON array, supports `?limit=N` (default 100, max 1000)
- `GET /api/readings/latest` — single reading or null

## Phase 3: RPi Deployment

### Steps performed via SSH to `koger@rpi3`:
1. Installed Node.js 20 LTS via NodeSource
2. Installed system deps: bluetooth, bluez, libbluetooth-dev, build-essential
3. Copied app files via scp
4. Ran `npm install` (compiled noble native bindings)
5. Granted `cap_net_raw` to node binary: `sudo setcap cap_net_raw+eip`
6. Stopped and disabled `bluetoothd` (conflicts with noble)
7. Created `.env` from template, set Brewfather logging ID
8. Created systemd service: `/etc/systemd/system/rpi-pill.service` (User=koger)
9. Created `hci0-up.service` to bring up BLE adapter before rpi-pill on boot
10. Made rpi-pill depend on hci0-up: `After=network.target hci0-up.service`
11. Enabled both services

### WiFi Setup
- Configured NetworkManager connections for "a" (password: asdfqwer) and "benko" (password: Slipknot666) via `nmcli connection add`
- Pi also has "preconfigured" WiFi (currently active on wlan0)

## Phase 4: Bug Fixes

### BLE Manufacturer ID Endianness (Critical)
- **Problem**: Noble provides manufacturer data with big-endian ID bytes, but code used `readUInt16LE(0)`
- **Symptom**: Scanner ran but never matched any Pill advertisements
- **Debug**: Wrote a raw scan script that logged all manufacturer IDs; found the Pill at `ec:62:60:28:3e:4a` with data starting `5241505402...`
- **Fix**: Changed `readUInt16LE(0)` to `readUInt16BE(0)` in `ble.js` line 37

### Dedupe Window Too Short
- **Problem**: 10s dedupe window resulted in readings every ~12 seconds
- **Symptom**: `/api/readings` showed 23 readings in 5 minutes
- **Fix**: Increased `DEDUPE_WINDOW_MS` from `10_000` to `4 * 60_000` (4 minutes)

### Graph Page Crash on Single Reading
- **Problem**: `labelCount - 1` = 0 caused division by zero → NaN index → undefined timestamp
- **Symptom**: `TypeError: Cannot read properties of undefined (reading 'timestamp')`
- **Fix**: Added `labelCount === 1 ? 0 :` guard in time label index calculation

## Phase 5: Android Widget (Agent Team)

Three agents worked in parallel:
- **scaffold**: Project skeleton (Gradle, manifest, resources, Reading.kt, PrefsRepository.kt)
- **chart-dev**: ChartRenderer.kt (Canvas-based dual-axis chart rendering)
- **widget-dev**: ApiClient, DataFetchWorker, PillWidgetProvider, ConfigActivity, DetailActivity

### Post-Agent Fixes
1. **Duplicate `Reading` class**: ChartRenderer.kt duplicated the data class from Reading.kt → removed from ChartRenderer
2. **Missing layout ID**: DetailActivity referenced `detail_status_text` which didn't exist in layout → changed to `detail_updated_text`
3. **compileSdk 34 → 35**: Dependencies required API 35 → installed platform via sdkmanager, bumped compileSdk/targetSdk
4. **Cleartext HTTP blocked**: Android blocks plain HTTP by default → added `network_security_config.xml` with `cleartextTrafficPermitted="true"` and referenced in manifest

### Fallback URL Feature
Added after agent team finished:
- `PrefsRepository`: added `getFallbackUrl()`/`setFallbackUrl()`
- `ApiClient`: tries primary URL first (5s connect timeout), falls back to secondary on failure
- `ConfigActivity` + layout: added second EditText for fallback URL
- `DataFetchWorker` + `DetailActivity`: pass fallback URL to ApiClient

### Build & Deploy
- Installed Gradle via Homebrew, generated wrapper
- Built with `./gradlew assembleDebug`
- Installed on physical device via `adb install -r`
- Emulator testing required: `adb reverse tcp:3000 tcp:3000` + SSH tunnel `ssh -f -N -L 3000:localhost:3000 koger@rpi3` + URL `http://10.0.2.2:3000`

## Phase 6: Graph Enhancements

### Interactive Hover Tooltip
- Added client-side JavaScript to the SVG graph page
- Vertical crosshair line follows mouse/touch across chart area
- Highlighted dots on gravity and temperature lines at nearest data point
- Tooltip box shows SG, temperature, and timestamp
- Works on mobile via touch events

### Stats Below Graph
- OG (highest reading), Current SG (latest), ABV (standard formula: `(OG-FG)*131.25`)
- 12h and 24h gravity change in points (only shown when enough data exists)
- Finds nearest reading to the cutoff time, tolerates up to 50% gap

## Phase 7: Multi-Pill Support

### RAPT API Discovery
- Queried RAPT API (`/api/Hydrometers/GetHydrometers`) to find Pill names and MAC addresses
- Found two Pills: **Pastilla** (`90:38:0c:12:64:48`) and **Nuevo** (`ec:62:60:28:3e:48`)
- BLE MACs are registration MAC + 2 on last octet: `...4a` for both
- Pastilla is paired with the RAPT Temperature Controller

### Implementation
Refactored all three layers for multi-pill support:

**`ble.js`** — `RaptPillScanner` now accepts a `pills` array:
- Per-MAC dedupe timers (each Pill has independent `lastSeenTime`)
- Per-Pill calibration offsets (`gravityOffset`, `tempOffset`)
- Readings tagged with `pillName`
- If MACs are configured, unknown MACs are ignored
- Falls back to single-pill legacy behavior if no `PILL_<n>` env vars set

**`server.js`** — Per-pill state and routing:
- `parsePillConfigs()` reads `PILL_<n>_MAC`, `PILL_<n>_NAME`, etc. (n=1..10)
- `pillState` object: per-pill `readings[]`, `lastBrewfatherPost`, `config`
- Brewfather posts use per-pill device names (appear as separate devices)
- Dashboard shows all Pills in separate sections with individual cards/tables
- Graph page supports `?pill=<name>` query parameter with navigation links
- API endpoints support `?pill=<name>`: `/api/pills`, `/api/readings`, `/api/readings/latest`

**`.env`** updated on Pi:
```
PILL_1_MAC=90:38:0c:12:64:4a
PILL_1_NAME=Pastilla
PILL_2_MAC=ec:62:60:28:3e:4a
PILL_2_NAME=Nuevo
```

### Brewfather Integration
- Each Pill posts as a separate device name (Pastilla, Nuevo)
- Each has its own 15-minute rate limit timer
- Can be attached to different fermenting batches independently

### Android Widget Pill Selector
Added a pill name field to the widget configuration:
- `PrefsRepository`: added `getPillName()`/`setPillName()`, returns `null` if blank
- `ApiClient`: `getReadings()` and `getLatestReading()` accept optional `pill` param, appends `?pill=<name>` to API calls
- `ConfigActivity` + layout: added EditText for pill name (e.g. "Nuevo", "Pastilla")
- `DataFetchWorker` + `DetailActivity`: pass pill name from prefs to ApiClient
- Empty pill name defaults to first configured Pill on the server
- Users can add two widget instances on the home screen, each configured to a different Pill

## Phase 8: Ideas for Future Development

Discussed but not implemented:
1. **Fermentation autopilot** — RPi reads Pill + controls RAPT Temperature Controller based on gravity progress
2. **Brew day assistant** — guided BrewZilla session with timers, pulled from Brewfather recipe
3. **Fermentation alerts** — Telegram notifications for milestones
4. **Ingredient inventory** — track stock, diff against recipes
5. **RAPT Temp Controller dashboard** — show target vs actual chamber temp

Note: RAPT Pill BLE is one-way broadcast only. No commands can be sent to the Pill via BLE.
