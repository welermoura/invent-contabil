import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../components/dashboard/DashboardContext';

export const useDashboardNavigation = () => {
    const navigate = useNavigate();
    // Use shared state from DashboardContext
    const { openDetailModal, closeModal, modalState } = useDashboard();

    const navigateToMacroView = (type: string, id: string | number) => {
        const encodedId = encodeURIComponent(String(id));
        navigate(`/dashboard/detalhes/${type}/${encodedId}`);
    };

    const navigateToBranchDetails = (branchName: string) => {
        navigate(`/dashboard/detalhes/filial/${encodeURIComponent(branchName)}`);
    };

    const navigateToCategoryDetails = (categoryName: string) => {
        navigate(`/dashboard/detalhes/categoria/${encodeURIComponent(categoryName)}`);
    };

    return {
        navigateToMacroView,
        navigateToBranchDetails,
        navigateToCategoryDetails,
        openDetailModal,
        closeModal,
        // Map context state to what components expect
        isModalOpen: modalState.isOpen,
        modalTitle: modalState.title,
        modalFilters: modalState.filters
    };
};
