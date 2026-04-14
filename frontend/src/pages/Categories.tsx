
import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useError } from '../hooks/useError';
import { useAuth } from '../AuthContext';
import {
    Tags,
    Search,
    Plus,
    Edit2,
    X,
    Save,
    Trash2,
    CalendarClock,
    Upload,
    AlertCircle,
    CheckCircle,
    Download,
    Hash
} from 'lucide-react';

const Categories: React.FC = () => {
    const [categories, setCategories] = useState<any[]>([]);
    const { register, handleSubmit, reset, setValue } = useForm();
    const { showError, showSuccess, showConfirm } = useError();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Import states
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [hasOverwriteOption, setHasOverwriteOption] = useState(false);

    const fetchCategories = async (search?: string) => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/categories/', { params });
            setCategories(response.data);
        } catch (error) {
            console.error("Erro ao carregar categorias", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const onSubmit = async (data: any) => {
        try {
            if (editingCategory) {
                await api.put(`/categories/${editingCategory.id}`, data);
            } else {
                await api.post('/categories/', data);
            }
            // Feedback silenced to avoid alerts, just close and refresh
            reset();
            setShowForm(false);
            setEditingCategory(null);
            fetchCategories();
            showSuccess("Categoria salva com sucesso.");
        } catch (error) {
            console.error("Erro ao salvar categoria", error);
            showError(error, "CATEGORY_SAVE_ERROR");
        }
    };

    const handleEdit = (category: any) => {
        setEditingCategory(category);
        setValue('name', category.name);
        setValue('depreciation_months', category.depreciation_months);
        setValue('asset_class', category.asset_class);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        showConfirm("Tem certeza que deseja remover esta categoria?", async () => {
            try {
                await api.delete(`/categories/${id}`);
                showSuccess("Categoria removida com sucesso.");
                fetchCategories();
            } catch (error) {
                console.error("Erro ao remover categoria", error);
                showError("Não foi possível remover a categoria. Verifique se existem itens vinculados.");
            }
        });
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingCategory(null);
        reset();
    };

    const canEdit = user?.role === 'ADMIN' || user?.role === 'APPROVER';

    const handleImportSubmit = async (e: React.FormEvent, overwrite: boolean = false) => {
        e.preventDefault();
        if (!importFile) return;

        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('update_existing', overwrite ? "true" : "false");
        // No branch needed for categories but if backend complains we can add.
        // Wait, the API upload_categories does not require branch_id

        setIsUploading(true);
        setImportErrors([]);
        setHasOverwriteOption(false);
        try {
            const res = await api.post('/import/categories/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const data = res.data;
            if (data.errors && data.errors.length > 0) {
                setImportErrors(data.errors);
                const hasExisting = data.errors.some((err: string) => err.includes("já existe"));
                setHasOverwriteOption(hasExisting);
                if (data.success > 0) {
                     showSuccess(`${data.success} categorias importadas. Verifique os erros.`);
                     fetchCategories();
                } else {
                     showError("Foram encontrados erros na importação. Verifique a lista.");
                }
            } else {
                showSuccess(`${data.success} categorias importadas com sucesso!`);
                setIsImportModalOpen(false);
                setImportFile(null);
                fetchCategories();
            }
        } catch (error: any) {
            console.error("Erro na importação:", error);
            showError(error.response?.data?.detail || "Erro estrutural ao tentar importar o arquivo.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Tags className="w-8 h-8 text-indigo-600" />
                        Categorias
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Organize os ativos por grupos e defina taxas de depreciação.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar Categoria..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                            onChange={(e) => fetchCategories(e.target.value)}
                        />
                    </div>
                    {canEdit && (
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm transition-all bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md"
                            >
                                <Upload className="w-4 h-4" />
                                Importar
                            </button>
                            <button
                                onClick={() => {
                                    if (showForm) handleCancel();
                                    else setShowForm(true);
                                }}
                                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm transition-all ${
                                    showForm
                                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
                                }`}
                            >
                                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {showForm ? 'Cancelar' : 'Nova Categoria'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Form Section */}
            {showForm && (
                <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-md border border-gray-200/50 p-6 animate-in slide-in-from-top-4 duration-300">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200/50 pb-2">
                        {editingCategory ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                        {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                    </h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Nome da Categoria</label>
                            <div className="relative">
                                <Tags className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    {...register('name', { required: true })}
                                    onChange={(e) => {
                                        e.target.value = e.target.value.toUpperCase();
                                        register('name').onChange(e);
                                    }}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
                                    placeholder="EX: VEÍCULOS"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Depreciação (meses)</label>
                            <div className="relative">
                                <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="number"
                                    {...register('depreciation_months')}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="Ex: 60"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Classe / Grupo</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="number"
                                    {...register('asset_class')}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="Ex: 1045"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-3 flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                            >
                                <Save className="w-4 h-4" />
                                Salvar Categoria
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List Section */}
            <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200/50">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classe</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Depreciação (Meses)</th>
                                {canEdit && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                            <span>Carregando dados...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : categories.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Search className="w-8 h-8 text-gray-300" />
                                            <span>Nenhuma categoria encontrada.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                categories.map((category) => (
                                    <tr key={category.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            #{category.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {category.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {category.asset_class ? (
                                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono text-xs border border-gray-200">{category.asset_class}</span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {category.depreciation_months ? (
                                                <span className="flex items-center gap-1">
                                                    <CalendarClock className="w-3 h-3" />
                                                    {category.depreciation_months} meses
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        {canEdit && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(category)}
                                                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(category.id)}
                                                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                                        title="Remover"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-indigo-600" />
                                Importar Categorias
                            </h2>
                            <button onClick={() => { setIsImportModalOpen(false); setImportErrors([]); setHasOverwriteOption(false); setImportFile(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form id="importForm" onSubmit={(e) => handleImportSubmit(e, false)} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Arquivo Excel ou CSV</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls,.csv"
                                            onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-sm"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Formatos suportados: .xlsx, .xls, .csv</p>
                                </div>
                            </form>

                            <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Modelos de Importação
                                </h3>
                                <p className="text-xs text-indigo-700 mb-3">
                                    Baixe um arquivo de modelo para organizar seus dados antes de importar:
                                </p>
                                <div className="flex gap-2">
                                    <a href={`${import.meta.env.VITE_API_URL}/import/categories/example-xlsx`} className="text-xs flex items-center gap-1 bg-white px-3 py-1.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors font-medium">
                                        <Download className="w-3 h-3" /> Modelo Excel
                                    </a>
                                    <a href={`${import.meta.env.VITE_API_URL}/import/categories/example-csv`} className="text-xs flex items-center gap-1 bg-white px-3 py-1.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors font-medium">
                                        <Download className="w-3 h-3" /> Modelo CSV
                                    </a>
                                </div>
                            </div>

                            {importErrors.length > 0 && (
                                <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-100 max-h-60 overflow-y-auto">
                                    <h3 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
                                        <XCircle className="w-4 h-4" />
                                        Erros encontrados ({importErrors.length})
                                    </h3>
                                    <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                                        {importErrors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0 flex-wrap">
                            <button
                                type="button"
                                onClick={() => { setIsImportModalOpen(false); setImportErrors([]); setHasOverwriteOption(false); setImportFile(null); }}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                            >
                                Cancelar
                            </button>
                            {hasOverwriteOption && (
                                <button
                                    onClick={(e) => handleImportSubmit(e, true)}
                                    disabled={isUploading || !importFile}
                                    className="px-4 py-2 text-white bg-amber-600 border border-transparent rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isUploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                    Sobrescrever Duplicadas
                                </button>
                            )}
                            <button
                                form="importForm"
                                type="submit"
                                disabled={isUploading || !importFile}
                                className="px-4 py-2 text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50 shadow-sm"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Importar Arquivo
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Categories;
