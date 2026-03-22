// Lallemand Pitching Rate Calculator
// Extracted from https://www.lallemandbrewing.com/en/brewing-tools/pitching-rate-calculator/
//
// Usage: node calculator-pitching-rate.js <yeast> <og> <batch_liters> <temp_celsius>
// Example: node calculator-pitching-rate.js BRY-97 1.048 21 20

const YEASTS = {
  // key: { name, baseRate, gravityFactor, minTemp, maxTemp, tempFactor, gravityThreshold }
  Abbaye:        { name: "LalBrew Abbaye™",          baseRate: 50,  gravityFactor: 3,   minTemp: 17,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  Belle_Saison:  { name: "LalBrew Belle Saison™",    baseRate: 50,  gravityFactor: 3,   minTemp: 20,   maxTemp: 35,   tempFactor: 1,   gravityThreshold: 10 },
  "BRY-97":      { name: "LalBrew BRY-97™",          baseRate: 50,  gravityFactor: 3,   minTemp: 15,   maxTemp: 22.3, tempFactor: 4,   gravityThreshold: 10 },
  Diamond:       { name: "LalBrew Diamond™",          baseRate: 100, gravityFactor: 6,   minTemp: 10,   maxTemp: 15,   tempFactor: 5,   gravityThreshold: 10 },
  Farmhouse:     { name: "LalBrew Farmhouse™",        baseRate: 50,  gravityFactor: 3,   minTemp: 22,   maxTemp: 30,   tempFactor: 2,   gravityThreshold: 10 },
  House_Ale:     { name: "LalBrew House Ale™",        baseRate: 50,  gravityFactor: 3,   minTemp: 16,   maxTemp: 22,   tempFactor: 2,   gravityThreshold: 10 },
  Koln:          { name: "LalBrew Koln™",             baseRate: 100, gravityFactor: 4,   minTemp: 15,   maxTemp: 25,   tempFactor: 4,   gravityThreshold: 10 },
  Lona:          { name: "LalBrew Lona™",             baseRate: 50,  gravityFactor: 2,   minTemp: 20,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 4  },
  London:        { name: "LalBrew London™",           baseRate: 50,  gravityFactor: 3,   minTemp: 17.7, maxTemp: 22.3, tempFactor: 2,   gravityThreshold: 10 },
  Munich_Classic:{ name: "LalBrew Munich Classic™",   baseRate: 50,  gravityFactor: 3,   minTemp: 17,   maxTemp: 25,   tempFactor: 1,   gravityThreshold: 10 },
  New_England:   { name: "LalBrew New England™",      baseRate: 100, gravityFactor: 6,   minTemp: 17.7, maxTemp: 25,   tempFactor: 4,   gravityThreshold: 10 },
  Nottingham:    { name: "LalBrew Nottingham™",       baseRate: 50,  gravityFactor: 3,   minTemp: 10,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  NovaLager:     { name: "LalBrew NovaLager™",        baseRate: 50,  gravityFactor: 3,   minTemp: 10,   maxTemp: 20,   tempFactor: 4,   gravityThreshold: 10 },
  Pomona:        { name: "LalBrew Pomona™",           baseRate: 50,  gravityFactor: 3.5, minTemp: 17.7, maxTemp: 22.3, tempFactor: 1.5, gravityThreshold: 10 },
  Verdant:       { name: "LalBrew Verdant IPA™",      baseRate: 50,  gravityFactor: 3,   minTemp: 17.7, maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  Voss:          { name: "LalBrew Voss™",             baseRate: 50,  gravityFactor: 1.5, minTemp: 25,   maxTemp: 40,   tempFactor: 2,   gravityThreshold: 10 },
  Windsor:       { name: "LalBrew Windsor™",          baseRate: 50,  gravityFactor: 3,   minTemp: 15,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  Wit:           { name: "LalBrew Wit™",              baseRate: 50,  gravityFactor: 3,   minTemp: 17,   maxTemp: 25,   tempFactor: 2,   gravityThreshold: 10 },
  Sourvisiae:    { name: "Sourvisiae®",               baseRate: 50,  gravityFactor: 3,   minTemp: 15,   maxTemp: 22.3, tempFactor: 2,   gravityThreshold: 10 },
  Philly:        { name: "WildBrew Philly Sour™",     baseRate: 50,  gravityFactor: 2.5, minTemp: 20,   maxTemp: 30,   tempFactor: 10,  gravityThreshold: 10 },
  WLP001:        { name: "WLP001 California Ale",     baseRate: 50,  gravityFactor: 2.8, minTemp: 17.7, maxTemp: 23,   tempFactor: 3.9, gravityThreshold: 10 },
  WLP066:        { name: "WLP066 London Fog Ale",     baseRate: 50,  gravityFactor: 3.4, minTemp: 17.7, maxTemp: 22.3, tempFactor: 3.5, gravityThreshold: 10 },
  WLP860:        { name: "WLP860 Munich Lager",       baseRate: 100, gravityFactor: 8,   minTemp: 9,    maxTemp: 11,   tempFactor: 5,   gravityThreshold: 10 },
};

function sgToPlato(sg) {
  return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
}

function calculatePitchingRate(yeastKey, ogSG, batchLiters, tempCelsius) {
  const yeast = YEASTS[yeastKey];
  if (!yeast) {
    console.error("Unknown yeast. Available:", Object.keys(YEASTS).join(", "));
    process.exit(1);
  }

  const plato = sgToPlato(ogSG);
  const batchHL = batchLiters / 100; // convert to hectoliters

  // Base pitch rate, adjusted for gravity above threshold
  let basePitch;
  if (plato <= yeast.gravityThreshold) {
    basePitch = yeast.baseRate * batchHL;
  } else {
    basePitch = (yeast.baseRate + yeast.gravityFactor * (plato - yeast.gravityThreshold)) * batchHL;
  }

  // Temperature compensation: more yeast needed when pitching below max temp
  const totalGrams = basePitch + basePitch * (yeast.tempFactor / 100) * (yeast.maxTemp - tempCelsius);

  const gramsPerLiter = totalGrams / batchLiters;
  const packets500g = Math.ceil(totalGrams / 500);
  const packets11g = Math.ceil(totalGrams / 11);

  const tempWarning = (tempCelsius < yeast.minTemp || tempCelsius > yeast.maxTemp)
    ? `WARNING: ${tempCelsius}°C is outside recommended range ${yeast.minTemp}-${yeast.maxTemp}°C`
    : null;

  return {
    yeast: yeast.name,
    inputs: { og: ogSG, plato: +plato.toFixed(1), batchLiters, tempCelsius },
    result: {
      totalGrams: +totalGrams.toFixed(1),
      gramsPerLiter: +gramsPerLiter.toFixed(1),
      packets500g,
      packets11g
    },
    tempRange: `${yeast.minTemp}-${yeast.maxTemp}°C`,
    tempWarning
  };
}

// CLI
const [yeastKey, og, volume, temp] = process.argv.slice(2);
if (!yeastKey || !og || !volume || !temp) {
  console.error("Usage: node calculator-pitching-rate.js <yeast> <og_sg> <batch_liters> <temp_celsius>");
  console.error("Yeasts:", Object.keys(YEASTS).join(", "));
  process.exit(1);
}

console.log(JSON.stringify(
  calculatePitchingRate(yeastKey, parseFloat(og), parseFloat(volume), parseFloat(temp)),
  null, 2
));
