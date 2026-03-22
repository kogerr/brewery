---
name: recipe-review
description: Review and analyze a Brewfather recipe for expected flavor, aroma, and mouthfeel
user_invocable: true
---

# /recipe-review

Given a beer recipe name as argument, fetch its details from Brewfather and provide a detailed sensory analysis.

1. Run `node brewfather_recipes.js` to list recipes. If the recipe is not in the first 50 results, paginate using the `start_after` parameter (the `_id` of the last result) by fetching additional pages from `https://api.brewfather.app/v2/recipes?limit=50&start_after=<last_id>`. Find the recipe matching the given name (fuzzy match is fine).
2. Run `node brewfather_recipe_details.js <recipe_id>` to get fermentables, hops, and yeasts.
3. Present a **grain bill table** with each grain's name, supplier, amount (kg), and percentage of total grist.
4. Present a **hop schedule** listing each hop addition with name, amount (g), and note if LUPOMAX/Cryo (which are ~2x concentrated). Calculate total hop weight and effective equivalent if concentrated pellets are used. If there are duplicate hop entries, note that these likely represent different additions (e.g. whirlpool + dry hop).
5. Present the **yeast** with laboratory, name, amount, and key characteristics (flavor profile, attenuation range, temperature range, flocculation) based on your knowledge of the strain.
6. Identify the **beer style** from the recipe name, ingredients, and process cues (e.g. "Raw" = no-boil raw ale, "NEIPA" = New England IPA).
7. Provide a **sensory analysis** covering:
   - **Aroma:** expected hop aromas (specific fruits, florals, resin, etc. for each variety), yeast-derived esters, and any malt/process contributions
   - **Flavor:** hop flavor impact, malt backbone, bitterness level (consider process — raw ales have lower isomerization), yeast character, finish
   - **Mouthfeel:** body, creaminess, carbonation expectations based on grain bill composition (% oats, wheat, dextrin malts)
   - **Appearance:** expected color, haze/clarity based on grain bill and yeast
8. Note any **process considerations** — e.g. DMS risk from pilsner malt in raw ales, high adjunct ratios affecting lautering, protein haze contributions.
9. Give an **overall impression** — what the beer will be like to drink, and how well the recipe components work together.
