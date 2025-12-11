import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

export const useDashboardNavigation = () => {
    const navigate = useNavigate();

    const navigateToMacroView = useCallback((type: 'branch' | 'category' | 'status' | 'depreciation', id: string | number) => {
        // Codifica o ID para garantir que caracteres especiais na URL não quebrem a rota
        const encodedId = encodeURIComponent(String(id));

        switch (type) {
            case 'branch':
                navigate(`/dashboard/filial/${encodedId}`);
                break;
            case 'category':
                navigate(`/dashboard/categoria/${encodedId}`);
                break;
            case 'status':
                navigate(`/dashboard/detalhes/status?value=${encodedId}`);
                break;
            case 'depreciation':
                navigate(`/dashboard/depreciacao`);
                break;
            default:
                console.warn(`Unknown navigation type: ${type}`);
        }
    }, [navigate]);

    const openDetailModal = useCallback((type: string, params: any) => {
        // Para modais, vamos usar query params na URL atual ou navegar para uma rota com state
        // Aqui, para simplificar e manter o estado na URL (bom para compartilhar),
        // vamos usar query params que o componente Dashboard vai ler para abrir o modal.
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set('modal', type);

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                searchParams.set(key, String(value));
            });
        }

        navigate(`${window.location.pathname}?${searchParams.toString()}`);
    }, [navigate]);

    return { navigateToMacroView, openDetailModal };
};
