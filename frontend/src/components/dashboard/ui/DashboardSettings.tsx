import React, { useState } from 'react';
import { useDashboard } from '../DashboardContext';
import { WIDGETS } from '../DraggableGrid';
import { Settings, Save, Layout, Check, X, Eye, EyeOff, RotateCcw, Download, Upload } from 'lucide-react';

const DashboardSettings: React.FC = () => {
    const { layout, setLayout, resetLayout } = useDashboard();
    const [isOpen, setIsOpen] = useState(false);
    const [presetName, setPresetName] = useState('');

    const toggleWidget = (widgetId: string) => {
        if (layout.includes(widgetId)) {
            setLayout(layout.filter((id: string) => id !== widgetId));
            localStorage.setItem('dashboard_layout', JSON.stringify(layout.filter((id: string) => id !== widgetId)));
        } else {
            const newLayout = [...layout, widgetId];
            setLayout(newLayout);
            localStorage.setItem('dashboard_layout', JSON.stringify(newLayout));
        }
    };

    const savePreset = () => {
        if (!presetName) return;
        const presets = JSON.parse(localStorage.getItem('dashboard_presets') || '{}');
        presets[presetName] = layout;
        localStorage.setItem('dashboard_presets', JSON.stringify(presets));
        setPresetName('');
        alert(`Preset "${presetName}" salvo!`);
    };

    const loadPreset = (name: string) => {
        const presets = JSON.parse(localStorage.getItem('dashboard_presets') || '{}');
        if (presets[name]) {
            setLayout(presets[name]);
            localStorage.setItem('dashboard_layout', JSON.stringify(presets[name]));
            setIsOpen(false);
        }
    };

    const exportLayout = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layout));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "dashboard_layout.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const importLayout = (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileReader = new FileReader();
        if (event.target.files && event.target.files[0]) {
            fileReader.readAsText(event.target.files[0], "UTF-8");
            fileReader.onload = e => {
                if (e.target?.result) {
                    try {
                        const parsed = JSON.parse(e.target.result as string);
                        if (Array.isArray(parsed)) {
                            setLayout(parsed);
                            localStorage.setItem('dashboard_layout', JSON.stringify(parsed));
                            alert("Layout importado com sucesso!");
                        }
                    } catch (err) {
                        alert("Erro ao ler arquivo de layout.");
                    }
                }
            };
        }
    };

    const availablePresets = Object.keys(JSON.parse(localStorage.getItem('dashboard_presets') || '{}'));

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Configurar Dashboard"
            >
                <Settings size={20} />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Layout size={20} className="text-blue-500" />
                            Personalizar Dashboard
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Ative ou desative widgets e salve seus presets.</p>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Widgets Visíveis</h4>
                            <div className="flex gap-2">
                                <button onClick={exportLayout} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400">
                                    <Download size={14}/> Exportar JSON
                                </button>
                                <label className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer">
                                    <Upload size={14}/> Importar JSON
                                    <input type="file" className="hidden" accept=".json" onChange={importLayout} />
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {Object.entries(WIDGETS).map(([id, def]) => {
                                const isVisible = layout.includes(id);
                                return (
                                    <button
                                        key={id}
                                        onClick={() => toggleWidget(id)}
                                        className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                                            isVisible
                                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                                            : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            {def.type === 'kpi' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                                            {def.type === 'chart' && <span className="w-2 h-2 rounded-full bg-violet-500" />}
                                            {def.label || id}
                                        </span>
                                        {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Presets Salvos</h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                onClick={resetLayout}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5"
                            >
                                <RotateCcw size={14} /> Padrão
                            </button>
                            {availablePresets.map(preset => (
                                <button
                                    key={preset}
                                    onClick={() => loadPreset(preset)}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-transparent"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Nome do novo preset..."
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <button
                                onClick={savePreset}
                                disabled={!presetName}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Save size={16} /> Salvar
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg font-medium transition-colors shadow-lg shadow-slate-200 dark:shadow-none flex items-center gap-2"
                    >
                        <Check size={18} />
                        Concluir
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardSettings;
