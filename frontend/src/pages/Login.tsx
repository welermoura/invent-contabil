import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    // Restaurando verificação de setup para garantir que o Admin seja criado
    useEffect(() => {
        const checkStatus = async () => {
            try {
                // Tenta verificar se o sistema já tem admin
                // Timeout curto para não travar a tela se backend estiver offline
                const response = await api.get('/setup-status', { timeout: 3000 });
                if (!response.data.is_setup) {
                    navigate('/setup');
                }
            } catch (error) {
                console.log("Check status failed, backend might be down or unreachable");
            }
        };
        checkStatus();
    }, [navigate]);

    const onSubmit = async (data: any) => {
        try {
            const formData = new FormData();
            formData.append('username', data.email);
            formData.append('password', data.password);

            const response = await api.post('/token', formData);
            login(response.data.access_token);
            navigate('/');
        } catch (err: any) {
            if (!err.response) {
                setError('Erro de conexão com o servidor. Verifique se o backend está rodando.');
            } else if (err.response.status === 401) {
                setError('Credenciais inválidas');
            } else {
                setError('Erro ao realizar login');
            }
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
                {error && <div className="text-red-500 mb-4">{error}</div>}
                <form onSubmit={handleSubmit(onSubmit)}>
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
                    <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
