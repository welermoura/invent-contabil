
import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../AuthContext';
import { useError } from '../hooks/useError';
import {
    Truck,
    Search,
    Plus,
    Edit2,
    X,
    Save,
    Building2,
    FileText
} from 'lucide-react';

interface Supplier {
    id: number;
    name: string;
    cnpj: string;
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

const Suppliers: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const { register, handleSubmit, reset, setValue, watch } = useForm();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [loading, setLoading] = useState(false);
    const { showError, showSuccess } = useError();

    const cnpjValue = watch("cnpj");

    useEffect(() => {
        if (cnpjValue) {
            setValue("cnpj", formatCNPJ(cnpjValue));
        }
    }, [cnpjValue, setValue]);

    const fetchSuppliers = async (search?: string) => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/suppliers/', { params });
            setSuppliers(response.data);
        } catch (error) {
            console.error("Erro ao carregar fornecedores", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const onSubmit = async (data: any) => {
        // Uppercase name
        data.name = data.name.toUpperCase();
        try {
            if (editingSupplier) {
                await api.put(`/suppliers/${editingSupplier.id}`, data);
            } else {
                await api.post('/suppliers/', data);
            }
            // Success feedback
            handleCancel();
            fetchSuppliers();
            showSuccess("Fornecedor salvo com sucesso.");
        } catch (error: any) {
            console.error("Erro ao salvar fornecedor", error);
            showError(error);
        }
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setValue('name', supplier.name);
        setValue('cnpj', supplier.cnpj);
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingSupplier(null);
        reset();
    };

    // Edit permission: Admin or Approver
    const canEdit = user?.role === 'ADMIN' || user?.role === 'APPROVER';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Truck className="w-8 h-8 text-indigo-600" />
                        Fornecedores
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gerencie o cadastro de fornecedores e prestadores de serviço.
                    </p>
                </div>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar Fornecedor..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            onChange={(e) => fetchSuppliers(e.target.value)}
                        />
                    </div>
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
                        {showForm ? 'Cancelar' : 'Novo Fornecedor'}
                    </button>
                </div>
            </div>

            {/* Form Section */}
            {showForm && (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 animate-in slide-in-from-top-4 duration-300">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                        {editingSupplier ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                        {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                    </h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                Razão Social / Nome
                            </label>
                            <input
                                {...register('name', { required: true })}
                                onChange={(e) => {
                                    e.target.value = e.target.value.toUpperCase();
                                    register('name').onChange(e);
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
                                placeholder="EX: EMPRESA LTDA"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                CNPJ
                            </label>
                            <input
                                {...register('cnpj', { required: true })}
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
                                Salvar Fornecedor
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
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Razão Social</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CNPJ</th>
                                {canEdit && <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                            <span>Carregando dados...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : suppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Search className="w-8 h-8 text-gray-300" />
                                            <span>Nenhum fornecedor encontrado.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                suppliers.map((supplier) => (
                                    <tr key={supplier.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            #{supplier.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                                {supplier.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                                            {supplier.cnpj}
                                        </td>
                                        {canEdit && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleEdit(supplier)}
                                                    className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
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

export default Suppliers;
