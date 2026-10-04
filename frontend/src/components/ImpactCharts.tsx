import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { Impact, Method } from '../lib/types';
import { METHODS } from '../lib/waterModel';
import { fmt, fmtCompact } from '../lib/data';
import { METHOD_COLOR } from './methodColors';

const axis = { fontSize: 12, fill: '#475569' };

function MetricBars({
  title,
  unit,
  data,
  selected,
}: {
  title: string;
  unit: string;
  data: { method: Method; name: string; value: number }[];
  selected: Method;
}) {
  return (
    <figure className="rounded-2xl border border-green-100 p-3">
      <figcaption className="px-1 text-sm font-bold text-green-900">
        {title} <span className="font-normal text-slate-500">({unit})</span>
      </figcaption>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} interval={0} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => fmtCompact(v)} />
            <Tooltip
              cursor={{ fill: 'rgba(20,83,45,0.06)' }}
              formatter={(v: number) => [`${fmt(v)} ${unit}`, title]}
              contentStyle={{ borderRadius: 12, border: '1px solid #DCFCE7' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive minPointSize={2}>
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: number) => (unit === '₹' ? `₹${fmtCompact(v)}` : fmtCompact(v))}
                style={{ fontSize: 12, fontWeight: 700, fill: '#0F172A' }}
              />
              {data.map((d) => (
                <Cell
                  key={d.method}
                  fill={METHOD_COLOR[d.method]}
                  fillOpacity={d.method === selected ? 1 : 0.45}
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default function ImpactCharts({ impact, selected }: { impact: Impact; selected: Method }) {
  const { t } = useTranslation();
  const names: Record<Method, string> = {
    flood: t('impact.flood'),
    drip: t('impact.drip'),
    precision: t('impact.precision'),
  };
  const shortNames: Record<Method, string> = {
    flood: t('impact.floodShort'),
    drip: t('impact.dripShort'),
    precision: t('impact.precisionShort'),
  };
  const series = (key: 'litres_per_ha' | 'kwh_per_ha' | 'cost_inr_per_ha', scale = 1) =>
    METHODS.map((m) => ({ method: m, name: shortNames[m], value: impact.methods[m][key] / scale }));

  const flood = impact.methods.flood.weekly_cumulative_litres_per_ha;
  const chosen = impact.methods[selected === 'flood' ? 'precision' : selected].weekly_cumulative_litres_per_ha;
  const lineName = selected === 'flood' ? names.precision : names[selected];
  const cumulative = flood.map((f, i) => ({ week: i + 1, saved: Math.max(0, f - (chosen[i] ?? 0)) / 1000 }));

  return (
    <div className="space-y-6">
      <section aria-labelledby="compare-title">
        <h2 id="compare-title" className="mb-3 text-lg font-bold">
          {t('impact.compareTitle')}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricBars title={t('impact.water')} unit="kL" data={series('litres_per_ha', 1000)} selected={selected} />
          <MetricBars title={t('impact.energy')} unit="kWh" data={series('kwh_per_ha')} selected={selected} />
          <MetricBars title={t('impact.cost')} unit="₹" data={series('cost_inr_per_ha')} selected={selected} />
        </div>
      </section>

      <figure aria-labelledby="cum-title" className="rounded-2xl border border-green-100 p-3">
        <figcaption id="cum-title" className="px-1 text-lg font-bold text-green-900">
          {t('impact.cumulativeTitle')} <span className="text-sm font-normal text-slate-500">— {lineName}</span>
        </figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulative} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="savedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#15803D" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#15803D" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="week"
                tick={axis}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1' }}
                label={{ value: t('impact.week'), position: 'insideBottomRight', offset: -2, fontSize: 12, fill: '#475569' }}
              />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => fmtCompact(v)} />
              <Tooltip
                formatter={(v: number) => [`${fmt(v)} kL`, t('impact.savedLine')]}
                labelFormatter={(w) => `${t('impact.week')} ${w}`}
                contentStyle={{ borderRadius: 12, border: '1px solid #DCFCE7' }}
              />
              <Area type="monotone" dataKey="saved" stroke="#15803D" strokeWidth={2} fill="url(#savedFill)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </figure>

      {/* Table view of the same numbers, for screen readers and print. */}
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t('impact.compareTitle')}</caption>
        <thead>
          <tr className="border-b border-green-100 text-slate-600">
            <th scope="col" className="py-2">{t('impact.method')}</th>
            <th scope="col">{t('impact.water')} (L)</th>
            <th scope="col">{t('impact.energy')} (kWh)</th>
            <th scope="col">{t('impact.cost')} (₹)</th>
          </tr>
        </thead>
        <tbody>
          {METHODS.map((m) => (
            <tr key={m} className="border-b border-green-50">
              <th scope="row" className="py-2 font-semibold">
                <span className="mr-2 inline-block h-3 w-3 rounded-sm" style={{ background: METHOD_COLOR[m] }} aria-hidden />
                {names[m]}
              </th>
              <td>{fmt(impact.methods[m].litres_per_ha)}</td>
              <td>{fmt(impact.methods[m].kwh_per_ha)}</td>
              <td>{fmt(impact.methods[m].cost_inr_per_ha)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
