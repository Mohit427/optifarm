import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Assumptions, Crop, Field, Impact, Plan, PumpConfig, Weather } from '../lib/types';
import { DEFAULT_ASSUMPTIONS, SAMPLE_FIELDS, addDays, cropById, todayIso } from '../lib/data';
import { storage } from '../lib/storage';
import { loadWeather } from '../lib/weather';
import { buildPlan, seasonImpact } from '../lib/waterModel';
import { checkHealth } from '../lib/api';

export type CurrentMethod = 'flood' | 'furrow' | 'drip';

export interface Persisted {
  cropId: string | null;
  cropConfirmed: boolean;
  fieldId: string | null;
  customField: Field | null;
  sowingDate: string;
  currentMethod: CurrentMethod;
  pump: PumpConfig;
  assumptions: Assumptions;
}

const STATE_KEY = 'kl.state.v1';

const defaults = (): Persisted => ({
  cropId: null,
  cropConfirmed: false,
  fieldId: null,
  customField: null,
  sowingDate: todayIso(),
  currentMethod: 'flood',
  pump: { type: 'grid', power_kw: 3.7 },
  assumptions: { ...DEFAULT_ASSUMPTIONS },
});

interface Connectivity {
  online: boolean;
  backend: boolean;
  ai: boolean;
}

interface AppStateValue extends Persisted {
  update: (patch: Partial<Persisted>) => void;
  setAssumption: (key: keyof Assumptions, value: number) => void;
  resetAssumptions: () => void;
  loadDemo: () => void;
  crop: Crop | undefined;
  field: Field | undefined;
  weather: Weather | null;
  weatherLoading: boolean;
  plan: Plan | null;
  impact: Impact | null;
  connectivity: Connectivity;
  demoActive: boolean;
  demoStep: number;
  setDemo: (active: boolean, step?: number) => void;
}

const Ctx = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => {
    const saved = storage.get<Partial<Persisted>>(STATE_KEY);
    const merged = { ...defaults(), ...saved };
    // New assumption keys added after a save still get their defaults.
    merged.assumptions = { ...DEFAULT_ASSUMPTIONS, ...saved?.assumptions };
    return merged;
  });
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [connectivity, setConnectivity] = useState<Connectivity>({
    online: navigator.onLine,
    backend: false,
    ai: false,
  });
  const [demo, setDemoState] = useState({ active: false, step: 0 });

  useEffect(() => storage.set(STATE_KEY, state), [state]);

  const update = useCallback((patch: Partial<Persisted>) => setState((s) => ({ ...s, ...patch })), []);

  const setAssumption = useCallback(
    (key: keyof Assumptions, value: number) =>
      setState((s) => ({ ...s, assumptions: { ...s.assumptions, [key]: value } })),
    [],
  );
  const resetAssumptions = useCallback(
    () => setState((s) => ({ ...s, assumptions: { ...DEFAULT_ASSUMPTIONS } })),
    [],
  );

  const loadDemo = useCallback(() => {
    setState((s) => ({
      ...s,
      cropId: 'paddy',
      cropConfirmed: true,
      fieldId: SAMPLE_FIELDS[0].id,
      customField: null,
      // Mid-season, so the plan shows real irrigation decisions.
      sowingDate: addDays(todayIso(), -48),
      currentMethod: 'flood',
      pump: { type: 'solar', power_kw: 3.7 },
      assumptions: { ...DEFAULT_ASSUMPTIONS },
    }));
  }, []);

  const setDemo = useCallback((active: boolean, step = 0) => setDemoState({ active, step }), []);

  // ---- connectivity: browser online flag + backend health ping
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const h = navigator.onLine ? await checkHealth() : { ok: false, ai: false };
      if (alive) setConnectivity({ online: navigator.onLine, backend: h.ok, ai: h.ai });
    };
    void ping();
    const id = window.setInterval(ping, 30_000);
    window.addEventListener('online', ping);
    window.addEventListener('offline', ping);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener('online', ping);
      window.removeEventListener('offline', ping);
    };
  }, []);

  // The farmer must confirm the crop before any plan is generated.
  const crop = state.cropConfirmed ? cropById(state.cropId) : undefined;
  const field = useMemo(
    () =>
      state.fieldId === 'custom'
        ? (state.customField ?? undefined)
        : SAMPLE_FIELDS.find((f) => f.id === state.fieldId),
    [state.fieldId, state.customField],
  );

  // ---- weather for the selected field (or Tamil Nadu centre)
  const lat = field?.centroid.lat ?? 10.8;
  const lng = field?.centroid.lng ?? 78.7;
  useEffect(() => {
    let alive = true;
    setWeatherLoading(true);
    loadWeather(+lat.toFixed(3), +lng.toFixed(3))
      .then((w) => alive && setWeather(w))
      .finally(() => alive && setWeatherLoading(false));
    return () => {
      alive = false;
    };
  }, [lat, lng, connectivity.online]);

  const plan = useMemo(
    () =>
      crop && field && weather
        ? buildPlan({
            crop,
            field,
            sowingDate: state.sowingDate,
            pump: state.pump,
            weather,
            assumptions: state.assumptions,
          })
        : null,
    [crop, field, weather, state.sowingDate, state.pump, state.assumptions],
  );

  const impact = useMemo(
    () =>
      crop && field
        ? seasonImpact({
            crop,
            zones: field.zones,
            sowingDate: state.sowingDate,
            pump: state.pump,
            assumptions: state.assumptions,
          })
        : null,
    [crop, field, state.sowingDate, state.pump, state.assumptions],
  );

  const value: AppStateValue = {
    ...state,
    update,
    setAssumption,
    resetAssumptions,
    loadDemo,
    crop,
    field,
    weather,
    weatherLoading,
    plan,
    impact,
    connectivity,
    demoActive: demo.active,
    demoStep: demo.step,
    setDemo,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
