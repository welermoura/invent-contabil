
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
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
import api from './api';
import {
    LayoutDashboard,
    Package,
    Building2,
    Truck,
    FileText,
    Tags,
    Users as UsersIcon,
    LogOut,
    Menu as MenuIcon,
    Settings,
    Shield,
    User,
    Workflow,
    UserCheck,
    CheckSquare,
    ClipboardList,
    Briefcase,
    MapPin,
    ChevronDown,
    ChevronRight,
    Database,
    BarChart3,
    LayoutGrid
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
    const { settings } = useSettings();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    // Sidebar State for Collapsible Sections
    const [openSections, setOpenSections] = useState<string[]>(['principal']);

    // Tour State
    const [runTour, setRunTour] = useState(false);
    const [tourSteps, setTourSteps] = useState<Step[]>([]);

    useEffect(() => {
        if (user) {
            const hasSeenTour = localStorage.getItem(`tour_completed_${user.role}`);
            if (!hasSeenTour) {
                const steps: Step[] = [];

                // Common Steps
                steps.push({
                    target: '#nav-dashboard',
                    content: 'Painel de Controle: Visualize KPIs, gráficos de movimentação e resumos operacionais em tempo real.',
                    disableBeacon: true,
                });

                steps.push({
                    target: '#nav-inventory',
                    content: 'Inventário Geral: Consulte todos os itens, filtre por status/filial e inicie ações como transferências ou baixas.',
                });

                // Operator Specific
                if (user.role === 'OPERATOR') {
                    steps.push({
                        target: '#nav-my-requests',
                        content: 'Minhas Solicitações: Acompanhe o status (pendente, aprovado, rejeitado) de tudo que você solicitou.',
                    });
                    steps.push({
                        target: '#nav-pending-actions',
                        content: 'Confirmações Pendentes: Realize ações operacionais que dependem de você, como confirmar o recebimento de itens transferidos.',
                    });
                }

                // Approver / Reviewer / Admin Specific
                if (user.role === 'APPROVER' || user.role === 'ADMIN' || user.role === 'REVIEWER') {
                    steps.push({
                        target: '#nav-pending-approvals',
                        content: 'Aprovações Pendentes: Central de decisão. Analise, aprove ou rejeite solicitações de novos itens, transferências e baixas.',
                    });
                }

                // Common Management
                steps.push({
                    target: '#nav-branches',
                    content: 'Filiais: Visualize e gerencie as unidades físicas e seus endereços.',
                });
                steps.push({
                    target: '#nav-suppliers',
                    content: 'Fornecedores: Cadastro de parceiros comerciais e seus dados (CNPJ, Contato).',
                });

                // Management Section
                steps.push({
                    target: '#nav-reports',
                    content: 'Relatórios: Gere e exporte relatórios gerenciais, financeiros e operacionais (PDF/Excel).',
                });

                if (user.role !== 'OPERATOR') {
                    steps.push({
                        target: '#nav-categories',
                        content: 'Categorias: Organize os itens em grupos lógicos e defina regras de depreciação.',
                    });
                }

                if (user.role === 'ADMIN' || user.role === 'APPROVER') {
                    steps.push({
                        target: '#nav-cost-centers',
                        content: 'Centros de Custo: Gerencie os centros para alocação financeira dos ativos.',
                    });
                }

                steps.push({
                    target: '#nav-sectors',
                    content: 'Setores: Mapeie os locais físicos ou departamentos dentro de cada filial.',
                });

                if (user.role === 'ADMIN' || user.role === 'APPROVER') {
                    steps.push({
                        target: '#nav-users',
                        content: 'Usuários: Controle total sobre contas, redefinição de senhas e atribuição de funções.',
                    });
                    steps.push({
                        target: '#nav-user-groups',
                        content: 'Grupos de Aprovação: Crie grupos de usuários para fluxos de aprovação coletiva.',
                    });
                    steps.push({
                        target: '#nav-safeguard',
                        content: 'Salva Guarda: Defina limites de valor (R$) que exigem aprovação especial de nível superior.',
                    });
                    steps.push({
                        target: '#nav-approval-workflows',
                        content: 'Malha de Aprovação: Configure visualmente quem deve aprovar o quê, baseado em categoria e tipo de ação.',
                    });
                }

                if (user.role === 'ADMIN') {
                    steps.push({
                        target: '#nav-system-settings',
                        content: 'Configurações: Personalize a aparência (Logo, Cores), configure o envio de e-mails (SMTP) e faça backups.',
                    });
                }

                setTourSteps(steps);
                // Ensure all sections are open when tour starts to avoid visibility issues
                setOpenSections(['principal', 'cadastros', 'administracao', 'relatorios']);
                setRunTour(true);
            }
        }
    }, [user]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRunTour(false);
            if (user) {
                localStorage.setItem(`tour_completed_${user.role}`, 'true');
            }
        }
    };

    const isActive = (path: string) => location.pathname === path;

    // Auto-open sidebar sections based on active route
    useEffect(() => {
        const path = location.pathname;
        let sectionToOpen = '';

        if (['/', '/inventory', '/my-requests', '/my-pending-actions', '/pending-approvals'].some(p => path === p) || path.startsWith('/dashboard')) {
            sectionToOpen = 'principal';
        } else if (['/branches', '/sectors', '/categories', '/suppliers', '/cost-centers'].some(p => path.startsWith(p))) {
            sectionToOpen = 'cadastros';
        } else if (['/users', '/approval-workflows', '/safeguard-settings', '/system-settings'].some(p => path.startsWith(p))) {
            sectionToOpen = 'administracao';
        } else if (path.startsWith('/reports')) {
            sectionToOpen = 'relatorios';
        }

        if (sectionToOpen && !openSections.includes(sectionToOpen)) {
            setOpenSections(prev => [...prev, sectionToOpen]);
        }
    }, [location.pathname]);

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

    // Dynamic Sidebar Styles
    const sidebarBgStyle = settings.theme_primary_color ? {
        backgroundColor: settings.theme_primary_color + (settings.theme_primary_color.length === 7 ? 'E6' : ''), // 90% opacity
    } : {};

    // Determine text color class based on setting or default
    const sidebarTextColorClass = settings.theme_text_color || 'text-slate-600';
    const sidebarHeaderColorClass = settings.theme_text_color === 'text-white' ? 'text-white' : 'text-slate-800';
    const navItemHoverClass = settings.theme_text_color === 'text-white'
        ? 'hover:bg-white/10 hover:text-white'
        : 'hover:bg-slate-100 hover:text-blue-600';

    const activeItemClass = settings.theme_text_color === 'text-white'
        ? 'bg-white/20 text-white shadow-md shadow-black/10'
        : 'bg-blue-600 text-white shadow-md shadow-blue-500/20';

    const NavItem = ({ to, icon: Icon, label, active, id }: { to: string, icon: any, label: string, active: boolean, id?: string }) => (
        <Link
            to={to}
            id={id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
                ${active
                    ? activeItemClass
                    : `${sidebarTextColorClass} ${navItemHoverClass}`
                }`}
        >
            <Icon size={20} className={active ? 'text-white' : (settings.theme_text_color === 'text-white' ? 'text-white/70 group-hover:text-white' : 'text-slate-400 group-hover:text-blue-600')} />
            <span className="font-medium">{label}</span>
        </Link>
    );

    const toggleSection = (section: string) => {
        setOpenSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    const SidebarSection = ({ id, title, icon: Icon, children }: { id: string, title: string, icon: any, children: React.ReactNode }) => {
        const isOpen = openSections.includes(id);
        const headerTextColor = settings.theme_text_color === 'text-white' ? 'text-white/80' : 'text-slate-500';
        const headerHoverColor = settings.theme_text_color === 'text-white' ? 'hover:text-white hover:bg-white/5' : 'hover:text-slate-800 hover:bg-slate-50';

        // Don't render empty sections (optional check, but simplistic for now)
        if (!children) return null;

        return (
            <div className="mb-2">
                <button
                    onClick={() => toggleSection(id)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors duration-200 ${headerTextColor} ${headerHoverColor}`}
                >
                    <div className="flex items-center gap-3">
                        {Icon && <Icon size={18} />}
                        <span>{title}</span>
                    </div>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out`}
                    style={{ maxHeight: isOpen ? '1000px' : '0', opacity: isOpen ? 1 : 0 }}
                >
                    <div className="mt-1 space-y-1 relative">
                         {/* Visual indent line */}
                         <div className={`absolute left-6 top-0 bottom-0 w-px ${settings.theme_text_color === 'text-white' ? 'bg-white/10' : 'bg-slate-200'}`}></div>
                         {/* Content with padding */}
                         <div className="pl-2">
                            {children}
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-screen font-sans text-slate-800 bg-transparent">
            <Notifications />
            <Joyride
                steps={tourSteps}
                run={runTour}
                continuous
                showProgress={false}
                showSkipButton
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
                    styles: {
                        floater: {
                            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
                        }
                    }
                }}
            />

            {/* Sidebar */}
            <aside
                style={sidebarBgStyle}
                className={`fixed inset-y-0 left-0 z-50 ${!settings.theme_primary_color ? 'bg-white/90' : ''} backdrop-blur-md border-r border-slate-200/50 w-64 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className={`flex items-center justify-between h-16 px-6 border-b ${settings.theme_text_color === 'text-white' ? 'border-white/10' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                        {settings.logo_url ? (
                             <img
                                src={`${api.defaults.baseURL}/${settings.logo_url}`}
                                alt="Logo"
                                className="h-10 w-auto object-contain"
                             />
                        ) : (
                            <>
                                <div className="bg-blue-600 p-1.5 rounded-lg">
                                    <Package className="text-white" size={20} />
                                </div>
                                <span className={`text-xl font-bold ${settings.theme_primary_color ? sidebarHeaderColorClass : 'bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent'}`}>
                                    Inventário
                                </span>
                            </>
                        )}
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className={`lg:hidden ${settings.theme_text_color === 'text-white' ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                        ×
                    </button>
                </div>

                <div className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-4rem)]">

                    {/* Principal */}
                    <SidebarSection id="principal" title="Principal" icon={LayoutGrid}>
                        <NavItem id="nav-dashboard" to="/" icon={LayoutDashboard} label="Painel" active={isActive('/')} />
                        <NavItem id="nav-inventory" to="/inventory" icon={Package} label="Inventário" active={isActive('/inventory')} />
                        {(user?.role === 'OPERATOR') && (
                            <NavItem id="nav-my-requests" to="/my-requests" icon={FileText} label="Minhas Solicitações" active={isActive('/my-requests')} />
                        )}
                        {(user?.role === 'OPERATOR') && (
                            <NavItem id="nav-pending-actions" to="/my-pending-actions" icon={ClipboardList} label="Confirmações Pendentes" active={isActive('/my-pending-actions')} />
                        )}
                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER' || user?.role === 'REVIEWER') && (
                            <NavItem id="nav-pending-approvals" to="/pending-approvals" icon={CheckSquare} label="Aprovações Pendentes" active={isActive('/pending-approvals')} />
                        )}
                    </SidebarSection>

                    {/* Cadastros */}
                    <SidebarSection id="cadastros" title="Cadastros" icon={Database}>
                        <NavItem id="nav-branches" to="/branches" icon={Building2} label="Filiais" active={isActive('/branches')} />
                        <NavItem id="nav-sectors" to="/sectors" icon={MapPin} label="Setores" active={isActive('/sectors')} />
                        {user?.role !== 'OPERATOR' && (
                            <NavItem id="nav-categories" to="/categories" icon={Tags} label="Categorias" active={isActive('/categories')} />
                        )}
                        <NavItem id="nav-suppliers" to="/suppliers" icon={Truck} label="Fornecedores" active={isActive('/suppliers')} />
                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                            <NavItem id="nav-cost-centers" to="/cost-centers" icon={Briefcase} label="Centros de Custo" active={isActive('/cost-centers')} />
                        )}
                    </SidebarSection>

                    {/* Relatórios */}
                    <SidebarSection id="relatorios" title="Relatórios" icon={BarChart3}>
                         <NavItem id="nav-reports" to="/reports" icon={FileText} label="Relatórios" active={isActive('/reports')} />
                    </SidebarSection>

                    {/* Administração (Apenas Admin/Aprovador) */}
                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                        <SidebarSection id="administracao" title="Administração" icon={Settings}>
                            <NavItem id="nav-users" to="/users" icon={UsersIcon} label="Usuários" active={isActive('/users')} />
                            <NavItem id="nav-user-groups" to="/users/groups" icon={UserCheck} label="Grupos de Aprovação" active={isActive('/users/groups')} />
                            <NavItem id="nav-approval-workflows" to="/approval-workflows" icon={Workflow} label="Malha de Aprovação" active={isActive('/approval-workflows')} />
                            <NavItem id="nav-safeguard" to="/safeguard-settings" icon={Shield} label="Salva Guarda" active={isActive('/safeguard-settings')} />
                            {(user?.role === 'ADMIN') && (
                                <NavItem id="nav-system-settings" to="/system-settings" icon={Settings} label="Configurações" active={isActive('/system-settings')} />
                            )}
                        </SidebarSection>
                    )}

                </div>
            </aside>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

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
