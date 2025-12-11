import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import ChartWidget from './ChartWidget';
import { useDashboard } from '../DashboardContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const EvolutionChart: React.FC = () => {
    const { filteredItems, theme } = useDashboard();

    const itemsWithDate = filteredItems
        .filter((item: any) => item.purchase_date)
        .map((item: any) => ({
            date: new Date(item.purchase_date),
            value: item.accounting_value || 0
        }))
        .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

    // Group by Month
    const monthlyData: Record<string, number> = {};

    // Initialize accumulation
    let runningTotal = 0;

    itemsWithDate.forEach((item: any) => {
        const key = format(item.date, 'yyyy-MM');
         runningTotal += item.value;
         monthlyData[key] = runningTotal;
    });

    const data = Object.entries(monthlyData).map(([key, value]) => ({
        date: key,
        displayDate: format(parseISO(key + '-01'), 'MMM yy', { locale: ptBR }),
        value: value
    }));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-lg rounded-lg">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                         {format(parseISO(payload[0].payload.date + '-01'), 'MMMM yyyy', { locale: ptBR })}
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        {payload[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <ChartWidget title="Evolução Patrimonial (Acumulada)">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                <XAxis
                    dataKey="displayDate"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }}
                    tickFormatter={(val) => new Intl.NumberFormat('pt-BR', { notation: "compact", compactDisplay: "short" }).format(val)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    strokeWidth={2}
                />
            </AreaChart>
        </ChartWidget>
    );
};

export default EvolutionChart;
