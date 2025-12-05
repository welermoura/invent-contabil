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
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchParams] = useSearchParams();
    const [invoiceValueDisplay, setInvoiceValueDisplay] = useState('');

    // Approval Modal State
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [fixedAssetNumber, setFixedAssetNumber] = useState('');

    // Duplicate Asset Modal State
    const [isDuplicateAssetModalOpen, setIsDuplicateAssetModalOpen] = useState(false);
    const [duplicateAssetItem, setDuplicateAssetItem] = useState<any>(null);

    // Transfer Modal State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTargetBranch, setTransferTargetBranch] = useState<string>('');

    // Write-off Modal State
    const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
    const [writeOffJustification, setWriteOffJustification] = useState('');

    // Details Modal State
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

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
        // Check for duplicate fixed asset number first
        if (data.fixed_asset_number) {
            try {
                const checkResponse = await api.get(`/items/check-asset/${data.fixed_asset_number}`);
                if (checkResponse.data.exists) {
                    setDuplicateAssetItem(checkResponse.data.item);
                    setIsDuplicateAssetModalOpen(true);
                    return; // Stop submission
                }
            } catch (error) {
                console.error("Erro ao verificar ativo fixo", error);
                // Proceed or block? Let's block to be safe or alert
                alert("Erro ao verificar duplicidade de Ativo Fixo.");
                return;
            }
        }

        const formData = new FormData();
        formData.append('description', data.description);
        formData.append('category', data.category);
        formData.append('purchase_date', data.purchase_date);
        formData.append('invoice_value', data.invoice_value);
        formData.append('invoice_number', data.invoice_number);
        formData.append('branch_id', data.branch_id);
        if (data.serial_number) formData.append('serial_number', data.serial_number);
        if (data.fixed_asset_number) formData.append('fixed_asset_number', data.fixed_asset_number);
        if (data.observations) formData.append('observations', data.observations);
        if (data.file[0]) formData.append('file', data.file[0]);

        try {
            await api.post('/items/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            reset();
            setIsCreateModalOpen(false);
            setInvoiceValueDisplay('');
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
        setFixedAssetNumber(item.fixed_asset_number || '');
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

    const openDetailsModal = (item: any) => {
        setSelectedItem(item);
        setIsDetailsModalOpen(true);
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
                            // Enhanced CSV Export Logic with Details
                            const csvHeader = "ID,Descrição,Categoria,Status,Valor,Data de Compra,Número da Nota,Número de Série,Ativo Fixo,Filial,Responsável,Observações,Arquivo da Nota,Histórico de Ações\n";
                            const csvBody = items.map(item => {
                                const logsStr = item.logs && item.logs.length > 0
                                    ? item.logs.map((log: any) => `[${new Date(log.timestamp).toLocaleDateString()}] ${log.user?.name || 'Sistema'}: ${log.action}`).join('; ')
                                    : "Sem histórico";

                                const purchaseDate = item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('pt-BR') : '';

                                return `${item.id},"${item.description}","${item.category}",${item.status},${item.invoice_value},"${purchaseDate}","${item.invoice_number || ''}","${item.serial_number || ''}","${item.fixed_asset_number || ''}","${item.branch?.name || ''}","${item.responsible?.name || ''}","${item.observations || ''}","${item.invoice_file || ''}","${logsStr}"`;
                            }).join("\n");

                            // Fallback to ANSI (Latin-1) as UTF-8 BOM is failing for user
                            const csvContent = csvHeader + csvBody;
                            const latin1Bytes = new Uint8Array(csvContent.length);
                            for (let i = 0; i < csvContent.length; i++) {
                                const charCode = csvContent.charCodeAt(i);
                                // Map common characters or just allow truncation to 8-bit (Latin-1)
                                latin1Bytes[i] = charCode & 0xFF;
                            }
                            const blob = new Blob([latin1Bytes], { type: 'text/csv;charset=windows-1252' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'inventario_detalhado.csv';
                            a.click();
                        }}
                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 whitespace-nowrap"
                    >
                        Exportar CSV Detalhado
                    </button>
                    {user?.role !== 'AUDITOR' && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 whitespace-nowrap"
                        >
                            Adicionar Item
                        </button>
                    )}
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

            {/* Create Item Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-md shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold">Novo Item</h2>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 text-xl"
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700">Descrição</label>
                                <input {...register('description', { required: true })} className="w-full border rounded px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-gray-700">Categoria</label>
                                <select {...register('category', { required: true })} className="w-full border rounded px-3 py-2">
                                    <option value="">Selecione...</option>
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
                                <label className="block text-gray-700">Número Ativo Fixo</label>
                                <input {...register('fixed_asset_number')} className="w-full border rounded px-3 py-2" placeholder="Opcional no cadastro" />
                            </div>
                            <div>
                                <label className="block text-gray-700">Filial</label>
                                <select {...register('branch_id', { required: true })} className="w-full border rounded px-3 py-2">
                                    <option value="">Selecione...</option>
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
                            <div className="col-span-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                                >
                                    Cancelar
                                </button>
                                <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded shadow overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-6 py-3 text-left">Descrição</th>
                            <th className="px-6 py-3 text-left">Categoria</th>
                            <th className="px-6 py-3 text-left">Filial</th>
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
                                <td className="px-6 py-4">{item.branch?.name || '-'}</td>
                                <td className="px-6 py-4">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.invoice_value)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-sm ${
                                        item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                        item.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                        item.status === 'TRANSFER_PENDING' ? 'bg-orange-100 text-orange-800' :
                                        item.status === 'WRITE_OFF_PENDING' ? 'bg-red-200 text-red-900' :
                                        item.status === 'WRITTEN_OFF' ? 'bg-gray-800 text-white' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {item.status === 'PENDING' ? 'Pendente' :
                                         item.status === 'APPROVED' ? 'Aprovado' :
                                         item.status === 'REJECTED' ? 'Rejeitado' :
                                         item.status === 'TRANSFER_PENDING' ? 'Transferência Pendente' :
                                         item.status === 'WRITE_OFF_PENDING' ? 'Baixa Pendente' :
                                         item.status === 'WRITTEN_OFF' ? 'Baixado' : item.status}
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

                                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && item.status === 'WRITE_OFF_PENDING' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'WRITTEN_OFF')}
                                                className="text-red-600 hover:text-red-800 font-bold"
                                                title="Aprovar Baixa"
                                            >
                                                Aprovar Baixa
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(item.id, 'REJECTED')}
                                                className="text-blue-600 hover:text-blue-800"
                                                title="Rejeitar Baixa (Voltar para Aprovado)"
                                            >
                                                Rejeitar Baixa
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

                                    {item.status === 'APPROVED' && user?.role !== 'AUDITOR' && (
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
                                    <button
                                        onClick={() => openDetailsModal(item)}
                                        className="text-gray-600 hover:text-gray-800 ml-2"
                                        title="Ver Detalhes e Histórico"
                                    >
                                        Detalhes
                                    </button>
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
                            <label className="block text-gray-700 mb-2">Ativo Fixo {selectedItem.fixed_asset_number ? '' : '(Obrigatório)'}</label>
                            {selectedItem.fixed_asset_number ? (
                                <div className="p-2 bg-gray-100 rounded border text-gray-700 font-mono">
                                    {selectedItem.fixed_asset_number}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={fixedAssetNumber}
                                    onChange={(e) => setFixedAssetNumber(e.target.value)}
                                    className="w-full border rounded px-3 py-2"
                                    placeholder="Digite o número do ativo"
                                />
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsApproveModalOpen(false)}
                                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (!fixedAssetNumber) {
                                        alert("Número do Ativo Fixo é obrigatório para aprovação.");
                                        return;
                                    }
                                    // Verify duplicate asset if inputting new one (logic: only check if we are inputting)
                                    // Since this input only appears if !selectedItem.fixed_asset_number, we are definitely inputting a new one.
                                    try {
                                        const checkResponse = await api.get(`/items/check-asset/${fixedAssetNumber}`);
                                        if (checkResponse.data.exists) {
                                            setDuplicateAssetItem(checkResponse.data.item);
                                            setIsDuplicateAssetModalOpen(true);
                                            return;
                                        }
                                    } catch (error) {
                                        console.error("Erro ao verificar ativo fixo", error);
                                        alert("Erro ao verificar duplicidade de Ativo Fixo.");
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

            {/* Details Modal */}
            {isDetailsModalOpen && selectedItem && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-md shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold">Detalhes do Item</h3>
                            <button
                                onClick={() => setIsDetailsModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 text-xl"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div><strong>ID:</strong> {selectedItem.id}</div>
                            <div><strong>Descrição:</strong> {selectedItem.description}</div>
                            <div><strong>Categoria:</strong> {selectedItem.category}</div>
                            <div><strong>Filial Atual:</strong> {selectedItem.branch?.name || '-'}</div>
                            <div><strong>Valor da NF:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedItem.invoice_value)}</div>
                            <div><strong>Número da NF:</strong> {selectedItem.invoice_number}</div>
                            <div><strong>Número de Série:</strong> {selectedItem.serial_number || '-'}</div>
                            <div><strong>Ativo Fixo:</strong> {selectedItem.fixed_asset_number || 'Pendente'}</div>
                            <div><strong>Data Compra:</strong> {new Date(selectedItem.purchase_date).toLocaleDateString()}</div>
                            <div><strong>Responsável:</strong> {selectedItem.responsible?.name || '-'}</div>
                            <div className="col-span-2"><strong>Observações:</strong> {selectedItem.observations || '-'}</div>
                        </div>

                        <h4 className="text-xl font-bold mb-2 border-t pt-4">Histórico de Ações</h4>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="px-4 py-2 text-left">Data/Hora</th>
                                        <th className="px-4 py-2 text-left">Usuário</th>
                                        <th className="px-4 py-2 text-left">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedItem.logs && selectedItem.logs.length > 0 ? (
                                        selectedItem.logs.map((log: any) => (
                                            <tr key={log.id} className="border-t">
                                                <td className="px-4 py-2">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className="px-4 py-2">{log.user?.name || 'Sistema'} ({log.user?.email})</td>
                                                <td className="px-4 py-2">{log.action}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-center text-gray-500">Nenhum registro encontrado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => setIsDetailsModalOpen(false)}
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Asset Modal */}
            {isDuplicateAssetModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-[60]">
                    <div className="bg-white p-5 rounded-md shadow-lg w-full max-w-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-red-600">Erro: Ativo Fixo Já Utilizado</h3>
                            <button
                                onClick={() => {
                                    setIsDuplicateAssetModalOpen(false);
                                    setDuplicateAssetItem(null);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                &times;
                            </button>
                        </div>
                        <p className="mb-4">O número do Ativo Fixo informado já está cadastrado no sistema.</p>

                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && duplicateAssetItem && (
                            <div className="bg-gray-100 p-4 rounded text-sm">
                                <h4 className="font-bold mb-2">Detalhes do Item Existente:</h4>
                                <div className="grid grid-cols-1 gap-2">
                                    <p><strong>Descrição:</strong> {duplicateAssetItem.description}</p>
                                    <p><strong>Filial:</strong> {duplicateAssetItem.branch?.name}</p>
                                    <p><strong>Categoria:</strong> {duplicateAssetItem.category}</p>
                                    <p><strong>Responsável:</strong> {duplicateAssetItem.responsible?.name || 'N/A'}</p>
                                    <p><strong>Status:</strong> {duplicateAssetItem.status}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end mt-4">
                            <button
                                onClick={() => {
                                    setIsDuplicateAssetModalOpen(false);
                                    setDuplicateAssetItem(null);
                                }}
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
