import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';
import ChartWidget from './ChartWidget';
import { useDashboard } from '../DashboardContext';
import { useDashboardNavigation } from '../../../hooks/useDashboardNavigation';

const ValueByBranchChart: React.FC = () => {
    const { aggregates, theme } = useDashboard();
    const { navigateToMacroView } = useDashboardNavigation();

    const data = Object.entries(aggregates.valueByBranch)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 10); // Top 10 branches

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-lg rounded-lg">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{label}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                        {payload[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <ChartWidget title="Valor Contábil por Filial">
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                onClick={(state) => {
                    if (state && state.activePayload) {
                        navigateToMacroView('branch', state.activePayload[0].payload.name);
                    }
                }}
                className="cursor-pointer"
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                <XAxis type="number" hide />
                <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }}
                />
                <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {data.map((_entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#60a5fa'} />
                    ))}
                    <LabelList
                        dataKey="value"
                        position="right"
                        formatter={(val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
                        style={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 500 }}
                    />
                </Bar>
            </BarChart>
        </ChartWidget>
    );
};

export default ValueByBranchChart;
