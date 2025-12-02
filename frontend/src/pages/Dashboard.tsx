import React, { useEffect, useState } from 'react';
import api from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

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

    if (!stats) return <div>Carregando...</div>;

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Painel de Controle</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div
                    className="bg-white p-6 rounded shadow cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => navigate('/inventory?status=PENDING')}
                >
                    <h3 className="text-xl font-semibold mb-2">Itens Pendentes</h3>
                    <p className="text-4xl text-yellow-500">{stats.pending_items_count}</p>
                    <p className="text-sm text-gray-500 mt-2">Clique para ver detalhes</p>
                </div>
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-xl font-semibold mb-2">Valor Pendente</h3>
                    <p className="text-4xl text-green-500">R$ {stats.pending_items_value.toFixed(2)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-xl font-semibold mb-4">Itens por Categoria (Pendentes)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stats.items_by_category}
                                margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="category" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar
                                    dataKey="count"
                                    fill="#8884d8"
                                    name="Quantidade"
                                    onClick={(data) => {
                                        if (data && data.category) {
                                            navigate(`/inventory?status=PENDING&category=${data.category}`);
                                        }
                                    }}
                                    cursor="pointer"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-xl font-semibold mb-4">Itens por Filial</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stats.items_by_branch}
                                margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="branch" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar
                                    dataKey="count"
                                    fill="#82ca9d"
                                    name="Quantidade"
                                    onClick={(data) => {
                                        if (data && data.branch_id) {
                                            navigate(`/inventory?branch_id=${data.branch_id}`);
                                        }
                                    }}
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
