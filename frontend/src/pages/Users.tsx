
import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
import { useError } from '../hooks/useError';
import { translateRole } from '../utils/translations';
import {
    Users as UsersIcon,
    Search,
    Plus,
    Edit2,
    X,
    Save,
    Trash2,
    Shield,
    User,
    UserCheck,
    Eye,
    Key,
    Building2
} from 'lucide-react';

const Users: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const { register, handleSubmit, reset, watch, setValue } = useForm();
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const { showError, showSuccess, showConfirm } = useError();

    const fetchUsers = async (search?: string) => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/users/', { params });
            setUsers(response.data);
        } catch (error) {
            console.error("Erro ao carregar usuários", error);
            showError("Erro ao carregar lista de usuários.");
        } finally {
            setLoading(false);
        }
    };

    const fetchBranches = async () => {
        try {
            const response = await api.get('/branches/');
            setBranches(response.data);
        } catch (error) {
            console.error("Erro ao carregar filiais", error);
        }
    };

    const fetchGroups = async () => {
        try {
            const response = await api.get('/groups/');
            setGroups(response.data);
        } catch (error) {
            console.error("Erro ao carregar grupos", error);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchBranches();
        fetchGroups();
    }, []);

    const onSubmit = async (data: any) => {
        // Validation: Operator cannot have all_branches
        if (data.role === 'OPERATOR' && data.all_branches) {
            showError("Operadores não podem ter acesso a todas as filiais. Selecione filiais específicas.");
            return;
        }

        // Validation: At least one branch or 'all_branches' must be selected
        if (!data.all_branches && (!data.branch_ids || data.branch_ids.length === 0)) {
            showError("BRANCH_REQUIRED");
            return;
        }

        // Sanitize group_id: convert empty string to null for backend validation
        const payload = {
            ...data,
            group_id: data.group_id === "" ? null : Number(data.group_id)
        };

        try {
            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, payload);
                showSuccess("Usuário atualizado com sucesso.");
            } else {
                await api.post('/users/', payload);
                showSuccess("Usuário cadastrado com sucesso.");
            }
            reset();
            setShowForm(false);
            setEditingUser(null);
            fetchUsers();
        } catch (error: any) {
            console.error("Erro ao salvar usuário", error);
            showError(error, "USER_SAVE_ERROR");
        }
    };

    const handleDelete = async (userId: number) => {
        showConfirm("Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.", async () => {
            try {
                await api.delete(`/users/${userId}`);
                showSuccess("Usuário removido com sucesso.");
                fetchUsers();
            } catch (error) {
                console.error("Erro ao remover usuário", error);
                showError(error, "USER_DELETE_ERROR");
            }
        }, "Remover Usuário");
    };

    const handleEdit = (u: any) => {
        setEditingUser(u);
        setShowForm(true);
        // Ensure reset happens in the next tick to guarantee form is mounted
        setTimeout(() => {
            reset({
                 name: u.name,
                 email: u.email,
                 role: u.role,
                 all_branches: u.all_branches || false,
                 can_import: u.can_import || false,
                 branch_ids: u.branches ? u.branches.map((b: any) => b.id) : (u.branch_id ? [u.branch_id] : []),
                 group_id: u.group_id ? String(u.group_id) : ''
            });
        }, 0);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingUser(null);
        reset();
    };

    const getRoleBadge = (role: string) => {
        const translated = translateRole(role).toUpperCase();
        switch (role) {
            case 'ADMIN': return <span className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold"><Shield className="w-3 h-3" /> {translated}</span>;
            case 'APPROVER': return <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold"><UserCheck className="w-3 h-3" /> {translated}</span>;
            case 'REVIEWER': return <span className="flex items-center gap-1 bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs font-bold"><UserCheck className="w-3 h-3" /> {translated}</span>;
            case 'AUDITOR': return <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-bold"><Eye className="w-3 h-3" /> {translated}</span>;
            default: return <span className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-bold"><User className="w-3 h-3" /> {translated}</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <UsersIcon className="w-8 h-8 text-indigo-600" />
                        Gestão de Usuários
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Controle de acesso, funções e permissões de filiais.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar Usuário..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                            onChange={(e) => fetchUsers(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => {
                            if (showForm) handleCancel();
                            else { setShowForm(true); setEditingUser(null); reset({}); }
                        }}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm transition-all ${
                            showForm
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
                        }`}
                    >
                        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showForm ? 'Cancelar' : 'Novo Usuário'}
                    </button>
                </div>
            </div>

            {/* Form Section */}
            {showForm && (
                <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-md border border-gray-200/50 p-6 animate-in slide-in-from-top-4 duration-300">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200/50 pb-2">
                        {editingUser ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                        {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                    </h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" /> Nome
                            </label>
                            <input {...register('name')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" placeholder="Nome completo" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <UsersIcon className="w-4 h-4 text-gray-400" /> Email
                            </label>
                            <input {...register('email')} disabled={!!editingUser} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:bg-gray-100 disabled:text-gray-500" placeholder="email@empresa.com" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Key className="w-4 h-4 text-gray-400" /> Senha {editingUser && <span className="text-xs text-gray-400 font-normal">(Deixe em branco para manter)</span>}
                            </label>
                            <input type="password" {...register('password', { required: !editingUser })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" placeholder="******" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-gray-400" /> Função
                            </label>
                            <div className="space-y-2">
                                <select
                                    {...register('role')}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                                    onChange={(e) => {
                                        register('role').onChange(e);
                                        if (e.target.value === 'OPERATOR') {
                                            setValue('all_branches', false);
                                            setValue('group_id', "");
                                        }
                                    }}
                                >
                                    <option value="OPERATOR">Operador (Básico)</option>
                                    <option value="APPROVER">Aprovador (Gestor)</option>
                                    <option value="REVIEWER">Revisor (Avançado)</option>
                                    <option value="AUDITOR">Auditor (Leitura)</option>
                                    <option value="ADMIN">Administrador (Total)</option>
                                </select>
                                <div className="flex items-center gap-2 pl-1">
                                    <input
                                        type="checkbox"
                                        id="can_import"
                                        {...register('can_import')}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <label htmlFor="can_import" className="text-sm text-gray-600 cursor-pointer select-none">Pode Importar Itens</label>
                                </div>
                            </div>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" /> Filiais (Permissão)</div>
                                {watch('role') !== 'OPERATOR' && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="all_branches"
                                            {...register('all_branches')}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            // Force re-render of select below when this changes
                                            onChange={(e) => {
                                                register('all_branches').onChange(e);
                                            }}
                                        />
                                        <label htmlFor="all_branches" className="text-sm text-gray-600 cursor-pointer select-none">Todas as filiais (Acesso Total)</label>
                                    </div>
                                )}
                            </label>
                            <select
                                {...register('branch_ids')}
                                multiple
                                disabled={!!watch('all_branches')}
                                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all h-32 bg-white ${watch('all_branches') ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            {watch('all_branches') && <p className="text-xs text-indigo-600 font-medium mt-1">✓ Usuário terá acesso a todas as filiais atuais e futuras.</p>}
                            {watch('role') === 'OPERATOR' && (
                                <div className="mt-1 flex flex-col gap-1">
                                    <p className="text-xs text-amber-600 font-medium">⚠️ Operadores devem ter filiais específicas atribuídas.</p>
                                    <p className="text-xs text-gray-500 italic">Dica: Segure a tecla <strong>CTRL</strong> (ou Command) para selecionar mais de uma filial.</p>
                                </div>
                            )}
                        </div>
                        {watch('role') !== 'OPERATOR' && (
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 justify-between">
                                    <div className="flex items-center gap-2">
                                        <UsersIcon className="w-4 h-4 text-gray-400" /> Grupo de Usuários
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { window.open('/users/groups', '_blank'); }}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        + Gerenciar Grupos
                                    </button>
                                </label>
                                <select
                                    {...register('group_id')}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                                >
                                    <option value="">Nenhum Grupo</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500">O usuário pode pertencer a apenas um grupo.</p>
                            </div>
                        )}
                        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                            >
                                <Save className="w-4 h-4" />
                                Salvar Usuário
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List Section */}
            <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200/50">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome / Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Função</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filiais</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                            <span>Carregando dados...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Search className="w-8 h-8 text-gray-300" />
                                            <span>Nenhum usuário encontrado.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{u.name}</span>
                                                <span className="text-xs text-gray-500">{u.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getRoleBadge(u.role)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-600 max-w-xs truncate" title={u.branches?.map((b: any) => b.name).join(', ')}>
                                                {u.branches && u.branches.length > 0
                                                    ? u.branches.map((b: any) => b.name).join(', ')
                                                    : (branches.find(b => b.id === u.branch_id)?.name || <span className="text-gray-400 italic">Global / Todas</span>)
                                                }
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(u)}
                                                    className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(u.id)}
                                                    className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                                    title="Remover"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
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

export default Users;
