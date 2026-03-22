const express = require('express');
const { RaptPillScanner } = require('./ble');
const { postToBrewfather } = require('./brewfather');

// --- Config ---
const PORT = parseInt(process.env.PORT || '3000', 10);
const BREWFATHER_LOGGING_ID = process.env.BREWFATHER_LOGGING_ID;
const BREWFATHER_INTERVAL_MS = Math.max(parseInt(process.env.BREWFATHER_INTERVAL || '15', 10), 15) * 60_000;
const MAX_READINGS = 1000;

// Parse pill configs from PILL_<n>_MAC / PILL_<n>_NAME env vars
function parsePillConfigs() {
  const pills = [];
  for (let i = 1; i <= 10; i++) {
    const mac = process.env[`PILL_${i}_MAC`];
    if (!mac) {
      continue;
    }
    pills.push({
      mac,
      name: process.env[`PILL_${i}_NAME`] || `Pill-${i}`,
      brewfatherName: process.env[`PILL_${i}_BREWFATHER_NAME`] || process.env[`PILL_${i}_NAME`] || `RPi-Pill-${i}`,
      gravityOffset: parseFloat(process.env[`PILL_${i}_GRAVITY_OFFSET`] || '0'),
      tempOffset: parseFloat(process.env[`PILL_${i}_TEMP_OFFSET`] || '0'),
    });
  }
  // Fallback: single-pill legacy config
  if (pills.length === 0) {
    const mac = process.env.PILL_MAC || null;
    pills.push({
      mac,
      name: process.env.DEVICE_NAME || 'RPi-Pill',
      brewfatherName: process.env.DEVICE_NAME || 'RPi-Pill',
      gravityOffset: parseFloat(process.env.GRAVITY_OFFSET || '0'),
      tempOffset: parseFloat(process.env.TEMP_OFFSET || '0'),
    });
  }
  return pills;
}

const pillConfigs = parsePillConfigs();
console.log(`[Config] ${pillConfigs.length} pill(s) configured:`, pillConfigs.map((p) => `${p.name} (${p.mac || 'any'})`).join(', '));

// --- State: per-pill readings and Brewfather timestamps ---
const pillState = {};
for (const pill of pillConfigs) {
  pillState[pill.name] = {
    config: pill,
    readings: [],
    lastBrewfatherPost: 0,
  };
}

function getState(pillName) {
  if (!pillState[pillName]) {
    // Unknown pill (no MAC filter configured, single-pill legacy mode)
    const fallback = Object.values(pillState)[0];
    return fallback;
  }
  return pillState[pillName];
}

// --- BLE Scanner ---
const scanner = new RaptPillScanner({
  pills: pillConfigs,
  gravityOffset: parseFloat(process.env.GRAVITY_OFFSET || '0'),
  tempOffset: parseFloat(process.env.TEMP_OFFSET || '0'),
});

scanner.on('reading', (reading) => {
  const state = getState(reading.pillName);
  console.log(`[${reading.pillName}] SG: ${reading.specificGravity} | Temp: ${reading.temperatureC}C | Battery: ${reading.battery}%`);

  state.readings.push(reading);
  if (state.readings.length > MAX_READINGS) {
    state.readings.shift();
  }

  forwardToBrewfather(state, reading);
});

async function forwardToBrewfather(state, reading) {
  if (!BREWFATHER_LOGGING_ID) {
    return;
  }

  const now = Date.now();
  if (now - state.lastBrewfatherPost < BREWFATHER_INTERVAL_MS) {
    return;
  }

  try {
    const result = await postToBrewfather(BREWFATHER_LOGGING_ID, state.config.brewfatherName, reading);
    state.lastBrewfatherPost = now;
    console.log(`[Brewfather] ${state.config.brewfatherName} posted:`, result);
  } catch (err) {
    console.error(`[Brewfather] ${state.config.brewfatherName} error:`, err.message);
  }
}

// --- Express ---
const app = express();

// List all pills
app.get('/api/pills', (req, res) => {
  res.json(Object.keys(pillState).map((name) => ({
    name,
    mac: pillState[name].config.mac,
    readingCount: pillState[name].readings.length,
    latest: pillState[name].readings.length > 0 ? pillState[name].readings[pillState[name].readings.length - 1] : null,
  })));
});

// Readings for a specific pill (or default)
app.get('/api/readings', (req, res) => {
  const pill = req.query.pill;
  const state = pill ? pillState[pill] : Object.values(pillState)[0];
  if (!state) {
    return res.status(404).json({ error: 'Pill not found' });
  }
  const limit = Math.min(parseInt(req.query.limit || '100', 10), MAX_READINGS);
  const data = state.readings.slice(-limit).map((r) => ({
    pillName: r.pillName,
    specificGravity: r.specificGravity,
    temperatureC: r.temperatureC,
    timestamp: r.timestamp,
  }));
  res.json(data);
});

app.get('/api/readings/latest', (req, res) => {
  const pill = req.query.pill;
  const state = pill ? pillState[pill] : Object.values(pillState)[0];
  if (!state) {
    return res.status(404).json({ error: 'Pill not found' });
  }
  if (state.readings.length === 0) {
    return res.json(null);
  }
  const r = state.readings[state.readings.length - 1];
  res.json({
    pillName: r.pillName,
    specificGravity: r.specificGravity,
    temperatureC: r.temperatureC,
    timestamp: r.timestamp,
  });
});

app.get('/graph', (req, res) => {
  const pill = req.query.pill;
  const state = pill ? pillState[pill] : Object.values(pillState)[0];
  if (!state) {
    return res.status(404).send('Pill not found');
  }
  res.type('html').send(renderGraphPage(state.readings, state.config.name));
});

app.get('/', (req, res) => {
  res.type('html').send(renderDashboard());
});

function renderDashboard() {
  const names = Object.keys(pillState);
  let pillSections = '';

  for (const name of names) {
    const state = pillState[name];
    const latest = state.readings.length > 0 ? state.readings[state.readings.length - 1] : null;
    const recent = state.readings.slice(-25).reverse();

    const latestHtml = latest
      ? `<div class="cards">
          <div class="card">
            <div class="label">Specific Gravity</div>
            <div class="value">${latest.specificGravity.toFixed(4)}</div>
          </div>
          <div class="card">
            <div class="label">Temperature</div>
            <div class="value">${latest.temperatureC.toFixed(1)}&deg;C</div>
          </div>
          <div class="card">
            <div class="label">Battery</div>
            <div class="value">${latest.battery.toFixed(0)}%</div>
          </div>
          <div class="card">
            <div class="label">Last Updated</div>
            <div class="value small">${new Date(latest.timestamp).toLocaleString()}</div>
          </div>
        </div>`
      : `<p class="waiting">Waiting for readings...</p>`;

    const rowsHtml = recent
      .map(
        (r) => `<tr>
          <td>${new Date(r.timestamp).toLocaleString()}</td>
          <td>${r.specificGravity.toFixed(4)}</td>
          <td>${r.temperatureC.toFixed(1)}&deg;C</td>
          <td>${r.battery.toFixed(0)}%</td>
        </tr>`
      )
      .join('');

    pillSections += `
      <h2 class="pill-name">${name} <a href="/graph?pill=${encodeURIComponent(name)}" class="graph-link">graph</a></h2>
      ${latestHtml}
      ${recent.length > 0 ? `
      <table>
        <thead>
          <tr><th>Time</th><th>Gravity (SG)</th><th>Temperature</th><th>Battery</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>` : ''}`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RPi-Pill Dashboard</title>
  <meta http-equiv="refresh" content="60">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1a2e; color: #eee; padding: 1.5rem; }
    h1 { text-align: center; margin-bottom: 1.5rem; color: #e94560; }
    h2.pill-name { color: #e94560; margin: 1.5rem 0 1rem; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
    .graph-link { font-size: 0.8rem; font-weight: normal; margin-left: 0.5rem; color: #4ecdc4; text-decoration: none; }
    .graph-link:hover { text-decoration: underline; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
    .card { background: #16213e; border-radius: 12px; padding: 1.2rem; text-align: center; }
    .card .label { font-size: 0.85rem; color: #888; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .card .value { font-size: 1.8rem; font-weight: 700; color: #e94560; }
    .card .value.small { font-size: 1rem; color: #ccc; }
    .waiting { text-align: center; color: #888; font-style: italic; margin: 1rem 0; }
    table { width: 100%; border-collapse: collapse; background: #16213e; border-radius: 12px; overflow: hidden; margin-bottom: 1rem; }
    th, td { padding: 0.6rem 1rem; text-align: left; }
    th { background: #0f3460; color: #e94560; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    tr:nth-child(even) { background: #1a1a3e; }
    td { font-size: 0.9rem; }
    .footer { text-align: center; margin-top: 1.5rem; color: #555; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>RPi-Pill Dashboard</h1>
  ${pillSections}
  <p class="footer">RAPT Pill BLE Relay &mdash; Auto-refreshes every 60s</p>
</body>
</html>`;
}

function renderGraphPage(allReadings, pillName) {
  if (allReadings.length === 0) {
    return graphPageShell(`<p class="waiting">No readings yet for ${pillName}. Waiting for RAPT Pill data...</p>`, null, pillName);
  }

  const W = 900, H = 400;
  const pad = { top: 30, right: 70, bottom: 50, left: 70 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  const gravities = allReadings.map((r) => r.specificGravity);
  const temps = allReadings.map((r) => r.temperatureC);
  const times = allReadings.map((r) => new Date(r.timestamp).getTime());

  const tMin = times[0];
  const tMax = times[times.length - 1];
  const tRange = Math.max(tMax - tMin, 1);

  const gMin = 1.0;
  const gDataMax = Math.max(...gravities);
  const gMax = Math.ceil(gDataMax * 100) / 100 + 0.002;
  const gRange = Math.max(gMax - gMin, 0.001);

  const tempMin = Math.floor(Math.min(...temps));
  const tempMax = Math.ceil(Math.max(...temps));
  const tempRange = Math.max(tempMax - tempMin, 1);

  const sx = (t) => pad.left + ((t - tMin) / tRange) * cw;
  const sy = (g) => pad.top + ((gMax - g) / gRange) * ch;
  const syT = (t) => pad.top + ((tempMax - t) / tempRange) * ch;

  // Gravity grid lines
  const gStep = gRange > 0.05 ? 0.01 : 0.005;
  let gridLines = '';
  for (let g = gMin; g <= gMax; g += gStep) {
    const y = sy(g);
    gridLines += `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="#2a2a4a" stroke-dasharray="4,4"/>`;
    gridLines += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="#888" font-size="11">${g.toFixed(3)}</text>`;
  }

  // Time axis labels
  const labelCount = Math.min(6, allReadings.length);
  let timeLabels = '';
  for (let i = 0; i < labelCount; i++) {
    const idx = labelCount === 1 ? 0 : Math.round((i / (labelCount - 1)) * (times.length - 1));
    const x = sx(times[idx]);
    const d = new Date(allReadings[idx].timestamp);
    const label = tRange > 86400000
      ? `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
      : `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    timeLabels += `<text x="${x}" y="${H - pad.bottom + 20}" text-anchor="middle" fill="#888" font-size="11">${label}</text>`;
    timeLabels += `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${H - pad.bottom}" stroke="#2a2a4a" stroke-dasharray="4,4"/>`;
  }

  // Temperature axis labels (right side)
  let tempLabels = '';
  const tStep = tempRange > 10 ? 5 : tempRange > 4 ? 2 : 1;
  for (let t = tempMin; t <= tempMax; t += tStep) {
    const y = syT(t);
    tempLabels += `<text x="${W - pad.right + 8}" y="${y + 4}" text-anchor="start" fill="#4ecdc4" font-size="11">${t}&deg;C</text>`;
  }

  // Gravity polyline
  const gPoints = allReadings.map((r, i) => `${sx(times[i])},${sy(r.specificGravity)}`).join(' ');

  // Temperature polyline
  const tPoints = allReadings.map((r, i) => `${sx(times[i])},${syT(r.temperatureC)}`).join(' ');

  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
    <rect width="${W}" height="${H}" fill="#16213e" rx="12"/>
    ${gridLines}
    ${timeLabels}
    ${tempLabels}
    <!-- axes -->
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${H - pad.bottom}" stroke="#555"/>
    <line x1="${pad.left}" y1="${H - pad.bottom}" x2="${W - pad.right}" y2="${H - pad.bottom}" stroke="#555"/>
    <line x1="${W - pad.right}" y1="${pad.top}" x2="${W - pad.right}" y2="${H - pad.bottom}" stroke="#4ecdc455"/>
    <!-- axis titles -->
    <text x="15" y="${H / 2}" text-anchor="middle" fill="#e94560" font-size="12" transform="rotate(-90,15,${H / 2})">Gravity (SG)</text>
    <text x="${W - 10}" y="${H / 2}" text-anchor="middle" fill="#4ecdc4" font-size="12" transform="rotate(90,${W - 10},${H / 2})">Temperature</text>
    <!-- data -->
    <polyline points="${tPoints}" fill="none" stroke="#4ecdc4" stroke-width="1.5" stroke-opacity="0.6"/>
    <polyline points="${gPoints}" fill="none" stroke="#e94560" stroke-width="2"/>
    ${allReadings.length <= 200 ? allReadings.map((r, i) =>
      `<circle cx="${sx(times[i])}" cy="${sy(r.specificGravity)}" r="2.5" fill="#e94560"/>`
    ).join('') : ''}
    <!-- legend -->
    <line x1="${pad.left + 10}" y1="${pad.top - 12}" x2="${pad.left + 30}" y2="${pad.top - 12}" stroke="#e94560" stroke-width="2"/>
    <text x="${pad.left + 34}" y="${pad.top - 8}" fill="#e94560" font-size="11">Gravity</text>
    <line x1="${pad.left + 100}" y1="${pad.top - 12}" x2="${pad.left + 120}" y2="${pad.top - 12}" stroke="#4ecdc4" stroke-width="1.5"/>
    <text x="${pad.left + 124}" y="${pad.top - 8}" fill="#4ecdc4" font-size="11">Temperature</text>
    <!-- hover elements -->
    <line id="hoverLine" x1="0" y1="${pad.top}" x2="0" y2="${H - pad.bottom}" stroke="#ffffff44" stroke-width="1" visibility="hidden"/>
    <circle id="hoverDotG" cx="0" cy="0" r="4" fill="#e94560" stroke="#fff" stroke-width="1.5" visibility="hidden"/>
    <circle id="hoverDotT" cx="0" cy="0" r="4" fill="#4ecdc4" stroke="#fff" stroke-width="1.5" visibility="hidden"/>
    <rect id="hoverRect" x="0" y="0" width="0" height="0" fill="#16213eee" rx="6" visibility="hidden"/>
    <text id="hoverText1" x="0" y="0" fill="#e94560" font-size="12" font-weight="bold" visibility="hidden"></text>
    <text id="hoverText2" x="0" y="0" fill="#4ecdc4" font-size="12" visibility="hidden"></text>
    <text id="hoverText3" x="0" y="0" fill="#888" font-size="11" visibility="hidden"></text>
    <!-- invisible overlay to capture mouse events -->
    <rect x="${pad.left}" y="${pad.top}" width="${cw}" height="${ch}" fill="transparent" id="hoverArea"/>
  </svg>`;

  // Inject readings data + hover script
  const hoverScript = `<script>
(function() {
  var pts = ${JSON.stringify(allReadings.map((r, i) => [sx(times[i]), sy(r.specificGravity), syT(r.temperatureC), r.specificGravity, r.temperatureC, r.timestamp]))};
  var svg = document.querySelector('svg');
  var line = document.getElementById('hoverLine');
  var dotG = document.getElementById('hoverDotG');
  var dotT = document.getElementById('hoverDotT');
  var rect = document.getElementById('hoverRect');
  var t1 = document.getElementById('hoverText1');
  var t2 = document.getElementById('hoverText2');
  var t3 = document.getElementById('hoverText3');
  var area = document.getElementById('hoverArea');

  function svgX(e) {
    var pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse()).x;
  }

  function nearest(mx) {
    var best = 0, bestD = Infinity;
    for (var i = 0; i < pts.length; i++) {
      var d = Math.abs(pts[i][0] - mx);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function show(e) {
    var mx = svgX(e);
    var i = nearest(mx);
    var p = pts[i];
    var x = p[0], yG = p[1], yT = p[2];

    line.setAttribute('x1', x); line.setAttribute('x2', x); line.setAttribute('visibility', 'visible');
    dotG.setAttribute('cx', x); dotG.setAttribute('cy', yG); dotG.setAttribute('visibility', 'visible');
    dotT.setAttribute('cx', x); dotT.setAttribute('cy', yT); dotT.setAttribute('visibility', 'visible');

    var sg = 'SG: ' + p[3].toFixed(4);
    var temp = p[4].toFixed(1) + '\\u00B0C';
    var time = new Date(p[5]).toLocaleString();
    var boxX = x + 12;
    if (x > ${W - pad.right - 160}) { boxX = x - 152; }

    rect.setAttribute('x', boxX - 4); rect.setAttribute('y', ${pad.top}); rect.setAttribute('width', 148); rect.setAttribute('height', 52); rect.setAttribute('visibility', 'visible');
    t1.setAttribute('x', boxX); t1.setAttribute('y', ${pad.top + 16}); t1.textContent = sg; t1.setAttribute('visibility', 'visible');
    t2.setAttribute('x', boxX); t2.setAttribute('y', ${pad.top + 32}); t2.textContent = temp; t2.setAttribute('visibility', 'visible');
    t3.setAttribute('x', boxX); t3.setAttribute('y', ${pad.top + 46}); t3.textContent = time; t3.setAttribute('visibility', 'visible');
  }

  function hide() {
    [line,dotG,dotT,rect,t1,t2,t3].forEach(function(el) { el.setAttribute('visibility', 'hidden'); });
  }

  area.addEventListener('mousemove', show);
  area.addEventListener('mouseleave', hide);
  area.addEventListener('touchmove', function(e) { e.preventDefault(); show(e.touches[0]); }, {passive:false});
  area.addEventListener('touchend', hide);
})();
<` + `/script>`;

  // --- Stats below graph ---
  const og = Math.max(...gravities);
  const fg = gravities[gravities.length - 1];
  const abv = (og - fg) * 131.25;
  const now = tMax;

  function gravityAgo(hoursAgo) {
    const cutoff = now - hoursAgo * 3600_000;
    let closest = null;
    let closestDist = Infinity;
    for (let i = 0; i < allReadings.length; i++) {
      const dist = Math.abs(times[i] - cutoff);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    if (closest === null || closestDist > hoursAgo * 3600_000 * 0.5) {
      return null;
    }
    return gravities[closest];
  }

  const g12h = gravityAgo(12);
  const g24h = gravityAgo(24);
  const delta12h = g12h !== null ? (fg - g12h) : null;
  const delta24h = g24h !== null ? (fg - g24h) : null;

  let statsHtml = `<div class="stats">`;
  statsHtml += `<div class="stat"><span class="stat-label">OG</span><span class="stat-value">${og.toFixed(4)}</span></div>`;
  statsHtml += `<div class="stat"><span class="stat-label">Current SG</span><span class="stat-value">${fg.toFixed(4)}</span></div>`;
  statsHtml += `<div class="stat"><span class="stat-label">ABV</span><span class="stat-value">${abv.toFixed(1)}%</span></div>`;
  if (delta12h !== null) {
    statsHtml += `<div class="stat"><span class="stat-label">12h change</span><span class="stat-value">${delta12h >= 0 ? '+' : ''}${(delta12h * 1000).toFixed(1)} pts</span></div>`;
  }
  if (delta24h !== null) {
    statsHtml += `<div class="stat"><span class="stat-label">24h change</span><span class="stat-value">${delta24h >= 0 ? '+' : ''}${(delta24h * 1000).toFixed(1)} pts</span></div>`;
  }
  statsHtml += `</div>`;

  return graphPageShell(svg + statsHtml, hoverScript, pillName);
}

function graphPageShell(content, script, pillName) {
  const names = Object.keys(pillState);
  const pillLinks = names.map((n) =>
    `<a href="/graph?pill=${encodeURIComponent(n)}" style="color:${n === pillName ? '#e94560' : '#4ecdc4'}">${n}</a>`
  ).join(' | ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pillName} — Gravity Graph</title>
  <meta http-equiv="refresh" content="300">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1a2e; color: #eee; padding: 1.5rem; }
    h1 { text-align: center; margin-bottom: 0.5rem; color: #e94560; }
    .pill-nav { text-align: center; margin-bottom: 1.5rem; font-size: 0.9rem; }
    .pill-nav a { text-decoration: none; margin: 0 0.3rem; }
    .pill-nav a:hover { text-decoration: underline; }
    .graph { display: grid; justify-content: center; grid-template-columns: 100%; margin: 0 auto 1vh; gap: 1vh; }
    .waiting { text-align: center; color: #888; font-style: italic; margin: 2rem 0; }
    .stats { display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .stat { text-align: center; }
    .stat-label { display: block; font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
    .stat-value { font-size: 1.3rem; font-weight: 700; color: #e94560; }
    .footer { text-align: center; margin-top: 1.5rem; color: #555; font-size: 0.8rem; }
    a { color: #e94560; }
  </style>
</head>
<body>
  <h1>${pillName}</h1>
  ${names.length > 1 ? `<div class="pill-nav">${pillLinks}</div>` : ''}
  <div class="graph">${content}</div>
  <p class="footer"><a href="/">Dashboard</a> &mdash; Auto-refreshes every 5 min</p>
  ${script || ''}
</body>
</html>`;
}

// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Dashboard at http://localhost:${PORT}`);
  console.log(`[Server] API at http://localhost:${PORT}/api/readings`);
  if (BREWFATHER_LOGGING_ID) {
    console.log(`[Server] Brewfather forwarding enabled (every ${BREWFATHER_INTERVAL_MS / 60000} min)`);
  } else {
    console.log(`[Server] Brewfather forwarding DISABLED (set BREWFATHER_LOGGING_ID)`);
  }
});

scanner.start();
