import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { useError } from '../hooks/useError';

const Setup: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const navigate = useNavigate();

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await api.get('/setup-status');
                if (response.data.is_setup) {
                    navigate('/login');
                }
            } catch (error) {
                console.error("Setup check failed", error);
            }
        };
        checkStatus();
    }, [navigate]);

    const { showError, showSuccess } = useError();

    const onSubmit = async (data: any) => {
        try {
            // Create Master Admin
            await api.post('/setup', data);
            showSuccess("Admin cadastrado com sucesso! Faça login.");
            navigate('/login');
        } catch (error) {
            console.error("Setup failed", error);
            showError("Erro ao cadastrar Admin.");
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-transparent relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-slate-50/50 -z-10"></div>
            <div className="bg-white/80 backdrop-blur-md p-8 rounded shadow-md w-full max-w-md border border-white/40">
                <h2 className="text-2xl font-bold mb-6 text-center">Configuração Inicial</h2>
                <p className="mb-4 text-gray-600 text-center">Cadastre o Administrador Master do sistema.</p>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-gray-700">Nome</label>
                        <input
                            {...register('name', { required: true })}
                            className="w-full border rounded px-3 py-2"
                        />
                        {errors.name && <span className="text-red-500">Campo obrigatório</span>}
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700">Email</label>
                        <input
                            {...register('email', { required: true })}
                            className="w-full border rounded px-3 py-2"
                        />
                        {errors.email && <span className="text-red-500">Campo obrigatório</span>}
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700">Senha</label>
                        <input
                            type="password"
                            {...register('password', { required: true })}
                            className="w-full border rounded px-3 py-2"
                        />
                         {errors.password && <span className="text-red-500">Campo obrigatório</span>}
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                        Criar Admin e Iniciar
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Setup;
