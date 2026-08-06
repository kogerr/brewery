# BrewZilla PID Mash Analysis — 2026-07-13

Analysis of a 65°C mash step using the BrewZilla with PID coefficients set to **P=0.500, I=0.0020, D=0**. Telemetry sampled at ~1 min intervals over 82 minutes.

## Sensor semantics

The RAPT telemetry exposes two temperature fields, and reading them correctly is critical:

| Field | What it represents | Source of truth for |
|---|---|---|
| `controlDeviceTemperature` | **RAPT Bluetooth probe in the wort** | Actual wort/mash temperature |
| `temperature` | Built-in thermistor **at the heating element** | Boundary-layer temp near the element |

The bulk wort behavior is what matters for the beer, so `controlDeviceTemperature` is used throughout this analysis. The built-in element sensor reads consistently higher during active heating because it sits inside the thermal boundary layer next to the element — this is expected and doesn't reflect what the mash actually experiences.

## Data summary

- **Duration:** 82.2 minutes
- **Readings:** 75
- **Target:** 65°C (single-step mash hold)
- **PID:** P=0.500, I=0.0020, D=0
- **Setup:** External RAPT Bluetooth thermometer as the control sensor

## The curve

### Phase 1 — Ramp to target (0 → ~13 min)

The RAPT probe was not yet reporting for the first ~3 min (`controlDeviceTemperature = 0`) — Bluetooth pairing lag or the probe not yet submerged. Once online:

| Time (min) | Wort (RAPT) | Element | Target | Wort error |
|---|---|---|---|---|
| 3.55 | 61.04°C | 66.30°C | 65.00 | −3.96 |
| 9.59 | 61.19°C | 66.76°C | 65.00 | −3.81 |
| 10.62 | 62.50°C | 76.42°C | 65.00 | −2.50 |
| 11.66 | 63.90°C | 72.39°C | 65.00 | −1.10 |
| 12.68 | 64.99°C | 66.58°C | 65.00 | −0.01 |
| 13.70 | **65.58°C** | 64.33°C | 65.00 | **+0.58** ← peak |

**Wort overshoot: +0.58°C.** The element sensor briefly spiked to 76°C during the aggressive ramp, but that spike stayed at the element — the wort itself experienced a controlled approach.

### Phase 2 — Hold (13 → 82 min, ~70 min)

Wort holds tightly around the target with a small consistent under-shoot:

| Metric | Value |
|---|---|
| Mean wort error | **−0.64°C** (mean wort ≈ 64.4°C) |
| Std deviation | 0.78°C |
| Min wort during hold | 63.5°C (excluding one BT glitch) |
| Max wort during hold | 65.6°C (initial overshoot peak) |
| Zero-crossings (wort around target) | **0** — no oscillation |
| Mean element-wort delta | **+4.25°C** (element runs consistently ~3-9°C hotter) |
| Mean heater duty (hold) | ~37% |
| Heater starts (whole span) | 65 (~0.8/min) |

### Anomaly at 54.67 min

One reading shows `controlDeviceTemperature = 58.78°C` while neighboring readings were 64.8°C, recovering to 64.8°C within 60 seconds. A 6°C drop in a 20 L kettle in <60 s is physically impossible, so this is almost certainly a **Bluetooth reception glitch or the probe being briefly uncovered by wort motion**, not a real thermal event. Excluded from analysis.

## Interpretation

### The PID is working — and it's controlling from the RAPT probe

A key question is which sensor the BrewZilla's PID loop is actually reading for feedback. The duty-cycle behavior answers this unambiguously:

- During hold, **wort is ~0.6°C below target** and **element is ~4°C above target**
- Heater duty averages **37%** — periodically firing to close the wort-side gap
- A PID controlling from the element sensor would see "target exceeded" and output ~0%; that's not what happens
- A PID controlling from the RAPT probe would see "still slightly below target" and fire briefly; that's exactly what happens ✅

**Conclusion: PID is controlling from `controlDeviceTemperature` (RAPT wort), as intended.**

### The element-wort delta is normal physics, not a fault

The +4°C average delta between element and wort reflects the thermal boundary layer around the immersion heating element. Recirculation pumps cool wort past the element; the probe reads wort *after* mixing; the base thermistor reads *at* the element. This gap always exists during active heating and is not a control problem.

### The −0.6°C steady-state offset is expected with low integral

Classic PID behavior: **P alone leaves a small steady-state error** proportional to the load. With I=0.002 (very low), the integrator barely accumulates over the mash duration, so the small deadband persists. This is a design choice — trading a bit of steady-state accuracy for zero risk of integrator wind-up during the ramp.

### Ramp behavior is essentially textbook

- P=0.5 × (−65°C error) → output saturates → 100% duty during ramp
- Wort tracks upward with no oscillation
- Overshoot only +0.58°C — well-damped even with D=0, because the RAPT probe's thermal lag through the wort mass acts as a natural low-pass filter

## Verdict

**PID coefficients P=0.5, I=0.002, D=0 are well-tuned for this BrewZilla + RAPT probe setup.**

| Aspect | Assessment |
|---|---|
| Ramp speed | ✅ Fast, saturated |
| Overshoot | ✅ +0.58°C only |
| Hold stability | ✅ Zero oscillation, ±0.8°C stdev |
| Sensor loop | ✅ Controlling from RAPT wort probe |
| Steady-state error | 🟡 −0.6°C offset (small, mash-irrelevant) |

## Optional tuning (not necessary)

If you want to close the −0.6°C steady-state offset and hit 65.0°C dead-on:

| Parameter | Current | Suggested | Reason |
|---|---|---|---|
| P | 0.5 | keep 0.5 | Ramp is well-behaved |
| I | 0.002 | **0.005** | Slightly more integral to close the deadband |
| D | 0 | keep 0 | Overshoot is already tiny |

Expected result: wort tracks ~65.0°C ±0.3°C instead of ~64.4°C ±0.8°C.

**Honest recommendation:** don't bother. Mash chemistry doesn't meaningfully distinguish between 64.4°C and 65.0°C — grist crush and recirculation evenness contribute far more variance than this 0.6°C offset. Only tune further if you enjoy chasing perfection.

## Also useful going forward

- **Boil mode:** the same PID values were previously validated for boil hold (`readings2_cut.json` earlier snapshot). Physical boiling ceiling does most of the damping, and P=0.5/I=0.002/D=0 works fine there too.
- **What could still be checked:** behavior on a **multi-step mash** (e.g., 42°C ferulic rest → 63°C sacc → 75°C mash-out). The ramp *between* steps at lower temperatures may show different overshoot characteristics than the initial cold ramp. If you brew the Belgian Wheat Ale with its ferulic rest, capture that telemetry and re-analyze.
