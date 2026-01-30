import React from 'react';
import ChartWidget from './ChartWidget';
import { useDashboard } from '../DashboardContext';

const RecentItemsTable: React.FC = () => {
    const { aggregates } = useDashboard();

    return (
        <ChartWidget title="Últimos Itens Adicionados">
            <div className="overflow-auto h-full pr-2 custom-scrollbar">
                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                    <thead className="sticky top-0 z-10 text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                        <tr>
                            <th className="px-4 py-3">Descrição</th>
                            <th className="px-4 py-3">Filial</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {aggregates.recentItems.map((item: any, idx: number) => (
                            <tr key={item.id || idx} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
                                    {item.description}
                                </td>
                                <td className="px-4 py-3 truncate max-w-[120px]">
                                    {item.branch ? item.branch.name : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-emerald-400">
                                    {(item.accounting_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ChartWidget>
    );
};

export default RecentItemsTable;
