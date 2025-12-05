import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../AuthContext';

const Categories: React.FC = () => {
    const [categories, setCategories] = useState<any[]>([]);
    const { register, handleSubmit, reset, setValue } = useForm();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);

    const fetchCategories = async (search?: string) => {
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/categories/', { params });
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
            if (editingCategory) {
                await api.put(`/categories/${editingCategory.id}`, data);
                alert("Categoria atualizada com sucesso!");
            } else {
                await api.post('/categories/', data);
                alert("Categoria criada com sucesso!");
            }
            reset();
            setShowForm(false);
            setEditingCategory(null);
            fetchCategories();
        } catch (error) {
            console.error("Erro ao salvar categoria", error);
            alert("Erro ao salvar categoria. Verifique suas permissões.");
        }
    };

    const handleEdit = (category: any) => {
        setEditingCategory(category);
        setValue('name', category.name);
        setValue('depreciation_months', category.depreciation_months);
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingCategory(null);
        reset();
    }

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">Categorias</h1>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Buscar Categoria..."
                        className="border rounded px-3 py-2 flex-grow md:w-64 w-full"
                        onChange={(e) => fetchCategories(e.target.value)}
                    />
                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                        <button
                            onClick={() => {
                                if (showForm) handleCancel();
                                else setShowForm(true);
                            }}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 whitespace-nowrap"
                        >
                            {showForm ? 'Cancelar' : 'Nova Categoria'}
                        </button>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-8">
                    <h2 className="text-xl font-bold mb-4">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 max-w-md">
                        <div>
                            <label className="block text-gray-700">Nome da Categoria</label>
                            <input {...register('name', { required: true })} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Tempo de Depreciação (meses)</label>
                            <input type="number" {...register('depreciation_months')} className="w-full border rounded px-3 py-2" placeholder="0" />
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
                            <th className="px-6 py-3 text-left">Depreciação (meses)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((category) => (
                            <tr key={category.id} className="border-t">
                                <td className="px-6 py-4">{category.id}</td>
                                <td className="px-6 py-4">{category.name}</td>
                                <td className="px-6 py-4">{category.depreciation_months || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Categories;
