import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useError } from '../hooks/useError';
import { useAuth } from '../AuthContext';
import {
    MapPin,
    Search,
    Plus,
    Edit2,
    X,
    Save,
    Trash2,
    Building2
} from 'lucide-react';

const Sectors: React.FC = () => {
    const [sectors, setSectors] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const { register, handleSubmit, reset, setValue } = useForm();
    const { showError, showSuccess, showConfirm } = useError();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editingSector, setEditingSector] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Permission: Operators can manage if allowed, but backend handles strict check.
    // Frontend UI: Allow everyone to see list, create/edit button visible to all (backend validates).
    // Actually, user said "filial poderá cadastrar", so Operator should see buttons.

    const fetchSectors = async (search?: string) => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/sectors/', { params });
            setSectors(response.data);
        } catch (error) {
            console.error("Erro ao carregar setores", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBranches = async () => {
        try {
            const response = await api.get('/branches/');
            setBranches(response.data);
        } catch (error) {
            console.error("Erro ao carregar filiais", error);
        }
    }

    useEffect(() => {
        fetchSectors();
        fetchBranches();
    }, []);

    const onSubmit = async (data: any) => {
        // Prepare payload: convert empty branch_id to null
        const payload = {
            ...data,
            branch_id: data.branch_id ? parseInt(data.branch_id) : null
        };

        try {
            if (editingSector) {
                await api.put(`/sectors/${editingSector.id}`, payload);
            } else {
                await api.post('/sectors/', payload);
            }
            reset();
            setShowForm(false);
            setEditingSector(null);
            fetchSectors();
            showSuccess("Setor salvo com sucesso.");
        } catch (error: any) {
            console.error("Erro ao salvar setor", error);
            const msg = error.response?.data?.detail || "Erro ao salvar setor.";
            showError(msg);
        }
    };

    const handleEdit = (sec: any) => {
        setEditingSector(sec);
        setValue('name', sec.name);
        setValue('branch_id', sec.branch_id || '');
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        showConfirm("Tem certeza que deseja remover este setor?", async () => {
            try {
                await api.delete(`/sectors/${id}`);
                showSuccess("Setor removido com sucesso.");
                fetchSectors();
            } catch (error: any) {
                console.error("Erro ao remover setor", error);
                const msg = error.response?.data?.detail || "Não foi possível remover o setor.";
                showError(msg);
            }
        });
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingSector(null);
        reset();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <MapPin className="w-8 h-8 text-indigo-600" />
                        Setores
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gerencie os setores/departamentos das filiais.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                            onChange={(e) => fetchSectors(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => {
                            if (showForm) handleCancel();
                            else { setShowForm(true); setEditingSector(null); reset(); }
                        }}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm transition-all ${
                            showForm
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
                        }`}
                    >
                        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showForm ? 'Cancelar' : 'Novo Setor'}
                    </button>
                </div>
            </div>

            {/* Form Section */}
            {showForm && (
                <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-md border border-gray-200/50 p-6 animate-in slide-in-from-top-4 duration-300">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200/50 pb-2">
                        {editingSector ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                        {editingSector ? 'Editar Setor' : 'Novo Setor'}
                    </h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Nome do Setor</label>
                            <input
                                {...register('name', { required: true })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                placeholder="Ex: Financeiro"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Vincular à Filial</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select
                                    {...register('branch_id')}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                                >
                                    <option value="">(Global / Todas)</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-xs text-gray-500">Se selecionado, o setor será exclusivo desta filial.</p>
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
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filial</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : sectors.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                                        Nenhum setor encontrado.
                                    </td>
                                </tr>
                            ) : (
                                sectors.map((sec) => (
                                    <tr key={sec.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {sec.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {sec.branch ? (
                                                <span className="flex items-center gap-1">
                                                    <Building2 className="w-3 h-3" /> {sec.branch.name}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">Global</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleEdit(sec)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(sec.id)} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
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

export default Sectors;
