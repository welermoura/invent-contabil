import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import { AuthProvider, useAuth } from './AuthContext';
import Notifications from './components/Notifications';

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
            <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inventory" element={<Inventory />} />
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
