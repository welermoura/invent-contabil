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
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                                            <h3 className="font-semibold text-gray-800 mb-2 border-b pb-2">Detalhes</h3>
                                                            <div className="space-y-2 text-sm">
                                                                <p><span className="font-medium text-gray-600">Categoria:</span> {req.category?.name}</p>
                                                                {req.data?.reason && <p><span className="font-medium text-gray-600">Motivo:</span> {req.data.reason}</p>}
                                                                {req.data?.justification && <p><span className="font-medium text-gray-600">Justificativa:</span> {req.data.justification}</p>}
                                                                {req.data?.target_branch_id && <p><span className="font-medium text-gray-600">Destino (ID):</span> {req.data.target_branch_id}</p>}
                                                            </div>
                                                        </div>
                                                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                                            <h3 className="font-semibold text-gray-800 mb-2 border-b pb-2">
                                                                Itens ({req.items?.length || 0})
                                                            </h3>
                                                            <div className="max-h-48 overflow-y-auto space-y-1">
                                                                {req.items?.map(item => (
                                                                    <div key={item.id} className="text-sm flex justify-between p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-100">
                                                                        <span className="truncate flex-1">{item.description}</span>
                                                                        <span className="text-gray-500 text-xs font-mono ml-2">{item.fixed_asset_number}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
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
