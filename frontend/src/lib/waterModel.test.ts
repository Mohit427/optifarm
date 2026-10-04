import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  effectiveRain,
  kcForDay,
  netRequirementMm,
  pumpEnergyKwh,
  seasonImpact,
  zoneFactor,
} from './waterModel';
import { solarWindowForDate } from './solarWindow';
import { generateZones, polygonAreaHa } from './geo';
import cropsJson from '../data/crops.json';
import fieldsJson from '../data/fields.json';
import assumptions from '../data/assumptions.json';
import type { Assumptions, Crop, Field, Weather } from './types';

const A = assumptions as Assumptions;
const paddy = (cropsJson.crops as Crop[]).find((c) => c.id === 'paddy')!;
const field = (fieldsJson.fields as unknown as Field[])[0];

function weather(days: { rain: number; et0?: number; tmax?: number }[]): Weather {
  const time: string[] = [];
  const sw: number[] = [];
  const daily = days.map((d, i) => {
    const date = `2026-07-${String(i + 1).padStart(2, '0')}`;
    for (let h = 0; h < 24; h++) {
      time.push(`${date}T${String(h).padStart(2, '0')}:00`);
      sw.push(h >= 10 && h < 15 ? 700 : 100);
    }
    return { date, et0_mm: d.et0 ?? 5, rain_mm: d.rain, temp_max_c: d.tmax ?? 33, temp_min_c: 24 };
  });
  return { source: 'sample', fetched_at: '', lat: 0, lng: 0, daily, hourly: { time, shortwave_radiation_wm2: sw } };
}

describe('water model', () => {
  it('ignores light rain and counts 80% of real rain', () => {
    expect(effectiveRain(2, A)).toBe(0);
    expect(effectiveRain(10, A)).toBeCloseTo(8);
    expect(netRequirementMm(5, 1.2, 10, A)).toBe(0);
    expect(netRequirementMm(5, 1.2, 0, A)).toBeCloseTo(6);
  });

  it('applies zone factors', () => {
    expect(zoneFactor('critical', A)).toBe(1.25);
    expect(zoneFactor('healthy', A)).toBe(0.8);
    expect(zoneFactor('waterlogged', A)).toBe(0);
  });

  it('computes pump energy with the hydraulic formula', () => {
    // 10 m3 lifted 30 m at 55% efficiency = 10*1000*9.81*30 / (3.6e6*0.55) kWh
    expect(pumpEnergyKwh(10_000, A)).toBeCloseTo(1.4864, 3);
  });

  it('interpolates Kc through FAO-56 stages', () => {
    expect(kcForDay(paddy, -1)).toBeNull();
    expect(kcForDay(paddy, 0)?.stage).toBe('initial');
    expect(kcForDay(paddy, 40)?.stage).toBe('development');
    expect(kcForDay(paddy, 60)?.kc).toBeCloseTo(1.2);
    expect(kcForDay(paddy, 120)).toBeNull();
  });

  it('skips irrigation on rainy days and waterlogged zones, and starts in the solar window', () => {
    const plan = buildPlan({
      crop: paddy,
      field,
      sowingDate: '2026-05-20',
      pump: { type: 'solar', power_kw: 3.7 },
      weather: weather([{ rain: 0 }, { rain: 12 }]),
      assumptions: A,
    });
    const [dry, wet] = plan.days;
    expect(wet.cells.every((c) => c.action === 'skip' && c.reason_key === 'rain')).toBe(true);
    const waterlogged = field.zones.find((z) => z.label === 'waterlogged')!;
    expect(dry.cells.find((c) => c.zone_id === waterlogged.zone_id)?.reason_key).toBe('waterlogged');
    const first = dry.cells.find((c) => c.action === 'irrigate')!;
    expect(first.start_time).toBe('10:00');
    const critical = field.zones.find((z) => z.label === 'critical')!;
    const healthy = field.zones.find((z) => z.label === 'healthy')!;
    const perHa = (id: string, ha: number) => dry.cells.find((c) => c.zone_id === id)!.litres / ha;
    expect(perHa(critical.zone_id, critical.area_ha) / perHa(healthy.zone_id, healthy.area_ha)).toBeCloseTo(1.25 / 0.8);
  });

  it('stops irrigating before harvest', () => {
    const plan = buildPlan({
      crop: paddy,
      field,
      sowingDate: '2026-03-10', // day 113 on 2026-07-01, inside the 10-day stop window
      pump: { type: 'grid', power_kw: 3.7 },
      weather: weather([{ rain: 0 }]),
      assumptions: A,
    });
    expect(plan.days[0].cells.every((c) => c.reason_key === 'pre_harvest')).toBe(true);
  });

  it('precision uses less water and energy than drip, and drip less than flood', () => {
    const imp = seasonImpact({ crop: paddy, zones: field.zones, sowingDate: '2026-06-15', pump: { type: 'grid', power_kw: 3.7 }, assumptions: A });
    const { flood, drip, precision } = imp.methods;
    expect(drip.litres_per_ha).toBeLessThan(flood.litres_per_ha);
    expect(precision.litres_per_ha).toBeLessThan(drip.litres_per_ha);
    expect(precision.cost_inr_per_ha).toBeLessThan(flood.cost_inr_per_ha);
  });
});

describe('solar window and zoning', () => {
  it('finds the longest run above the threshold', () => {
    const w = weather([{ rain: 0 }]);
    expect(solarWindowForDate(w.hourly, '2026-07-01', 400)).toEqual({ start: '10:00', end: '15:00', hours: 5 });
    expect(solarWindowForDate(w.hourly, '2026-07-01', 900)).toBeNull();
  });

  it('generated zones cover the field area', () => {
    const zones = generateZones(field.polygon, { seed: 3, mix: [{ label: 'critical', share: 0.3 }, { label: 'healthy', share: 0.7 }] });
    const sum = zones.reduce((s, z) => s + z.area_ha, 0);
    expect(sum).toBeCloseTo(polygonAreaHa(field.polygon), 2);
  });
});
