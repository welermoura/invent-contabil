import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    icon: LucideIcon;
    colorClass: string; // e.g., 'text-blue-500'
    onClick?: () => void;
    isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, icon: Icon, colorClass, onClick, isLoading }) => {
    // Extract base color name (e.g., 'blue') from 'text-blue-500'
    const colorMatch = colorClass.match(/text-(\w+)-/);
    const colorName = colorMatch ? colorMatch[1] : 'slate';

    return (
        <div
            className={`
                bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700
                transition-all duration-300 hover:shadow-md
                ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}
            `}
            onClick={onClick}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    {isLoading ? (
                        <div className="h-8 w-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mt-2"></div>
                    ) : (
                        <h3 className={`text-2xl lg:text-3xl font-bold mt-2 text-slate-800 dark:text-white`}>
                            {value}
                        </h3>
                    )}
                </div>
                <div className={`p-3 rounded-lg bg-${colorName}-50 dark:bg-${colorName}-900/20`}>
                    <Icon className={colorClass} size={24} />
                </div>
            </div>
            {(subtext || isLoading) && (
                <div className="mt-4 flex items-center text-xs font-medium text-slate-400 dark:text-slate-500">
                    {isLoading ? (
                         <div className="h-4 w-32 bg-slate-50 dark:bg-slate-800 rounded animate-pulse"></div>
                    ) : (
                        <span>{subtext}</span>
                    )}
                </div>
            )}
        </div>
    );
};

export default StatCard;
