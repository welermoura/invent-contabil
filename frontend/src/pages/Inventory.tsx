import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../AuthContext';

const Inventory: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 50; // Itens por página

    const { register, handleSubmit, reset } = useForm();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);

    // Approval Modal State
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [fixedAssetNumber, setFixedAssetNumber] = useState('');

    const fetchItems = async (search?: string, pageNum: number = 0) => {
        try {
            const params = {
                search,
                skip: pageNum * LIMIT,
                limit: LIMIT
            };
            const response = await api.get('/items/', { params });
            if (response.data.length < LIMIT) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
            setItems(response.data);
        } catch (error) {
            console.error("Erro ao carregar itens", error);
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

    const fetchCategories = async () => {
        try {
            const response = await api.get('/categories/');
            setCategories(response.data);
        } catch (error) {
             console.error("Erro ao carregar categorias", error);
        }
    }

    useEffect(() => {
        fetchItems(undefined, page);
        fetchBranches();
        fetchCategories();
    }, [page]);

    const onSubmit = async (data: any) => {
        const formData = new FormData();
        formData.append('description', data.description);
        formData.append('category', data.category);
        formData.append('purchase_date', data.purchase_date);
        formData.append('invoice_value', data.invoice_value);
        formData.append('invoice_number', data.invoice_number);
        formData.append('branch_id', data.branch_id);
        if (data.serial_number) formData.append('serial_number', data.serial_number);
        if (data.observations) formData.append('observations', data.observations);
        if (data.file[0]) formData.append('file', data.file[0]);

        try {
            await api.post('/items/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            reset();
            setShowForm(false);
            fetchItems();
        } catch (error) {
            console.error("Erro ao salvar item", error);
        }
    };

    const handleStatusChange = async (itemId: number, newStatus: string, fixedAsset?: string) => {
        try {
            let url = `/items/${itemId}/status?status_update=${newStatus}`;
            if (fixedAsset) {
                url += `&fixed_asset_number=${fixedAsset}`;
            }
            await api.put(url);
            fetchItems(undefined, page);
            setIsApproveModalOpen(false);
            setSelectedItem(null);
            setFixedAssetNumber('');
        } catch (error) {
            console.error("Erro ao atualizar status", error);
            alert("Erro ao atualizar status. Verifique se você tem permissão.");
        }
    }

    const openApproveModal = (item: any) => {
        setSelectedItem(item);
        setFixedAssetNumber('');
        setIsApproveModalOpen(true);
    };

    const handlePrevPage = () => {
        if (page > 0) setPage(page - 1);
    };

    const handleNextPage = () => {
        if (hasMore) setPage(page + 1);
    };

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">Inventário</h1>
                 <div className="flex gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className="border rounded px-3 py-2 flex-grow md:w-64"
                        onChange={(e) => fetchItems(e.target.value)}
                    />
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 whitespace-nowrap"
                    >
                        {showForm ? 'Cancelar' : 'Adicionar Item'}
                    </button>
                </div>
            </div>

            <div className="flex justify-between mb-4">
                <button
                    onClick={handlePrevPage}
                    disabled={page === 0}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded disabled:opacity-50"
                >
                    Anterior
                </button>
                <span className="self-center">Página {page + 1}</span>
                <button
                    onClick={handleNextPage}
                    disabled={!hasMore}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded disabled:opacity-50"
                >
                    Próxima
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-8">
                    <h2 className="text-xl font-bold mb-4">Novo Item</h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700">Descrição</label>
                            <input {...register('description', { required: true })} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Categoria</label>
                            <select {...register('category', { required: true })} className="w-full border rounded px-3 py-2">
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-700">Data Compra</label>
                            <input type="date" {...register('purchase_date', { required: true })} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Valor Nota</label>
                            <input type="number" step="0.01" {...register('invoice_value', { required: true })} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Número Nota</label>
                            <input {...register('invoice_number', { required: true })} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Número Série</label>
                            <input {...register('serial_number')} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Filial</label>
                            <select {...register('branch_id', { required: true })} className="w-full border rounded px-3 py-2">
                                {branches.map(branch => (
                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                ))}
                            </select>
                        </div>
                         <div>
                            <label className="block text-gray-700">Nota Fiscal (Arquivo)</label>
                            <input type="file" {...register('file')} className="w-full border rounded px-3 py-2" />
                        </div>
                         <div className="col-span-2">
                            <label className="block text-gray-700">Observações</label>
                            <textarea {...register('observations')} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div className="col-span-2">
                            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Salvar</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded shadow overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-6 py-3 text-left">Descrição</th>
                            <th className="px-6 py-3 text-left">Categoria</th>
                            <th className="px-6 py-3 text-left">Valor</th>
                            <th className="px-6 py-3 text-left">Status</th>
                            <th className="px-6 py-3 text-left">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-t">
                                <td className="px-6 py-4">{item.description}</td>
                                <td className="px-6 py-4">{item.category}</td>
                                <td className="px-6 py-4">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.invoice_value)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-sm ${
                                        item.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                                        item.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && item.status === 'PENDING' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openApproveModal(item)}
                                                className="text-green-600 hover:text-green-800"
                                            >
                                                Aprovar
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'REJECTED')}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                Rejeitar
                                            </button>
                                        </div>
                                    )}
                                    {item.invoice_file && (
                                        <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/${item.invoice_file}`} target="_blank" className="text-blue-600 ml-2">
                                            Ver NF
                                        </a>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Approval Modal */}
            {isApproveModalOpen && selectedItem && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
                    <div className="bg-white p-5 rounded-md shadow-lg w-96">
                        <h3 className="text-lg font-bold mb-4">Aprovar Item</h3>
                        <p className="mb-4">Item: {selectedItem.description}</p>
                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2">Ativo Fixo (Obrigatório)</label>
                            <input
                                type="text"
                                value={fixedAssetNumber}
                                onChange={(e) => setFixedAssetNumber(e.target.value)}
                                className="w-full border rounded px-3 py-2"
                                placeholder="Digite o número do ativo"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsApproveModalOpen(false)}
                                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (!fixedAssetNumber) {
                                        alert("Número do Ativo Fixo é obrigatório para aprovação.");
                                        return;
                                    }
                                    handleStatusChange(selectedItem.id, 'APPROVED', fixedAssetNumber);
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                Confirmar Aprovação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
