import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const PORT = 3000;

// Load Brewfather config
const bfConfig: Record<string, string> = {};
fs.readFileSync("brewfather_key.yaml", "utf8").split("\n").forEach((line) => {
  const [key, val] = line.split(/:\s*/);
  if (key && val) bfConfig[key.trim()] = val.trim();
});
const bfAuth = Buffer.from(`${bfConfig.userid}:${bfConfig.apikey}`).toString("base64");

// MIME types for static serving
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJSON(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, status: number, msg: string) {
  sendJSON(res, { error: msg }, status);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

// Brewfather proxy
async function brewfatherFetch(urlPath: string) {
  const res = await fetch(`https://api.brewfather.app/v2${urlPath}`, {
    headers: { Authorization: `Basic ${bfAuth}` },
  });
  return res.json();
}

// Hopline proxy
async function hoplineProducts(category: string) {
  const res = await fetch(
    `https://www.hopline.hu/alapanyagok/${encodeURIComponent(category)}?action=cat_art_list&ajax=1&prefix=false&infinite_page=100&filter=product_status%3Ain_stock&source_is_cat_page=1&page=1&cat_art_list_filter_loaded=0`
  );
  const data = await res.json();
  const html: string = data.product_list_content;
  const regex = /data-sku="(\d+(?:-cs)?)".*?product__name[^"]*"[^>]*>([^<]+)/gs;
  const products: { id: string; name: string }[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const name = match[2].trim().replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    if (name) products.push({ id: match[1], name });
  }
  return products;
}

async function hoplineStock(sku: string) {
  const res = await fetch(
    `https://www.hopline.hu/shop_artdet.php?ajax_tooltip=1&get_ajax=1&cikk=${encodeURIComponent(sku)}`
  );
  const html = await res.text();
  const match = html.match(/font-weight-normal">\(<span>(.+?)<\/span>\)/);
  return match ? match[1] : null;
}

async function hoplineLogin(): Promise<string> {
  const res = await fetch("https://www.hopline.hu/shop_logincheck.php", {
    body: "file_back=%2F&login_redir=&shop_user_login=kogerr%40hotmail.com&shop_pass_login=Tunde1995",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    redirect: "manual",
  });
  const cookies = (res.headers as any).getSetCookie().map((c: string) => c.split(";")[0]).join("; ");
  return cookies;
}

async function hoplineAddToCart(sku: string, qty: number, cookie: string) {
  const res = await fetch("https://www.hopline.hu/shop_ajax/ajax_cart.php", {
    headers: { cookie, "Content-Type": "application/x-www-form-urlencoded" },
    body: `get_ajax=1&result_type=json&lang_master=hu&action=add&sku=${sku}&qty=${qty}&product_param=&item_random_number=${Math.floor(Math.random() * 10000)}&is_last_package_offer=false`,
    method: "POST",
  });
  return res.text();
}

// Route matching helper
function matchRoute(method: string, url: string, pattern: string): string[] | null {
  if (method !== pattern.split(" ")[0]) return null;
  const patternPath = pattern.split(" ")[1];
  const parts = url.split("/");
  const patternParts = patternPath.split("/");
  if (parts.length !== patternParts.length) return null;
  const params: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params.push(decodeURIComponent(parts[i]));
    } else if (parts[i] !== patternParts[i]) {
      return null;
    }
  }
  return params;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method || "GET";

  try {
    // API routes
    let params: string[] | null;

    if ((params = matchRoute(method, pathname, "GET /api/recipes"))) {
      // Paginate through all recipes (Brewfather API max 50 per request)
      let all: any[] = [];
      let startAfter = "";
      while (true) {
        const qs = startAfter
          ? `/recipes?limit=50&include=_timestamp_ms&start_after=${startAfter}`
          : "/recipes?limit=50&include=_timestamp_ms";
        const page = await brewfatherFetch(qs);
        if (!Array.isArray(page) || page.length === 0) break;
        all = all.concat(page);
        if (page.length < 50) break;
        startAfter = page[page.length - 1]._id;
      }
      all.sort((a: any, b: any) => (b._timestamp_ms || 0) - (a._timestamp_ms || 0));
      sendJSON(res, all.map((r: any) => ({ _id: r._id, name: r.name })));
      return;
    }

    if ((params = matchRoute(method, pathname, "GET /api/recipes/:id"))) {
      const recipe = await brewfatherFetch(
        `/recipes/${params[0]}?include=fermentables,hops,yeasts,miscs,og,fg,batchSize,preBoilSize,abv`
      );
      sendJSON(res, {
        name: recipe.name,
        og: recipe.og,
        fg: recipe.fg,
        batchSize: recipe.batchSize,
        preBoilSize: recipe.preBoilSize,
        fermentables: (recipe.fermentables || []).map((f: any) => ({
          supplier: f.supplier, name: f.name, amount: f.amount,
        })),
        hops: (recipe.hops || []).map((h: any) => ({
          amount: h.amount, name: h.name,
        })),
        yeasts: (recipe.yeasts || []).map((y: any) => ({
          laboratory: y.laboratory, productId: y.productId, name: y.name,
          amount: y.amount, unit: y.unit, attenuation: y.attenuation,
          minTemp: y.minTemp, maxTemp: y.maxTemp,
        })),
      });
      return;
    }

    if ((params = matchRoute(method, pathname, "GET /api/hopline/products/:category"))) {
      const products = await hoplineProducts(params[0]);
      sendJSON(res, products);
      return;
    }

    if ((params = matchRoute(method, pathname, "GET /api/hopline/stock/:sku"))) {
      const stock = await hoplineStock(params[0]);
      sendJSON(res, { sku: params[0], stock });
      return;
    }

    if (method === "POST" && pathname === "/api/hopline/order") {
      const body = JSON.parse(await readBody(req));
      // body.items: [{ sku, qty }]
      const cookie = await hoplineLogin();
      const results: { sku: string; qty: number; ok: boolean; response: string }[] = [];
      for (const item of body.items) {
        const response = await hoplineAddToCart(item.sku, item.qty, cookie);
        results.push({ sku: item.sku, qty: item.qty, ok: true, response });
        // Small delay between requests
        await new Promise((r) => setTimeout(r, 500));
      }
      sendJSON(res, { success: true, results });
      return;
    }

    // Static file serving
    let filePath = pathname === "/" ? "/index.html" : pathname;
    const fullPath = path.join(__dirname, "public", filePath);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(path.join(__dirname, "public")))) {
      sendError(res, 403, "Forbidden");
      return;
    }

    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(resolved).pipe(res);
      return;
    }

    sendError(res, 404, "Not found");
  } catch (err: any) {
    console.error("Error:", err);
    sendError(res, 500, err.message || "Internal server error");
  }
});

server.listen(PORT, () => {
  console.log(`Brewery app running at http://localhost:${PORT}`);
});
