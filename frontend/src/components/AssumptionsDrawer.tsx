import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { RotateCcw, X } from 'lucide-react';
import { useApp } from '../state/AppState';
import { DEFAULT_ASSUMPTIONS } from '../lib/data';
import type { Assumptions } from '../lib/types';

const GROUPS: { keys: (keyof Assumptions)[]; step: number }[] = [
  { keys: ['rain_skip_threshold_mm', 'effective_rain_factor', 'effective_rain_min_mm', 'min_irrigation_mm'], step: 0.1 },
  { keys: ['zone_factor_critical', 'zone_factor_moderate', 'zone_factor_healthy', 'zone_factor_waterlogged'], step: 0.05 },
  { keys: ['efficiency_flood', 'efficiency_drip', 'efficiency_precision'], step: 0.01 },
  { keys: ['pump_head_m', 'pump_efficiency', 'solar_threshold_wm2', 'unscheduled_solar_share'], step: 0.01 },
  { keys: ['grid_tariff_inr_per_kwh', 'solar_marginal_inr_per_kwh', 'diesel_litres_per_kwh', 'diesel_price_inr_per_litre'], step: 0.1 },
];

export function AssumptionsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { assumptions, setAssumption, resetAssumptions } = useApp();
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="no-print fixed inset-0 z-[1500] bg-ink-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="assumptions-title"
            className="no-print fixed inset-y-0 right-0 z-[1600] flex w-full max-w-md flex-col bg-white shadow-lift"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
          >
            <div className="flex items-center justify-between border-b border-green-100 p-4">
              <h2 id="assumptions-title" className="text-xl font-bold">
                {t('impact.assumptions')}
              </h2>
              <button ref={closeBtn} type="button" onClick={onClose} className="btn-ghost px-3" aria-label={t('common.close')}>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              <p className="muted text-sm">{t('impact.assumptionsHelp')}</p>
              {GROUPS.map((g, gi) => (
                <fieldset key={gi} className="space-y-3 rounded-2xl bg-green-50 p-3">
                  {g.keys.map((k) => {
                    const changed = assumptions[k] !== DEFAULT_ASSUMPTIONS[k];
                    return (
                      <label key={k} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {t(`impact.a_${k}`)}
                          {changed && <span className="ml-1 text-xs text-earth-600">({DEFAULT_ASSUMPTIONS[k]})</span>}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className={`input w-28 text-right ${changed ? 'border-earth-600' : ''}`}
                          step={g.step}
                          min={0}
                          value={assumptions[k]}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v) && v >= 0) setAssumption(k, v);
                          }}
                        />
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </div>
            <div className="border-t border-green-100 p-4">
              <button type="button" onClick={resetAssumptions} className="btn-secondary w-full">
                <RotateCcw className="h-5 w-5" aria-hidden /> {t('impact.resetDefaults')}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
