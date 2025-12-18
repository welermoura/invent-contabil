import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import ChartWidget from './ChartWidget';
import { useDashboard } from '../DashboardContext';
import { useDashboardNavigation } from '../../../hooks/useDashboardNavigation';

const CountByCategoryChart: React.FC = () => {
    const { aggregates, theme } = useDashboard();
    const { navigateToMacroView } = useDashboardNavigation();

    // Convert aggregates.countByCategory to array and sort
    const data = Object.entries(aggregates.countByCategory)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 8); // Top 8 categories

    // Calculate 'Others'
    const totalTop = data.reduce((sum: number, item: any) => sum + item.value, 0);
    const totalAll = Object.values(aggregates.countByCategory).reduce((sum: number, val: any) => sum + val, 0);

    if (totalAll > totalTop) {
        data.push({ name: 'Outros', value: totalAll - totalTop });
    }

    const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-lg rounded-lg">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{payload[0].name}</p>
                    <p className="text-sm text-violet-600 dark:text-violet-400">
                        {payload[0].value} itens
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <ChartWidget title="Quantidade por Categoria">
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke={theme === 'dark' ? '#1e293b' : '#fff'}
                    strokeWidth={2}
                    onClick={(data) => {
                         if (data) {
                             navigateToMacroView('categoria', data.name);
                         }
                    }}
                    className="cursor-pointer"
                >
                    {data.map((_entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

export default CountByCategoryChart;
