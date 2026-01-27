import React, { useEffect, useState } from 'react';
import api from '../api';
import { useError } from '../hooks/useError';
import { FileText, Clock, User, ArrowRight, Activity, AlertCircle } from 'lucide-react';

interface Item {
    id: number;
    description: string;
    category: string;
    status: string;
    approval_step: number;
    current_approvers: string[];
    updated_at?: string;
    created_at: string;
}

const MyRequests: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const { showError } = useError();

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const response = await api.get('/items/my-requests');
                setItems(response.data);
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
            case 'PENDING': return { text: 'Novo Item', color: 'bg-blue-100 text-blue-700' };
            case 'TRANSFER_PENDING': return { text: 'Transferência', color: 'bg-purple-100 text-purple-700' };
            case 'WRITE_OFF_PENDING': return { text: 'Baixa', color: 'bg-red-100 text-red-700' };
            default: return { text: status, color: 'bg-gray-100 text-gray-700' };
        }
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

            {items.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="bg-slate-50 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock size={32} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Nenhuma solicitação pendente</h3>
                    <p className="text-slate-500">Você não tem itens aguardando aprovação no momento.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => {
                        const statusInfo = getStatusLabel(item.status);
                        return (
                            <div key={item.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group">
                                {/* Status Strip */}
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${statusInfo.color.replace('text-', 'bg-').split(' ')[0].replace('100', '500')}`}></div>

                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${statusInfo.color}`}>
                                        {statusInfo.text}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                        <Clock size={12} />
                                        Etapa {item.approval_step || 1}
                                    </span>
                                </div>

                                <h3 className="font-bold text-slate-800 dark:text-white mb-1 truncate" title={item.description}>
                                    {item.description}
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">{item.category}</p>

                                <div className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-auto">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <Activity size={12} />
                                        Aguardando Aprovação de:
                                    </p>
                                    <div className="space-y-1">
                                        {item.current_approvers && item.current_approvers.length > 0 ? (
                                            item.current_approvers.map((name, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                                        {name.charAt(0)}
                                                    </div>
                                                    {name}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                                                <AlertCircle size={14} />
                                                <span>Aguardando Configuração</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MyRequests;
