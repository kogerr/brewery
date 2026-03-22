const https = require('https');

function postToBrewfather(loggingId, deviceName, reading) {
  const payload = {
    name: deviceName,
    temp: reading.temperatureC,
    temp_unit: 'C',
    gravity: reading.specificGravity,
    gravity_unit: 'G',
    battery: reading.battery,
    device_source: 'RPi-Pill',
    report_source: 'rpi-pill',
  };

  const data = JSON.stringify(payload);
  const url = new URL(`https://log.brewfather.net/stream?id=${loggingId}`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Brewfather ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = { postToBrewfather };
