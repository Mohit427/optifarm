/**
 * Small, dependency-free geometry helpers for field polygons (GeoJSON [lng, lat] order).
 * Also used by scripts/gen-data.ts to pre-compute the sample fields, so keep it free of
 * runtime imports.
 */
import type { MultiPolygonGeom, PolygonGeom, Ring, Zone, ZoneLabel } from './types';

type XY = [number, number];

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG_EQ = 111_320;

/** Local equirectangular projection around a reference latitude/longitude (metres). */
export function makeProjection(lat0: number, lng0: number) {
  const kx = Math.cos((lat0 * Math.PI) / 180) * M_PER_DEG_LNG_EQ;
  return {
    toXY: ([lng, lat]: [number, number]): XY => [(lng - lng0) * kx, (lat - lat0) * M_PER_DEG_LAT],
    toLngLat: ([x, y]: XY): [number, number] => [
      +(lng0 + x / kx).toFixed(7),
      +(lat0 + y / M_PER_DEG_LAT).toFixed(7),
    ],
  };
}

const openRing = (ring: Ring): Ring =>
  ring.length > 1 &&
  ring[0][0] === ring[ring.length - 1][0] &&
  ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;

export const closeRing = (ring: Ring): Ring => {
  const r = openRing(ring);
  return r.length ? [...r, r[0]] : r;
};

function shoelace(pts: XY[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function ringCentroid(ring: Ring): { lat: number; lng: number } {
  const r = openRing(ring);
  const lng = r.reduce((s, p) => s + p[0], 0) / r.length;
  const lat = r.reduce((s, p) => s + p[1], 0) / r.length;
  return { lat, lng };
}

export function ringAreaM2(ring: Ring): number {
  const r = openRing(ring);
  if (r.length < 3) return 0;
  const c = ringCentroid(r);
  const proj = makeProjection(c.lat, c.lng);
  return Math.abs(shoelace(r.map(proj.toXY)));
}

export const polygonAreaHa = (p: PolygonGeom) => ringAreaM2(p.coordinates[0]) / 10_000;

export const multiPolygonAreaHa = (mp: MultiPolygonGeom) =>
  mp.coordinates.reduce((s, poly) => s + ringAreaM2(poly[0]), 0) / 10_000;

export function pointInRing([x, y]: XY, pts: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Sutherland-Hodgman clip of `pts` against the half-plane a*x + b*y <= c. */
function clipHalfPlane(pts: XY[], a: number, b: number, c: number): XY[] {
  const out: XY[] = [];
  const inside = (p: XY) => a * p[0] + b * p[1] <= c;
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const prev = pts[(i + pts.length - 1) % pts.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn !== prevIn) {
      const dPrev = a * prev[0] + b * prev[1] - c;
      const dCur = a * cur[0] + b * cur[1] - c;
      const t = dPrev / (dPrev - dCur);
      out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
    }
    if (curIn) out.push(cur);
  }
  return out;
}

/** Part of `subject` closer to sites[i] than to any other site (a clipped Voronoi cell). */
function voronoiCell(subject: XY[], sites: XY[], i: number): XY[] {
  let cell = subject;
  const [xi, yi] = sites[i];
  sites.forEach(([xj, yj], j) => {
    if (j === i || cell.length < 3) return;
    cell = clipHalfPlane(cell, xj - xi, yj - yi, (xj * xj + yj * yj - xi * xi - yi * yi) / 2);
  });
  return cell;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashCoords(ring: Ring): number {
  let h = 2166136261;
  for (const [x, y] of ring) {
    for (const v of [x, y]) {
      h ^= Math.round(v * 1e6);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

const ZONE_METRICS: Record<ZoneLabel, { stress: [number, number]; moisture: [number, number]; ndvi: [number, number] }> = {
  critical: { stress: [0.74, 0.9], moisture: [0.12, 0.24], ndvi: [0.24, 0.36] },
  moderate: { stress: [0.45, 0.6], moisture: [0.3, 0.42], ndvi: [0.45, 0.56] },
  healthy: { stress: [0.1, 0.24], moisture: [0.45, 0.58], ndvi: [0.64, 0.76] },
  waterlogged: { stress: [0.55, 0.66], moisture: [0.86, 0.96], ndvi: [0.34, 0.44] },
};

export interface ZoningOptions {
  seed: number;
  /** Share of the field per label, in "stress gradient" order (most stressed first). */
  mix: { label: ZoneLabel; share: number }[];
  /** Number of Voronoi sites; more sites give more irregular zone outlines. */
  sites?: number;
  /** Direction (radians) along which stress increases, mimicking slope / canal distance. */
  gradientAngle?: number;
}

const round = (v: number, d = 2) => +v.toFixed(d);

/**
 * Split a field polygon into labelled stress zones. Each zone is a union of clipped
 * Voronoi cells, assigned by sorting the cells along a noisy stress gradient, so zones
 * are spatially coherent but irregular, like real NDVI/NDMI classes.
 */
export function generateZones(field: PolygonGeom, opts: ZoningOptions): Zone[] {
  const ring = openRing(field.coordinates[0]);
  const c = ringCentroid(ring);
  const proj = makeProjection(c.lat, c.lng);
  const pts = ring.map(proj.toXY);
  if (shoelace(pts) < 0) pts.reverse();
  const rand = rng(opts.seed);

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const nSites = opts.sites ?? 9;
  const sites: XY[] = [];
  for (let tries = 0; sites.length < nSites && tries < 2000; tries++) {
    const p: XY = [minX + rand() * (maxX - minX), minY + rand() * (maxY - minY)];
    if (pointInRing(p, pts)) sites.push(p);
  }

  const angle = opts.gradientAngle ?? rand() * Math.PI * 2;
  const cells = sites
    .map((_, i) => voronoiCell(pts, sites, i))
    .filter((cell) => cell.length >= 3)
    .map((cell) => {
      const cx = cell.reduce((s, p) => s + p[0], 0) / cell.length;
      const cy = cell.reduce((s, p) => s + p[1], 0) / cell.length;
      const span = Math.max(maxX - minX, maxY - minY) || 1;
      const score = (cx * Math.cos(angle) + cy * Math.sin(angle)) / span + (rand() - 0.5) * 0.35;
      return { cell, area: Math.abs(shoelace(cell)), score };
    })
    .sort((a, b) => b.score - a.score);

  const total = cells.reduce((s, x) => s + x.area, 0);
  const totalShare = opts.mix.reduce((s, m) => s + m.share, 0);
  const groups: { label: ZoneLabel; cells: XY[][] }[] = opts.mix.map((m) => ({ label: m.label, cells: [] }));
  let acc = 0;
  let g = 0;
  for (const cell of cells) {
    const target = (opts.mix.slice(0, g + 1).reduce((s, m) => s + m.share, 0) / totalShare) * total;
    if (acc + cell.area / 2 > target && g < groups.length - 1) g++;
    groups[g].cells.push(cell.cell);
    acc += cell.area;
  }
  // Every requested zone must exist: steal the last cell of the largest group if empty.
  for (const grp of groups) {
    if (grp.cells.length) continue;
    const donor = groups.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
    if (donor.cells.length > 1) grp.cells.push(donor.cells.pop()!);
  }

  return groups
    .filter((grp) => grp.cells.length)
    .map((grp, idx) => {
      const polygon: MultiPolygonGeom = {
        type: 'MultiPolygon',
        coordinates: grp.cells.map((cell) => [closeRing(cell.map(proj.toLngLat))]),
      };
      const m = ZONE_METRICS[grp.label];
      const pick = ([lo, hi]: [number, number]) => round(lo + rand() * (hi - lo));
      return {
        zone_id: `Z${idx + 1}`,
        label: grp.label,
        polygon,
        area_ha: round(multiPolygonAreaHa(polygon), 3),
        stress_score: pick(m.stress),
        moisture_index: pick(m.moisture),
        ndvi: pick(m.ndvi),
        recommended_action_key: grp.label,
      };
    });
}

/** Default zoning for a farmer-drawn field (simulated, clearly labelled in the UI). */
export function simulateZones(field: PolygonGeom): Zone[] {
  const seed = hashCoords(field.coordinates[0]);
  return generateZones(field, {
    seed,
    sites: 8,
    mix: [
      { label: 'critical', share: 0.22 },
      { label: 'moderate', share: 0.33 },
      { label: 'healthy', share: 0.45 },
    ],
  });
}

/** Approximate square plot (side in metres) around a dropped pin. */
export function squareAround(lat: number, lng: number, sideM = 70): PolygonGeom {
  const proj = makeProjection(lat, lng);
  const h = sideM / 2;
  const ring: Ring = (
    [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ] as XY[]
  ).map(proj.toLngLat);
  return { type: 'Polygon', coordinates: [closeRing(ring)] };
}
