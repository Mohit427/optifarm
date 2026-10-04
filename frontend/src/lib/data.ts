import cropsJson from '../data/crops.json';
import fieldsJson from '../data/fields.json';
import assumptionsJson from '../data/assumptions.json';
import type { Assumptions, Crop, Field, Lang } from './types';
import { BCP47 } from '../i18n';

export const CROPS = cropsJson.crops as Crop[];
export const SAMPLE_FIELDS = fieldsJson.fields as unknown as Field[];
export const DEFAULT_ASSUMPTIONS = assumptionsJson as Assumptions;

export const cropById = (id: string | null | undefined): Crop | undefined =>
  CROPS.find((c) => c.id === id);

export const cropName = (crop: Crop, lang: Lang) =>
  lang === 'ta' ? crop.name_ta : lang === 'hi' ? crop.name_hi : crop.name_en;

export const monthName = (month: number, lang: Lang) =>
  new Intl.DateTimeFormat(BCP47[lang], { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, month - 1, 1)),
  );

export const formatDate = (iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat(BCP47[lang], { timeZone: 'UTC', ...opts }).format(
    new Date(`${iso}T00:00:00Z`),
  );

export const fmt = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(
    n,
  );

/** Compact number for chart axes, e.g. 12k, 1.5M (never "L", which would read as litres). */
export const fmtCompact = (n: number) =>
  // en-US on purpose: en-IN compact output uses "L"/"Cr" for lakh/crore.
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
