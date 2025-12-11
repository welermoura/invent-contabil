import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Filter, Search } from 'lucide-react';
import api from '../../api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

interface Item {
    id: number;
    description: string;
    fixed_asset_number: string;
    accounting_value: number;
    status: string;
    branch?: { name: string };
    category_rel?: { name: string };
    purchase_date?: string;
}

const MacroViewPage: React.FC = () => {
    const { type, id } = useParams<{ type: string; id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Título dinâmico
    const [title, setTitle] = useState('Detalhes');
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<Item[]>([]);

    // Filtros locais
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, [type, id]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Determinar endpoint e filtros baseados na rota
            // Ex: /dashboard/filial/1 -> type='filial', id='1'
            // Ex: /dashboard/categoria/1 -> type='categoria', id='1'

            // Primeiro pegamos os metadados para o título
            let filterName = '';

            if (type === 'filial') {
                // Tenta pegar o nome da filial se possível, ou busca na lista de branches
                // Como não temos state global aqui fácil sem contexto, vamos buscar o nome no backend se for ID
                // Se o ID for o nome (hack), usamos direto.
                // O hook de navegação codificou o ID/Nome.
                const decodedId = decodeURIComponent(id || '');
                filterName = decodedId;
                setTitle(`Filial: ${decodedId}`);
            } else if (type === 'categoria') {
                const decodedId = decodeURIComponent(id || '');
                filterName = decodedId;
                setTitle(`Categoria: ${decodedId}`);
            } else if (type === 'status') {
                 // Caso genérico, ex: status
                 const val = searchParams.get('value');
                 filterName = val || '';
                 setTitle(`Status: ${val}`);
            }

            // Busca itens (usando paginação alta ou loop similar ao dashboard para pegar tudo desse escopo)
            // O ideal é filtrar no backend.
            // O backend suporta filtros? O contexto usa filter em memória.
            // O endpoint /items não tem filtro por branch_name direto se for string, mas tem se for ID.
            // Vamos assumir que estamos lidando com nomes por enquanto baseados nos gráficos atuais que usam nomes.
            // Se fossem IDs seria melhor. O CountByBranchChart usa nomes no 'name'.

            // Buscar todos e filtrar no front (estratégia atual do projeto para manter consistência)
            const response = await api.get('/items/?limit=5000');
            let data = response.data as Item[];

            // Aplicar filtro principal
            if (type === 'filial') {
                const target = decodeURIComponent(id || '');
                data = data.filter(i => i.branch?.name === target);
            } else if (type === 'categoria') {
                const target = decodeURIComponent(id || '');
                // O backend retorna 'category' string legacy ou 'category_rel.name'
                data = data.filter(i => (i.category_rel?.name === target) || ((i as any).category === target));
            } else if (type === 'status') {
                const target = searchParams.get('value');
                data = data.filter(i => i.status === target);
            }

            setItems(data);

        } catch (error) {
            console.error("Erro ao carregar dados da visão macro", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = useMemo(() => {
        return items.filter(item =>
            item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.fixed_asset_number && item.fixed_asset_number.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [items, searchTerm]);

    const stats = useMemo(() => {
        const totalValue = filteredItems.reduce((acc, i) => acc + (i.accounting_value || 0), 0);
        const count = filteredItems.length;
        return { totalValue, count };
    }, [filteredItems]);

    // Preparar dados para gráficos de resumo
    const chartData = useMemo(() => {
        // Status Distribution
        const statusCount: Record<string, number> = {};
        filteredItems.forEach(i => {
            statusCount[i.status] = (statusCount[i.status] || 0) + 1;
        });
        const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

        return { statusData };
    }, [filteredItems]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
        <div className="space-y-6 p-4 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{title}</h1>
                        <p className="text-slate-500 dark:text-slate-400">Visão Detalhada e Analítica</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
                        <Download size={18} />
                        <span className="hidden sm:inline">Exportar</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Total de Itens</p>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{stats.count}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Valor Contábil</p>
                    <h3 className="text-3xl font-bold text-emerald-600 mt-2">
                        {stats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Média por Item</p>
                    <h3 className="text-3xl font-bold text-blue-600 mt-2">
                        {(stats.count > 0 ? stats.totalValue / stats.count : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
            </div>

            {/* Charts & Table Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Charts */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 h-80">
                        <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Distribuição por Status</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Mais gráficos poderiam ser adicionados aqui */}
                </div>

                {/* Right: Table */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Listagem de Itens</h3>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Filtrar nesta lista..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Ativo</th>
                                    <th className="px-4 py-3">Descrição</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan={4} className="p-8 text-center">Carregando...</td></tr>
                                ) : filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                            {item.fixed_asset_number || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                            {item.description}
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                {item.category_rel?.name || item.branch?.name}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                                                ${item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                            {item.accounting_value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MacroViewPage;
