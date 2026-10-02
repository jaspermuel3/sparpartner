'use client'

import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend as ReLegend,
} from 'recharts'

interface LeadTrendChartProps {
  data: Array<{ date: string; 'Neue Leads': number; Abschlüsse: number }>
}

export function LeadTrendChart({ data }: LeadTrendChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 8, right: 16, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
              fontSize: 12,
            }}
          />
          <ReLegend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Neue Leads" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Abschlüsse" fill="#10b981" radius={[6, 6, 0, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}
