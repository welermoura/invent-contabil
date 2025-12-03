import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../AuthContext';
import { useSearchParams } from 'react-router-dom';

const Inventory: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 50; // Itens por página

    const { register, handleSubmit, reset, setValue } = useForm();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [searchParams] = useSearchParams();
    const [invoiceValueDisplay, setInvoiceValueDisplay] = useState('');

    // Approval Modal State
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [fixedAssetNumber, setFixedAssetNumber] = useState('');

    // Transfer Modal State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTargetBranch, setTransferTargetBranch] = useState<string>('');

    // Write-off Modal State
    const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
    const [writeOffJustification, setWriteOffJustification] = useState('');

    const fetchItems = async (search?: string, pageNum: number = 0) => {
        try {
            const statusFilter = searchParams.get('status');
            const categoryFilter = searchParams.get('category');
            const branchFilter = searchParams.get('branch_id');

            const params: any = {
                search,
                skip: pageNum * LIMIT,
                limit: LIMIT
            };

            if (statusFilter) params.status = statusFilter;
            if (categoryFilter) params.category = categoryFilter;
            if (branchFilter) params.branch_id = branchFilter;

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
    }, [page, searchParams.toString()]);

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

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        value = (Number(value) / 100).toFixed(2);
        // Note: react-hook-form handles value binding, but for visual mask we might need manual control
        // For simplicity with react-hook-form, we might let user type float or try to mask.
        // Let's implement a simple controlled input workaround or just update the form value.
        // Actually, better to just let user type and format on blur or use a controlled component.
        // User requested: "quando eu digitar por exemplo 125 fica 1,25 se eu digitar 10000 fique 100,00"
        // This implies real-time masking.
    };

    // Helper for currency input
    const CurrencyInput = ({ registerName, required }: { registerName: string, required?: boolean }) => {
        const [displayValue, setDisplayValue] = useState("0,00");

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            let val = e.target.value.replace(/\D/g, '');
            if (!val) val = "0";
            const floatVal = parseFloat(val) / 100;
            setDisplayValue(floatVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
            // We need to set the value in react-hook-form.
            // Since we are inside a custom component, we can't easily access setValue unless passed.
            // Let's adopt a different approach: modify the main input directly.
        };
        return <input />; // Placeholder logic
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

    const openTransferModal = (item: any) => {
        setSelectedItem(item);
        setTransferTargetBranch('');
        setIsTransferModalOpen(true);
    };

    const openWriteOffModal = (item: any) => {
        setSelectedItem(item);
        setWriteOffJustification('');
        setIsWriteOffModalOpen(true);
    };

    const handleTransferRequest = async () => {
        if (!selectedItem || !transferTargetBranch) return;
        try {
            await api.post(`/items/${selectedItem.id}/transfer?target_branch_id=${transferTargetBranch}`);
            fetchItems(undefined, page);
            setIsTransferModalOpen(false);
            setSelectedItem(null);
            setTransferTargetBranch('');
            alert("Solicitação de transferência enviada com sucesso!");
        } catch (error) {
            console.error("Erro ao solicitar transferência", error);
            alert("Erro ao solicitar transferência.");
        }
    };

    const handleWriteOffRequest = async () => {
        if (!selectedItem || !writeOffJustification) return;

        const formData = new FormData();
        formData.append('justification', writeOffJustification);

        try {
            await api.post(`/items/${selectedItem.id}/write-off`, formData);
            fetchItems(undefined, page);
            setIsWriteOffModalOpen(false);
            setSelectedItem(null);
            setWriteOffJustification('');
            alert("Solicitação de baixa enviada com sucesso!");
        } catch (error) {
            console.error("Erro ao solicitar baixa", error);
            alert("Erro ao solicitar baixa.");
        }
    }

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
                        onClick={() => {
                            // Simple CSV Export Logic
                            const csvHeader = "ID,Descrição,Categoria,Status,Valor,Filial\n";
                            const csvBody = items.map(item =>
                                `${item.id},"${item.description}","${item.category}",${item.status},${item.invoice_value},"${item.branch?.name || ''}"`
                            ).join("\n");
                            const blob = new Blob([csvHeader + csvBody], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'inventario.csv';
                            a.click();
                        }}
                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 whitespace-nowrap"
                    >
                        Exportar CSV
                    </button>
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
                            <label className="block text-gray-700">Valor do Item</label>
                            <input
                                type="text"
                                value={invoiceValueDisplay}
                                onChange={(e) => {
                                    let val = e.target.value.replace(/\D/g, '');
                                    if (!val) {
                                        setInvoiceValueDisplay('');
                                        setValue('invoice_value', '');
                                        return;
                                    }
                                    const floatVal = parseFloat(val) / 100;
                                    setInvoiceValueDisplay(floatVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                                    setValue('invoice_value', floatVal);
                                }}
                                placeholder="0,00"
                                className="w-full border rounded px-3 py-2"
                            />
                            <input type="hidden" {...register('invoice_value', { required: true })} />
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
                                        item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                        item.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                        item.status === 'TRANSFER_PENDING' ? 'bg-orange-100 text-orange-800' :
                                        item.status === 'WRITE_OFF_PENDING' ? 'bg-red-200 text-red-900' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {item.status === 'PENDING' ? 'Pendente' :
                                         item.status === 'APPROVED' ? 'Aprovado' :
                                         item.status === 'REJECTED' ? 'Rejeitado' :
                                         item.status === 'TRANSFER_PENDING' ? 'Transferência Pendente' :
                                         item.status === 'WRITE_OFF_PENDING' ? 'Baixa Pendente' : item.status}
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

                                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && item.status === 'TRANSFER_PENDING' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'APPROVED')}
                                                className="text-green-600 hover:text-green-800"
                                                title="Aprovar Transferência"
                                            >
                                                Aprovar Transf.
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'REJECTED')}
                                                className="text-red-600 hover:text-red-800"
                                                title="Rejeitar Transferência"
                                            >
                                                Rejeitar
                                            </button>
                                        </div>
                                    )}

                                    {item.status === 'APPROVED' && (
                                        <>
                                            <button
                                                onClick={() => openTransferModal(item)}
                                                className="text-blue-600 hover:text-blue-800 ml-2"
                                                title="Solicitar Transferência"
                                            >
                                                Transferir
                                            </button>
                                            <button
                                                onClick={() => openWriteOffModal(item)}
                                                className="text-red-600 hover:text-red-800 ml-2"
                                                title="Solicitar Baixa"
                                            >
                                                Baixa
                                            </button>
                                        </>
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

            {/* Write-off Modal */}
            {isWriteOffModalOpen && selectedItem && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
                    <div className="bg-white p-5 rounded-md shadow-lg w-96">
                        <h3 className="text-lg font-bold mb-4">Solicitar Baixa</h3>
                        <p className="mb-4">Item: {selectedItem.description}</p>
                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2">Justificativa (Obrigatório)</label>
                            <textarea
                                value={writeOffJustification}
                                onChange={(e) => setWriteOffJustification(e.target.value)}
                                className="w-full border rounded px-3 py-2"
                                placeholder="Descreva o motivo da baixa..."
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsWriteOffModalOpen(false)}
                                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (!writeOffJustification) {
                                        alert("Justificativa é obrigatória.");
                                        return;
                                    }
                                    handleWriteOffRequest();
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Confirmar Baixa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {isTransferModalOpen && selectedItem && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
                    <div className="bg-white p-5 rounded-md shadow-lg w-96">
                        <h3 className="text-lg font-bold mb-4">Solicitar Transferência</h3>
                        <p className="mb-4">Item: {selectedItem.description}</p>
                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2">Filial de Destino</label>
                            <select
                                value={transferTargetBranch}
                                onChange={(e) => setTransferTargetBranch(e.target.value)}
                                className="w-full border rounded px-3 py-2"
                            >
                                <option value="">Selecione a filial</option>
                                {branches.filter(b => b.id !== selectedItem.branch_id).map(branch => (
                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsTransferModalOpen(false)}
                                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleTransferRequest}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Solicitar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
