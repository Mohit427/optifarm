import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  CalendarRange,
  Droplets,
  Hourglass,
  Layers,
  Leaf,
  Ruler,
  Thermometer,
  CloudSun,
  Volume2,
} from 'lucide-react';
import type { Crop } from '../lib/types';
import { cropName, monthName } from '../lib/data';
import { currentLang } from '../i18n';
import { useSpeak } from '../hooks/useSpeak';

// Static class strings so Tailwind can see them: chips 0-3 on the left, 4-7 on the right.
const POS = [
  'sm:col-start-1 sm:row-start-1',
  'sm:col-start-1 sm:row-start-2',
  'sm:col-start-1 sm:row-start-3',
  'sm:col-start-1 sm:row-start-4',
  'sm:col-start-3 sm:row-start-1',
  'sm:col-start-3 sm:row-start-2',
  'sm:col-start-3 sm:row-start-3',
  'sm:col-start-3 sm:row-start-4',
];

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * AR-style annotated card: the seed photo in the centre, with animated leader lines to
 * floating fact chips. Every fact comes from the curated crop record, never the model.
 */
export function SeedOverlay({ crop, imageSrc }: { crop: Crop; imageSrc: string }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const { say, speakingId } = useSpeak();
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const sow = `${monthName(crop.sowing_window.start_month, lang)} – ${monthName(crop.sowing_window.end_month, lang)}`;
  const chips = [
    { Icon: Leaf, label: t('seed.chipName'), value: lang === 'en' ? crop.name_en : `${cropName(crop, lang)} (${crop.name_en})` },
    { Icon: CalendarRange, label: t('seed.chipSowing'), value: sow },
    { Icon: Droplets, label: t('seed.chipWater'), value: t('seed.waterValue', { mm: crop.water_need_mm_total }) },
    { Icon: Hourglass, label: t('seed.chipHarvest'), value: t('seed.harvestValue', { days: crop.duration_days }) },
    { Icon: Ruler, label: t('seed.chipSpacing'), value: t('seed.spacingValue', { row: crop.spacing_cm.row, plant: crop.spacing_cm.plant }) },
    { Icon: CloudSun, label: t('seed.chipSeason'), value: crop.season.map((s) => t(`crops.season_${s}`)).join(', ') },
    { Icon: Layers, label: t('seed.chipSoil'), value: crop.suitable_soils.map((s) => t(`crops.soil_${s}`)).join(', ') },
    { Icon: Thermometer, label: t('seed.chipHeat'), value: t('seed.heatValue', { c: crop.heat_tolerance_max_c }) },
  ];

  // Leader lines are measured from the real layout, so they work for both the mobile
  // (image on top, chips below) and desktop (chips either side) arrangements.
  useLayoutEffect(() => {
    const measure = () => {
      const b = box.current?.getBoundingClientRect();
      const im = img.current?.getBoundingClientRect();
      if (!b || !im) return;
      const cx = im.left + im.width / 2 - b.left;
      const cy = im.top + im.height / 2 - b.top;
      const r = Math.min(im.width, im.height) * 0.3;
      setSize({ w: b.width, h: b.height });
      // Lines only make sense when chips sit beside the seed (tablet/desktop). In the
      // stacked phone layout they would cross other chips, so chips just animate in.
      setLines(
        chipRefs.current.flatMap((el) => {
          if (!el) return [];
          const c = el.getBoundingClientRect();
          const sideBySide = c.right - b.left < cx - im.width / 2 || c.left - b.left > cx + im.width / 2;
          if (!sideBySide) return [];
          const chipCx = c.left + c.width / 2 - b.left;
          const x2 = chipCx < cx ? c.right - b.left : c.left - b.left;
          const y2 = c.top + c.height / 2 - b.top;
          const ang = Math.atan2(y2 - cy, x2 - cx);
          return [{ x1: cx + Math.cos(ang) * r, y1: cy + Math.sin(ang) * r, x2, y2 }];
        }),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [crop.id, lang]);

  const stagger = reduce ? 0 : 0.15;

  return (
    <div ref={box} className="relative">
      <svg className="pointer-events-none absolute inset-0 z-0" width={size.w} height={size.h} aria-hidden>
        {lines.map((l, i) => (
          <g key={`${crop.id}-${i}`}>
            <motion.line
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="#15803D"
              strokeWidth="2"
              strokeDasharray="4 3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ delay: 0.2 + i * stagger, duration: reduce ? 0 : 0.35 }}
            />
            <motion.circle
              cx={l.x1}
              cy={l.y1}
              r="5"
              fill="#FACC15"
              stroke="#14532D"
              strokeWidth="2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15 + i * stagger }}
            />
          </g>
        ))}
      </svg>

      <div className="relative z-10 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,300px)_minmax(0,1fr)] sm:gap-x-12 sm:gap-y-4">
        <div
          ref={img}
          className="mx-auto mb-4 aspect-square w-56 min-[460px]:col-span-2 sm:col-span-1 sm:col-start-2 sm:row-span-4 sm:row-start-1 sm:mb-0 sm:w-full sm:self-center"
        >
          <motion.img
            key={imageSrc}
            src={imageSrc}
            alt={t('seed.overlayAlt')}
            className="h-full w-full rounded-full border-4 border-white object-cover shadow-lift"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
        </div>
        {chips.map(({ Icon, label, value }, i) => {
          const id = `chip-${i}`;
          return (
            <motion.button
              key={`${crop.id}-${label}`}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              type="button"
              onClick={() => say(`${label}: ${value}`, id)}
              aria-pressed={speakingId === id}
              className={`${POS[i]} group flex min-h-tap items-start gap-2 self-center rounded-2xl border-2 bg-white/95 p-2.5 text-left shadow-soft transition-colors hover:border-green-600 sm:p-3 ${
                speakingId === id ? 'border-green-600' : 'border-green-100'
              }`}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3 + i * stagger, duration: 0.3 }}
            >
              <span className="rounded-xl bg-green-100 p-1.5 text-green-700">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                <span className="block break-words text-sm font-bold text-green-900 sm:text-base">{value}</span>
              </span>
              <Volume2 className="mt-1 h-4 w-4 shrink-0 text-green-600 opacity-60 group-hover:opacity-100" aria-hidden />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
