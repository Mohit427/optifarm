import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImageUp,
  Info,
  Loader2,
  Lock,
  ArrowRight,
  Wheat,
  Package,
} from 'lucide-react';
import { useApp } from '../state/AppState';
import { CROPS, cropById, cropName } from '../lib/data';
import { identifySeed, type SeedMatch } from '../lib/api';
import { downscaleImage } from '../lib/image';
import { SeedOverlay } from '../components/SeedOverlay';
import { SpeakButton } from '../components/SpeakButton';
import { currentLang } from '../i18n';

/** Sample seeds shown in the demo, with pre-computed (clearly labelled) matches. */
const SAMPLE_MATCHES: Record<string, SeedMatch[]> = {
  paddy: [
    { crop_id: 'paddy', confidence: 0.93 },
    { crop_id: 'ragi', confidence: 0.04 },
    { crop_id: 'maize', confidence: 0.02 },
  ],
  groundnut: [
    { crop_id: 'groundnut', confidence: 0.88 },
    { crop_id: 'blackgram', confidence: 0.06 },
    { crop_id: 'cotton', confidence: 0.03 },
  ],
  maize: [
    { crop_id: 'maize', confidence: 0.9 },
    { crop_id: 'groundnut', confidence: 0.05 },
    { crop_id: 'paddy', confidence: 0.03 },
  ],
  blackgram: [
    { crop_id: 'blackgram', confidence: 0.81 },
    { crop_id: 'ragi', confidence: 0.11 },
    { crop_id: 'groundnut', confidence: 0.04 },
  ],
  cotton: [
    { crop_id: 'cotton', confidence: 0.52 },
    { crop_id: 'groundnut', confidence: 0.27 },
    { crop_id: 'blackgram', confidence: 0.12 },
  ],
  chilli: [
    { crop_id: 'chilli', confidence: 0.71 },
    { crop_id: 'tomato', confidence: 0.22 },
    { crop_id: 'brinjal', confidence: 0.05 },
  ],
};
const SAMPLE_IDS = Object.keys(SAMPLE_MATCHES);

type Source = { kind: 'sample' | 'photo'; src: string } | null;

export default function SeedPage() {
  const { t } = useTranslation();
  const lang = currentLang();
  const app = useApp();
  const { connectivity, update, demoActive, demoStep } = app;
  const [source, setSource] = useState<Source>(null);
  const [matches, setMatches] = useState<SeedMatch[] | null>(null);
  const [selected, setSelected] = useState<string | null>(app.cropConfirmed ? app.cropId : null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle');
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const canIdentify = connectivity.online && connectivity.backend && connectivity.ai;

  const crop = cropById(selected);
  const confirmed = !!crop && app.cropConfirmed && app.cropId === crop.id;
  const lowConfidence = matches && matches.length > 0 && matches[0].confidence < 0.6;

  // Release object URLs of uploaded photos.
  useEffect(
    () => () => {
      if (source?.kind === 'photo') URL.revokeObjectURL(source.src);
    },
    [source],
  );

  const chooseSample = (id: string) => {
    setSource({ kind: 'sample', src: `/seeds/${id}.svg` });
    setMatches(SAMPLE_MATCHES[id]);
    setSelected(SAMPLE_MATCHES[id][0].crop_id);
    setStatus('idle');
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Guided demo, step 1: show the paddy sample straight away.
  useEffect(() => {
    if (demoActive && demoStep === 0 && !source) chooseSample('paddy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoActive, demoStep]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setSource({ kind: 'photo', src: URL.createObjectURL(file) });
    setMatches(null);
    setSelected(null);
    setStatus('loading');
    try {
      const blob = await downscaleImage(file);
      const res = await identifySeed(blob);
      setMatches(res);
      setSelected(res[0]?.crop_id ?? null);
      setStatus(res.length ? 'idle' : 'empty');
    } catch {
      setStatus('error');
    }
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const confirm = (id: string) => {
    setSelected(id);
    update({ cropId: id, cropConfirmed: true });
  };

  const pickManually = (id: string) => {
    setSource(null);
    setMatches(null);
    setStatus('idle');
    confirm(id);
  };

  const overlaySrc = source?.src ?? crop?.seed_image;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{t('seed.title')}</h1>
          <p className="muted mt-1 max-w-2xl">{t('seed.subtitle')}</p>
        </div>
        <SpeakButton text={`${t('seed.title')}. ${t('seed.subtitle')}`} id="seed-intro" variant="icon" />
      </header>

      {/* Capture / upload */}
      <section className="card p-5" aria-labelledby="capture-title">
        <h2 id="capture-title" className="sr-only">
          {t('seed.upload')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="btn-primary min-h-[64px] text-lg"
            disabled={!canIdentify}
            onClick={() => cameraInput.current?.click()}
          >
            <Camera className="h-6 w-6" aria-hidden />
            {t('seed.capture')}
          </button>
          <button
            type="button"
            className="btn-secondary min-h-[64px] text-lg"
            disabled={!canIdentify}
            onClick={() => fileInput.current?.click()}
          >
            <ImageUp className="h-6 w-6" aria-hidden />
            {t('seed.upload')}
          </button>
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
        {!canIdentify && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {connectivity.online ? t('seed.aiError') : t('seed.offlineDisabled')}
          </p>
        )}
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Lock className="h-4 w-4" aria-hidden /> {t('seed.privacy')}
        </p>

        <h3 className="mt-6 text-lg font-bold">{t('seed.samples')}</h3>
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {SAMPLE_IDS.map((id) => {
            const c = cropById(id)!;
            const active = source?.kind === 'sample' && source.src.includes(`/${id}.svg`);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => chooseSample(id)}
                  aria-pressed={active}
                  className={`w-full overflow-hidden rounded-2xl border-2 bg-white text-center transition-colors ${
                    active ? 'border-green-600 ring-2 ring-green-500/40' : 'border-green-100 hover:border-green-600'
                  }`}
                >
                  <img src={c.seed_image} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  <span className="block px-1 py-1.5 text-xs font-semibold text-green-900">
                    {t('seed.sampleTag')} {SAMPLE_IDS.indexOf(id) + 1}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Results */}
      <div ref={resultsRef} className="scroll-mt-24 space-y-6">
        {status === 'loading' && (
          <p className="card flex items-center gap-3 p-5 font-semibold text-green-900" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {t('seed.identifying')}
          </p>
        )}
        {(status === 'error' || status === 'empty') && (
          <p className="card flex items-start gap-3 border-2 border-amber-300 p-5 text-amber-900" role="alert">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            {status === 'error' ? t('seed.aiError') : t('seed.noMatches')}
          </p>
        )}

        {matches && matches.length > 0 && (
          <section className="card p-5" aria-labelledby="matches-title">
            <h2 id="matches-title" className="text-xl font-bold">
              {t('seed.resultsTitle')}
            </h2>
            {source?.kind === 'sample' && <p className="muted mt-1 text-sm">{t('seed.sampleResult')}</p>}
            {lowConfidence && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-100 p-3 font-semibold text-amber-900" role="alert">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                {t('seed.lowConfidence')}
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('seed.resultsTitle')}>
              {matches.map((m) => {
                const c = cropById(m.crop_id)!;
                const active = selected === m.crop_id;
                const pct = Math.round(m.confidence * 100);
                return (
                  <button
                    key={m.crop_id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelected(m.crop_id)}
                    className={`rounded-2xl border-2 p-3 text-left transition-colors ${
                      active ? 'border-green-600 bg-green-50' : 'border-green-100 bg-white hover:border-green-500'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <img src={c.seed_image} alt="" className="h-10 w-10 rounded-full object-cover" />
                      <span className="font-bold text-green-900">{cropName(c, lang)}</span>
                    </span>
                    <span className="mt-2 block h-3 overflow-hidden rounded-full bg-green-100" aria-hidden>
                      <motion.span
                        className={`block h-full rounded-full ${pct >= 60 ? 'bg-green-600' : 'bg-warn-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-slate-700">{t('seed.confidence', { pct })}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {crop && overlaySrc && (
          <section className="card overflow-hidden p-5 sm:p-8" aria-labelledby="overlay-title">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="overlay-title" className="text-2xl font-extrabold">
                {cropName(crop, lang)}
              </h2>
              <p className="chip">{t('seed.tapToHear')}</p>
            </div>
            <SeedOverlay crop={crop} imageSrc={overlaySrc} />

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-green-50 p-4">
                <h3 className="flex items-center gap-2 font-bold">
                  <Wheat className="h-5 w-5 text-earth-600" aria-hidden /> {t('seed.harvestTitle')}
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  {crop.harvest_indicators[lang].map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-green-50 p-4">
                <h3 className="flex items-center gap-2 font-bold">
                  <Package className="h-5 w-5 text-earth-600" aria-hidden /> {t('seed.postHarvestTitle')}
                </h3>
                <p className="mt-2">{crop.post_harvest_tip[lang]}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {confirmed ? (
                <span className="chip min-h-tap px-4 text-base">
                  <CheckCircle2 className="h-5 w-5 text-green-700" aria-hidden /> {t('seed.confirmed')}
                </span>
              ) : (
                <button type="button" className="btn-secondary" onClick={() => confirm(crop.id)}>
                  <CheckCircle2 className="h-5 w-5" aria-hidden /> {t('seed.confirm')}
                </button>
              )}
              {confirmed ? (
                <Link to="/app/field" className="btn-primary">
                  {t('seed.useCrop')} <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              ) : (
                <button type="button" className="btn-primary" disabled aria-disabled>
                  {t('seed.useCrop')} <ArrowRight className="h-5 w-5" aria-hidden />
                </button>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {t('seed.sourceNote')} — {crop.source_note}
            </p>
          </section>
        )}
      </div>

      {/* Manual picker */}
      <section className="card p-5" aria-labelledby="manual-title">
        <h2 id="manual-title" className="text-xl font-bold">
          {t('seed.pickManually')}
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CROPS.map((c) => {
            const active = app.cropConfirmed && app.cropId === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pickManually(c.id)}
                  aria-pressed={active}
                  className={`flex min-h-tap w-full items-center gap-2 rounded-2xl border-2 p-2 text-left transition-colors ${
                    active ? 'border-green-600 bg-green-50' : 'border-green-100 bg-white hover:border-green-500'
                  }`}
                >
                  <img src={c.seed_image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" loading="lazy" />
                  <span className="text-sm font-semibold text-green-900">{cropName(c, lang)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
