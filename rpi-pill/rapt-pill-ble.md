# RAPT Pill BLE on Raspberry Pi 3 B+

Research report on reading RAPT Pill hydrometer data via Bluetooth Low Energy on a Raspberry Pi.

## RAPT Pill BLE Advertising Format

The RAPT Pill acts as a BLE beacon, broadcasting its data in the **Manufacturer Specific Data** field of BLE advertisements. It does not require pairing or connection — you just passively scan for advertisements.

Official protocol documentation: https://gitlab.com/rapt.io/public/-/wikis/Pill-Hydrometer-Bluetooth-Transmissions

### Identifying a RAPT Pill

- **Manufacturer ID:** `0x5241` (ASCII "RA" for RAPT) — appears as `"5241"` in the first 2 bytes of manufacturer data
- A secondary manufacturer ID `0x4B45` (ASCII "KE" for KegLand) with byte `0x47` at offset 2 indicates a **firmware version announcement**, not a data message
- The RAPT Pill sends ~6 advertisements per interval (configurable in the Pill, default 15 minutes for WiFi mode, more frequent in BLE mode)

### BLE MAC Address

The Pill's BLE MAC address can be calculated from its registration MAC address by adding 2 to the last octet. For example, if the registration MAC is `AA:BB:CC:DD:EE:10`, the BLE broadcast MAC is `AA:BB:CC:DD:EE:12`.

### V2 Data Format (Current)

After the 2-byte manufacturer ID (`0x5241`), the data payload begins. The message type is identified by bytes at offsets 2-4:

| Message Type (hex) | Meaning |
|---|---|
| `50 54 01` | V1 format data (legacy, rare) |
| `50 54 02` | V2 format data (current) |
| `50 54 64` | Device type string |

#### V2 Payload Structure (message type `505402`)

Starting from byte 0 of the **full manufacturer data** (including the `0x5241` prefix):

| Offset | Size | Type | Field | Notes |
|--------|------|------|-------|-------|
| 0-1 | 2 | uint16 | Manufacturer ID | `0x5241` ("RA") |
| 2-4 | 3 | bytes | Message type | `0x505402` for V2 data |
| 5 | 1 | uint8 | Pad | Always `0x00` (validate this) |
| 6 | 1 | uint8 | Gravity velocity valid | `0x00` = invalid, `0x01` = valid |
| 7-10 | 4 | float32 BE | Gravity velocity | Points per day (IEEE 754 big-endian) |
| 11-12 | 2 | uint16 BE | Temperature | Kelvin * 128 |
| 13-16 | 4 | float32 BE | Specific gravity | In "points" (divide by 1000 for SG) |
| 17-18 | 2 | int16 BE | Accelerometer X | Raw value * 16, signed |
| 19-20 | 2 | int16 BE | Accelerometer Y | Raw value * 16, signed |
| 21-22 | 2 | int16 BE | Accelerometer Z | Raw value * 16, signed |
| 23-24 | 2 | uint16 BE | Battery | Percentage * 256 |

**Total: 25 bytes** of manufacturer data.

All multi-byte values are **big-endian**.

#### Decoding Formulas

```
temperature_C = (raw_uint16 / 128) - 273.15
temperature_F = temperature_C * 9/5 + 32
specific_gravity = raw_float32 / 1000       // e.g., 1045.2 → 1.0452
accel_x = raw_int16 / 16
accel_y = raw_int16 / 16
accel_z = raw_int16 / 16
battery_pct = raw_uint16 / 256              // cap at 100%
gravity_velocity = raw_float32              // points per day (only if valid flag == 1)
```

### Calibration

The BLE-broadcast values are **uncalibrated**. You may need to apply calibration offsets:
- Gravity: additive offset in SG (e.g., +0.002)
- Temperature: additive offset in degrees (e.g., +0.5)

Calibration values can be determined by comparing Pill readings with a known reference (e.g., pure water at 1.000 SG).

## Raspberry Pi 3 B+ Bluetooth Setup

The RPi 3 B+ has built-in Bluetooth 4.2 with BLE support.

### System Setup

```bash
# Install Bluetooth packages
sudo apt-get update
sudo apt-get install -y bluetooth bluez libbluetooth-dev

# Verify Bluetooth adapter
hciconfig
# Should show hci0 with BD Address

# Ensure Bluetooth is up
sudo hciconfig hci0 up

# Test BLE scanning (Ctrl+C to stop)
sudo hcitool lescan
```

### Permissions

By default, BLE scanning requires root. To avoid running as root:

```bash
# For noble / @abandonware/noble (uses HCI directly)
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

# For node-ble (uses D-Bus/BlueZ)
# Create /etc/dbus-1/system.d/node-ble.conf:
```

```xml
<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN"
  "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <policy user="pi">
    <allow own="org.bluez"/>
    <allow send_destination="org.bluez"/>
    <allow send_interface="org.bluez.GattCharacteristic1"/>
    <allow send_interface="org.bluez.GattDescriptor1"/>
    <allow send_interface="org.freedesktop.DBus.ObjectManager"/>
    <allow send_interface="org.freedesktop.DBus.Properties"/>
  </policy>
</busconfig>
```

## Node.js BLE Libraries

### Option 1: @abandonware/noble (Recommended for this use case)

The best choice for passive BLE advertisement scanning. Works directly with the HCI Bluetooth socket — no BlueZ daemon needed.

```bash
npm install @abandonware/noble
```

**Pros:**
- Mature, well-tested library (fork of the original noble)
- Directly reads BLE advertisements including manufacturer data
- No D-Bus complexity
- Active maintenance (latest release Feb 2025)
- Works on Node.js >= 16

**Cons:**
- Requires native compilation (node-gyp)
- Needs `cap_net_raw` capability or root
- May conflict with BlueZ (stop bluetoothd before scanning)

**Stop BlueZ to avoid conflicts:**
```bash
sudo systemctl stop bluetooth
# or use noble's environment variable:
export NOBLE_HCI_DEVICE_ID=0
```

### Option 2: node-ble

Uses BlueZ via D-Bus. Pure JavaScript — no native compilation needed.

```bash
npm install node-ble
```

**Pros:**
- No native bindings, pure JS
- Coexists with BlueZ daemon
- Good TypeScript support
- Works on Raspbian, Ubuntu, Debian

**Cons:**
- Primarily designed for GATT connections, not passive scanning
- Reading raw manufacturer data from advertisements is less straightforward
- Requires D-Bus permission configuration
- May not expose all advertisement data fields easily

### Option 3: Python with bleson (Alternative)

The most battle-tested approach for RAPT Pill specifically, as multiple existing projects use it.

```bash
sudo apt-get install libbluetooth-dev
pip install bleson
```

**Pros:**
- Used by raptpill2mqtt and ferm2mqtt (proven to work)
- Simple API for BLE advertisement scanning
- Good community examples

### Option 4: Go with tinygo/bluetooth

For a compiled, low-resource approach.

## Code Examples

### Node.js with @abandonware/noble

```javascript
const noble = require('@abandonware/noble');

const RAPT_MFG_ID = 0x5241; // "RA"

function decodeRaptPillV2(mfgData) {
  // mfgData is a Buffer containing the full manufacturer data
  // First 2 bytes are manufacturer ID (already matched), skip them
  const msgType = mfgData.slice(2, 5).toString('hex');

  if (msgType !== '505402') {
    return null; // Not V2 data
  }

  const pad = mfgData[5];
  if (pad !== 0x00) {
    return null; // Invalid format
  }

  const gravityVelocityValid = mfgData[6] === 0x01;
  const gravityVelocity = gravityVelocityValid
    ? mfgData.readFloatBE(7)
    : null;

  const tempRaw = mfgData.readUInt16BE(11);
  const temperatureC = (tempRaw / 128) - 273.15;

  const sgRaw = mfgData.readFloatBE(13);
  const specificGravity = sgRaw / 1000;

  const accelX = mfgData.readInt16BE(17) / 16;
  const accelY = mfgData.readInt16BE(19) / 16;
  const accelZ = mfgData.readInt16BE(21) / 16;

  const batteryRaw = mfgData.readUInt16BE(23);
  const battery = Math.min(batteryRaw / 256, 100);

  return {
    specificGravity: parseFloat(specificGravity.toFixed(4)),
    temperatureC: parseFloat(temperatureC.toFixed(2)),
    gravityVelocity,
    accelX, accelY, accelZ,
    battery: parseFloat(battery.toFixed(1)),
  };
}

noble.on('stateChange', (state) => {
  if (state === 'poweredOn') {
    console.log('Scanning for RAPT Pill...');
    // true = allow duplicates (needed to get repeated advertisements)
    noble.startScanning([], true);
  } else {
    noble.stopScanning();
  }
});

noble.on('discover', (peripheral) => {
  const advertisement = peripheral.advertisement;
  const mfgData = advertisement.manufacturerData;

  if (!mfgData || mfgData.length < 25) return;

  // Check manufacturer ID (little-endian in noble: 0x5241 → bytes 41 52)
  // noble provides manufacturerData with the ID already parsed
  // The raw mfgData buffer starts with the manufacturer ID bytes
  const mfgId = mfgData.readUInt16LE(0);
  if (mfgId !== RAPT_MFG_ID) return;

  const data = decodeRaptPillV2(mfgData);
  if (!data) return;

  console.log(`RAPT Pill [${peripheral.address}]`, {
    gravity: data.specificGravity,
    temp: `${data.temperatureC}C`,
    battery: `${data.battery}%`,
    velocity: data.gravityVelocity,
    rssi: peripheral.rssi,
  });
});
```

### Python with bleson (reference, proven working)

```python
from struct import unpack
from bleson import get_provider, Observer

def on_advertisement(advertisement):
    if advertisement.mfg_data is None:
        return

    payload = advertisement.mfg_data.hex()
    mfg_id = payload[0:4]

    if mfg_id != "5241":
        return

    msg_type = payload[4:10]
    if msg_type != "505402":
        return

    # V2 format - unpack big-endian fields
    data = unpack(">BBfHfhhhH", advertisement.mfg_data[5:])

    pad = data[0]
    gravity_velocity_valid = data[1]
    gravity_velocity = data[2]
    temperature_c = (data[3] / 128) - 273.15
    specific_gravity = data[4] / 1000
    accel_x = data[5] / 16
    accel_y = data[6] / 16
    accel_z = data[7] / 16
    battery = data[8] / 256

    print(f"SG: {specific_gravity:.4f}  Temp: {temperature_c:.1f}C  "
          f"Battery: {battery:.0f}%  RSSI: {advertisement.rssi}")

adapter = get_provider().get_adapter()
observer = Observer(adapter)
observer.on_advertising_data = on_advertisement
observer.start()

import time
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    observer.stop()
```

## RAPT Pill Configuration

### Enabling BLE Mode

The RAPT Pill can operate in WiFi mode (default) or Bluetooth mode:

1. **WiFi mode** — Pill connects to your WiFi network and sends data to RAPT portal. Battery life ~5 months at 60-min intervals. BLE advertisements may still be sent.
2. **Bluetooth/Bridge mode** — Pill only broadcasts via BLE. A RAPT-enabled device (or your RPi) picks up the signal. Battery life 2+ years. Data is not sent to the RAPT portal unless you forward it.

To configure BLE mode, use the RAPT app or portal to change the Pill's telemetry mode. When in WiFi mode, the Pill still sends BLE advertisements periodically, so you may be able to read BLE data without switching modes.

### Advertising Interval

- In WiFi mode: advertisements sent at the configured telemetry interval (default 60 minutes, configurable down to 15 minutes)
- In BLE/Bridge mode: advertisements sent more frequently (typically every few seconds to minutes)
- The Pill sends ~6 duplicate advertisements per burst

## Existing Open-Source Projects

| Project | Language | Platform | Description |
|---------|----------|----------|-------------|
| [sgoadhouse/raptpill2mqtt](https://github.com/sgoadhouse/raptpill2mqtt) | Python | Linux/RPi | BLE scan → MQTT using bleson. Well-documented. |
| [sgoadhouse/ferm2mqtt](https://github.com/sgoadhouse/ferm2mqtt) | Python | Linux/RPi | Supports both RAPT Pill and Tilt hydrometers → MQTT. |
| [jcres104/Rapt-Pill-BLE2MQTT](https://github.com/jcres104/Rapt-Pill-BLE2MQTT) | C++ | ESP32 | ESP32-based BLE scanner → MQTT. Good V2 parsing reference. |
| [keit/ArduinoRaptPillBLE](https://github.com/keit/ArduinoRaptPillBLE) | C++ | Arduino | Arduino BLE scanner with heater control via WebSocket. |

## Known Issues and Gotchas

1. **BlueZ conflicts with noble** — The `@abandonware/noble` library accesses the HCI socket directly and can conflict with the BlueZ daemon (`bluetoothd`). Either stop the daemon (`sudo systemctl stop bluetooth`) or set `NOBLE_HCI_DEVICE_ID` to avoid conflicts.

2. **Uncalibrated values** — BLE-broadcast gravity and temperature are raw/uncalibrated. They differ from the values shown in the RAPT portal (which applies calibration). You need to determine and apply your own calibration offsets.

3. **Multiple Pills** — The manufacturer ID `0x5241` is the same for all RAPT Pills. To distinguish multiple Pills, you must filter by BLE MAC address. The MAC is the registration MAC + 2 on the last octet.

4. **Stainless steel fermenters** — BLE signal may be attenuated by metal fermenters. The RPi should be close to the fermenter. Bluetooth mode has better signal penetration than WiFi.

5. **Root / capabilities required** — BLE scanning requires elevated privileges. Either run as root or use `setcap` to grant `cap_net_raw` to the Node binary.

6. **Node.js native compilation on RPi** — `@abandonware/noble` requires native compilation via node-gyp. Ensure build tools are installed: `sudo apt-get install build-essential`.

7. **Advertisement duplicates** — The Pill sends ~6 duplicate advertisements per burst. Deduplicate by tracking the last-seen data payload or by debouncing on a time window.

8. **V1 vs V2 format** — Older Pill firmware may use V1 format (`505401`). V2 (`505402`) is current. Check firmware version via the `0x4B45` + `0x47` manufacturer data messages.

9. **Gravity in "points" not SG** — The raw float in the BLE data is in gravity points (e.g., 1045.2), not standard SG. Divide by 1000 to get SG (1.0452). This matches the RAPT API behavior.

## Recommended Approach for This Project

For a Node.js implementation on RPi 3 B+:

1. Use **`@abandonware/noble`** — it's the most straightforward for passive BLE advertisement scanning
2. Stop `bluetoothd` before scanning, or run noble with exclusive HCI access
3. Scan with `allowDuplicates: true` to catch all advertisement bursts
4. Filter by manufacturer ID `0x5241` and message type `505402`
5. Decode using the V2 format table above
6. Debounce readings (e.g., one reading per 60 seconds) to avoid processing duplicates
7. Apply calibration offsets if known

For a simpler path with proven code, use the **Python + bleson** approach from `raptpill2mqtt` — it's battle-tested on Raspberry Pi.
