// ABV Calculator — reverse-engineered from Brewer's Friend
// https://www.brewersfriend.com/abv-calculator/
//
// Usage: node calculator-abv.js <og> <fg> [method]
// Example: node calculator-abv.js 1.059 1.018
// Example: node calculator-abv.js 1.059 1.018 alternate

const og = parseFloat(process.argv[2]);
const fg = parseFloat(process.argv[3]);
const method = process.argv[4] || "standard";

if (!og || !fg) {
  console.error("Usage: node calculator-abv.js <og_sg> <fg_sg> [standard|alternate]");
  process.exit(1);
}

function sgToPlato(sg) {
  return -616.868 + 1111.14 * sg - 630.272 * Math.pow(sg, 2) + 135.997 * Math.pow(sg, 3);
}

function platoToSg(plato) {
  return plato / (258.6 - (plato / 258.2) * 227.1) + 1;
}

// Standard: ABV = (OG - FG) * 131.25
function abvStandard(og, fg) {
  return (og - fg) * 131.25;
}

// Alternate: accounts for higher gravity worts more accurately
function abvAlternate(og, fg) {
  const abw = 76.08 * (og - fg) / (1.775 - og);
  return abw * (fg / 0.794);
}

// Calories per 12oz bottle (355ml)
function caloriesPer12oz(ogPlato, fgPlato) {
  const realExtract = 0.1808 * ogPlato + 0.8192 * fgPlato;
  const abw = (ogPlato - realExtract) / (2.0665 - 0.010665 * ogPlato);
  const fgSg = platoToSg(fgPlato);
  return ((6.9 * abw + 4.0 * (realExtract - 0.1)) * fgSg * 3.55);
}

const ogPlato = sgToPlato(og);
const fgPlato = sgToPlato(fg);
const attenuation = (1 - fgPlato / ogPlato) * 100;

const abvStd = abvStandard(og, fg);
const abvAlt = abvAlternate(og, fg);
const abv = method === "alternate" ? abvAlt : abvStd;
const calories = caloriesPer12oz(ogPlato, fgPlato);

console.log(JSON.stringify({
  og: { sg: og, plato: +ogPlato.toFixed(2) },
  fg: { sg: fg, plato: +fgPlato.toFixed(2) },
  abv: {
    standard: +abvStd.toFixed(2),
    alternate: +abvAlt.toFixed(2),
    selected: +abv.toFixed(2),
    method
  },
  attenuation: +attenuation.toFixed(1),
  calories_per_12oz: +calories.toFixed(1)
}, null, 2));
