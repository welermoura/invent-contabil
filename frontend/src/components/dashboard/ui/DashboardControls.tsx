import React from 'react';
import { useDashboard } from '../DashboardContext';
import MultiSelect from './MultiSelect';
import DateRangePicker from './DateRangePicker';
import DashboardSettings from './DashboardSettings';
import { Search, RotateCw, Moon, Sun, Download, Plus, Check } from 'lucide-react';
import html2canvas from 'html2canvas';

const DashboardControls: React.FC = () => {
    const {
        filters,
        setFilters,
        availableBranches,
        availableCategories,
        refreshData,
        theme,
        toggleTheme,
        isLoading,
        isEditing,
        setIsEditing
    } = useDashboard();

    const branchOptions = availableBranches.map((b: any) => ({ id: b.id, label: b.name }));
    const categoryOptions = availableCategories.map((c: any) => ({ id: c.id, label: c.name }));

    const statusOptions = [
        { id: 'APPROVED', label: 'Aprovado' },
        { id: 'PENDING', label: 'Pendente' },
        { id: 'WRITE_OFF_PENDING', label: 'Baixa Pendente' },
        { id: 'TRANSFER_PENDING', label: 'Em Transferência' },
        { id: 'WRITTEN_OFF', label: 'Baixado' },
    ];

    const handleExport = async () => {
        const dashboardElement = document.getElementById('dashboard-container');
        if (dashboardElement) {
            try {
                const canvas = await html2canvas(dashboardElement, {
                    scale: 2,
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                });
                const link = document.createElement('a');
                link.download = `dashboard-contabil-${new Date().toISOString().split('T')[0]}.png`;
                link.href = canvas.toDataURL();
                link.click();
            } catch (err) {
                console.error("Export failed", err);
            }
        }
    };

    return (
        <div className="relative z-20 bg-white/80 backdrop-blur-md dark:bg-slate-800/80 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 transition-colors">
            <div className="flex flex-col gap-4">
                {/* Top Row: Title + Global Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Filtros & Controles</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Personalize a visualização dos dados</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                         <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isEditing ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}
                        >
                            {isEditing ? <Check size={18} /> : <Plus size={18} />}
                            <span className="hidden sm:inline">{isEditing ? 'Concluir' : 'Add Widget'}</span>
                        </button>

                         <button
                            onClick={refreshData}
                            className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Atualizar Dados"
                        >
                            <RotateCw size={20} className={isLoading ? "animate-spin" : ""} />
                        </button>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block" />

                        <button
                            onClick={toggleTheme}
                            className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Download size={18} />
                            <span className="hidden sm:inline">Exportar</span>
                        </button>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block" />

                        <DashboardSettings />
                    </div>
                </div>

                {/* Bottom Row: Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <MultiSelect
                        label="Filiais"
                        options={branchOptions}
                        value={filters.branches}
                        onChange={(val) => setFilters((prev: any) => ({ ...prev, branches: val }))}
                        placeholder="Todas as Filiais"
                    />

                    <MultiSelect
                        label="Categorias"
                        options={categoryOptions}
                        value={filters.categories}
                        onChange={(val) => setFilters((prev: any) => ({ ...prev, categories: val }))}
                        placeholder="Todas as Categorias"
                    />

                     <MultiSelect
                        label="Status"
                        options={statusOptions}
                        value={filters.status}
                        onChange={(val) => setFilters((prev: any) => ({ ...prev, status: val }))}
                        placeholder="Todos os Status"
                    />

                    <DateRangePicker
                        value={filters.dateRange}
                        onChange={(val) => setFilters((prev: any) => ({ ...prev, dateRange: val }))}
                    />

                    <div className="relative w-full">
                        <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">Buscar Item</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Nome, código..."
                                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-slate-700 dark:text-slate-200 shadow-sm"
                                value={filters.search}
                                onChange={(e) => setFilters((prev: any) => ({ ...prev, search: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardControls;
