
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Branches from './pages/Branches';
import Categories from './pages/Categories';
import Users from './pages/Users';
import UserGroups from './pages/UserGroups';
import SystemSettings from './pages/SystemSettings';
import SafeguardSettings from './pages/settings/SafeguardSettings';
import Setup from './pages/Setup';
import Reports from './pages/Reports';
import Suppliers from './pages/Suppliers';
import ApprovalWorkflows from './pages/ApprovalWorkflows';
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
    UserCheck
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import AdaptiveContrastManager from './components/AdaptiveContrastManager';

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

    const isActive = (path: string) => location.pathname === path;

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

    const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
        <Link
            to={to}
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

    return (
        <div className="flex h-screen font-sans text-slate-800 bg-transparent">
            <Notifications />

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

                <div className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
                    <div className={`text-xs font-semibold uppercase tracking-wider mb-2 px-4 mt-2 ${settings.theme_text_color === 'text-white' ? 'text-white/50' : 'text-slate-400'}`}>Menu</div>
                    <NavItem to="/" icon={LayoutDashboard} label="Painel" active={isActive('/')} />
                    <NavItem to="/inventory" icon={Package} label="Inventário" active={isActive('/inventory')} />
                    <NavItem to="/branches" icon={Building2} label="Filiais" active={isActive('/branches')} />
                    <NavItem to="/suppliers" icon={Truck} label="Fornecedores" active={isActive('/suppliers')} />

                    <div className={`text-xs font-semibold uppercase tracking-wider mb-2 px-4 mt-6 ${settings.theme_text_color === 'text-white' ? 'text-white/50' : 'text-slate-400'}`}>Gestão</div>
                    <NavItem to="/reports" icon={FileText} label="Relatórios" active={isActive('/reports')} />

                    {user?.role !== 'OPERATOR' && (
                        <NavItem to="/categories" icon={Tags} label="Categorias" active={isActive('/categories')} />
                    )}
                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                        <NavItem to="/users" icon={UsersIcon} label="Usuários" active={isActive('/users')} />
                    )}
                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                        <NavItem to="/users/groups" icon={UserCheck} label="Grupos de Aprovação" active={isActive('/users/groups')} />
                    )}
                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                        <NavItem to="/safeguard-settings" icon={Shield} label="Salva Guarda" active={isActive('/safeguard-settings')} />
                    )}
                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                        <NavItem to="/approval-workflows" icon={Workflow} label="Malha de Aprovação" active={isActive('/approval-workflows')} />
                    )}
                    {(user?.role === 'ADMIN') && (
                        <NavItem to="/system-settings" icon={Settings} label="Configurações" active={isActive('/system-settings')} />
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
                    <Route path="/suppliers" element={<Suppliers />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/users/groups" element={<UserGroups />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/system-settings" element={<SystemSettings />} />
                    <Route path="/safeguard-settings" element={<SafeguardSettings />} />
                    <Route path="/approval-workflows" element={<ApprovalWorkflows />} />
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

    return (
        <div className={`relative min-h-screen ${!backgroundUrl ? "bg-slate-50" : ""}`} style={backgroundUrl ? {
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
        } : {}}>
             <AdaptiveContrastManager imageUrl={backgroundUrl} />

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
