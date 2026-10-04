import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { SpeakButton } from './SpeakButton';

// eslint-disable-next-line react-refresh/only-export-components
export const DEMO_ROUTES = ['/app/seed', '/app/field', '/app/zones', '/app/plan', '/app/impact'];

/** Guided walk through the whole loop for judges (section 5.3). */
export function DemoStepper() {
  const { t } = useTranslation();
  const { demoStep, setDemo } = useApp();
  const navigate = useNavigate();
  const total = DEMO_ROUTES.length;

  const go = (step: number) => {
    if (step >= total) {
      setDemo(false);
      return;
    }
    setDemo(true, step);
    navigate(DEMO_ROUTES[step]);
  };
  const text = t(`demo.s${demoStep + 1}`);

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="no-print border-b border-sun-400/60 bg-sun-400/15 px-4 py-3"
      aria-label={t('demo.title')}
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <ol className="flex gap-1.5" aria-label={t('demo.stepOf', { n: demoStep + 1, total })}>
            {DEMO_ROUTES.map((r, i) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === demoStep ? 'step' : undefined}
                  aria-label={t('demo.stepOf', { n: i + 1, total })}
                  className={`h-8 w-8 rounded-full text-sm font-bold ${
                    i === demoStep
                      ? 'bg-green-700 text-white'
                      : i < demoStep
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-green-900'
                  }`}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <p className="flex-1 text-sm font-medium text-ink-900 sm:text-base">{text}</p>
        <div className="flex items-center gap-2">
          <SpeakButton text={text} id={`demo-${demoStep}`} variant="icon" />
          <button type="button" className="btn-ghost px-3" onClick={() => go(demoStep - 1)} disabled={demoStep === 0}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
            <span className="sr-only">{t('common.back')}</span>
          </button>
          <button type="button" className="btn-primary" onClick={() => go(demoStep + 1)}>
            {demoStep === total - 1 ? t('demo.exit') : t('common.next')}
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" className="btn-ghost px-3" onClick={() => setDemo(false)} aria-label={t('demo.exit')}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </motion.section>
  );
}
