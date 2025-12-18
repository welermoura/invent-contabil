import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useError } from '../hooks/useError';
import { User, Lock, Save, Loader2 } from 'lucide-react';
import { translateRole } from '../utils/translations';

const Profile: React.FC = () => {
    const { user } = useAuth();
    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
    const { showSuccess, showError } = useError();
    const [isLoading, setIsLoading] = useState(false);

    const onChangePassword = async (data: any) => {
        setIsLoading(true);
        try {
            await api.post('/users/me/change-password', {
                current_password: data.currentPassword,
                new_password: data.newPassword
            });
            showSuccess('Senha alterada com sucesso!');
            reset();
        } catch (error) {
            showError(error, 'PASSWORD_CHANGE_ERROR');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <User className="text-slate-600" />
                    Meu Perfil
                </h1>
                <p className="text-slate-500 mt-1">Gerencie suas informações e senha.</p>
            </div>

            <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* User Info Card */}
                <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 p-6 h-fit">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <User className="text-blue-600" size={20} />
                        Informações
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</label>
                            <div className="text-slate-800 font-medium text-lg">{user.name || 'N/A'}</div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">E-mail</label>
                            <div className="text-slate-800 font-medium">{user.email}</div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Função</label>
                            <div className="mt-1">
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                                    {translateRole(user.role)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Change Password Card */}
                <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Lock className="text-blue-600" size={20} />
                        Alterar Senha
                    </h2>

                    <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Senha Atual</label>
                            <input
                                type="password"
                                {...register('currentPassword', { required: 'Senha atual é obrigatória' })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="••••••••"
                            />
                            {errors.currentPassword && <span className="text-red-500 text-xs">{errors.currentPassword.message as string}</span>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Nova Senha</label>
                            <input
                                type="password"
                                {...register('newPassword', {
                                    required: 'Nova senha é obrigatória',
                                    minLength: { value: 6, message: 'Mínimo de 6 caracteres' }
                                })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="••••••••"
                            />
                            {errors.newPassword && <span className="text-red-500 text-xs">{errors.newPassword.message as string}</span>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Confirmar Nova Senha</label>
                            <input
                                type="password"
                                {...register('confirmPassword', {
                                    required: 'Confirmação é obrigatória',
                                    validate: (val: string) => {
                                        if (watch('newPassword') != val) {
                                            return "As senhas não coincidem";
                                        }
                                    }
                                })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="••••••••"
                            />
                            {errors.confirmPassword && <span className="text-red-500 text-xs">{errors.confirmPassword.message as string}</span>}
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> Salvar Nova Senha</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
