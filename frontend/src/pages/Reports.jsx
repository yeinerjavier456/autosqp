import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

const Reports = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('http://localhost:8000/reports/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(response.data);
            } catch (error) {
                console.error("Error fetching reports", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) return <div className="p-10 text-center text-gray-500">Cargando reportes...</div>;
    if (!stats) return <div className="p-10 text-center text-gray-500">No hay datos disponibles.</div>;

    // Helper for Translation
    const translateStatus = (status) => {
        const map = {
            'new': 'Nuevo',
            'contacted': 'Contactado',
            'converted': 'Convertido',
            'closed': 'Cerrado'
        };
        return map[status] || status;
    };

    // Data for Graphs
    const statusLabels = Object.keys(stats.leads_by_status).map(translateStatus);
    const statusData = {
        labels: statusLabels,
        datasets: [
            {
                label: '# de Leads',
                data: Object.values(stats.leads_by_status),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                ],
                borderWidth: 1,
            },
        ],
    };

    const sourceData = {
        labels: Object.keys(stats.leads_by_source),
        datasets: [
            {
                label: 'Leads por Fuente',
                data: Object.values(stats.leads_by_source),
                backgroundColor: 'rgba(53, 102, 255, 0.5)',
            },
        ],
    };

    const advisorData = {
        labels: Object.keys(stats.leads_by_advisor),
        datasets: [
            {
                label: 'Leads Asignados',
                data: Object.values(stats.leads_by_advisor),
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
            },
        ],
    };

    // New Mocked Charts Data
    const brandData = {
        labels: Object.keys(stats.leads_by_brand || {}),
        datasets: [
            {
                label: 'Interés por Marca',
                data: Object.values(stats.leads_by_brand || {}),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)',
                    'rgba(255, 159, 64, 0.5)'
                ],
            },
        ],
    };

    const modelData = {
        labels: Object.keys(stats.leads_by_model || {}),
        datasets: [
            {
                label: 'Interés por Modelo',
                data: Object.values(stats.leads_by_model || {}),
                backgroundColor: 'rgba(255, 159, 64, 0.5)',
            },
        ],
    };

    const timeData = {
        labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], // Mock last 7 days
        datasets: [
            {
                label: 'Tiempo Promedio de Respuesta (min)',
                data: stats.avg_response_time || [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                tension: 0.3,
                fill: true,
            },
        ],
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">Reportes y Analítica</h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">Total Leads</p>
                    <p className="text-3xl font-bold text-slate-800 mt-2">{stats.total_leads}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">Tasa de Conversión</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">{stats.conversion_rate}%</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">Leads Nuevos</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{stats.leads_by_status['new'] || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">Tiempo Respuesta (Prom)</p>
                    <p className="text-3xl font-bold text-orange-500 mt-2">
                        {Math.round((stats.avg_response_time?.reduce((a, b) => a + b, 0) / stats.avg_response_time?.length) || 0)} min
                    </p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Status Chart */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-700 mb-4">Leads por Estado</h3>
                    <div className="h-64 flex justify-center">
                        <Doughnut data={statusData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>

                {/* Source Chart */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-700 mb-4">Leads por Fuente</h3>
                    <div className="h-64">
                        <Bar data={sourceData} options={{ maintainAspectRatio: false, responsive: true }} />
                    </div>
                </div>

                {/* Brand Chart */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-700 mb-4">Interés por Marca</h3>
                    <div className="h-64 flex justify-center">
                        <Pie data={brandData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Advisor Chart */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-700 mb-4">Desempeño por Asesor</h3>
                    <div className="h-80">
                        <Bar
                            data={advisorData}
                            options={{
                                indexAxis: 'y',
                                maintainAspectRatio: false,
                                responsive: true
                            }}
                        />
                    </div>
                </div>

                {/* Model Chart */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-700 mb-4">Interés por Modelo (Top)</h3>
                    <div className="h-80">
                        <Bar
                            data={modelData}
                            options={{
                                maintainAspectRatio: false,
                                responsive: true
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Response Time Chart */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <h3 className="text-lg font-bold text-gray-700 mb-4">Tiempo de Respuesta (Últimos 7 días)</h3>
                <div className="h-72">
                    <Line data={timeData} options={{ maintainAspectRatio: false, responsive: true }} />
                </div>
            </div>
        </div>
    );
};

export default Reports;
