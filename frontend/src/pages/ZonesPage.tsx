import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Satellite } from 'lucide-react';
import { useApp } from '../state/AppState';
import { fmt } from '../lib/data';
import { zonesByPriority } from '../lib/waterModel';
import type { Zone, ZoneLabel } from '../lib/types';
import { ZONE_STYLE, ZoneSwatch } from '../components/zoneStyle';
import { SpeakButton } from '../components/SpeakButton';
import { NeedSetup } from '../components/NeedSetup';

const FieldMap = lazy(() => import('../components/FieldMap'));

const ACTION_KEY: Record<ZoneLabel, string> = {
  critical: 'zones.actionCritical',
  moderate: 'zones.actionModerate',
  healthy: 'zones.actionHealthy',
  waterlogged: 'zones.actionWaterlogged',
};

function Meter({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>{fmt(value, 2)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} aria-label={label}>
        <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export default function ZonesPage() {
  const { t } = useTranslation();
  const { field } = useApp();
  const [selected, setSelected] = useState<string | null>(null);

  if (!field) return <NeedSetup message={t('zones.needField')} to="/app/field" cta={t('zones.goField')} />;

  const indexOf = (z: Zone) => field.zones.findIndex((x) => x.zone_id === z.zone_id) + 1;
  const name = (z: Zone) => t('zones.zoneName', { n: indexOf(z) });
  const ranked = zonesByPriority(field.zones);
  const labelsPresent = (['critical', 'moderate', 'healthy', 'waterlogged'] as ZoneLabel[]).filter((l) =>
    field.zones.some((z) => z.label === l),
  );
  const speech = ranked
    .map((z) => `${name(z)}, ${t(`zones.${z.label}`)}. ${t(ACTION_KEY[z.label])}`)
    .join(' ');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{t('zones.title')}</h1>
          <p className="muted mt-1">{t('zones.subtitle')}</p>
        </div>
        <SpeakButton text={speech} id="zones-all" label={t('zones.readZones')} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <Suspense fallback={<div className="h-[440px] animate-pulse rounded-2xl bg-green-100" />}>
            <FieldMap
              field={field}
              showZones
              selectedZoneId={selected}
              onSelectZone={setSelected}
              zoneName={(z) => name(z)}
              className="h-[440px]"
            />
          </Suspense>

          <div className="card p-4" aria-labelledby="legend-title">
            <h2 id="legend-title" className="text-sm font-bold uppercase tracking-wide text-slate-600">
              {t('zones.legend')}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {labelsPresent.map((l) => {
                const Icon = ZONE_STYLE[l].Icon;
                return (
                  <li key={l} className="flex items-center gap-2 font-semibold">
                    <ZoneSwatch label={l} />
                    <Icon className="h-4 w-4" style={{ color: ZONE_STYLE[l].text }} aria-hidden />
                    {t(`zones.${l}`)}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <Satellite className="h-4 w-4 shrink-0" aria-hidden />
              {field.zone_source === 'sample' ? t('zones.sourceSample') : t('zones.sourceSimulated')}
            </p>
          </div>
        </div>

        <section aria-labelledby="priority-title">
          <h2 id="priority-title" className="mb-3 text-xl font-bold">
            {t('zones.priorityTitle')}
          </h2>
          <ol className="space-y-3">
            {ranked.map((z) => {
              const s = ZONE_STYLE[z.label];
              const open = selected === z.zone_id;
              const pct = (z.area_ha / field.area_ha) * 100;
              return (
                <li key={z.zone_id}>
                  <div
                    className={`card overflow-hidden border-2 transition-colors ${open ? 'border-ink-900' : 'border-transparent'}`}
                    style={{ borderLeft: `8px solid ${s.color}` }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(open ? null : z.zone_id)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 p-4 text-left"
                    >
                      <ZoneSwatch label={z.label} size={36} />
                      <span className="flex-1">
                        <span className="block text-lg font-bold text-green-900">
                          {name(z)} • <span style={{ color: s.text }}>{t(`zones.${z.label}`)}</span>
                        </span>
                        <span className="block text-sm text-slate-600">
                          {t('zones.areaPct', { ha: fmt(z.area_ha, 2), pct: fmt(pct) })}
                        </span>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 px-4 pb-4">
                            <Meter value={z.stress_score} color={s.color} label={t('zones.stress')} />
                            <Meter value={z.moisture_index} color="#0EA5E9" label={t('zones.moisture')} />
                            <Meter value={z.ndvi} color="#16A34A" label={t('zones.ndvi')} />
                            <div className="rounded-xl p-3" style={{ background: s.soft }}>
                              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: s.text }}>
                                {t('zones.action')}
                              </p>
                              <p className="mt-1 font-medium">{t(ACTION_KEY[z.label])}</p>
                            </div>
                            <SpeakButton
                              text={`${name(z)}, ${t(`zones.${z.label}`)}. ${t(ACTION_KEY[z.label])}`}
                              id={`zone-${z.zone_id}`}
                              className="w-full"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </li>
              );
            })}
          </ol>
          <Link to="/app/plan" className="btn-primary mt-5 w-full text-lg">
            {t('zones.toPlan')} <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  );
}
