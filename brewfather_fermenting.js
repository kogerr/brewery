const fs = require("fs");

const config = {};
fs.readFileSync("brewfather_key.yaml", "utf8").split("\n").forEach((line) => {
  const [key, val] = line.split(/:\s*/);
  if (key && val) config[key.trim()] = val.trim();
});
const auth = Buffer.from(`${config.userid}:${config.apikey}`).toString("base64");
const headers = { Authorization: `Basic ${auth}` };
const api = "https://api.brewfather.app/v2";

// Usage:
//   node brewfather_fermenting.js [status]         - get readings for batches with given status (default: Fermenting)
//   node brewfather_fermenting.js --batch-id <id>  - get readings for a specific batch by ID

const args = process.argv.slice(2);
let batchIds = [];
let status = "Fermenting";

if (args[0] === "--batch-id" && args[1]) {
  batchIds = [args[1]];
} else if (args[0]) {
  status = args[0];
}

function analyzeReadings(sorted) {
  if (sorted.length < 2) return null;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const t0 = new Date(first.time).getTime();

  // Find peak fermentation rate (max gravity drop per hour over a 6h window)
  let maxRate = 0, peakTime = null;
  const windowSize = 6;
  for (let i = 0; i < sorted.length; i++) {
    const ti = new Date(sorted[i].time).getTime();
    // Find reading ~windowSize hours later
    const targetT = ti + windowSize * 3600000;
    const j = sorted.findIndex((r, idx) => idx > i && new Date(r.time).getTime() >= targetT);
    if (j === -1) continue;
    const dt = (new Date(sorted[j].time).getTime() - ti) / 3600000;
    const dg = sorted[i].sg - sorted[j].sg;
    const rate = dg / dt; // SG points per hour
    if (rate > maxRate) {
      maxRate = rate;
      peakTime = sorted[i].time;
    }
  }

  // Find when fermentation was essentially done (gravity stable within 0.001 for 12+ hours)
  let stableTime = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const window = sorted.slice(i).filter(r =>
      new Date(r.time).getTime() <= new Date(sorted[i].time).getTime() + 12 * 3600000
    );
    if (window.length < 3) continue;
    const sgs = window.map(r => r.sg);
    const range = Math.max(...sgs) - Math.min(...sgs);
    if (range > 0.001) {
      // Previous reading was the start of stability
      stableTime = sorted[Math.min(i + 1, sorted.length - 1)].time;
      break;
    }
  }
  if (!stableTime) stableTime = sorted[0].time; // stable from the start (unlikely)

  // Daily summary
  const daily = [];
  for (let day = 0; day <= 120; day++) {
    const target = t0 + day * 24 * 3600000;
    if (target > new Date(last.time).getTime() + 3600000) break;
    const closest = sorted.reduce((a, b) =>
      Math.abs(new Date(a.time).getTime() - target) < Math.abs(new Date(b.time).getTime() - target) ? a : b
    );
    const d = new Date(closest.time).toISOString().slice(0, 10);
    if (!daily.length || daily[daily.length - 1].date !== d) {
      const prev = daily.length ? daily[daily.length - 1] : null;
      daily.push({
        day,
        date: d,
        sg: closest.sg,
        temp: closest.temp,
        sgDrop: prev ? +(prev.sg - closest.sg).toFixed(4) : 0,
      });
    }
  }

  const minSG = Math.min(...sorted.map(r => r.sg));

  return {
    peakFermentation: {
      time: peakTime,
      hoursAfterPitch: peakTime ? +((new Date(peakTime).getTime() - t0) / 3600000).toFixed(1) : null,
      rateSGperHour: +maxRate.toFixed(5),
    },
    fermentationDone: {
      time: stableTime,
      hoursAfterPitch: +((new Date(stableTime).getTime() - t0) / 3600000).toFixed(1),
    },
    gravity: {
      start: first.sg,
      end: last.sg,
      min: minSG,
      drop: +(first.sg - last.sg).toFixed(4),
    },
    temperature: {
      min: Math.min(...sorted.map(r => r.temp)),
      max: Math.max(...sorted.map(r => r.temp)),
      start: first.temp,
      end: last.temp,
    },
    totalHours: +((new Date(last.time).getTime() - t0) / 3600000).toFixed(1),
    totalReadings: sorted.length,
    daily,
  };
}

async function getReadingsForBatch(batchId, batchName) {
  const readings = await fetch(`${api}/batches/${batchId}/readings`, { headers }).then(r => r.json());

  const sorted = (Array.isArray(readings) ? readings : [])
    .filter(r => r.type !== "manual" && r.sg != null && r.temp != null)
    .sort((a, b) => a.time - b.time)
    .map(r => ({
      time: new Date(r.time).toISOString(),
      sg: r.sg,
      temp: r.temp,
    }));

  if (!sorted.length) {
    return { batch: batchName, batchId, readings: 0 };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const analysis = analyzeReadings(sorted);

  return {
    batch: batchName,
    batchId,
    summary: {
      gravity: { start: first.sg, current: last.sg, drop: +(first.sg - last.sg).toFixed(4) },
      temperature: { start: first.temp, current: last.temp, change: +(last.temp - first.temp).toFixed(2) },
      hours: +((new Date(last.time) - new Date(first.time)) / 3600000).toFixed(1),
    },
    analysis,
    readings: sorted,
  };
}

async function main() {
  if (!batchIds.length) {
    // Fetch by status
    const batches = await fetch(`${api}/batches?status=${status}&limit=10`, { headers }).then(r => r.json());
    if (!batches.length) { console.error(`No ${status} batches found`); process.exit(1); }
    for (const batch of batches) {
      batchIds.push(batch._id);
      batch._name = batch.recipe?.name || batch.name;
    }
    for (const batch of batches) {
      const result = await getReadingsForBatch(batch._id, batch._name);
      console.log(JSON.stringify(result, null, 2));
    }
  } else {
    // Fetch by ID — get batch name first
    for (const id of batchIds) {
      const batch = await fetch(`${api}/batches/${id}`, { headers }).then(r => r.json());
      const name = batch.recipe?.name || batch.name;
      const result = await getReadingsForBatch(id, name);
      console.log(JSON.stringify(result, null, 2));
    }
  }
}

main().catch(console.error);
