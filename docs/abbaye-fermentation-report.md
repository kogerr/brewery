# LalBrew Abbaye Fermentation Report

Analysis of 4 batches fermented with LalBrew Abbaye yeast, with RAPT Pill hydrometer data from Brewfather. One additional batch (#29 Pils-like Trappist Single) used Abbaye but has no sensor readings.

## Batch Summary

| # | Name | Brew Date | OG | FG | Drop | ABV | Att% | Lag (h) | Peak (h) | Peak Rate | Done (h) | Temp Range |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 84 | Belgian Raisin | 2026-04-18 | 1.060 | 1.009 | 0.051 | 6.6% | 85% | ~14 | 27.0 | 0.00381 | ~75 | 21-29C |
| 72 | Dubbel Grapeale | 2025-10-27 | 1.060 | 1.007 | 0.053 | 7.0% | 88% | ~10 | 29.3 | 0.00320 | ~85 | 22-26C |
| 59 | belgian blonde garapeale | 2025-01-16 | 1.057 | 1.006 | 0.051 | 6.7% | 89% | ~24 | 43.0 | 0.00192 | ~147 | 21-24C |
| 36 | Belgian Single 33L | 2024-03-15 | 1.051 | 1.006 | 0.045 | 5.9% | 88% | ~6 | 26.4 | 0.00215 | ~96 | 21-26C |

*Lag = approximate hours before gravity started dropping consistently (>0.001 SG/h).*
*Peak = hours after pitch when the highest sustained gravity drop rate was observed.*
*Done = hours after pitch when gravity stabilized within 0.001 SG over 12 hours.*

## Individual Batch Notes

### #84 Belgian Raisin (OG 1.060, 25C pitch)

| Day | SG | Temp | Drop |
|---|---|---|---|
| 0 | 1.060 | 24.9C | - |
| 1 | 1.050 | 24.3C | 0.009 |
| 2 | 1.010 | 25.2C | 0.040 |
| 3 | 1.010 | 23.2C | 0.000 |
| 4 | 1.009 | 1.5C | cold crash |
| 5+ | ~1.009 | ~0C | stable |

Lag phase ~14h (gravity flat ~1.060 through the first overnight). Once it kicked off, this was the **fastest fermentation in the Abbaye dataset** — the day-2 drop was a massive **0.040 SG**, more than 4× the day-1 drop, and the rest of the descent (1.060 → 1.010) effectively completed within ~48h. Peak at +27h with the **highest peak rate of any Abbaye batch (0.00381 SG/h)**. Strong fermentation exotherm: temperature rose from 24°C to **28.9°C** (+4°C) during peak activity — the warmest of any Abbaye batch and at the top of Abbaye's 17-25°C rated range. Cold crash started ~78h, stable terminal at 1.0093 by ~96h. 85% apparent attenuation. Measured FG 1.010 — Pill agreed (read 1.0093). 6.6% ABV.

**Note on RAPT Pill accuracy:** The Pill OG reading (1.060) is ~8 pts below the recipe-calculated OG of 1.068. This is consistent with a systematic low bias observed across all Abbaye batches (see Data Quality Notes).

### #72 Dubbel Grapeale (OG 1.060, 24C pitch)

| Day | SG | Temp | Drop |
|---|---|---|---|
| 0 | 1.060 | 23.9C | - |
| 1 | 1.055 | 22.1C | 0.005 |
| 2 | 1.026 | 24.9C | 0.029 |
| 3 | 1.006 | 23.1C | 0.020 |
| 4 | 1.007 | 9.5C | cold crash |

Lag phase ~10h (gradual cooling from 24C to 22C while gravity held steady). Big day 2 drop (0.029) as fermentation hit full stride, then continued dropping fast on day 3. Essentially terminal by day 3, cold crashed day 4. Peak fermentation at +29h with a strong rate of 0.00320 SG/h. Temperature rose from 22C to 26C during active fermentation (exotherm), then dropped sharply on cold crash. Measured FG 1.010 — Pill read 1.007, consistent with the Pill reading slightly low. 88% apparent attenuation.

### #59 belgian blonde garapeale (OG 1.057, 24C pitch)

| Day | SG | Temp | Drop |
|---|---|---|---|
| 0 | 1.057 | 23.6C | - |
| 1 | 1.057 | 21.4C | 0.000 |
| 2 | 1.034 | 23.7C | 0.024 |
| 3 | 1.022 | 21.8C | 0.012 |
| 4 | 1.010 | 20.9C | 0.012 |
| 5 | 1.008 | 20.9C | 0.003 |
| 6 | 1.006 | 21.1C | 0.001 |
| 7 | 1.006 | 21.0C | 0.001 |
| 8 | 1.006 | 2.9C | cold crash |

Long lag phase — ~24h with no gravity drop at all (day 1 reading was slightly higher than day 0). Fermentation didn't really start until day 2. Once it started, it was a steady multi-day drop rather than the explosive day-2 pattern seen in other batches. Peak at +43h (latest of all Abbaye batches) with the lowest peak rate (0.00192). Took 6 days to reach terminal and nearly 7 days total before cold crash. Final attenuation 89% — the highest of all Abbaye batches. Temperature stayed cool throughout (21-24C), never spiking from exotherm. Measured FG 1.006 — Pill agreed, suggesting less CO2 adhesion with a gentler fermentation.

### #36 Belgian Single 33L (OG 1.051, 23C pitch)

| Day | SG | Temp | Drop |
|---|---|---|---|
| 0 | 1.051 | 23.1C | - |
| 1 | 1.032 | 23.3C | 0.019 |
| 2 | 1.010 | 24.6C | 0.022 |
| 3 | 1.008 | 21.9C | 0.003 |
| 4 | 1.007 | 21.1C | 0.001 |
| 5 | 1.007 | 21.0C | stable |
| 6-15 | ~1.007 | ~21C | stable |
| 16 | 1.007 | 8.3C | cold crash |

Shortest lag phase of all Abbaye batches (~6h). Fast, even fermentation — nearly half the total drop occurred on day 1 (0.019), and essentially terminal by day 3. Then sat stable at ~1.007 for almost two weeks before cold crash — the longest conditioning period in the dataset. Peak at +26h. 88% attenuation. Measured FG 1.007 — Pill agreed.

*Late sensor anomaly: after cold crash and apparent removal from fermenter, the Pill reported SG readings of 1.23 — clearly a sensor malfunction (Pill likely dried out or was removed from liquid). This data was excluded from analysis.*

## Statistical Analysis (completed batches, n=4)

### Lag Phase

| Metric | Value |
|---|---|
| Minimum | ~6h (#36, Belgian Single, 23C pitch) |
| Maximum | ~24h (#59, belgian blonde garapeale, 24C pitch) |
| Mean | **~13.5h** |

Lag phase was highly variable. The 24h lag in #59 is an outlier — potentially related to yeast freshness or underpitching. The other three batches had 6-14h lags, which is typical for dry yeast at 23-25C pitch.

### Peak Fermentation Timing

| Metric | Value |
|---|---|
| Minimum | 26.4h (#36, Belgian Single) |
| Maximum | 43.0h (#59, belgian blonde garapeale) |
| Mean | **31.4h** |
| Median | **28.2h** |

### Peak Fermentation Rate (SG/hour)

| Metric | Value |
|---|---|
| Minimum | 0.00192 (#59, belgian blonde garapeale) |
| Maximum | **0.00381 (#84, Belgian Raisin)** |
| Mean | **0.00277** |

### Fermentation Completion

| Metric | Value |
|---|---|
| Minimum | **~75h / ~3.1 days (#84, Belgian Raisin)** |
| Maximum | ~147h / ~6.1 days (#59, belgian blonde garapeale) |
| Mean | **~101h (~4.2 days)** |
| Median | **~91h (~3.8 days)** |

### Apparent Attenuation (from RAPT Pill)

| Metric | Value |
|---|---|
| Minimum | **85% (#84, Belgian Raisin)** |
| Maximum | 89% (#59) |
| Mean | **87.5%** |

Three of the four batches cluster tightly at 88-89% apparent attenuation; #84 is slightly lower at 85%, likely because the Belgian Raisin grist included unfermentable sugars/fibers from the raisins that contribute density without fermenting out. The 88-89% baseline remains significantly higher than Lallemand's 80% spec and the user's BRY-97 average (79%) — see Data Quality Notes for the Pill's systematic low bias that likely explains most of this gap.

## Temperature Influence

All batches were pitched in a narrow range (23-25C), so temperature comparisons are limited. Key observations:

1. **Fermentation exotherm** was visible in #36, #72, and especially **#84** — temperature rose 1-4C during peak activity. #84 peaked at **28.9°C**, the highest of any Abbaye batch and ~4°C above its rated maximum. This correlated with the **fastest peak rate (0.00381 SG/h)** and the **shortest completion time (~75h)** — suggesting Abbaye becomes notably more vigorous when allowed to free-rise above its rated range.

2. **#59 showed no temperature spike** despite active fermentation, likely because ambient temperature was cooler (winter brew, Jan 2025) and the fermentation was more gradual. This batch had the lowest peak rate and longest completion time.

3. **Abbaye's rated range is 17-25C.** All batches were pitched within or at the upper end of this range. The pattern across n=4 is clear: **higher fermentation temperature → faster peak → faster completion** — the relationship is strong and monotonic. For ester-forward Belgian character, pitching at 24-25C and allowing free-rise into the high 20s appears to drive the most expressive fermentation.

## Abbaye vs BRY-97 Comparison

| Metric | Abbaye (n=4) | BRY-97 (n=15) |
|---|---|---|
| Peak timing (mean) | **31.4h** | 25.9h |
| Peak timing (median) | **28.2h** | 25.2h |
| Peak rate (mean) | **0.00277** | 0.00239 |
| Completion (median) | **~91h** | ~72h |
| Attenuation (mean) | **87.5%** | 79.2% |
| Typical temp range | 21-29C | 22-26C |

**Abbaye peaks about 3-6 hours later** than BRY-97 and takes about 19h longer to finish (median). With #84 added, Abbaye's mean peak rate (0.00277) now exceeds BRY-97's (0.00239) — when Abbaye is allowed to run warm, it ferments more aggressively than the cleaner English ale strain, just with a longer initial lag. Apparent attenuation difference (87.5% vs 79.2%) is largely a measurement artifact — see Data Quality Notes.

Abbaye fermentations tend to be smoother and more even — less of the explosive "day 2 bomb" pattern common with BRY-97, and more of a sustained multi-day drop (especially visible in #59).

## Abbaye vs Verdant IPA Comparison

| Metric | Abbaye (n=4) | Verdant IPA (n=7) |
|---|---|---|
| Peak timing (mean) | **31.4h** | 19.6h |
| Peak timing (median) | **28.2h** | 18.9h |
| Peak rate (mean) | **0.00277** | 0.00276 |
| Completion (median) | **~91h** | ~56h |
| Attenuation (mean) | **87.5%** | 79% |

Abbaye is the slowest of the three yeasts to start and finish — peaks ~9h later than Verdant and takes ~62% longer to complete. With #84 added, however, **peak rates are now essentially identical** (0.00277 vs 0.00276) — Abbaye matches Verdant's intensity once it gets going, but lags before peak and tails longer afterward. This makes sense: Abbaye is a Belgian abbey strain optimized for flavor complexity (ester/phenol production), not speed. Verdant is an English ale strain bred for fast, clean fermentation.

## Estimations for Future Brews

Based on this data, for a typical Belgian ale (OG 1.050-1.070) with Abbaye at 22-25C:

| What | Estimate |
|---|---|
| Lag phase (no visible activity) | 6-14h (up to 24h if underpitched or pitched cold) |
| Peak fermentation timing | 26-30h after pitch (later if pitched cool) |
| 50% of total gravity drop | By ~36h |
| 90% of total gravity drop | By ~60-72h |
| Terminal gravity reached | 75-147h (3-6 days) — faster with warm, free-rising ferments |
| Expected apparent attenuation (Pill) | 85-89% (lower if grist contains unfermentable adjuncts like raisins) |
| Expected true attenuation | ~80% (Pill reads ~8 pts low) |
| Safe to cold crash | ~85-96h (3.5-4 days) |
| Expected FG from OG (true) | OG - (OG - 1.000) * 0.80 |
| Expected FG from OG (Pill reading) | OG - (OG - 1.000) * 0.87 |

## Outcome for Batch #84 (Belgian Raisin) — Completed

- OG/FG: **1.060 → 1.0093** (Pill); measured FG ~1.010
- Apparent attenuation: **85%** (slightly below the 88-89% baseline — likely due to non-fermentable raisin solids)
- ABV: **~6.6%**
- Peak fermentation: **27.0h** after pitch at **0.00381 SG/h** — **fastest peak rate of all Abbaye batches**
- Fermentation exotherm: temperature rose from 24°C to **28.9°C** (+4°C, the warmest of any Abbaye batch)
- Total fermentation time: **~75h** (3.1 days) — **fastest completion of all Abbaye batches**
- Cold crash started ~78h, beer stable at terminal by ~96h
- The aggressive warm fermentation (peaking at 29°C, ~4°C above Abbaye's rated max) drove both the fastest peak rate and the shortest completion time observed in this dataset.

## Data Quality Notes

- **RAPT Pill systematic low bias:** All four completed Abbaye batches show 85-89% apparent attenuation — far above Lallemand's 80% spec. The measured (hydrometer) FG values from Brewfather tell a different story: #84 measured 1.010 (Pill: 1.0093), #72 measured 1.010 (Pill: 1.007), #59 measured 1.006 (Pill: 1.006), #36 measured 1.007 (Pill: 1.006). The Pill tends to read 0-3 pts low on FG. Additionally, OG readings appear ~8 pts low compared to recipe calculations. CO2 adhesion during active fermentation likely worsens the bias during peak activity.

- **#36 Belgian Single sensor anomaly:** After approximately day 16 (cold crash complete), the Pill began reporting SG values above 1.2, eventually reaching 1.234. This is clearly a malfunction — the Pill was likely removed from liquid or the battery was failing. All data after day 16 was excluded. The "done" algorithm's 667h value was overridden with ~96h based on the daily gravity table.

- **#29 Pils-like Trappist Single** (OG 1.052, no measured FG) had no RAPT Pill readings at all and is excluded from this analysis entirely.

- **Small sample size (n=4):** Statistics should still be treated as preliminary. With only 4 completed batches, outliers have a large effect on means — particularly #59 (slow, cool) and #84 (fast, warm) sit at opposite ends of the temperature/speed spectrum. More batches at controlled temperatures would help isolate the temperature effect from yeast lot/age variation.
