import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Droplets,
  IndianRupee,
  Languages,
  Map as MapIcon,
  MessagesSquare,
  PlayCircle,
  ScanLine,
  Smartphone,
  Sun,
  Sprout,
  WifiOff,
  Zap,
  HandHeart,
  Eye,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { CROPS, DEFAULT_ASSUMPTIONS, SAMPLE_FIELDS, cropName, fmt, addDays, todayIso } from '../lib/data';
import { seasonImpact, savingPct } from '../lib/waterModel';
import { currentLang } from '../i18n';
import type { PumpType } from '../lib/types';

const ChatWidget = lazy(() => import('../components/ChatWidget'));

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
};

function Navbar() {
  const { t } = useTranslation();
  const links = [
    ['#problem', t('landing.navProblem')],
    ['#how', t('landing.navHow')],
    ['#features', t('landing.navFeatures')],
    ['#impact', t('landing.navImpact')],
  ];
  return (
    <header className="sticky top-0 z-[1000] border-b border-green-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label={t('nav.main')}>
          {links.map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 font-medium text-green-900 hover:bg-green-100">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <div className="sm:hidden">
            <LanguageSwitcher compact />
          </div>
          <Link to="/app?demo=1" className="btn-primary hidden px-4 sm:inline-flex">
            {t('common.tryDemo')}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Illustrative product mock: phone card with a zoned field and a plan toast. */
function HeroMock() {
  const { t } = useTranslation();
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden>
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ duration: 0.7 }}
        className="rounded-[2rem] border-8 border-green-900 bg-white p-3 shadow-lift"
      >
        <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-green-900">
          <span>OptiFarm</span>
          <span className="flex items-center gap-1">
            <Sun className="h-3.5 w-3.5 text-earth-600" /> 10:00–15:00
          </span>
        </div>
        <svg viewBox="0 0 300 220" className="w-full rounded-2xl">
          <rect width="300" height="220" fill="#3f5e32" />
          <path d="M0 40 Q80 20 160 50 T300 30" stroke="#577a44" strokeWidth="16" fill="none" opacity=".5" />
          <path d="M0 180 Q90 160 170 190 T300 170" stroke="#577a44" strokeWidth="16" fill="none" opacity=".5" />
          <g stroke="#fff" strokeWidth="1.5">
            <path d="M40 40 L150 30 L130 110 L50 120 Z" fill="url(#pat-critical)" />
            <path d="M150 30 L260 45 L250 100 L130 110 Z" fill="url(#pat-moderate)" />
            <path d="M50 120 L130 110 L150 190 L45 185 Z" fill="url(#pat-healthy)" />
            <path d="M130 110 L250 100 L262 180 L150 190 Z" fill="url(#pat-healthy)" />
            <path d="M200 140 L262 135 L262 180 L215 185 Z" fill="url(#pat-waterlogged)" />
          </g>
          <path d="M40 40 L150 30 L260 45 L262 180 L150 190 L45 185 Z" fill="none" stroke="#FACC15" strokeWidth="3" />
          {[
            [90, 78, '#EF4444', '!1'],
            [195, 70, '#F59E0B', '~2'],
            [95, 155, '#16A34A', '✓3'],
            [235, 160, '#0EA5E9', '≈4'],
          ].map(([x, y, c, g]) => (
            <g key={String(g)}>
              <circle cx={x} cy={y} r="14" fill="#fff" stroke={String(c)} strokeWidth="3" />
              <text x={x} y={Number(y) + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0F172A">
                {g}
              </text>
            </g>
          ))}
        </svg>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {['💧', '💧', '🌧', '💧', '💧', '💧', '💧'].map((e, i) => (
            <div key={i} className={`rounded-lg py-1.5 text-center text-sm ${e === '🌧' ? 'bg-water-500/15' : 'bg-green-100'}`}>
              {e}
            </div>
          ))}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="card absolute -bottom-6 -left-4 flex max-w-[15rem] items-start gap-3 p-3 sm:-left-12"
      >
        <span className="rounded-xl bg-danger-500/15 p-2 text-danger-500">
          <Droplets className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-bold text-green-900">{t('landing.heroCardTitle')}</span>
          <span className="block text-xs text-slate-600">{t('landing.heroCardSub')}</span>
        </span>
      </motion.div>
    </div>
  );
}

function ImpactPreview() {
  const { t } = useTranslation();
  const lang = currentLang();
  const [cropId, setCropId] = useState('paddy');
  const [pump, setPump] = useState<PumpType>('grid');
  const res = useMemo(() => {
    const crop = CROPS.find((c) => c.id === cropId)!;
    const field = SAMPLE_FIELDS[0];
    const imp = seasonImpact({
      crop,
      zones: field.zones,
      sowingDate: addDays(todayIso(), -10),
      pump: { type: pump, power_kw: 3.7 },
      assumptions: DEFAULT_ASSUMPTIONS,
    });
    const f = imp.methods.flood;
    const p = imp.methods.precision;
    return {
      water: f.litres_per_ha - p.litres_per_ha,
      waterPct: savingPct(f.litres_per_ha, p.litres_per_ha),
      kwh: f.kwh_per_ha - p.kwh_per_ha,
      kwhPct: savingPct(f.kwh_per_ha, p.kwh_per_ha),
      inr: f.cost_inr_per_ha - p.cost_inr_per_ha,
      inrPct: savingPct(f.cost_inr_per_ha, p.cost_inr_per_ha),
    };
  }, [cropId, pump]);

  const tiles = [
    { Icon: Droplets, label: t('landing.impactWater'), value: res.water / 1000, unit: 'kL', pct: res.waterPct, cls: 'text-water-500 bg-water-500/10' },
    { Icon: Zap, label: t('landing.impactEnergy'), value: res.kwh, unit: 'kWh', pct: res.kwhPct, cls: 'text-earth-600 bg-sun-400/20' },
    { Icon: IndianRupee, label: t('landing.impactCost'), value: res.inr, unit: '₹', pct: res.inrPct, cls: 'text-green-700 bg-green-100' },
  ];

  return (
    <div className="card p-5 sm:p-8">
      <div className="flex flex-wrap gap-4">
        <label className="min-w-[10rem] flex-1">
          <span className="label">{t('landing.impactCrop')}</span>
          <select className="input" value={cropId} onChange={(e) => setCropId(e.target.value)}>
            {CROPS.map((c) => (
              <option key={c.id} value={c.id}>
                {cropName(c, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[10rem] flex-1">
          <span className="label">{t('landing.impactPump')}</span>
          <select className="input" value={pump} onChange={(e) => setPump(e.target.value as PumpType)}>
            <option value="grid">{t('field.pumpGrid')}</option>
            <option value="diesel">{t('field.pumpDiesel')}</option>
            <option value="solar">{t('field.pumpSolar')}</option>
          </select>
        </label>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {tiles.map(({ Icon, label, value, unit, pct, cls }) => (
          <div key={label} className="rounded-2xl border border-green-100 p-4">
            <span className={`inline-flex rounded-xl p-2 ${cls}`}>
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-2 text-sm font-semibold text-slate-600">{label}</p>
            <p className="text-3xl font-extrabold text-green-900">
              {unit === '₹' ? '₹' : ''}
              <AnimatedNumber value={value} />
              {unit !== '₹' && <span className="ml-1 text-base font-semibold text-slate-600">{unit}</span>}
            </p>
            <p className="text-sm font-semibold text-green-700">−{fmt(pct)}%</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="chip bg-sun-400/25 text-ink-900">{t('landing.impactLabel')}</span>
        <Link to="/app/impact" className="btn-secondary">
          {t('landing.impactCta')} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export default function Landing() {
  const { t } = useTranslation();

  const steps = [
    { Icon: ScanLine, title: t('landing.step1Title'), text: t('landing.step1Text') },
    { Icon: MapIcon, title: t('landing.step2Title'), text: t('landing.step2Text') },
    { Icon: CalendarDays, title: t('landing.step3Title'), text: t('landing.step3Text') },
    { Icon: BarChart3, title: t('landing.step4Title'), text: t('landing.step4Text') },
  ];
  const features = [
    { Icon: ScanLine, title: t('landing.f1Title'), text: t('landing.f1Text') },
    { Icon: MapIcon, title: t('landing.f2Title'), text: t('landing.f2Text') },
    { Icon: Sun, title: t('landing.f3Title'), text: t('landing.f3Text') },
    { Icon: Languages, title: t('landing.f4Title'), text: t('landing.f4Text') },
    { Icon: BarChart3, title: t('landing.f5Title'), text: t('landing.f5Text') },
    { Icon: MessagesSquare, title: t('landing.f6Title'), text: t('landing.f6Text') },
  ];
  const small = [
    { Icon: WifiOff, title: t('landing.s1Title'), text: t('landing.s1Text') },
    { Icon: Languages, title: t('landing.s2Title'), text: t('landing.s2Text') },
    { Icon: Eye, title: t('landing.s3Title'), text: t('landing.s3Text') },
    { Icon: Smartphone, title: t('landing.s4Title'), text: t('landing.s4Text') },
  ];

  return (
    <div className="min-h-screen bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[3000] focus:rounded focus:bg-white focus:p-3">
        {t('common.skipToContent')}
      </a>
      <Navbar />
      <main id="main">
        {/* Hero */}
        <section className="contour-bg relative overflow-hidden">
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]" aria-hidden preserveAspectRatio="none" viewBox="0 0 800 600">
            {Array.from({ length: 9 }, (_, i) => (
              <motion.path
                key={i}
                d={`M-50 ${80 + i * 60} C 200 ${30 + i * 60}, 450 ${140 + i * 60}, 850 ${70 + i * 60}`}
                stroke="#15803D"
                strokeWidth="1.5"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2.5, delay: i * 0.12, ease: 'easeOut' }}
              />
            ))}
          </svg>
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 md:grid-cols-2 md:pt-20">
            <div>
              <p className="chip mb-4">
                <Sprout className="h-4 w-4" aria-hidden /> {t('landing.heroKicker')}
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t('landing.heroTitle')}</h1>
              <p className="mt-5 max-w-xl text-lg text-slate-700">{t('landing.heroSub')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/app?demo=1" className="btn-primary px-6 text-lg">
                  <PlayCircle className="h-5 w-5" aria-hidden />
                  {t('common.tryDemo')}
                </Link>
                <a href="#how" className="btn-secondary px-6 text-lg">
                  {t('landing.ctaWatch')}
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </a>
              </div>
            </div>
            <HeroMock />
          </div>
        </section>

        {/* Problem stats */}
        <section id="problem" className="scroll-mt-20 bg-green-900 py-12 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-bold text-white">{t('landing.statsTitle')}</h2>
            <div className="mt-8 grid gap-8 text-center sm:grid-cols-3">
              {[
                { v: 40, prefix: '', suffix: '%+', text: t('landing.stat1') },
                { v: 90, prefix: '', suffix: '%', text: t('landing.stat2') },
                { v: 20, prefix: '15–', suffix: '%', text: t('landing.stat3') },
              ].map((s) => (
                <div key={s.text}>
                  <p className="text-5xl font-extrabold text-sun-400">
                    {s.prefix}
                    <AnimatedNumber value={s.v} onView />
                    {s.suffix}
                  </p>
                  <p className="mt-2 text-green-100">{s.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-green-100/80">{t('landing.statsSource')}</p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <motion.div {...fadeUp} className="text-center">
            <h2 className="text-3xl font-bold">{t('landing.howTitle')}</h2>
            <p className="muted mt-2">{t('landing.howSub')}</p>
          </motion.div>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {steps.map(({ Icon, title, text }, i) => (
              <motion.li key={title} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="relative">
                <div className="card h-full p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-700 text-white">
                      <Icon className="h-7 w-7" aria-hidden />
                    </span>
                    <span className="text-sm font-bold text-green-600">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{title}</h3>
                  <p className="muted mt-1">{text}</p>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 text-green-600 md:block" aria-hidden />
                )}
              </motion.li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 bg-green-50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <motion.h2 {...fadeUp} className="text-center text-3xl font-bold">
              {t('landing.featuresTitle')}
            </motion.h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ Icon, title, text }, i) => (
                <motion.div key={title} {...fadeUp} transition={{ duration: 0.5, delay: (i % 3) * 0.08 }} className="card p-6">
                  <span className="inline-flex rounded-2xl bg-green-100 p-3 text-green-700">
                    <Icon className="h-7 w-7" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{title}</h3>
                  <p className="muted mt-1">{text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Impact preview */}
        <section id="impact" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-16">
          <motion.div {...fadeUp} className="text-center">
            <h2 className="text-3xl font-bold">{t('landing.impactTitle')}</h2>
            <p className="muted mt-2">{t('landing.impactSub')}</p>
          </motion.div>
          <motion.div {...fadeUp} className="mt-8">
            <ImpactPreview />
          </motion.div>
        </section>

        {/* Built for the smallholder */}
        <section className="bg-green-900 py-16 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold text-white">{t('landing.smallTitle')}</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {small.map(({ Icon, title, text }) => (
                <div key={title} className="text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-sun-400">
                    <Icon className="h-8 w-8" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-lg font-bold text-white">{title}</h3>
                  <p className="mt-1 text-green-100">{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link to="/app?demo=1" className="btn bg-sun-400 px-8 text-lg text-ink-900 hover:bg-white">
                <PlayCircle className="h-5 w-5" aria-hidden /> {t('common.tryDemo')}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-green-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm md:grid-cols-3">
          <div>
            <Logo />
            <p className="muted mt-2">{t('landing.footerTagline')}</p>
            <p className="mt-2 font-semibold text-green-900">{t('landing.footerTeam')}</p>
          </div>
          <p className="muted">{t('landing.footerHackathon')}</p>
          <div className="space-y-2">
            <p className="muted">{t('landing.footerCredits')}</p>
            <p className="flex items-start gap-1 text-xs text-slate-500">
              <HandHeart className="h-4 w-4 shrink-0" aria-hidden /> {t('landing.footerDisclaimer')}
            </p>
          </div>
        </div>
      </footer>

      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </div>
  );
}
