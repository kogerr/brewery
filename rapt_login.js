const fs = require("fs");

const config = {};
fs.readFileSync("rapt_io_key.yaml", "utf8").split("\n").forEach((line) => {
  const [key, val] = line.split(/:\s*/);
  if (key && val) config[key.trim()] = val.trim();
});

fetch("https://id.rapt.io/connect/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: `client_id=rapt-user&grant_type=password&username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.apikey)}`
})
  .then((res) => res.json())
  .then(console.log)
  .catch(console.error);
