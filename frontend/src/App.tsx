import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppStateProvider } from './state/AppState';
import { AppShell } from './components/AppShell';
import { FirstRunLanguage } from './components/FirstRunLanguage';
import { Toaster } from './components/Toast';
import { ZonePatterns } from './components/zoneStyle';
import Landing from './pages/Landing';

const SeedPage = lazy(() => import('./pages/SeedPage'));
const FieldPage = lazy(() => import('./pages/FieldPage'));
const ZonesPage = lazy(() => import('./pages/ZonesPage'));
const PlanPage = lazy(() => import('./pages/PlanPage'));
const ImpactPage = lazy(() => import('./pages/ImpactPage'));

/** /app -> /app/seed, keeping ?demo=1 from the landing CTA. */
function AppIndex() {
  const { search } = useLocation();
  return <Navigate to={`/app/seed${search}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppStateProvider>
        <ZonePatterns />
        <FirstRunLanguage />
        <Toaster />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<AppIndex />} />
              <Route path="seed" element={<SeedPage />} />
              <Route path="field" element={<FieldPage />} />
              <Route path="zones" element={<ZonesPage />} />
              <Route path="plan" element={<PlanPage />} />
              <Route path="impact" element={<ImpactPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppStateProvider>
    </BrowserRouter>
  );
}
