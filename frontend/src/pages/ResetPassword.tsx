import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { Lock, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

const ResetPassword: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const { register, handleSubmit, watch, formState: { errors } } = useForm();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const onSubmit = async (data: any) => {
        if (!token) {
            setError('Token inválido ou ausente.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await api.post('/reset-password', {
                token: token,
                new_password: data.password
            });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Erro ao redefinir senha.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
         return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 font-sans p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <div className="bg-red-100 text-red-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                         <Lock size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Link Inválido</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">O link de redefinição de senha é inválido ou expirou.</p>
                    <button onClick={() => navigate('/login')} className="text-blue-600 hover:text-blue-700 font-medium">
                        Voltar para Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 font-sans p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-md w-full border border-slate-200 dark:border-slate-700">
                <div className="text-center mb-8">
                    <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                        <Lock className="text-white" size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Redefinir Senha</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Digite sua nova senha abaixo.</p>
                </div>

                {success ? (
                    <div className="text-center py-8">
                        <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Senha Alterada!</h3>
                        <p className="text-slate-500 dark:text-slate-400">Sua senha foi atualizada com sucesso. Você será redirecionado para o login.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                         {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Nova Senha</label>
                            <input
                                type="password"
                                {...register('password', {
                                    required: 'Senha é obrigatória',
                                    minLength: { value: 6, message: 'Mínimo de 6 caracteres' }
                                })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                placeholder="••••••••"
                            />
                            {errors.password && <span className="text-red-500 text-xs ml-1">{errors.password.message as string}</span>}
                        </div>

                         <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Confirmar Senha</label>
                            <input
                                type="password"
                                {...register('confirmPassword', {
                                    required: 'Confirmação é obrigatória',
                                    validate: (val: string) => {
                                        if (watch('password') != val) {
                                            return "As senhas não coincidem";
                                        }
                                    }
                                })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                placeholder="••••••••"
                            />
                            {errors.confirmPassword && <span className="text-red-500 text-xs ml-1">{errors.confirmPassword.message as string}</span>}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    Redefinir Senha
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
