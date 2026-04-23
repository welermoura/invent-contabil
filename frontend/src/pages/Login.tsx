
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, ArrowRight, Box, ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Forgot Password State
    const [isForgotOpen, setIsForgotOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMessage, setForgotMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Prioridade para a cor sólida escolhida pelo usuário (theme_background_color), 
    // depois a cor extraída do tema (theme_primary_color), depois azul padrão.
    const primaryColor = settings.theme_background_color || settings.theme_primary_color || '#2563eb';

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

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail) return;

        setForgotLoading(true);
        setForgotMessage(null);

        try {
            await api.post('/forgot-password', { email: forgotEmail });
            setForgotMessage({ type: 'success', text: 'Se o e-mail estiver cadastrado, você receberá um link em instantes.' });
            setTimeout(() => {
                setIsForgotOpen(false);
                setForgotMessage(null);
                setForgotEmail('');
            }, 3000);
        } catch (err) {
            setForgotMessage({ type: 'error', text: 'Erro ao solicitar recuperação. Tente novamente.' });
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-sans">

            {/* Forgot Password Modal */}
            {isForgotOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6 border border-white/20">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Recuperar Senha</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                            Digite seu e-mail para receber um link de redefinição de senha.
                        </p>
                        {forgotMessage && (
                            <div className={`p-3 rounded-lg text-sm mb-4 ${forgotMessage.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {forgotMessage.text}
                            </div>
                        )}
                        <form onSubmit={handleForgotPassword}>
                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">E-mail</label>
                                <input
                                    type="email"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:border-blue-500"
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsForgotOpen(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={forgotLoading}
                                    style={{ backgroundColor: primaryColor }}
                                    className="px-4 py-2 text-white rounded-lg font-medium text-sm flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
                                    {forgotLoading && <Loader2 className="animate-spin" size={14} />}
                                    Enviar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── PAINEL ESQUERDO (cor da configuração) ─── */}
            <div
                className="hidden lg:flex lg:w-[42%] relative flex-col items-center justify-center p-12 overflow-hidden"
                style={{ backgroundColor: primaryColor }}
            >
                {/* Círculos decorativos */}
                <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full pointer-events-none" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
                <div className="absolute -bottom-36 -right-20 w-96 h-96 rounded-full pointer-events-none" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

                <div className="relative z-10 text-center max-w-xs w-full">

                    {/* Logo SEM moldura */}
                    <div className="mb-6 flex justify-center">
                        {settings.logo_url ? (
                            <img
                                src={`${api.defaults.baseURL}/${settings.logo_url}`}
                                alt="Logo"
                                className="h-24 w-auto object-contain"
                            />
                        ) : (
                            <Box className="text-white" size={60} strokeWidth={1.5} />
                        )}
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">
                        {settings.app_title || 'Inventário'}
                    </h1>
                    <p className="text-white/80 text-sm leading-relaxed">
                        Gestão completa do seu patrimônio em um só lugar
                    </p>

                    {/* Card de feature */}
                    <div className="mt-10 rounded-2xl p-5 text-left" style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                <ShieldCheck className="text-white" size={15} />
                            </div>
                            <span className="text-white font-semibold text-sm">Controle total</span>
                        </div>
                        <p className="text-white/70 text-xs leading-relaxed">
                            Inventário, filiais, fornecedores e relatórios centralizados com segurança e rastreabilidade.
                        </p>
                    </div>
                </div>
            </div>

            {/* ─── PAINEL DIREITO (formulário) ─── */}
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-8 relative overflow-hidden">
                {/* Círculo decorativo sutil */}
                <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none opacity-50" style={{ backgroundColor: primaryColor + '20' }} />
                <div className="absolute -bottom-24 right-8 w-56 h-56 rounded-full pointer-events-none opacity-30" style={{ backgroundColor: primaryColor + '18' }} />

                <div className="w-full max-w-sm relative z-10">
                    {/* Logo mobile */}
                    <div className="lg:hidden text-center mb-8">
                        {settings.logo_url ? (
                            <img src={`${api.defaults.baseURL}/${settings.logo_url}`} alt="Logo" className="h-16 w-auto mx-auto mb-3 object-contain" />
                        ) : (
                            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                                <Box className="text-white" size={26} />
                            </div>
                        )}
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">{settings.app_title || 'Inventário'}</h1>
                    </div>

                    {/* Card do formulário */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-700/50 p-10">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Bem-vindo</h2>
                            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Acesse sua conta para continuar</p>
                        </div>

                        {error && (
                            <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                                <span className="block w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"></span>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            {/* Email */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] ml-1">E-MAIL</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-3.5 text-slate-300 dark:text-slate-600" size={18} />
                                    <input
                                        {...register('email', { required: true })}
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-sm"
                                        style={{ borderColor: errors.email ? '#ef4444' : undefined }}
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                {errors.email && <span className="text-red-500 text-[10px] ml-1">Campo obrigatório</span>}
                            </div>

                            {/* Senha */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] ml-1">SENHA</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-3.5 text-slate-300 dark:text-slate-600" size={18} />
                                    <input
                                        type="password"
                                        {...register('password', { required: true })}
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-sm"
                                        style={{ borderColor: errors.password ? '#ef4444' : undefined }}
                                        placeholder="••••••••"
                                    />
                                </div>
                                {errors.password && <span className="text-red-500 text-[10px] ml-1">Campo obrigatório</span>}
                            </div>

                            {/* Esqueci senha */}
                            <div className="flex justify-end -mt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsForgotOpen(true)}
                                    className="text-[11px] font-medium transition-colors text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                >
                                    Esqueci minha senha
                                </button>
                            </div>

                            {/* Botão entrar */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                style={{ backgroundColor: primaryColor }}
                                className="w-full text-white py-4 rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 opacity-95 hover:opacity-100 shadow-lg shadow-current/10 mt-2"
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        Entrar
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
