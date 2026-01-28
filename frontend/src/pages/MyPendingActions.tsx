import React, { useEffect, useState } from 'react';
import { getPendingActions } from '../api';
import api from '../api';
import { useError } from '../hooks/useError';
import {
    ClipboardList,
    ArrowRightLeft,
    Trash2,
    CheckCircle,
    PackageCheck,
    AlertCircle
} from 'lucide-react';

const MyPendingActions: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { showError, showSuccess, showConfirm } = useError();

    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await getPendingActions();
            setItems(data);
        } catch (error) {
            console.error("Error fetching pending actions", error);
            showError("Erro ao carregar pendências.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleAction = async (item: any) => {
        if (item.status === 'IN_TRANSIT') {
            showConfirm("Confirmar recebimento deste item?", async () => {
                try {
                    await api.put(`/items/${item.id}/status?status_update=IN_STOCK`);
                    showSuccess("Recebimento confirmado.");
                    fetchItems();
                } catch (error) {
                    showError(error, "Erro ao confirmar recebimento.");
                }
            }, "Receber Item");
        } else if (item.status === 'READY_FOR_WRITE_OFF') {
            showConfirm("Confirmar baixa definitiva (descarte/venda) deste item? Esta ação é irreversível.", async () => {
                try {
                    await api.put(`/items/${item.id}/status?status_update=WRITTEN_OFF`);
                    showSuccess("Baixa concluída.");
                    fetchItems();
                } catch (error) {
                    showError(error, "Erro ao concluir baixa.");
                }
            }, "Concluir Baixa");
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'IN_TRANSIT': return <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-bold border border-blue-200"><ArrowRightLeft className="w-3 h-3" /> Em Trânsito</span>;
            case 'READY_FOR_WRITE_OFF': return <span className="flex items-center gap-1 text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full text-xs font-bold border border-orange-200"><AlertCircle className="w-3 h-3" /> Aguardando Baixa</span>;
            default: return <span className="text-xs">{status}</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <ClipboardList className="w-8 h-8 text-indigo-600" />
                        Confirmações Pendentes
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Itens aguardando sua ação para conclusão (Recebimento ou Baixa).
                    </p>
                </div>
                <button onClick={fetchItems} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                    Atualizar
                </button>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200/50">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhe</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Carregando...</td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Nenhuma pendência encontrada.</td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.description}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.fixed_asset_number || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {item.status === 'IN_TRANSIT' && (
                                                <span>Origem: {item.branch?.name} <ArrowRightLeft className="inline w-3 h-3"/> Destino: {item.transfer_target_branch?.name}</span>
                                            )}
                                            {item.status === 'READY_FOR_WRITE_OFF' && (
                                                <span>Motivo: {item.write_off_reason}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleAction(item)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-white text-xs font-bold shadow-sm ${item.status === 'IN_TRANSIT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                                            >
                                                {item.status === 'IN_TRANSIT' ? (
                                                    <><PackageCheck className="w-4 h-4" /> CONFIRMAR RECEBIMENTO</>
                                                ) : (
                                                    <><Trash2 className="w-4 h-4" /> CONCLUIR BAIXA</>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MyPendingActions;
