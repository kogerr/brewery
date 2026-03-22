# RPi-Pill Installation Guide

How to install and run the RPi-Pill BLE relay on a Raspberry Pi 3 B+.

## Prerequisites

- Raspberry Pi 3 B+ (or any RPi with built-in Bluetooth 4.2+)
- Raspberry Pi OS (Bookworm or Bullseye)
- RAPT Pill hydrometer (firmware supporting V2 BLE format)
- Brewfather Premium account (for custom stream integration)

## 1. Install Node.js

```bash
# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
node --version  # should print v20.x
```

## 2. Install system dependencies

```bash
sudo apt-get install -y bluetooth bluez libbluetooth-dev build-essential
```

- `bluetooth` / `bluez` - Bluetooth stack
- `libbluetooth-dev` - headers needed by `@abandonware/noble`
- `build-essential` - C compiler for native addon compilation

## 3. Copy the app to the Pi

Copy the `rpi-pill` directory to your Pi (e.g., via `scp` or `rsync`):

```bash
# From your development machine
scp -r rpi-pill/ pi@raspberrypi.local:~/rpi-pill/
```

Or clone directly on the Pi if you have the repo available.

## 4. Install npm dependencies

```bash
cd ~/rpi-pill
npm install
```

This compiles `@abandonware/noble`'s native Bluetooth bindings. It may take a few minutes on the Pi.

## 5. Grant BLE permissions

`@abandonware/noble` accesses the HCI socket directly, which requires either root or the `cap_net_raw` capability:

```bash
sudo setcap cap_net_raw+eip $(readlink -f $(which node))
```

This allows Node.js to perform BLE scanning without `sudo`.

## 6. Stop the BlueZ daemon

Noble conflicts with the BlueZ `bluetoothd` daemon. Stop and disable it:

```bash
sudo systemctl stop bluetooth
sudo systemctl disable bluetooth
```

If you need BlueZ for other purposes, you can instead set `NOBLE_HCI_DEVICE_ID=0` in the environment, though stopping the daemon is more reliable.

## 7. Configure environment

```bash
cd ~/rpi-pill
cp .env.example .env
```

Edit `.env` with your settings:

```bash
nano .env
```

Required settings:
- **`BREWFATHER_LOGGING_ID`** - Get this from Brewfather: Settings > Power-ups > Custom Stream. Copy the logging ID.

Optional settings:
- **`PILL_MAC`** - Your Pill's BLE MAC address. Find it by running a quick scan (see "Finding your Pill's MAC" below). If not set, the app accepts readings from any nearby RAPT Pill.
- **`GRAVITY_OFFSET`** / **`TEMP_OFFSET`** - Calibration offsets. See "Calibration" below.

### Finding your Pill's MAC

Run a temporary scan to discover your Pill:

```bash
cd ~/rpi-pill
node -e "
  const noble = require('@abandonware/noble');
  noble.on('stateChange', s => s === 'poweredOn' && noble.startScanning([], true));
  noble.on('discover', p => {
    const d = p.advertisement.manufacturerData;
    if (d && d.length >= 25 && d.readUInt16LE(0) === 0x5241) {
      console.log('Found RAPT Pill:', p.address);
      process.exit(0);
    }
  });
  setTimeout(() => { console.log('No Pill found (is it nearby and awake?)'); process.exit(1); }, 60000);
"
```

The Pill must be actively advertising. If it's in WiFi mode with a long interval, you may need to wait or wake it by tilting/shaking.

### Calibration

BLE-broadcast values are uncalibrated. To calibrate:

1. Place the Pill in plain water at a known temperature
2. Read the raw values from the dashboard or API
3. Compare with reference (water = 1.000 SG at 20C)
4. Set offsets: e.g., if raw gravity reads 0.998, set `GRAVITY_OFFSET=0.002`

## 8. Load environment and start

```bash
cd ~/rpi-pill

# Load .env into shell (or use a process manager - see below)
export $(grep -v '^#' .env | xargs)
node server.js
```

You should see:

```
[Server] Dashboard at http://localhost:3000
[Server] API at http://localhost:3000/api/readings
[Server] Brewfather forwarding enabled (every 15 min)
[BLE] Bluetooth powered on, scanning for RAPT Pill...
```

Open `http://raspberrypi.local:3000` in a browser on the same network.

## 9. Run as a systemd service

To keep it running after reboot and across SSH sessions:

```bash
sudo nano /etc/systemd/system/rpi-pill.service
```

Paste:

```ini
[Unit]
Description=RPi-Pill BLE Relay
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/rpi-pill
EnvironmentFile=/home/pi/rpi-pill/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rpi-pill
sudo systemctl start rpi-pill
```

Check status:

```bash
sudo systemctl status rpi-pill
journalctl -u rpi-pill -f   # follow logs
```

## 10. Set up Brewfather

1. Open Brewfather > **Settings** > **Power-ups**
2. Enable **Custom Stream** and copy the **Logging ID** (this goes in your `.env`)
3. Start a fermenting batch
4. Go to the batch > **Readings** tab > **Attach Device**
5. Select **RPi-Pill** (or whatever you set as `DEVICE_NAME`)
6. Readings will appear on the fermentation chart every 15 minutes

## Endpoints

| URL | Description |
|-----|-------------|
| `http://<pi-ip>:3000/` | Dashboard with latest reading and history table |
| `http://<pi-ip>:3000/api/readings` | JSON array of readings (`?limit=N`, default 100) |
| `http://<pi-ip>:3000/api/readings/latest` | JSON object with the most recent reading |

### API response format

```json
[
  {
    "specificGravity": 1.0452,
    "temperatureC": 20.5,
    "timestamp": "2026-03-20T15:30:00.000Z"
  }
]
```

## RAPT Pill configuration

The Pill can operate in **WiFi mode** or **Bluetooth/Bridge mode**:

- **WiFi mode (default)**: Pill connects to WiFi and sends data to RAPT portal. BLE advertisements are still sent at the telemetry interval (default 60 min, configurable down to 15 min). This works but readings are infrequent.
- **Bluetooth/Bridge mode**: Pill only broadcasts via BLE, much more frequently (every few seconds). Battery life improves to 2+ years. Data is NOT sent to the RAPT portal unless you forward it yourself.

For best results with RPi-Pill, switch the Pill to **Bluetooth mode** via the RAPT app:

1. Open the RAPT app on your phone
2. Connect to your Pill
3. Go to Settings > Telemetry Mode
4. Select "Bluetooth" or "BLE Bridge"
5. Set the advertising interval as desired

In Bluetooth mode, the Pill advertises every few seconds, giving you near-real-time readings on the dashboard (though Brewfather still only receives them every 15 min due to rate limits).

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Error: Could not start scanning` | Run `sudo setcap cap_net_raw+eip $(readlink -f $(which node))` and ensure `bluetoothd` is stopped |
| No readings appear | Check Pill is nearby and awake. Try `sudo hcitool lescan` to verify BLE works. |
| `EACCES` on BLE | Run with `sudo` as a test, then fix permissions with `setcap` |
| Noble won't compile | Ensure `build-essential` and `libbluetooth-dev` are installed |
| Brewfather shows no data | Verify `BREWFATHER_LOGGING_ID` is correct. Check logs for `[Brewfather]` messages. |
| Dashboard shows stale data | Page auto-refreshes every 60s. If Pill is in WiFi mode, readings may be 15-60 min apart. |
| Multiple Pills detected | Set `PILL_MAC` in `.env` to filter to your specific Pill |
