
import React, { useEffect, useState } from 'react';
import api, { bulkWriteOff, bulkTransfer } from '../api';
import { useForm } from 'react-hook-form';
import { useAuth } from '../AuthContext';
import { useError } from '../hooks/useError';
import { useSearchParams } from 'react-router-dom';
import { translateStatus, translateLogAction } from '../utils/translations';
import { Edit2, Eye, CheckCircle, XCircle, ArrowRightLeft, FileText, Search, Plus, FileWarning, AlertCircle, Download, FileSpreadsheet, Table as TableIcon, ChevronDown, Wrench, Archive, RefreshCw, Upload, Truck, PackageCheck, Layers, X, Trash2 } from 'lucide-react';
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
        MAINTENANCE: { label: 'Manutenção', class: 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-600/20' },
        IN_STOCK: { label: 'Estoque', class: 'bg-cyan-50 text-cyan-700 border-cyan-200 ring-cyan-600/20' },
        IN_TRANSIT: { label: 'Em Trânsito', class: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-600/20' },
    };
    const config = map[status] || { label: status, class: 'bg-gray-50 text-gray-600 border-gray-200' };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ring-1 ring-inset ${config.class}`}>
            {config.label}
        </span>
    );
};

interface InventoryProps {
    embedded?: boolean;
    defaultStatus?: string;
}

const Inventory: React.FC<InventoryProps> = ({ embedded = false, defaultStatus }) => {
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
    const [safeguardThreshold, setSafeguardThreshold] = useState<number | null>(null);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTargetBranch, setTransferTargetBranch] = useState<string>('');
    const [allBranches, setAllBranches] = useState<any[]>([]);

    // New Transfer Fields
    const [transferInvoiceNumber, setTransferInvoiceNumber] = useState('');
    const [transferInvoiceSeries, setTransferInvoiceSeries] = useState('');
    const [transferInvoiceDate, setTransferInvoiceDate] = useState('');

    const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
    const [writeOffJustification, setWriteOffJustification] = useState('');

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    const [editingItem, setEditingItem] = useState<any>(null);
    const [approvalCategory, setApprovalCategory] = useState('');

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Filter States
    const [filterDescription, setFilterDescription] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [filterFixedAsset, setFilterFixedAsset] = useState('');
    const [filterPurchaseDate, setFilterPurchaseDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importBranch, setImportBranch] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const { showError, showSuccess, showWarning } = useError();

    // Bulk Operations State
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [isBulkActionsVisible, setIsBulkActionsVisible] = useState(false);
    const [isBulkWriteOffModalOpen, setIsBulkWriteOffModalOpen] = useState(false);
    const [isBulkTransferModalOpen, setIsBulkTransferModalOpen] = useState(false);
    const [selectionMode, setSelectionMode] = useState<'TRANSFER' | 'WRITE_OFF' | null>(null);
    const [lockedCategory, setLockedCategory] = useState<string | null>(null);
    const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
    const [bulkWriteOffReason, setBulkWriteOffReason] = useState('Venda'); // Default
    const [bulkWriteOffJustification, setBulkWriteOffJustification] = useState('');
    const [bulkTransferTargetBranch, setBulkTransferTargetBranch] = useState<string>('');
    const [bulkTransferInvoiceNumber, setBulkTransferInvoiceNumber] = useState('');
    const [bulkTransferInvoiceSeries, setBulkTransferInvoiceSeries] = useState('');
    const [bulkTransferInvoiceDate, setBulkTransferInvoiceDate] = useState('');

    const toggleSelection = (item: any) => {
        const id = item.id;
        const newSelection = new Set(selectedItems);

        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            // Adding item
            if (newSelection.size === 0) {
                // First item - Lock Category and Filter
                setLockedCategory(item.category);
                setFilterCategory(item.category);
            } else {
                // Check constraint
                if (lockedCategory && item.category !== lockedCategory) {
                    showWarning(`Você só pode selecionar itens da categoria: ${lockedCategory}`);
                    return;
                }
            }
            newSelection.add(id);
        }
        setSelectedItems(newSelection);
    };

    const clearSelection = () => {
        setSelectedItems(new Set());
        setLockedCategory(null);
        setSelectionMode(null);
        setFilterCategory('');
    };

    const startSelectionMode = (mode: 'TRANSFER' | 'WRITE_OFF') => {
        setSelectionMode(mode);
        setSelectedItems(new Set());
        setLockedCategory(null);
        setIsBulkMenuOpen(false);
    };

    useEffect(() => {
        setIsBulkActionsVisible(selectedItems.size > 0);
    }, [selectedItems]);

    const handleBulkWriteOff = async () => {
        // Validate Category Homogeneity
        if (selectedItems.size === 0) return;

        // We need to check categories of selected items.
        // Ideally we fetch details or use loaded items.
        // Using loaded 'items' might miss items if pagination changed, but user prompt says "Persistent selection".
        // The implementation strategy: We assume selected items are in 'items' array OR we must fetch them.
        // Simplest robust way: Check loaded items first. If some missing (due to page change), backend validates anyway.
        // Frontend validation for better UX:
        const selectedList = items.filter(i => selectedItems.has(i.id));

        // Note: If persistence across pages works, 'items' only has current page.
        // We can't validate mixed categories easily on frontend if items aren't loaded.
        // Strategy: Let backend validate. Or fetch IDs.
        // For UX "Bloquear a ação", we try our best with visible items.

        if (selectedList.length > 0) {
            const firstCategory = selectedList[0].category;
            const hasMixed = selectedList.some(i => i.category !== firstCategory);
            if (hasMixed) {
                showWarning("A baixa em lote só é permitida para itens da MESMA categoria.");
                return;
            }
        }

        try {
            await bulkWriteOff({
                item_ids: Array.from(selectedItems),
                reason: bulkWriteOffReason,
                justification: bulkWriteOffJustification
            });
            showSuccess("Baixa em lote realizada com sucesso!");
            clearSelection();
            setIsBulkWriteOffModalOpen(false);
            fetchItems(globalSearch, page); // Reload current page
        } catch (error: any) {
            console.error("Bulk Write-off error", error);
            // Show specific backend message
            const msg = error.response?.data?.detail || "Erro ao realizar baixa em lote.";
            showError(msg); // Use string directly if custom hook supports or handle object
        }
    };

    const handleBulkTransfer = async () => {
        if (!bulkTransferTargetBranch) {
            showWarning("Selecione a filial de destino.");
            return;
        }

        try {
            await bulkTransfer({
                item_ids: Array.from(selectedItems),
                target_branch_id: parseInt(bulkTransferTargetBranch),
                invoice_number: bulkTransferInvoiceNumber,
                invoice_series: bulkTransferInvoiceSeries,
                invoice_date: bulkTransferInvoiceDate
            });
            showSuccess("Transferência em lote iniciada!");
            clearSelection();
            setIsBulkTransferModalOpen(false);
            fetchItems(globalSearch, page);
        } catch (error: any) {
            console.error("Bulk Transfer error", error);
            const msg = error.response?.data?.detail || "Erro ao realizar transferência em lote.";
            showError(msg);
        }
    };

    const handleImport = async () => {
        if (!importFile || !importBranch) {
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('branch_id', importBranch);

        try {
            const response = await api.post('/import/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResult(response.data);
            if (response.data.success > 0) {
                showSuccess(`${response.data.success} itens importados com sucesso!`);
                fetchItems(globalSearch, 0);
            }
            if (response.data.errors && response.data.errors.length > 0) {
                showWarning("Alguns itens falharam. Verifique o relatório.");
            }
        } catch (error) {
            console.error("Import error", error);
            showError(error, "IMPORT_ERROR");
        } finally {
            setIsUploading(false);
        }
    };

    // Debounce Logic helper
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchItems(globalSearch, 0);
        }, 500);
        return () => clearTimeout(timer);
    }, [filterDescription, filterCategory, filterBranch, filterFixedAsset, filterPurchaseDate, filterStatus, globalSearch]); // Trigger on filter change

    // Sync URL params with local state on load
    useEffect(() => {
        if (!embedded) {
            const cat = searchParams.get('category');
            const br = searchParams.get('branch_id');
            const st = searchParams.get('status');

            if (cat) setFilterCategory(cat);
            if (br) setFilterBranch(br);
            if (st) setFilterStatus(st);
        }
    }, [embedded, searchParams]);

    const fetchItems = async (search?: string, pageNum: number = 0) => {
        try {
            const statusFilter = embedded ? defaultStatus : filterStatus;

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

    const fetchAllBranches = async () => {
        try {
            const response = await api.get('/branches/', { params: { scope: 'all' } });
            setAllBranches(response.data);
        } catch (error) {
            console.error("Erro ao carregar todas as filiais", error);
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

    const fetchSettings = async () => {
        try {
            const response = await api.get('/settings/');
            if (response.data.safeguard_threshold) {
                setSafeguardThreshold(parseFloat(response.data.safeguard_threshold));
            }
        } catch (error) {
            console.error("Erro ao carregar configurações", error);
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
        fetchBranches();
        fetchCategories();
        fetchSettings();
    }, []);

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
                showError("ASSET_DUPLICATE_CHECK_ERROR");
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
                showSuccess("Item atualizado com sucesso!");
            } else {
                await api.post('/items/', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
                showSuccess("Item criado com sucesso!");
            }
            reset();
            setIsCreateModalOpen(false);
            setEditingItem(null);
            setSelectedSupplier(null);
            setInvoiceValueDisplay('');
            fetchItems(globalSearch, 0); // Reload
        } catch (error) {
            console.error("Erro ao salvar item", error);
            showError(error, "ITEM_SAVE_ERROR");
        }
    };


    const handleStatusChange = async (itemId: number, newStatus: string, fixedAsset?: string, reason?: string) => {
        try {
            if (newStatus === 'APPROVED' && approvalCategory && selectedItem && approvalCategory !== selectedItem.category) {
                 await api.put(`/items/${itemId}`, { category: approvalCategory });
            }

            let url = `/items/${itemId}/status?status_update=${newStatus}`;
            if (fixedAsset) {
                url += `&fixed_asset_number=${fixedAsset}`;
            }
            if (reason) {
                url += `&reason=${encodeURIComponent(reason)}`;
            }
            await api.put(url);
            fetchItems(globalSearch, 0);
            setIsApproveModalOpen(false);
            setIsChangeStatusModalOpen(false);
            setIsRejectModalOpen(false);
            setSelectedItem(null);
            setFixedAssetNumber('');
            setRejectionReason('');
            showSuccess(`Status atualizado para ${translateStatus(newStatus)}`);
        } catch (error) {
            console.error("Erro ao atualizar status", error);
            showError(error, "STATUS_UPDATE_ERROR");
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
        setTransferInvoiceNumber('');
        setTransferInvoiceSeries('');
        setTransferInvoiceDate('');
        setIsTransferModalOpen(true);
        // Fetch ALL branches for transfer target
        fetchAllBranches();
    };

    const openWriteOffModal = (item: any) => {
        setSelectedItem(item);
        // Reset fields for mandatory reason logic
        setWriteOffJustification('');
        setBulkWriteOffReason(''); // Reusing this state or create new one for individual
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
        if (!transferInvoiceNumber || !transferInvoiceSeries || !transferInvoiceDate) {
            showWarning("Informe os dados da Nota Fiscal de Transferência");
            return;
        }

        try {
            await api.post(`/items/${selectedItem.id}/transfer?target_branch_id=${transferTargetBranch}&transfer_invoice_number=${transferInvoiceNumber}&transfer_invoice_series=${transferInvoiceSeries}&transfer_invoice_date=${transferInvoiceDate}`);
            fetchItems(globalSearch, 0);
            setIsTransferModalOpen(false);
            setSelectedItem(null);
            setTransferTargetBranch('');
            showSuccess("Solicitação de transferência enviada com sucesso!");
        } catch (error) {
            console.error("Erro ao solicitar transferência", error);
            showError(error, "TRANSFER_ERROR");
        }
    };

    const handleWriteOffRequest = async () => {
        if (!selectedItem) return;

        // Validation: Reason is mandatory
        if (!bulkWriteOffReason) {
            showWarning("O motivo da baixa é obrigatório.");
            return;
        }

        const formData = new FormData();
        formData.append('reason', bulkWriteOffReason);
        if (writeOffJustification) formData.append('justification', writeOffJustification);

        try {
            await api.post(`/items/${selectedItem.id}/write-off`, formData);
            fetchItems(globalSearch, 0);
            setIsWriteOffModalOpen(false);
            setSelectedItem(null);
            setWriteOffJustification('');
            setBulkWriteOffReason('');
            showSuccess("Solicitação de baixa enviada com sucesso!");
        } catch (error) {
            console.error("Erro ao solicitar baixa", error);
            showError(error, "WRITEOFF_ERROR");
        }
    }

    return (
        <div className={`space-y-6 animate-fade-in ${embedded ? 'p-1' : ''}`}>
            <div className={`flex flex-col md:flex-row justify-between items-center gap-4 bg-white/80 backdrop-blur-md dark:bg-slate-800/80 p-4 rounded-xl shadow-sm border border-slate-100/50 dark:border-slate-700/50 ${embedded ? 'sticky top-0 z-10 border-none shadow-none p-0 pb-4' : ''}`}>
                {!embedded && (
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText className="text-blue-600 dark:text-blue-400" /> Inventário
                </h1>
                )}
                 <div className={`flex gap-2 w-full md:w-auto ${embedded ? 'w-full' : ''}`}>
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar item..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                        />
                    </div>

                    {/* Bulk Actions Menu */}
                    {selectionMode ? (
                        <button
                            onClick={clearSelection}
                            className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium flex items-center gap-2 animate-fade-in"
                        >
                            <X size={16} /> Cancelar Seleção
                        </button>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={() => setIsBulkMenuOpen(!isBulkMenuOpen)}
                                className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium flex items-center gap-2"
                            >
                                <Layers size={16} /> Ações em Lote
                                <ChevronDown size={14} />
                            </button>
                            {isBulkMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setIsBulkMenuOpen(false)}></div>
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl py-1 z-40 border border-slate-100 dark:border-slate-700">
                                        <button onClick={() => startSelectionMode('TRANSFER')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2">
                                            <Truck size={16} className="text-blue-600 dark:text-blue-400" /> Transferir em Lote
                                        </button>
                                        <button onClick={() => startSelectionMode('WRITE_OFF')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2">
                                            <Trash2 size={16} className="text-red-600 dark:text-red-400" /> Baixar em Lote
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="relative">
                        <button
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <Download size={16} /> Exportar
                            <ChevronDown size={14} />
                        </button>
                         {isExportMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsExportMenuOpen(false)}></div>
                                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-xl py-1 z-20 border border-slate-100 dark:border-slate-700">
                                    <button onClick={() => { exportXLSX(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2">
                                        <FileSpreadsheet size={16} className="text-green-600 dark:text-green-400" /> Excel (.xlsx)
                                    </button>
                                    <button onClick={() => { exportCSV(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2">
                                        <TableIcon size={16} className="text-blue-600 dark:text-blue-400" /> CSV (.csv)
                                    </button>
                                    <button onClick={() => { exportPDF(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2">
                                        <FileText size={16} className="text-red-600 dark:text-red-400" /> PDF (.pdf)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {(user?.role !== 'AUDITOR' && user?.can_import) && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <Upload size={16} /> Importar
                        </button>
                    )}

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

            <div className="bg-white/80 backdrop-blur-md dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-100/50 dark:border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto min-h-[500px]">
                    <table className="min-w-full text-sm text-left relative">
                        <thead className="bg-slate-50/80 dark:bg-slate-700/80 border-b border-slate-100/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-300 font-semibold uppercase tracking-wider text-xs">
                            <tr>
                                {selectionMode && (
                                    <th className="px-3 py-4 w-12 text-center">
                                        <CheckCircle size={16} className="mx-auto text-slate-400" />
                                    </th>
                                )}
                                <th className="px-6 py-4 min-w-[200px]">
                                    <div className="flex flex-col gap-2">
                                        <span>Descrição</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded font-normal normal-case bg-white/50 dark:bg-slate-800 dark:text-slate-200 placeholder-slate-400" value={filterDescription} onChange={e => setFilterDescription(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 min-w-[150px]">
                                     <div className="flex flex-col gap-2">
                                        <span>Categoria</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded font-normal normal-case bg-white dark:bg-slate-800 dark:text-slate-200 placeholder-slate-400" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 min-w-[150px]">
                                     <div className="flex flex-col gap-2">
                                        <span>Filial</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded font-normal normal-case bg-white dark:bg-slate-800 dark:text-slate-200 placeholder-slate-400" value={filterBranch} onChange={e => setFilterBranch(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 min-w-[130px]">
                                     <div className="flex flex-col gap-2">
                                        <span>Ativo Fixo</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded font-normal normal-case bg-white dark:bg-slate-800 dark:text-slate-200 placeholder-slate-400" value={filterFixedAsset} onChange={e => setFilterFixedAsset(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 min-w-[130px]">
                                     <div className="flex flex-col gap-2">
                                        <span>Data Compra</span>
                                        <input type="text" placeholder="Filtrar..." className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded font-normal normal-case bg-white dark:bg-slate-800 dark:text-slate-200 placeholder-slate-400" value={filterPurchaseDate} onChange={e => setFilterPurchaseDate(e.target.value)} />
                                    </div>
                                </th>
                                <th className="px-6 py-4">Valor Compra</th>
                                <th className="px-6 py-4">Valor Contábil</th>
                                <th className="px-6 py-4 min-w-[130px]">
                                     <div className="flex flex-col gap-2">
                                        <span>Status</span>
                                        <select
                                            className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded font-normal normal-case bg-white dark:bg-slate-800 dark:text-slate-200"
                                            value={filterStatus}
                                            onChange={e => setFilterStatus(e.target.value)}
                                            disabled={embedded}
                                        >
                                            <option value="">Todos</option>
                                            <option value="APPROVED">Aprovado</option>
                                            <option value="PENDING">Pendente</option>
                                            <option value="REJECTED">Rejeitado</option>
                                            <option value="MAINTENANCE">Manutenção</option>
                                            <option value="IN_STOCK">Estoque</option>
                                            <option value="WRITTEN_OFF">Baixado</option>
                                            <option value="IN_TRANSIT">Em Trânsito</option>
                                            <option value="TRANSFER_PENDING">Transf. Pendente</option>
                                            <option value="WRITE_OFF_PENDING">Baixa Pendente</option>
                                        </select>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-300">
                                    {selectionMode && (
                                        <td className="px-3 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.has(item.id)}
                                                onChange={() => toggleSelection(item)}
                                                disabled={lockedCategory !== null && item.category !== lockedCategory}
                                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                            />
                                        </td>
                                    )}
                                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">{item.description}</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.category}</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                        {item.status === 'IN_TRANSIT' ? (
                                           <div className='flex flex-col'>
                                                <span className='line-through text-xs'>{item.branch?.name}</span>
                                                <span className='text-blue-600 dark:text-blue-400 font-semibold text-xs flex items-center gap-1'><ArrowRightLeft size={10}/> {item.transfer_target_branch?.name}</span>
                                           </div>
                                        ) : (
                                            item.branch?.name || '-'
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                        {item.fixed_asset_number ? (
                                            <span className="bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-100 dark:border-slate-600">{item.fixed_asset_number}</span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('pt-BR') : '-'}</td>
                                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.invoice_value)}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">
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
                                                <button onClick={() => { setSelectedItem(item); setRejectionReason(''); setIsRejectModalOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Rejeitar">
                                                    <XCircle size={18} />
                                                </button>
                                            </>
                                        )}

                                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && item.status === 'WRITE_OFF_PENDING' && (
                                            <>
                                                <button onClick={() => handleStatusChange(item.id, 'WRITTEN_OFF')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold" title="Aprovar Baixa"><CheckCircle size={18} /></button>
                                                <button onClick={() => { setSelectedItem(item); setRejectionReason(''); setIsRejectModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Rejeitar Baixa"><ArrowRightLeft size={18} /></button>
                                            </>
                                        )}

                                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && item.status === 'TRANSFER_PENDING' && (
                                            <>
                                                <button onClick={() => handleStatusChange(item.id, 'APPROVED')} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Aprovar Transferência"><CheckCircle size={18} /></button>
                                                <button onClick={() => { setSelectedItem(item); setRejectionReason(''); setIsRejectModalOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Rejeitar"><XCircle size={18} /></button>
                                            </>
                                        )}

                                        {/* Receipt Button */}
                                        {item.status === 'IN_TRANSIT' && user?.role !== 'AUDITOR' && (
                                            // TODO: Add extra check if user is in target branch (frontend logic optimization)
                                            <button onClick={() => handleStatusChange(item.id, 'IN_STOCK')} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Confirmar Recebimento">
                                                <PackageCheck size={18} />
                                            </button>
                                        )}

                                        {['APPROVED', 'MAINTENANCE', 'IN_STOCK'].includes(item.status) && user?.role !== 'AUDITOR' && (
                                            <>
                                                <button onClick={() => openTransferModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Transferir"><Truck size={18} /></button>
                                                <button onClick={() => { setSelectedItem(item); setIsChangeStatusModalOpen(true); }} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Alterar Status"><RefreshCw size={18} /></button>
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

                <div className="px-6 py-4 border-t border-slate-100/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-700/30 flex items-center justify-between">
                     <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Exibindo {items.length} itens nesta página (Scroll Infinito não, paginação padrão)
                     </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { if(page > 0) { const prev = page -1; setPage(prev); fetchItems(globalSearch, prev) } }}
                            disabled={page === 0}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                        >
                            Anterior
                        </button>
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium px-2 py-2">Página {page + 1}</span>
                        <button
                            onClick={() => { if(hasMore) { const next = page + 1; setPage(next); fetchItems(globalSearch, next) } }}
                            disabled={!hasMore}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            </div>

            {/* Bulk Action Floating Bar */}
            {selectionMode && selectedItems.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-6 animate-fade-in">
                    <span className="font-medium">{selectedItems.size} itens selecionados</span>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <button
                        onClick={() => {
                            if (selectionMode === 'TRANSFER') setIsBulkTransferModalOpen(true);
                            if (selectionMode === 'WRITE_OFF') setIsBulkWriteOffModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-medium transition-colors text-sm shadow-lg shadow-blue-500/20"
                    >
                        {selectionMode === 'TRANSFER' ? 'Confirmar Transferência' : 'Confirmar Baixa'}
                    </button>
                </div>
            )}

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
                                <input {...register('fixed_asset_number')} onChange={(e) => { e.target.value = e.target.value.toUpperCase(); register('fixed_asset_number').onChange(e); }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Opcional" />
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
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Ativo Fixo
                                    {selectedItem.fixed_asset_number ? '' :
                                        (safeguardThreshold !== null && selectedItem.invoice_value < safeguardThreshold ? ' (Opcional - Abaixo da Salva Guarda)' : ' (Obrigatório)')
                                    }
                                </label>
                                {selectedItem.fixed_asset_number ? (
                                    <div className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono">{selectedItem.fixed_asset_number}</div>
                                ) : (
                                    <input type="text" value={fixedAssetNumber} onChange={(e) => setFixedAssetNumber(e.target.value.toUpperCase())} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono" placeholder="Ex: ATV-123" />
                                )}
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                            <button onClick={() => { setIsApproveModalOpen(false); setRejectionReason(''); setIsRejectModalOpen(true); }} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">Rejeitar</button>
                            <button onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
                            <button onClick={async () => {
                                const isAssetRequired = safeguardThreshold === null || selectedItem.invoice_value >= safeguardThreshold;

                                if (!fixedAssetNumber && !selectedItem.fixed_asset_number && isAssetRequired) {
                                    showWarning("O número do Ativo Fixo é obrigatório para este valor.");
                                    return;
                                }

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
                                    showError("ASSET_DUPLICATE_CHECK_ERROR");
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
                                {selectedItem.transfer_target_branch && (
                                    <div className='bg-blue-50 p-2 rounded border border-blue-100'>
                                        <span className="block text-xs font-bold text-blue-600 uppercase">Transferência para</span>
                                        <p className="text-blue-800 font-medium">{selectedItem.transfer_target_branch.name}</p>
                                    </div>
                                )}
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
                        <h3 className="text-lg font-bold mb-4 text-slate-800">{isWriteOffModalOpen ? 'Solicitar Baixa' : 'Solicitar Transferência'}</h3>
                        {/* Content for these modals using state variables */}
                        {isWriteOffModalOpen && (
                             <div className='space-y-4'>
                                {/* Summary Block */}
                                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm mb-4">
                                    <p><span className="text-slate-500 font-medium">Item:</span> {selectedItem.description}</p>
                                    <p><span className="text-slate-500 font-medium">Categoria:</span> {selectedItem.category}</p>
                                    <p><span className="text-slate-500 font-medium">Valor Contábil:</span> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedItem.accounting_value || selectedItem.invoice_value)}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da Baixa (Obrigatório)</label>
                                    <select
                                        value={bulkWriteOffReason}
                                        onChange={(e) => setBulkWriteOffReason(e.target.value)}
                                        className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none bg-white"
                                    >
                                        <option value="">Selecione um motivo...</option>
                                        <option value="Venda">Venda</option>
                                        <option value="Doação">Doação</option>
                                        <option value="Obsolescência">Obsolescência</option>
                                        <option value="Perda / Extravio">Perda / Extravio</option>
                                        <option value="Sinistro">Sinistro</option>
                                        <option value="Fim de vida útil">Fim de vida útil</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Observação Complementar (Opcional)</label>
                                    <textarea
                                        value={writeOffJustification}
                                        onChange={(e) => setWriteOffJustification(e.target.value)}
                                        className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        rows={3}
                                        placeholder="Detalhes adicionais..."
                                    />
                                </div>
                            </div>
                        )}
                        {isTransferModalOpen && (
                            <div className='space-y-4'>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Filial de Destino</label>
                                    <select value={transferTargetBranch} onChange={e => setTransferTargetBranch(e.target.value)} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                                        <option value="">Selecione filial...</option>
                                        {/* Use allBranches if available (fetched with scope=all), otherwise branches */}
                                        {(allBranches.length > 0 ? allBranches : branches).filter(b => b.id !== selectedItem.branch_id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nota Fiscal de Transf.</label>
                                    <input type="text" value={transferInvoiceNumber} onChange={e => setTransferInvoiceNumber(e.target.value)} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="Número da NF" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Série</label>
                                        <input type="text" value={transferInvoiceSeries} onChange={e => setTransferInvoiceSeries(e.target.value)} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="Série" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Data Emissão</label>
                                        <input type="date" value={transferInvoiceDate} onChange={e => setTransferInvoiceDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 mt-6 border-t border-slate-100 pt-4">
                            <button onClick={() => { setIsWriteOffModalOpen(false); setIsTransferModalOpen(false); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium">Cancelar</button>
                            <button
                                onClick={isWriteOffModalOpen ? handleWriteOffRequest : handleTransferRequest}
                                disabled={isWriteOffModalOpen && !bulkWriteOffReason}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isWriteOffModalOpen ? 'Confirmar Baixa' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Importar Itens</h3>
                            <button onClick={() => { setIsImportModalOpen(false); setImportResult(null); setImportFile(null); setImportBranch(''); }}><XCircle size={24} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                                Baixe o modelo de importação para preencher os dados corretamente.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <a
                                    href={`${api.defaults.baseURL}/import/example-csv`}
                                    download="exemplo_importacao.csv"
                                    className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all gap-2 text-slate-600 hover:text-blue-600 group"
                                >
                                    <TableIcon size={24} className="text-slate-400 group-hover:text-blue-600"/>
                                    <span className="text-sm font-medium">Modelo CSV</span>
                                </a>
                                <a
                                    href={`${api.defaults.baseURL}/import/example-xlsx`}
                                    download="exemplo_importacao.xlsx"
                                    className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all gap-2 text-slate-600 hover:text-green-600 group"
                                >
                                    <FileSpreadsheet size={24} className="text-slate-400 group-hover:text-green-600"/>
                                    <span className="text-sm font-medium">Modelo Excel</span>
                                </a>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Filial de Destino</label>
                                    <select
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={importBranch}
                                        onChange={(e) => setImportBranch(e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Arquivo (CSV ou Excel)</label>
                                    <input
                                        type="file"
                                        accept=".csv, .xlsx, .xls"
                                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        onChange={(e) => {
                                            if (e.target.files) setImportFile(e.target.files[0]);
                                        }}
                                    />
                                </div>

                                {importResult && (
                                    <div className="bg-slate-50 p-4 rounded-lg text-xs space-y-2 border border-slate-200 max-h-40 overflow-y-auto">
                                        <p className="font-semibold text-slate-700">Resultado:</p>
                                        <p className="text-green-600">Sucesso: {importResult.success} itens</p>
                                        {importResult.errors?.length > 0 && (
                                            <div className="text-red-600">
                                                <p className="font-semibold">Erros ({importResult.errors.length}):</p>
                                                <ul className="list-disc pl-4 mt-1 space-y-1">
                                                    {importResult.errors.map((err: string, idx: number) => (
                                                        <li key={idx}>{err}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={handleImport}
                                        disabled={isUploading || !importFile || !importBranch}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isUploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Upload size={16} />}
                                        Importar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Status Modal */}
            {isChangeStatusModalOpen && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
                        <h3 className="text-lg font-bold mb-4 text-slate-800">Alterar Status</h3>
                        <p className="text-sm text-slate-600 mb-6">Selecione o novo status para o item <strong>{selectedItem.description}</strong>.</p>

                        <div className="grid grid-cols-1 gap-3">
                            {selectedItem.status !== 'APPROVED' && (
                                <button onClick={() => handleStatusChange(selectedItem.id, 'APPROVED')} className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-700 border border-green-200 rounded-xl hover:bg-green-100 transition-colors font-medium">
                                    <CheckCircle size={18} /> Ativo / Aprovado
                                </button>
                            )}
                            {selectedItem.status !== 'MAINTENANCE' && (
                                <button onClick={() => handleStatusChange(selectedItem.id, 'MAINTENANCE')} className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors font-medium">
                                    <Wrench size={18} /> Em Manutenção
                                </button>
                            )}
                            {selectedItem.status !== 'IN_STOCK' && (
                                <button onClick={() => handleStatusChange(selectedItem.id, 'IN_STOCK')} className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl hover:bg-cyan-100 transition-colors font-medium">
                                    <Archive size={18} /> Em Estoque
                                </button>
                            )}
                        </div>

                        <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
                             <button onClick={() => setIsChangeStatusModalOpen(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {isRejectModalOpen && selectedItem && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-800">Rejeitar Item</h3>
                            <p className="text-sm text-slate-500 mt-1">Informe o motivo da rejeição para o solicitante.</p>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none bg-slate-50"
                                rows={4}
                                placeholder="Descreva o motivo da rejeição (ex: valor incorreto, NF ilegível)..."
                                autoFocus
                            />
                        </div>
                        <div className="p-6 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                            <button onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
                            <button
                                onClick={() => {
                                    if (!rejectionReason.trim()) { showWarning("Informe o motivo."); return; }
                                    handleStatusChange(selectedItem.id, 'REJECTED', undefined, rejectionReason);
                                }}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-lg shadow-red-500/20 transition-all"
                            >
                                Confirmar Rejeição
                            </button>
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

            {/* Bulk Write Off Modal */}
            {isBulkWriteOffModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
                        <h3 className="text-lg font-bold mb-4 text-slate-800">Baixa em Lote ({selectedItems.size} itens)</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da Baixa (Obrigatório)</label>
                                <select
                                    value={bulkWriteOffReason}
                                    onChange={(e) => setBulkWriteOffReason(e.target.value)}
                                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                                >
                                    <option value="Venda">Venda</option>
                                    <option value="Doação">Doação</option>
                                    <option value="Obsolescência">Obsolescência</option>
                                    <option value="Perda / Extravio">Perda / Extravio</option>
                                    <option value="Sinistro">Sinistro</option>
                                    <option value="Fim de vida útil">Fim de vida útil</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Observação (Opcional)</label>
                                <textarea
                                    value={bulkWriteOffJustification}
                                    onChange={(e) => setBulkWriteOffJustification(e.target.value)}
                                    className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                                    rows={3}
                                    placeholder="Detalhes adicionais..."
                                />
                            </div>
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-700">
                                <AlertCircle size={14} className="inline mr-1 mb-0.5"/>
                                Atenção: Esta ação é irreversível e será aplicada imediatamente a todos os itens selecionados.
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6 border-t border-slate-100 pt-4">
                            <button onClick={() => setIsBulkWriteOffModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium">Cancelar</button>
                            <button onClick={handleBulkWriteOff} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-lg shadow-red-500/30">Confirmar Baixa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Transfer Modal */}
            {isBulkTransferModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
                        <h3 className="text-lg font-bold mb-4 text-slate-800">Transferência em Lote ({selectedItems.size} itens)</h3>
                        <div className='space-y-4'>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Filial de Destino</label>
                                <select value={bulkTransferTargetBranch} onChange={e => setBulkTransferTargetBranch(e.target.value)} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                                    <option value="">Selecione filial...</option>
                                    {(allBranches.length > 0 ? allBranches : branches).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nota Fiscal de Transf.</label>
                                <input type="text" value={bulkTransferInvoiceNumber} onChange={e => setBulkTransferInvoiceNumber(e.target.value)} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="Número da NF" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Série</label>
                                    <input type="text" value={bulkTransferInvoiceSeries} onChange={e => setBulkTransferInvoiceSeries(e.target.value)} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="Série" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Data Emissão</label>
                                    <input type="date" value={bulkTransferInvoiceDate} onChange={e => setBulkTransferInvoiceDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6 border-t border-slate-100 pt-4">
                            <button onClick={() => setIsBulkTransferModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium">Cancelar</button>
                            <button onClick={handleBulkTransfer} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/30">Confirmar Transferência</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
