import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getPendingRequests, approveRequest, rejectRequest } from '../api';
import type { RequestData } from '../api';
import { useError } from '../hooks/useError';
import {
    CheckSquare,
    ArrowRightLeft,
    Trash2,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
    Clock
} from 'lucide-react';

const PendingApprovals: React.FC = () => {
    const [requests, setRequests] = useState<RequestData[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedRequestId, setExpandedRequestId] = useState<number | null>(null);
    const { showError, showSuccess, showConfirm } = useError();
    const location = useLocation();

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await getPendingRequests();
            setRequests(data);

            // Check for ID in query params
            const searchParams = new URLSearchParams(location.search);
            const idParam = searchParams.get('id');
            if (idParam) {
                const id = parseInt(idParam, 10);
                // Expand if exists
                if (data.some(r => r.id === id)) {
                    setExpandedRequestId(id);
                }
            }
        } catch (error) {
            console.error("Error fetching pending requests", error);
            showError("Erro ao carregar aprovações pendentes.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const toggleExpand = (id: number) => {
        if (expandedRequestId === id) {
            setExpandedRequestId(null);
        } else {
            setExpandedRequestId(id);
        }
    };

    const handleApprove = (id: number) => {
        showConfirm("Confirma a aprovação desta solicitação? Se for a última etapa, a ação será efetivada nos itens.", async () => {
            try {
                await approveRequest(id);
                showSuccess("Solicitação aprovada com sucesso.");
                fetchRequests();
            } catch (error) {
                showError(error, "Erro ao aprovar solicitação.");
            }
        }, "Aprovar Solicitação");
    };

    const handleReject = (id: number) => {
        showConfirm("Tem certeza que deseja rejeitar esta solicitação? Os itens voltarão para o status original.", async () => {
            try {
                await rejectRequest(id);
                showSuccess("Solicitação rejeitada.");
                fetchRequests();
            } catch (error) {
                showError(error, "Erro ao rejeitar solicitação.");
            }
        }, "Rejeitar Solicitação");
    };

    const getTypeBadge = (type: string) => {
        if (type === 'WRITE_OFF') {
            return <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full text-xs font-bold border border-red-100"><Trash2 className="w-3 h-3" /> Baixa</span>;
        }
        return <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-bold border border-blue-100"><ArrowRightLeft className="w-3 h-3" /> Transferência</span>;
    };

    const formatCurrency = (value?: number) => {
        if (value === undefined || value === null) return '-';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const calculateTotals = (items: any[]) => {
        const invoiceTotal = items.reduce((acc, item) => acc + (item.invoice_value || 0), 0);
        const accountingTotal = items.reduce((acc, item) => acc + (item.accounting_value || 0), 0);
        return { invoiceTotal, accountingTotal };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <CheckSquare className="w-8 h-8 text-indigo-600" />
                        Aprovações Pendentes
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gerencie as solicitações em lote que aguardam sua aprovação.
                    </p>
                </div>
                <button onClick={fetchRequests} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                    Atualizar
                </button>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200/50">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Etapa Atual</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Carregando...</td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Nenhuma aprovação pendente.</td>
                                </tr>
                            ) : (
                                requests.map((req) => (
                                    <React.Fragment key={req.id}>
                                        <tr className={`hover:bg-gray-50 transition-colors ${expandedRequestId === req.id ? 'bg-indigo-50/30' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#{req.id}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">{getTypeBadge(req.type)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {req.requester?.name || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                Etapa {req.current_step}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(req.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                     <button
                                                        onClick={() => toggleExpand(req.id)}
                                                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-lg transition-colors mr-2"
                                                        title="Ver Detalhes"
                                                    >
                                                        {expandedRequestId === req.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(req.id)}
                                                        className="text-green-600 hover:text-green-900 bg-green-50 p-2 rounded-lg transition-colors"
                                                        title="Aprovar"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(req.id)}
                                                        className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg transition-colors"
                                                        title="Rejeitar"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRequestId === req.id && (
                                            <tr className="bg-gray-50/50 animate-in fade-in duration-200">
                                                <td colSpan={6} className="px-6 py-4">
                                                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-4">
                                                        <h3 className="font-semibold text-gray-800 mb-3 border-b pb-2 flex justify-between items-center">
                                                            <span>Resumo da Solicitação</span>
                                                            <span className="text-xs font-normal text-gray-500">ID: {req.id}</span>
                                                        </h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                                            <div>
                                                                <p className="flex justify-between py-1 border-b border-gray-100">
                                                                    <span className="font-medium text-gray-600">Categoria:</span>
                                                                    <span>{req.category?.name}</span>
                                                                </p>
                                                                {req.type === 'WRITE_OFF' && (
                                                                    <>
                                                                        <p className="flex justify-between py-1 border-b border-gray-100">
                                                                            <span className="font-medium text-gray-600">Motivo:</span>
                                                                            <span>{req.data?.reason || '-'}</span>
                                                                        </p>
                                                                        {req.data?.justification && (
                                                                            <p className="flex flex-col py-1 border-b border-gray-100">
                                                                                <span className="font-medium text-gray-600 mb-1">Justificativa:</span>
                                                                                <span className="italic text-gray-500 bg-gray-50 p-2 rounded">{req.data.justification}</span>
                                                                            </p>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {req.type === 'TRANSFER' && (
                                                                    <>
                                                                        <p className="flex justify-between py-1 border-b border-gray-100">
                                                                            <span className="font-medium text-gray-600">Origem:</span>
                                                                            <span>{req.items?.[0]?.branch?.name || 'Múltiplas'}</span>
                                                                        </p>
                                                                        <p className="flex justify-between py-1 border-b border-gray-100">
                                                                            <span className="font-medium text-gray-600">Destino:</span>
                                                                            <span className="font-bold text-blue-600">{req.items?.[0]?.transfer_target_branch?.name || `ID: ${req.data?.target_branch_id}`}</span>
                                                                        </p>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div>
                                                                {(() => {
                                                                    const { invoiceTotal, accountingTotal } = calculateTotals(req.items || []);
                                                                    return (
                                                                        <>
                                                                            <p className="flex justify-between py-1 border-b border-gray-100">
                                                                                <span className="font-medium text-gray-600">Valor Total (Nota):</span>
                                                                                <span>{formatCurrency(invoiceTotal)}</span>
                                                                            </p>
                                                                            <p className="flex justify-between py-1 border-b border-gray-100">
                                                                                <span className="font-medium text-gray-600">Valor Contábil (Atual):</span>
                                                                                <span className="font-semibold text-gray-800">{formatCurrency(accountingTotal)}</span>
                                                                            </p>
                                                                            <p className="flex justify-between py-1 border-b border-gray-100">
                                                                                <span className="font-medium text-gray-600">Total de Itens:</span>
                                                                                <span>{req.items?.length || 0}</span>
                                                                            </p>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                                        <h3 className="font-semibold text-gray-800 mb-2 border-b pb-2">
                                                            Itens da Solicitação
                                                        </h3>
                                                        <div className="max-h-64 overflow-y-auto">
                                                            <table className="min-w-full text-sm">
                                                                <thead className="bg-gray-50 text-gray-500 font-medium">
                                                                    <tr>
                                                                        <th className="px-3 py-2 text-left">Ativo</th>
                                                                        <th className="px-3 py-2 text-left">Descrição</th>
                                                                        <th className="px-3 py-2 text-left">Data Compra</th>
                                                                        <th className="px-3 py-2 text-right">Valor Nota</th>
                                                                        <th className="px-3 py-2 text-right">Valor Contábil</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {req.items?.map(item => (
                                                                        <tr key={item.id} className="hover:bg-gray-50">
                                                                            <td className="px-3 py-2 font-mono text-xs">{item.fixed_asset_number}</td>
                                                                            <td className="px-3 py-2 truncate max-w-xs" title={item.description}>{item.description}</td>
                                                                            <td className="px-3 py-2">{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : '-'}</td>
                                                                            <td className="px-3 py-2 text-right">{formatCurrency(item.invoice_value)}</td>
                                                                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.accounting_value)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PendingApprovals;
