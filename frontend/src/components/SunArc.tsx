import { motion } from 'framer-motion';
import { toMinutes } from '../lib/solarWindow';

interface Props {
  profile: number[]; // 24 hourly W/m2 values
  threshold: number;
  window: { start: string; end: string } | null;
  runs: { start: string; minutes: number; label: string }[];
  title: string;
}

const W = 480;
const H = 210;
const X0 = 24;
const X1 = W - 24;
const BASE = 150;
const hx = (h: number) => X0 + ((X1 - X0) * h) / 24;

/**
 * Sun arc over a 24-hour strip: hourly radiation bars, the >= threshold solar window
 * (shaded), and the scheduled pump runs (blue) so farmers see "pump when the sun is up".
 */
export function SunArc({ profile, threshold, window, runs, title }: Props) {
  const max = Math.max(1000, ...profile);
  const barH = (v: number) => (v / max) * 90;
  const ws = window ? toMinutes(window.start) / 60 : null;
  const we = window ? toMinutes(window.end) / 60 : null;

  // Arc from sunrise (6) to sunset (18) peaking above noon.
  const arc = `M ${hx(6)} ${BASE} Q ${hx(12)} ${BASE - 250} ${hx(18)} ${BASE}`;
  const thresholdY = BASE - barH(threshold);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
      {ws !== null && we !== null && (
        <rect x={hx(ws)} y={20} width={hx(we) - hx(ws)} height={BASE - 20} fill="#FACC15" opacity="0.18" rx="6" />
      )}
      <path d={arc} fill="none" stroke="#FACC15" strokeWidth="3" strokeDasharray="5 5" />
      <motion.circle
        cx={hx(12)}
        cy={BASE - 125}
        r="14"
        fill="#FACC15"
        stroke="#A16207"
        strokeWidth="2"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      {profile.map((v, h) => (
        <rect
          key={h}
          x={hx(h) + 2}
          y={BASE - barH(v)}
          width={(X1 - X0) / 24 - 4}
          height={barH(v)}
          rx="2"
          fill={v >= threshold ? '#F59E0B' : '#FDE68A'}
        />
      ))}
      <line x1={X0} x2={X1} y1={thresholdY} y2={thresholdY} stroke="#A16207" strokeDasharray="3 3" strokeWidth="1" />
      <text x={X1} y={thresholdY - 4} textAnchor="end" fontSize="10" fill="#A16207">
        {threshold} W/m²
      </text>
      <line x1={X0} x2={X1} y1={BASE} y2={BASE} stroke="#14532D" strokeWidth="1.5" />

      {/* pump runs */}
      <rect x={X0} y={BASE + 10} width={X1 - X0} height="16" rx="8" fill="#E2E8F0" />
      {runs.map((r, i) => {
        const s = toMinutes(r.start) / 60;
        const e = Math.min(24, s + r.minutes / 60);
        return (
          <g key={i}>
            <rect x={hx(s)} y={BASE + 10} width={Math.max(3, hx(e) - hx(s))} height="16" rx="4" fill="#0EA5E9" stroke="#fff" strokeWidth="1" />
            <title>{r.label}</title>
          </g>
        );
      })}
      {[0, 6, 12, 18, 24].map((h) => (
        <text key={h} x={hx(h)} y={BASE + 44} textAnchor="middle" fontSize="11" fill="#475569">
          {String(h).padStart(2, '0')}:00
        </text>
      ))}
    </svg>
  );
}
