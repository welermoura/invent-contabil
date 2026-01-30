import React, { useEffect, useState } from 'react';
import api from '../api';
import { useError } from '../hooks/useError';
import { Plus, Trash2, ShieldCheck, Layers, User, Users as UsersIcon, Edit2, ChevronDown, ChevronRight, Save, X, ArrowUp, ArrowDown } from 'lucide-react';

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
    const { showError, showSuccess, showConfirm } = useError();
    const [loading, setLoading] = useState(false);

    // Grouping State
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    // Form State (New Sequence)
    const [newSeqCategory, setNewSeqCategory] = useState<string>('');
    const [newSeqAction, setNewSeqAction] = useState<string>('CREATE');
    const [isAddingSequence, setIsAddingSequence] = useState(false);

    // Edit/Add Step State
    const [editingStepId, setEditingStepId] = useState<number | null>(null);
    const [editUserId, setEditUserId] = useState<string>('');
    const [editGroupId, setEditGroupId] = useState<string>('');

    // Add Step to specific group
    const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
    const [addStepUserId, setAddStepUserId] = useState<string>('');
    const [addStepGroupId, setAddStepGroupId] = useState<string>('');
    const [stepType, setStepType] = useState<'USER' | 'GROUP'>('USER');

    const [groups, setGroups] = useState<any[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [wfRes, catRes, userRes, groupRes] = await Promise.all([
                api.get('/approval-workflows/'),
                api.get('/categories/'),
                api.get('/users/'),
                api.get('/groups/')
            ]);
            setWorkflows(wfRes.data);
            setCategories(catRes.data);
            const approvers = userRes.data.filter((u: UserData) =>
                u.role === 'ADMIN' || u.role === 'APPROVER'
            );
            setUsers(approvers);
            setGroups(groupRes.data);
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

    // Helper to generate unique group keys
    const getGroupKey = (catId: number, action: string) => `${catId}-${action}`;

    const groupedWorkflows = workflows.reduce((acc, wf) => {
        const key = getGroupKey(wf.category_id, wf.action_type);
        if (!acc[key]) {
            acc[key] = {
                category_name: wf.category?.name || 'Desconhecida',
                action_type: wf.action_type,
                category_id: wf.category_id,
                steps: []
            };
        }
        acc[key].steps.push(wf);
        return acc;
    }, {} as Record<string, { category_name: string, action_type: string, category_id: number, steps: ApprovalWorkflow[] }>);

    // Sort steps within groups
    Object.values(groupedWorkflows).forEach(group => {
        group.steps.sort((a, b) => a.step_order - b.step_order);
    });

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleCreateSequence = async () => {
        if (!newSeqCategory) {
            showError("Selecione uma categoria.");
            return;
        }
        // Just expands the group basically, or "initializes" visually?
        // Actually, if no rule exists, we just need to add the first step.
        // We can just open the "Add Step" UI for this new virtual group.

        const key = getGroupKey(parseInt(newSeqCategory), newSeqAction);
        if (groupedWorkflows[key]) {
            showError("Já existe uma configuração para esta categoria e ação. Adicione passos nela.");
            return;
        }

        // Temporarily open the group? Or just directly add?
        // Since the group doesn't exist in `workflows` yet, we can't "expand" it.
        // We should just allow adding the first step.
        setAddingToGroup(key);
        setNewSeqCategory('');
        setIsAddingSequence(false);
    };

    const handleAddStep = async (catId: number, action: string) => {
        if (stepType === 'USER' && !addStepUserId) {
            showError("Selecione um usuário.");
            return;
        }
        if (stepType === 'GROUP' && !addStepGroupId) {
            showError("Selecione um grupo.");
            return;
        }

        try {
            const payload: any = {
                category_id: catId,
                action_type: action,
                required_role: null,
                required_user_id: stepType === 'USER' ? parseInt(addStepUserId) : null,
                required_group_id: stepType === 'GROUP' ? parseInt(addStepGroupId) : null
            };
            await api.post('/approval-workflows/', payload);
            showSuccess("Passo adicionado!");
            setAddStepUserId('');
            setAddStepGroupId('');
            setAddingToGroup(null);

            // Auto expand the group
            const key = getGroupKey(catId, action);
            if (!expandedGroups.includes(key)) {
                setExpandedGroups(prev => [...prev, key]);
            }

            fetchData();
        } catch (error) {
            console.error("Error adding step", error);
            showError("Erro ao adicionar passo.");
        }
    };

    const handleUpdateStep = async (wf: ApprovalWorkflow) => {
         try {
             const payload: any = {};
             if (stepType === 'USER') {
                 if (!editUserId) return showError("Selecione um usuário");
                 payload.required_user_id = parseInt(editUserId);
                 payload.required_group_id = null; // Clear group
             } else {
                 if (!editGroupId) return showError("Selecione um grupo");
                 payload.required_group_id = parseInt(editGroupId);
                 payload.required_user_id = null; // Clear user
             }

             await api.put(`/approval-workflows/${wf.id}`, payload);
             showSuccess("Passo atualizado!");
             setEditingStepId(null);
             setEditUserId('');
             setEditGroupId('');
             fetchData();
         } catch (error) {
             console.error("Error updating step", error);
             showError("Erro ao atualizar passo.");
         }
    };

    const handleMoveStep = async (groupKey: string, index: number, direction: 'up' | 'down') => {
        const group = groupedWorkflows[groupKey];
        if (!group) return;

        const steps = [...group.steps];
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === steps.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap locally for calculating new orders
        const temp = steps[index];
        steps[index] = steps[targetIndex];
        steps[targetIndex] = temp;

        // Prepare payload: reassign step_orders based on new index + 1
        const updates = steps.map((s, idx) => ({
            id: s.id,
            step_order: idx + 1
        }));

        try {
            await api.put('/approval-workflows/reorder', updates);
            // Optimistic update or just fetch
            fetchData();
        } catch (error) {
            console.error("Error reordering", error);
            showError("Erro ao reordenar passos.");
        }
    };

    const handleDeleteStep = (id: number) => {
        showConfirm("Tem certeza que deseja remover este passo?", async () => {
            try {
                await api.delete(`/approval-workflows/${id}`);
                showSuccess("Passo removido.");
                fetchData();
            } catch (error) {
                console.error("Error deleting workflow", error);
                showError("Erro ao remover passo.");
            }
        });
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
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex justify-between items-center bg-white/80 backdrop-blur-md dark:bg-slate-800/80 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <ShieldCheck className="text-indigo-600 dark:text-indigo-400" />
                        Malha de Aprovação
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Defina a sequência de aprovadores por categoria.</p>
                </div>
                <button
                    onClick={() => setIsAddingSequence(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                    <Plus size={18} /> Nova Sequência
                </button>
            </div>

            {/* New Sequence Modal/Card */}
            {isAddingSequence && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 animate-slide-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Configurar Nova Sequência</h3>
                        <button onClick={() => setIsAddingSequence(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                            <select
                                value={newSeqCategory}
                                onChange={e => setNewSeqCategory(e.target.value)}
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
                                value={newSeqAction}
                                onChange={e => setNewSeqAction(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="CREATE">Novos Itens</option>
                                <option value="TRANSFER">Transferência</option>
                                <option value="WRITE_OFF">Baixa</option>
                            </select>
                        </div>
                        <button
                            onClick={handleCreateSequence}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Iniciar
                        </button>
                    </div>
                </div>
            )}

            {/* Temporary Add Step UI for new groups */}
            {addingToGroup && !groupedWorkflows[addingToGroup] && (
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 border-l-4 border-l-green-500">
                    <h3 className="text-md font-semibold text-slate-800 dark:text-white mb-3">
                        Adicionando 1º Aprovador: {categories.find(c => c.id === parseInt(addingToGroup.split('-')[0]))?.name} - {translateAction(addingToGroup.split('-')[1])}
                    </h3>
                    <div className="flex gap-3 items-center">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStepType('USER')}
                                className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${stepType === 'USER' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                            >
                                Usuário
                            </button>
                            <button
                                onClick={() => setStepType('GROUP')}
                                className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${stepType === 'GROUP' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                            >
                                Grupo
                            </button>
                        </div>

                         {stepType === 'USER' ? (
                             <select
                                value={addStepUserId}
                                onChange={e => setAddStepUserId(e.target.value)}
                                className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                             >
                                <option value="">Selecione o Aprovador...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                ))}
                             </select>
                         ) : (
                             <select
                                value={addStepGroupId}
                                onChange={e => setAddStepGroupId(e.target.value)}
                                className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                             >
                                <option value="">Selecione o Grupo...</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                             </select>
                         )}

                         <button
                            onClick={() => handleAddStep(parseInt(addingToGroup.split('-')[0]), addingToGroup.split('-')[1])}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                         >
                            <Save size={16} /> Salvar
                         </button>
                         <button onClick={() => setAddingToGroup(null)} className="text-slate-500 hover:text-slate-700 px-3">Cancelar</button>
                    </div>
                 </div>
            )}

            {/* Grouped Lists */}
            <div className="grid gap-6">
                {Object.entries(groupedWorkflows).map(([key, group]) => (
                    <div key={key} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                        {/* Group Header */}
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            onClick={() => toggleGroup(key)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${expandedGroups.includes(key) ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {expandedGroups.includes(key) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-800 dark:text-white">
                                        {group.category_name}
                                    </h3>
                                    <p className="text-sm text-slate-500 flex items-center gap-2">
                                        <Layers size={14} />
                                        {translateAction(group.action_type)}
                                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300">
                                            {group.steps.length} etapas
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Steps List */}
                        {expandedGroups.includes(key) && (
                            <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3">
                                {group.steps.map((step, index) => (
                                    <div key={step.id} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative">
                                        {/* Step Number Badge */}
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                            {index + 1}
                                        </div>

                                        {/* User Info / Edit Mode */}
                                        <div className="flex-1">
                                            {editingStepId === step.id ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setStepType('USER')} className={`px-2 py-1 text-xs rounded ${stepType === 'USER' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100'}`}>Usuário</button>
                                                        <button onClick={() => setStepType('GROUP')} className={`px-2 py-1 text-xs rounded ${stepType === 'GROUP' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100'}`}>Grupo</button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {stepType === 'USER' ? (
                                                            <select
                                                                value={editUserId}
                                                                onChange={e => setEditUserId(e.target.value)}
                                                                className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                                            >
                                                                <option value="">Selecione Usuário...</option>
                                                                {users.map(u => (
                                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <select
                                                                value={editGroupId}
                                                                onChange={e => setEditGroupId(e.target.value)}
                                                                className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                                            >
                                                                <option value="">Selecione Grupo...</option>
                                                                {groups.map(g => (
                                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                        <button onClick={() => handleUpdateStep(step)} className="text-green-600 p-2 hover:bg-green-50 rounded"><Save size={18}/></button>
                                                        <button onClick={() => setEditingStepId(null)} className="text-slate-400 p-2 hover:bg-slate-100 rounded"><X size={18}/></button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {step.required_group_id ? (
                                                        <>
                                                            <UsersIcon size={16} className="text-purple-500" />
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                                                {/* Frontend might not have group name if not populated in list, but schema fix handles it via required_group object */}
                                                                {(step as any).required_group?.name || 'Grupo Desconhecido'}
                                                            </span>
                                                            <span className="text-xs text-purple-400 bg-purple-50 px-1.5 py-0.5 rounded">Grupo</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <User size={16} className="text-slate-400" />
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                                                {step.required_user?.name || 'Usuário Desconhecido'}
                                                            </span>
                                                            <span className="text-xs text-slate-400">({step.required_user?.email})</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        {!editingStepId && (
                                            <div className="flex items-center gap-1">
                                                <div className="flex flex-col mr-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleMoveStep(key, index, 'up'); }}
                                                        disabled={index === 0}
                                                        className={`p-0.5 rounded hover:bg-slate-100 ${index === 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600'}`}
                                                    >
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleMoveStep(key, index, 'down'); }}
                                                        disabled={index === group.steps.length - 1}
                                                        className={`p-0.5 rounded hover:bg-slate-100 ${index === group.steps.length - 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600'}`}
                                                    >
                                                        <ArrowDown size={14} />
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setEditingStepId(step.id);
                                                        if (step.required_group_id) {
                                                            setStepType('GROUP');
                                                            setEditGroupId(step.required_group_id.toString());
                                                        } else {
                                                            setStepType('USER');
                                                            setEditUserId(step.required_user_id?.toString() || '');
                                                        }
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Editar Aprovador"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteStep(step.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remover Passo"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Add Step Button for this Group */}
                                {addingToGroup === key ? (
                                     <div className="flex flex-col gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-200 border-dashed">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm">
                                                {group.steps.length + 1}
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setStepType('USER')}
                                                    className={`px-3 py-1 text-xs rounded-full border ${stepType === 'USER' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                                                >
                                                    Usuário
                                                </button>
                                                <button
                                                    onClick={() => setStepType('GROUP')}
                                                    className={`px-3 py-1 text-xs rounded-full border ${stepType === 'GROUP' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200'}`}
                                                >
                                                    Grupo
                                                </button>
                                            </div>

                                            {stepType === 'USER' ? (
                                                <select
                                                    value={addStepUserId}
                                                    onChange={e => setAddStepUserId(e.target.value)}
                                                    className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                                >
                                                    <option value="">Selecione o Usuário...</option>
                                                    {users.map(u => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <select
                                                    value={addStepGroupId}
                                                    onChange={e => setAddStepGroupId(e.target.value)}
                                                    className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                                >
                                                    <option value="">Selecione o Grupo...</option>
                                                    {groups.map(g => (
                                                        <option key={g.id} value={g.id}>{g.name}</option>
                                                    ))}
                                                </select>
                                            )}

                                            <button onClick={() => handleAddStep(group.category_id, group.action_type)} className="bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700"><Save size={18}/></button>
                                            <button onClick={() => setAddingToGroup(null)} className="text-slate-400 p-2 hover:bg-slate-100 rounded"><X size={18}/></button>
                                        </div>
                                     </div>
                                ) : (
                                    <button
                                        onClick={() => setAddingToGroup(key)}
                                        className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 transition-colors"
                                    >
                                        <Plus size={16} /> Adicionar Próxima Etapa
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {Object.keys(groupedWorkflows).length === 0 && !isAddingSequence && !addingToGroup && (
                    <div className="text-center py-16">
                        <div className="bg-slate-50 dark:bg-slate-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Layers size={32} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Nenhuma sequência definida</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-6">Comece criando uma sequência de aprovação para uma categoria.</p>
                        <button
                            onClick={() => setIsAddingSequence(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-indigo-500/20"
                        >
                            Criar Sequência
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApprovalWorkflows;
