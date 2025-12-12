import React from 'react';
import ChartWidget from './ChartWidget';
import { useDashboard } from '../DashboardContext';
import { useNavigate } from 'react-router-dom';

const TopItemsTable: React.FC = () => {
    const { aggregates } = useDashboard();
    const navigate = useNavigate();
    const items = aggregates.topItems;

    return (
        <ChartWidget title="Top 10 Itens por Valor Contábil" height={360}>
            <div className="overflow-auto h-full pr-2 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <tr>
                            <th className="py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">Descrição</th>
                            <th className="py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {items.map((item: any) => (
                            <tr
                                key={item.id}
                                className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                                onClick={() => navigate(`/inventory?search=${item.fixed_asset_number || item.description}`)}
                            >
                                <td className="py-3 pr-4">
                                    <div className="flex items-center">
                                        <div>
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px] sm:max-w-[200px]">
                                                {item.description}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-500">
                                                {item.branch?.name} • {item.fixed_asset_number || 'S/N'}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 text-right">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        {(item.accounting_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-1 mt-1 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${Math.min(((item.accounting_value || 0) / (items[0]?.accounting_value || 1)) * 100, 100)}%` }}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={2} className="py-8 text-center text-slate-400 text-sm">
                                    Nenhum item encontrado
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ChartWidget>
    );
};

export default TopItemsTable;
