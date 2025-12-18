import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import ChartWidget from './ChartWidget';
import { useDashboard } from '../DashboardContext';
import { useDashboardNavigation } from '../../../hooks/useDashboardNavigation';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const ValueByCategoryChart: React.FC = () => {
    const { aggregates, theme } = useDashboard();
    const { navigateToMacroView } = useDashboardNavigation();

    const data = Object.entries(aggregates.valueByCategory)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value);

    // Group small categories into "Outros" if too many
    const threshold = 8;
    let chartData = data;
    if (data.length > threshold) {
        const top = data.slice(0, threshold);
        const others = data.slice(threshold).reduce((acc: any, curr: any) => acc + curr.value, 0);
        chartData = [...top, { name: 'Outros', value: others }];
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-lg rounded-lg">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{payload[0].name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {payload[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <ChartWidget title="Valor por Categoria">
            <PieChart onClick={(data) => {
                if (data && data.activePayload) {
                     navigateToMacroView('categoria', data.activePayload[0].payload.name);
                }
            }} className="cursor-pointer">
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                >
                    {chartData.map((_entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={theme === 'dark' ? '#1e293b' : '#fff'} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', color: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                />
            </PieChart>
        </ChartWidget>
    );
};

export default ValueByCategoryChart;
