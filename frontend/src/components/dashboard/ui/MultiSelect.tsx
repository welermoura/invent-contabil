import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';

export interface Option {
    id: string | number;
    label: string;
}

interface MultiSelectProps {
    options: Option[];
    value: (string | number)[];
    onChange: (value: (string | number)[]) => void;
    label: string;
    placeholder?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, value, onChange, label, placeholder = "Selecione..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (optionId: string | number) => {
        const newValue = value.includes(optionId)
            ? value.filter(id => id !== optionId)
            : [...value, optionId];
        onChange(newValue);
    };

    const handleSelectAll = () => {
        if (value.length === options.length) {
            onChange([]);
        } else {
            onChange(options.map(o => o.id));
        }
    };

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getDisplayText = () => {
        if (value.length === 0) return placeholder;
        if (value.length === options.length) return `Todos (${options.length})`;
        if (value.length === 1) return options.find(o => o.id === value[0])?.label || placeholder;
        return `${value.length} selecionados`;
    };

    return (
        <div className="relative w-full md:w-64" ref={dropdownRef}>
            <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{label}</label>
            <button
                type="button"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`truncate ${value.length === 0 ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {getDisplayText()}
                </span>
                <div className="flex items-center gap-1">
                    {value.length > 0 && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange([]);
                            }}
                            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                            <X size={14} />
                        </div>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 origin-top">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-blue-400 text-slate-700 dark:text-slate-200"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                        {filteredOptions.length > 0 && (
                             <div
                                className="flex items-center px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer rounded-md text-sm font-medium text-blue-600 dark:text-blue-400"
                                onClick={handleSelectAll}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors ${value.length === options.length ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                    {value.length === options.length && <Check size={10} className="text-white" />}
                                </div>
                                {value.length === options.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </div>
                        )}

                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-slate-400">
                                Nenhuma opção encontrada
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.id}
                                    className="flex items-center px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer rounded-md transition-colors"
                                    onClick={() => toggleOption(option.id)}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors ${value.includes(option.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {value.includes(option.id) && <Check size={10} className="text-white" />}
                                    </div>
                                    <span className={`text-sm ${value.includes(option.id) ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {option.label}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
