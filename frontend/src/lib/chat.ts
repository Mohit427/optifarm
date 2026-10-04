import type { TFunction } from 'i18next';
import type { Crop, Field, Lang, Plan, PumpConfig, Weather, ZoneLabel } from './types';
import { cropName, fmt, monthName } from './data';
import { zonesByPriority } from './waterModel';
import { apiPost } from './api';

export type NavTarget = 'seed' | 'field' | 'zones' | 'plan' | 'impact';
export interface ChatAction {
  type: 'navigate';
  target: NavTarget;
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: ChatAction | null;
  source?: 'ai' | 'fallback';
}

const ACTION_TEXT_EN: Record<ZoneLabel, string> = {
  critical: 'Water this zone first and a little more; check for blocked channels or low pump pressure.',
  moderate: 'Water normally; watch for afternoon leaf curling.',
  healthy: 'Crop is doing well; give a little less water to save power.',
  waterlogged: 'Do not water; open a drain channel.',
};

export interface AppContextForChat {
  crop?: Crop;
  field?: Field;
  plan: Plan | null;
  weather: Weather | null;
  sowingDate: string;
  pump: PumpConfig;
  page: string;
}

/**
 * Compact, model-friendly summary of what the app knows. The backend re-fetches the
 * crop record from its own database by id, so crop facts are never taken from here.
 */
export function buildChatContext(c: AppContextForChat) {
  const zoneNo = (id: string) => (c.field ? c.field.zones.findIndex((z) => z.zone_id === id) + 1 : 0);
  return {
    crop_id: c.crop?.id ?? null,
    sowing_date: c.sowingDate,
    current_page: c.page,
    pump: c.pump,
    field: c.field
      ? {
          name: c.field.name,
          area_ha: +c.field.area_ha.toFixed(2),
          zone_data: c.field.zone_source === 'sample' ? 'sample satellite-style indices' : 'simulated for a drawn field',
          zones: c.field.zones.map((z, i) => ({
            name: `Zone ${i + 1}`,
            class: z.label,
            map_colour: { critical: 'red', moderate: 'amber', healthy: 'green', waterlogged: 'blue' }[z.label],
            area_ha: z.area_ha,
            stress_score: z.stress_score,
            soil_moisture_index: z.moisture_index,
            ndvi: z.ndvi,
            recommended_action: ACTION_TEXT_EN[z.label],
          })),
        }
      : null,
    plan_7_day: c.plan
      ? c.plan.days.map((d) => ({
          date: d.date,
          crop_stage: d.stage,
          rain_mm: +d.rain_mm.toFixed(1),
          temp_max_c: d.temp_max_c,
          heat_alert: d.heat_alert,
          solar_window: d.solar_window ? `${d.solar_window.start}-${d.solar_window.end}` : null,
          zones: d.cells.map((cell) => ({
            zone: `Zone ${zoneNo(cell.zone_id)}`,
            action: cell.action,
            reason: cell.reason_key,
            start: cell.start_time,
            minutes: cell.duration_min,
            litres: Math.round(cell.litres),
          })),
        }))
      : null,
    weather: c.weather
      ? {
          source: c.weather.source,
          daily: c.weather.daily.slice(0, 7),
        }
      : null,
  };
}

export async function askAssistant(messages: ChatMessage[], language: Lang, context: unknown) {
  return apiPost<{ reply: string; action: ChatAction | null }>(
    '/chat',
    {
      messages: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      language,
      context,
    },
    40000,
  );
}

// ------------------------------------------------------------------ offline FAQ

const INTENTS: { intent: string; words: string[] }[] = [
  { intent: 'zone', words: ['zone', 'red', 'amber', 'மண்டல', 'சிவப்', 'क्षेत्र', 'ज़ोन', 'जोन', 'लाल'] },
  { intent: 'rain', words: ['rain', 'மழை', 'बारिश', 'वर्षा'] },
  { intent: 'harvest', words: ['harvest', 'ready', 'அறுவடை', 'कटाई'] },
  { intent: 'sowing', words: ['sow', 'plant', 'விதை', 'बुवाई', 'बोन', 'बोए', 'बोई'] },
  { intent: 'heat', words: ['heat', 'hot', 'temperature', 'வெப்ப', 'வெயில்', 'गर्मी', 'तापमान'] },
  { intent: 'today', words: ['today', 'இன்று', 'आज'] },
  { intent: 'water', words: ['water', 'irrigat', 'நீர்', 'தண்ணீர்', 'பாசன', 'पानी', 'सिंचाई'] },
];

/** Rule-based answers from the crop DB and the computed plan, used when live AI is unavailable. */
export function faqAnswer(
  question: string,
  t: TFunction,
  lang: Lang,
  ctx: AppContextForChat,
): { reply: string; action: ChatAction | null } {
  const q = question.toLowerCase();
  const intent = INTENTS.find((i) => i.words.some((w) => q.includes(w)))?.intent;
  const { crop, field, plan } = ctx;
  const name = crop ? cropName(crop, lang) : '';

  if (!intent) return { reply: t('faq.unknown'), action: null };
  if (!crop && intent !== 'rain') return { reply: t('faq.noCrop'), action: { type: 'navigate', target: 'seed' } };

  switch (intent) {
    case 'sowing':
      return {
        reply: t('faq.sowing', {
          crop: name,
          start: monthName(crop!.sowing_window.start_month, lang),
          end: monthName(crop!.sowing_window.end_month, lang),
          season: crop!.season.map((s) => t(`crops.season_${s}`)).join(', '),
        }),
        action: null,
      };
    case 'harvest':
      return {
        reply: t('faq.harvest', { crop: name, days: crop!.duration_days, signs: crop!.harvest_indicators[lang].join('; ') }),
        action: null,
      };
    case 'heat':
      return { reply: t('faq.heat', { crop: name, c: crop!.heat_tolerance_max_c }), action: { type: 'navigate', target: 'plan' } };
    case 'rain': {
      const days = (plan?.days ?? [])
        .filter((d) => d.rain_mm >= 2)
        .map((d) => `${d.date.slice(5)} (${fmt(d.rain_mm, 1)} mm)`);
      return { reply: days.length ? t('faq.rain', { days: days.join(', ') }) : t('faq.rainNone'), action: { type: 'navigate', target: 'plan' } };
    }
    case 'zone': {
      if (!field) return { reply: t('zones.needField'), action: { type: 'navigate', target: 'field' } };
      const n = Number(q.match(/\d+/)?.[0] ?? 0);
      const zone = field.zones[n - 1] ?? zonesByPriority(field.zones)[0];
      const idx = field.zones.indexOf(zone) + 1;
      const actionKey = { critical: 'actionCritical', moderate: 'actionModerate', healthy: 'actionHealthy', waterlogged: 'actionWaterlogged' }[zone.label];
      return {
        reply: t('faq.zone', { zone: t('zones.zoneName', { n: idx }), label: t(`zones.${zone.label}`), action: t(`zones.${actionKey}`) }),
        action: { type: 'navigate', target: 'zones' },
      };
    }
    case 'today':
    case 'water': {
      const today = plan?.days[0];
      if (!today || !field) return { reply: t('faq.water', { crop: name, mm: crop!.water_need_mm_total }), action: null };
      const runs = today.cells.filter((c) => c.action === 'irrigate');
      if (!runs.length) return { reply: t('faq.todayNone'), action: { type: 'navigate', target: 'plan' } };
      const summary = runs
        .map((c) => `${t('zones.zoneName', { n: field.zones.findIndex((z) => z.zone_id === c.zone_id) + 1 })} ${c.start_time}, ${c.duration_min} ${t('common.minutes')}, ${fmt(c.litres)} L`)
        .join('; ');
      return { reply: t('faq.today', { summary }), action: { type: 'navigate', target: 'plan' } };
    }
  }
  return { reply: t('faq.unknown'), action: null };
}
