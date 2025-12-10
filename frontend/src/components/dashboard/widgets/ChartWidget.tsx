import React from 'react';
import { ResponsiveContainer } from 'recharts';
import { MoreHorizontal } from 'lucide-react';

interface ChartWidgetProps {
    title: string;
    children: React.ReactNode;
    height?: number;
    actions?: React.ReactNode;
}

const ChartWidget: React.FC<ChartWidgetProps> = ({ title, children, actions }) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col h-full transition-colors overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                    {title}
                </h3>
                <div className="flex items-center gap-2">
                    {actions}
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
                        <MoreHorizontal size={18} />
                    </button>
                </div>
            </div>

            <div className="w-full flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    {children as any}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartWidget;
