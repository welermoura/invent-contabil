import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../AuthContext';

const Categories: React.FC = () => {
    const [categories, setCategories] = useState<any[]>([]);
    const { register, handleSubmit, reset } = useForm();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);

    const fetchCategories = async () => {
        try {
            const response = await api.get('/categories/');
            setCategories(response.data);
        } catch (error) {
            console.error("Erro ao carregar categorias", error);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const onSubmit = async (data: any) => {
        try {
            await api.post('/categories/', data);
            reset();
            setShowForm(false);
            fetchCategories();
        } catch (error) {
            console.error("Erro ao criar categoria", error);
            alert("Erro ao criar categoria. Verifique suas permissões.");
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Categorias</h1>
                {user?.role === 'ADMIN' && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                        {showForm ? 'Cancelar' : 'Nova Categoria'}
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-8">
                    <h2 className="text-xl font-bold mb-4">Nova Categoria</h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 max-w-md">
                        <div>
                            <label className="block text-gray-700">Nome da Categoria</label>
                            <input {...register('name', { required: true })} className="w-full border rounded px-3 py-2" />
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
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((category) => (
                            <tr key={category.id} className="border-t">
                                <td className="px-6 py-4">{category.id}</td>
                                <td className="px-6 py-4">{category.name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Categories;
