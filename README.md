# OptiFarm

**Identify → Plan → Irrigate → Prove.** A voice-first, multilingual (Tamil, Hindi, English)
progressive web app for smallholder farmers. Prototype for the Schneider Electric Yuva Yodha
Energy Hackathon, Challenge 01: Sustainable Agriculture (Energy, Water and Productivity).

A farmer photographs a seed and sees an AR-style card of its agronomy facts, marks a field
and sees colour-, pattern- and icon-coded stress zones, gets a solar-aware 7-day irrigation
plan that skips rain, and sees litres, kWh and rupees saved against flood irrigation. A
grounded assistant answers questions by text or voice.

## Quick start

Prerequisites: Node 20+ and Python 3.11+ (tested with Node 26 and CPython 3.14).

```bash
# 1. Configuration (optional: the app runs without an API key)
cp .env.example .env            # then set ANTHROPIC_API_KEY=...

# 2. Backend (FastAPI on :8000)
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Frontend (Vite on :5173, proxies /api to :8000)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and press **Try the Demo**.

> **Windows note:** if `python` on your PATH is an MSYS2/MinGW build, create the venv with the
> official interpreter instead (`py -3.14 -m venv .venv`); MSYS2 Python has no binary wheels
> for pydantic.

Production build and PWA check: `npm run build && npm run preview` (http://localhost:4173).
The service worker is active only in the build.

### Tests

```bash
cd backend  && python -m pytest        # 24 tests: water model formulas, plan rules, API, validation
cd frontend && npm test                # 9 tests: the same model in TypeScript, solar window, zoning
cd frontend && npm run lint            # ESLint; `npx tsc -b` for strict type-checking
```

The TypeScript and Python models are mirrors and give identical season results.

## Demo walkthrough

Landing page → **Try the Demo** loads a guided 5-step stepper with sample data (paddy, a
Thanjavur delta field, 3.7 kW solar pump, sown 48 days ago). Step through Seed → Field →
Zones → Plan → Impact with **Next**, or use the **Demo mode** toggle in the top bar at any time.
See [docs/demo-script.md](docs/demo-script.md) for a 2-minute narration.

## What is where

```
frontend/                React 18 + Vite + TypeScript (strict) + Tailwind
  src/pages/             Landing, SeedPage, FieldPage, ZonesPage, PlanPage, ImpactPage
  src/components/        SeedOverlay, FieldMap (Leaflet), ScheduleGrid, SunArc, ImpactCharts,
                         AssumptionsDrawer, ChatWidget, DemoStepper, LanguageSwitcher, ...
  src/lib/               waterModel, solarWindow, geo (area + zoning), weather, api, chat
                         (context builder + offline FAQ), voice (TTS/STT)
  src/data/              crops.json, fields.json, assumptions.json, climate.json, weatherFallback.json
  src/i18n/              en.ts, ta.ts, hi.ts (type-checked for missing keys)
  scripts/               gen-data.ts (sample fields, weather, seed images), gen-icons.mjs
backend/                 FastAPI
  app/routers/           data (health, crops, weather), seed, plan, chat
  app/services/          vision, water_model, solar, weather, chat_context, ai
  app/models/            Pydantic request/response schemas
  tests/
docs/                    assumptions.md, data-model.md, demo-script.md
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Status, whether AI is configured, model name. |
| GET | `/api/crops` | Curated crop database. |
| GET | `/api/weather?lat&lng` | Normalised 7-day Open-Meteo forecast (ET0, rain, temperature, hourly radiation), with cached and sample fallbacks. |
| POST | `/api/seed/identify` | Multipart `image`. Returns validated top-3 `{crop_id, confidence}`; ids not in the crop DB are dropped. Image processed in memory, never stored. |
| POST | `/api/plan` | Field zones, crop, sowing date, pump, optional assumptions/weather → 7-day plan and season impact for all three methods. |
| POST | `/api/chat` | Last ≤10 messages, language, app context → `{reply, action}`. 503 when AI is unavailable, so the client uses its offline FAQ. |

Interactive docs at http://localhost:8000/docs.

## How the requirements are met

| Requirement | Implementation |
|---|---|
| Seed facts never from the model | The vision call is constrained by a JSON schema whose `crop_id` is an enum of DB ids, and the backend re-validates. All displayed facts come from `crops.json`. |
| Confirmation and uncertainty | Top-3 chips with confidence bars, warning below 0.6, explicit **Confirm**, manual picker. No plan is generated until a crop is confirmed. |
| Zone map without colour-only meaning | Hatch/dot/wave patterns plus icons (!, ~, ✓, ≈) on map, legend and lists. |
| Solar-aware, rain-aware plan | See [docs/assumptions.md](docs/assumptions.md). |
| Editable baseline | Assumptions drawer with live recalculation and reset; printed with the exported summary. |
| Grounded, safe assistant | Backend loads the crop record from its own DB and adds the field, plan and forecast; the system prompt limits answers to that context and redirects pesticide, medical, legal and loan questions to the KVK / Kisan Call Centre (1800-180-1551). Structured output returns an optional navigation action. |
| Offline | PWA precaches the app shell, crop DB, sample fields, translations and seed images; tiles and forecasts are runtime-cached. Offline badge explains what is limited. |
| Voice | Browser TTS picks a voice matching the language and shows a notice when none exists; STT via Web Speech API with typed fallback. |
| Security | API key read only by the backend; CORS restricted to configured origins; per-IP rate limit on AI endpoints; uploads type- and size-checked. |

AI calls use the Anthropic Messages API (`claude-sonnet-5-5` by default, configurable) with
structured JSON output, low effort for fast short answers, and the server-side refusal
fallback (`fallbacks: "default"`) enabled.

## Known limitations

- Zone data for sample fields is synthetic; drawn fields get *simulated* zones (clearly labelled). Live Sentinel-2 NDVI/NDMI is a stretch goal.
- Seed identification depends on photo quality and the model; confidences are model-reported, not calibrated.
- Sample seed images are illustrations with pre-computed matches for an offline-capable demo.
- Season impact uses monthly climatology, not a full soil water balance; paddy flooding/percolation is not modelled (see [docs/assumptions.md](docs/assumptions.md)).
- Tamil and Hindi strings are machine-assisted and marked for native-speaker review in `ta.ts` / `hi.ts`.
- Browser TTS/STT availability for Tamil and Hindi varies by device (best on Android Chrome).
- Place search uses the public Nominatim service and needs connectivity.
- No accounts: state lives in the browser's `localStorage`.

## Data sources and credits

Open-Meteo forecast API; crop parameters compiled from public ICAR, TNAU Agritech Portal and
FAO-56 guidance (indicative, verify locally); Copernicus Sentinel-2 (zoning concept);
map tiles © Esri / Maxar and © OpenStreetMap contributors.
