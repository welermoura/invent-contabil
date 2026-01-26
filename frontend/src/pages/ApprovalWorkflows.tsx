import React, { useEffect, useState } from 'react';
import api from '../api';
import { useError } from '../hooks/useError';
import { Plus, Trash2, ShieldCheck, Layers, User } from 'lucide-react';

interface ApprovalWorkflow {
    id: number;
    category_id: number;
    action_type: 'CREATE' | 'TRANSFER' | 'WRITE_OFF';
    required_role: 'ADMIN' | 'APPROVER' | 'OPERATOR' | 'AUDITOR' | null;
    required_user_id: number | null;
    step_order: number;
    category?: {
        id: number;
        name: string;
    };
    required_user?: {
        id: number;
        name: string;
        email: string;
    };
}

interface Category {
    id: number;
    name: string;
}

interface UserData {
    id: number;
    name: string;
    email: string;
    role: string;
}

const ApprovalWorkflows: React.FC = () => {
    const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const { showError, showSuccess } = useError();
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedAction, setSelectedAction] = useState<string>('CREATE');
    const [approvalType, setApprovalType] = useState<'ROLE' | 'USER'>('ROLE'); // Toggle between Role and User
    const [selectedRole, setSelectedRole] = useState<string>('APPROVER');
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [wfRes, catRes, userRes] = await Promise.all([
                api.get('/approval-workflows/'),
                api.get('/categories/'),
                api.get('/users/') // Fetches all users visible to current Admin/Approver
            ]);
            setWorkflows(wfRes.data);
            setCategories(catRes.data);
            // Filter users to show only ADMIN and APPROVER
            const approvers = userRes.data.filter((u: UserData) =>
                u.role === 'ADMIN' || u.role === 'APPROVER'
            );
            setUsers(approvers);
        } catch (error) {
            console.error("Error fetching data", error);
            showError("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdd = async () => {
        if (!selectedCategory) {
            showError("Selecione uma categoria.");
            return;
        }

        if (approvalType === 'USER' && !selectedUserId) {
             showError("Selecione um usuário.");
             return;
        }

        try {
            const payload: any = {
                category_id: parseInt(selectedCategory),
                action_type: selectedAction,
                step_order: 1
            };

            if (approvalType === 'ROLE') {
                payload.required_role = selectedRole;
                payload.required_user_id = null;
            } else {
                payload.required_role = null;
                payload.required_user_id = parseInt(selectedUserId);
            }

            await api.post('/approval-workflows/', payload);
            showSuccess("Regra adicionada com sucesso!");
            fetchData();
        } catch (error) {
            console.error("Error adding workflow", error);
            showError("Erro ao adicionar regra.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja remover esta regra?")) return;
        try {
            await api.delete(`/approval-workflows/${id}`);
            showSuccess("Regra removida.");
            fetchData(); // Refresh list
        } catch (error) {
            console.error("Error deleting workflow", error);
            showError("Erro ao remover regra.");
        }
    };

    const translateAction = (action: string) => {
        const map: any = {
            'CREATE': 'Novos Itens',
            'TRANSFER': 'Transferência',
            'WRITE_OFF': 'Baixa'
        };
        return map[action] || action;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-white/80 backdrop-blur-md dark:bg-slate-800/80 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <ShieldCheck className="text-indigo-600 dark:text-indigo-400" />
                        Malha de Aprovação
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Configure quem aprova o quê.</p>
                </div>
            </div>

            {/* Add New Rule Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Plus size={20} className="text-green-600" /> Adicionar Regra
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Selecione...</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ação</label>
                        <select
                            value={selectedAction}
                            onChange={e => setSelectedAction(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="CREATE">Novos Itens</option>
                            <option value="TRANSFER">Transferência</option>
                            <option value="WRITE_OFF">Baixa</option>
                        </select>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de Aprovador</label>
                             <div className="flex bg-slate-100 dark:bg-slate-900 rounded p-0.5">
                                 <button
                                    onClick={() => setApprovalType('ROLE')}
                                    className={`text-[10px] px-2 py-0.5 rounded ${approvalType === 'ROLE' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}
                                 >Cargo</button>
                                 <button
                                    onClick={() => setApprovalType('USER')}
                                    className={`text-[10px] px-2 py-0.5 rounded ${approvalType === 'USER' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}
                                 >Usuário</button>
                             </div>
                        </div>

                        {approvalType === 'ROLE' ? (
                            <select
                                value={selectedRole}
                                onChange={e => setSelectedRole(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="APPROVER">Aprovador (Padrão)</option>
                                <option value="ADMIN">Administrador</option>
                            </select>
                        ) : (
                            <select
                                value={selectedUserId}
                                onChange={e => setSelectedUserId(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Selecione um usuário...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                        <Plus size={18} /> Adicionar
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workflows.map(wf => (
                    <div key={wf.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between group hover:border-indigo-200 transition-all">
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {wf.category?.name || 'Categoria Desconhecida'}
                                </span>
                                <button onClick={() => handleDelete(wf.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm mb-2">
                                <Layers size={16} className="text-slate-400"/>
                                <span className="font-medium">{translateAction(wf.action_type)}</span>
                            </div>

                            <div className="flex items-center gap-2 mt-4 text-sm">
                                <span className="text-slate-500">Requer:</span>
                                {wf.required_user ? (
                                    <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                        <User size={14} className="text-blue-600"/>
                                        {wf.required_user.name}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                        <ShieldCheck size={14} className="text-green-600"/>
                                        {wf.required_role === 'APPROVER' ? 'Aprovador' : 'Admin'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {workflows.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400">
                        <Layers size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Nenhuma regra de aprovação configurada.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApprovalWorkflows;
