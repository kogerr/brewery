---
name: fermentation
description: Check fermentation status using RAPT hydrometer and Brewfather recipe data
user_invocable: true
---

# /fermentation

Check the fermentation status of a batch using the RAPT hydrometer. Accepts an optional beer name argument.

1. Run `node rapt_telemetry.js` to get gravity/temp readings from the active (or most recent) RAPT hydrometer. The output includes hydrometer name, active status, a summary (start/current gravity, temperature, hours elapsed), and all readings with `{time, sg, temp}`
2. If a beer name was given, run `node brewfather_recipes.js` to find the recipe, then `node brewfather_recipe_details.js <id>` to get the expected OG, FG, yeast info, and fermentation temp range for comparison
3. Analyze the data and present a report including:
   - **Overview:** hydrometer name, whether active, time elapsed, total readings
   - **Gravity:** starting SG, current SG, gravity drop so far, min SG reached, target FG (from recipe if available)
   - **Temperature:** min, max, current, and whether it's within the yeast's recommended range
   - **Fermentation phases:** identify distinct phases (lag, active fermentation, slowdown, stable/complete, cold crash) based on gravity velocity and temperature changes
   - **Daily summary table:** one row per day with date, SG, temp, and gravity change from previous day
   - **Attenuation:** current apparent attenuation %, expected vs actual
   - **ABV estimate:** based on OG and current gravity
   - **Assessment:** is fermentation healthy/stalled/complete? Any concerns (temp out of range, slow start, stuck fermentation)? Estimated time to completion if still active
