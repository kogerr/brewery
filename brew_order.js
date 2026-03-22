const fs = require("fs");
const readline = require("readline");

const recipeName = process.argv[2];
if (!recipeName) {
  console.error("Usage: node brew_order.js <recipe name>");
  process.exit(1);
}

const config = {};
fs.readFileSync("brewfather_key.yaml", "utf8").split("\n").forEach((line) => {
  const [key, val] = line.split(/:\s*/);
  if (key && val) config[key.trim()] = val.trim();
});
const auth = Buffer.from(`${config.userid}:${config.apikey}`).toString("base64");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function brewfatherFetch(url) {
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  return res.json();
}

async function hoplineProducts(category) {
  const res = await fetch(`https://www.hopline.hu/alapanyagok/${category}?filter=product_status:in_stock&infinite_page=10`);
  const html = await res.text();
  const regex = /data-sku="(\d+)".*?product__name[^"]*"[^>]*>([^<]+)/gs;
  const products = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const name = match[2].trim();
    if (name) products.push({ id: match[1], name });
  }
  return products;
}

async function hoplineStock(sku) {
  const res = await fetch(`https://www.hopline.hu/shop_artdet.php?ajax_tooltip=1&get_ajax=1&cikk=${sku}`);
  const html = await res.text();
  const match = html.match(/font-weight-normal">\(<span>(.+?)<\/span>\)/);
  return match ? match[1] : null;
}

async function hoplineLogin() {
  const res = await fetch("https://www.hopline.hu/shop_logincheck.php", {
    body: "file_back=%2F&login_redir=&shop_user_login=kogerr%40hotmail.com&shop_pass_login=Tunde1995",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    redirect: "manual"
  });
  const location = res.headers.get("location");
  if (!location || !location.includes("login_ok")) {
    throw new Error("Login failed");
  }
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return cookies;
}

async function hoplineAddToCart(sku, cookie) {
  const res = await fetch("https://www.hopline.hu/shop_ajax/ajax_cart.php", {
    headers: { cookie },
    body: `get_ajax=1&result_type=json&lang_master=hu&action=add&sku=${sku}&qty=1&variant_name1=Roppant%C3%A1s&variant_list1=Roppantva&product_param=&item_random_number=${Math.floor(Math.random() * 10000)}&is_last_package_offer=false`,
    method: "POST"
  });
  return res.text();
}

function fuzzyMatch(needle, haystack) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// Find the best matching Hopline product for a Brewfather ingredient
function findHoplineMatch(ingredientName, hoplineProducts) {
  // Try exact-ish match first, then progressively looser
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

async function main() {
  // 1. Find recipe
  console.log(`Searching for recipe: "${recipeName}"...`);
  const recipes = await brewfatherFetch("https://api.brewfather.app/v2/recipes?limit=50");
  const recipe = recipes.find((r) => fuzzyMatch(recipeName, r.name));
  if (!recipe) {
    console.error(`Recipe "${recipeName}" not found. Available recipes:`);
    recipes.forEach((r) => console.log(`  ${r.name}`));
    process.exit(1);
  }
  console.log(`Found: ${recipe.name} (${recipe._id})\n`);

  // 2. Get ingredients
  console.log("Fetching ingredients...");
  const details = await brewfatherFetch(`https://api.brewfather.app/v2/recipes/${recipe._id}?include=fermentables,hops,yeasts,miscs`);

  const fermentables = details.fermentables || [];
  const hops = details.hops || [];
  const yeasts = details.yeasts || [];

  console.log("\nIngredients:");
  fermentables.forEach((f) => console.log(`  [Malt]  ${f.name} - ${f.amount} kg`));
  hops.forEach((h) => console.log(`  [Hop]   ${h.name} - ${h.amount} g`));
  yeasts.forEach((y) => console.log(`  [Yeast] ${y.name} - ${y.amount} ${y.unit || "pkg"}`));

  // 3. Check Hopline availability
  console.log("\nChecking Hopline availability...");
  const [malts, hopProducts, yeastProducts] = await Promise.all([
    hoplineProducts("malatak/osszes-malata"),
    hoplineProducts("komlok/osszes-komlo"),
    hoplineProducts("elesztok/szaraz-eleszto")
  ]);

  const matches = [];

  for (const f of fermentables) {
    const match = findHoplineMatch(f.name, malts);
    if (match) matches.push({ ingredient: f.name, amount: `${f.amount} kg`, type: "malt", ...match });
  }
  for (const h of hops) {
    const match = findHoplineMatch(h.name, hopProducts);
    if (match) matches.push({ ingredient: h.name, amount: `${h.amount} g`, type: "hop", ...match });
  }
  for (const y of yeasts) {
    const match = findHoplineMatch(y.name, yeastProducts);
    if (match) matches.push({ ingredient: y.name, amount: `${y.amount} ${y.unit || "pkg"}`, type: "yeast", ...match });
  }

  if (matches.length === 0) {
    console.log("No matching products found on Hopline.");
    process.exit(0);
  }

  // 4. Check stock
  console.log("\nChecking stock levels...");
  for (const m of matches) {
    m.stock = await hoplineStock(m.id);
  }

  console.log("\nAvailable on Hopline:");
  console.log("-".repeat(80));
  for (const m of matches) {
    console.log(`  ${m.ingredient} => ${m.name} (SKU: ${m.id}) | Need: ${m.amount} | Stock: ${m.stock || "unknown"}`);
  }
  console.log("-".repeat(80));

  // 5. Ask user
  const answer = await ask("\nAdd these items to your Hopline cart? (y/n) ");
  if (answer.toLowerCase() !== "y") {
    console.log("Cancelled.");
    process.exit(0);
  }

  // 6. Login and add to cart
  console.log("\nLogging in to Hopline...");
  const cookie = await hoplineLogin();
  console.log("Login successful.");

  console.log("\nAdding items to cart...");
  for (const m of matches) {
    const result = await hoplineAddToCart(m.id, cookie);
    console.log(`  Added ${m.name} (${m.id}): ${result.substring(0, 100)}`);
  }

  console.log("\nDone! Check your Hopline cart.");
}

main().catch(console.error);
