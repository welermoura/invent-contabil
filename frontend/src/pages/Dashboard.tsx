import React from 'react';
import { DashboardProvider } from '../components/dashboard/DashboardContext';
import DashboardControls from '../components/dashboard/ui/DashboardControls';
import DraggableGrid from '../components/dashboard/DraggableGrid';
import WidgetLibrary from '../components/dashboard/ui/WidgetLibrary';
import DashboardModal from '../components/dashboard/DashboardModal';
import { useDashboardNavigation } from '../hooks/useDashboardNavigation';

const DashboardContent: React.FC = () => {
    const { isModalOpen, closeModal, modalTitle, modalFilters } = useDashboardNavigation();

    return (
        <div className="space-y-6 animate-fade-in p-1 relative">
            <div className="flex flex-col">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Visão completa do patrimônio e operações</p>
            </div>

            <DashboardControls />

            <DraggableGrid />

            <WidgetLibrary />

            {/* Global Dashboard Modal for quick interactions */}
            <DashboardModal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={modalTitle}
                filters={modalFilters}
            />
        </div>
    );
};

const Dashboard: React.FC = () => {
    return (
        <DashboardProvider>
            <DashboardContent />
        </DashboardProvider>
    );
};

export default Dashboard;
