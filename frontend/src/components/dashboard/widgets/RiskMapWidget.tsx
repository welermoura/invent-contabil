import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import ChartWidget from './ChartWidget';
import { useDashboard } from '../DashboardContext';
import { useDashboardNavigation } from '../../../hooks/useDashboardNavigation';
import { translateStatus } from '../../../utils/translations';

const RiskMapWidget: React.FC = () => {
    const { aggregates, theme } = useDashboard();
    const { navigateToMacroView } = useDashboardNavigation();

    // Map status to risk levels/colors
    // Approved -> Low Risk (Green)
    // Pending -> Medium Risk (Yellow)
    // WriteOff/Transfer -> High Risk (Red/Orange)

    const statusMap: Record<string, { color: string }> = {
        'APPROVED': { color: '#10b981' },
        'PENDING': { color: '#f59e0b' },
        'WRITE_OFF_PENDING': { color: '#ef4444' },
        'TRANSFER_PENDING': { color: '#8b5cf6' },
        'WRITTEN_OFF': { color: '#64748b' },
        'MAINTENANCE': { color: '#eab308' },
        'IN_STOCK': { color: '#0ea5e9' },
        'IN_TRANSIT': { color: '#a855f7' },
        'REJECTED': { color: '#dc2626' }
    };

    const data = Object.entries(aggregates.itemsByStatus)
        .map(([status, count]) => ({
            name: translateStatus(status),
            statusKey: status,
            value: count,
            color: statusMap[status]?.color || '#cbd5e1'
        }))
        .filter(item => item.value > 0);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-100 dark:border-slate-700 shadow-lg rounded-lg">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{payload[0].name}</p>
                    <p className="text-sm" style={{ color: payload[0].payload.color }}>
                        {payload[0].value} itens
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <ChartWidget title="Mapa de Risco (Status)">
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
                        if (data && data.payload) {
                            navigateToMacroView('status', data.payload.statusKey);
                        }
                    }}
                    className="cursor-pointer"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
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

export default RiskMapWidget;
