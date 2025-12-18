
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { Package, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

const Login: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await api.get('/setup-status', { timeout: 3000 });
                if (!response.data.is_setup) {
                    navigate('/setup');
                }
            } catch (error) {
                console.log("Check status failed");
            }
        };
        checkStatus();
    }, [navigate]);

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('username', data.email);
            formData.append('password', data.password);

            const response = await api.post('/token', formData);
            login(response.data.access_token);
            navigate('/');
        } catch (err: any) {
            if (!err.response) {
                setError('Erro de conexão. Verifique o servidor.');
            } else if (err.response.status === 401) {
                setError('E-mail ou senha incorretos.');
            } else {
                setError('Ocorreu um erro ao entrar.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-transparent relative overflow-hidden font-sans">
            <div className="bg-white/80 backdrop-blur-md p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md z-10 border border-white/40">
                <div className="text-center mb-8">
                    {settings.logo_url ? (
                        <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                            <img
                                src={`${api.defaults.baseURL}/${settings.logo_url}`}
                                alt="Logo"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                            <Package className="text-white" size={24} />
                        </div>
                    )}
                    <h2 className="text-2xl font-bold text-slate-800">Bem-vindo</h2>
                    <p className="text-slate-500 text-sm mt-1">Acesse sua conta para continuar</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2 animate-fade-in">
                        <span className="block w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">E-mail</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                            <input
                                {...register('email', { required: true })}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                placeholder="seu@email.com"
                            />
                        </div>
                        {errors.email && <span className="text-red-500 text-xs ml-1">Campo obrigatório</span>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                            <input
                                type="password"
                                {...register('password', { required: true })}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                placeholder="••••••••"
                            />
                        </div>
                        {errors.password && <span className="text-red-500 text-xs ml-1">Campo obrigatório</span>}
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
                                Entrar
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
