
import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../AuthContext';

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

    const cnpjValue = watch("cnpj");

    useEffect(() => {
        if (cnpjValue) {
            setValue("cnpj", formatCNPJ(cnpjValue));
        }
    }, [cnpjValue, setValue]);

    const fetchSuppliers = async (search?: string) => {
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/suppliers/', { params });
            setSuppliers(response.data);
        } catch (error) {
            console.error("Erro ao carregar fornecedores", error);
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
                alert("Fornecedor atualizado com sucesso!");
            } else {
                await api.post('/suppliers/', data);
                alert("Fornecedor criado com sucesso!");
            }
            reset();
            setShowForm(false);
            setEditingSupplier(null);
            fetchSuppliers();
        } catch (error: any) {
            console.error("Erro ao salvar fornecedor", error);
            const msg = error.response?.data?.detail || "Erro ao salvar fornecedor.";
            alert(msg);
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
    // Create permission: All (implicit in showing the button)

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">Fornecedores</h1>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Buscar Fornecedor..."
                        className="border rounded px-3 py-2 flex-grow md:w-64 w-full"
                        onChange={(e) => fetchSuppliers(e.target.value)}
                    />
                    <button
                        onClick={() => {
                            if (showForm) handleCancel();
                            else setShowForm(true);
                        }}
                        className={`${showForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded whitespace-nowrap`}
                    >
                        {showForm ? 'Cancelar' : 'Novo Fornecedor'}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-8">
                    <h2 className="text-xl font-bold mb-4">{editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 max-w-md">
                        <div>
                            <label className="block text-gray-700">Nome (Razão Social)</label>
                            <input
                                {...register('name', { required: true })}
                                onChange={(e) => {
                                    e.target.value = e.target.value.toUpperCase();
                                    register('name').onChange(e);
                                }}
                                className="w-full border rounded px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700">CNPJ</label>
                            <input
                                {...register('cnpj', { required: true })}
                                className="w-full border rounded px-3 py-2"
                                placeholder="XX.XXX.XXX/0001-XX"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Salvar</button>
                            <button type="button" onClick={handleCancel} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Cancelar</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded shadow overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-6 py-3 text-left">ID</th>
                            <th className="px-6 py-3 text-left">Nome</th>
                            <th className="px-6 py-3 text-left">CNPJ</th>
                            {canEdit && <th className="px-6 py-3 text-left">Ações</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {suppliers.map((supplier) => (
                            <tr key={supplier.id} className="border-t">
                                <td className="px-6 py-4">{supplier.id}</td>
                                <td className="px-6 py-4">{supplier.name}</td>
                                <td className="px-6 py-4">{supplier.cnpj}</td>
                                {canEdit && (
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleEdit(supplier)}
                                            className="text-blue-600 hover:text-blue-800 font-bold"
                                        >
                                            Editar
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Suppliers;
