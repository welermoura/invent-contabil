
import React, { useState } from 'react';
import api from '../api';
import { useError } from '../hooks/useError';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { translateStatus, translateLogAction } from '../utils/translations';
import {
    FileText,
    Search,
    ChevronDown,
    ChevronUp,
    ArrowLeft,
    Download,
    Filter,
    BarChart3,
    Table as TableIcon,
    FileSpreadsheet
} from 'lucide-react';

// --- DATA TABLE COMPONENT ---
const DataTable: React.FC<{ data: any[], title: string, onBack: () => void }> = ({ data, title, onBack }) => {
    const [filter, setFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [page, setPage] = useState(0);
    const LIMIT = 50;
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    if (!data || data.length === 0) {
        return (
            <div className="p-8 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-100/50 flex flex-col items-center justify-center text-center">
                <div className="bg-white/50 p-4 rounded-full mb-4">
                    <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
                <p className="text-gray-500 mb-6">Nenhum dado encontrado para este relatório com os filtros atuais.</p>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium px-4 py-2 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao Menu
                </button>
            </div>
        );
    }

    const headers = Object.keys(data[0]);

    // Filter Logic
    const filteredData = data.filter(row => {
        // Global Filter
        const matchesGlobal = filter === '' || headers.some(key =>
            String(row[key] || '').toLowerCase().includes(filter.toLowerCase())
        );

        // Column Filters
        const matchesColumns = headers.every(key => {
            const colFilter = columnFilters[key];
            if (!colFilter) return true;
            return String(row[key] || '').toLowerCase().includes(colFilter.toLowerCase());
        });

        return matchesGlobal && matchesColumns;
    });

    // Sort
    const sortedData = [...filteredData];
    if (sortConfig) {
        sortedData.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Pagination
    const totalPages = Math.ceil(sortedData.length / LIMIT);
    const paginatedData = sortedData.slice(page * LIMIT, (page + 1) * LIMIT);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleColumnFilterChange = (key: string, value: string) => {
        setColumnFilters(prev => ({ ...prev, [key]: value }));
        setPage(0);
    };

    const downloadCSV = () => {
        const csvContent = [
            headers.join(';'),
            ...sortedData.map(row => headers.map(fieldName => {
                let val = row[fieldName];
                if (val === null || val === undefined) return '';
                val = String(val).replace(/"/g, '""');
                if (val.search(/("|,|\n|;)/g) >= 0) val = `"${val}"`;
                return val;
            }).join(';'))
        ].join('\r\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadExcel = () => {
        const ws = XLSX.utils.json_to_sheet(sortedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatório");
        const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        doc.text(title, 14, 15);

        const tableColumn = headers;
        const tableRows = sortedData.map(row => headers.map(col => String(row[col] || '')));

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1 },
            headStyles: { fillColor: [79, 70, 229] } // Indigo-600
        });

        doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    };

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 flex flex-col h-[calc(100vh-6rem)]">
            {/* Header */}
            <div className="p-4 border-b border-slate-200/50 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/40 rounded-t-xl">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all border border-transparent hover:border-slate-200"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            {title}
                        </h2>
                        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full mt-1 inline-block">
                            {sortedData.length} registros encontrados
                        </span>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto items-center">
                    <div className="relative flex-grow md:flex-grow-0">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Busca global..."
                            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Exportar</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {isExportMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsExportMenuOpen(false)}
                                ></div>
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-1 z-20 border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button onClick={() => { downloadExcel(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2">
                                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel (.xlsx)
                                    </button>
                                    <button onClick={() => { downloadCSV(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2">
                                        <TableIcon className="w-4 h-4 text-blue-600" /> CSV (.csv)
                                    </button>
                                    <button onClick={() => { downloadPDF(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-red-600" /> PDF (.pdf)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-grow overflow-auto">
                <table className="min-w-full text-sm text-left text-gray-600 relative border-collapse">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50/80 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                        <tr>
                            {headers.map(header => (
                                <th key={header} className="px-6 py-3 bg-gray-50/80 border-b border-gray-200/50 min-w-[150px]">
                                    <div className="flex flex-col gap-2">
                                        <div
                                            className="flex items-center justify-between cursor-pointer hover:text-indigo-600 select-none group"
                                            onClick={() => requestSort(header)}
                                        >
                                            <span className="font-semibold tracking-wide">{header}</span>
                                            <span className="text-gray-400 group-hover:text-indigo-500">
                                                {sortConfig?.key === header ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                                ) : <Filter className="w-3 h-3 opacity-0 group-hover:opacity-50" />}
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-normal normal-case bg-white/50"
                                                value={columnFilters[header] || ''}
                                                onChange={(e) => handleColumnFilterChange(header, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/50">
                        {paginatedData.length > 0 ? (
                            paginatedData.map((row, idx) => (
                                <tr key={idx} className="bg-white/30 hover:bg-white/60 transition-colors">
                                    {headers.map(header => (
                                        <td key={header} className="px-6 py-3 whitespace-nowrap text-gray-700" title={String(row[header])}>
                                            {String(row[header])}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={headers.length} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Search className="w-8 h-8 text-gray-300" />
                                        <span>Nenhum registro encontrado</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="border-t border-gray-200/50 p-4 bg-gray-50/50 rounded-b-xl flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">
                    {page * LIMIT + 1}-{Math.min((page + 1) * LIMIT, sortedData.length)} de {sortedData.length}
                </span>
                <div className="flex gap-2">
                    <button
                        disabled={page === 0}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 bg-white/50 border border-gray-300 rounded-lg text-gray-700 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                    >
                        Anterior
                    </button>
                    <button
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 bg-white/50 border border-gray-300 rounded-lg text-gray-700 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                    >
                        Próxima
                    </button>
                </div>
            </div>
        </div>
    );
};

// Menu Data
const reportsMenu = [
    {
        category: "A. Relatórios Operacionais",
        description: "Controle físico, movimentação e posição de estoque.",
        icon: <BarChart3 className="w-5 h-5" />,
        items: [
            { id: "A.1", title: "Posição Geral Detalhada" },
            { id: "A.2", title: "Itens por Filial" },
            { id: "A.3", title: "Itens por Categoria" },
            { id: "A.4", title: "Itens por Responsável" },
            { id: "A.5", title: "Novos Ativos (30 dias)" },
            { id: "A.6", title: "Histórico de Movimentações (Kardex)" },
            { id: "A.7", title: "Transferências Pendentes" },
            { id: "A.9", title: "Etiquetas de Ativo Fixo" },
        ]
    },
    {
        category: "B. Contábil e Financeiro",
        description: "Análise de valor, depreciação e baixas.",
        icon: <FileSpreadsheet className="w-5 h-5" />,
        items: [
            { id: "B.1", title: "Razão Auxiliar (Valor Contábil)" },
            { id: "B.2", title: "Depreciação Acumulada" },
            { id: "B.5", title: "Ativos Totalmente Depreciados" },
            { id: "B.6", title: "Projeção de Depreciação (12 meses)" },
            { id: "B.7", title: "Relatório de Baixas" },
            { id: "B.9", title: "Aquisições (CAPEX)" },
            { id: "B.10", title: "Resumo por Categoria" }
        ]
    },
    {
        category: "C. Auditoria e Compliance",
        description: "Rastreabilidade e dados faltantes.",
        icon: <FileText className="w-5 h-5" />,
        items: [
            { id: "C.1", title: "Trilha de Auditoria (Logs)" },
            { id: "C.2", title: "Mudanças de Status" },
            { id: "C.5", title: "Sem Número de Ativo Fixo" },
            { id: "C.6", title: "Dados Incompletos" },
            { id: "C.10", title: "Histórico de Responsáveis" }
        ]
    },
    {
        category: "D. Ciclo de Vida",
        description: "Gestão da vida útil e renovação.",
        icon: <TableIcon className="w-5 h-5" />,
        items: [
            { id: "D.1", title: "Aging (Idade da Frota)" },
            { id: "D.3", title: "Vida Útil Expirada" },
        ]
    },
    {
        category: "E. Administração",
        description: "Gestão de usuários e parâmetros.",
        icon: <Search className="w-5 h-5" />,
        items: [
            { id: "E.1", title: "Lista de Usuários" },
            { id: "E.2", title: "Matriz de Permissões" },
            { id: "E.4", title: "Usuários por Filial" },
            { id: "E.6", title: "Parâmetros de Categoria" }
        ]
    },
    {
        category: "F. Fiscal",
        description: "Obrigações e notas fiscais.",
        icon: <FileText className="w-5 h-5" />,
        items: [
            { id: "F.4", title: "Notas Fiscais de Entrada" }
        ]
    }
];

const Reports: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [reportTitle, setReportTitle] = useState("");
    const { showError } = useError();

    const toggleCategory = (category: string) => {
        setExpandedCategory(expandedCategory === category ? null : category);
    };

    const formatDate = (val: any) => {
        if (!val) return '';
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
             const [y, m, d] = val.split('-');
             return `${d}/${m}/${y}`;
        }
        const date = new Date(val);
        if (isNaN(date.getTime())) return val;
        return date.toLocaleDateString('pt-BR');
    }

    const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined) return '';
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    const handleGenerateReport = async (reportId: string, title: string) => {
        setLoading(true);
        setReportTitle(title);
        try {
            let data: any[] = [];

            // Strategy 1: Items Base
            if (['A.1', 'A.2', 'A.3', 'A.4', 'A.5', 'A.7', 'A.9', 'B.1', 'B.2', 'B.5', 'B.6', 'B.7', 'B.9', 'B.10', 'C.5', 'C.6', 'D.1', 'D.3', 'F.4'].includes(reportId)) {
                const response = await api.get('/items/?limit=10000');
                const items = response.data;

                if (reportId === 'A.1') {
                    data = items.map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, Categoria: i.category, Fornecedor: i.supplier?.name, Filial: i.branch?.name,
                        Status: translateStatus(i.status), "Vlr. Compra": formatCurrency(i.invoice_value), "Vlr. Contábil": formatCurrency(i.accounting_value),
                        "Data Compra": formatDate(i.purchase_date), NF: i.invoice_number
                    }));
                } else if (reportId === 'A.2') {
                    data = items.sort((a: any, b: any) => (a.branch?.name || '').localeCompare(b.branch?.name || '')).map((i: any) => ({
                        Filial: i.branch?.name, "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, Categoria: i.category, "Valor Compra": formatCurrency(i.invoice_value), "Valor Contábil": formatCurrency(i.accounting_value)
                    }));
                } else if (reportId === 'A.3') {
                     data = items.sort((a: any, b: any) => (a.category || '').localeCompare(b.category || '')).map((i: any) => ({
                        Categoria: i.category, "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, Filial: i.branch?.name, "Valor Compra": formatCurrency(i.invoice_value), "Valor Contábil": formatCurrency(i.accounting_value)
                    }));
                } else if (reportId === 'A.4') {
                     data = items.filter((i: any) => i.responsible).map((i: any) => ({
                        Responsável: i.responsible?.name, "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, Filial: i.branch?.name, "Valor Compra": formatCurrency(i.invoice_value), "Valor Contábil": formatCurrency(i.accounting_value)
                    }));
                } else if (reportId === 'A.5') {
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - 30);
                    data = items.filter((i: any) => new Date(i.purchase_date) >= cutoff).map((i: any) => ({
                        "Data Compra": formatDate(i.purchase_date), "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, Fornecedor: i.supplier?.name, "Valor Compra": formatCurrency(i.invoice_value), "Valor Contábil": formatCurrency(i.accounting_value)
                    }));
                } else if (reportId === 'A.7') {
                    data = items.filter((i: any) => i.status === 'TRANSFER_PENDING').map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, Origem: i.branch?.name, "Destino (ID)": i.transfer_target_branch_id
                    }));
                } else if (reportId === 'A.9') {
                    data = items.filter((i: any) => i.fixed_asset_number).map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, Filial: i.branch?.name
                    }));
                } else if (reportId === 'B.1') {
                    data = items.map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description,
                        "Vlr. Aquisição": formatCurrency(i.invoice_value), "Vlr. Contábil": formatCurrency(i.accounting_value), "Deprec. Acumulada": formatCurrency(i.invoice_value - (i.accounting_value || 0))
                    }));
                } else if (reportId === 'B.2') {
                    data = items.map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, "Data Compra": formatDate(i.purchase_date),
                        "Depreciação Total": formatCurrency(i.invoice_value - (i.accounting_value || 0))
                    }));
                } else if (reportId === 'B.5') {
                    data = items.filter((i: any) => i.accounting_value === 0).map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, "Data Compra": formatDate(i.purchase_date), "Valor Original": formatCurrency(i.invoice_value)
                    }));
                } else if (reportId === 'B.7') {
                    data = items.filter((i: any) => i.status === 'WRITTEN_OFF').map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, "Valor Baixado": formatCurrency(i.accounting_value)
                    }));
                } else if (reportId === 'B.9') {
                    data = items.map((i: any) => ({
                        "Data": formatDate(i.purchase_date), "Valor": formatCurrency(i.invoice_value), Descrição: i.description, Fornecedor: i.supplier?.name, Categoria: i.category
                    }));
                } else if (reportId === 'B.10') {
                    const agg: any = {};
                    items.forEach((i: any) => {
                        if (!agg[i.category]) agg[i.category] = 0;
                        agg[i.category] += i.invoice_value;
                    });
                    data = Object.keys(agg).map(k => ({ Categoria: k, "Valor Total": formatCurrency(agg[k]) }));
                } else if (reportId === 'C.5') {
                    data = items.filter((i: any) => !i.fixed_asset_number).map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, Status: translateStatus(i.status)
                    }));
                } else if (reportId === 'C.6') {
                    data = items.filter((i: any) => !i.serial_number || !i.invoice_number).map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, "Falta Serial": !i.serial_number, "Falta Nota": !i.invoice_number
                    }));
                } else if (reportId === 'D.1') {
                     const now = new Date();
                     data = items.map((i: any) => {
                         const days = Math.floor((now.getTime() - new Date(i.purchase_date).getTime()) / (1000 * 3600 * 24));
                         return { "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, "Dias desde Compra": days, Anos: (days/365).toFixed(1) };
                     });
                } else if (reportId === 'D.3') {
                    data = items.filter((i: any) => i.accounting_value === 0).map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, Descrição: i.description, "Valor Original": formatCurrency(i.invoice_value), "Data Compra": formatDate(i.purchase_date), Status: translateStatus(i.status)
                    }));
                } else if (reportId === 'F.4') {
                    data = items.map((i: any) => ({
                        NF: i.invoice_number, Data: formatDate(i.purchase_date), "Valor": formatCurrency(i.invoice_value), Fornecedor: i.supplier?.name, Item: i.description
                    }));
                }
            }

            // Strategy 2: Logs Base
            else if (['A.6', 'C.1', 'C.2', 'C.10'].includes(reportId)) {
                 const response = await api.get('/logs/?limit=5000');
                 const logs = response.data;

                 if (reportId === 'A.6' || reportId === 'C.1') {
                     data = logs.map((l: any) => ({
                         Data: new Date(l.timestamp).toLocaleString('pt-BR'), Usuário: l.user?.email, Ação: translateLogAction(l.action), "Ativo Fixo": l.item?.fixed_asset_number, Item: l.item?.description
                     }));
                 } else if (reportId === 'C.2') {
                     data = logs.filter((l: any) => l.action.includes('Status changed')).map((l: any) => ({
                         Data: new Date(l.timestamp).toLocaleString('pt-BR'), Usuário: l.user?.email, Ação: translateLogAction(l.action), Item: l.item?.description
                     }));
                 } else if (reportId === 'C.10') {
                     data = logs.filter((l: any) => l.action.toLowerCase().includes('respons')).map((l: any) => ({
                         Data: new Date(l.timestamp).toLocaleString('pt-BR'), Usuário: l.user?.email, Ação: translateLogAction(l.action), Item: l.item?.description
                     }));
                 }
            }

            // Strategy 3: Users Base
            else if (['E.1', 'E.2', 'E.4'].includes(reportId)) {
                const response = await api.get('/users/');
                const users = response.data;

                const getBranchList = (u: any) => {
                    if (u.role === 'ADMIN') return 'Todas (Admin)';
                    if (u.branches && u.branches.length > 0) {
                        return u.branches.map((b: any) => b.name).join(', ');
                    }
                    return u.branch?.name || 'N/A';
                };

                if (reportId === 'E.1' || reportId === 'E.2') {
                    data = users.map((u: any) => ({
                        ID: u.id, Nome: u.name, Email: u.email, Role: u.role, "Filiais Permitidas": getBranchList(u)
                    }));
                } else if (reportId === 'E.4') {
                     data = users.map((u: any) => ({
                        Filial: getBranchList(u), Nome: u.name, Email: u.email
                    })).sort((a: any, b: any) => String(a.Filial).localeCompare(String(b.Filial)));
                }
            }

             // Strategy 4: Categories Base
            else if (reportId === 'E.6') {
                const response = await api.get('/categories/');
                data = response.data.map((c: any) => ({
                    ID: c.id, Nome: c.name, Meses: c.depreciation_months
                }));
            }

            setReportData(data);
        } catch (error) {
            console.error(error);
            showError("REPORT_ERROR");
        } finally {
            setLoading(false);
        }
    };

    const filteredMenu = reportsMenu.map(section => {
        const filteredItems = section.items.filter(item =>
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return {
            ...section,
            items: filteredItems,
            hasMatch: filteredItems.length > 0 || section.category.toLowerCase().includes(searchTerm.toLowerCase())
        };
    }).filter(section => section.hasMatch);

    if (reportData) {
        return <DataTable data={reportData} title={reportTitle} onBack={() => setReportData(null)} />;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-8 h-8 text-indigo-600" />
                        Central de Relatórios
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Geração de relatórios operacionais, contábeis e de auditoria em tempo real.
                    </p>
                </div>
                <div className="relative w-full md:w-1/3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar relatório (ex: Depreciação)..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 animate-in zoom-in duration-200">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        <span className="text-gray-700 font-medium">Processando dados...</span>
                    </div>
                </div>
            )}

            {/* Reports Grid */}
            <div className="grid grid-cols-1 gap-6">
                {filteredMenu.map((section, index) => (
                    <div key={index} className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 overflow-hidden transition-all hover:shadow-md">
                        <button
                            onClick={() => toggleCategory(section.category)}
                            className="w-full px-6 py-4 flex justify-between items-center bg-transparent hover:bg-white/40 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${expandedCategory === section.category || searchTerm ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'} group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors`}>
                                    {section.icon}
                                </div>
                                <div className="text-left">
                                    <h2 className="text-lg font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                                        {section.category}
                                    </h2>
                                    <p className="text-sm text-slate-500">{section.description}</p>
                                </div>
                            </div>
                            <span className={`transform transition-transform duration-200 text-slate-400 ${expandedCategory === section.category || searchTerm ? 'rotate-180 text-indigo-600' : ''}`}>
                                <ChevronDown className="w-5 h-5" />
                            </span>
                        </button>

                        {(expandedCategory === section.category || searchTerm) && (
                            <div className="border-t border-slate-100/50 bg-white/30 p-6 animate-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {section.items.map((report) => (
                                        <button
                                            key={report.id}
                                            className="bg-white/60 p-3 rounded-lg border border-slate-200/50 hover:border-indigo-300 hover:shadow-md hover:translate-y-[-2px] transition-all text-left flex items-center gap-3 group relative overflow-hidden"
                                            onClick={() => handleGenerateReport(report.id, report.title)}
                                        >
                                            <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 whitespace-nowrap">
                                                {report.id}
                                            </span>
                                            <span className="text-gray-700 font-medium text-sm group-hover:text-indigo-700">
                                                {report.title}
                                            </span>
                                        </button>
                                    ))}
                                    {section.items.length === 0 && (
                                        <p className="text-gray-500 italic text-sm">Nenhum relatório encontrado.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Reports;
