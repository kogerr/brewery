const fs = require("fs");

const config = {};
fs.readFileSync("rapt_io_key.yaml", "utf8").split("\n").forEach((line) => {
  const [key, val] = line.split(/:\s*/);
  if (key && val) config[key.trim()] = val.trim();
});

async function getToken() {
  const res = await fetch("https://id.rapt.io/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=rapt-user&grant_type=password&username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.apikey)}`
  });
  const { access_token } = await res.json();
  return access_token;
}

async function main() {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  const api = "https://api.rapt.io/api/Hydrometers";

  // Find active hydrometer, or most recently active one
  const hydrometers = await fetch(`${api}/GetHydrometers`, { headers }).then(r => r.json());
  if (!hydrometers.length) { console.error("No hydrometers found"); process.exit(1); }

  let hydro = hydrometers.find(h => h.active);
  if (!hydro) {
    hydro = hydrometers.sort((a, b) => new Date(b.lastActivityTime) - new Date(a.lastActivityTime))[0];
    console.error(`No active hydrometer. Using most recent: ${hydro.name} (last active: ${hydro.lastActivityTime})`);
  }

  // Get telemetry (default: last 30 days)
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
  const telemetry = await fetch(`${api}/GetTelemetry?hydrometerId=${hydro.id}&startDate=${startDate}&endDate=${endDate}`, { headers }).then(r => r.json());
  if (!telemetry.length) { console.error("No telemetry data"); process.exit(1); }

  // Convert RAPT gravity (e.g. 1044.23) to standard SG (1.04423), filter out calibration noise
  const sorted = telemetry
    .sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn))
    .filter(r => r.gravity > 990 && r.gravity < 1200)
    .map(r => ({
      time: r.createdOn,
      sg: +(r.gravity / 1000).toFixed(4),
      temp: +r.temperature.toFixed(1)
    }));

  if (!sorted.length) { console.error("No valid telemetry data"); process.exit(1); }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  console.log(JSON.stringify({
    hydrometer: hydro.name,
    active: hydro.active,
    summary: {
      gravity: { start: first.sg, current: last.sg, drop: +(first.sg - last.sg).toFixed(4) },
      temperature: { start: first.temp, current: last.temp, change: +(last.temp - first.temp).toFixed(1) },
      hours: +((new Date(last.time) - new Date(first.time)) / 3600000).toFixed(1)
    },
    readings: sorted
  }, null, 2));
}

main().catch(console.error);
