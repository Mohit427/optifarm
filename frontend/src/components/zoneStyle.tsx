import { AlertTriangle, CheckCircle2, Droplets, Waves } from 'lucide-react';
import type { ZoneLabel } from '../lib/types';

/** Colour + pattern + icon for each zone class, so meaning never relies on colour alone. */
// eslint-disable-next-line react-refresh/only-export-components
export const ZONE_STYLE: Record<
  ZoneLabel,
  { color: string; soft: string; text: string; Icon: typeof AlertTriangle; glyph: string }
> = {
  critical: { color: '#EF4444', soft: '#FEE2E2', text: '#991B1B', Icon: AlertTriangle, glyph: '!' },
  moderate: { color: '#F59E0B', soft: '#FEF3C7', text: '#92400E', Icon: Droplets, glyph: '~' },
  healthy: { color: '#16A34A', soft: '#DCFCE7', text: '#14532D', Icon: CheckCircle2, glyph: '✓' },
  waterlogged: { color: '#0EA5E9', soft: '#E0F2FE', text: '#075985', Icon: Waves, glyph: '≈' },
};

/** Hidden SVG <defs> with the hatch patterns used by map polygons and legend swatches. */
export function ZonePatterns() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <pattern id="pat-critical" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="#EF4444" fillOpacity="0.45" />
          <rect width="4" height="10" fill="#B91C1C" fillOpacity="0.55" />
        </pattern>
        <pattern id="pat-moderate" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#F59E0B" fillOpacity="0.45" />
          <circle cx="5" cy="5" r="2" fill="#92400E" fillOpacity="0.55" />
        </pattern>
        <pattern id="pat-healthy" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#22C55E" fillOpacity="0.35" />
        </pattern>
        <pattern id="pat-waterlogged" width="14" height="8" patternUnits="userSpaceOnUse">
          <rect width="14" height="8" fill="#0EA5E9" fillOpacity="0.45" />
          <path d="M0 4 Q3.5 1 7 4 T14 4" stroke="#075985" strokeOpacity="0.7" fill="none" strokeWidth="1.3" />
        </pattern>
      </defs>
    </svg>
  );
}

export function ZoneSwatch({ label, size = 28 }: { label: ZoneLabel; size?: number }) {
  const s = ZONE_STYLE[label];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="26" height="26" rx="6" fill={`url(#pat-${label})`} stroke={s.color} strokeWidth="2" />
      <text x="14" y="19" textAnchor="middle" fontSize="14" fontWeight="800" fill={s.text}>
        {s.glyph}
      </text>
    </svg>
  );
}
