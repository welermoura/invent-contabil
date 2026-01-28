import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api';
import { useError } from '../hooks/useError';
import { Settings, Save, Image as ImageIcon, Type, Mail, Server, Shield, User, Key, Send, Workflow } from 'lucide-react';
import BackupMigration from '../components/BackupMigration';
import { useAuth } from '../AuthContext';

const SystemSettings: React.FC = () => {
    const { user } = useAuth();
    const { register, handleSubmit, setValue, getValues } = useForm();
    const { showSuccess, showError } = useError();
    const [loading, setLoading] = useState(false);
    const [testingSmtp, setTestingSmtp] = useState(false);
    const [currentFavicon, setCurrentFavicon] = useState<string | null>(null);
    const [currentLogo, setCurrentLogo] = useState<string | null>(null);
    const [currentBackground, setCurrentBackground] = useState<string | null>(null);
    const [groups, setGroups] = useState<any[]>([]);

    useEffect(() => {
        loadSettings();
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await api.get('/groups/');
            setGroups(response.data);
        } catch (error) {
            console.error("Erro ao carregar grupos", error);
        }
    };

    const loadSettings = async () => {
        try {
            const response = await api.get('/settings/');
            const settings = response.data;
            if (settings.app_title) setValue('app_title', settings.app_title);
            if (settings.favicon_url) setCurrentFavicon(settings.favicon_url);
            if (settings.logo_url) setCurrentLogo(settings.logo_url);
            if (settings.background_url) setCurrentBackground(settings.background_url);

            // SMTP Settings
            if (settings.smtp_host) setValue('smtp_host', settings.smtp_host);
            if (settings.smtp_port) setValue('smtp_port', settings.smtp_port);
            if (settings.smtp_username) setValue('smtp_username', settings.smtp_username);
            if (settings.smtp_password) setValue('smtp_password', settings.smtp_password);
            if (settings.smtp_from_email) setValue('smtp_from_email', settings.smtp_from_email);
            if (settings.smtp_security) setValue('smtp_security', settings.smtp_security);
            if (settings.workflow_fallback_group_id) setValue('workflow_fallback_group_id', settings.workflow_fallback_group_id);

        } catch (error) {
            console.error("Erro ao carregar configurações", error);
        }
    };

    const handleTestSmtp = async () => {
        const formData = getValues();
        if (!formData.smtp_test_recipient) {
            showError(new Error("Preencha o campo 'E-mail de Destinatário (Teste)' para realizar o teste."), "VALIDATION_ERROR");
            return;
        }

        setTestingSmtp(true);
        try {
            const config = {
                host: formData.smtp_host,
                port: Number(formData.smtp_port),
                username: formData.smtp_username,
                password: formData.smtp_password,
                from_email: formData.smtp_from_email,
                to_email: formData.smtp_test_recipient,
                security: formData.smtp_security || 'tls'
            };

            await api.post('/settings/smtp/test', config);
            showSuccess(`E-mail de teste enviado para ${formData.smtp_test_recipient}!`);
        } catch (error) {
            showError(error, "SMTP_TEST_ERROR");
        } finally {
            setTestingSmtp(false);
        }
    };

    const onSubmit = async (data: any) => {
        setLoading(true);
        try {
            const settingsPayload: any = {
                app_title: data.app_title,
                smtp_host: data.smtp_host,
                smtp_port: data.smtp_port,
                smtp_username: data.smtp_username,
                smtp_password: data.smtp_password,
                smtp_from_email: data.smtp_from_email,
                smtp_security: data.smtp_security,
                workflow_fallback_group_id: data.workflow_fallback_group_id
            };

            await api.put('/settings/', settingsPayload);

            if (data.favicon_file && data.favicon_file[0]) {
                const formData = new FormData();
                formData.append('file', data.favicon_file[0]);
                await api.post('/settings/favicon', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            if (data.logo_file && data.logo_file[0]) {
                const formData = new FormData();
                formData.append('file', data.logo_file[0]);
                await api.post('/settings/logo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            if (data.background_file && data.background_file[0]) {
                const formData = new FormData();
                formData.append('file', data.background_file[0]);
                await api.post('/settings/background', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            showSuccess("Configurações atualizadas com sucesso! Atualize a página para ver as mudanças.");
            loadSettings();

            if (data.app_title) document.title = data.app_title;

        } catch (error) {
            console.error("Erro ao salvar", error);
            showError(error, "SETTINGS_SAVE_ERROR");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100/50">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="text-slate-600" />
                    Configurações do Sistema
                </h1>
                <p className="text-slate-500 mt-1">Personalize a aparência e integrações da aplicação.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">

                {/* Aparência */}
                <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <ImageIcon className="text-blue-600" size={20} />
                        Aparência
                    </h2>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Type className="w-4 h-4 text-slate-400" />
                                Nome da Aplicação (Título da Aba)
                            </label>
                            <input
                                {...register('app_title')}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="Ex: Sistema de Inventário"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-slate-400" />
                                Ícone (Favicon)
                            </label>

                            <div className="flex items-center gap-4">
                                {currentFavicon && (
                                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50">
                                        <img
                                            src={`${api.defaults.baseURL}/${currentFavicon}`}
                                            alt="Favicon Atual"
                                            className="w-8 h-8 object-contain"
                                        />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        {...register('favicon_file')}
                                        accept=".ico,.png,.svg,.jpg"
                                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-slate-400" />
                                Logo da Empresa
                            </label>

                            <div className="flex items-center gap-4">
                                {currentLogo && (
                                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50">
                                        <img
                                            src={`${api.defaults.baseURL}/${currentLogo}`}
                                            alt="Logo Atual"
                                            className="w-8 h-8 object-contain"
                                        />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        {...register('logo_file')}
                                        accept=".png,.svg,.jpg,.jpeg,.webp"
                                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-slate-400" />
                                Imagem de Fundo (Login e Dashboard)
                            </label>

                            <div className="flex items-center gap-4">
                                {currentBackground && (
                                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50">
                                        <img
                                            src={`${api.defaults.baseURL}/${currentBackground}`}
                                            alt="Fundo Atual"
                                            className="w-16 h-9 object-cover rounded"
                                        />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        {...register('background_file')}
                                        accept=".jpg,.jpeg,.png,.webp,.bmp"
                                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">A imagem será otimizada automaticamente para carregamento rápido.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Workflow Config */}
                <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Workflow className="text-blue-600" size={20} />
                        Workflow & Aprovação
                    </h2>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-slate-400" />
                                Grupo de Fallback (Segurança)
                            </label>
                            <select
                                {...register('workflow_fallback_group_id')}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                            >
                                <option value="">Administradores (Padrão)</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500">
                                Este grupo receberá as solicitações caso não haja um fluxo de aprovação configurado para a categoria do item ou se ocorrer um erro na resolução dos aprovadores.
                            </p>
                        </div>
                    </div>
                </div>

                {/* SMTP Config */}
                <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Mail className="text-blue-600" size={20} />
                            Configuração de E-mail (SMTP)
                        </h2>
                        <button
                            type="button"
                            onClick={handleTestSmtp}
                            disabled={testingSmtp}
                            className="text-sm px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {testingSmtp ? 'Enviando...' : <><Send size={16} /> Testar Conexão</>}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Server className="w-4 h-4 text-slate-400" />
                                Host SMTP
                            </label>
                            <input
                                {...register('smtp_host')}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="Ex: smtp.gmail.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Server className="w-4 h-4 text-slate-400" />
                                Porta
                            </label>
                            <input
                                {...register('smtp_port')}
                                type="number"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="Ex: 587"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <User className="w-4 h-4 text-slate-400" />
                                Usuário
                            </label>
                            <input
                                {...register('smtp_username')}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="email@empresa.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Key className="w-4 h-4 text-slate-400" />
                                Senha
                            </label>
                            <input
                                {...register('smtp_password')}
                                type="password"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Mail className="w-4 h-4 text-slate-400" />
                                E-mail Remetente
                            </label>
                            <input
                                {...register('smtp_from_email')}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="noreply@empresa.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-slate-400" />
                                Segurança
                            </label>
                            <select
                                {...register('smtp_security')}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                defaultValue="tls"
                            >
                                <option value="tls">STARTTLS (Recomendado)</option>
                                <option value="ssl">SSL/TLS</option>
                                <option value="none">Nenhuma</option>
                            </select>
                        </div>

                        <div className="space-y-2 col-span-1 md:col-span-2 border-t pt-4 mt-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <Send className="w-4 h-4 text-indigo-500" />
                                E-mail de Destinatário (Teste)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    {...register('smtp_test_recipient')}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50"
                                    placeholder="email@teste.com"
                                />
                                <div className="text-xs text-slate-500 flex items-center">
                                    Use este campo para definir quem receberá o e-mail de teste.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : <><Save size={20} /> Salvar Tudo</>}
                    </button>
                </div>

            </form>

            {/* Seção de Backup e Migração (Apenas Admin) */}
            {user?.role === 'ADMIN' && (
                <BackupMigration />
            )}
        </div>
    );
};

export default SystemSettings;
