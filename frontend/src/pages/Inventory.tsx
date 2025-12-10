
import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../AuthContext';
import { useSearchParams } from 'react-router-dom';
import { translateStatus, translateLogAction } from '../utils/translations';
import { Edit2, Eye, CheckCircle, XCircle, ArrowRightLeft, FileText, Search, Plus, FileWarning, AlertCircle, Download, FileSpreadsheet, Table as TableIcon, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const StatusBadge = ({ status }: { status: string }) => {
    const map: any = {
        PENDING: { label: 'Pendente', class: 'bg-yellow-50 text-yellow-700 border-yellow-200 ring-yellow-600/20' },
        APPROVED: { label: 'Aprovado', class: 'bg-green-50 text-green-700 border-green-200 ring-green-600/20' },
        REJECTED: { label: 'Rejeitado', class: 'bg-red-50 text-red-700 border-red-200 ring-red-600/20' },
        TRANSFER_PENDING: { label: 'Transf. Pendente', class: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-600/20' },
        WRITE_OFF_PENDING: { label: 'Baixa Pendente', class: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-600/20' },
        WRITTEN_OFF: { label: 'Baixado', class: 'bg-slate-100 text-slate-600 border-slate-200 ring-slate-500/20' },
    };
    const config = map[status] || { label: status, class: 'bg-gray-50 text-gray-600 border-gray-200' };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ring-1 ring-inset ${config.class}`}>
            {config.label}
        </span>
    );
};

const Inventory: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 50;

    const { register, handleSubmit, reset, setValue } = useForm();
    const { user } = useAuth();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchParams] = useSearchParams();
    const [invoiceValueDisplay, setInvoiceValueDisplay] = useState('');

    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
    const [supplierSearch, setSupplierSearch] = useState('');

    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [fixedAssetNumber, setFixedAssetNumber] = useState('');

    const [isDuplicateAssetModalOpen, setIsDuplicateAssetModalOpen] = useState(false);
    const [duplicateAssetItem, setDuplicateAssetItem] = useState<any>(null);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTargetBranch, setTransferTargetBranch] = useState<string>('');

    const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
    const [writeOffJustification, setWriteOffJustification] = useState('');

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    const [editingItem, setEditingItem] = useState<any>(null);
    const [approvalCategory, setApprovalCategory] = useState('');

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // Filter States
    const [filterDescription, setFilterDescription] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [filterFixedAsset, setFilterFixedAsset] = useState('');
    const [filterPurchaseDate, setFilterPurchaseDate] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');

    // Debounce Logic helper
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchItems(globalSearch, 0);
        }, 500);
        return () => clearTimeout(timer);
    }, [filterDescription, filterCategory, filterBranch, filterFixedAsset, filterPurchaseDate, globalSearch]); // Trigger on filter change

    // Sync URL params with local state on load
    useEffect(() => {
        const cat = searchParams.get('category');
        const br = searchParams.get('branch_id');

        if (cat) setFilterCategory(cat);
        if (br) setFilterBranch(br);
    }, []);

    const fetchItems = async (search?: string, pageNum: number = 0) => {
        try {
            const statusFilter = searchParams.get('status');
            // We use local state for other filters now, but respect URL status

            const params: any = {
                search: search !== undefined ? search : globalSearch,
                skip: pageNum * LIMIT,
                limit: LIMIT
            };

            if (statusFilter) params.status = statusFilter;

            // Apply column filters
            if (filterCategory) params.category = filterCategory;
            if (filterBranch) params.branch_id = filterBranch;
            if (filterDescription) params.description = filterDescription;
            if (filterFixedAsset) params.fixed_asset_number = filterFixedAsset;
            if (filterPurchaseDate) params.purchase_date = filterPurchaseDate;

            const response = await api.get('/items/', { params });

            if (pageNum === 0) {
                setItems(response.data);
            } else {
                 setItems(prev => [...prev, ...response.data]);
            }

            if (response.data.length < LIMIT) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
            if (pageNum === 0) setPage(0);

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

    const fetchSuppliers = async (search: string = '') => {
        try {
            const response = await api.get('/suppliers/', { params: { search } });
            setSuppliers(response.data);
        } catch (error) {
            console.error("Erro ao carregar fornecedores", error);
        }
    }

    useEffect(() => {
        // Initial load
        // fetchItems is triggered by the debounce effect on filters initially too,
        // but we need to load auxiliary data
        fetchBranches();
        fetchCategories();
    }, []);

    // Pagination logic uses fetchItems directly in the JSX buttons, but we can clean this up.
    // The previous handleNextPage was unused because I inlined the logic in the buttons
    // to handle the "dirty manual fetch". I will remove this unused function.

    // Export Logic
    const getAllFilteredItems = async () => {
        const statusFilter = searchParams.get('status');
        const params: any = {
            search: globalSearch,
            skip: 0,
            limit: 100000, // Large limit for export
            status: statusFilter || undefined,
            category: filterCategory || undefined,
            branch_id: filterBranch || undefined,
            description: filterDescription || undefined,
            fixed_asset_number: filterFixedAsset || undefined,
            purchase_date: filterPurchaseDate || undefined
        };
        const response = await api.get('/items/', { params });
        return response.data;
    }

    const exportCSV = async () => {
        const data = await getAllFilteredItems();
        const csvHeader = "ID,Descrição,Categoria,Status,Valor Compra,Valor Contábil,Data de Compra,Número da Nota,Número de Série,Ativo Fixo,Filial,Responsável,Observações,Arquivo da Nota,Histórico de Ações\n";
        const csvBody = data.map((item: any) => {
            const logsStr = item.logs && item.logs.length > 0
                ? item.logs.map((log: any) => `[${new Date(log.timestamp).toLocaleDateString()}] ${log.user?.name || 'Sistema'}: ${translateLogAction(log.action)}`).join('; ')
                : "Sem histórico";
            const purchaseDate = item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('pt-BR') : '';
            return `${item.id},"${item.description}","${item.category}",${translateStatus(item.status)},${item.invoice_value},${item.accounting_value || 0},"${purchaseDate}","${item.invoice_number || ''}","${item.serial_number || ''}","${item.fixed_asset_number || ''}","${item.branch?.name || ''}","${item.responsible?.name || ''}","${item.observations || ''}","${item.invoice_file || ''}","${logsStr}"`;
        }).join("\n");
        const csvContent = csvHeader + csvBody;
        const latin1Bytes = new Uint8Array(csvContent.length);
        for (let i = 0; i < csvContent.length; i++) {
            const charCode = csvContent.charCodeAt(i);
            latin1Bytes[i] = charCode & 0xFF;
        }
        const blob = new Blob([latin1Bytes], { type: 'text/csv;charset=windows-1252' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventario_detalhado.csv';
        a.click();
    };

    const exportXLSX = async () => {
        const data = await getAllFilteredItems();
        const formattedData = data.map((item: any) => ({
            ID: item.id,
            Descrição: item.description,
            Categoria: item.category,
            Status: translateStatus(item.status),
            'Valor Compra': item.invoice_value,
            'Valor Contábil': item.accounting_value || 0,
            'Data Compra': item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('pt-BR') : '',
            'Nota Fiscal': item.invoice_number,
            'Ativo Fixo': item.fixed_asset_number,
            Filial: item.branch?.name,
            Responsável: item.responsible?.name
        }));

        const ws = XLSX.utils.json_to_sheet(formattedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventário");
        XLSX.writeFile(wb, "inventario.xlsx");
    };

    const exportPDF = async () => {
        const data = await getAllFilteredItems();
        const doc = new jsPDF('l', 'mm', 'a4');
        const headers = [['ID', 'Descrição', 'Categoria', 'Status', 'Valor', 'Data', 'Ativo Fixo', 'Filial']];
        const rows = data.map((item: any) => [
            item.id,
            item.description,
            item.category,
            translateStatus(item.status),
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.invoice_value),
            item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('pt-BR') : '',
            item.fixed_asset_number || '',
            item.branch?.name || ''
        ]);

        autoTable(doc, {
            head: headers,
            body: rows,
            startY: 20,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [79, 70, 229] }
        });
        doc.save('inventario.pdf');
    };

    const onSubmit = async (data: any) => {
        if (data.fixed_asset_number) {
            try {
                let url = `/items/check-asset/${data.fixed_asset_number}`;
                if (editingItem) {
                    url += `?exclude_item_id=${editingItem.id}`;
                }
                const checkResponse = await api.get(url);
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
        }

        const formData = new FormData();
        formData.append('description', data.description);
        formData.append('category', data.category);
        formData.append('purchase_date', data.purchase_date);
        formData.append('invoice_value', data.invoice_value);
        formData.append('invoice_number', data.invoice_number);
        formData.append('branch_id', data.branch_id);
        formData.append('supplier_id', data.supplier_id);
        if (data.serial_number) formData.append('serial_number', data.serial_number);
        if (data.fixed_asset_number) formData.append('fixed_asset_number', data.fixed_asset_number);
        if (data.observations) formData.append('observations', data.observations);
        if (data.file && data.file[0]) formData.append('file', data.file[0]);

        try {
            if (editingItem) {
                const updatePayload = {
                    description: data.description,
                    category: data.category,
                    purchase_date: data.purchase_date,
                    invoice_value: parseFloat(data.invoice_value),
                    invoice_number: data.invoice_number,
                    supplier_id: data.supplier_id,
                    serial_number: data.serial_number,
                    fixed_asset_number: data.fixed_asset_number,
                    observations: data.observations,
                    status: (user?.role === 'OPERATOR' && editingItem.status === 'REJECTED') ? 'PENDING' : undefined
                };

                await api.put(`/items/${editingItem.id}`, updatePayload);
                alert("Item atualizado com sucesso!");
            } else {
                await api.post('/items/', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
            }
            reset();
            setIsCreateModalOpen(false);
            setEditingItem(null);
            setSelectedSupplier(null);
            setInvoiceValueDisplay('');
            fetchItems(globalSearch, 0); // Reload
        } catch (error) {
            console.error("Erro ao salvar item", error);
            alert("Erro ao salvar item.");
        }
    };


    const handleStatusChange = async (itemId: number, newStatus: string, fixedAsset?: string) => {
        try {
            if (newStatus === 'APPROVED' && approvalCategory && selectedItem && approvalCategory !== selectedItem.category) {
                 await api.put(`/items/${itemId}`, { category: approvalCategory });
            }

            let url = `/items/${itemId}/status?status_update=${newStatus}`;
            if (fixedAsset) {
                url += `&fixed_asset_number=${fixedAsset}`;
            }
            await api.put(url);
            fetchItems(globalSearch, 0);
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
        setApprovalCategory(item.category);
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

    const openEditModal = (item: any) => {
        setEditingItem(item);
        setValue('description', item.description);
        setValue('category', item.category);
        const dateStr = item.purchase_date ? new Date(item.purchase_date).toISOString().split('T')[0] : '';
        setValue('purchase_date', dateStr);

        setValue('invoice_value', item.invoice_value);
        setInvoiceValueDisplay(item.invoice_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));

        setValue('invoice_number', item.invoice_number);
        setValue('serial_number', item.serial_number);
        setValue('fixed_asset_number', item.fixed_asset_number);
        setValue('branch_id', item.branch_id);
        setValue('observations', item.observations);

        if (item.supplier) {
            setSelectedSupplier(item.supplier);
            setValue('supplier_id', item.supplier.id);
        } else {
            setSelectedSupplier(null);
            setValue('supplier_id', '');
        }

        setIsCreateModalOpen(true);
    }

    const handleTransferRequest = async () => {
        if (!selectedItem || !transferTargetBranch) return;
        try {
            await api.post(`/items/${selectedItem.id}/transfer?target_branch_id=${transferTargetBranch}`);
            fetchItems(globalSearch, 0);
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
            fetchItems(globalSearch, 0);
            setIsWriteOffModalOpen(false);
            setSelectedItem(null);
            setWriteOffJustification('');
            alert("Solicitação de baixa enviada com sucesso!");
        } catch (error) {
            console.error("Erro ao solicitar baixa", error);
            alert("Erro ao solicitar baixa.");
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="text-blue-600" /> Inventário
                </h1>
                 <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar item..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <Download size={16} /> Exportar
                            <ChevronDown size={14} />
                        </button>
                         {isExportMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsExportMenuOpen(false)}></div>
                                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl py-1 z-20 border border-slate-100">
                                    <button onClick={() => { exportXLSX(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                                        <FileSpreadsheet size={16} className="text-green-600" /> Excel (.xlsx)
                                    </button>
                                    <button onClick={() => { exportCSV(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                                        <TableIcon size={16} className="text-blue-600" /> CSV (.csv)
                                    </button>
                                    <button onClick={() => { exportPDF(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                                        <FileText size={16} className="text-red-600" /> PDF (.pdf)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {user?.role !== 'AUDITOR' && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm shadow-blue-500/20"
                        >
                            <Plus size={16} /> Novo Item
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto min-h-[500px]">
                    <table className="min-w-full text-sm text-left relative">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-6 py-4 min-w-[200px]">
                                    <div className="flex flex-col gap-2">
                                        <span>Descrição</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal normal-case bg-white" value={filterDescription} onChange={e => setFilterDescription(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 min-w-[150px]">
                                     <div className="flex flex-col gap-2">
                                        <span>Categoria</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal normal-case bg-white" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 min-w-[150px]">
                                     <div className="flex flex-col gap-2">
                                        <span>Filial</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal normal-case bg-white" value={filterBranch} onChange={e => setFilterBranch(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 min-w-[130px]">
                                     <div className="flex flex-col gap-2">
                                        <span>Ativo Fixo</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal normal-case bg-white" value={filterFixedAsset} onChange={e => setFilterFixedAsset(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 min-w-[130px]">
                                     <div className="flex flex-col gap-2">
                                        <span>Data Compra</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-normal normal-case bg-white" value={filterPurchaseDate} onChange={e => setFilterPurchaseDate(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4">Valor Compra</th>
                                <th className="px-6 py-4">Valor Contábil</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-700">{item.description}</td>
                                    <td className="px-6 py-4 text-slate-500">{item.category}</td>
                                    <td className="px-6 py-4 text-slate-500">{item.branch?.name || '-'}</td>
                                    <td className="px-6 py-4 text-slate-600 font-mono text-xs bg-slate-50 rounded w-fit">{item.fixed_asset_number || '-'}</td>
                                    <td className="px-6 py-4 text-slate-500">{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('pt-BR') : '-'}</td>
                                    <td className="px-6 py-4 font-medium text-slate-700">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.invoice_value)}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-600">
                                        {item.accounting_value !== undefined
                                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.accounting_value)
                                            : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={item.status} />
                                    </td>
                                    <td className="px-6 py-4 flex justify-end gap-2 items-center">
                                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && item.status === 'PENDING' && (
                                            <>
                                                <button onClick={() => openApproveModal(item)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Aprovar">
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button onClick={() => handleStatusChange(item.id, 'REJECTED')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Rejeitar">
                                                    <XCircle size={18} />
                                                </button>
                                            </>
                                        )}

                                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && item.status === 'WRITE_OFF_PENDING' && (
                                            <>
                                                <button onClick={() => handleStatusChange(item.id, 'WRITTEN_OFF')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold" title="Aprovar Baixa"><CheckCircle size={18} /></button>
                                                <button onClick={() => handleStatusChange(item.id, 'REJECTED')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Rejeitar Baixa"><ArrowRightLeft size={18} /></button>
                                            </>
                                        )}

                                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && item.status === 'TRANSFER_PENDING' && (
                                            <>
                                                <button onClick={() => handleStatusChange(item.id, 'APPROVED')} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Aprovar Transferência"><CheckCircle size={18} /></button>
                                                <button onClick={() => handleStatusChange(item.id, 'REJECTED')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Rejeitar"><XCircle size={18} /></button>
                                            </>
                                        )}

                                        {item.status === 'APPROVED' && user?.role !== 'AUDITOR' && (
                                            <>
                                                <button onClick={() => openTransferModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Transferir"><ArrowRightLeft size={18} /></button>
                                                <button onClick={() => openWriteOffModal(item)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Baixa"><FileWarning size={18} /></button>
                                            </>
                                        )}

                                        {item.invoice_file && (
                                            <a href={`${api.defaults.baseURL}/${item.invoice_file}`} target="_blank" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver NF">
                                                <FileText size={18} />
                                            </a>
                                        )}

                                        <button onClick={() => openDetailsModal(item)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Detalhes">
                                            <Eye size={18} />
                                        </button>

                                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER' || (user?.role === 'OPERATOR' && item.status === 'REJECTED')) && (
                                            <button
                                                onClick={() => openEditModal(item)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title={item.status === 'REJECTED' ? "Corrigir" : "Editar"}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                     <span className="text-sm text-slate-500 font-medium">
                        Exibindo {items.length} itens nesta página (Scroll Infinito não, paginação padrão)
                     </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { if(page > 0) { const prev = page -1; setPage(prev); fetchItems(globalSearch, prev).then(res => setItems(res?.data || [])) } }}
                            disabled={page === 0}
                            className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Anterior
                        </button>
                        <span className="text-sm text-slate-500 font-medium px-2 py-2">Página {page + 1}</span>
                        <button
                            onClick={() => { if(hasMore) { const next = page + 1; setPage(next); fetchItems(globalSearch, next).then(res => setItems(res?.data || [])) } }}
                            disabled={!hasMore}
                            className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-white/20 animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">{editingItem ? 'Editar Item' : 'Novo Item'}</h2>
                            <button onClick={() => { setIsCreateModalOpen(false); setEditingItem(null); reset(); setSelectedSupplier(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</label>
                                <input {...register('description', { required: true })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" onChange={(e) => { e.target.value = e.target.value.toUpperCase(); register('description').onChange(e); }} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoria</label>
                                <select {...register('category', { required: true })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                                    <option value="">Selecione...</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fornecedor</label>
                                <div className="flex gap-2">
                                    <input readOnly value={selectedSupplier ? `${selectedSupplier.name}` : ''} placeholder="Selecione..." className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed text-slate-500" />
                                    <input type="hidden" {...register('supplier_id', { required: true })} />
                                    <button type="button" onClick={() => { setIsSupplierModalOpen(true); fetchSuppliers(); }} className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 transition-colors"><Search size={18} /></button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Data Compra</label>
                                <input type="date" {...register('purchase_date', { required: true })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</label>
                                <input type="text" value={invoiceValueDisplay} onChange={(e) => { let val = e.target.value.replace(/\D/g, ''); if (!val) { setInvoiceValueDisplay(''); setValue('invoice_value', ''); return; } const floatVal = parseFloat(val) / 100; setInvoiceValueDisplay(floatVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })); setValue('invoice_value', floatVal); }} placeholder="0,00" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                                <input type="hidden" {...register('invoice_value', { required: true })} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Número Nota</label>
                                <input {...register('invoice_number', { required: true })} onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, ''); register('invoice_number').onChange(e); }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Número Série</label>
                                <input {...register('serial_number')} onChange={(e) => { e.target.value = e.target.value.toUpperCase(); register('serial_number').onChange(e); }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ativo Fixo</label>
                                <input {...register('fixed_asset_number')} onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, ''); register('fixed_asset_number').onChange(e); }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Opcional" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filial</label>
                                <select {...register('branch_id', { required: true })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-100 disabled:text-slate-400" disabled={!!editingItem}>
                                    <option value="">Selecione...</option>
                                    {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nota Fiscal (Arquivo)</label>
                                <input type="file" {...register('file')} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all text-sm text-slate-500" disabled={!!editingItem} />
                            </div>
                            <div className="col-span-1 md:col-span-2 space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Observações</label>
                                <textarea {...register('observations')} onChange={(e) => { e.target.value = e.target.value.toUpperCase(); register('observations').onChange(e); }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" rows={3} />
                            </div>

                            <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => { setIsCreateModalOpen(false); setEditingItem(null); reset(); setSelectedSupplier(null); }} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium transition-colors">Cancelar</button>
                                <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 transition-all">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Approval Modal (Redesigned) */}
            {isApproveModalOpen && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-800">Aprovar Item</h3>
                            <p className="text-sm text-slate-500 mt-1">{selectedItem.description}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50/50 p-4 rounded-xl text-sm space-y-2 border border-blue-100">
                                <div className="flex justify-between"><span className="text-slate-500">Valor:</span> <span className="font-semibold text-slate-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedItem.invoice_value)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Filial:</span> <span className="font-medium text-slate-700">{selectedItem.branch?.name}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">NF:</span> <span className="font-medium text-slate-700">{selectedItem.invoice_number}</span></div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoria</label>
                                <select value={approvalCategory} onChange={(e) => setApprovalCategory(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                                    {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ativo Fixo {selectedItem.fixed_asset_number ? '' : '(Obrigatório)'}</label>
                                {selectedItem.fixed_asset_number ? (
                                    <div className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono">{selectedItem.fixed_asset_number}</div>
                                ) : (
                                    <input type="text" value={fixedAssetNumber} onChange={(e) => setFixedAssetNumber(e.target.value.replace(/\D/g, ''))} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono" placeholder="Ex: 12345" />
                                )}
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                            <button onClick={() => handleStatusChange(selectedItem.id, 'REJECTED')} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">Rejeitar</button>
                            <button onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
                            <button onClick={async () => {
                                if (!fixedAssetNumber && !selectedItem.fixed_asset_number) { alert("Ativo Fixo obrigatório"); return; }

                                // Verify uniqueness
                                try {
                                    const assetToCheck = fixedAssetNumber || selectedItem.fixed_asset_number;
                                    const checkResponse = await api.get(`/items/check-asset/${assetToCheck}?exclude_item_id=${selectedItem.id}`);
                                    if (checkResponse.data.exists) {
                                        setDuplicateAssetItem(checkResponse.data.item);
                                        setIsDuplicateAssetModalOpen(true);
                                        return;
                                    }
                                } catch (error) {
                                    console.error("Erro ao verificar ativo", error);
                                    alert("Erro ao validar Ativo Fixo.");
                                    return;
                                }

                                handleStatusChange(selectedItem.id, 'APPROVED', fixedAssetNumber);
                            }} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-lg shadow-green-500/20 transition-all">Aprovar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Other modals (Write-off, Transfer, Details, Supplier Search) follow similar pattern... */}
            {/* Keeping code concise, assuming similar restyling for brevity, applying generic style) */}

            {/* Details Modal */}
            {isDetailsModalOpen && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20 animate-scale-in">
                        <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Detalhes do Item</h3>
                                <p className="text-sm text-slate-500 mt-1">ID: #{selectedItem.id}</p>
                            </div>
                            <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24}/></button>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="space-y-4">
                                <div><span className="block text-xs font-bold text-slate-400 uppercase">Descrição</span><p className="text-slate-700 font-medium text-base">{selectedItem.description}</p></div>
                                <div><span className="block text-xs font-bold text-slate-400 uppercase">Categoria</span><p className="text-slate-700">{selectedItem.category}</p></div>
                                <div><span className="block text-xs font-bold text-slate-400 uppercase">Fornecedor</span><p className="text-slate-700">{selectedItem.supplier?.name || '-'}</p></div>
                                <div><span className="block text-xs font-bold text-slate-400 uppercase">Filial</span><p className="text-slate-700">{selectedItem.branch?.name}</p></div>
                            </div>
                            <div className="space-y-4">
                                <div><span className="block text-xs font-bold text-slate-400 uppercase">Valor de Compra</span><p className="text-slate-700 font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedItem.invoice_value)}</p></div>
                                <div><span className="block text-xs font-bold text-slate-400 uppercase">Valor Contábil</span><p className="text-slate-700 font-medium">{selectedItem.accounting_value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedItem.accounting_value) : '-'}</p></div>
                                <div><span className="block text-xs font-bold text-slate-400 uppercase">Data Compra</span><p className="text-slate-700">{new Date(selectedItem.purchase_date).toLocaleDateString('pt-BR')}</p></div>
                                <div><span className="block text-xs font-bold text-slate-400 uppercase">Ativo Fixo</span><p className="font-mono bg-slate-100 inline-block px-2 py-1 rounded text-slate-600">{selectedItem.fixed_asset_number || 'Pendente'}</p></div>
                            </div>
                            <div className="md:col-span-2">
                                <span className="block text-xs font-bold text-slate-400 uppercase mb-2">Histórico</span>
                                <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-100 text-slate-500 uppercase"><tr><th className="px-4 py-2 text-left">Data</th><th className="px-4 py-2 text-left">Usuário</th><th className="px-4 py-2 text-left">Ação</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedItem.logs?.map((log: any) => (
                                                <tr key={log.id}>
                                                    <td className="px-4 py-2 text-slate-500">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                                                    <td className="px-4 py-2 text-slate-700 font-medium">{log.user?.name}</td>
                                                    <td className="px-4 py-2 text-slate-600">{translateLogAction(log.action)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Supplier Search Modal */}
            {isSupplierModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Selecionar Fornecedor</h3>
                            <button onClick={() => setIsSupplierModalOpen(false)}><XCircle size={20} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="p-4">
                            <input type="text" placeholder="Buscar..." className="w-full px-4 py-2 border border-slate-200 rounded-lg mb-4 text-sm" value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); fetchSuppliers(e.target.value); }} />
                            <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-lg">
                                {suppliers.map(s => (
                                    <div key={s.id} onClick={() => { setSelectedSupplier(s); setValue('supplier_id', s.id); setIsSupplierModalOpen(false); }} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center group">
                                        <div><p className="font-medium text-slate-700 text-sm">{s.name}</p><p className="text-xs text-slate-400">{s.cnpj}</p></div>
                                        <CheckCircle size={16} className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reuse Write-off and Transfer Modals structure similarly (omitted deep detail for brevity, applying generic style) */}
            {(isWriteOffModalOpen || isTransferModalOpen) && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
                        <h3 className="text-lg font-bold mb-4">{isWriteOffModalOpen ? 'Solicitar Baixa' : 'Solicitar Transferência'}</h3>
                        {/* Content for these modals using state variables */}
                        {isWriteOffModalOpen && (
                            <textarea value={writeOffJustification} onChange={e => setWriteOffJustification(e.target.value)} className="w-full border rounded-lg p-3 text-sm mb-4" rows={3} placeholder="Justificativa..." />
                        )}
                        {isTransferModalOpen && (
                            <select value={transferTargetBranch} onChange={e => setTransferTargetBranch(e.target.value)} className="w-full border rounded-lg p-2 mb-4">
                                <option value="">Selecione filial...</option>
                                {branches.filter(b => b.id !== selectedItem.branch_id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        )}
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setIsWriteOffModalOpen(false); setIsTransferModalOpen(false); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg">Cancelar</button>
                            <button onClick={isWriteOffModalOpen ? handleWriteOffRequest : handleTransferRequest} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Asset Modal */}
            {isDuplicateAssetModalOpen && duplicateAssetItem && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full animate-scale-in">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertCircle size={28} />
                            <h3 className="text-lg font-bold">Ativo Fixo Duplicado!</h3>
                        </div>
                        <p className="text-slate-600 mb-4">
                            O número de Ativo Fixo <strong>{duplicateAssetItem.fixed_asset_number}</strong> já está cadastrado para:
                        </p>
                        <div className="bg-red-50 border border-red-100 p-4 rounded-lg mb-6 text-sm">
                            <p><strong>Item:</strong> {duplicateAssetItem.description}</p>
                            <p><strong>Filial:</strong> {duplicateAssetItem.branch?.name}</p>
                            <p><strong>Responsável:</strong> {duplicateAssetItem.responsible?.name}</p>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => { setIsDuplicateAssetModalOpen(false); setDuplicateAssetItem(null); }}
                                className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
