# Known Issues and Gotchas

## RPi Service

### BLE Adapter Must Be Up Before Service
- `bluetoothd` is disabled (conflicts with noble)
- `hci0-up.service` brings up the adapter on boot
- If BLE shows `poweredOff` in logs, run: `sudo hciconfig hci0 up` then restart service

### Readings Are In-Memory Only
- All readings are lost on service restart
- Max 1000 readings stored (oldest dropped)
- No persistence layer — would need SQLite or similar for history across restarts

### BLE Manufacturer ID Is Big-Endian
- The research report and some online examples show `readUInt16LE(0)` — this is **wrong** for this version of noble
- Noble provides raw manufacturer data with bytes in wire order: `52 41` = `0x5241` when read as BE
- If upgrading noble, verify endianness hasn't changed

### Gravity Values Are Uncalibrated
- BLE-broadcast gravity differs from RAPT portal values (which apply calibration)
- Set `PILL_<n>_GRAVITY_OFFSET` and `PILL_<n>_TEMP_OFFSET` in `.env` per pill
- When not in liquid, the Pill reports nonsensical gravity (~1.3+)

### Pill Must Be in BLE Range
- RPi 3 B+ Bluetooth 4.2 range: ~10-15 meters in open air
- Metal fermenters attenuate signal significantly — keep RPi close
- If no readings appear, check Pill is awake (tilt/shake) and in Bluetooth mode

### Duplicate Advertisements
- Pill sends ~6 duplicate BLE ads per burst
- Dedupe window is set to 4 minutes per pill (for 5-min Pill interval)
- Each Pill has its own dedupe timer — one Pill advertising doesn't block another
- If Pill interval changes, update `DEDUPE_WINDOW_MS` in `ble.js`

### BlueZ Conflict
- Noble accesses HCI socket directly, conflicting with `bluetoothd`
- `bluetoothd` is disabled via systemd — this means `bluetoothctl` won't work
- To use `bluetoothctl` for debugging, temporarily stop rpi-pill and start bluetooth:
  ```
  sudo systemctl stop rpi-pill
  sudo systemctl start bluetooth
  ```

## Brewfather Integration

### 15-Minute Rate Limit
- Posts more frequent than 15 min are silently ignored (HTTP 200 but data discarded)
- The service respects this with `BREWFATHER_INTERVAL_MS`

### Each Device Must Be Manually Attached to Its Batch
- After first POST, each Pill appears as a separate device in Brewfather (e.g., "Pastilla", "Nuevo")
- Must manually attach each device to its fermenting batch in the Readings tab
- Different Pills can be attached to different batches simultaneously

### No Historical Backfill
- Can only log real-time; cannot POST past timestamps
- Readings lost during service downtime are gone from Brewfather

## Android Widget

### Cleartext HTTP Required
- The RPi serves plain HTTP (no TLS)
- `network_security_config.xml` allows cleartext — necessary for local network
- If RPi gets HTTPS (e.g., via reverse proxy), this can be tightened

### WorkManager Update Interval
- Minimum ~15 minutes (system-enforced for periodic work)
- Currently set to 30 minutes
- Widget shows "Updated HH:MM" so staleness is visible

### Emulator Cannot Reach Local Network
- Emulator needs `adb reverse` + SSH tunnel to reach the Pi
- Use `http://10.0.2.2:3000` in emulator (host machine alias)
- Physical device on same WiFi works directly with Pi's IP

### Widget Pill Selection
- The widget config screen has a **Pill name** field (e.g. "Nuevo", "Pastilla")
- Leave blank to show the first configured Pill (default)
- Two widget instances can be placed on the home screen, each showing a different Pill
- Pill name is case-sensitive and must match the `PILL_<n>_NAME` configured on the server

### Multiple Widget Instances
- Each `onUpdate` triggers a one-time WorkManager job
- Multiple widgets could cause redundant API calls
- Not a real problem at current scale

### Build Requirements
- Android SDK API 35 platform required
- Java 17 (Corretto 17.0.7 installed)
- Gradle 8.9 (wrapper included)
- `ANDROID_HOME` / `local.properties` must point to SDK

## General

### RPi SSH Access
- Hostname: `rpi3` (or `192.168.1.107` on current network)
- User: `koger`
- SSH key auth configured (no password)

### Service Management Commands
```bash
sudo systemctl status rpi-pill        # check status
sudo systemctl restart rpi-pill       # restart
sudo journalctl -u rpi-pill -f        # follow logs
sudo systemctl status hci0-up         # check BLE adapter service
```
