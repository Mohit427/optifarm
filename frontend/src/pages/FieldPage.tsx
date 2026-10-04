import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CheckCircle2,
  Droplet,
  Fuel,
  Info,
  MapPin,
  PenLine,
  Search,
  Sun,
  Undo2,
  Trash2,
  Check,
  Waves,
  Zap,
  Rows3,
} from 'lucide-react';
import { useApp, type CurrentMethod } from '../state/AppState';
import { CROPS, SAMPLE_FIELDS, cropById, cropName, fmt } from '../lib/data';
import { closeRing, polygonAreaHa, ringCentroid, simulateZones, squareAround } from '../lib/geo';
import type { Field, PolygonGeom, PumpType, Ring } from '../lib/types';
import { currentLang } from '../i18n';
import { SpeakButton } from '../components/SpeakButton';

const FieldMap = lazy(() => import('../components/FieldMap'));

type Mode = 'idle' | 'draw' | 'pin';

function buildCustomField(polygon: PolygonGeom, name: string, suggestedCrop: string): Field {
  const c = ringCentroid(polygon.coordinates[0]);
  return {
    id: 'custom',
    name,
    district: '',
    centroid: { lat: c.lat, lng: c.lng },
    polygon,
    area_ha: +polygonAreaHa(polygon).toFixed(3),
    suggested_crop_id: suggestedCrop,
    zones: simulateZones(polygon),
    zone_source: 'simulated',
  };
}

function Choice<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; Icon: typeof Sun }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-3 gap-2">
      {options.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 text-center text-sm font-semibold transition-colors ${
            value === v ? 'border-green-600 bg-green-50 text-green-900' : 'border-green-100 bg-white text-slate-700 hover:border-green-500'
          }`}
        >
          <Icon className="h-6 w-6" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function FieldPage() {
  const { t } = useTranslation();
  const lang = currentLang();
  const app = useApp();
  const { field, update } = app;
  const [mode, setMode] = useState<Mode>('idle');
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [query, setQuery] = useState('');
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  const selectSample = (id: string) => {
    const f = SAMPLE_FIELDS.find((x) => x.id === id)!;
    update({
      fieldId: id,
      ...(app.cropConfirmed ? {} : { cropId: f.suggested_crop_id, cropConfirmed: true }),
    });
    setMode('idle');
    setDraft([]);
  };

  const saveCustom = (polygon: PolygonGeom) => {
    const suggested = app.cropConfirmed && app.cropId ? app.cropId : 'groundnut';
    update({ fieldId: 'custom', customField: buildCustomField(polygon, t('field.myField'), suggested) });
  };

  const onMapClick = (lat: number, lng: number) => {
    if (mode === 'draw') setDraft((d) => [...d, [lat, lng]]);
    if (mode === 'pin') {
      saveCustom(squareAround(lat, lng));
      setMode('idle');
    }
  };

  const finishDraw = () => {
    if (draft.length < 3) return;
    const ring: Ring = closeRing(draft.map(([lat, lng]) => [lng, lat]));
    saveCustom({ type: 'Polygon', coordinates: [ring] });
    setDraft([]);
    setMode('idle');
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchMsg(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': lang } });
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (!data.length) return setSearchMsg(t('field.searchNone'));
      setFlyTarget({ lat: +data[0].lat, lng: +data[0].lon, zoom: 16 });
    } catch {
      setSearchMsg(t('field.searchNone'));
    }
  };

  const fieldName = (f: Field) => (f.name_local && lang !== 'en' ? (f.name_local[lang] ?? f.name) : f.name);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{t('field.title')}</h1>
          <p className="muted mt-1">{t('field.subtitle')}</p>
        </div>
        <SpeakButton text={`${t('field.title')}. ${t('field.subtitle')}`} id="field-intro" variant="icon" />
      </header>

      <section aria-labelledby="samples-title">
        <h2 id="samples-title" className="text-xl font-bold">
          {t('field.samplesTitle')}
        </h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {SAMPLE_FIELDS.map((f) => {
            const active = app.fieldId === f.id;
            const c = cropById(f.suggested_crop_id)!;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => selectSample(f.id)}
                  aria-pressed={active}
                  className={`card flex w-full items-start gap-3 border-2 p-4 text-left transition-colors ${
                    active ? 'border-green-600' : 'border-transparent hover:border-green-500'
                  }`}
                >
                  <img src={c.seed_image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-green-900">{fieldName(f)}</span>
                    <span className="block text-sm text-slate-600">
                      {f.district} • {fmt(f.area_ha, 2)} {t('common.ha')}
                    </span>
                    <span className="chip mt-2">{t('field.suggestedCrop', { crop: cropName(c, lang) })}</span>
                  </span>
                  {active && <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" aria-label={t('field.selected')} />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card space-y-3 p-4" aria-label={t('field.mapLabel')}>
        <form onSubmit={search} className="flex gap-2" role="search">
          <label className="sr-only" htmlFor="place">
            {t('field.searchPlaceholder')}
          </label>
          <input
            id="place"
            className="input"
            placeholder={t('field.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn-primary px-4" type="submit">
            <Search className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">{t('field.search')}</span>
          </button>
        </form>
        {searchMsg && <p className="text-sm text-amber-800">{searchMsg}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={mode === 'pin' ? 'btn-primary' : 'btn-secondary'}
            aria-pressed={mode === 'pin'}
            onClick={() => {
              setMode(mode === 'pin' ? 'idle' : 'pin');
              setDraft([]);
            }}
          >
            <MapPin className="h-5 w-5" aria-hidden /> {t('field.pin')}
          </button>
          <button
            type="button"
            className={mode === 'draw' ? 'btn-primary' : 'btn-secondary'}
            aria-pressed={mode === 'draw'}
            onClick={() => {
              setMode(mode === 'draw' ? 'idle' : 'draw');
              setDraft([]);
            }}
          >
            <PenLine className="h-5 w-5" aria-hidden /> {t('field.draw')}
          </button>
          {mode === 'draw' && (
            <>
              <button type="button" className="btn-primary" onClick={finishDraw} disabled={draft.length < 3}>
                <Check className="h-5 w-5" aria-hidden /> {t('field.finish')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length}>
                <Undo2 className="h-5 w-5" aria-hidden /> {t('field.undo')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setDraft([])} disabled={!draft.length}>
                <Trash2 className="h-5 w-5" aria-hidden /> {t('field.clear')}
              </button>
            </>
          )}
        </div>
        {mode !== 'idle' && (
          <p className="flex items-start gap-2 rounded-xl bg-sun-400/20 p-3 text-sm font-medium" role="status">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {mode === 'draw' ? t('field.drawHelp') : t('field.pinHelp')}
          </p>
        )}

        <Suspense fallback={<div className="h-[380px] animate-pulse rounded-2xl bg-green-100" />}>
          <FieldMap
            field={mode === 'draw' ? undefined : field}
            draft={draft}
            onMapClick={onMapClick}
            flyTarget={flyTarget}
            className={`h-[380px] ${mode !== 'idle' ? 'cursor-crosshair' : ''}`}
          />
        </Suspense>

        {field && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg">
              <span className="font-semibold text-slate-600">{t('field.area')}: </span>
              <span className="font-extrabold text-green-900">
                {fmt(field.area_ha, 2)} {t('common.ha')}
              </span>
              <span className="ml-2 text-sm text-slate-500">({fmt(field.area_ha * 2.471, 2)} acres)</span>
            </p>
            {field.area_ha < 0.3 && (
              <p className="flex items-start gap-2 rounded-xl bg-water-500/10 p-3 text-sm text-sky-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t('field.smallPlot')}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card space-y-5 p-5" aria-labelledby="details-title">
        <h2 id="details-title" className="text-xl font-bold">
          {t('field.detailsTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">{t('field.crop')}</span>
            <select
              className="input"
              value={app.cropConfirmed && app.cropId ? app.cropId : ''}
              onChange={(e) => update({ cropId: e.target.value, cropConfirmed: true })}
            >
              <option value="" disabled>
                —
              </option>
              {CROPS.map((c) => (
                <option key={c.id} value={c.id}>
                  {cropName(c, lang)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">{t('field.sowingDate')}</span>
            <input
              type="date"
              className="input"
              value={app.sowingDate}
              onChange={(e) => e.target.value && update({ sowingDate: e.target.value })}
            />
          </label>
        </div>

        <div>
          <span className="label">{t('field.method')}</span>
          <Choice<CurrentMethod>
            name={t('field.method')}
            value={app.currentMethod}
            onChange={(v) => update({ currentMethod: v })}
            options={[
              { value: 'flood', label: t('field.methodFlood'), Icon: Waves },
              { value: 'furrow', label: t('field.methodFurrow'), Icon: Rows3 },
              { value: 'drip', label: t('field.methodDrip'), Icon: Droplet },
            ]}
          />
        </div>

        <div>
          <span className="label">{t('field.pumpType')}</span>
          <Choice<PumpType>
            name={t('field.pumpType')}
            value={app.pump.type}
            onChange={(v) => update({ pump: { ...app.pump, type: v } })}
            options={[
              { value: 'grid', label: t('field.pumpGrid'), Icon: Zap },
              { value: 'diesel', label: t('field.pumpDiesel'), Icon: Fuel },
              { value: 'solar', label: t('field.pumpSolar'), Icon: Sun },
            ]}
          />
        </div>

        <label className="block max-w-xs">
          <span className="label">{t('field.pumpKw')}</span>
          <input
            type="number"
            className="input"
            min={0.5}
            max={30}
            step={0.1}
            value={app.pump.power_kw}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (v > 0) update({ pump: { ...app.pump, power_kw: v } });
            }}
          />
          <span className="mt-1 block text-sm text-slate-500">{t('field.pumpHint')}</span>
        </label>

        <Link
          to="/app/zones"
          className={`btn-primary w-full text-lg sm:w-auto ${!field || !app.cropConfirmed ? 'pointer-events-none opacity-50' : ''}`}
          aria-disabled={!field || !app.cropConfirmed}
        >
          {t('field.continue')} <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
