import { Suspense, lazy, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, CalendarDays, Map, ScanLine, Sprout, PlayCircle } from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ConnectivityBadge } from './ConnectivityBadge';
import { DemoStepper, DEMO_ROUTES } from './DemoStepper';
import { useApp } from '../state/AppState';

const ChatWidget = lazy(() => import('./ChatWidget'));

const APP_NAV = [
  { to: '/app/seed', key: 'seed', Icon: ScanLine },
  { to: '/app/field', key: 'field', Icon: Sprout },
  { to: '/app/zones', key: 'zones', Icon: Map },
  { to: '/app/plan', key: 'plan', Icon: CalendarDays },
  { to: '/app/impact', key: 'impact', Icon: BarChart3 },
] as const;

export function AppShell() {
  const { t } = useTranslation();
  const { demoActive, setDemo, loadDemo } = useApp();
  const [params, setParams] = useSearchParams();
  const location = useLocation();

  // /app?demo=1 (from the landing page CTA) starts the guided demo.
  useEffect(() => {
    if (params.get('demo') === '1') {
      loadDemo();
      setDemo(true, 0);
      params.delete('demo');
      setParams(params, { replace: true });
    }
  }, [params, setParams, loadDemo, setDemo]);

  // Keep the stepper in sync if the judge navigates using the tabs.
  const { demoStep } = useApp();
  useEffect(() => {
    if (!demoActive) return;
    const idx = DEMO_ROUTES.indexOf(location.pathname);
    if (idx >= 0 && idx !== demoStep) setDemo(true, idx);
  }, [location.pathname, demoActive, demoStep, setDemo]);

  const navigate = useNavigate();
  const startDemo = () => {
    loadDemo();
    setDemo(true, 0);
    navigate(DEMO_ROUTES[0]);
  };

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[3000] focus:rounded focus:bg-white focus:p-3">
        {t('common.skipToContent')}
      </a>

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-green-100 bg-white px-4 py-5 md:flex">
        <Logo />
        <nav aria-label={t('nav.main')} className="mt-8 flex flex-col gap-1">
          {APP_NAV.map(({ to, key, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-tap items-center gap-3 rounded-xl px-3 text-base font-semibold transition-colors ${
                  isActive ? 'bg-green-700 text-white shadow-soft' : 'text-green-900 hover:bg-green-100'
                }`
              }
            >
              <Icon className="h-6 w-6" aria-hidden />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <button type="button" onClick={startDemo} className="btn-secondary w-full text-sm">
            <PlayCircle className="h-5 w-5" aria-hidden />
            {t('demo.start')}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header
          className="no-print sticky z-[1000] flex items-center justify-between gap-2 border-b border-green-100 bg-white/90 px-4 py-2 backdrop-blur"
          style={{ top: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="md:hidden">
            <Logo markOnlyOnMobile />
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={demoActive}
              onClick={() => (demoActive ? setDemo(false) : startDemo())}
              className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${
                demoActive ? 'bg-sun-400 text-ink-900' : 'bg-green-100 text-green-900'
              }`}
            >
              <PlayCircle className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('demo.toggle')}</span>
            </button>
            <ConnectivityBadge />
            <LanguageSwitcher compact />
          </div>
        </header>

        {demoActive && <DemoStepper />}

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-5 md:pb-12">
          <Suspense fallback={<p className="muted p-6">{t('common.loading')}</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav
        aria-label={t('nav.main')}
        className="no-print fixed inset-x-0 bottom-0 z-[1000] grid grid-cols-5 border-t border-green-100 bg-white md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {APP_NAV.map(({ to, key, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                isActive ? 'text-green-700' : 'text-slate-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`rounded-full px-3 py-1 ${isActive ? 'bg-green-100' : ''}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                {t(`nav.${key}`)}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </div>
  );
}
