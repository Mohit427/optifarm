import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CloudRain, Droplets, Flame, Sun, Zap, Sprout, Loader2, Radio } from 'lucide-react';
import { useApp } from '../state/AppState';
import { cropName, fmt, formatDate } from '../lib/data';
import { radiationProfile } from '../lib/solarWindow';
import { zonesByPriority } from '../lib/waterModel';
import { currentLang } from '../i18n';
import { ScheduleGrid } from '../components/ScheduleGrid';
import { SunArc } from '../components/SunArc';
import { SpeakButton } from '../components/SpeakButton';
import { NeedSetup } from '../components/NeedSetup';

export default function PlanPage() {
  const { t } = useTranslation();
  const lang = currentLang();
  const { crop, field, plan, weather, weatherLoading, pump, assumptions, setAssumption } = useApp();

  if (!crop || !field) return <NeedSetup message={t('plan.needSetup')} to={crop ? '/app/field' : '/app/seed'} cta={t('common.next')} />;
  if (!plan || !weather) {
    return (
      <p className="card flex items-center gap-2 p-6" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {t('common.loading')}
      </p>
    );
  }

  const today = plan.days[0];
  const zoneIndex = (id: string) => field.zones.findIndex((z) => z.zone_id === id) + 1;
  const heatDays = plan.days.filter((d) => d.heat_alert);
  const todayRuns = today.cells.filter((c) => c.action === 'irrigate');
  const zoneLabelOf = (id: string) => field.zones.find((z) => z.zone_id === id)!.label;

  const speech = [
    t('plan.speechIntro', { crop: cropName(crop, lang) }),
    ...(todayRuns.length === 0
      ? [t('plan.speechNone')]
      : zonesByPriority(field.zones).map((z) => {
          const c = today.cells.find((x) => x.zone_id === z.zone_id)!;
          const zone = t('zones.zoneName', { n: zoneIndex(z.zone_id) });
          return c.action === 'irrigate'
            ? t('plan.speechZone', { zone, start: c.start_time, min: c.duration_min })
            : t('plan.speechSkip', { zone, reason: t(`plan.reason_${c.reason_key}`) });
        })),
    ...(today.heat_alert
      ? [t('plan.heatText', { date: t('plan.today'), t: fmt(today.temp_max_c), crop: cropName(crop, lang), limit: crop.heat_tolerance_max_c })]
      : []),
  ].join(' ');

  const weatherLabel =
    weather.source === 'live' ? t('plan.weatherLive') : weather.source === 'cached' ? t('plan.weatherCached') : t('plan.weatherSample');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{t('plan.title')}</h1>
          <p className="muted mt-1">{t('plan.subtitle')}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <span className="chip">
              <Sprout className="h-4 w-4" aria-hidden /> {cropName(crop, lang)}
              {today.stage && ` • ${t(`plan.stage_${today.stage}`)}`}
            </span>
            {today.days_after_sowing >= 0 && <span className="chip">{t('plan.dayAfterSowing', { n: today.days_after_sowing })}</span>}
            <span className={`chip ${weather.source === 'live' ? '' : 'bg-amber-100 text-amber-900'}`}>
              {weatherLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Radio className="h-4 w-4" aria-hidden />}
              {weatherLabel}
            </span>
          </p>
        </div>
        <SpeakButton text={speech} id="plan-today" label={t('plan.readAloud')} variant="primary" />
      </header>

      {heatDays.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-danger-500/40 bg-red-50 p-4" role="alert">
          <Flame className="mt-0.5 h-6 w-6 shrink-0 text-danger-500" aria-hidden />
          <div>
            <p className="font-bold text-red-900">{t('plan.heatTitle')}</p>
            {heatDays.slice(0, 2).map((d) => (
              <p key={d.date} className="text-red-900">
                {t('plan.heatText', {
                  date: formatDate(d.date, lang, { weekday: 'long', day: 'numeric', month: 'short' }),
                  t: fmt(d.temp_max_c, 1),
                  crop: cropName(crop, lang),
                  limit: crop.heat_tolerance_max_c,
                })}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card p-5" aria-labelledby="solar-title">
          <h2 id="solar-title" className="flex items-center gap-2 text-lg font-bold">
            <Sun className="h-5 w-5 text-earth-600" aria-hidden /> {t('plan.solarTitle')}
          </h2>
          <p className="mt-1 font-semibold text-green-900">
            {today.solar_window
              ? t('plan.solarRange', { start: today.solar_window.start, end: today.solar_window.end, h: today.solar_window.hours })
              : t('plan.noSolar')}
          </p>
          <SunArc
            profile={radiationProfile(weather.hourly, today.date)}
            threshold={assumptions.solar_threshold_wm2}
            window={today.solar_window}
            title={t('plan.solarTitle')}
            runs={todayRuns.map((c) => ({
              start: c.start_time!,
              minutes: c.duration_min,
              label: `${t('zones.zoneName', { n: zoneIndex(c.zone_id) })} (${t(`zones.${zoneLabelOf(c.zone_id)}`)}): ${c.start_time}, ${c.duration_min} ${t('common.minutes')}`,
            }))}
          />
          <p className="mt-2 text-sm text-slate-600">
            {pump.type === 'solar' ? t('plan.solarShare', { pct: fmt(plan.solar_share * 100) }) : t('plan.solarNoteNonSolar')}
          </p>
        </section>

        <section className="card p-5" aria-labelledby="week-title">
          <h2 id="week-title" className="text-lg font-bold">
            {t('plan.weekTotal')}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-water-500/10 p-4">
              <dt className="flex items-center gap-1 text-sm font-semibold text-sky-900">
                <Droplets className="h-4 w-4" aria-hidden /> {t('plan.weekWater')}
              </dt>
              <dd className="text-2xl font-extrabold text-sky-900">
                {fmt(plan.total_litres)} <span className="text-sm">L</span>
              </dd>
            </div>
            <div className="rounded-2xl bg-sun-400/20 p-4">
              <dt className="flex items-center gap-1 text-sm font-semibold text-earth-600">
                <Zap className="h-4 w-4" aria-hidden /> {t('plan.weekEnergy')}
              </dt>
              <dd className="text-2xl font-extrabold text-earth-600">
                {fmt(plan.total_kwh, 1)} <span className="text-sm">kWh</span>
              </dd>
            </div>
          </dl>
          <label className="mt-5 block">
            <span className="label flex items-center gap-1">
              <CloudRain className="h-4 w-4" aria-hidden /> {t('plan.rainThreshold')}
            </span>
            <span className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={assumptions.rain_skip_threshold_mm}
                onChange={(e) => setAssumption('rain_skip_threshold_mm', Number(e.target.value))}
                className="h-12 flex-1 accent-green-700"
                aria-valuetext={`${assumptions.rain_skip_threshold_mm} mm`}
              />
              <span className="w-16 text-right font-bold text-green-900">{assumptions.rain_skip_threshold_mm} mm</span>
            </span>
          </label>
          <Link to="/app/impact" className="btn-primary mt-4 w-full">
            {t('plan.toImpact')} <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </section>
      </div>

      <section className="card p-3 sm:p-5" aria-labelledby="grid-title">
        <h2 id="grid-title" className="mb-3 px-2 text-lg font-bold">
          {t('plan.title')}
        </h2>
        <ScheduleGrid plan={plan} field={field} threshold={assumptions.rain_skip_threshold_mm} />
      </section>
    </div>
  );
}
