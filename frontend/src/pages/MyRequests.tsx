import React, { useEffect, useState } from 'react';
import api from '../api';
import { useError } from '../hooks/useError';
import { FileText, Clock, User, ArrowRight, Activity, AlertCircle, Package, Truck, ChevronDown, ChevronUp } from 'lucide-react';

interface Request {
    id: number;
    type: string;
    status: string;
    current_step: number;
    created_at: string;
    items: any[];
    current_approvers: string[];
}

const MyRequests: React.FC = () => {
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const { showError } = useError();
    const [expandedRequest, setExpandedRequest] = useState<number | null>(null);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                // Now using the requests endpoint instead of items
                const response = await api.get('/requests/my');
                setRequests(response.data);
            } catch (error) {
                console.error("Error fetching requests", error);
                showError("Erro ao carregar solicitações.");
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, [showError]);

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PENDING': return { text: 'Em Análise', color: 'bg-yellow-100 text-yellow-700' };
            case 'APPROVED': return { text: 'Aprovado', color: 'bg-green-100 text-green-700' };
            case 'REJECTED': return { text: 'Rejeitado', color: 'bg-red-100 text-red-700' };
            default: return { text: status, color: 'bg-gray-100 text-gray-700' };
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedRequest(expandedRequest === id ? null : id);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                <span className="text-gray-500">Carregando solicitações...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    <FileText className="text-indigo-600" />
                    Minhas Solicitações
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Acompanhe o andamento das suas solicitações pendentes.
                </p>
            </div>

            {requests.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="bg-slate-50 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock size={32} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Nenhuma solicitação encontrada</h3>
                    <p className="text-slate-500">Você não tem solicitações recentes.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map((req) => {
                        const statusInfo = getStatusLabel(req.status);
                        return (
                            <div key={req.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-5 cursor-pointer" onClick={() => toggleExpand(req.id)}>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl ${req.type === 'WRITE_OFF' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {req.type === 'WRITE_OFF' ? <Package size={24}/> : <Truck size={24}/>}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-800 dark:text-white">Solicitação #{req.id}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${statusInfo.color}`}>
                                                        {statusInfo.text}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-slate-500 flex items-center gap-3">
                                                    <span className="flex items-center gap-1"><Clock size={14}/> {new Date(req.created_at).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <span>{req.items.length} itens</span>
                                                    <span>•</span>
                                                    <span>Etapa {req.current_step}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                            {req.status === 'PENDING' && (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                                                        <Activity size={12} /> Aguardando:
                                                    </span>
                                                    <div className="flex -space-x-2">
                                                        {req.current_approvers && req.current_approvers.length > 0 ? (
                                                            req.current_approvers.slice(0, 3).map((name, idx) => (
                                                                <div key={idx} className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700" title={name}>
                                                                    {name.charAt(0)}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs text-orange-500">Configuração Pendente</span>
                                                        )}
                                                        {req.current_approvers && req.current_approvers.length > 3 && (
                                                            <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                +{req.current_approvers.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {expandedRequest === req.id ? <ChevronUp className="text-slate-400"/> : <ChevronDown className="text-slate-400"/>}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedRequest === req.id && (
                                    <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 animate-slide-in">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 px-2">Itens Inclusos</h4>
                                        <div className="grid gap-2">
                                            {req.items.map((item) => (
                                                <div key={item.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                                    <div>
                                                        <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">{item.description}</p>
                                                        <p className="text-xs text-slate-500">{item.fixed_asset_number || 'Sem Ativo Fixo'}</p>
                                                    </div>
                                                    <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                                                        R$ {item.invoice_value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MyRequests;
