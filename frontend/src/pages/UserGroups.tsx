import React, { useEffect, useState } from 'react';
import api from '../api';
import { useError } from '../hooks/useError';
import { Plus, Edit2, Trash2, Users as UsersIcon, X, Save } from 'lucide-react';

interface UserGroup {
    id: number;
    name: string;
    description: string;
}

const UserGroups: React.FC = () => {
    const [groups, setGroups] = useState<UserGroup[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const { showError, showSuccess } = useError();

    const fetchGroups = async () => {
        try {
            const res = await api.get('/groups/');
            setGroups(res.data);
        } catch (error) {
            console.error("Error fetching groups", error);
            showError("Erro ao carregar grupos.");
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleSave = async () => {
        if (!formData.name) {
            showError("Nome é obrigatório.");
            return;
        }

        try {
            if (editingGroup) {
                await api.put(`/groups/${editingGroup.id}`, formData);
                showSuccess("Grupo atualizado com sucesso!");
            } else {
                await api.post('/groups/', formData);
                showSuccess("Grupo criado com sucesso!");
            }
            setIsModalOpen(false);
            fetchGroups();
        } catch (error) {
            console.error("Error saving group", error);
            showError("Erro ao salvar grupo.");
        }
    };

    const handleEdit = (group: UserGroup) => {
        setEditingGroup(group);
        setFormData({ name: group.name, description: group.description });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este grupo?")) return;
        try {
            await api.delete(`/groups/${id}`);
            showSuccess("Grupo excluído.");
            fetchGroups();
        } catch (error) {
            console.error("Error deleting group", error);
            showError("Erro ao excluir grupo.");
        }
    };

    const openModal = () => {
        setEditingGroup(null);
        setFormData({ name: '', description: '' });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-white/80 backdrop-blur-md dark:bg-slate-800/80 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <UsersIcon className="text-indigo-600 dark:text-indigo-400" />
                        Grupos de Usuários
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie grupos para facilitar a malha de aprovação.</p>
                </div>
                <button
                    onClick={openModal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                    <Plus size={18} /> Novo Grupo
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nome</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Descrição</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {groups.map(group => (
                            <tr key={group.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-white">{group.name}</td>
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{group.description}</td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button onClick={() => handleEdit(group)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(group.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {groups.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                                    Nenhum grupo encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="font-semibold text-lg text-slate-800 dark:text-white">
                                {editingGroup ? 'Editar Grupo' : 'Novo Grupo'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Grupo</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ex: Gerentes de TI"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                                    placeholder="Descrição opcional..."
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                            >
                                <Save size={16} /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserGroups;
