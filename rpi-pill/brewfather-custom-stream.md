# Brewfather Custom Stream Integration

## Overview

The Brewfather **Custom Stream** integration allows any device to log temperature, gravity, pressure, and other sensor data to Brewfather via a simple HTTP POST request. This is the mechanism we'll use to send readings from the Raspberry Pi webservice to Brewfather, where they appear as a custom device alongside built-in integrations like Tilt, iSpindel, or RAPT.

Each POST creates a data point in Brewfather's logging system. When a batch is fermenting and the device is attached to that batch, readings appear on the fermentation chart.

## Setup in Brewfather UI

1. Go to **Settings > Power-ups** in the Brewfather app
2. Find and enable **Custom Stream**
3. Copy the **Logging ID** that appears after enabling
4. Use this ID in the API URL query parameter

> Requires Brewfather Premium subscription.

## API Endpoint

```
POST https://log.brewfather.net/stream?id=<LOGGING_ID>
```

- **Authentication**: The `id` query parameter serves as the API key — no other auth headers needed
- **Content-Type**: `application/json`
- **Protocol**: HTTP or HTTPS (HTTPS recommended)

## JSON Payload Format

### Required Field

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique device name. Must be consistent across requests — this is how Brewfather identifies the device. First POST with a new name auto-creates the device. |

At least one value field (temperature, gravity, etc.) must be included alongside `name`.

### Temperature Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `temp` | number | — | Current temperature reading |
| `aux_temp` | number | — | Displayed as "Fridge Temp" |
| `ext_temp` | number | — | Displayed as "Room Temp" |
| `temp_unit` | string | `"C"` | `"C"`, `"F"`, or `"K"` |
| `temp_target` | number | — | Target temperature |

### Gravity Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `gravity` | number | — | Gravity reading (e.g. `1.052` for SG, `13.0` for Plato) |
| `gravity_unit` | string | `"G"` | `"G"` for specific gravity, `"P"` for Plato |
| `gravity_target` | number | — | Target gravity |

### Pressure Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pressure` | number | — | Pressure reading |
| `pressure_unit` | string | `"PSI"` | `"PSI"`, `"BAR"`, or `"KPA"` |

### Additional Sensors

| Field | Type | Description |
|-------|------|-------------|
| `ph` | number | pH value |
| `bpm` | number | Bubbles per minute |
| `battery` | number | Battery level (volts) |
| `rssi` | number | WiFi/signal strength (dBm) |
| `angle` | number | Hydrometer tilt angle (degrees) |

### Volume & Container

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `volume` | number | — | Current volume |
| `volume_unit` | string | `"L"` | `"L"`, `"GAL"`, or `"OZ"` |
| `pour_volume` | number | — | Last pour amount |
| `max_volume` | number | — | Container capacity |

### Device Metadata

| Field | Type | Description |
|-------|------|-------------|
| `comment` | string | Free-form text note |
| `beer` | string | Beer name/style |
| `device_source` | string | Device type identifier (e.g. `"RPi-Pill"`) |
| `report_source` | string | Reporting application name |
| `device_state` | string | Current state (e.g. `"heating"`, `"cooling"`) |

## Rate Limits

- **Minimum interval: 15 minutes per device**
- POSTs more frequent than every 15 minutes are silently ignored
- Each unique `name` is treated as a separate device with its own rate limit
- Recommendation: post every 15–20 minutes to stay within limits

## Example Payload

```json
{
  "name": "RPi-Pill",
  "temp": 20.5,
  "temp_unit": "C",
  "gravity": 1.048,
  "gravity_unit": "G",
  "battery": 3.7,
  "comment": "Raspberry Pi hydrometer relay"
}
```

## Success Response

```
HTTP 200 OK
{ "result": "OK" }
```

## NodeJS Implementation

```javascript
const https = require('https');

const BREWFATHER_LOGGING_ID = process.env.BREWFATHER_LOGGING_ID;
const BREWFATHER_STREAM_URL = `https://log.brewfather.net/stream?id=${BREWFATHER_LOGGING_ID}`;

/**
 * Post a reading to Brewfather Custom Stream.
 * @param {object} reading - Must include `name` and at least one value field.
 * @returns {Promise<object>} Brewfather response
 */
function postToBrewfather(reading) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(reading);
    const url = new URL(BREWFATHER_STREAM_URL);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Brewfather responded ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Example usage
async function sendReading(gravity, tempC, battery) {
  const reading = {
    name: 'RPi-Pill',
    gravity: gravity,
    gravity_unit: 'G',
    temp: tempC,
    temp_unit: 'C',
    battery: battery,
  };

  const result = await postToBrewfather(reading);
  console.log('Brewfather response:', result);
  return result;
}

module.exports = { postToBrewfather, sendReading };
```

### Using with fetch (Node 18+)

```javascript
async function postToBrewfather(reading) {
  const resp = await fetch(
    `https://log.brewfather.net/stream?id=${process.env.BREWFATHER_LOGGING_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reading),
    }
  );

  if (!resp.ok) {
    throw new Error(`Brewfather responded ${resp.status}: ${await resp.text()}`);
  }

  return resp.json();
}
```

## Attaching to a Batch

Once the device starts posting, it appears in Brewfather under the device list. To see readings on a batch's fermentation chart:

1. Open the fermenting batch in Brewfather
2. Go to the **Readings** tab
3. Click **Attach Device**
4. Select the custom stream device by its `name`

Readings will then appear on the fermentation graph alongside any other attached devices.

## Error Handling & Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| No data appearing | Wrong logging ID | Verify the `id` parameter matches the one in Brewfather Settings |
| Readings missing | Posting too frequently | Ensure minimum 15-minute gap between POSTs per device |
| Device not in list | Never posted successfully | Check for HTTP errors; verify `name` field is present |
| `403` or `401` | Invalid or expired logging ID | Re-check the logging ID in Brewfather Power-ups settings |
| Duplicate devices | Inconsistent `name` field | Always use the exact same `name` string |

## Known Limitations

- **15-minute minimum interval** — cannot log more frequently than this
- **No batch auto-attach** — device must be manually attached to each batch
- **No historical backfill** — can only log in real-time; cannot POST past timestamps
- **No DELETE/UPDATE** — individual readings cannot be modified or removed via the API
- **Premium only** — requires active Brewfather Premium subscription
- **Logging ID is the only auth** — treat it as a secret; anyone with the ID can post to your account
