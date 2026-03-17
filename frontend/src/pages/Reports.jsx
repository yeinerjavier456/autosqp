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

const CREDIT_STATUS_LABELS = {
    pending: 'Solicitud recibida',
    in_review: 'En estudio',
    approved: 'Aprobado',
    rejected: 'No viable',
    completed: 'Finalizado'
};

const PURCHASE_STATUS_LABELS = {
    pending: 'Solicitud recibida',
    in_review: 'En busqueda',
    approved: 'Opciones encontradas',
    rejected: 'Sin resultado',
    completed: 'Cerrado'
};

const VEHICLE_STATUS_LABELS = {
    available: 'Disponibles',
    reserved: 'Separados',
    sold: 'Vendidos'
};

const SALES_STATUS_LABELS = {
    pending: 'Pendientes',
    approved: 'Aprobadas',
    rejected: 'Negadas'
};

const PURCHASE_OPTION_DECISION_LABELS = {
    pending: 'Pendientes',
    accepted: 'Aceptadas',
    rejected: 'Rechazadas'
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
    const allyEntries = Object.entries(stats.ally_status_split || {})
        .map(([key, value]) => [formatLabel(key, STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const creditEntries = Object.entries(stats.credit_status_split || {})
        .map(([key, value]) => [formatLabel(key, CREDIT_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const purchaseEntries = Object.entries(stats.purchase_status_split || {})
        .map(([key, value]) => [formatLabel(key, PURCHASE_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const inventoryEntries = Object.entries(stats.vehicle_status_split || {})
        .map(([key, value]) => [formatLabel(key, VEHICLE_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const salesEntries = Object.entries(stats.sales_status_split || {})
        .map(([key, value]) => [formatLabel(key, SALES_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const optionDecisionEntries = Object.entries(stats.purchase_option_decision_split || {})
        .map(([key, value]) => [formatLabel(key, PURCHASE_OPTION_DECISION_LABELS), value])
        .sort((a, b) => b[1] - a[1]);

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
    const allyData = buildSingleDataset('Gestion de aliados', allyEntries, '#14b8a6');
    const unreadBySourceData = buildSingleDataset('Respuestas pendientes', unreadBySourceEntries, '#f97316');
    const creditData = buildSingleDataset('Solicitudes de credito', creditEntries, '#7c3aed');
    const purchaseData = buildSingleDataset('Solicitudes de compra', purchaseEntries, '#db2777');
    const inventoryData = buildSingleDataset('Inventario', inventoryEntries, '#2563eb');
    const salesData = buildSingleDataset('Ventas', salesEntries, '#0f766e');

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
    const optionDecisionData = {
        labels: optionDecisionEntries.map(([label]) => label),
        datasets: [
            {
                label: 'Decisiones sobre opciones',
                data: optionDecisionEntries.map(([, value]) => value),
                backgroundColor: ['#f59e0b', '#16a34a', '#dc2626'],
                borderWidth: 0,
            },
        ],
    };

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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                    <p className="text-sm font-medium text-violet-700">Solicitudes de credito</p>
                    <p className="mt-2 text-3xl font-bold text-violet-800">{stats.credit_applications_count}</p>
                    <p className="mt-2 text-xs text-violet-700">Vista consolidada de la cola de creditos.</p>
                </div>
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                    <p className="text-sm font-medium text-cyan-700">Cola de aliados</p>
                    <p className="mt-2 text-3xl font-bold text-cyan-800">{stats.ally_board_count}</p>
                    <p className="mt-2 text-xs text-cyan-700">Leads donde aliados estan asignados o supervisando.</p>
                </div>
                <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5 shadow-sm">
                    <p className="text-sm font-medium text-pink-700">Solicitudes de compra</p>
                    <p className="mt-2 text-3xl font-bold text-pink-800">{stats.purchase_requests_count}</p>
                    <p className="mt-2 text-xs text-pink-700">Leads en busqueda de vehiculo fuera de inventario.</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
                    <p className="text-sm font-medium text-sky-700">Inventario disponible</p>
                    <p className="mt-2 text-3xl font-bold text-sky-800">{stats.available_inventory_count}</p>
                    <p className="mt-2 text-xs text-sky-700">Vehiculos actualmente libres para gestion comercial.</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <p className="text-sm font-medium text-emerald-700">Ventas aprobadas</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-800">{stats.approved_sales_count}</p>
                    <p className="mt-2 text-xs text-emerald-700">{stats.pending_sales_count} ventas pendientes por decision.</p>
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

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
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

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Gestion de aliados</h3>
                        <p className="text-sm text-slate-500">Estados actuales de la cola donde participan aliados.</p>
                    </div>
                    <div className="h-80">
                        {allyEntries.length > 0 ? (
                            <Bar
                                data={allyData}
                                options={{
                                    indexAxis: 'y',
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: { legend: { display: false } },
                                    scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                                Aun no hay gestion de aliados registrada.
                            </div>
                        )}
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

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Embudo de creditos</h3>
                        <p className="text-sm text-slate-500">Estado actual de las solicitudes de credito.</p>
                    </div>
                    <div className="h-72">
                        {creditEntries.length > 0 ? (
                            <Bar
                                data={creditData}
                                options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: { legend: { display: false } },
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                                Aun no hay solicitudes de credito registradas.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Gestion de compras</h3>
                        <p className="text-sm text-slate-500">Como va la cola de busqueda de vehiculos.</p>
                    </div>
                    <div className="h-72">
                        {purchaseEntries.length > 0 ? (
                            <Bar
                                data={purchaseData}
                                options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: { legend: { display: false } },
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                                Aun no hay solicitudes de compra activas.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Decision de opciones</h3>
                        <p className="text-sm text-slate-500">Respuesta del equipo comercial sobre las opciones encontradas.</p>
                    </div>
                    <div className="h-72">
                        {optionDecisionEntries.length > 0 ? (
                            <Doughnut
                                data={optionDecisionData}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: { legend: { position: 'bottom' } },
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                                Aun no hay decisiones registradas sobre opciones.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Estado del inventario</h3>
                        <p className="text-sm text-slate-500">Disponibles, separados y vendidos dentro de la empresa.</p>
                    </div>
                    <div className="h-72">
                        {inventoryEntries.length > 0 ? (
                            <Bar
                                data={inventoryData}
                                options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: { legend: { display: false } },
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                                No hay vehiculos registrados por ahora.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Estado de ventas</h3>
                        <p className="text-sm text-slate-500">Aprobadas, pendientes y negadas en finanzas y ventas.</p>
                    </div>
                    <div className="h-72">
                        {salesEntries.length > 0 ? (
                            <Bar
                                data={salesData}
                                options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: { legend: { display: false } },
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                                Aun no hay ventas registradas.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
