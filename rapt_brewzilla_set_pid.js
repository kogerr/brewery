const fs = require("fs");

// Set PID coefficients on the BrewZilla via the RAPT API.
// Endpoint: POST /api/BrewZillas/SetPID?brewZillaId=<uuid>&p=<double>&i=<double>&d=<double>
// Usage: node rapt_brewzilla_set_pid.js [p] [i] [d] [brewZillaId]
// Defaults: p=0.50 i=0.002 d=0.00

const CONFIG_FILE = "rapt_io_key.yaml";
const AUTH_URL = "https://id.rapt.io/connect/token";
const API_BASE = "https://api.rapt.io/api/BrewZillas";

function loadConfig() {
  const config = {};
  fs.readFileSync(CONFIG_FILE, "utf8").split("\n").forEach((line) => {
    const [key, val] = line.split(/:\s*/);
    if (key && val) config[key.trim()] = val.trim();
  });
  if (!config.username || !config.apikey) {
    throw new Error(`Missing username or apikey in ${CONFIG_FILE}`);
  }
  return config;
}

async function getToken(config) {
  const body = `client_id=rapt-user&grant_type=password&username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.apikey)}`;
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token in auth response: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function getBrewZillas(token) {
  const res = await fetch(`${API_BASE}/GetBrewZillas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GetBrewZillas failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function getBrewZilla(token, brewZillaId) {
  const res = await fetch(`${API_BASE}/GetBrewZilla?brewZillaId=${brewZillaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GetBrewZilla failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function setPID(token, brewZillaId, p, i, d) {
  const url = `${API_BASE}/SetPID?brewZillaId=${brewZillaId}&p=${p}&i=${i}&d=${d}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SetPID failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const p = args[0] !== undefined ? parseFloat(args[0]) : 0.5;
  const i = args[1] !== undefined ? parseFloat(args[1]) : 0.002;
  const d = args[2] !== undefined ? parseFloat(args[2]) : 0.0;
  const explicitId = args[3];

  if (!Number.isFinite(p) || !Number.isFinite(i) || !Number.isFinite(d)) {
    throw new Error(`Invalid PID values: p=${p} i=${i} d=${d}`);
  }

  const config = loadConfig();
  const token = await getToken(config);

  let brewZillaId;
  let name;

  if (explicitId) {
    brewZillaId = explicitId;
    name = (await getBrewZilla(token, brewZillaId)).name;
  } else {
    const list = await getBrewZillas(token);
    if (!list.length) throw new Error("No BrewZillas found on this account");
    brewZillaId = list[0].id;
    name = list[0].name;
    if (list.length > 1) {
      console.error(`Warning: ${list.length} BrewZillas found, using first: ${name} (${brewZillaId})`);
    }
  }

  console.error(`Setting PID on "${name}" (${brewZillaId}) → p=${p} i=${i} d=${d}`);
  const ok = await setPID(token, brewZillaId, p, i, d);

  const after = await getBrewZilla(token, brewZillaId);

  console.log(JSON.stringify({
    ok,
    brewZillaId,
    name,
    set: { p, i, d },
    readback: {
      pidEnabled: after.pidEnabled,
      pidProportional: after.pidProportional,
      pidIntegral: after.pidIntegral,
      pidDerivative: after.pidDerivative,
      pidCycleTime: after.pidCycleTime,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
