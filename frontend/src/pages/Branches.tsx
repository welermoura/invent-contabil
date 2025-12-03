import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';

const Branches: React.FC = () => {
    const [branches, setBranches] = useState<any[]>([]);
    const { register, handleSubmit, reset } = useForm();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);

    const fetchBranches = async () => {
        try {
            const response = await api.get('/branches/');
            setBranches(response.data);
        } catch (error) {
            console.error("Erro ao carregar filiais", error);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    const onSubmit = async (data: any) => {
        try {
            await api.post('/branches/', data);
            reset();
            setShowForm(false);
            fetchBranches();
        } catch (error) {
            console.error("Erro ao criar filial", error);
            alert("Erro ao criar filial. Verifique suas permissões.");
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Filiais</h1>
                {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                        {showForm ? 'Cancelar' : 'Nova Filial'}
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-8">
                    <h2 className="text-xl font-bold mb-4">Nova Filial</h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 max-w-md">
                        <div>
                            <label className="block text-gray-700">Nome da Filial</label>
                            <input {...register('name', { required: true })} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Endereço</label>
                            <input {...register('address', { required: true })} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Salvar</button>
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
                            <th className="px-6 py-3 text-left">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {branches.map((branch) => (
                            <tr key={branch.id} className="border-t">
                                <td className="px-6 py-4">{branch.id}</td>
                                <td className="px-6 py-4">{branch.name}</td>
                                <td className="px-6 py-4">{branch.address}</td>
                                <td className="px-6 py-4">
                                     <Link
                                        to={`/inventory?branch_id=${branch.id}`}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        Ver Itens
                                    </Link>
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
