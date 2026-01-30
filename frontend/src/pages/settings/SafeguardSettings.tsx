import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../../api';
import { useError } from '../../hooks/useError';
import { Shield, Save, DollarSign } from 'lucide-react';

const SafeguardSettings: React.FC = () => {
    const { register, handleSubmit, setValue } = useForm();
    const { showSuccess, showError } = useError();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const response = await api.get('/settings/');
            const settings = response.data;
            if (settings.safeguard_threshold) setValue('safeguard_threshold', settings.safeguard_threshold);
        } catch (error) {
            console.error("Erro ao carregar configurações", error);
        }
    };

    const onSubmit = async (data: any) => {
        setLoading(true);
        try {
            const settingsPayload = {
                safeguard_threshold: data.safeguard_threshold
            };

            await api.put('/settings/', settingsPayload);
            showSuccess("Configurações de Salva Guarda atualizadas com sucesso!");
            loadSettings();
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
                    <Shield className="text-slate-600" />
                    Salva Guarda
                </h1>
                <p className="text-slate-500 mt-1">Configure o valor limite para a obrigatoriedade do Ativo Fixo.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
                <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <DollarSign className="text-blue-600" size={20} />
                        Limite de Valor
                    </h2>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 block">
                                Valor Limite (R$)
                            </label>
                            <p className="text-xs text-slate-500 mb-2">
                                Itens com valor de compra abaixo deste limite não exigirão o preenchimento do número de Ativo Fixo durante a aprovação.
                            </p>
                            <input
                                {...register('safeguard_threshold')}
                                type="number"
                                step="0.01"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white/50"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : <><Save size={20} /> Salvar Configuração</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SafeguardSettings;
