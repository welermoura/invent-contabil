import { useEffect, useState } from 'react';
import api from '../api';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';

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
        .replace(/\D/g, '') // Remove tudo o que não é dígito
        .replace(/^(\d{2})(\d)/, '$1.$2') // Coloca ponto entre o segundo e o terceiro dígitos
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3') // Coloca ponto entre o quinto e o sexto dígitos
        .replace(/\.(\d{3})(\d)/, '.$1/$2') // Coloca uma barra entre o oitavo e o nono dígitos
        .replace(/(\d{4})(\d)/, '$1-$2') // Coloca um hífen depois do bloco de quatro dígitos
        .substring(0, 18); // Limita o tamanho
};

const Branches: React.FC = () => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const { register, handleSubmit, reset, setValue, watch } = useForm<BranchFormData>();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    const cnpjValue = watch("cnpj");

    useEffect(() => {
        if (cnpjValue) {
            setValue("cnpj", formatCNPJ(cnpjValue));
        }
    }, [cnpjValue, setValue]);

    const fetchBranches = async (search?: string) => {
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/branches/', { params });
            setBranches(response.data);
        } catch (error) {
            console.error("Erro ao carregar filiais", error);
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
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">Filiais</h1>
                {canEdit && (
                    <button
                        onClick={() => {
                            if (showForm) {
                                handleCancel();
                            } else {
                                setShowForm(true);
                            }
                        }}
                        className={`${showForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded`}
                    >
                        {showForm ? 'Cancelar' : 'Nova Filial'}
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-8">
                    <h2 className="text-xl font-bold mb-4">{editingBranch ? 'Editar Filial' : 'Nova Filial'}</h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 max-w-md">
                        <div>
                            <label className="block text-gray-700">Nome da Filial</label>
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
                            <label className="block text-gray-700">Endereço</label>
                            <input
                                {...register('address', { required: true })}
                                onChange={(e) => {
                                    e.target.value = e.target.value.toUpperCase();
                                    register('address').onChange(e);
                                }}
                                className="w-full border rounded px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700">CNPJ (Opcional)</label>
                            <input
                                {...register('cnpj')}
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
                            <th className="px-6 py-3 text-left">Endereço</th>
                            <th className="px-6 py-3 text-left">CNPJ</th>
                            <th className="px-6 py-3 text-left">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {branches.map((branch) => (
                            <tr key={branch.id} className="border-t">
                                <td className="px-6 py-4">{branch.id}</td>
                                <td className="px-6 py-4">{branch.name}</td>
                                <td className="px-6 py-4">{branch.address}</td>
                                <td className="px-6 py-4">{branch.cnpj || '-'}</td>
                                <td className="px-6 py-4 flex gap-4">
                                     <Link
                                        to={`/inventory?branch_id=${branch.id}`}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        Ver Itens
                                    </Link>
                                    {canEdit && (
                                        <button
                                            onClick={() => handleEdit(branch)}
                                            className="text-yellow-600 hover:text-yellow-800"
                                        >
                                            Editar
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Branches;
