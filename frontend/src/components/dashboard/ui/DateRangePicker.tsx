import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { subMonths, subYears, startOfYear, startOfMonth } from 'date-fns';

export interface DateRange {
    startDate: Date | null;
    endDate: Date | null;
    label: string;
}

interface DateRangePickerProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
}

const PRESETS = [
    { label: 'Todo o Período', getValue: () => ({ startDate: null, endDate: null }) },
    { label: 'Este Mês', getValue: () => ({ startDate: startOfMonth(new Date()), endDate: new Date() }) },
    { label: 'Últimos 3 Meses', getValue: () => ({ startDate: subMonths(new Date(), 3), endDate: new Date() }) },
    { label: 'Este Ano', getValue: () => ({ startDate: startOfYear(new Date()), endDate: new Date() }) },
    { label: 'Último Ano', getValue: () => ({ startDate: subYears(new Date(), 1), endDate: new Date() }) },
];

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handlePresetClick = (preset: typeof PRESETS[0]) => {
        const { startDate, endDate } = preset.getValue();
        onChange({ startDate, endDate, label: preset.label });
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">Período</label>
            <button
                className="w-full md:w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 truncate text-slate-700 dark:text-slate-200">
                    <Calendar size={16} className="text-slate-400" />
                    <span>{value.label}</span>
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                     <div className="py-1">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${value.label === preset.label ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}
                                onClick={() => handlePresetClick(preset)}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    {/* Custom date picker could go here in v2 */}
                </div>
            )}

            {/* Backdrop to close */}
            {isOpen && (
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
            )}
        </div>
    );
};

export default DateRangePicker;
