const fs = require("fs");

const config = {};
fs.readFileSync("brewfather_key.yaml", "utf8").split("\n").forEach((line) => {
  const [key, val] = line.split(/:\s*/);
  if (key && val) config[key.trim()] = val.trim();
});
const auth = Buffer.from(`${config.userid}:${config.apikey}`).toString("base64");
const headers = { Authorization: `Basic ${auth}` };
const api = "https://api.brewfather.app/v2";

// Usage: node brewfather_batches.js [--status X] [--yeast Y]
// Lists batches with recipe name, yeast, OG/FG, brew date, fermentation start date
// --status: filter by status (default: all of Fermenting,Conditioning,Completed,Archived)
// --yeast: filter by yeast name (case-insensitive substring match)

const args = process.argv.slice(2);
let statusFilter = null;
let yeastFilter = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--status" && args[i + 1]) statusFilter = args[++i];
  if (args[i] === "--yeast" && args[i + 1]) yeastFilter = args[++i].toLowerCase();
}

const statuses = statusFilter
  ? [statusFilter]
  : ["Fermenting", "Conditioning", "Completed", "Archived"];

async function fetchBatches(status) {
  let all = [];
  let startAfter = "";
  while (true) {
    const qs = startAfter
      ? `${api}/batches?status=${status}&limit=50&include=recipe.yeasts,measuredOg,measuredFg,brewDate,fermentationStartDate&start_after=${startAfter}`
      : `${api}/batches?status=${status}&limit=50&include=recipe.yeasts,measuredOg,measuredFg,brewDate,fermentationStartDate`;
    const page = await fetch(qs, { headers }).then(r => r.json());
    if (!Array.isArray(page) || !page.length) break;
    all = all.concat(page);
    if (page.length < 50) break;
    startAfter = page[page.length - 1]._id;
  }
  return all;
}

async function main() {
  let allBatches = [];
  for (const s of statuses) {
    const batches = await fetchBatches(s);
    allBatches = allBatches.concat(batches);
  }

  const results = allBatches.map(b => {
    const yeasts = (b.recipe?.yeasts || []).map(y => ({
      name: y.name,
      laboratory: y.laboratory,
      productId: y.productId || "",
      attenuation: y.attenuation,
      minTemp: y.minTemp,
      maxTemp: y.maxTemp,
    }));
    return {
      _id: b._id,
      batchNo: b.batchNo,
      name: b.recipe?.name || b.name,
      status: b.status,
      brewDate: b.brewDate ? new Date(b.brewDate).toISOString() : null,
      fermentationStartDate: b.fermentationStartDate ? new Date(b.fermentationStartDate).toISOString() : null,
      measuredOg: b.measuredOg || null,
      measuredFg: b.measuredFg || null,
      yeasts,
    };
  });

  // Apply yeast filter
  const filtered = yeastFilter
    ? results.filter(b => b.yeasts.some(y =>
        (y.name || "").toLowerCase().includes(yeastFilter) ||
        (y.laboratory || "").toLowerCase().includes(yeastFilter) ||
        (y.productId || "").toLowerCase().includes(yeastFilter)
      ))
    : results;

  // Sort by brew date descending (most recent first)
  filtered.sort((a, b) => (b.brewDate || "").localeCompare(a.brewDate || ""));

  console.log(JSON.stringify(filtered, null, 2));
}

main().catch(console.error);
