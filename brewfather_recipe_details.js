const fs = require("fs");

const recipeId = process.argv[2];
if (!recipeId) { console.error("Usage: node brewfather_recipe_details.js <recipe_id>"); process.exit(1); }

const config = {};
fs.readFileSync("brewfather_key.yaml", "utf8").split("\n").forEach((line) => {
  const [key, val] = line.split(/:\s*/);
  if (key && val) config[key.trim()] = val.trim();
});
const auth = Buffer.from(`${config.userid}:${config.apikey}`).toString("base64");

fetch(`https://api.brewfather.app/v2/recipes/${recipeId}?include=fermentables,hops,yeasts,miscs`, {
  headers: { Authorization: `Basic ${auth}` }
})
  .then((response) => response.json())
  .then(({ fermentables, hops, yeasts }) => ({
    fermentables: fermentables.map(({ supplier, name, amount }) => ({ supplier, name, amount })),
    hops: hops.map(({ amount, name }) => ({ amount, name })),
    yeasts: yeasts.map(({ laboratory, productId, name, amount, unit }) => ({ laboratory, productId, name, amount, unit })) }))
  .then(console.log)
  .catch(console.error);
