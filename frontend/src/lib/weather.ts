import fallback from '../data/weatherFallback.json';
import type { Weather } from './types';
import { storage } from './storage';
import { addDays, todayIso } from './data';
import { apiGet } from './api';

const CACHE_KEY = 'kl.weather';

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  daily: {
    time: string[];
    et0_fao_evapotranspiration: (number | null)[];
    precipitation_sum: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
  };
  hourly: { time: string[]; shortwave_radiation: (number | null)[] };
}

export const OPEN_METEO_URL = (lat: number, lng: number) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
  '&daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min' +
  '&hourly=shortwave_radiation&timezone=Asia%2FKolkata&forecast_days=7';

export function normaliseOpenMeteo(r: OpenMeteoResponse): Weather {
  return {
    source: 'live',
    fetched_at: new Date().toISOString(),
    lat: r.latitude,
    lng: r.longitude,
    daily: r.daily.time.map((date, i) => ({
      date,
      et0_mm: r.daily.et0_fao_evapotranspiration[i] ?? 0,
      rain_mm: r.daily.precipitation_sum[i] ?? 0,
      temp_max_c: r.daily.temperature_2m_max[i] ?? 0,
      temp_min_c: r.daily.temperature_2m_min[i] ?? 0,
    })),
    hourly: {
      time: r.hourly.time,
      shortwave_radiation_wm2: r.hourly.shortwave_radiation.map((v) => v ?? 0),
    },
  };
}

/** The bundled sample forecast, shifted so its first day is today. */
export function sampleWeather(lat: number, lng: number): Weather {
  const base = fallback as Weather;
  const today = todayIso();
  const map = new Map(base.daily.map((d, i) => [d.date, addDays(today, i)]));
  return {
    ...base,
    source: 'sample',
    lat,
    lng,
    daily: base.daily.map((d) => ({ ...d, date: map.get(d.date)! })),
    hourly: {
      time: base.hourly.time.map((t) => `${map.get(t.slice(0, 10))}${t.slice(10)}`),
      shortwave_radiation_wm2: base.hourly.shortwave_radiation_wm2,
    },
  };
}

/** Drop days before today from a cached forecast. */
function trimToToday(w: Weather): Weather {
  const today = todayIso();
  return {
    ...w,
    daily: w.daily.filter((d) => d.date >= today),
    hourly: {
      time: w.hourly.time.filter((t) => t.slice(0, 10) >= today),
      shortwave_radiation_wm2: w.hourly.shortwave_radiation_wm2.filter(
        (_, i) => w.hourly.time[i].slice(0, 10) >= today,
      ),
    },
  };
}

async function fetchDirect(lat: number, lng: number): Promise<Weather> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(OPEN_METEO_URL(lat, lng), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    return normaliseOpenMeteo((await res.json()) as OpenMeteoResponse);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Forecast with graceful degradation:
 * backend proxy -> Open-Meteo directly -> last cached forecast -> bundled sample.
 */
export async function loadWeather(lat: number, lng: number): Promise<Weather> {
  if (navigator.onLine) {
    try {
      const w = await apiGet<Weather>(`/weather?lat=${lat}&lng=${lng}`, 9000);
      if (w.source === 'live') {
        storage.set(CACHE_KEY, w);
        return w;
      }
      // Backend served its own cache/sample; still try the browser's own route first.
    } catch {
      /* fall through */
    }
    try {
      const w = await fetchDirect(lat, lng);
      storage.set(CACHE_KEY, w);
      return w;
    } catch {
      /* fall through */
    }
  }
  const cached = storage.get<Weather>(CACHE_KEY);
  if (cached) {
    const trimmed = trimToToday(cached);
    const nearby = Math.abs(cached.lat - lat) < 1 && Math.abs(cached.lng - lng) < 1;
    if (trimmed.daily.length >= 3 && nearby) return { ...trimmed, source: 'cached' };
  }
  return sampleWeather(lat, lng);
}
