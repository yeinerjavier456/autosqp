import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const AdvisorDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('http://localhost:8000/stats/advisor', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(response.data);
            } catch (error) {
                console.error("Error fetching advisor stats", error);
            }
        };

        if (user) fetchStats();
    }, [user]);

    if (!stats) return <div className="p-8 text-center text-gray-500">Cargando tablero...</div>;

    return (
        <div>
            <header className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-800">Tablero de Asesor</h1>
                <p className="text-slate-500 mt-2">
                    Bienvenido, <span className="font-bold text-blue-600">{user?.email?.split('@')[0]}</span>
                </p>
            </header>

            <div className="animate-fade-in-up">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-sm font-medium text-gray-500 mb-1">Total Leads</p>
                        <p className="text-3xl font-extrabold text-gray-800">{stats.total_leads}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-sm font-medium text-gray-500 mb-1">Tasa de Conversión</p>
                        <p className="text-3xl font-extrabold text-green-600">{stats.conversion_rate}%</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-sm font-medium text-gray-500 mb-1">Leads Nuevos</p>
                        <p className="text-3xl font-extrabold text-blue-600">{stats.leads_new}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-sm font-medium text-gray-500 mb-1">Tiempo Respuesta</p>
                        <p className="text-3xl font-extrabold text-orange-500">{stats.response_time_min} min</p>
                    </div>
                </div>

                {/* Status Cards (No Graphs) */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 px-1">Estado de Leads</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {Object.entries({
                            new: 'Nuevos',
                            contacted: 'Contactados',
                            interested: 'Interesados',
                            sold: 'Vendidos',
                            lost: 'Perdidos'
                        }).map(([key, label]) => {
                            const count = stats.status_distribution?.[key] || 0;
                            const colors = {
                                new: 'text-blue-600 bg-blue-50',
                                contacted: 'text-yellow-600 bg-yellow-50',
                                interested: 'text-orange-600 bg-orange-50',
                                sold: 'text-green-600 bg-green-50',
                                lost: 'text-gray-500 bg-gray-50'
                            };

                            return (
                                <div key={key} className={`${colors[key].split(' ')[1]} p-4 rounded-xl border border-gray-100 flex flex-col items-center text-center`}>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</span>
                                    <span className={`text-3xl font-extrabold ${colors[key].split(' ')[0]}`}>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvisorDashboard;
