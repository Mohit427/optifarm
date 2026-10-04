import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Droplets, Zap, IndianRupee, Percent, SlidersHorizontal, Printer, Info, Sun } from 'lucide-react';
import { useApp } from '../state/AppState';
import { cropName, fmt, formatDate, todayIso } from '../lib/data';
import { METHODS, savingPct } from '../lib/waterModel';
import type { Method } from '../lib/types';
import { currentLang } from '../i18n';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { AssumptionsDrawer } from '../components/AssumptionsDrawer';
import { NeedSetup } from '../components/NeedSetup';
import { SpeakButton } from '../components/SpeakButton';
import { METHOD_COLOR } from '../components/methodColors';

const ImpactCharts = lazy(() => import('../components/ImpactCharts'));

export default function ImpactPage() {
  const { t } = useTranslation();
  const lang = currentLang();
  const { crop, field, impact, currentMethod, pump, assumptions } = useApp();
  const [method, setMethod] = useState<Method>('precision');
  const [drawer, setDrawer] = useState(false);

  if (!crop || !field || !impact) {
    return <NeedSetup message={t('plan.needSetup')} to={crop ? '/app/field' : '/app/seed'} cta={t('common.next')} />;
  }

  const base = impact.methods.flood;
  const m = impact.methods[method];
  const waterPct = savingPct(base.litres_per_ha, m.litres_per_ha);
  const kwhPct = savingPct(base.kwh_per_ha, m.kwh_per_ha);
  const costPct = savingPct(base.cost_inr_per_ha, m.cost_inr_per_ha);
  const yourMethod: Method = currentMethod === 'drip' ? 'drip' : 'flood';
  const fieldLitres = (base.litres_per_ha - m.litres_per_ha) * field.area_ha;
  const fieldInr = (base.cost_inr_per_ha - m.cost_inr_per_ha) * field.area_ha;

  const counters = [
    { Icon: Droplets, label: t('impact.water'), unit: t('impact.klHa'), value: m.litres_per_ha / 1000, cls: 'bg-water-500/10 text-sky-900' },
    { Icon: Zap, label: t('impact.energy'), unit: t('impact.kwhHa'), value: m.kwh_per_ha, cls: 'bg-sun-400/20 text-earth-600' },
    { Icon: IndianRupee, label: t('impact.cost'), unit: t('impact.inrHa'), value: m.cost_inr_per_ha, cls: 'bg-green-100 text-green-900', prefix: '₹' },
  ];

  const speech = `${t(`impact.${method}`)}. ${t('impact.water')}: ${fmt(m.litres_per_ha)} ${t('common.litres')}. ${t('impact.saved')}: ${fmt(waterPct)}%. ${t('impact.cost')}: ₹${fmt(m.cost_inr_per_ha)}.`;

  return (
    <div className="space-y-6">
      {/* Print-only header for "Export summary" */}
      <div className="print-only">
        <h1 className="text-2xl font-bold">{t('impact.summaryTitle')}</h1>
        <p>
          {field.name} • {fmt(field.area_ha, 2)} ha • {cropName(crop, lang)} •{' '}
          {t('impact.summaryGenerated', { date: formatDate(todayIso(), lang, { dateStyle: 'long' }) })}
        </p>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{t('impact.title')}</h1>
          <p className="muted mt-1">{t('impact.subtitle', { crop: cropName(crop, lang) })}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <SpeakButton text={speech} id="impact" variant="icon" />
          <button type="button" className="btn-secondary" onClick={() => setDrawer(true)}>
            <SlidersHorizontal className="h-5 w-5" aria-hidden /> {t('impact.assumptionsOpen')}
          </button>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <Printer className="h-5 w-5" aria-hidden /> {t('impact.export')}
          </button>
        </div>
      </header>

      <div role="radiogroup" aria-label={t('impact.method')} className="no-print grid gap-2 sm:grid-cols-3">
        {METHODS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={method === k}
            onClick={() => setMethod(k)}
            className={`relative min-h-[64px] rounded-2xl border-2 px-4 py-3 text-left font-bold transition-colors ${
              method === k ? 'bg-white shadow-soft' : 'border-green-100 bg-white/60 hover:bg-white'
            }`}
            style={{ borderColor: method === k ? METHOD_COLOR[k] : undefined }}
          >
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: METHOD_COLOR[k] }} aria-hidden />
              {t(`impact.${k}`)}
            </span>
            {k === yourMethod && <span className="mt-1 block text-xs font-semibold text-slate-500">{t('impact.yourMethod')}</span>}
          </button>
        ))}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        {counters.map(({ Icon, label, unit, value, cls, prefix }) => (
          <div key={label} className="card p-4">
            <span className={`inline-flex rounded-xl p-2 ${cls}`}>
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-2 text-sm font-semibold text-slate-600">{label}</p>
            <p className="text-3xl font-extrabold text-green-900">
              <AnimatedNumber value={value} prefix={prefix} />
            </p>
            <p className="text-xs text-slate-500">{unit}</p>
          </div>
        ))}
        <div className="card bg-green-900 p-4 text-white">
          <span className="inline-flex rounded-xl bg-white/10 p-2 text-sun-400">
            <Percent className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-2 text-sm font-semibold text-green-100">{t('impact.saved')}</p>
          <dl className="mt-1 space-y-0.5 text-sm">
            {[
              [t('impact.water'), waterPct],
              [t('impact.energy'), kwhPct],
              [t('impact.cost'), costPct],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between gap-2">
                <dt className="text-green-100">{l}</dt>
                <dd className="text-lg font-extrabold">
                  <AnimatedNumber value={v as number} suffix="%" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-green-900">
        <span>{t('impact.fieldTotal', { ha: fmt(field.area_ha, 2), litres: fmt(fieldLitres), inr: fmt(fieldInr) })}</span>
        {pump.type === 'solar' && (
          <span className="chip">
            <Sun className="h-4 w-4 text-earth-600" aria-hidden />
            {t('impact.solarShare', { pct: fmt(m.solar_share * 100) })}
          </span>
        )}
      </p>

      <section className="card p-4 sm:p-6">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-green-50" />}>
          <ImpactCharts impact={impact} selected={method} />
        </Suspense>
      </section>

      <div className="space-y-2 rounded-2xl border-2 border-dashed border-earth-600/40 bg-white p-4 text-sm">
        <p className="flex items-start gap-2 font-semibold text-earth-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t('impact.disclaimer')}
        </p>
        <p className="muted">{t('impact.seasonNote')}</p>
        {/* Assumptions are listed in the printed summary too. */}
        <dl className="print-only grid grid-cols-2 gap-x-6 text-xs">
          {Object.entries(assumptions).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt>{t(`impact.a_${k}`)}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <AssumptionsDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}
