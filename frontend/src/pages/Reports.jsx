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
import { Bar, Doughnut, Line } from 'react-chartjs-2';

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

const STATUS_LABELS = {
    new: 'Nuevos',
    contacted: 'Contactados',
    interested: 'Interesados',
    credit_application: 'Solicitud de credito',
    qualified: 'Calificados',
    sold: 'Vendidos',
    lost: 'Perdidos',
    ally_managed: 'Aliado'
};

const SOURCE_LABELS = {
    web: 'Web',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    other: 'Otros',
    manual: 'Manual'
};

const formatLabel = (value, map) => map[value] || value || 'Sin dato';

const buildSingleDataset = (label, values, color) => ({
    labels: values.map(([key]) => key),
    datasets: [
        {
            label,
            data: values.map(([, count]) => count),
            backgroundColor: color,
            borderRadius: 10,
        },
    ],
});

const Reports = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('https://autosqp.co/api/reports/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(response.data);
            } catch (error) {
                console.error('Error fetching reports', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) return <div className="p-10 text-center text-gray-500">Cargando reportes...</div>;
    if (!stats) return <div className="p-10 text-center text-gray-500">No hay datos disponibles.</div>;

    const statusEntries = Object.entries(stats.leads_by_status || {})
        .map(([key, value]) => [formatLabel(key, STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);

    const sourceEntries = Object.entries(stats.leads_by_source || {})
        .map(([key, value]) => [formatLabel(key, SOURCE_LABELS), value])
        .sort((a, b) => b[1] - a[1]);

    const advisorEntries = Object.entries(stats.leads_by_advisor || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const recentDailyEntries = Object.entries(stats.recent_leads_by_day || {});
    const unreadBySourceEntries = Object.entries(stats.unread_replies_by_source || {})
        .map(([key, value]) => [formatLabel(key, SOURCE_LABELS), value])
        .sort((a, b) => b[1] - a[1]);

    const assignmentEntries = Object.entries(stats.assignment_split || {})
        .map(([key, value]) => [key === 'assigned' ? 'Asignados' : 'Sin asignar', value]);

    const statusData = {
        labels: statusEntries.map(([label]) => label),
        datasets: [
            {
                label: 'Leads',
                data: statusEntries.map(([, value]) => value),
                backgroundColor: [
                    '#1d4ed8',
                    '#0f766e',
                    '#f59e0b',
                    '#7c3aed',
                    '#2563eb',
                    '#16a34a',
                    '#dc2626',
                    '#64748b',
                ],
                borderWidth: 0,
            },
        ],
    };

    const sourceData = buildSingleDataset('Leads por fuente', sourceEntries, '#2563eb');
    const advisorData = buildSingleDataset('Leads asignados', advisorEntries, '#0f766e');
    const unreadBySourceData = buildSingleDataset('Respuestas pendientes', unreadBySourceEntries, '#f97316');

    const assignmentData = {
        labels: assignmentEntries.map(([label]) => label),
        datasets: [
            {
                label: 'Cobertura',
                data: assignmentEntries.map(([, value]) => value),
                backgroundColor: ['#14b8a6', '#f59e0b'],
                borderWidth: 0,
            },
        ],
    };

    const trendData = {
        labels: recentDailyEntries.map(([label]) => label),
        datasets: [
            {
                label: 'Leads creados',
                data: recentDailyEntries.map(([, value]) => value),
                borderColor: '#1d4ed8',
                backgroundColor: 'rgba(29, 78, 216, 0.16)',
                fill: true,
                tension: 0.35,
            },
        ],
    };

    const soldCount = stats.leads_by_status?.sold || 0;
    const newCount = stats.leads_by_status?.new || 0;

    return (
        <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-cyan-900 px-6 py-7 text-white shadow-xl">
                <h1 className="text-3xl font-bold">Reportes y Analitica</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-200">
                    Vista real del embudo comercial: captacion reciente, distribucion del pipeline,
                    origen de leads, carga por asesor y conversaciones pendientes de seguimiento.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">Total leads</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total_leads}</p>
                    <p className="mt-2 text-xs text-slate-500">Base activa e historica registrada en el CRM.</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <p className="text-sm font-medium text-emerald-700">Tasa de conversion</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-800">{stats.conversion_rate}%</p>
                    <p className="mt-2 text-xs text-emerald-700">{soldCount} leads en estado vendido.</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <p className="text-sm font-medium text-amber-700">Pipeline activo</p>
                    <p className="mt-2 text-3xl font-bold text-amber-800">{stats.active_pipeline_count}</p>
                    <p className="mt-2 text-xs text-amber-700">{newCount} siguen en estado nuevo.</p>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                    <p className="text-sm font-medium text-orange-700">Respuestas pendientes</p>
                    <p className="mt-2 text-3xl font-bold text-orange-800">{stats.unread_replies_count}</p>
                    <p className="mt-2 text-xs text-orange-700">Clientes con mensaje nuevo sin revisar.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Captacion de leads en los ultimos 7 dias</h3>
                        <p className="text-sm text-slate-500">Muestra el ritmo real de ingreso reciente al CRM.</p>
                    </div>
                    <div className="h-80">
                        <Line
                            data={trendData}
                            options={{
                                maintainAspectRatio: false,
                                responsive: true,
                                plugins: { legend: { display: false } },
                                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                            }}
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Embudo por estado</h3>
                        <p className="text-sm text-slate-500">Distribucion actual de todos los leads.</p>
                    </div>
                    <div className="h-80">
                        <Doughnut
                            data={statusData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: { legend: { position: 'bottom' } },
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Leads por fuente</h3>
                        <p className="text-sm text-slate-500">Canales que realmente estan trayendo contactos.</p>
                    </div>
                    <div className="h-80">
                        <Bar
                            data={sourceData}
                            options={{
                                indexAxis: 'y',
                                maintainAspectRatio: false,
                                responsive: true,
                                plugins: { legend: { display: false } },
                                scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
                            }}
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Carga por asesor</h3>
                        <p className="text-sm text-slate-500">Top de usuarios con mas leads asignados.</p>
                    </div>
                    <div className="h-80">
                        <Bar
                            data={advisorData}
                            options={{
                                indexAxis: 'y',
                                maintainAspectRatio: false,
                                responsive: true,
                                plugins: { legend: { display: false } },
                                scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Cobertura de asignacion</h3>
                        <p className="text-sm text-slate-500">Que porcentaje del pipeline ya tiene responsable.</p>
                    </div>
                    <div className="h-72">
                        <Doughnut
                            data={assignmentData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: { legend: { position: 'bottom' } },
                            }}
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Respuestas pendientes por canal</h3>
                        <p className="text-sm text-slate-500">Donde se esta acumulando atencion sin responder.</p>
                    </div>
                    <div className="h-72">
                        {unreadBySourceEntries.length > 0 ? (
                            <Bar
                                data={unreadBySourceData}
                                options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: { legend: { display: false } },
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                                No hay respuestas pendientes registradas por ahora.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
