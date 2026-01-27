import React, { useEffect, useState } from 'react';
import api from '../api';
import { useError } from '../hooks/useError';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Package, Truck, ArrowRight, User } from 'lucide-react';

interface Request {
    id: number;
    type: string;
    status: string;
    current_step: number;
    created_at: string;
    requester: { name: string };
    category?: { name: string };
    data?: any;
    items: any[];
}

const PendingApprovals: React.FC = () => {
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRequest, setExpandedRequest] = useState<number | null>(null);
    const { showError, showSuccess, showConfirm } = useError();

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await api.get('/requests/pending');
            setRequests(response.data);
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

    const handleApprove = async (req: Request) => {
        showConfirm(`Aprovar solicitação #${req.id}?`, async () => {
            try {
                await api.put(`/requests/${req.id}/approve`);
                showSuccess("Solicitação aprovada com sucesso!");
                fetchRequests();
            } catch (error) {
                console.error("Error approving", error);
                showError("Erro ao aprovar.");
            }
        });
    };

    const handleReject = async (req: Request) => {
        // Ideally show a prompt for reason
        showConfirm(`Rejeitar solicitação #${req.id}? Os itens serão liberados.`, async () => {
            try {
                await api.put(`/requests/${req.id}/reject`);
                showSuccess("Solicitação rejeitada.");
                fetchRequests();
            } catch (error) {
                console.error("Error rejecting", error);
                showError("Erro ao rejeitar.");
            }
        }, "Confirmar Rejeição");
    };

    const toggleExpand = (id: number) => {
        setExpandedRequest(expandedRequest === id ? null : id);
    };

    const getTypeLabel = (type: string) => {
        switch(type) {
            case 'WRITE_OFF': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Package size={12}/> Baixa em Lote</span>;
            case 'TRANSFER': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Truck size={12}/> Transferência</span>;
            default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{type}</span>;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    <CheckCircle className="text-green-600" />
                    Aprovações Pendentes
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Gerencie as solicitações de baixa e transferência que aguardam sua aprovação.
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : requests.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                    <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600"><CheckCircle size={32}/></div>
                    <h3 className="text-lg font-medium text-slate-800">Tudo em dia!</h3>
                    <p className="text-slate-500">Nenhuma aprovação pendente no momento.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md">
                            <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer" onClick={() => toggleExpand(req.id)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${req.type === 'WRITE_OFF' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {req.type === 'WRITE_OFF' ? <Package size={24}/> : <Truck size={24}/>}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-slate-800 dark:text-white">Solicitação #{req.id}</span>
                                            {getTypeLabel(req.type)}
                                            <span className="text-xs text-slate-400 flex items-center gap-1 ml-2"><Clock size={12}/> {new Date(req.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-sm text-slate-500 flex items-center gap-4">
                                            <span className="flex items-center gap-1"><User size={14}/> {req.requester?.name}</span>
                                            <span>•</span>
                                            <span>{req.category?.name || 'Sem Categoria'}</span>
                                            <span>•</span>
                                            <span>{req.items.length} itens</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button onClick={(e) => { e.stopPropagation(); handleApprove(req); }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm">Aprovar</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleReject(req); }} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">Rejeitar</button>
                                    {expandedRequest === req.id ? <ChevronUp className="text-slate-400"/> : <ChevronDown className="text-slate-400"/>}
                                </div>
                            </div>

                            {expandedRequest === req.id && (
                                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
                                    <div className="mb-4 text-sm text-slate-600">
                                        {req.data && (
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                {req.data.reason && <p><strong>Motivo:</strong> {req.data.reason}</p>}
                                                {req.data.target_branch_id && <p><strong>Destino ID:</strong> {req.data.target_branch_id}</p>}
                                                {/* Ideally fetch branch name or store it in data */}
                                            </div>
                                        )}
                                    </div>

                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Itens da Solicitação</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-slate-500 uppercase bg-slate-100">
                                                <tr>
                                                    <th className="px-4 py-2 rounded-l-lg">Descrição</th>
                                                    <th className="px-4 py-2">Ativo Fixo</th>
                                                    <th className="px-4 py-2">Valor</th>
                                                    <th className="px-4 py-2 rounded-r-lg">Filial Atual</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {req.items.map(item => (
                                                    <tr key={item.id}>
                                                        <td className="px-4 py-2 font-medium">{item.description}</td>
                                                        <td className="px-4 py-2 font-mono text-xs">{item.fixed_asset_number || '-'}</td>
                                                        <td className="px-4 py-2">R$ {item.invoice_value}</td>
                                                        <td className="px-4 py-2">{item.branch?.name}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PendingApprovals;
