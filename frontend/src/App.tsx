
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Branches from './pages/Branches';
import Categories from './pages/Categories';
import Users from './pages/Users';
import Setup from './pages/Setup';
import Reports from './pages/Reports';
import Suppliers from './pages/Suppliers';
import { AuthProvider, useAuth } from './AuthContext';
import Notifications from './components/Notifications';
import {
    LayoutDashboard,
    Package,
    Building2,
    Truck,
    FileText,
    Tags,
    Users as UsersIcon,
    LogOut,
    Menu as MenuIcon
} from 'lucide-react';
import { useState } from 'react';

const PrivateRoute = () => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
    <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
            ${active
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
            }`}
    >
        <Icon size={20} className={active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'} />
        <span className="font-medium">{label}</span>
    </Link>
);

const Layout = () => {
    const { logout, user } = useAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
            <Notifications />

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 w-64 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <Package className="text-white" size={20} />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
                            Inventário
                        </span>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
                        ×
                    </button>
                </div>

                <div className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4 mt-2">Menu</div>
                    <NavItem to="/" icon={LayoutDashboard} label="Painel" active={isActive('/')} />
                    <NavItem to="/inventory" icon={Package} label="Inventário" active={isActive('/inventory')} />
                    <NavItem to="/branches" icon={Building2} label="Filiais" active={isActive('/branches')} />
                    <NavItem to="/suppliers" icon={Truck} label="Fornecedores" active={isActive('/suppliers')} />

                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4 mt-6">Gestão</div>
                    <NavItem to="/reports" icon={FileText} label="Relatórios" active={isActive('/reports')} />

                    {user?.role !== 'OPERATOR' && (
                        <NavItem to="/categories" icon={Tags} label="Categorias" active={isActive('/categories')} />
                    )}
                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                        <NavItem to="/users" icon={UsersIcon} label="Usuários" active={isActive('/users')} />
                    )}

                    <div className="mt-8 pt-4 border-t border-slate-100">
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                            <LogOut size={20} />
                            <span className="font-medium">Sair</span>
                        </button>
                    </div>
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
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
                    >
                        <MenuIcon size={24} />
                    </button>

                    <div className="flex items-center ml-auto gap-4">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-medium text-slate-700">{user?.email || 'Usuário'}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                                {user?.role}
                            </span>
                        </div>
                        <div className="h-9 w-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold border border-blue-200">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <main className={`flex-1 overflow-y-auto ${isActive('/') ? 'p-2 lg:p-4' : 'p-4 lg:p-8'}`}>
                    <div className={`mx-auto ${isActive('/') ? '' : 'max-w-7xl'}`}>
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
            <Route path="/setup" element={<Setup />} />
            <Route element={<PrivateRoute />}>
                <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/branches" element={<Branches />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/suppliers" element={<Suppliers />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/users" element={<Users />} />
                </Route>
            </Route>
        </Routes>
     );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    </Router>
  )
}

export default App
