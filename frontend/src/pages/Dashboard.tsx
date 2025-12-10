import React from 'react';
import { DashboardProvider } from '../components/dashboard/DashboardContext';
import DashboardControls from '../components/dashboard/ui/DashboardControls';
import DraggableGrid from '../components/dashboard/DraggableGrid';

const Dashboard: React.FC = () => {
    return (
        <DashboardProvider>
            <div className="space-y-6 animate-fade-in p-1">
                <div className="flex flex-col">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Dashboard Contábil</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Visão completa do patrimônio e operações</p>
                </div>

                <DashboardControls />

                <DraggableGrid />
            </div>
        </DashboardProvider>
    );
};

export default Dashboard;
