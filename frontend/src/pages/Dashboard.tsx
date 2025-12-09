
import React, { useEffect, useState } from 'react';
import api from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, FileWarning, DollarSign, ArrowRight, Loader2 } from 'lucide-react';

const KPICard = ({ title, value, subtext, icon: Icon, colorClass, onClick }: any) => (
    <div
        className={`bg-white p-6 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.03)] border border-slate-100 transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}`}
        onClick={onClick}
    >
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{title}</p>
                <h3 className={`text-3xl font-bold mt-2 ${colorClass}`}>{value}</h3>
            </div>
            <div className={`p-3 rounded-lg ${colorClass.replace('text-', 'bg-').replace('600', '100').replace('500', '100')}`}>
                <Icon className={colorClass} size={24} />
            </div>
        </div>
        {subtext && (
            <div className="mt-4 flex items-center text-sm text-slate-400 group">
                {subtext}
                {onClick && <ArrowRight size={14} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
        )}
    </div>
);

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/dashboard/stats');
                setStats(response.data);
            } catch (error) {
                console.error("Erro ao carregar estatísticas", error);
            }
        };
        fetchStats();
    }, []);

    if (!stats) return (
        <div className="flex items-center justify-center h-full text-slate-400">
            <Loader2 className="animate-spin mr-2" /> Carregando painel...
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Painel de Controle</h1>
                    <p className="text-slate-500 mt-1">Visão geral do inventário e pendências</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard
                    title="Itens Pendentes"
                    value={stats.pending_items_count}
                    subtext="Aguardando aprovação"
                    icon={AlertCircle}
                    colorClass="text-amber-500"
                    onClick={() => navigate('/inventory?status=PENDING')}
                />
                <KPICard
                    title="Baixas Pendentes"
                    value={stats.write_off_count}
                    subtext="Solicitações de baixa"
                    icon={FileWarning}
                    colorClass="text-red-500"
                    onClick={() => navigate('/inventory?status=WRITE_OFF_PENDING')}
                />
                <KPICard
                    title="Valor em Aberto"
                    value={stats.pending_items_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    subtext="Total em itens pendentes"
                    icon={DollarSign}
                    colorClass="text-emerald-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                        Itens por Categoria
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.items_by_category} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Bar
                                    dataKey="count"
                                    fill="#6366f1"
                                    radius={[4, 4, 0, 0]}
                                    name="Quantidade"
                                    onClick={(data) => data && data.category && navigate(`/inventory?category=${data.category}`)}
                                    cursor="pointer"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                        Itens por Filial
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.items_by_branch} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="branch" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Bar
                                    dataKey="count"
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                    name="Quantidade"
                                    onClick={(data) => data && data.branch_id && navigate(`/inventory?branch_id=${data.branch_id}`)}
                                    cursor="pointer"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
