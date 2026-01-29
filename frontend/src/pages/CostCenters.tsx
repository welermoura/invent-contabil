import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useError } from '../hooks/useError';
import { useAuth } from '../AuthContext';
import {
    Briefcase,
    Search,
    Plus,
    Edit2,
    X,
    Save,
    Trash2,
    Hash,
    Upload,
    Download
} from 'lucide-react';

const CostCenters: React.FC = () => {
    const [costCenters, setCostCenters] = useState<any[]>([]);
    const { register, handleSubmit, reset, setValue } = useForm();
    const { showError, showSuccess, showConfirm } = useError();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editingCostCenter, setEditingCostCenter] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const canEdit = user?.role === 'ADMIN' || user?.role === 'APPROVER';

    const fetchCostCenters = async (search?: string) => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/cost-centers/', { params });
            setCostCenters(response.data);
        } catch (error) {
            console.error("Erro ao carregar centros de custo", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCostCenters();
    }, []);

    const onSubmit = async (data: any) => {
        if (!canEdit) return;
        try {
            if (editingCostCenter) {
                await api.put(`/cost-centers/${editingCostCenter.id}`, data);
            } else {
                await api.post('/cost-centers/', data);
            }
            reset();
            setShowForm(false);
            setEditingCostCenter(null);
            fetchCostCenters();
            showSuccess("Centro de Custo salvo com sucesso.");
        } catch (error) {
            console.error("Erro ao salvar centro de custo", error);
            showError(error, "COST_CENTER_SAVE_ERROR");
        }
    };

    const handleEdit = (cc: any) => {
        setEditingCostCenter(cc);
        setValue('code', cc.code);
        setValue('name', cc.name);
        setValue('description', cc.description);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!canEdit) return;
        showConfirm("Tem certeza que deseja remover este centro de custo?", async () => {
            try {
                await api.delete(`/cost-centers/${id}`);
                showSuccess("Centro de Custo removido com sucesso.");
                fetchCostCenters();
            } catch (error) {
                console.error("Erro ao remover centro de custo", error);
                showError("Não foi possível remover o centro de custo. Verifique se existem itens vinculados.");
            }
        });
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingCostCenter(null);
        reset();
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/cost-centers/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const { success, errors } = response.data;

            if (errors && errors.length > 0) {
                showError(
                    <div>
                        <p className="font-bold mb-2">Importação concluída com erros:</p>
                        <ul className="list-disc pl-4 text-sm max-h-40 overflow-y-auto">
                            {errors.map((err: string, idx: number) => (
                                <li key={idx}>{err}</li>
                            ))}
                        </ul>
                        {success > 0 && <p className="mt-2 text-green-600 font-medium">{success} itens importados com sucesso.</p>}
                    </div>,
                    "IMPORT_ERROR"
                );
            } else {
                showSuccess(`${success} centros de custo importados com sucesso!`);
            }

            fetchCostCenters();
        } catch (error) {
            console.error("Erro ao importar", error);
            showError("Falha ao processar o arquivo. Verifique o formato e tente novamente.");
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/cost-centers/import/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'modelo_centros_custo.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Erro ao baixar modelo", error);
            showError("Não foi possível baixar o modelo.");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.xlsx,.xls"
                className="hidden"
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Briefcase className="w-8 h-8 text-indigo-600" />
                        Centros de Custo
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gerenciamento de centros de custos financeiros.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                            onChange={(e) => fetchCostCenters(e.target.value)}
                        />
                    </div>
                    {canEdit && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleImportClick}
                                disabled={isImporting}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium disabled:opacity-50"
                                title="Importar de CSV/Excel"
                            >
                                {isImporting ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4" />
                                )}
                                Importar
                            </button>
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium"
                                title="Baixar Modelo"
                            >
                                <Download className="w-4 h-4" />
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
                                {showForm ? 'Cancelar' : 'Novo Centro'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Form Section */}
            {showForm && (
                <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-md border border-gray-200/50 p-6 animate-in slide-in-from-top-4 duration-300">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200/50 pb-2">
                        {editingCostCenter ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                        {editingCostCenter ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
                    </h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Código</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    {...register('code', { required: true })}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                                    placeholder="Ex: 1001"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Nome</label>
                            <input
                                {...register('name', { required: true })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                placeholder="Nome do Centro de Custo"
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Descrição (Opcional)</label>
                            <textarea
                                {...register('description')}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                rows={2}
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
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
                                Salvar
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
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                {canEdit && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={canEdit ? 4 : 3} className="px-6 py-12 text-center text-gray-500">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : costCenters.length === 0 ? (
                                <tr>
                                    <td colSpan={canEdit ? 4 : 3} className="px-6 py-12 text-center text-gray-500">
                                        Nenhum centro de custo encontrado.
                                    </td>
                                </tr>
                            ) : (
                                costCenters.map((cc) => (
                                    <tr key={cc.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {cc.code}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {cc.name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {cc.description || '-'}
                                        </td>
                                        {canEdit && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleEdit(cc)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(cc.id)} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors">
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
        </div>
    );
};

export default CostCenters;
