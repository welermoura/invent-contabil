import React from 'react';
import { useDashboard } from '../DashboardContext';
import { WIDGETS } from '../DraggableGrid';
import { Plus, X, BarChart, Activity, Grid } from 'lucide-react';

const WidgetLibrary: React.FC = () => {
    const { isEditing, setIsEditing, addWidget, layout } = useDashboard();

    if (!isEditing) return null;

    const availableWidgets = Object.entries(WIDGETS).filter(([id]) => !layout.includes(id));

    return (
        <div className="fixed right-0 top-0 h-screen w-80 bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform border-l border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Grid size={18} className="text-blue-500"/>
                    Biblioteca de Widgets
                </h3>
                <button
                    onClick={() => setIsEditing(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {availableWidgets.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">
                        Todos os widgets já estão no dashboard!
                    </div>
                ) : (
                    availableWidgets.map(([id, def]) => (
                        <div key={id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-blue-600 dark:text-blue-400">
                                    {def.type === 'kpi' ? <Activity size={16}/> : <BarChart size={16}/>}
                                </div>
                                <button
                                    onClick={() => addWidget(id)}
                                    className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-1">{def.label}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {def.type === 'kpi' ? 'Indicador numérico simples' : 'Gráfico visual detalhado'}
                            </p>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                 <p className="text-xs text-slate-400 text-center">
                    Adicione widgets aqui e organize-os diretamente no Dashboard.
                 </p>
            </div>
        </div>
    );
};

export default WidgetLibrary;
