# Brewery Project

Scripts and notes for homebrewing, integrating **Brewfather** (recipe/batch management), **Hopline.hu** (Hungarian homebrew shop), and **RAPT** (KegLand hydrometers, BrewZilla, fermentation controllers).

All scripts are plain Node.js (no build step) and are run with `node` from the repository root:

```bash
cd /Users/gekovacs/workspace/brewery
node brewfather_recipes.js
```

> **Note on agent instruction files:** this file (`AGENTS.md`) is read by Codex CLI. `CLAUDE.md` holds the same project guide for Claude Code. Keep both in sync when adding scripts or changing conventions.

## Credentials

Two untracked YAML files hold API credentials (both are in `.gitignore` — never commit them):

- `brewfather_key.yaml` — keys `userid` and `apikey`, used with HTTP Basic auth
- `rapt_io_key.yaml` — keys `username` and `apikey`, exchanged for a bearer token at `https://id.rapt.io/connect/token`

Scripts read these directly. If a script fails with a missing-credentials error, check the file exists and has both keys.

## Scripts

### Brewfather

- `brewfather_recipes.js` — lists all recipes (JSON array of `{_id, name}`). Note: output is JS-style object literals, **not strict JSON** — don't pipe it straight into `json.load`. Grep it or use the API directly.
- `brewfather_recipe_details.js <recipe_id>` — recipe ingredients (`{fermentables, hops, yeasts}`)
- `brewfather_batches.js [--status X] [--yeast Y]` — lists batches with recipe name, yeast, OG/FG, brew date
- `brewfather_fermenting.js [status]` or `--batch-id <id>` — readings plus fermentation analysis (peak rate timing, completion estimate, daily gravity/temp table)

**Brewfather API notes:**
- Base: `https://api.brewfather.app/v2/`, auth: `Authorization: Basic base64(userid:apikey)`
- Recipes endpoint is **read-only** — no POST/PATCH to create or modify recipes
- 50+ recipes exist; paginate with `start_after=<last_id>`
- Batch `name` is usually the generic "Batch" — use `recipe.name` for the beer name
- The batch **list** endpoint omits `measuredOg`/`measuredFg`; add `complete=true`, or fetch a single batch by id, to get measured values
- Some embedded recipe notes contain control characters — parse with Python's `json.load(..., strict=False)` if you hit a decode error

### Hopline.hu

- `hopline_malts.js <category>` — lists in-stock products. Categories: `malatak` (malts), `komlok` (hops), `elesztok` (yeasts)
- `hopline_details.js <sku>` — stock string, e.g. `"239 0,1 kg"` = 239 units of 0.1 kg each
- `hopline_login.js` — logs in, outputs `{status, location, cookies}`
- `hopline_cart.js <sku> <qty> <cookie>` — adds a product to the cart
- `hopline_login_browser.js` / `hopline_cart_browser.js` — browser-console variants

### RAPT

- `rapt_login.js` — logs in, outputs a bearer token
- `rapt_telemetry.js` — gravity/temp readings from the active (or most recent) RAPT hydrometer
- `rapt_brewzilla_set_pid.js [p] [i] [d] [brewZillaId]` — sets BrewZilla PID coefficients via `POST /api/BrewZillas/SetPID`. Defaults `p=0.50 i=0.002 d=0.00`; picks the first BrewZilla if no id given. Reads the values back to confirm.

**RAPT API notes:**
- Base: `https://api.rapt.io/api/`, auth: `Authorization: Bearer <token>`
- Token: `POST https://id.rapt.io/connect/token` with `client_id=rapt-user&grant_type=password&username=...&password=<apikey>`
- Control endpoints take **query parameters, not JSON bodies**, and return a bare boolean
- Hydrometer gravity is reported on a ~1000 scale (e.g. `1062.1` means SG 1.0621)
- **BrewZilla telemetry has two temperature fields:** `controlDeviceTemperature` is the external RAPT Bluetooth probe **in the wort** (the source of truth); `temperature` is the built-in thermistor **at the heating element**, which reads 3-10 °C higher during active heating. Always analyse mash/boil behaviour using `controlDeviceTemperature`.

### Calculators

- `calculator-pitching-rate.js <yeast> <og_sg> <liters> <temp_c>` — Lallemand pitching rate
- `calculator-abv.js <og_sg> <fg_sg> [standard|alternate]` — ABV, attenuation, calories
- `calculator-gravity.js <unit> <value>` — converts sg/brix/oechsle/baume/kmw/density/alcohol/sugar

### Other

- `server.js` / `server.ts` + `public/` — small local web UI
- `rpi-pill/` — Raspberry Pi BLE relay that reads RAPT Pill broadcasts and forwards them to Brewfather. See `rpi-pill/PROJECT-OVERVIEW.md`, `INSTALL.md`, `VERIFY-STARTUP.md`, `KNOWN-ISSUES.md`.
- `brew_order.js` — standalone reference version of the ordering flow (not used by the workflow below)

## Brewing conventions

- **Mash water calculation:** always compute mash-in water so that litres of water + kilograms of malt = litres at pre-boil.
  `mash_water_L = pre_boil_volume_L - total_grain_kg`

## Hardware

- **RAPT Pills:** "Pastilla" (BLE MAC `90:38:0c:12:64:4a`) and "Nuevo" (`ec:62:60:28:3e:4a`)
- **BrewZilla 35 L Gen4** with an external RAPT Bluetooth thermometer as the PID control sensor
- **Raspberry Pi** (`rpi3`) runs the `rpi-pill` service; a second Pi at `192.168.0.204` hosts external storage. The Pi's IP varies by network — `rpi3` resolves on all of them.

## Documentation

Longer-form analyses and recipe notes live in `docs/`:

- `abbaye-fermentation-report.md`, `bry97-fermentation-report.md`, `verdant-fermentation-report.md` — per-yeast fermentation curve statistics across batches
- `brewzilla-pid-mash-analysis.md` — PID tuning analysis with the sensor-field caveat above
- `overnight-mash-analysis.md`, `fermentation-foam-analysis.md` — process investigations
- `top-batches.md` — batch rankings by grain bill and OG
- recipe drafts: `jam72-clone-recipe.md`, `stone-fruit-ipa-recipe.md`, `kveik_blonde_recipe_concerns.md`

## Common workflows

These are defined as Claude Code skills in `.claude/skills/` (which Codex does not read), so the steps are written out here.

### Order recipe ingredients from Hopline

1. `node brewfather_recipes.js` → find the recipe by name (fuzzy match is fine)
2. `node brewfather_recipe_details.js <recipe_id>` → fermentables, hops, yeasts
3. `node hopline_malts.js <category>` for each relevant category (`malatak`, `komlok`, `elesztok`)
4. Match each ingredient to a Hopline product. **Be strict** — the match must clearly be the same product (same brand and type), not just sharing words. Match yeasts on productId (e.g. `BRY-97`) or laboratory + product name. Mark anything not clearly present as "not available"
5. `node hopline_details.js <sku>` for each match to check stock against the required amount
6. Present a summary table: ingredient, required amount, matched product, SKU, stock, sufficient yes/no
7. To add to the cart, generate a minified browser-console one-liner and copy it to the clipboard with `echo -n '...' | pbcopy`. The user pastes it into the console on hopline.hu (F12 → Console).
   - Login: `POST /shop_logincheck.php`, body `file_back=%2F&login_redir=&shop_user_login=<email>&shop_pass_login=<password>`
   - Add item: `POST /shop_ajax/ajax_cart.php`, body `get_ajax=1&result_type=json&lang_master=hu&action=add&sku=<SKU>&qty=<QTY>&<VARIANT>product_param=&item_random_number=<RANDOM>&is_last_package_offer=false`
   - **Malts** (`malatak`) must include the crush variant: `variant_name1=Roppant%C3%A1s&variant_list1=Roppantva&`. Hops and yeasts omit it.
   - Quantities: malts sold in 0.1 kg units → `ceil(kg / 0.1)`; hops in 100 g packs → `ceil(g / 100)`; **LUPOMAX/Cryo hops are often 50 g packs** → check the product name and use `ceil(g / 50)`; yeasts → number of packs
   - Redirect to `/shop_cart.php` when done

Credentials for the login POST are the user's Hopline account. Do not hard-code them into committed files.

### Check fermentation status

1. `node rapt_telemetry.js` (or `node brewfather_fermenting.js --batch-id <id>`) for readings
2. If a beer name is given, look up the recipe for expected OG/FG, yeast, and temperature range
3. Report: overview (hydrometer, elapsed time, reading count), gravity (start/current/drop/min/target FG), temperature (min/max/current vs yeast range), fermentation phases (lag, active, slowdown, stable, cold crash), a daily summary table, apparent attenuation, ABV estimate, and an assessment (healthy / stalled / complete, concerns, estimated time to completion)

When estimating completion, compute rate over several windows (3 h, 6 h, 12 h, 24 h) — a decelerating tail is normal and is not a stall. Genuine stalls show zero movement for 24 h+ while still well above expected FG.

### Review a recipe

1. Find the recipe and fetch its details (fermentables, hops, yeasts). Fetch the full recipe from the API for gravity, IBU, colour, mash steps, and water profile.
2. Present a grain bill table with each malt's percentage of the grist
3. Present the hop schedule by timing (first wort / boil / whirlpool / dry hop). **Note LUPOMAX and Cryo hops are roughly 2× concentrated** — report both actual and effective weight. Duplicate hop entries usually mean separate additions.
4. Present the yeast with lab, attenuation, temperature range, flocculation, and flavour profile
5. Give a sensory analysis: aroma, flavour, mouthfeel, appearance
6. Note process considerations (mash temperature vs body, high-adjunct lautering risk, DMS risk in short boils, dry-hop creep, pitch rate vs gravity)
7. Finish with an overall impression and any concrete changes worth making
