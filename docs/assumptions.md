# Calculation assumptions

All constants live in one file, [`frontend/src/data/assumptions.json`](../frontend/src/data/assumptions.json),
read by both the browser model (`frontend/src/lib/waterModel.ts`) and the backend model
(`backend/app/services/water_model.py`). Every value is shown and editable in the app's
**Assumptions** drawer on the Impact screen. The two implementations are unit-tested and
produce identical numbers.

All results are **simulated estimates**. Values are indicative for Tamil Nadu conditions.

## Defaults

| Key | Default | Meaning |
|---|---|---|
| `rain_skip_threshold_mm` | 5 | Skip irrigation if forecast rain for the day is at or above this (precision plan only). Also adjustable on the Plan screen. |
| `effective_rain_factor` | 0.8 | Share of rain that counts as effective rainfall. |
| `effective_rain_min_mm` | 2 | Rain at or below this is ignored (evaporates from the canopy/surface). |
| `zone_factor_critical` | 1.25 | Multiplier on the net requirement for critical (red) zones. |
| `zone_factor_moderate` | 1.0 | Moderate (amber) zones. |
| `zone_factor_healthy` | 0.8 | Healthy (green) zones. |
| `zone_factor_waterlogged` | 0 | Waterlogged (blue) zones are never irrigated. |
| `efficiency_flood` | 0.45 | Field application efficiency, flood. |
| `efficiency_drip` | 0.85 | Uniform drip. |
| `efficiency_precision` | 0.90 | OptiFarm zone-based precision (drip with zone valves). |
| `pump_head_m` | 30 | Total dynamic head (lift + friction), metres. |
| `pump_efficiency` | 0.55 | Wire-to-water efficiency of the pump set. |
| `grid_tariff_inr_per_kwh` | 4.5 | Tariff used to cost grid electricity (many TN farm connections are subsidised; the value represents the cost to the system). |
| `solar_marginal_inr_per_kwh` | 0 | Marginal cost of solar-window energy (set an amortised value if preferred). |
| `diesel_litres_per_kwh` | 0.3 | Diesel burned per kWh of pump energy. |
| `diesel_price_inr_per_litre` | 92 | Diesel price. |
| `solar_threshold_wm2` | 400 | Hours with forecast shortwave radiation at or above this form the solar window. |
| `unscheduled_solar_share` | 0.4 | For solar pumps, share of energy that happens to fall in sunshine when the pump is *not* scheduled (flood and uniform drip baselines). |
| `min_irrigation_mm` | 0.5 | Requirements below this are skipped as "soil has enough water". |

## Formulas (requirements section 7)

1. **Crop coefficient**: `Kc` from the crop's FAO-56 style stages (flat initial, linear rise
   through development, flat mid-season, linear fall in the late stage), using days after sowing.
2. **Crop water use**: `ETc = ET0 × Kc`.
3. **Net requirement (mm/day)**: `max(0, ETc − effective rain)`, effective rain =
   `0.8 × rain` when rain > 2 mm, else 0.
4. **Zone adjustment** (precision only): net × zone factor.
5. **Gross water**: net ÷ application efficiency.
6. **Volume**: `litres = mm × area_m²`.
7. **Pump energy**: `kWh = (m³ × 1000 × 9.81 × head) / (3.6e6 × pump efficiency)`.
8. **Runtime**: `minutes = kWh ÷ pump kW × 60`.
9. **Cost**: grid = kWh × tariff; diesel = kWh × L/kWh × ₹/L; solar = solar-share × solar cost
   + (1 − solar-share) × grid tariff (grid back-up for any hours outside the window).
10. **Savings**: `(baseline − proposed) / baseline`, for water, energy and cost.

## Plan rules

- Zones are pumped one after another, **critical first**, then moderate, then healthy.
- **Solar pumps** start at the beginning of the day's solar window; **grid/diesel pumps** start
  at 06:00 (lower evaporation). Each cell records the share of its runtime inside the window.
- Skip reasons: rain ≥ threshold, waterlogged zone, requirement below `min_irrigation_mm`,
  not yet sown, inside the crop's "stop irrigating N days before harvest" window, season over.
- **Heat alert** when forecast max temperature exceeds the crop's `heat_tolerance_max_c`.

## Season simulation (Impact screen)

The 7-day plan uses the live forecast. The season what-if needs a whole season of weather, so
it uses Tamil Nadu monthly climatology from [`climate.json`](../frontend/src/data/climate.json):
monthly ET0, monthly rainfall (split into equal ~12 mm events spread evenly through the month)
and typical daily solar-window hours.

| Method | Zones | Rain forecast | Pump timing |
|---|---|---|---|
| Flood (baseline) | all zones alike | not used (field still receives effective rain) | unscheduled |
| Uniform drip | all zones alike | not used | unscheduled |
| OptiFarm precision | zone factors | rain-skip | solar window (solar pumps) |

## Known simplifications

- Paddy is modelled with ET-based demand like other crops; puddling, standing water and
  percolation losses are not modelled, so absolute paddy volumes are below field practice.
- Soil water balance is daily and memory-less (no soil storage between days).
- Zone stress, moisture and NDVI values are sample data, not live satellite retrievals.
