# RPi-Pill Startup Verification

Step-by-step instructions to verify the RPi-Pill system is working after powering on the Raspberry Pi for a new fermentation. All commands are run from the development Mac via SSH.

## Prerequisites

- Raspberry Pi is powered on and connected to the network (Ethernet or WiFi)
- One or both RAPT Pills are turned on and in Bluetooth mode:
  - **Pastilla** (BLE MAC `90:38:0c:12:64:4a`)
  - **Nuevo** (BLE MAC `ec:62:60:28:3e:4a`)
- The Pi is reachable as `rpi3` or `192.168.1.107`

## Step 1: Verify SSH Access

```bash
ssh koger@rpi3 "echo 'SSH OK' && hostname && uptime"
```

**Expected**: Prints `SSH OK`, hostname `rpi3`, and uptime.
**If it fails**: The Pi may not be on the network yet. Wait 1-2 minutes after power-on. Try `ping rpi3` or `ping 192.168.1.107`. If using WiFi only (no Ethernet), the Pi connects to whichever of "preconfigured", "a", or "benko" is available.

## Step 2: Verify Bluetooth Adapter Is Up

```bash
ssh koger@rpi3 "sudo hciconfig hci0"
```

**Expected**: Output includes `UP RUNNING` on the second line.
**If it fails or shows `DOWN`**: The `hci0-up.service` may not have started. Fix with:

```bash
ssh koger@rpi3 "sudo hciconfig hci0 up && sudo systemctl restart rpi-pill"
```

## Step 3: Verify rpi-pill Service Is Running

```bash
ssh koger@rpi3 "sudo systemctl status rpi-pill --no-pager"
```

**Expected**: `Active: active (running)`. Logs should show `[Config] 2 pill(s) configured: Pastilla (...), Nuevo (...)` and `[BLE] Bluetooth powered on, scanning for RAPT Pill...`.
**If it shows `inactive` or `failed`**:

```bash
ssh koger@rpi3 "sudo systemctl start rpi-pill"
```

Then re-check status. If it keeps failing, check full logs:

```bash
ssh koger@rpi3 "sudo journalctl -u rpi-pill --no-pager -n 30"
```

## Step 4: Verify RAPT Pill Is Being Detected

```bash
ssh koger@rpi3 "sudo journalctl -u rpi-pill --no-pager -n 30 | grep -E '\\[Pastilla\\]|\\[Nuevo\\]'"
```

**Expected**: One or more lines like `[Pastilla] SG: 1.0452 | Temp: 20.5C | Battery: 87.2%` or `[Nuevo] SG: ...`.
Each Pill logs under its own name. You may only see one if only one Pill is active.
**If no readings appear**: The Pill may not be advertising yet. Wait up to 5 minutes (the Pill's BLE interval). If still nothing after 5 minutes:

1. Verify the Pill is on and in Bluetooth mode (LED should blink periodically)
2. Move the Pill closer to the Pi (within 2-3 meters)
3. Tilt/shake the Pill to wake it
4. Run a manual BLE scan to see if any RAPT device is broadcasting:

```bash
ssh koger@rpi3 "sudo systemctl stop rpi-pill && sudo hciconfig hci0 down && sudo hciconfig hci0 up && timeout 30 node -e \"
  const noble = require('/home/koger/rpi-pill/node_modules/@abandonware/noble');
  noble.on('stateChange', s => s === 'poweredOn' && noble.startScanning([], true));
  noble.on('discover', p => {
    const d = p.advertisement.manufacturerData;
    if (d && d.length >= 25 && d.readUInt16BE(0) === 0x5241) {
      console.log('RAPT Pill found:', p.address, 'SG raw:', d.readFloatBE(13).toFixed(1));
      process.exit(0);
    }
  });
  setTimeout(() => { console.log('No Pill found after 30s'); process.exit(1); }, 30000);
\" 2>&1; sudo systemctl start rpi-pill"
```

If the manual scan finds the Pill but the service doesn't, restart the service:

```bash
ssh koger@rpi3 "sudo hciconfig hci0 down && sudo hciconfig hci0 up && sudo systemctl restart rpi-pill"
```

## Step 5: Verify Web Dashboard Is Accessible

```bash
curl -s --connect-timeout 5 http://rpi3:3000/api/pills
```

**Expected**: A JSON array listing both Pills with their latest readings:
```json
[
  {"name":"Pastilla","mac":"90:38:0c:12:64:4a","readingCount":5,"latest":{...}},
  {"name":"Nuevo","mac":"ec:62:60:28:3e:4a","readingCount":0,"latest":null}
]
```

To check a specific Pill:
```bash
curl -s --connect-timeout 5 "http://rpi3:3000/api/readings/latest?pill=Pastilla"
```
**If connection refused**: The Express server isn't running. Check Step 3.
**If timeout**: The Pi may be on a different network/IP. Check:

```bash
ssh koger@rpi3 "hostname -I"
```

Use the IP shown to access the dashboard: `http://<ip>:3000/`.

## Step 6: Verify Brewfather Forwarding

```bash
ssh koger@rpi3 "sudo journalctl -u rpi-pill --no-pager -n 50 | grep '\\[Brewfather\\]'"
```

**Expected**: After the first reading from each Pill, within 15 minutes you should see lines like:
```
[Brewfather] Pastilla posted: { result: 'OK' }
[Brewfather] Nuevo posted: { result: 'OK' }
```
Each Pill has its own 15-minute rate limit timer.
**If you see errors**: Check the logging ID is correct:

```bash
ssh koger@rpi3 "grep BREWFATHER_LOGGING_ID ~/rpi-pill/.env"
```

Should show `BREWFATHER_LOGGING_ID=xHtKkpMiN3AKwL`. If wrong, fix it and restart:

```bash
ssh koger@rpi3 "sudo systemctl restart rpi-pill"
```

## Step 7: Verify Dashboard Pages Load

Open these in a browser (or fetch with curl):

```bash
curl -s --connect-timeout 5 http://rpi3:3000/ | head -5
curl -s --connect-timeout 5 "http://rpi3:3000/graph?pill=Pastilla" | head -5
curl -s --connect-timeout 5 "http://rpi3:3000/graph?pill=Nuevo" | head -5
```

**Expected**: All return HTML starting with `<!DOCTYPE html>`. The dashboard shows both Pills in separate sections.

## Step 8: Attach Device to Batch in Brewfather

This is a manual step in the Brewfather app/website:

For each fermenting batch:

1. Open the fermenting batch in Brewfather
2. Go to the **Readings** tab
3. Click **Attach Device**
4. Select the correct Pill device name (**Pastilla** or **Nuevo**)

Each Pill appears as a separate device in Brewfather and can be attached to a different batch. This step cannot be automated — remind the user to do it for each batch.

## Quick All-in-One Check

Run all critical checks in one command:

```bash
ssh koger@rpi3 "echo '=== Service ===' && systemctl is-active rpi-pill && echo '=== BLE ===' && sudo hciconfig hci0 | grep -o 'UP RUNNING' && echo '=== Pills ===' && curl -s http://localhost:3000/api/pills && echo '' && echo '=== Brewfather ===' && grep BREWFATHER_LOGGING_ID ~/rpi-pill/.env && echo '=== Network ===' && hostname -I"
```

**Expected output**:
```
=== Service ===
active
=== BLE ===
UP RUNNING
=== Pills ===
[{"name":"Pastilla","mac":"90:38:0c:12:64:4a","readingCount":5,"latest":{...}},{"name":"Nuevo","mac":"ec:62:60:28:3e:4a","readingCount":3,"latest":{...}}]
=== Brewfather ===
BREWFATHER_LOGGING_ID=xHtKkpMiN3AKwL
=== Network ===
192.168.1.107 ...
```

If a Pill's `readingCount` is 0 and `latest` is null, that Pill hasn't been detected yet — wait up to 5 minutes and re-run. It's normal for only one Pill to be active if the other isn't in use.

## Troubleshooting Summary

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| SSH fails | Pi not on network | Wait 1-2 min, check Ethernet/WiFi |
| Service inactive | Didn't start on boot | `sudo systemctl start rpi-pill` |
| BLE poweredOff | hci0 not up | `sudo hciconfig hci0 up && sudo systemctl restart rpi-pill` |
| No readings for one Pill | That Pill not advertising | Wait 5 min, shake Pill, check BLE mode. Other Pill may still work. |
| Dashboard unreachable | Wrong IP / service down | `ssh koger@rpi3 "hostname -I"`, check service |
| Brewfather errors | Wrong logging ID | Check `.env`, verify in Brewfather Settings |
| Readings appear locally but not in Brewfather | Rate limit (15 min) | Wait 15 minutes after first reading |
