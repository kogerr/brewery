# Brewery Project

This project contains scripts to interact with Brewfather (recipe management) and Hopline.hu (Hungarian homebrew shop).

## Scripts

- `brewfather_recipes.js` - Lists all Brewfather recipes (outputs JSON array of `{_id, name}`)
- `brewfather_recipe_details.js <recipe_id>` - Gets recipe ingredients (outputs JSON with `{fermentables, hops, yeasts}`)
- `brewfather_batches.js [--status X] [--yeast Y]` - Lists batches with recipe name, yeast, OG/FG, brew date. Default: all statuses. Filters by yeast name substring
- `brewfather_fermenting.js [status]` or `brewfather_fermenting.js --batch-id <id>` - Gets readings + fermentation analysis (peak rate timing, when fermentation finished, daily gravity/temp)
- `hopline_malts.js <category>` - Lists Hopline products in a category (outputs JSON array of `{id, name}`). Categories: `malatak`, `komlok`, `elesztok`
- `hopline_details.js <sku>` - Gets stock info for a Hopline product (outputs stock string like "239 0,1 kg")
- `hopline_login.js` - Logs in to Hopline, outputs JSON with `{status, location, cookies}`
- `hopline_cart.js <sku> <qty> <cookie>` - Adds a product to Hopline cart with given quantity
- `rapt_login.js` - Logs in to RAPT, outputs bearer token
- `rapt_telemetry.js` - Gets gravity/temp readings from active (or most recent) RAPT hydrometer
- `calculator-pitching-rate.js <yeast> <og_sg> <liters> <temp_c>` - Lallemand pitching rate calculator
- `calculator-abv.js <og_sg> <fg_sg> [standard|alternate]` - ABV, attenuation, calories calculator
- `calculator-gravity.js <unit> <value>` - Converts between sg/brix/oechsle/baume/kmw/density/alcohol/sugar

All scripts are run with `node` from the `/Users/gekovacs/workspace/brewery` directory.

## Brewing preferences

- **Mash water calculation:** Always calculate mash-in water so that litres of water + kilograms of malt = litres at pre-boil. (i.e. mash_water_L = pre_boil_volume_L - total_grain_kg)

## User-invocable skills

Skills are defined in `.claude/skills/` — see `brew-order.md` and `fermentation.md`.
