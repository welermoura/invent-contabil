
import React, { useState, useEffect } from 'react';
import api from '../api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { translateStatus, translateLogAction } from '../utils/translations';

// --- DATA TABLE COMPONENT ---
const DataTable: React.FC<{ data: any[], title: string, onBack: () => void }> = ({ data, title, onBack }) => {
    const [filter, setFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [page, setPage] = useState(0);
    const LIMIT = 50;

    if (!data || data.length === 0) {
        return (
            <div className="p-6 bg-white rounded shadow">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                    <button onClick={onBack} className="bg-gray-500 text-white px-4 py-2 rounded">Voltar</button>
                </div>
                <p className="text-gray-500">Nenhum dado encontrado para este relatório.</p>
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
        setPage(0); // Reset page on filter change
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
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    };

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    return (
        <div className="p-6 bg-white rounded shadow min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-200 text-gray-700 px-3 py-2 rounded hover:bg-gray-300">
                        &larr; Voltar
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                </div>
                <div className="flex gap-2 w-full md:w-auto items-center">
                    <input
                        type="text"
                        placeholder="Filtrar dados..."
                        className="border px-3 py-2 rounded flex-grow"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />

                    <div className="relative">
                        <button
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 whitespace-nowrap flex items-center gap-2"
                        >
                            Exportar <span>▼</span>
                        </button>
                        {isExportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border">
                                <button onClick={() => { downloadExcel(); setIsExportMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    Excel (.xlsx)
                                </button>
                                <button onClick={() => { downloadCSV(); setIsExportMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    CSV (.csv)
                                </button>
                                <button onClick={() => { downloadPDF(); setIsExportMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    PDF (.pdf)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto border rounded max-h-[70vh]">
                <table className="min-w-full text-sm text-left text-gray-500 relative">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            {headers.map(header => (
                                <th key={header} className="px-6 py-3 bg-gray-100">
                                    <div
                                        className="flex items-center gap-1 cursor-pointer hover:text-blue-600 mb-2"
                                        onClick={() => requestSort(header)}
                                    >
                                        {header}
                                        {sortConfig?.key === header ? (
                                            <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                                        ) : <span className="text-gray-300">↕</span>}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={`Filtrar ${header}`}
                                        className="w-full px-2 py-1 text-xs border rounded font-normal normal-case focus:outline-none focus:border-blue-500"
                                        value={columnFilters[header] || ''}
                                        onChange={(e) => handleColumnFilterChange(header, e.target.value)}
                                        onClick={(e) => e.stopPropagation()} // Prevent sort trigger
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length > 0 ? (
                            paginatedData.map((row, idx) => (
                                <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                    {headers.map(header => (
                                        <td key={header} className="px-6 py-4 truncate max-w-xs" title={String(row[header])}>
                                            {String(row[header])}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={headers.length} className="px-6 py-8 text-center text-gray-500">
                                    Nenhum registro encontrado com os filtros atuais.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center mt-4">
                <span className="text-gray-600">
                    Mostrando {page * LIMIT + 1} a {Math.min((page + 1) * LIMIT, sortedData.length)} de {sortedData.length} registros
                </span>
                <div className="flex gap-2">
                    <button
                        disabled={page === 0}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                    >
                        Anterior
                    </button>
                    <button
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                    >
                        Próxima
                    </button>
                </div>
            </div>
        </div>
    );
};

// Estrutura do Menu (Mantida, com ajustes)
const reportsMenu = [
    {
        category: "A. Relatórios Operacionais e de Estoque",
        description: "Controle físico, movimentação e posição atual dos ativos.",
        items: [
            { id: "A.1", title: "Posição de Inventário Geral (Detalhado)" },
            { id: "A.2", title: "Itens por Filial" },
            { id: "A.3", title: "Itens por Categoria" },
            { id: "A.4", title: "Itens por Responsável" },
            { id: "A.5", title: "Relatório de Ativos Novos (Últimos 30 dias)" },
            { id: "A.6", title: "Histórico de Movimentações (Kardex)" },
            { id: "A.7", title: "Ativos em Trânsito (Transferências Pendentes)" },
            { id: "A.9", title: "Relatório de Etiquetas (Com Ativo Fixo)" },
        ]
    },
    {
        category: "B. Relatórios Contábeis e Financeiros",
        description: "Análise de valor e depreciação.",
        items: [
            { id: "B.1", title: "Razão Auxiliar do Ativo (Valor Contábil)" },
            { id: "B.2", title: "Relatório de Depreciação Acumulada" },
            { id: "B.5", title: "Ativos Totalmente Depreciados" },
            { id: "B.6", title: "Projeção de Depreciação (Próximos 12 meses)" },
            { id: "B.7", title: "Relatório de Baixas (Status Baixado)" },
            { id: "B.9", title: "Relatório de Aquisições (CAPEX)" },
            { id: "B.10", title: "Resumo de Valores por Categoria" }
        ]
    },
    {
        category: "C. Auditoria e Compliance",
        description: "Rastreabilidade e conformidade.",
        items: [
            { id: "C.1", title: "Trilha de Auditoria Completa (Logs)" },
            { id: "C.2", title: "Alterações de Status (Aprovações/Rejeições)" },
            { id: "C.5", title: "Itens sem Número de Ativo Fixo" },
            { id: "C.6", title: "Itens com Dados Incompletos" },
            { id: "C.10", title: "Histórico de Responsáveis" }
        ]
    },
    {
        category: "D. Ciclo de Vida",
        description: "Gestão da vida útil e renovação.",
        items: [
            { id: "D.1", title: "Idade da Frota/Ativos (Aging)" },
            { id: "D.3", title: "Ativos com Vida Útil Expirada" },
        ]
    },
    {
        category: "E. Administração",
        description: "Gestão de usuários e acessos.",
        items: [
            { id: "E.1", title: "Relatório de Usuários" },
            { id: "E.2", title: "Matriz de Permissões" },
            { id: "E.4", title: "Usuários por Filial" },
            { id: "E.6", title: "Parâmetros de Categoria (Depreciação)" }
        ]
    },
    {
        category: "F. Relatórios Fiscais",
        description: "Suporte a obrigações.",
        items: [
            { id: "F.4", title: "Relatório de Notas Fiscais de Entrada" }
        ]
    }
];

const Reports: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [reportTitle, setReportTitle] = useState("");

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
        // Use UTC methods if it looks like a date-only string to avoid timezone issues,
        // but for safety with ISO strings that might have time, toLocaleDateString is safer if timezone matches.
        // Given existing inconsistency, let's stick to pt-BR locale.
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

            // --- DATA FETCHING STRATEGIES ---

            // Strategy 1: Items Base
            if (['A.1', 'A.2', 'A.3', 'A.4', 'A.5', 'A.7', 'A.9', 'B.1', 'B.2', 'B.5', 'B.6', 'B.7', 'B.9', 'B.10', 'C.5', 'C.6', 'D.1', 'D.3', 'F.4'].includes(reportId)) {
                const response = await api.get('/items/?limit=10000');
                const items = response.data;

                // --- MAPPING & FILTERING ---

                if (reportId === 'A.1') { // Geral Detalhado
                    data = items.map((i: any) => ({
                        ID: i.id, Descrição: i.description, Categoria: i.category, Filial: i.branch?.name,
                        Status: translateStatus(i.status), "Valor de Compra": formatCurrency(i.invoice_value), "Valor Contábil": formatCurrency(i.accounting_value),
                        "Data de Compra": formatDate(i.purchase_date), NF: i.invoice_number, "Ativo Fixo": i.fixed_asset_number
                    }));
                } else if (reportId === 'A.2') { // Por Filial
                    data = items.sort((a: any, b: any) => (a.branch?.name || '').localeCompare(b.branch?.name || '')).map((i: any) => ({
                        Filial: i.branch?.name, ID: i.id, Descrição: i.description, Categoria: i.category, "Valor de Compra": formatCurrency(i.invoice_value)
                    }));
                } else if (reportId === 'A.3') { // Por Categoria
                     data = items.sort((a: any, b: any) => (a.category || '').localeCompare(b.category || '')).map((i: any) => ({
                        Categoria: i.category, ID: i.id, Descrição: i.description, Filial: i.branch?.name, "Valor de Compra": formatCurrency(i.invoice_value)
                    }));
                } else if (reportId === 'A.4') { // Por Responsável
                     data = items.filter((i: any) => i.responsible).map((i: any) => ({
                        Responsável: i.responsible?.name, ID: i.id, Descrição: i.description, Filial: i.branch?.name
                    }));
                } else if (reportId === 'A.5') { // Novos (30 dias)
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - 30);
                    data = items.filter((i: any) => new Date(i.purchase_date) >= cutoff).map((i: any) => ({
                        "Data de Compra": formatDate(i.purchase_date), ID: i.id, Descrição: i.description, "Valor de Compra": formatCurrency(i.invoice_value)
                    }));
                } else if (reportId === 'A.7') { // Em Trânsito
                    data = items.filter((i: any) => i.status === 'TRANSFER_PENDING').map((i: any) => ({
                        ID: i.id, Descrição: i.description, Origem: i.branch?.name, "Destino (ID)": i.transfer_target_branch_id
                    }));
                } else if (reportId === 'A.9') { // Etiquetas
                    data = items.filter((i: any) => i.fixed_asset_number).map((i: any) => ({
                        "Ativo Fixo": i.fixed_asset_number, ID: i.id, Descrição: i.description, Filial: i.branch?.name
                    }));
                } else if (reportId === 'B.1') { // Razão Auxiliar
                    data = items.map((i: any) => ({
                        ID: i.id, "Ativo Fixo": i.fixed_asset_number, Descrição: i.description,
                        "Valor de Aquisição": formatCurrency(i.invoice_value), "Valor Contábil": formatCurrency(i.accounting_value), "Depreciação Acumulada": formatCurrency(i.invoice_value - (i.accounting_value || 0))
                    }));
                } else if (reportId === 'B.2') { // Depreciação Acumulada
                    data = items.map((i: any) => ({
                        ID: i.id, Descrição: i.description, "Data de Compra": formatDate(i.purchase_date), "Meses de Uso": "Calc",
                        "Depreciação Total": formatCurrency(i.invoice_value - (i.accounting_value || 0))
                    }));
                } else if (reportId === 'B.5') { // Totalmente Depreciados
                    data = items.filter((i: any) => i.accounting_value === 0).map((i: any) => ({
                        ID: i.id, Descrição: i.description, "Data de Compra": formatDate(i.purchase_date), "Valor Original": formatCurrency(i.invoice_value)
                    }));
                } else if (reportId === 'B.7') { // Baixas
                    data = items.filter((i: any) => i.status === 'WRITTEN_OFF').map((i: any) => ({
                        ID: i.id, Descrição: i.description, "Data da Baixa": "Ver Histórico", "Valor Baixado": formatCurrency(i.accounting_value)
                    }));
                } else if (reportId === 'B.9') { // CAPEX
                    data = items.map((i: any) => ({
                        "Data de Compra": formatDate(i.purchase_date), "Valor de Compra": formatCurrency(i.invoice_value), Descrição: i.description, Categoria: i.category
                    }));
                } else if (reportId === 'B.10') { // Resumo Valores
                    // Aggregate
                    const agg: any = {};
                    items.forEach((i: any) => {
                        if (!agg[i.category]) agg[i.category] = 0;
                        agg[i.category] += i.invoice_value;
                    });
                    data = Object.keys(agg).map(k => ({ Categoria: k, "Valor Total": formatCurrency(agg[k]) }));
                } else if (reportId === 'C.5') { // Sem Ativo Fixo
                    data = items.filter((i: any) => !i.fixed_asset_number).map((i: any) => ({
                        ID: i.id, Descrição: i.description, Status: translateStatus(i.status)
                    }));
                } else if (reportId === 'C.6') { // Dados Incompletos
                    data = items.filter((i: any) => !i.serial_number || !i.invoice_number).map((i: any) => ({
                        ID: i.id, Descrição: i.description, "Falta Serial": !i.serial_number, "Falta Nota": !i.invoice_number
                    }));
                } else if (reportId === 'D.1') { // Aging
                     const now = new Date();
                     data = items.map((i: any) => {
                         const days = Math.floor((now.getTime() - new Date(i.purchase_date).getTime()) / (1000 * 3600 * 24));
                         return { ID: i.id, Descrição: i.description, "Dias desde Compra": days, Anos: (days/365).toFixed(1) };
                     });
                } else if (reportId === 'F.4') { // Notas Fiscais
                    data = items.map((i: any) => ({
                        NF: i.invoice_number, Data: formatDate(i.purchase_date), "Valor de Compra": formatCurrency(i.invoice_value), Fornecedor: "N/A", Item: i.description
                    }));
                }
            }

            // Strategy 2: Logs Base
            else if (['A.6', 'C.1', 'C.2', 'C.10'].includes(reportId)) {
                 const response = await api.get('/logs/?limit=5000');
                 const logs = response.data;

                 if (reportId === 'A.6' || reportId === 'C.1') { // Kardex / Trilha
                     data = logs.map((l: any) => ({
                         Data: new Date(l.timestamp).toLocaleString('pt-BR'), Usuário: l.user?.email, Ação: translateLogAction(l.action), ItemID: l.item_id, Item: l.item?.description
                     }));
                 } else if (reportId === 'C.2') { // Status changes
                     data = logs.filter((l: any) => l.action.includes('Status changed')).map((l: any) => ({
                         Data: new Date(l.timestamp).toLocaleString('pt-BR'), Usuário: l.user?.email, Ação: translateLogAction(l.action), Item: l.item?.description
                     }));
                 } else if (reportId === 'C.10') { // Responsibles (Generic approximation)
                     data = logs.filter((l: any) => l.action.toLowerCase().includes('respons')).map((l: any) => ({
                         Data: new Date(l.timestamp).toLocaleString('pt-BR'), Usuário: l.user?.email, Ação: translateLogAction(l.action), Item: l.item?.description
                     }));
                 }
            }

            // Strategy 3: Users Base
            else if (['E.1', 'E.2', 'E.4'].includes(reportId)) {
                const response = await api.get('/users/');
                const users = response.data;

                if (reportId === 'E.1' || reportId === 'E.2') {
                    data = users.map((u: any) => ({
                        ID: u.id, Nome: u.name, Email: u.email, Role: u.role, FilialLegacy: u.branch_id
                    }));
                } else if (reportId === 'E.4') {
                     data = users.map((u: any) => ({
                        Filial: u.branch_id, Nome: u.name, Email: u.email
                    })).sort((a: any, b: any) => String(a.Filial).localeCompare(String(b.Filial)));
                }
            }

             // Strategy 4: Categories Base
            else if (reportId === 'E.6') {
                const response = await api.get('/categories/');
                data = response.data.map((c: any) => ({
                    ID: c.id, Nome: c.name, MesesDepreciacao: c.depreciation_months
                }));
            }

            setReportData(data);
        } catch (error) {
            console.error(error);
            alert("Erro ao gerar relatório. Verifique permissões ou conexão.");
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
        <div className="p-6 bg-gray-50 min-h-full">
            <h1 className="text-3xl font-bold mb-2 text-gray-800">Menu de Relatórios</h1>
            <p className="text-gray-600 mb-6">Central completa de relatórios para auditoria, contabilidade e gestão de ativos.</p>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Buscar relatório..."
                    className="w-full md:w-1/2 px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-25 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded shadow">
                        <span className="text-blue-600 font-bold">Gerando relatório...</span>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {filteredMenu.map((section, index) => (
                    <div key={index} className="bg-white rounded-lg shadow overflow-hidden">
                        <button
                            onClick={() => toggleCategory(section.category)}
                            className="w-full px-6 py-4 text-left bg-white hover:bg-gray-50 flex justify-between items-center transition-colors"
                        >
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">{section.category}</h2>
                                <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                            </div>
                            <span className={`transform transition-transform ${expandedCategory === section.category || searchTerm ? 'rotate-180' : ''}`}>
                                ▼
                            </span>
                        </button>

                        {(expandedCategory === section.category || searchTerm) && (
                            <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {section.items.map((report) => (
                                        <button
                                            key={report.id}
                                            className="bg-white p-3 rounded border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all text-left flex items-center group"
                                            onClick={() => handleGenerateReport(report.id, report.title)}
                                        >
                                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded mr-3 whitespace-nowrap">
                                                {report.id}
                                            </span>
                                            <span className="text-gray-700 group-hover:text-blue-700 font-medium text-sm">
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
