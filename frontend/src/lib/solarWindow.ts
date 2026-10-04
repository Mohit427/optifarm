export interface SolarWindow {
  start: string; // "HH:00"
  end: string; // "HH:00" (exclusive)
  hours: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Longest contiguous run of hours on `date` whose forecast shortwave radiation is at or
 * above `thresholdWm2`. Returns null when no hour reaches the threshold (overcast day).
 */
export function solarWindowForDate(
  hourly: { time: string[]; shortwave_radiation_wm2: number[] },
  date: string,
  thresholdWm2: number,
): SolarWindow | null {
  const profile = radiationProfile(hourly, date);
  let best: [number, number] | null = null;
  let runStart = -1;
  for (let h = 0; h < 24; h++) {
    if (profile[h] >= thresholdWm2) {
      if (runStart < 0) runStart = h;
      if (!best || h + 1 - runStart > best[1] - best[0]) best = [runStart, h + 1];
    } else {
      runStart = -1;
    }
  }
  if (!best) return null;
  const [s, e] = best;
  return { start: `${pad(s)}:00`, end: `${pad(e)}:00`, hours: e - s };
}

/** Radiation profile for one date (24 values, 0 where missing) for the sun-arc visual. */
export function radiationProfile(
  hourly: { time: string[]; shortwave_radiation_wm2: number[] },
  date: string,
): number[] {
  const out = new Array<number>(24).fill(0);
  hourly.time.forEach((t, i) => {
    if (t.startsWith(date)) out[Number(t.slice(11, 13))] = hourly.shortwave_radiation_wm2[i] ?? 0;
  });
  return out;
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const fromMinutes = (mins: number) => {
  const m = Math.round(mins) % (24 * 60);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** Fraction of [start, start+duration) that falls inside the window. */
export function overlapShare(startMin: number, durationMin: number, w: SolarWindow | null): number {
  if (!w || durationMin <= 0) return 0;
  const ws = toMinutes(w.start);
  const we = toMinutes(w.end);
  const overlap = Math.max(0, Math.min(startMin + durationMin, we) - Math.max(startMin, ws));
  return overlap / durationMin;
}
