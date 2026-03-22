const fs = require("fs");

const config = {};
fs.readFileSync("brewfather_key.yaml", "utf8").split("\n").forEach((line) => {
  const [key, val] = line.split(/:\s*/);
  if (key && val) config[key.trim()] = val.trim();
});
const auth = Buffer.from(`${config.userid}:${config.apikey}`).toString("base64");

fetch("https://api.brewfather.app/v2/recipes?limit=50", {
  headers: { Authorization: `Basic ${auth}` }
})
  .then((response) => response.json())
  .then((recipes) => recipes.map(({ _id, name }) => ({ _id, name })))
  .then(console.log)
  .catch(console.error);
