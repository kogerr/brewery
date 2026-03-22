// Gravity/Density/Sugar Conversion Calculator
// Reverse-engineered from Vinolab (vinolab.hr) VinoCalc by Jonathan Musther
//
// Usage: node calculator-gravity.js <unit> <value>
// Units: sg, brix, oechsle, baume, kmw, density, alcohol, sugar
// Example: node calculator-gravity.js sg 1.050
// Example: node calculator-gravity.js brix 12.5

const unit = process.argv[2]?.toLowerCase();
const value = parseFloat(process.argv[3]);

if (!unit || isNaN(value)) {
  console.error("Usage: node calculator-gravity.js <unit> <value>");
  console.error("Units: sg, brix, oechsle, baume, kmw, density, alcohol, sugar");
  process.exit(1);
}

// Convert any input to SG first
function toSG(unit, value) {
  switch (unit) {
    case "sg":       return value;
    case "brix":     return 0.00000005785037196 * value ** 3 + 0.00001261831344 * value ** 2 + 0.003873042366 * value + 0.9999994636;
    case "oechsle":  return value / 1000 + 1;
    case "baume":    return -145 / (value - 145);
    case "kmw":      return -145 / (value / 1.53 - 145);
    case "density":  return value / 1000;
    case "alcohol":  return (46 * value + 4000) / (15 * value + 4000);
    case "sugar":    return -0.00000001411664821 * value ** 2 + 0.0003858501894 * value + 1.000048128;
    default:
      console.error("Unknown unit:", unit);
      process.exit(1);
  }
}

// Convert SG to all units
function fromSG(sg) {
  const brix = 143.254 * sg ** 3 - 648.670 * sg ** 2 + 1125.805 * sg - 620.389;
  return {
    sg: +sg.toFixed(5),
    brix: +(brix).toFixed(2),
    oechsle: +(1000 * (sg - 1)).toFixed(2),
    baume: +(145 - 145 / sg).toFixed(2),
    kmw: +((145 - 145 / sg) * 1.53).toFixed(2),
    density_gl: +(1000 * sg).toFixed(2),
    potential_alcohol: +(1000 * (sg - 1) / (7.75 - 3.75 * (sg - 1))).toFixed(2),
    dissolved_sugar_gl: +(sg * brix * 10).toFixed(2)
  };
}

const sg = toSG(unit, value);
console.log(JSON.stringify(fromSG(sg), null, 2));
