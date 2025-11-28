import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Branches from './pages/Branches';
import Categories from './pages/Categories';
import Setup from './pages/Setup';
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
                    <h1 className="text-2xl font-bold text-blue-600">Inventory</h1>
                    <p className="text-sm text-gray-500 mt-2">Olá, {user?.email}</p>
                </div>
                <nav className="mt-6">
                    <a href="/" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Dashboard</a>
                    <a href="/inventory" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Inventário</a>
                    <a href="/branches" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Filiais</a>
                    <a href="/categories" className="block px-6 py-3 text-gray-700 hover:bg-gray-100">Categorias</a>
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
                </Route>
            </Route>
        </Routes>
     );
}

function App() {
  return (
    <Router>
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    </Router>
  )
}

export default App
