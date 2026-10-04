/**
 * Generates the bundled prototype data:
 *   - src/data/fields.json          3 sample Tamil Nadu fields with irregular stress zones
 *   - src/data/weatherFallback.json  7-day sample forecast (re-dated to "today" at runtime)
 *   - public/seeds/*.svg             illustrated seed images for the Seed Lens samples
 *
 * Run with: npm run gen:data  (Node 23.6+ strips TypeScript types natively)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  closeRing,
  generateZones,
  makeProjection,
  polygonAreaHa,
  ringCentroid,
  rng,
} from '../src/lib/geo.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const write = (rel: string, data: string) => {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
  console.log('wrote', rel);
};

// ------------------------------------------------------------------ fields

type XY = [number, number];
interface FieldSpec {
  id: string;
  name: string;
  name_local: { ta: string; hi: string };
  district: string;
  lat: number;
  lng: number;
  shape: XY[]; // metres, local frame
  crop: string;
  seed: number;
  angle: number;
  mix: { label: 'critical' | 'moderate' | 'healthy' | 'waterlogged'; share: number }[];
}

const specs: FieldSpec[] = [
  {
    id: 'thanjavur-delta',
    name: 'Delta paddy plot, Thanjavur',
    name_local: { ta: 'டெல்டா நெல் வயல், தஞ்சாவூர்', hi: 'डेल्टा धान खेत, तंजावुर' },
    district: 'Thanjavur',
    lat: 10.8034,
    lng: 79.2101,
    shape: [
      [-72, -40], [-20, -52], [38, -47], [74, -36], [70, 6], [76, 44],
      [24, 50], [-30, 46], [-68, 38], [-77, -2],
    ],
    crop: 'paddy',
    seed: 11,
    angle: 0.6,
    mix: [
      { label: 'critical', share: 0.18 },
      { label: 'moderate', share: 0.3 },
      { label: 'healthy', share: 0.4 },
      { label: 'waterlogged', share: 0.12 },
    ],
  },
  {
    id: 'pollachi-uplands',
    name: 'Coconut-belt vegetable farm, Pollachi',
    name_local: { ta: 'காய்கறி தோட்டம், பொள்ளாச்சி', hi: 'सब्ज़ी खेत, पोल्लाची' },
    district: 'Coimbatore',
    lat: 10.6312,
    lng: 77.0384,
    shape: [
      [-88, -58], [-30, -66], [40, -62], [86, -50], [92, -4], [84, 52],
      [30, 64], [-28, 60], [-80, 56], [-94, 10],
    ],
    crop: 'tomato',
    seed: 23,
    angle: 2.4,
    mix: [
      { label: 'critical', share: 0.24 },
      { label: 'moderate', share: 0.36 },
      { label: 'healthy', share: 0.4 },
    ],
  },
  {
    id: 'kovilpatti-blacksoil',
    name: 'Black-soil chilli field, Kovilpatti',
    name_local: { ta: 'கரிசல் மிளகாய் வயல், கோவில்பட்டி', hi: 'काली मिट्टी मिर्च खेत, कोविलपट्टी' },
    district: 'Thoothukudi',
    lat: 9.1915,
    lng: 77.8496,
    shape: [
      [-56, -34], [-4, -42], [52, -37], [58, 4], [50, 36], [2, 42], [-50, 36], [-60, 2],
    ],
    crop: 'chilli',
    seed: 37,
    angle: 4.1,
    mix: [
      { label: 'critical', share: 0.32 },
      { label: 'moderate', share: 0.33 },
      { label: 'healthy', share: 0.35 },
    ],
  },
];

const fields = specs.map((s) => {
  const proj = makeProjection(s.lat, s.lng);
  const jitter = rng(s.seed * 7);
  const ring = closeRing(
    s.shape.map(([x, y]) => proj.toLngLat([x + (jitter() - 0.5) * 6, y + (jitter() - 0.5) * 6])),
  );
  const polygon = { type: 'Polygon' as const, coordinates: [ring] };
  const zones = generateZones(polygon, { seed: s.seed, sites: 11, mix: s.mix, gradientAngle: s.angle });
  const c = ringCentroid(ring);
  return {
    id: s.id,
    name: s.name,
    name_local: s.name_local,
    district: s.district,
    centroid: { lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) },
    polygon,
    area_ha: +polygonAreaHa(polygon).toFixed(2),
    suggested_crop_id: s.crop,
    zone_source: 'sample',
    zones,
  };
});

write(
  'src/data/fields.json',
  JSON.stringify(
    {
      _meta: {
        note: 'Sample fields with pre-computed zones standing in for Sentinel-2 (10 m) NDVI/NDMI classification. Synthetic data for the prototype.',
      },
      fields,
    },
    null,
    1,
  ),
);

// ------------------------------------------------------------------ weather fallback

const base = new Date(Date.UTC(2026, 0, 1));
const dailySpec = [
  { et0: 4.6, rain: 0, tmax: 33.5, tmin: 23.8, cloud: 0.05 },
  { et0: 4.9, rain: 0.4, tmax: 34.6, tmin: 24.1, cloud: 0.1 },
  { et0: 3.1, rain: 14.2, tmax: 30.2, tmin: 23.4, cloud: 0.55 },
  { et0: 3.8, rain: 2.6, tmax: 31.4, tmin: 23.0, cloud: 0.3 },
  { et0: 5.0, rain: 0, tmax: 35.8, tmin: 24.6, cloud: 0.05 },
  { et0: 5.4, rain: 0, tmax: 38.9, tmin: 26.2, cloud: 0.0 },
  { et0: 5.2, rain: 0, tmax: 37.1, tmin: 25.5, cloud: 0.08 },
];
const time: string[] = [];
const sw: number[] = [];
const daily = dailySpec.map((d, i) => {
  const date = new Date(base.getTime() + i * 86_400_000).toISOString().slice(0, 10);
  for (let h = 0; h < 24; h++) {
    time.push(`${date}T${String(h).padStart(2, '0')}:00`);
    const sun = Math.max(0, Math.sin(((h + 0.5 - 6.2) / 12.2) * Math.PI));
    sw.push(Math.round(900 * sun * (1 - d.cloud)));
  }
  return { date, et0_mm: d.et0, rain_mm: d.rain, temp_max_c: d.tmax, temp_min_c: d.tmin };
});
write(
  'src/data/weatherFallback.json',
  JSON.stringify(
    {
      source: 'sample',
      fetched_at: '2026-01-01T00:00:00Z',
      lat: 10.8,
      lng: 79.2,
      daily,
      hourly: { time, shortwave_radiation_wm2: sw },
    },
    null,
    1,
  ),
);

// ------------------------------------------------------------------ seed illustrations

type Shape = (r: () => number) => string;
interface SeedArt {
  bg: [string, string];
  count: number;
  scale: number;
  shape: Shape;
}

const art: Record<string, SeedArt> = {
  paddy: {
    bg: ['#F3EBD8', '#E2D3B0'],
    count: 26,
    scale: 1,
    shape: () =>
      `<ellipse rx="9" ry="27" fill="#D6A53A"/><ellipse rx="5" ry="22" fill="#E8C468" opacity=".7"/>` +
      `<path d="M0-27V27M-5-20Q-7 0-5 20M5-20Q7 0 5 20" stroke="#A97B22" stroke-width="1" fill="none"/>` +
      `<path d="M0-27l-2-6 4 0z" fill="#8C6418"/>`,
  },
  groundnut: {
    bg: ['#F1E8DA', '#DCCBB1'],
    count: 16,
    scale: 1,
    shape: (r) =>
      `<ellipse rx="17" ry="24" fill="${r() > 0.5 ? '#C2614D' : '#B5574A'}"/>` +
      `<ellipse rx="10" ry="15" cx="-4" cy="-5" fill="#E08C72" opacity=".55"/>` +
      `<path d="M-12 14Q0 20 12 14" stroke="#8E3F33" stroke-width="1.2" fill="none" opacity=".5"/>`,
  },
  maize: {
    bg: ['#EFE7D6', '#D9C7A2'],
    count: 20,
    scale: 1,
    shape: () =>
      `<path d="M-15-18Q0-24 15-18L10 22Q0 28-10 22Z" fill="#EFAE2E"/>` +
      `<path d="M-12-16Q0-21 12-16L10-6Q0-9-10-6Z" fill="#F8D57A"/>` +
      `<ellipse cx="0" cy="10" rx="4" ry="7" fill="#F6CD6A" opacity=".8"/>`,
  },
  tomato: {
    bg: ['#EEF0E4', '#D6DAC2'],
    count: 34,
    scale: 0.9,
    shape: () =>
      `<path d="M-10 0A10 9 0 1 1 8 6Q2 2 0 8Q-8 8-10 0Z" fill="#E6D3A0" stroke="#C9B57E" stroke-width="2" stroke-dasharray="1 2"/>` +
      `<circle r="3" cx="-2" cy="-1" fill="#F4E6BE"/>`,
  },
  chilli: {
    bg: ['#F4EDE2', '#E1D2BC'],
    count: 30,
    scale: 1,
    shape: () =>
      `<path d="M-12 0A12 11 0 1 1 9 7Q3 3 1 10Q-10 10-12 0Z" fill="#EBCB78" stroke="#C9A24D" stroke-width="2"/>` +
      `<ellipse rx="5" ry="4" cx="-2" cy="-2" fill="#F5DF9E"/>`,
  },
  ragi: {
    bg: ['#EFE9DD', '#D8CCB6'],
    count: 140,
    scale: 1,
    shape: (r) =>
      `<circle r="${4.2 + r() * 1.2}" fill="${r() > 0.5 ? '#9A4A2C' : '#8A3F25'}"/><circle r="1.4" cx="-1.3" cy="-1.3" fill="#C27556" opacity=".7"/>`,
  },
  cotton: {
    bg: ['#E7ECE6', '#C9D3C8'],
    count: 14,
    scale: 1,
    shape: () =>
      `<ellipse rx="17" ry="23" fill="#F7F5EF" stroke="#E2DED2" stroke-width="5" stroke-dasharray="2 3"/>` +
      `<ellipse rx="8" ry="12" fill="#5C4334" opacity=".55"/><ellipse rx="12" ry="17" fill="#FFFFFF" opacity=".55"/>`,
  },
  sugarcane: {
    bg: ['#EEF1E2', '#D2D9B9'],
    count: 3,
    scale: 1,
    shape: () =>
      `<rect x="-14" y="-110" width="28" height="220" rx="10" fill="#B5A05C"/>` +
      `<rect x="-14" y="-110" width="10" height="220" rx="5" fill="#D1BF7A" opacity=".6"/>` +
      `<g fill="#7E6A2E">${[-55, 0, 55].map((y) => `<rect x="-16" y="${y - 4}" width="32" height="8" rx="3"/><ellipse cx="9" cy="${y - 12}" rx="5" ry="7" fill="#8E7B3A"/>`).join('')}</g>`,
  },
  brinjal: {
    bg: ['#EFEBE3', '#D6CDBD'],
    count: 34,
    scale: 0.95,
    shape: () =>
      `<path d="M-10 0A10 9 0 1 1 8 6Q2 2 0 8Q-8 8-10 0Z" fill="#B98852"/>` +
      `<ellipse rx="4" ry="3" cx="-2" cy="-2" fill="#D3A979" opacity=".8"/>`,
  },
  blackgram: {
    bg: ['#EEEAE2', '#D3CCBE'],
    count: 40,
    scale: 1,
    shape: () =>
      `<ellipse rx="10" ry="13" fill="#1F1C1B"/><ellipse rx="4" ry="5" cx="-3" cy="-4" fill="#4A4542" opacity=".6"/>` +
      `<rect x="6" y="-6" width="3" height="11" rx="1.5" fill="#F4F1EA"/>`,
  },
};

for (const [id, a] of Object.entries(art)) {
  const r = rng(id.length * 131 + id.charCodeAt(0));
  const items: string[] = [];
  for (let i = 0; i < a.count; i++) {
    // Denser towards the centre so the overlay's "seed" sits mid-frame.
    const ang = r() * Math.PI * 2;
    const rad = Math.sqrt(r()) * (id === 'sugarcane' ? 70 : 150);
    const x = 200 + Math.cos(ang) * rad;
    const y = 200 + Math.sin(ang) * rad;
    const rot = Math.round(r() * 360);
    const s = a.scale * (0.85 + r() * 0.3);
    items.push(
      `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot}) scale(${s.toFixed(2)})" filter="url(#sh)">${a.shape(r)}</g>`,
    );
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">` +
    `<defs><radialGradient id="bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${a.bg[0]}"/><stop offset="1" stop-color="${a.bg[1]}"/></radialGradient>` +
    `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.8" flood-color="#3b2f1e" flood-opacity=".35"/></filter>` +
    `<pattern id="tx" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" stroke="#000" stroke-opacity=".035"/></pattern></defs>` +
    `<rect width="400" height="400" fill="url(#bg)"/><rect width="400" height="400" fill="url(#tx)"/>` +
    items.join('') +
    `</svg>`;
  write(`public/seeds/${id}.svg`, svg);
}
