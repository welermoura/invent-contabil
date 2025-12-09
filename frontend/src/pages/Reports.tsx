
import React, { useState } from 'react';

// Estrutura de dados do Menu de Relatórios
const reportsMenu = [
    {
        category: "A. Relatórios Operacionais e de Estoque",
        description: "Controle físico, movimentação e posição atual dos ativos.",
        items: [
            { id: "A.1", title: "Posição de Inventário Geral (Sintético e Analítico)" },
            { id: "A.2", title: "Itens por Filial e Centro de Custo" },
            { id: "A.3", title: "Itens por Categoria e Grupo de Contas" },
            { id: "A.4", title: "Itens por Responsável/Detentor" },
            { id: "A.5", title: "Relatório de Ativos Novos (Entradas no Período)" },
            { id: "A.6", title: "Histórico de Movimentações (Kardex do Ativo)" },
            { id: "A.7", title: "Relatório de Ativos em Trânsito (Transferências Pendentes)" },
            { id: "A.8", title: "Mapa de Localização Física dos Ativos" },
            { id: "A.9", title: "Relatório de Etiquetas/Plaquetas Geradas" },
            { id: "A.10", title: "Ativos Disponíveis vs. Em Uso" }
        ]
    },
    {
        category: "B. Relatórios Contábeis e Financeiros",
        description: "Análise de valor, depreciação e conciliação contábil.",
        items: [
            { id: "B.1", title: "Razão Auxiliar do Ativo Imobilizado" },
            { id: "B.2", title: "Relatório de Depreciação Mensal e Acumulada" },
            { id: "B.3", title: "Mapa de Correção Monetária (se aplicável)" },
            { id: "B.4", title: "Conciliação Físico x Contábil (Sobras e Faltas)" },
            { id: "B.5", title: "Relatório de Ativos Totalmente Depreciados" },
            { id: "B.6", title: "Projeção de Depreciação (Budget 12/24/60 meses)" },
            { id: "B.7", title: "Relatório de Baixas Contábeis (Venda, Sucata, Perda)" },
            { id: "B.8", title: "Apuração de Ganho/Perda de Capital na Baixa" },
            { id: "B.9", title: "Relatório de Aquisições (CAPEX Realizado)" },
            { id: "B.10", title: "Resumo de Valores por Conta Contábil" }
        ]
    },
    {
        category: "C. Auditoria, Compliance e Governança",
        description: "Rastreabilidade, segurança e conformidade com normas.",
        items: [
            { id: "C.1", title: "Trilha de Auditoria Completa (Log de Eventos do Sistema)" },
            { id: "C.2", title: "Relatório de Alterações em Campos Críticos (Valor, Data, Nota)" },
            { id: "C.3", title: "Log de Aprovações e Rejeições de Movimentações" },
            { id: "C.4", title: "Relatório de Divergências Físicas Apuradas" },
            { id: "C.5", title: "Itens sem Número de Ativo Fixo (Pendência de Emplaquetamento)" },
            { id: "C.6", title: "Itens com Dados Cadastrais Incompletos (Data Quality)" },
            { id: "C.7", title: "Relatório de Ativos Não Localizados (Perdas Potenciais)" },
            { id: "C.8", title: "Inventário Rotativo: Acuracidade por Período" },
            { id: "C.9", title: "Conformidade CPC 27 / IAS 16 (Ativo Imobilizado)" },
            { id: "C.10", title: "Histórico de Alterações de Responsáveis" }
        ]
    },
    {
        category: "D. Ciclo de Vida e Obsolescência",
        description: "Gestão da vida útil, manutenção e renovação do parque.",
        items: [
            { id: "D.1", title: "Análise de Idade Média da Frota/Ativos (Aging)" },
            { id: "D.2", title: "Relatório de Ativos Obsoletos (Sem movimentação > X dias)" },
            { id: "D.3", title: "Ativos com Vida Útil Expirada ou Próxima do Fim" },
            { id: "D.4", title: "Sugestão de Renovação/Descarte de Equipamentos" },
            { id: "D.5", title: "Histórico de Manutenções e Ocorrências" },
            { id: "D.6", title: "Taxa de Utilização de Ativos (Ociosidade)" }
        ]
    },
    {
        category: "E. Administração, Segurança e Acessos",
        description: "Gestão de usuários, permissões e configurações do sistema.",
        items: [
            { id: "E.1", title: "Relatório de Usuários Ativos e Inativos" },
            { id: "E.2", title: "Matriz de Perfis e Permissões de Acesso (SOD)" },
            { id: "E.3", title: "Log de Acessos ao Sistema (Login/Logout)" },
            { id: "E.4", title: "Relatório de Usuários por Filial/Unidade de Negócio" },
            { id: "E.5", title: "Tentativas de Acesso Não Autorizado" },
            { id: "E.6", title: "Configurações de Parâmetros de Depreciação por Categoria" }
        ]
    },
    {
        category: "F. Relatórios Fiscais e Tributários",
        description: "Suporte a obrigações acessórias e créditos tributários.",
        items: [
            { id: "F.1", title: "Relatório para Crédito de PIS/COFINS sobre Ativo" },
            { id: "F.2", title: "Relatório para Controle de Crédito de ICMS (CIAP)" },
            { id: "F.3", title: "Base de Cálculo para Seguros" },
            { id: "F.4", title: "Relatório de NF-e de Entrada de Ativos" }
        ]
    }
];

const Reports: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const toggleCategory = (category: string) => {
        if (expandedCategory === category) {
            setExpandedCategory(null);
        } else {
            setExpandedCategory(category);
        }
    };

    const filteredMenu = reportsMenu.map(section => {
        const filteredItems = section.items.filter(item =>
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return {
            ...section,
            items: filteredItems,
            hasMatch: filteredItems.length > 0 || section.category.toLowerCase().includes(searchTerm.toLowerCase())
        };
    }).filter(section => section.hasMatch);

    return (
        <div className="p-6 bg-gray-50 min-h-full">
            <h1 className="text-3xl font-bold mb-2 text-gray-800">Menu de Relatórios</h1>
            <p className="text-gray-600 mb-6">Central completa de relatórios para auditoria, contabilidade e gestão de ativos.</p>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Buscar relatório (Ex: depreciação, auditoria, fiscal...)"
                    className="w-full md:w-1/2 px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="space-y-4">
                {filteredMenu.map((section, index) => (
                    <div key={index} className="bg-white rounded-lg shadow overflow-hidden">
                        <button
                            onClick={() => toggleCategory(section.category)}
                            className="w-full px-6 py-4 text-left bg-white hover:bg-gray-50 flex justify-between items-center transition-colors"
                        >
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">{section.category}</h2>
                                <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                            </div>
                            <span className={`transform transition-transform ${expandedCategory === section.category || searchTerm ? 'rotate-180' : ''}`}>
                                ▼
                            </span>
                        </button>

                        {(expandedCategory === section.category || searchTerm) && (
                            <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {section.items.map((report) => (
                                        <div
                                            key={report.id}
                                            className="bg-white p-3 rounded border border-gray-200 hover:shadow-md transition-shadow cursor-pointer flex items-center group"
                                            onClick={() => alert(`Gerar relatório: ${report.title}\n\n(Funcionalidade em desenvolvimento)`)}
                                        >
                                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded mr-3">
                                                {report.id}
                                            </span>
                                            <span className="text-gray-700 group-hover:text-blue-700 font-medium text-sm">
                                                {report.title}
                                            </span>
                                        </div>
                                    ))}
                                    {section.items.length === 0 && (
                                        <p className="text-gray-500 italic text-sm">Nenhum relatório encontrado nesta categoria para a busca.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {filteredMenu.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        Nenhum relatório encontrado para "{searchTerm}".
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
