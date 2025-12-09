import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
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

const PrivateRoute = () => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

const Layout = () => {
    const { logout, user } = useAuth();
    return (
        <div className="flex h-screen bg-gray-100">
            <Notifications />
            <aside className="w-64 bg-white shadow-md">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-blue-600">Inventário</h1>
                    <p className="text-sm text-gray-500 mt-2">Olá, {user?.email}</p>
                </div>
                <nav className="mt-6 flex flex-col gap-2">
                    <Link to="/" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Painel</Link>
                    <Link to="/inventory" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Inventário</Link>
                    <Link to="/branches" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Filiais</Link>
                    <Link to="/suppliers" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Fornecedores</Link>
                    <Link to="/reports" className="block px-6 py-3 text-gray-700 hover:bg-gray-100 font-medium text-blue-900 bg-blue-50">Relatórios</Link>
                    {user?.role !== 'OPERATOR' && (
                        <Link to="/categories" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Categorias</Link>
                    )}
                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                        <Link to="/users" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Usuários</Link>
                    )}
                    <button onClick={logout} className="block w-full text-left px-6 py-3 text-red-600 hover:bg-gray-100">Sair</button>
                </nav>
            </aside>
            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>
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
