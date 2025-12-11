import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import ChartWidget from './ChartWidget';
import { useDashboard } from '../DashboardContext';

const PurchaseVsAccountingChart: React.FC = () => {
    const { aggregates, theme } = useDashboard();

    const data = [
        {
            name: 'Total',
            Compra: aggregates.totalPurchaseValue,
            Contábil: aggregates.totalValue
        }
    ];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-lg rounded-lg">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{label}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                        Compra: {payload[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        Contábil: {payload[1].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <ChartWidget title="Valor de Compra vs. Contábil">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="name" hide />
                <YAxis
                    tickFormatter={(val) => val.toLocaleString('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' })}
                    tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }}
                />
                <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: theme === 'dark' ? '#94a3b8' : '#64748b' }}/>
                <Bar dataKey="Compra" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Valor de Compra" />
                <Bar dataKey="Contábil" fill="#10b981" radius={[4, 4, 0, 0]} name="Valor Contábil" />
            </BarChart>
        </ChartWidget>
    );
};

export default PurchaseVsAccountingChart;
