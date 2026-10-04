export type Lang = 'en' | 'ta' | 'hi';
export type Localized<T = string> = Record<Lang, T>;

export type StageName = 'initial' | 'development' | 'mid' | 'late';

export interface GrowthStage {
  stage: StageName;
  days: number;
  kc: number;
}

export interface Crop {
  id: string;
  name_en: string;
  name_ta: string;
  name_hi: string;
  season: string[];
  sowing_window: { start_month: number; end_month: number };
  duration_days: number;
  spacing_cm: { row: number; plant: number };
  water_need_mm_total: number;
  growth_stages: GrowthStage[];
  heat_tolerance_max_c: number;
  suitable_soils: string[];
  stop_irrigation_days_before_harvest: number;
  harvest_indicators: Localized<string[]>;
  post_harvest_tip: Localized;
  seed_description: string;
  seed_image: string;
  source_note: string;
}

export type ZoneLabel = 'critical' | 'moderate' | 'healthy' | 'waterlogged';

/** GeoJSON coordinates are [lng, lat]. */
export type Ring = [number, number][];
export interface PolygonGeom {
  type: 'Polygon';
  coordinates: Ring[];
}
export interface MultiPolygonGeom {
  type: 'MultiPolygon';
  coordinates: Ring[][];
}

export interface Zone {
  zone_id: string;
  label: ZoneLabel;
  polygon: MultiPolygonGeom;
  area_ha: number;
  stress_score: number;
  moisture_index: number;
  ndvi: number;
  recommended_action_key: string;
}

export interface Field {
  id: string;
  name: string;
  name_local?: Partial<Localized>;
  district: string;
  centroid: { lat: number; lng: number };
  polygon: PolygonGeom;
  area_ha: number;
  suggested_crop_id: string;
  zones: Zone[];
  /** 'sample' = pre-computed sample data; 'simulated' = generated for a user-drawn polygon. */
  zone_source: 'sample' | 'simulated';
}

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  et0_mm: number;
  rain_mm: number;
  temp_max_c: number;
  temp_min_c: number;
}

export interface Weather {
  source: 'live' | 'cached' | 'sample';
  fetched_at: string;
  lat: number;
  lng: number;
  daily: DailyWeather[];
  /** Hourly shortwave radiation, W/m2, local time ISO "YYYY-MM-DDTHH:00". */
  hourly: { time: string[]; shortwave_radiation_wm2: number[] };
}

export type Method = 'flood' | 'drip' | 'precision';
export type PumpType = 'grid' | 'diesel' | 'solar';

export interface Assumptions {
  rain_skip_threshold_mm: number;
  effective_rain_factor: number;
  effective_rain_min_mm: number;
  zone_factor_critical: number;
  zone_factor_moderate: number;
  zone_factor_healthy: number;
  zone_factor_waterlogged: number;
  efficiency_flood: number;
  efficiency_drip: number;
  efficiency_precision: number;
  pump_head_m: number;
  pump_efficiency: number;
  grid_tariff_inr_per_kwh: number;
  solar_marginal_inr_per_kwh: number;
  diesel_litres_per_kwh: number;
  diesel_price_inr_per_litre: number;
  solar_threshold_wm2: number;
  unscheduled_solar_share: number;
  min_irrigation_mm: number;
}

export interface PumpConfig {
  type: PumpType;
  power_kw: number;
}

export type SkipReason =
  | 'rain'
  | 'no_need'
  | 'waterlogged'
  | 'not_sown'
  | 'pre_harvest'
  | 'harvested';

export interface PlanCell {
  date: string;
  zone_id: string;
  action: 'irrigate' | 'skip';
  reason_key: SkipReason | 'irrigate';
  net_mm: number;
  gross_mm: number;
  litres: number;
  kwh: number;
  start_time: string | null; // "HH:MM"
  duration_min: number;
  solar_window: { start: string; end: string } | null;
  solar_share: number;
}

export interface PlanDay {
  date: string;
  et0_mm: number;
  rain_mm: number;
  temp_max_c: number;
  kc: number;
  stage: StageName | null;
  days_after_sowing: number;
  heat_alert: boolean;
  solar_window: { start: string; end: string; hours: number } | null;
  cells: PlanCell[];
  total_litres: number;
  total_kwh: number;
}

export interface Plan {
  days: PlanDay[];
  total_litres: number;
  total_kwh: number;
  solar_share: number;
}

export interface MethodImpact {
  method: Method;
  litres_per_ha: number;
  kwh_per_ha: number;
  cost_inr_per_ha: number;
  solar_share: number;
  /** Cumulative litres/ha at the end of each week of the season. */
  weekly_cumulative_litres_per_ha: number[];
}

export interface Impact {
  season_days: number;
  methods: Record<Method, MethodImpact>;
}
