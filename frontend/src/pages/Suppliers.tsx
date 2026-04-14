
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
    FileText,
    UploadCloud,
    AlertCircle,
    Download
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
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [hasOverwriteOption, setHasOverwriteOption] = useState(false);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setImportFile(e.target.files[0]);
            setImportErrors([]);
            setHasOverwriteOption(false);
        }
    };

    const handleImportSubmit = async (e: React.FormEvent, forceUpdate: boolean = false) => {
        e.preventDefault();
        if (!importFile) return;

        setIsUploading(true);
        setImportErrors([]);
        
        const formData = new FormData();
        formData.append('file', importFile);
        if (forceUpdate) {
            formData.append('update_existing', 'true');
        }

        try {
            const res = await api.post('/import/suppliers/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            if (res.data.errors && res.data.errors.length > 0) {
                setImportErrors(res.data.errors);
                // If it mentions that it already exists, provide the option to overwrite
                const hasDuplications = res.data.errors.some((err: string) => err.includes('já existe'));
                setHasOverwriteOption(hasDuplications && !forceUpdate);
                if (res.data.success > 0) {
                    showSuccess(`${res.data.success} fornecedor(es) importado(s) com sucesso, mas houve erros.`);
                    fetchSuppliers();
                }
            } else {
                showSuccess(`${res.data.success} fornecedor(es) importado(s) com sucesso!`);
                handleImportModalClose();
                fetchSuppliers();
            }
        } catch (error: any) {
            console.error("Erro na importação", error);
            showError(error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleImportModalClose = () => {
        setIsImportModalOpen(false);
        setImportFile(null);
        setImportErrors([]);
        setHasOverwriteOption(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
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
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                            onChange={(e) => fetchSuppliers(e.target.value)}
                        />
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm transition-all bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
                        >
                            <UploadCloud className="w-4 h-4" />
                            Importar
                        </button>
                    )}
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
                <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-md border border-gray-200/50 p-6 animate-in slide-in-from-top-4 duration-300">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200/50 pb-2">
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
            <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200/50">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Razão Social</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CNPJ</th>
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

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <UploadCloud className="w-5 h-5 text-indigo-600" />
                                Importar Fornecedores
                            </h3>
                            <button onClick={handleImportModalClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <form id="import-form" onSubmit={(e) => handleImportSubmit(e, false)} className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-700 block">
                                        Arquivo de Importação (.csv, .xlsx)
                                    </label>
                                    <div className="flex flex-col gap-3">
                                        <input
                                            type="file"
                                            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                            onChange={handleFileChange}
                                            className="block w-full text-sm text-gray-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-lg file:border-0
                                            file:text-sm file:font-medium
                                            file:bg-indigo-50 file:text-indigo-700
                                            hover:file:bg-indigo-100 transition-colors
                                            border border-gray-200 rounded-lg"
                                        />
                                        <p className="text-xs text-gray-500">
                                            Baixe um arquivo de modelo para organizar seus dados antes de importar:
                                        </p>
                                        <div className="flex gap-2">
                                            <a href={`${api.defaults.baseURL}/import/suppliers/example-xlsx`} className="text-xs flex items-center gap-1 bg-white px-3 py-1.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors font-medium">
                                                <Download className="w-3 h-3" /> Modelo Excel
                                            </a>
                                            <a href={`${api.defaults.baseURL}/import/suppliers/example-csv`} className="text-xs flex items-center gap-1 bg-white px-3 py-1.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors font-medium">
                                                <Download className="w-3 h-3" /> Modelo CSV
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            {importErrors.length > 0 && (
                                <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="text-sm font-medium text-red-800 mb-2">Atenção aos problemas encontrados:</h4>
                                            <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                                                {importErrors.map((err, i) => (
                                                    <li key={i}>{err}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                            <div>
                                {hasOverwriteOption && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleImportSubmit(e, true)}
                                        disabled={isUploading}
                                        className="text-sm text-orange-600 hover:text-orange-700 font-medium px-3 py-2 rounded-lg border border-orange-200 hover:bg-orange-50 transition-colors disabled:opacity-50"
                                    >
                                        Sobrescrever Duplicadas
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleImportModalClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    form="import-form"
                                    type="submit"
                                    disabled={!importFile || isUploading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isUploading ? (
                                        <>
                                            <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                                            Enviando...
                                        </>
                                    ) : (
                                        'Importar Arquivo'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Suppliers;
