import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api';
import { useError } from '../hooks/useError';
import { Settings, Save, Upload, Image as ImageIcon, Type } from 'lucide-react';

const SystemSettings: React.FC = () => {
    const { register, handleSubmit, setValue } = useForm();
    const { showSuccess, showError } = useError();
    const [loading, setLoading] = useState(false);
    const [currentFavicon, setCurrentFavicon] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const response = await api.get('/settings/');
            const settings = response.data;
            if (settings.app_title) setValue('app_title', settings.app_title);
            if (settings.favicon_url) setCurrentFavicon(settings.favicon_url);
        } catch (error) {
            console.error("Erro ao carregar configurações", error);
        }
    };

    const onSubmit = async (data: any) => {
        setLoading(true);
        try {
            await api.put('/settings/', { app_title: data.app_title });

            if (data.favicon_file && data.favicon_file[0]) {
                const formData = new FormData();
                formData.append('file', data.favicon_file[0]);
                await api.post('/settings/favicon', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            showSuccess("Configurações atualizadas com sucesso! Atualize a página para ver as mudanças.");
            loadSettings();

            // Update immediately if possible
            if (data.app_title) document.title = data.app_title;
            // Favicon update requires re-fetch or knowing the URL, but loadSettings handles it on next page load usually.
            // But we can trigger a reload or just let the user refresh.

        } catch (error) {
            console.error("Erro ao salvar", error);
            showError(error, "SETTINGS_SAVE_ERROR");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="text-slate-600" />
                    Configurações do Sistema
                </h1>
                <p className="text-slate-500 mt-1">Personalize a aparência da aplicação.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Type className="w-4 h-4 text-slate-400" />
                            Nome da Aplicação (Título da Aba)
                        </label>
                        <input
                            {...register('app_title')}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="Ex: Sistema de Inventário"
                        />
                        <p className="text-xs text-slate-500">Este texto aparecerá na aba do navegador.</p>
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
                        <p className="text-xs text-slate-500">Recomendado: .ico ou .png, 32x32px ou 16x16px.</p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-all disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : <><Save size={18} /> Salvar Alterações</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default SystemSettings;
