
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Branches from './pages/Branches';
import Categories from './pages/Categories';
import CostCenters from './pages/CostCenters';
import Sectors from './pages/Sectors';
import Users from './pages/Users';
import UserGroups from './pages/UserGroups';
import SystemSettings from './pages/SystemSettings';
import SafeguardSettings from './pages/settings/SafeguardSettings';
import Setup from './pages/Setup';
import Reports from './pages/Reports';
import Suppliers from './pages/Suppliers';
import ApprovalWorkflows from './pages/ApprovalWorkflows';
import MyRequests from './pages/MyRequests';
import PendingApprovals from './pages/PendingApprovals';
import MyPendingActions from './pages/MyPendingActions';
import MacroViewPage from './pages/dashboard/MacroViewPage';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorProvider } from './context/ErrorContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import Notifications from './components/Notifications';
import { NotificationCenter } from './components/NotificationCenter';
import Sidebar from './components/Sidebar';
import api from './api';
import {
    LogOut,
    Menu as MenuIcon,
    User
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import AdaptiveContrastManager from './components/AdaptiveContrastManager';
import Joyride, { STATUS } from 'react-joyride';
import type { CallBackProps, Step } from 'react-joyride';
import { TutorialTooltip } from './components/TutorialTooltip';

const PrivateRoute = () => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

const Layout = () => {
    const { logout, user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    // Tour State
    const [runTour, setRunTour] = useState(false);
    const [tourSteps, setTourSteps] = useState<Step[]>([]);

    // Sidebar Control State (Lifted from Sidebar)
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        principal: true,
        cadastros: false,
        administracao: false,
        relatorios: false
    });
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const toggleSection = (section: string) => {
        if (isSidebarCollapsed) return;
        setOpenSections(prev => {
            const newState = {
                principal: false,
                cadastros: false,
                administracao: false,
                relatorios: false
            };
            return {
                ...newState,
                [section]: !prev[section]
            };
        });
    };

    useEffect(() => {
        if (user) {
            const hasSeenTour = localStorage.getItem(`tour_completed_${user.role}`);
            if (!hasSeenTour) {
                const steps: Step[] = [];

                // 1. Principal
                steps.push({
                    target: '#nav-dashboard',
                    content: 'Painel de Controle: Visualize KPIs, gráficos de movimentação e resumos operacionais em tempo real.',
                    disableBeacon: true,
                    placement: 'right',
                    data: { section: 'principal' }
                });

                steps.push({
                    target: '#nav-inventory',
                    content: 'Inventário Geral: Consulte todos os itens, filtre por status/filial e inicie ações como transferências ou baixas.',
                    placement: 'right',
                    data: { section: 'principal' }
                });

                if (user.role === 'OPERATOR') {
                    steps.push({
                        target: '#nav-my-requests',
                        content: 'Minhas Solicitações: Acompanhe o status (pendente, aprovado, rejeitado) de tudo que você solicitou.',
                        placement: 'right',
                        data: { section: 'principal' }
                    });
                    steps.push({
                        target: '#nav-pending-actions',
                        content: 'Confirmações Pendentes: Realize ações operacionais que dependem de você, como confirmar o recebimento de itens transferidos.',
                        placement: 'right',
                        data: { section: 'principal' }
                    });
                }

                if (user.role === 'APPROVER' || user.role === 'ADMIN' || user.role === 'REVIEWER') {
                    steps.push({
                        target: '#nav-pending-approvals',
                        content: 'Aprovações Pendentes: Central de decisão. Analise, aprove ou rejeite solicitações de novos itens, transferências e baixas.',
                        placement: 'right',
                        data: { section: 'principal' }
                    });
                }

                // 2. Cadastros
                steps.push({
                    target: '#nav-branches',
                    content: 'Filiais: Visualize e gerencie as unidades físicas e seus endereços.',
                    placement: 'right',
                    data: { section: 'cadastros' }
                });

                steps.push({
                    target: '#nav-sectors',
                    content: 'Setores: Mapeie os locais físicos ou departamentos dentro de cada filial.',
                    placement: 'right',
                    data: { section: 'cadastros' }
                });

                if (user.role !== 'OPERATOR') {
                    steps.push({
                        target: '#nav-categories',
                        content: 'Categorias: Organize os itens em grupos lógicos e defina regras de depreciação.',
                        placement: 'right',
                        data: { section: 'cadastros' }
                    });
                }

                steps.push({
                    target: '#nav-suppliers',
                    content: 'Fornecedores: Cadastro de parceiros comerciais e seus dados (CNPJ, Contato).',
                    placement: 'right',
                    data: { section: 'cadastros' }
                });

                if (user.role === 'ADMIN' || user.role === 'APPROVER') {
                    steps.push({
                        target: '#nav-cost-centers',
                        content: 'Centros de Custo: Gerencie os centros para alocação financeira dos ativos.',
                        placement: 'right',
                        data: { section: 'cadastros' }
                    });
                }

                // 3. Administração
                if (user.role === 'ADMIN' || user.role === 'APPROVER') {
                    steps.push({
                        target: '#nav-users',
                        content: 'Usuários: Controle total sobre contas, redefinição de senhas e atribuição de funções.',
                        placement: 'right',
                        data: { section: 'administracao' }
                    });
                    steps.push({
                        target: '#nav-user-groups',
                        content: 'Grupos de Aprovação: Crie grupos de usuários para fluxos de aprovação coletiva.',
                        placement: 'right',
                        data: { section: 'administracao' }
                    });
                    steps.push({
                        target: '#nav-approval-workflows',
                        content: 'Malha de Aprovação: Configure visualmente quem deve aprovar o quê, baseado em categoria e tipo de ação.',
                        placement: 'right',
                        data: { section: 'administracao' }
                    });
                    steps.push({
                        target: '#nav-safeguard',
                        content: 'Salva Guarda: Defina limites de valor (R$) que exigem aprovação especial de nível superior.',
                        placement: 'right',
                        data: { section: 'administracao' }
                    });
                }

                if (user.role === 'ADMIN') {
                    steps.push({
                        target: '#nav-system-settings',
                        content: 'Configurações: Personalize a aparência (Logo, Cores), configure o envio de e-mails (SMTP) e faça backups.',
                        placement: 'right',
                        data: { section: 'administracao' }
                    });
                }

                // 4. Relatórios
                steps.push({
                    target: '#nav-reports',
                    content: 'Relatórios: Gere e exporte relatórios gerenciais, financeiros e operacionais (PDF/Excel).',
                    placement: 'right',
                    data: { section: 'relatorios' }
                });

                setTourSteps(steps);
                // Ensure Sidebar is open and not collapsed for the tour
                setSidebarOpen(true);
                setIsSidebarCollapsed(false);
                setRunTour(true);
            }
        }
    }, [user]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, type, step } = data;

        // Auto-expand Sidebar sections based on step metadata
        if (type === 'step:before' || type === 'tour:start') {
            const section = step.data?.section;
            if (section) {
                setOpenSections(prev => ({
                    principal: section === 'principal',
                    cadastros: section === 'cadastros',
                    administracao: section === 'administracao',
                    relatorios: section === 'relatorios'
                }));
            }
        }

        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRunTour(false);
            if (user) {
                localStorage.setItem(`tour_completed_${user.role}`, 'true');
            }
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="flex h-screen font-sans text-slate-800 bg-transparent">
            <Notifications />
            <Joyride
                steps={tourSteps}
                run={runTour}
                continuous
                showProgress={false}
                showSkipButton
                disableScrolling={false} // Allow scrolling
                scrollOffset={100} // Offset to ensure target is visible
                disableOverlayClose={true}
                spotlightClicks={true}
                callback={handleJoyrideCallback}
                tooltipComponent={TutorialTooltip}
                styles={{
                    options: {
                        primaryColor: '#2563eb',
                        zIndex: 10000,
                    }
                }}
                floaterProps={{
                    hideArrow: false,
                    placement: 'auto', // Smart positioning
                    disableAnimation: true, // Prevent glitches
                    styles: {
                        floater: {
                            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
                        }
                    }
                }}
            />

            {/* Sidebar Component */}
            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                openSections={openSections}
                toggleSection={toggleSection}
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
                disableAnimations={runTour}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="relative z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-6 lg:px-8">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
                    >
                        <MenuIcon size={24} />
                    </button>

                    <div className="flex items-center ml-auto gap-4">
                        <NotificationCenter />

                        <div className="relative" ref={profileMenuRef}>
                            <button
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                className="h-10 w-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold border border-blue-200 hover:ring-2 hover:ring-blue-500 hover:bg-blue-200 transition-all cursor-pointer shadow-sm focus:outline-none"
                                title="Menu do Usuário"
                            >
                                {user?.email?.charAt(0).toUpperCase()}
                            </button>

                            {isProfileMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                            {user?.name || 'Usuário'}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {user?.email}
                                        </p>
                                    </div>

                                    <div className="py-1">
                                        <Link
                                            to="/profile"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                            onClick={() => setIsProfileMenuOpen(false)}
                                        >
                                            <User size={16} />
                                            Meu Perfil
                                        </Link>
                                        <button
                                            onClick={() => {
                                                logout();
                                                setIsProfileMenuOpen(false);
                                            }}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <LogOut size={16} />
                                            Sair
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-2 lg:p-4">
                    <div className="mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

const AppRoutes = () => {
     return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/setup" element={<Setup />} />
            <Route element={<PrivateRoute />}>
                <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard/:type/:id" element={<MacroViewPage />} />
                    <Route path="/dashboard/detalhes/:type" element={<MacroViewPage />} />
                    <Route path="/dashboard/detalhes/:type/:id" element={<MacroViewPage />} />
                    <Route path="/dashboard/depreciacao" element={<MacroViewPage />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/branches" element={<Branches />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/cost-centers" element={<CostCenters />} />
                    <Route path="/sectors" element={<Sectors />} />
                    <Route path="/suppliers" element={<Suppliers />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/users/groups" element={<UserGroups />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/system-settings" element={<SystemSettings />} />
                    <Route path="/safeguard-settings" element={<SafeguardSettings />} />
                    <Route path="/approval-workflows" element={<ApprovalWorkflows />} />
                    <Route path="/my-requests" element={<MyRequests />} />
                    <Route path="/my-pending-actions" element={<MyPendingActions />} />
                    <Route path="/pending-approvals" element={<PendingApprovals />} />
                </Route>
            </Route>
        </Routes>
     );
}

const MainLayout = () => {
    const { settings } = useSettings();
    const backgroundUrl = settings.background_url
        ? `${api.defaults.baseURL}/${settings.background_url}?t=${new Date().getTime()}`
        : null;
    const backgroundColor = settings.theme_background_color || null;

    const containerStyle: React.CSSProperties = {};
    if (backgroundUrl) {
        containerStyle.backgroundImage = `url(${backgroundUrl})`;
        containerStyle.backgroundSize = 'cover';
        containerStyle.backgroundPosition = 'center';
        containerStyle.backgroundAttachment = 'fixed';
    } else if (backgroundColor) {
        containerStyle.backgroundColor = backgroundColor;
    }

    return (
        <div className={`relative min-h-screen ${!backgroundUrl && !backgroundColor ? "bg-slate-50" : ""}`} style={containerStyle}>
             <AdaptiveContrastManager imageUrl={backgroundUrl} backgroundColor={backgroundColor} />

             <div className="relative z-10">
                <AppRoutes />
             </div>
        </div>
    )
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
            <ErrorProvider>
                <SettingsProvider>
                    <MainLayout />
                </SettingsProvider>
            </ErrorProvider>
        </AuthProvider>
    </Router>
  )
}

export default App
