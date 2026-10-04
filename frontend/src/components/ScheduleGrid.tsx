import { useTranslation } from 'react-i18next';
import { CloudRain, Droplets, Ban, Waves, Sprout, Scissors, Thermometer, Sun } from 'lucide-react';
import type { Field, Plan, PlanCell } from '../lib/types';
import { fmt, formatDate } from '../lib/data';
import { zonesByPriority } from '../lib/waterModel';
import { currentLang } from '../i18n';
import { ZONE_STYLE, ZoneSwatch } from './zoneStyle';

const SKIP_ICON: Record<string, typeof Ban> = {
  rain: CloudRain,
  no_need: Ban,
  waterlogged: Waves,
  not_sown: Sprout,
  pre_harvest: Scissors,
  harvested: Scissors,
};

function Cell({ cell }: { cell: PlanCell }) {
  const { t } = useTranslation();
  if (cell.action === 'irrigate') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 rounded-xl bg-water-500/15 p-2 text-center">
        <Droplets className="h-5 w-5 text-water-500" aria-hidden />
        <span className="text-sm font-bold text-sky-900">{cell.start_time}</span>
        <span className="text-xs text-sky-900">
          {cell.duration_min} {t('common.minutes')}
        </span>
        <span className="text-xs font-semibold text-sky-900">{fmt(cell.litres)} L</span>
        {cell.solar_share > 0.5 && <Sun className="h-3.5 w-3.5 text-earth-600" aria-label="solar" />}
        <span className="sr-only">{t('plan.irrigate')}</span>
      </div>
    );
  }
  const Icon = SKIP_ICON[cell.reason_key] ?? Ban;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 p-2 text-center">
      <Icon className="h-5 w-5 text-slate-500" aria-hidden />
      <span className="text-xs font-semibold text-slate-600">{t('plan.skip')}</span>
      <span className="text-[11px] leading-tight text-slate-500">{t(`plan.reason_${cell.reason_key}`)}</span>
    </div>
  );
}

export function ScheduleGrid({ plan, field, threshold }: { plan: Plan; field: Field; threshold: number }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const zones = zonesByPriority(field.zones);
  const zoneIndex = (id: string) => field.zones.findIndex((z) => z.zone_id === id) + 1;

  return (
    <div className="overflow-x-auto rounded-2xl" tabIndex={0} aria-label={t('plan.title')}>
      <table className="w-full min-w-[760px] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">{t('plan.title')}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-white p-2 text-left text-xs uppercase text-slate-500">
              {t('plan.zoneCol')}
            </th>
            {plan.days.map((d, i) => (
              <th key={d.date} scope="col" className={`rounded-xl p-2 align-top ${i === 0 ? 'bg-green-100' : 'bg-green-50'}`}>
                <span className="block font-bold text-green-900">
                  {i === 0 ? t('plan.today') : formatDate(d.date, lang, { weekday: 'short' })}
                </span>
                <span className="block text-xs font-normal text-slate-600">
                  {formatDate(d.date, lang, { day: 'numeric', month: 'short' })}
                </span>
                <span
                  className={`mt-1 flex items-center justify-center gap-1 text-xs font-semibold ${
                    d.rain_mm >= threshold ? 'text-water-500' : 'text-slate-500'
                  }`}
                >
                  <CloudRain className="h-3.5 w-3.5" aria-hidden />
                  {fmt(d.rain_mm, 1)} mm
                </span>
                <span className={`flex items-center justify-center gap-1 text-xs font-semibold ${d.heat_alert ? 'text-danger-500' : 'text-slate-500'}`}>
                  <Thermometer className="h-3.5 w-3.5" aria-hidden />
                  {fmt(d.temp_max_c)}°
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.zone_id}>
              <th scope="row" className="sticky left-0 z-10 bg-white p-2 text-left" style={{ borderLeft: `6px solid ${ZONE_STYLE[z.label].color}` }}>
                <span className="flex items-center gap-2">
                  <ZoneSwatch label={z.label} size={24} />
                  <span>
                    <span className="block font-bold text-green-900">{t('zones.zoneName', { n: zoneIndex(z.zone_id) })}</span>
                    <span className="block text-xs font-normal text-slate-600">{t(`zones.${z.label}`)}</span>
                  </span>
                </span>
              </th>
              {plan.days.map((d) => {
                const cell = d.cells.find((c) => c.zone_id === z.zone_id)!;
                return (
                  <td key={d.date} className="h-28 p-0 align-top">
                    <Cell cell={cell} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
