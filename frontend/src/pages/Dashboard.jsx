import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
    const [stats, setStats] = useState({ companies_count: 0, users_count: 0 });
    const { user } = useAuth();

    // Helper to get role name/label safe for object or string
    const roleName = user?.role?.name || (typeof user?.role === 'string' ? user?.role : '');
    const roleLabel = user?.role?.label || roleName;

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('http://localhost:8000/dashboard/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(response.data);
            } catch (error) {
                console.error("Error fetching stats", error);
            }
        };

        // Only fetch global stats if super user AND no company assigned (Global Admin)
        if (roleName === 'super_admin' && !user?.company_id) {
            fetchStats();
        }
    }, [user, roleName]);

    return (
        <div className="">
            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800">
                    Hola, {user?.email} 👋
                </h1>
                <p className="text-slate-500 mt-2">
                    Bienvenido al panel de control de <span className="font-bold text-blue-600 capitalize">{roleLabel}</span>.
                </p>
            </header>

            {roleName === 'super_admin' && !user?.company_id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Stats Cards */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Empresas</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.companies_count}</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Usuarios Totales</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.users_count}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center">
                    <div className="mb-4 text-blue-100 flex justify-center">
                        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Panel de Vendedor / Admin</h2>
                    <p className="text-slate-500">Estamos construyendo las herramientas para tu rol. Próximamente verás aquí tu inventario y ventas.</p>
                </div>
            )}

            {/* Placeholder Chart Area */}
            <div className="mt-10 bg-white p-6 rounded-2xl shadow-xl h-64 flex flex-col justify-center items-center text-slate-400 border border-dashed border-slate-300">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                <span className="text-lg font-medium">Gráficos de rendimiento próximamente</span>
            </div>
        </div>
    );
};

export default Dashboard;
