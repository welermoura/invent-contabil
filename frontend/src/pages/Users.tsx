import React, { useEffect, useState } from 'react';
import api from '../api';
import { useForm } from 'react-hook-form';
// import { useAuth } from '../AuthContext';

const Users: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const { register, handleSubmit, reset } = useForm();
    // const { user } = useAuth(); // Logged in user info
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);

    const fetchUsers = async (search?: string) => {
        try {
            const params: any = {};
            if (search) params.search = search;
            const response = await api.get('/users/', { params });
            setUsers(response.data);
        } catch (error) {
            console.error("Erro ao carregar usuários", error);
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

    useEffect(() => {
        fetchUsers();
        fetchBranches();
    }, []);

    const onSubmit = async (data: any) => {
        try {
            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, data);
            } else {
                await api.post('/users/', data);
            }
            reset();
            setShowForm(false);
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            console.error("Erro ao salvar usuário", error);
            alert("Erro ao salvar usuário.");
        }
    };

    const handleDelete = async (userId: number) => {
        if (!window.confirm("Tem certeza que deseja remover este usuário?")) return;
        try {
            await api.delete(`/users/${userId}`);
            fetchUsers();
        } catch (error) {
            console.error("Erro ao remover usuário", error);
            alert("Erro ao remover usuário.");
        }
    };

    const handleEdit = (u: any) => {
        setEditingUser(u);
        setShowForm(true);
        // Pre-fill needs setValue from hook form or simple reset with values
        // For simplicity here, assume user types again or we improve this later
        // Ideally: reset(u); but password handling is tricky (don't show hashed)
    };

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">Gestão de Usuários</h1>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Buscar Usuário (Nome/Email)..."
                        className="border rounded px-3 py-2 flex-grow md:w-64 w-full"
                        onChange={(e) => fetchUsers(e.target.value)}
                    />
                    <button
                        onClick={() => { setShowForm(!showForm); setEditingUser(null); reset({}); }}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 whitespace-nowrap"
                    >
                        {showForm ? 'Cancelar' : 'Novo Usuário'}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-8">
                    <h2 className="text-xl font-bold mb-4">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700">Nome</label>
                            <input {...register('name')} defaultValue={editingUser?.name} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Email</label>
                            <input {...register('email')} defaultValue={editingUser?.email} disabled={!!editingUser} className="w-full border rounded px-3 py-2 disabled:bg-gray-200" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Senha {editingUser && '(Deixe em branco para não alterar)'}</label>
                            <input type="password" {...register('password', { required: !editingUser })} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-gray-700">Função</label>
                            <select {...register('role')} defaultValue={editingUser?.role || 'OPERATOR'} className="w-full border rounded px-3 py-2">
                                <option value="ADMIN">Administrador</option>
                                <option value="APPROVER">Aprovador</option>
                                <option value="OPERATOR">Operador</option>
                                <option value="AUDITOR">Auditor</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-700">Filiais (Permissão) - Segure Ctrl para selecionar múltiplas</label>
                            <select
                                {...register('branch_ids')}
                                multiple
                                defaultValue={editingUser?.branches ? editingUser.branches.map((b: any) => b.id) : (editingUser?.branch_id ? [editingUser.branch_id] : [])}
                                className="w-full border rounded px-3 py-2 h-32"
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Salvar</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded shadow overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-6 py-3 text-left">Nome</th>
                            <th className="px-6 py-3 text-left">Email</th>
                            <th className="px-6 py-3 text-left">Função</th>
                            <th className="px-6 py-3 text-left">Filial</th>
                            <th className="px-6 py-3 text-left">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-t">
                                <td className="px-6 py-4">{u.name}</td>
                                <td className="px-6 py-4">{u.email}</td>
                                <td className="px-6 py-4">{u.role}</td>
                                <td className="px-6 py-4">
                                    {u.branches && u.branches.length > 0
                                        ? u.branches.map((b: any) => b.name).join(', ')
                                        : (branches.find(b => b.id === u.branch_id)?.name || 'Global')
                                    }
                                </td>
                                <td className="px-6 py-4 flex gap-4">
                                    <button onClick={() => handleEdit(u)} className="text-blue-600 hover:text-blue-800">Editar</button>
                                    <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-800">Remover</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Users;
