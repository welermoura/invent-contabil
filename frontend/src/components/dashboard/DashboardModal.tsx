import React, { useEffect, useState } from 'react';
import { X, Search, FileText, Download, FileSpreadsheet, Table as TableIcon, ChevronDown } from 'lucide-react';
import api from '../../api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { translateStatus } from '../../utils/translations';

interface DashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    filters: Record<string, any>;
}

const DashboardModal: React.FC<DashboardModalProps> = ({ isOpen, onClose, title, filters }) => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchDetails();
        }
    }, [isOpen, filters]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            // Constrói query params baseados nos filtros recebidos
            const params = new URLSearchParams();

            if (filters.status) params.append('status', filters.status);

            // Se tiver filtro de data (Evolução), precisamos de todos os itens para filtrar no front,
            // pois o backend não tem filtro de mês/ano, apenas de data exata ou range se implementado.
            // Para garantir que funciona, aumentamos o limit.
            if (filters.date) {
                params.append('limit', '5000');
            } else if (filters.limit) {
                params.append('limit', String(filters.limit));
            } else {
                // Default limit se nada for especificado
                params.append('limit', '1000');
            }

            // Fallback para buscar itens gerais se não houver filtro específico de endpoint
            const response = await api.get(`/items/?${params.toString()}`);

            // Aplica filtros adicionais no cliente se necessário (ex: últimos 30 dias)
            let data = response.data;

            if (filters.recentDays) {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - filters.recentDays);
                data = data.filter((i: any) => new Date(i.created_at || i.purchase_date) >= cutoff);
            }

            if (filters.zeroDepreciation) {
                data = data.filter((i: any) => i.accounting_value === 0);
            }

            // Filter by Month/Year (Evolution Chart)
            if (filters.date) {
                // filters.date format: "yyyy-MM" (e.g. "2023-01")
                const [targetYear, targetMonth] = filters.date.split('-');
                data = data.filter((i: any) => {
                    if (!i.purchase_date) return false;
                    const date = new Date(i.purchase_date);
                    // getMonth() is 0-indexed, so we add 1
                    const itemMonth = String(date.getMonth() + 1).padStart(2, '0');
                    const itemYear = String(date.getFullYear());
                    return itemYear === targetYear && itemMonth === targetMonth;
                });
            }

            setItems(data);
        } catch (error) {
            console.error("Erro ao buscar detalhes", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.fixed_asset_number && item.fixed_asset_number.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    const exportCSV = () => {
        const headers = ['Ativo', 'Descrição', 'Status', 'Valor', 'Filial'];
        const csvContent = [
            headers.join(';'),
            ...filteredItems.map(item => [
                `"${item.fixed_asset_number || ''}"`,
                `"${item.description || ''}"`,
                `"${translateStatus(item.status) || ''}"`,
                (item.accounting_value || 0).toFixed(2).replace('.', ','),
                `"${item.branch?.name || ''}"`
            ].join(';'))
        ].join('\n');

        const latin1Bytes = new Uint8Array(csvContent.length);
        for (let i = 0; i < csvContent.length; i++) {
            latin1Bytes[i] = csvContent.charCodeAt(i) & 0xFF;
        }

        const blob = new Blob([latin1Bytes], { type: 'text/csv;charset=windows-1252' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `export_detalhes.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportXLSX = () => {
        const formattedData = filteredItems.map((item: any) => ({
            'Ativo Fixo': item.fixed_asset_number,
            'Descrição': item.description,
            'Status': translateStatus(item.status),
            'Valor': item.accounting_value || 0,
            'Filial': item.branch?.name
        }));

        const ws = XLSX.utils.json_to_sheet(formattedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Detalhes");
        XLSX.writeFile(wb, "export_detalhes.xlsx");
    };

    const exportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        const headers = [['Ativo', 'Descrição', 'Status', 'Valor', 'Filial']];
        const rows = filteredItems.map((item: any) => [
            item.fixed_asset_number || '',
            item.description,
            translateStatus(item.status),
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.accounting_value || 0),
            item.branch?.name || ''
        ]);

        autoTable(doc, {
            head: headers,
            body: rows,
            startY: 20,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] }
        });
        doc.save("export_detalhes.pdf");
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <FileText className="text-blue-500" />
                            {title}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {loading ? 'Carregando dados...' : `${filteredItems.length} itens encontrados`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex gap-4 bg-white dark:bg-slate-800">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar itens..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 text-sm font-medium"
                        >
                            <Download size={16} />
                            <span className="hidden sm:inline">Exportar</span>
                            <ChevronDown size={14} />
                        </button>
                        {isExportMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsExportMenuOpen(false)}
                                ></div>
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl py-1 z-20 border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button onClick={() => { exportXLSX(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 flex items-center gap-2">
                                        <FileSpreadsheet size={16} className="text-green-600" /> Excel (.xlsx)
                                    </button>
                                    <button onClick={() => { exportCSV(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 flex items-center gap-2">
                                        <TableIcon size={16} className="text-blue-600" /> CSV (.csv)
                                    </button>
                                    <button onClick={() => { exportPDF(); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 flex items-center gap-2">
                                        <FileText size={16} className="text-red-600" /> PDF (.pdf)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30 dark:bg-slate-900/10">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Ativo</th>
                                        <th className="px-4 py-3">Descrição</th>
                                        <th className="px-4 py-3">Filial</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Valor Contábil</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {filteredItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                                {item.fixed_asset_number || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                {item.description}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                {item.branch?.name || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                                                    ${item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                                      item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                                      'bg-slate-100 text-slate-700'}`}>
                                                    {translateStatus(item.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                                {item.accounting_value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredItems.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                                Nenhum item encontrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardModal;
