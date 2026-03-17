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
import { useAuth } from '../context/AuthContext';
import { getRoleName, getRolePermissions } from '../config/views';

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

const LEAD_STATUS_LABELS = {
    new: 'Nuevos',
    contacted: 'Contactados',
    interested: 'En proceso',
    credit_application: 'Solicitud de credito',
    sold: 'Vendidos',
    lost: 'Perdidos',
    ally_managed: 'Aliados'
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

const OPTION_DECISION_LABELS = {
    pending: 'Pendientes',
    accepted: 'Aceptadas',
    rejected: 'Rechazadas'
};

const formatLabel = (key, labelMap) => labelMap[key] || key || 'Sin dato';

const buildBarData = (entries, label, color) => ({
    labels: entries.map(([entryLabel]) => entryLabel),
    datasets: [
        {
            label,
            data: entries.map(([, value]) => value),
            backgroundColor: color,
            borderRadius: 10,
        },
    ],
});

const DashboardMetric = ({ title, value, helper, className = 'border-slate-200 bg-white text-slate-900', helperClassName = 'text-slate-500' }) => (
    <div className={`rounded-2xl border p-5 shadow-sm ${className}`}>
        <p className="text-sm font-medium opacity-80">{title}</p>
        <p className="mt-2 text-3xl font-bold">{value}</p>
        <p className={`mt-2 text-xs ${helperClassName}`}>{helper}</p>
    </div>
);

const AdvisorDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);

    const roleName = getRoleName(user);
    const roleLabel = user?.role?.label || roleName || 'Usuario';
    const permissions = new Set(getRolePermissions(user?.role || { name: roleName }));

    const hasLeadsSection = permissions.has('leads_board') || permissions.has('ally_board') || roleName === 'admin' || roleName === 'super_admin';
    const hasCreditsSection = permissions.has('credits');
    const hasPurchasesSection = permissions.has('purchase_board');
    const hasInventorySection = permissions.has('inventory');
    const hasSalesSection = permissions.has('sales') || permissions.has('my_sales');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('https://autosqp.co/api/stats/advisor', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(response.data);
            } catch (error) {
                console.error('Error fetching role dashboard stats', error);
            }
        };

        if (user?.company_id) fetchStats();
    }, [user]);

    if (!stats) {
        return <div className="p-8 text-center text-gray-500">Cargando tablero...</div>;
    }

    const leadEntries = Object.entries(stats.status_distribution || {})
        .map(([key, value]) => [formatLabel(key, LEAD_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const creditEntries = Object.entries(stats.credit_status_distribution || {})
        .map(([key, value]) => [formatLabel(key, CREDIT_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const purchaseEntries = Object.entries(stats.purchase_status_distribution || {})
        .map(([key, value]) => [formatLabel(key, PURCHASE_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const inventoryEntries = Object.entries(stats.inventory_status_distribution || {})
        .map(([key, value]) => [formatLabel(key, VEHICLE_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const salesEntries = Object.entries(stats.sales_status_distribution || {})
        .map(([key, value]) => [formatLabel(key, SALES_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const optionDecisionEntries = Object.entries(stats.purchase_option_decision_distribution || {})
        .map(([key, value]) => [formatLabel(key, OPTION_DECISION_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const trendEntries = Object.entries(stats.recent_leads_by_day || {});

    const leadTrendData = {
        labels: trendEntries.map(([label]) => label),
        datasets: [
            {
                label: 'Leads recientes',
                data: trendEntries.map(([, value]) => value),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.16)',
                fill: true,
                tension: 0.35,
            },
        ],
    };

    const leadStatusData = {
        labels: leadEntries.map(([label]) => label),
        datasets: [
            {
                label: 'Leads',
                data: leadEntries.map(([, value]) => value),
                backgroundColor: ['#2563eb', '#f59e0b', '#f97316', '#0f766e', '#16a34a', '#dc2626', '#8b5cf6'],
                borderWidth: 0,
            },
        ],
    };

    const creditData = buildBarData(creditEntries, 'Creditos', '#7c3aed');
    const purchaseData = buildBarData(purchaseEntries, 'Compras', '#db2777');
    const inventoryData = buildBarData(inventoryEntries, 'Inventario', '#2563eb');
    const salesData = buildBarData(salesEntries, 'Ventas', '#0f766e');
    const optionDecisionData = {
        labels: optionDecisionEntries.map(([label]) => label),
        datasets: [
            {
                label: 'Opciones',
                data: optionDecisionEntries.map(([, value]) => value),
                backgroundColor: ['#f59e0b', '#16a34a', '#dc2626'],
                borderWidth: 0,
            },
        ],
    };

    return (
        <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-cyan-900 px-6 py-7 text-white shadow-xl">
                <h1 className="text-3xl font-bold">Dashboard de {roleLabel}</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-200">
                    Vista operativa de tu gestión actual: leads, cierres, estados y colas relacionadas según el rol que tienes dentro de la empresa.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DashboardMetric
                    title="Leads a cargo"
                    value={stats.total_leads}
                    helper="Incluye asignados y leads donde quedaste en supervision."
                />
                <DashboardMetric
                    title="Conversion"
                    value={`${stats.conversion_rate}%`}
                    helper={`${stats.leads_sold} cierres sobre tu base actual.`}
                    className="border-emerald-200 bg-emerald-50 text-emerald-900"
                    helperClassName="text-emerald-700"
                />
                <DashboardMetric
                    title="Pipeline activo"
                    value={stats.active_pipeline_count}
                    helper={`${stats.leads_new} leads siguen en estado nuevo.`}
                    className="border-amber-200 bg-amber-50 text-amber-900"
                    helperClassName="text-amber-700"
                />
                <DashboardMetric
                    title="Pendientes por revisar"
                    value={stats.unread_replies_count}
                    helper={`Tiempo medio de respuesta visible: ${stats.response_time_min} min.`}
                    className="border-orange-200 bg-orange-50 text-orange-900"
                    helperClassName="text-orange-700"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {hasCreditsSection && (
                    <DashboardMetric
                        title="Solicitudes de credito"
                        value={stats.credit_total}
                        helper="Casos donde hoy participas o haces seguimiento."
                        className="border-violet-200 bg-violet-50 text-violet-900"
                        helperClassName="text-violet-700"
                    />
                )}
                {hasPurchasesSection && (
                    <DashboardMetric
                        title="Solicitudes de compra"
                        value={stats.purchase_total}
                        helper="Busquedas de vehiculo ligadas a tu gestión."
                        className="border-pink-200 bg-pink-50 text-pink-900"
                        helperClassName="text-pink-700"
                    />
                )}
                {hasSalesSection && (
                    <DashboardMetric
                        title="Ventas"
                        value={stats.sales_total}
                        helper={`${stats.sales_approved} aprobadas y ${stats.sales_pending} pendientes.`}
                        className="border-emerald-200 bg-emerald-50 text-emerald-900"
                        helperClassName="text-emerald-700"
                    />
                )}
                {hasInventorySection && (
                    <DashboardMetric
                        title="Inventario"
                        value={stats.inventory_total}
                        helper="Total de vehiculos visibles para tu operación."
                        className="border-sky-200 bg-sky-50 text-sky-900"
                        helperClassName="text-sky-700"
                    />
                )}
            </div>

            {hasLeadsSection && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Ritmo de gestión en los ultimos 7 dias</h3>
                            <p className="text-sm text-slate-500">Leads recientes que están entrando en tu radar operativo.</p>
                        </div>
                        <div className="h-80">
                            <Line
                                data={leadTrendData}
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
                            <h3 className="text-lg font-bold text-slate-800">Estado de tus leads</h3>
                            <p className="text-sm text-slate-500">Distribución actual de tu gestión comercial.</p>
                        </div>
                        <div className="h-80">
                            <Doughnut
                                data={leadStatusData}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: { legend: { position: 'bottom' } },
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {hasCreditsSection && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Estado de creditos</h3>
                            <p className="text-sm text-slate-500">Solicitudes de crédito que hoy pasan por tu gestión.</p>
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
                                    No tienes solicitudes de credito visibles.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {hasPurchasesSection && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Estado de compras y busquedas</h3>
                            <p className="text-sm text-slate-500">Solicitudes de compra y avance de las opciones encontradas.</p>
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
                                    No tienes solicitudes de compra visibles.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {hasPurchasesSection && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Decision sobre opciones</h3>
                            <p className="text-sm text-slate-500">Qué pasó con las opciones propuestas a los leads.</p>
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
                                    Aun no hay decisiones sobre opciones.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {hasInventorySection && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Estado del inventario</h3>
                            <p className="text-sm text-slate-500">Vehículos disponibles, separados o vendidos.</p>
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
                                    No hay inventario visible para este rol.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {hasSalesSection && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Cierres y ventas</h3>
                            <p className="text-sm text-slate-500">Seguimiento de cierres aprobados, pendientes y negados.</p>
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
                                    Aun no hay ventas visibles para este rol.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdvisorDashboard;
