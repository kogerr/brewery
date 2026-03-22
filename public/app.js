// --- Pitching Rate Data (from calculator-pitching-rate.js) ---
const YEASTS = {
  Abbaye:        { name: "LalBrew Abbaye",          baseRate: 50,  gravityFactor: 3,   minTemp: 17,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  Belle_Saison:  { name: "LalBrew Belle Saison",    baseRate: 50,  gravityFactor: 3,   minTemp: 20,   maxTemp: 35,   tempFactor: 1,   gravityThreshold: 10 },
  "BRY-97":      { name: "LalBrew BRY-97",          baseRate: 50,  gravityFactor: 3,   minTemp: 15,   maxTemp: 22.3, tempFactor: 4,   gravityThreshold: 10 },
  Diamond:       { name: "LalBrew Diamond",          baseRate: 100, gravityFactor: 6,   minTemp: 10,   maxTemp: 15,   tempFactor: 5,   gravityThreshold: 10 },
  Farmhouse:     { name: "LalBrew Farmhouse",        baseRate: 50,  gravityFactor: 3,   minTemp: 22,   maxTemp: 30,   tempFactor: 2,   gravityThreshold: 10 },
  House_Ale:     { name: "LalBrew House Ale",        baseRate: 50,  gravityFactor: 3,   minTemp: 16,   maxTemp: 22,   tempFactor: 2,   gravityThreshold: 10 },
  Koln:          { name: "LalBrew Koln",             baseRate: 100, gravityFactor: 4,   minTemp: 15,   maxTemp: 25,   tempFactor: 4,   gravityThreshold: 10 },
  Lona:          { name: "LalBrew Lona",             baseRate: 50,  gravityFactor: 2,   minTemp: 20,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 4  },
  London:        { name: "LalBrew London",           baseRate: 50,  gravityFactor: 3,   minTemp: 17.7, maxTemp: 22.3, tempFactor: 2,   gravityThreshold: 10 },
  Munich_Classic:{ name: "LalBrew Munich Classic",   baseRate: 50,  gravityFactor: 3,   minTemp: 17,   maxTemp: 25,   tempFactor: 1,   gravityThreshold: 10 },
  New_England:   { name: "LalBrew New England",      baseRate: 100, gravityFactor: 6,   minTemp: 17.7, maxTemp: 25,   tempFactor: 4,   gravityThreshold: 10 },
  Nottingham:    { name: "LalBrew Nottingham",       baseRate: 50,  gravityFactor: 3,   minTemp: 10,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  NovaLager:     { name: "LalBrew NovaLager",        baseRate: 50,  gravityFactor: 3,   minTemp: 10,   maxTemp: 20,   tempFactor: 4,   gravityThreshold: 10 },
  Pomona:        { name: "LalBrew Pomona",           baseRate: 50,  gravityFactor: 3.5, minTemp: 17.7, maxTemp: 22.3, tempFactor: 1.5, gravityThreshold: 10 },
  Verdant:       { name: "LalBrew Verdant IPA",      baseRate: 50,  gravityFactor: 3,   minTemp: 17.7, maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  Voss:          { name: "LalBrew Voss",             baseRate: 50,  gravityFactor: 1.5, minTemp: 25,   maxTemp: 40,   tempFactor: 2,   gravityThreshold: 10 },
  Windsor:       { name: "LalBrew Windsor",          baseRate: 50,  gravityFactor: 3,   minTemp: 15,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  Wit:           { name: "LalBrew Wit",              baseRate: 50,  gravityFactor: 3,   minTemp: 17,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  Sourvisiae:    { name: "Sourvisiae",               baseRate: 50,  gravityFactor: 3,   minTemp: 15,   maxTemp: 22.3, tempFactor: 2,   gravityThreshold: 10 },
  Philly:        { name: "WildBrew Philly Sour",     baseRate: 50,  gravityFactor: 2.5, minTemp: 20,   maxTemp: 30,   tempFactor: 10,  gravityThreshold: 10 },
};

// --- State ---
let currentRecipe = null;

// --- Helpers ---
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function sgToPlato(sg) {
  return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
}

function platoToSg(plato) {
  return plato / (258.6 - (plato / 258.2) * 227.1) + 1;
}

// --- Tabs ---
$$(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach((b) => b.classList.remove("active"));
    $$(".tab-content").forEach((s) => { s.hidden = true; s.classList.remove("active"); });
    btn.classList.add("active");
    const section = $(`#tab-${btn.dataset.tab}`);
    section.hidden = false;
    section.classList.add("active");
  });
});

// --- Recipe List ---
async function loadRecipes() {
  const res = await fetch("/api/recipes");
  const recipes = await res.json();
  const list = $("#recipe-list");
  list.innerHTML = "";
  for (const r of recipes) {
    const li = document.createElement("li");
    li.textContent = r.name;
    li.dataset.id = r._id;
    li.addEventListener("click", () => selectRecipe(r._id, li));
    list.appendChild(li);
  }
}

$("#recipe-search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  $$("#recipe-list li").forEach((li) => {
    li.hidden = !li.textContent.toLowerCase().includes(q);
  });
});

async function selectRecipe(id, li) {
  $$("#recipe-list li").forEach((l) => l.classList.remove("active"));
  li.classList.add("active");

  const res = await fetch(`/api/recipes/${id}`);
  currentRecipe = await res.json();
  renderRecipe();
  prefillPitching();
  prefillABV();
  showOrderPanel();
}

function renderRecipe() {
  const r = currentRecipe;
  $("#recipe-empty").hidden = true;
  $("#recipe-details").hidden = false;
  $("#recipe-name").textContent = r.name;
  $("#recipe-og").textContent = r.og?.toFixed(3) || "?";
  $("#recipe-fg").textContent = r.fg?.toFixed(3) || "?";
  $("#recipe-batch").textContent = r.batchSize?.toFixed(1) || "?";

  fillTable("#table-fermentables tbody", r.fermentables, (f) =>
    `<td>${esc(f.name)}</td><td>${esc(f.supplier || "")}</td><td>${f.amount.toFixed(2)}</td>`
  );
  fillTable("#table-hops tbody", r.hops, (h) =>
    `<td>${esc(h.name)}</td><td>${h.amount.toFixed(0)}</td>`
  );
  fillTable("#table-yeasts tbody", r.yeasts, (y) =>
    `<td>${esc(y.name)}</td><td>${esc(y.laboratory || "")}</td><td>${y.amount} ${y.unit || "pkg"}</td>`
  );
}

function fillTable(sel, items, rowFn) {
  const tbody = $(sel);
  tbody.innerHTML = items.map((item) => `<tr>${rowFn(item)}</tr>`).join("");
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// --- Pitching Rate ---
(function initPitchingSelect() {
  const sel = $("#pitch-yeast");
  for (const [key, y] of Object.entries(YEASTS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = y.name;
    sel.appendChild(opt);
  }
})();

function prefillPitching() {
  if (!currentRecipe) return;
  const r = currentRecipe;
  if (r.og) $("#pitch-og").value = r.og.toFixed(3);
  if (r.batchSize) $("#pitch-volume").value = r.batchSize.toFixed(1);
  // Try to match yeast
  if (r.yeasts?.length) {
    const y = r.yeasts[0];
    const pid = y.productId || "";
    const yname = (y.name || "").toLowerCase();
    for (const key of Object.keys(YEASTS)) {
      if (key === pid || YEASTS[key].name.toLowerCase().includes(yname)) {
        $("#pitch-yeast").value = key;
        break;
      }
    }
    // Use yeast's recommended mid-range temp
    if (y.minTemp && y.maxTemp) {
      $("#pitch-temp").value = ((y.minTemp + y.maxTemp) / 2).toFixed(0);
    }
  }
  calcPitching();
}

function calcPitching() {
  const yeastKey = $("#pitch-yeast").value;
  const og = parseFloat($("#pitch-og").value);
  const volume = parseFloat($("#pitch-volume").value);
  const temp = parseFloat($("#pitch-temp").value);
  const yeast = YEASTS[yeastKey];
  if (!yeast || isNaN(og) || isNaN(volume) || isNaN(temp)) return;

  const plato = sgToPlato(og);
  const batchHL = volume / 100;
  let basePitch;
  if (plato <= yeast.gravityThreshold) {
    basePitch = yeast.baseRate * batchHL;
  } else {
    basePitch = (yeast.baseRate + yeast.gravityFactor * (plato - yeast.gravityThreshold)) * batchHL;
  }
  const totalGrams = basePitch + basePitch * (yeast.tempFactor / 100) * (yeast.maxTemp - temp);
  const gramsPerLiter = totalGrams / volume;
  const packets500g = Math.ceil(totalGrams / 500);
  const packets11g = Math.ceil(totalGrams / 11);

  const warning = (temp < yeast.minTemp || temp > yeast.maxTemp)
    ? `<br><strong style="color:#c44">Warning:</strong> ${temp}C is outside recommended range ${yeast.minTemp}-${yeast.maxTemp}C`
    : "";

  const box = $("#pitch-result");
  box.hidden = false;
  box.innerHTML = `
    <strong>${yeast.name}</strong> at <strong>${og}</strong> SG (${plato.toFixed(1)}P), ${volume} L, ${temp}C<br>
    Total yeast needed: <strong>${totalGrams.toFixed(1)} g</strong> (${gramsPerLiter.toFixed(1)} g/L)<br>
    Packets: <strong>${packets11g} x 11g</strong> or <strong>${packets500g} x 500g</strong><br>
    Temp range: ${yeast.minTemp}-${yeast.maxTemp}C${warning}
  `;
}

["#pitch-yeast", "#pitch-og", "#pitch-volume", "#pitch-temp"].forEach((sel) => {
  $(sel).addEventListener("input", calcPitching);
});

// --- ABV Calculator ---
function prefillABV() {
  if (!currentRecipe) return;
  if (currentRecipe.og) $("#abv-og").value = currentRecipe.og.toFixed(3);
  if (currentRecipe.fg) $("#abv-fg").value = currentRecipe.fg.toFixed(3);
  calcABV();
}

function calcABV() {
  const og = parseFloat($("#abv-og").value);
  const fg = parseFloat($("#abv-fg").value);
  if (isNaN(og) || isNaN(fg) || og <= fg || fg <= 0) return;

  const abvStd = (og - fg) * 131.25;
  const abvAlt = (76.08 * (og - fg) / (1.775 - og)) * (fg / 0.794);

  const ogP = sgToPlato(og);
  const fgP = sgToPlato(fg);
  const attenuation = (1 - fgP / ogP) * 100;
  const realExtract = 0.1808 * ogP + 0.8192 * fgP;
  const abw = (ogP - realExtract) / (2.0665 - 0.010665 * ogP);
  const calories = (6.9 * abw + 4.0 * (realExtract - 0.1)) * platoToSg(fgP) * 3.55;

  const box = $("#abv-result");
  box.hidden = false;
  box.innerHTML = `
    OG: <strong>${og.toFixed(3)}</strong> (${ogP.toFixed(1)}P) &rarr; FG: <strong>${fg.toFixed(3)}</strong> (${fgP.toFixed(1)}P)<br>
    ABV (standard): <strong>${abvStd.toFixed(2)}%</strong><br>
    ABV (alternate): <strong>${abvAlt.toFixed(2)}%</strong><br>
    Apparent attenuation: <strong>${attenuation.toFixed(1)}%</strong><br>
    Calories per 355ml: <strong>${calories.toFixed(0)} kcal</strong>
  `;
}

["#abv-og", "#abv-fg"].forEach((sel) => {
  $(sel).addEventListener("input", calcABV);
});

// --- Hopline Order ---
function showOrderPanel() {
  if (!currentRecipe) return;
  $("#order-empty").hidden = true;
  $("#order-panel").hidden = false;
  $("#order-recipe-name").textContent = currentRecipe.name;
  $("#order-results").hidden = true;
  $("#order-status").hidden = true;
}

// Ingredient matching logic (from brew_order.js)
function findBestMatch(ingredientName, hoplineProducts) {
  const nameLower = ingredientName.toLowerCase();
  const words = nameLower.split(/\s+/).filter((w) => w.length > 2);
  let bestMatch = null;
  let bestScore = 0;
  for (const product of hoplineProducts) {
    const prodLower = product.name.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (prodLower.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }
  return bestScore >= 2 ? bestMatch : null;
}

function findYeastMatch(yeast, hoplineProducts) {
  const pid = (yeast.productId || "").toLowerCase();
  const lab = (yeast.laboratory || "").toLowerCase();
  const yname = (yeast.name || "").toLowerCase();

  for (const p of hoplineProducts) {
    const pLower = p.name.toLowerCase();
    if (pid && pLower.includes(pid)) return p;
  }
  // Fallback: lab + name matching
  return findBestMatch(`${yeast.laboratory || ""} ${yeast.name || ""}`, hoplineProducts);
}

function parseStock(stockStr) {
  if (!stockStr) return { units: 0, unitSize: null, raw: "unknown" };
  // e.g. "239 0,1 kg" or "15 100 g" or "5 11 g"
  const m = stockStr.match(/^(\d+)\s+(\d+(?:,\d+)?)\s*(kg|g)/i);
  if (!m) return { units: 0, unitSize: null, raw: stockStr };
  const units = parseInt(m[1]);
  const size = parseFloat(m[2].replace(",", "."));
  const unit = m[3].toLowerCase();
  return { units, size, unit, raw: stockStr };
}

function calcQty(type, amountFromRecipe, stock) {
  if (type === "fermentable") {
    // amountFromRecipe in kg; typically sold in 0.1 kg units
    if (stock.unit === "kg") return Math.ceil(amountFromRecipe / stock.size);
    if (stock.unit === "g") return Math.ceil((amountFromRecipe * 1000) / stock.size);
    return Math.ceil(amountFromRecipe / 0.1); // default assume 0.1kg
  }
  if (type === "hop") {
    // amountFromRecipe already in grams from Brewfather; typically sold in 100g packs
    if (stock.unit === "g") return Math.ceil(amountFromRecipe / stock.size);
    if (stock.unit === "kg") return Math.ceil(amountFromRecipe / (stock.size * 1000));
    return Math.ceil(amountFromRecipe / 100);
  }
  // yeast: amount is packet count
  return Math.ceil(amountFromRecipe);
}

let orderItems = [];

$("#order-check").addEventListener("click", async () => {
  const r = currentRecipe;
  if (!r) return;

  $("#order-check").disabled = true;
  $("#order-loading").hidden = false;
  $("#order-results").hidden = true;
  $("#order-status").hidden = true;

  try {
    // Fetch all Hopline categories in parallel
    const [malts, hops, yeasts] = await Promise.all([
      fetch("/api/hopline/products/malatak").then((r) => r.json()),
      fetch("/api/hopline/products/komlok").then((r) => r.json()),
      fetch("/api/hopline/products/elesztok").then((r) => r.json()),
    ]);

    orderItems = [];

    // Match fermentables
    for (const f of r.fermentables) {
      const match = findBestMatch(f.name, malts);
      orderItems.push({
        type: "fermentable",
        ingredient: f.name,
        amount: f.amount,
        amountStr: `${f.amount.toFixed(2)} kg`,
        match,
      });
    }

    // Match hops
    for (const h of r.hops) {
      const match = findBestMatch(h.name, hops);
      orderItems.push({
        type: "hop",
        ingredient: h.name,
        amount: h.amount,
        amountStr: `${h.amount.toFixed(0)} g`,
        match,
      });
    }

    // Match yeasts
    for (const y of r.yeasts) {
      const match = findYeastMatch(y, yeasts);
      orderItems.push({
        type: "yeast",
        ingredient: y.name,
        amount: y.amount,
        amountStr: `${y.amount} ${y.unit || "pkg"}`,
        match,
      });
    }

    // Check stock for matched items (in parallel)
    const matched = orderItems.filter((i) => i.match);
    const stockResults = await Promise.all(
      matched.map((i) => fetch(`/api/hopline/stock/${i.match.id}`).then((r) => r.json()))
    );
    matched.forEach((item, idx) => {
      item.stock = parseStock(stockResults[idx].stock);
      item.qty = calcQty(item.type, item.amount, item.stock);
    });

    renderOrderTable();
  } catch (err) {
    showOrderStatus("Error: " + err.message, "error");
  } finally {
    $("#order-check").disabled = false;
    $("#order-loading").hidden = true;
  }
});

function renderOrderTable() {
  const tbody = $("#order-table tbody");
  tbody.innerHTML = orderItems.map((item, i) => {
    if (!item.match) {
      return `<tr>
        <td></td>
        <td>${esc(item.ingredient)}</td>
        <td>${item.amountStr}</td>
        <td class="match-none">Not available</td>
        <td>-</td><td>-</td><td>-</td>
      </tr>`;
    }
    const enough = item.stock.units >= item.qty;
    return `<tr>
      <td><input type="checkbox" class="order-cb" data-idx="${i}" checked></td>
      <td>${esc(item.ingredient)}</td>
      <td>${item.amountStr}</td>
      <td>${esc(item.match.name)}</td>
      <td>${item.match.id}</td>
      <td class="${enough ? "stock-ok" : "stock-low"}">${item.stock.raw}</td>
      <td><input type="number" class="order-qty" data-idx="${i}" value="${item.qty}" min="1"></td>
    </tr>`;
  }).join("");

  // Sync qty edits
  tbody.querySelectorAll(".order-qty").forEach((input) => {
    input.addEventListener("change", (e) => {
      orderItems[e.target.dataset.idx].qty = parseInt(e.target.value) || 1;
    });
  });

  $("#order-results").hidden = false;
}

// Select all checkbox
$("#order-select-all").addEventListener("change", (e) => {
  $$(".order-cb").forEach((cb) => { cb.checked = e.target.checked; });
});

// Submit order
$("#order-submit").addEventListener("click", async () => {
  const selected = orderItems.filter((item, i) => {
    const cb = $(`.order-cb[data-idx="${i}"]`);
    return cb && cb.checked && item.match;
  });

  if (!selected.length) return;

  $("#order-submit").disabled = true;
  $("#order-status").hidden = true;

  try {
    const res = await fetch("/api/hopline/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: selected.map((i) => ({ sku: i.match.id, qty: i.qty })),
      }),
    });
    const data = await res.json();
    if (data.success) {
      showOrderStatus(`Added ${data.results.length} item(s) to your Hopline cart.`, "success");
    } else {
      showOrderStatus("Order failed: " + (data.error || "unknown error"), "error");
    }
  } catch (err) {
    showOrderStatus("Error: " + err.message, "error");
  } finally {
    $("#order-submit").disabled = false;
  }
});

function showOrderStatus(msg, type) {
  const el = $("#order-status");
  el.hidden = false;
  el.className = type;
  el.textContent = msg;
}

// --- Init ---
loadRecipes();
