---
name: brew-order
description: Order ingredients for a Brewfather recipe from Hopline.hu
user_invocable: true
---

# /brew-order

Given a beer recipe name as argument, order the ingredients from Hopline:

1. Run `node brewfather_recipes.js` and find the recipe matching the given name (fuzzy match is fine)
2. Run `node brewfather_recipe_details.js <recipe_id>` to get the fermentables, hops, and yeasts
3. Display the ingredient list to the user
4. Run `node hopline_malts.js` for each relevant category (`malatak` for fermentables, `komlok` for hops, `elesztok` for yeasts) to get available Hopline products
5. For each ingredient, find the best matching Hopline product by name. Be strict about matching — the match should clearly be the same product (same brand/type), not just sharing a few words. For yeasts, match by the productId (e.g. "BRY-97") or the laboratory name + product name. Do NOT substitute a different product that merely has similar words (e.g. "Brewline U.S West Coast Ale" is NOT a match for "Lallemand BRY-97"). If the exact product is not found in the in-stock list, mark it as "not available"
6. For each matched product, run `node hopline_details.js <sku>` to check stock. The stock string format is like "239 0,1 kg" meaning 239 units of 0.1 kg each. Compare against the recipe's required amount
7. Show the user a summary table: ingredient name, required amount, matched Hopline product, SKU, stock level, and whether there's enough. Clearly mark unmatched items as "Not available on Hopline"
8. Ask the user if they want to add the available items to their Hopline cart, and whether they prefer Option A (browser console one-liner, copied to clipboard) or Option B (Playwright automation). Default to Option A.

## Option A: Browser console one-liner (default)

9. Generate a minified one-liner JavaScript snippet and copy it to the clipboard using `echo -n '...' | pbcopy`. The script should:
   - Log in via `fetch("/shop_logincheck.php", { body: "file_back=%2F&login_redir=&shop_user_login=kogerr%40hotmail.com&shop_pass_login=Tunde1995", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } })`
   - Then add each matched product via `fetch("/shop_ajax/ajax_cart.php", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "get_ajax=1&result_type=json&lang_master=hu&action=add&sku=<SKU>&qty=<QTY>&<VARIANT>&product_param=&item_random_number=<RANDOM>&is_last_package_offer=false" })`
   - For malts (category `malatak`), include the crush variant in the body: `variant_name1=Roppant%C3%A1s&variant_list1=Roppantva`. For hops and yeasts, omit the variant params (leave `<VARIANT>` empty).
   - Calculate QTY from the recipe amount: for malts sold in 0.1 kg units, qty = Math.ceil(amount_kg / 0.1); for hops sold in 100g packs, qty = Math.ceil(amount_g / 100); for yeasts, qty = amount
   - Log each result and redirect to `/shop_cart.php` when done
   - Format as a minified one-liner: `(async()=>{await fetch(login...);for(const i of[{s:"SKU",q:QTY,n:"name"},...]){...}window.location.href="/shop_cart.php"})();`
10. Tell the user the script has been copied to their clipboard — they can open hopline.hu, press F12 → Console, paste, and hit Enter

## Option B: Playwright automation

9. Use Playwright MCP to automate in the browser:
   - Navigate to `https://www.hopline.hu`
   - Log in by creating and submitting a form via `page.evaluate` (POST to `/shop_logincheck.php` with the credentials), then wait for URL containing `login_ok`
   - Add each item via `page.evaluate` using `fetch("/shop_ajax/ajax_cart.php", ...)` with `Content-Type: application/x-www-form-urlencoded` header. For malts, include `variant_name1=Roppant%C3%A1s&variant_list1=Roppantva` in the body. Wait 1 second between items.
   - Navigate to `https://www.hopline.hu/shop_cart.php` so the user can review and complete the order in the Playwright browser
10. Report what was added and tell the user the cart is ready for checkout
