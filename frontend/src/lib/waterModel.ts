/**
 * OptiFarm water, energy and cost model (requirements section 7).
 *
 * Pure functions only. The backend mirrors this file in
 * backend/app/services/water_model.py; keep the two in sync (both are unit-tested).
 */
import type {
  Assumptions,
  Crop,
  DailyWeather,
  Field,
  Impact,
  Method,
  MethodImpact,
  Plan,
  PlanCell,
  PlanDay,
  PumpConfig,
  StageName,
  Weather,
  ZoneLabel,
} from './types';
import { fromMinutes, overlapShare, solarWindowForDate, toMinutes } from './solarWindow';
import climate from '../data/climate.json';

export const METHODS: Method[] = ['flood', 'drip', 'precision'];

const DAY_MS = 86_400_000;
const WATER_DENSITY = 1000; // kg/m3
const G = 9.81; // m/s2
const J_PER_KWH = 3.6e6;

// ---------------------------------------------------------------- 1. Crop coefficient

export interface KcResult {
  kc: number;
  stage: StageName;
}

/**
 * FAO-56 style Kc curve: flat in the initial stage, linear rise through development,
 * flat in mid-season, linear fall to the end value through the late stage.
 * Returns null before sowing (das < 0) or after harvest (das >= duration).
 */
export function kcForDay(crop: Crop, das: number): KcResult | null {
  if (das < 0 || das >= crop.duration_days) return null;
  const [ini, dev, mid, late] = crop.growth_stages;
  let d = das;
  if (d < ini.days) return { kc: ini.kc, stage: 'initial' };
  d -= ini.days;
  if (d < dev.days) return { kc: ini.kc + ((mid.kc - ini.kc) * d) / dev.days, stage: 'development' };
  d -= dev.days;
  if (d < mid.days) return { kc: mid.kc, stage: 'mid' };
  d -= mid.days;
  const frac = Math.min(1, d / late.days);
  return { kc: mid.kc + (late.kc - mid.kc) * frac, stage: 'late' };
}

// ---------------------------------------------------------------- 2. Net requirement

export function effectiveRain(rainMm: number, a: Assumptions): number {
  return rainMm > a.effective_rain_min_mm ? a.effective_rain_factor * rainMm : 0;
}

export function netRequirementMm(et0: number, kc: number, rainMm: number, a: Assumptions): number {
  return Math.max(0, et0 * kc - effectiveRain(rainMm, a));
}

// ---------------------------------------------------------------- 3. Zone factor

export function zoneFactor(label: ZoneLabel, a: Assumptions): number {
  switch (label) {
    case 'critical':
      return a.zone_factor_critical;
    case 'moderate':
      return a.zone_factor_moderate;
    case 'healthy':
      return a.zone_factor_healthy;
    case 'waterlogged':
      return a.zone_factor_waterlogged;
  }
}

// ---------------------------------------------------------------- 4-6. Gross, volume, energy

export function efficiency(method: Method, a: Assumptions): number {
  return method === 'flood'
    ? a.efficiency_flood
    : method === 'drip'
      ? a.efficiency_drip
      : a.efficiency_precision;
}

export const grossMm = (netMm: number, eff: number) => (eff > 0 ? netMm / eff : 0);

/** 1 mm over 1 m2 = 1 litre. */
export const litresFromMm = (mm: number, areaM2: number) => mm * areaM2;

/** Electrical energy to lift `litres` through the total head, given pump efficiency. */
export function pumpEnergyKwh(litres: number, a: Assumptions): number {
  const volumeM3 = litres / 1000;
  return (volumeM3 * WATER_DENSITY * G * a.pump_head_m) / (J_PER_KWH * a.pump_efficiency);
}

// ---------------------------------------------------------------- 7. Cost

export function energyCostInr(
  kwh: number,
  solarShare: number,
  pump: PumpConfig,
  a: Assumptions,
): number {
  if (pump.type === 'diesel') return kwh * a.diesel_litres_per_kwh * a.diesel_price_inr_per_litre;
  if (pump.type === 'solar') {
    return (
      kwh * solarShare * a.solar_marginal_inr_per_kwh +
      kwh * (1 - solarShare) * a.grid_tariff_inr_per_kwh
    );
  }
  return kwh * a.grid_tariff_inr_per_kwh;
}

// ---------------------------------------------------------------- 8. Savings

export const savingPct = (baseline: number, proposed: number) =>
  baseline > 0 ? ((baseline - proposed) / baseline) * 100 : 0;

// ---------------------------------------------------------------- helpers

export const parseDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const daysBetween = (fromIso: string, toIsoStr: string) =>
  Math.round((parseDate(toIsoStr).getTime() - parseDate(fromIso).getTime()) / DAY_MS);

const ZONE_PRIORITY: Record<ZoneLabel, number> = {
  critical: 0,
  moderate: 1,
  healthy: 2,
  waterlogged: 3,
};

export function zonesByPriority<T extends { label: ZoneLabel; stress_score: number }>(
  zones: T[],
): T[] {
  return [...zones].sort(
    (x, y) => ZONE_PRIORITY[x.label] - ZONE_PRIORITY[y.label] || y.stress_score - x.stress_score,
  );
}

/** Lifecycle skip reasons shared by the plan and the season simulation (rule 10). */
function lifecycleSkip(crop: Crop, das: number): PlanCell['reason_key'] | null {
  if (das < 0) return 'not_sown';
  if (das >= crop.duration_days) return 'harvested';
  if (das >= crop.duration_days - crop.stop_irrigation_days_before_harvest) return 'pre_harvest';
  return null;
}

// ---------------------------------------------------------------- 7-day plan

export interface PlanInput {
  crop: Crop;
  field: Field;
  sowingDate: string;
  pump: PumpConfig;
  weather: Weather;
  assumptions: Assumptions;
  days?: number;
}

const DAWN_START_MIN = 6 * 60;

/** OptiFarm zone-based precision plan for the next N forecast days. */
export function buildPlan({
  crop,
  field,
  sowingDate,
  pump,
  weather,
  assumptions: a,
  days = 7,
}: PlanInput): Plan {
  const eff = a.efficiency_precision;
  const zones = zonesByPriority(field.zones);
  const out: PlanDay[] = weather.daily.slice(0, days).map((w: DailyWeather) => {
    const das = daysBetween(sowingDate, w.date);
    const kcRes = kcForDay(crop, das);
    const life = lifecycleSkip(crop, das);
    const window = solarWindowForDate(weather.hourly, w.date, a.solar_threshold_wm2);
    const net = kcRes ? netRequirementMm(w.et0_mm, kcRes.kc, w.rain_mm, a) : 0;
    const rainSkip = w.rain_mm >= a.rain_skip_threshold_mm;

    // Zones are pumped one after another, critical first. A solar pump starts at the
    // beginning of the solar window; grid/diesel pumps start at dawn (less evaporation).
    let cursor = pump.type === 'solar' && window ? toMinutes(window.start) : DAWN_START_MIN;

    const cells: PlanCell[] = zones.map((z) => {
      const base = {
        date: w.date,
        zone_id: z.zone_id,
        net_mm: 0,
        gross_mm: 0,
        litres: 0,
        kwh: 0,
        start_time: null,
        duration_min: 0,
        solar_window: window ? { start: window.start, end: window.end } : null,
        solar_share: 0,
      };
      const skip = (reason: PlanCell['reason_key']): PlanCell => ({
        ...base,
        action: 'skip',
        reason_key: reason,
      });
      if (life) return skip(life);
      if (rainSkip) return skip('rain');
      const factor = zoneFactor(z.label, a);
      if (factor <= 0) return skip('waterlogged');
      const netZ = net * factor;
      if (netZ < a.min_irrigation_mm) return skip('no_need');

      const gross = grossMm(netZ, eff);
      const litres = litresFromMm(gross, z.area_ha * 10_000);
      const kwh = pumpEnergyKwh(litres, a);
      const durationMin = pump.power_kw > 0 ? (kwh / pump.power_kw) * 60 : 0;
      const start = cursor;
      cursor += durationMin;
      return {
        ...base,
        action: 'irrigate',
        reason_key: 'irrigate',
        net_mm: netZ,
        gross_mm: gross,
        litres,
        kwh,
        start_time: fromMinutes(start),
        duration_min: Math.ceil(durationMin),
        solar_share: pump.type === 'solar' ? overlapShare(start, durationMin, window) : 0,
      };
    });

    return {
      date: w.date,
      et0_mm: w.et0_mm,
      rain_mm: w.rain_mm,
      temp_max_c: w.temp_max_c,
      kc: kcRes?.kc ?? 0,
      stage: kcRes?.stage ?? null,
      days_after_sowing: das,
      heat_alert: w.temp_max_c > crop.heat_tolerance_max_c,
      solar_window: window,
      cells,
      total_litres: cells.reduce((s, c) => s + c.litres, 0),
      total_kwh: cells.reduce((s, c) => s + c.kwh, 0),
    };
  });

  const totalKwh = out.reduce((s, d) => s + d.total_kwh, 0);
  const solarKwh = out.reduce(
    (s, d) => s + d.cells.reduce((t, c) => t + c.kwh * c.solar_share, 0),
    0,
  );
  return {
    days: out,
    total_litres: out.reduce((s, d) => s + d.total_litres, 0),
    total_kwh: totalKwh,
    solar_share: totalKwh > 0 ? solarKwh / totalKwh : 0,
  };
}

// ---------------------------------------------------------------- season what-if

/**
 * Deterministic synthetic daily rain from monthly climatology: the month's total is
 * split into equal events of about `rain_event_mm`, spread evenly through the month.
 */
export function climatologyRain(date: Date): number {
  const month = date.getUTCMonth();
  const total = climate.rain_mm_month[month];
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
  const n = Math.round(total / climate.rain_event_mm);
  if (n <= 0) return 0;
  const d = date.getUTCDate();
  const isEvent = Math.floor((d * n) / daysInMonth) !== Math.floor(((d - 1) * n) / daysInMonth);
  return isEvent ? total / n : 0;
}

export interface SeasonInput {
  crop: Crop;
  zones: { label: ZoneLabel; area_ha: number }[];
  sowingDate: string;
  pump: PumpConfig;
  assumptions: Assumptions;
}

/**
 * Whole-season water, energy and cost for the three methods, per hectare.
 * Flood and uniform drip irrigate every zone alike and do not use the rain forecast;
 * OptiFarm precision applies zone factors and rain-skip and runs in the solar window.
 */
export function seasonImpact({ crop, zones, sowingDate, pump, assumptions: a }: SeasonInput): Impact {
  const areaHa = zones.reduce((s, z) => s + z.area_ha, 0) || 1;
  const start = parseDate(sowingDate);
  const result = {} as Record<Method, MethodImpact>;

  for (const method of METHODS) {
    const eff = efficiency(method, a);
    let litres = 0;
    let kwh = 0;
    let cost = 0;
    let solarKwh = 0;
    const weekly: number[] = [];

    for (let das = 0; das < crop.duration_days; das++) {
      const date = new Date(start.getTime() + das * DAY_MS);
      const month = date.getUTCMonth();
      const kcRes = kcForDay(crop, das);
      const rain = climatologyRain(date);
      const skipLife = lifecycleSkip(crop, das) !== null;
      let dayLitres = 0;
      if (kcRes && !skipLife && !(method === 'precision' && rain >= a.rain_skip_threshold_mm)) {
        const net = netRequirementMm(climate.et0_mm_day[month], kcRes.kc, rain, a);
        for (const z of zones) {
          const factor = method === 'precision' ? zoneFactor(z.label, a) : 1;
          const netZ = net * factor;
          if (netZ < a.min_irrigation_mm) continue;
          dayLitres += litresFromMm(grossMm(netZ, eff), z.area_ha * 10_000);
        }
      }
      const dayKwh = pumpEnergyKwh(dayLitres, a);
      let share = 0;
      if (pump.type === 'solar' && dayKwh > 0) {
        if (method === 'precision') {
          const runHours = pump.power_kw > 0 ? dayKwh / pump.power_kw : Infinity;
          share = Math.min(1, climate.solar_hours_day[month] / runHours);
        } else {
          share = a.unscheduled_solar_share;
        }
      }
      litres += dayLitres;
      kwh += dayKwh;
      solarKwh += dayKwh * share;
      cost += energyCostInr(dayKwh, share, pump, a);
      if ((das + 1) % 7 === 0 || das === crop.duration_days - 1) weekly.push(litres / areaHa);
    }

    result[method] = {
      method,
      litres_per_ha: litres / areaHa,
      kwh_per_ha: kwh / areaHa,
      cost_inr_per_ha: cost / areaHa,
      solar_share: kwh > 0 ? solarKwh / kwh : 0,
      weekly_cumulative_litres_per_ha: weekly,
    };
  }
  return { season_days: crop.duration_days, methods: result };
}
