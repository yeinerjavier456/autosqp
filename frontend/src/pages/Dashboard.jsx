import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AdvisorDashboard from './AdvisorDashboard';
import Reports from './Reports';

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ companies_count: 0, users_count: 0 });

    // Helper to get role name
    const roleName = user?.role?.name || (typeof user?.role === 'string' ? user?.role : '');
    const roleLabel = user?.role?.label || roleName;

    // ----------------------------------------------------------------
    // ROUTING LOGIC
    // ----------------------------------------------------------------

    // 1. ADVISORS / SELLERS -> New Dedicated Dashboard
    if (roleName === 'advisor' || roleName === 'seller' || roleName === 'vendedor' || roleName === 'asesor') {
        return <AdvisorDashboard />;
    }

    // 2. COMPANY ADMINS -> Legacy Reports Dashboard
    // If they are 'admin' (not super_admin), they want the full charts.
    if (roleName === 'admin') {
        return <Reports />;
    }

    // ----------------------------------------------------------------
    // 3. GLOBAL SUPER ADMIN -> Custom Global Stats View
    // ----------------------------------------------------------------
    const isGlobalSuperAdmin = roleName === 'super_admin';

    // Fallback: If not super admin but has company, probably an admin variant -> Reports
    if (!isGlobalSuperAdmin && user?.company_id) {
        return <Reports />;
    }

    // --- Fetch Global Stats for Super Admin ---
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('http://localhost:8000/dashboard/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(response.data);
            } catch (error) {
                console.error("Error fetching admin stats", error);
            }
        };
        if (user && isGlobalSuperAdmin) fetchStats();
    }, [user, isGlobalSuperAdmin]);

    return (
        <div className="">
            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800">
                    Hola, {user?.email} 👋
                </h1>
                <p className="text-slate-500 mt-2">
                    Panel de Administración Global (<span className="font-bold text-blue-600 capitalize">{roleLabel}</span>)
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
        </div>
    );
};

export default Dashboard;
