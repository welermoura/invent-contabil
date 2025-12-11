
import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';
import {
    MapPin,
    Building2,
    Search,
    Plus,
    Edit2,
    X,
    Save,
    ExternalLink
} from 'lucide-react';

interface Branch {
    id: number;
    name: string;
    address: string;
    cnpj?: string;
}

interface BranchFormData {
    name: string;
    address: string;
    cnpj?: string;
}

const formatCNPJ = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .substring(0, 18);
};

const Branches: React.FC = () => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const { register, handleSubmit, reset, setValue, watch } = useForm<BranchFormData>();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [loading, setLoading] = useState(false);

    const cnpjValue = watch("cnpj");

    useEffect(() => {
        if (cnpjValue) {
            setValue("cnpj", formatCNPJ(cnpjValue));
        }
    }, [cnpjValue, setValue]);

    const fetchBranches = async (search?: string) => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/branches/', { params });
            setBranches(response.data);
        } catch (error) {
            console.error("Erro ao carregar filiais", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    const onSubmit: SubmitHandler<BranchFormData> = async (data) => {
        try {
            if (editingBranch) {
                await api.put(`/branches/${editingBranch.id}`, data);
            } else {
                await api.post('/branches/', data);
            }
            reset();
            setShowForm(false);
            setEditingBranch(null);
            fetchBranches();
        } catch (error) {
            console.error("Erro ao salvar filial", error);
            alert("Erro ao salvar filial. Verifique suas permissões.");
        }
    };

    const handleEdit = (branch: Branch) => {
        setEditingBranch(branch);
        setValue('name', branch.name);
        setValue('address', branch.address);
        setValue('cnpj', branch.cnpj || '');
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingBranch(null);
        reset();
    };

    const canEdit = user?.role === 'ADMIN' || user?.role === 'APPROVER';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Building2 className="w-8 h-8 text-indigo-600" />
                        Filiais
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gerencie as unidades e endereços da organização.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar Filial..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            onChange={(e) => fetchBranches(e.target.value)}
                        />
                    </div>
                    {canEdit && (
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
                            {showForm ? 'Cancelar' : 'Nova Filial'}
                        </button>
                    )}
                </div>
            </div>

            {/* Form Section */}
            {showForm && (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 animate-in slide-in-from-top-4 duration-300">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                        {editingBranch ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                        {editingBranch ? 'Editar Filial' : 'Nova Filial'}
                    </h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Nome da Filial</label>
                            <input
                                {...register('name', { required: true })}
                                onChange={(e) => {
                                    e.target.value = e.target.value.toUpperCase();
                                    register('name').onChange(e);
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
                                placeholder="EX: MATRIZ"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Endereço</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    {...register('address', { required: true })}
                                    onChange={(e) => {
                                        e.target.value = e.target.value.toUpperCase();
                                        register('address').onChange(e);
                                    }}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
                                    placeholder="RUA EXEMPLO, 123"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">CNPJ (Opcional)</label>
                            <input
                                {...register('cnpj')}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                                placeholder="00.000.000/0000-00"
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
                                Salvar Filial
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endereço</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CNPJ</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                            <span>Carregando dados...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : branches.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Search className="w-8 h-8 text-gray-300" />
                                            <span>Nenhuma filial encontrada.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                branches.map((branch) => (
                                    <tr key={branch.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            #{branch.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {branch.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-gray-400" />
                                            {branch.address}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {branch.cnpj || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    to={`/inventory?branch_id=${branch.id}`}
                                                    className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors"
                                                    title="Ver Itens"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </Link>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleEdit(branch)}
                                                        className="text-yellow-600 hover:text-yellow-900 bg-yellow-50 hover:bg-yellow-100 p-2 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
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

export default Branches;
