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
import { useNavigate } from 'react-router-dom';

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

const LEAD_SOURCE_LABELS = {
    web: 'Web',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    showroom: 'Showroom',
    ally: 'Aliado',
    aliado: 'Aliado',
    referred: 'Referido',
    manual: 'Manual',
    sin_fuente: 'Sin fuente'
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

const getLast7DaysRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);

    const formatDate = (date) => date.toISOString().slice(0, 10);

    return {
        start: formatDate(start),
        end: formatDate(end)
    };
};

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

const DashboardMetric = ({ title, value, helper, onClick, className = 'border-slate-200 bg-white text-slate-900', helperClassName = 'text-slate-500' }) => {
    const sharedClassName = `rounded-2xl border p-5 shadow-sm text-left transition ${className}`;
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={`${sharedClassName} hover:-translate-y-0.5 hover:shadow-md cursor-pointer`}>
                <p className="text-sm font-medium opacity-80">{title}</p>
                <p className="mt-2 text-3xl font-bold">{value}</p>
                <p className={`mt-2 text-xs ${helperClassName}`}>{helper}</p>
            </button>
        );
    }
    return (
        <div className={sharedClassName}>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            <p className={`mt-2 text-xs ${helperClassName}`}>{helper}</p>
        </div>
    );
};

const AdvisorDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [dashboardView, setDashboardView] = useState('autosqp');
    const defaultRange = getLast7DaysRange();
    const [startDate, setStartDate] = useState(defaultRange.start);
    const [endDate, setEndDate] = useState(defaultRange.end);

    const roleName = getRoleName(user);
    const roleLabel = user?.role?.label || roleName || 'Usuario';
    const permissions = new Set(getRolePermissions(user?.role || { name: roleName }));

    const hasLeadsSection = permissions.has('leads_board') || permissions.has('ally_board') || roleName === 'admin' || roleName === 'super_admin';
    const hasAllySection = permissions.has('ally_board') || roleName === 'admin' || roleName === 'super_admin';
    const hasCreditsSection = permissions.has('credits');
    const hasPurchasesSection = permissions.has('purchase_board');
    const hasInventorySection = permissions.has('inventory');
    const hasSalesSection = permissions.has('sales') || permissions.has('my_sales');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('https://autosqp.co/api/stats/advisor', {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        start_date: startDate,
                        end_date: endDate
                    }
                });
                setStats(response.data);
            } catch (error) {
                console.error('Error fetching role dashboard stats', error);
            }
        };

        if (user?.company_id && startDate && endDate) fetchStats();
    }, [user, startDate, endDate]);

    if (!stats) {
        return <div className="p-8 text-center text-gray-500">Cargando tablero...</div>;
    }

    const leadEntries = Object.entries(stats.status_distribution || {})
        .map(([key, value]) => [formatLabel(key, LEAD_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const allyEntries = Object.entries(stats.ally_status_distribution || {})
        .map(([key, value]) => [formatLabel(key, LEAD_STATUS_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const sourceEntries = Object.entries(stats.source_distribution || {})
        .map(([key, value]) => [formatLabel(key, LEAD_SOURCE_LABELS), value])
        .sort((a, b) => b[1] - a[1]);
    const allySourceEntries = Object.entries(stats.ally_source_distribution || {})
        .map(([key, value]) => [formatLabel(key, LEAD_SOURCE_LABELS), value])
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
    const allyData = buildBarData(allyEntries, 'Aliados', '#14b8a6');
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
    const topManagers = Array.isArray(stats.top_managers) ? stats.top_managers : [];
    const topStatusMovers = Array.isArray(stats.top_status_movers) ? stats.top_status_movers : [];
    const allyTopManagers = Array.isArray(stats.ally_top_managers) ? stats.ally_top_managers : [];
    const advisorManagers = topManagers.filter((manager) => manager?.role_name === 'asesor');

    const rangeLabel = `del ${startDate} al ${endDate}`;
    const trendTitle = 'Ritmo de gestión del rango elegido';
    const trendDescription = 'Leads gestionados dentro del rango manual seleccionado.';
    const leadBoardPath = permissions.has('ally_board') && !permissions.has('leads_board')
        ? '/aliado/dashboard'
        : '/admin/leads';
    const isAllyDashboard = dashboardView === 'allies';
    const dashboardLeadTotal = isAllyDashboard ? stats.ally_total : stats.total_leads;
    const dashboardLeadsNew = isAllyDashboard ? stats.ally_leads_new : stats.leads_new;
    const dashboardLeadsSold = isAllyDashboard ? stats.ally_leads_sold : stats.leads_sold;
    const dashboardConversionRate = isAllyDashboard ? stats.ally_conversion_rate : stats.conversion_rate;
    const dashboardActivePipeline = isAllyDashboard ? stats.ally_active_pipeline_count : stats.active_pipeline_count;
    const dashboardUnreadReplies = isAllyDashboard ? stats.ally_unread_replies_count : stats.unread_replies_count;
    const dashboardNewLeadsInRange = isAllyDashboard ? stats.ally_new_leads_in_range : stats.new_leads_in_range;
    const dashboardStatusChanges = isAllyDashboard ? stats.ally_status_changes_in_range : stats.status_changes_in_range;
    const topAdvisorManager = advisorManagers[0] || null;
    const topManager = isAllyDashboard
        ? (allyTopManagers[0] || null)
        : (topStatusMovers[0] || topManagers[0] || null);
    const currentSourceEntries = isAllyDashboard ? allySourceEntries : sourceEntries;
    const leadSourceData = {
        labels: currentSourceEntries.map(([label]) => label),
        datasets: [
            {
                label: 'Fuentes',
                data: currentSourceEntries.map(([, value]) => value),
                backgroundColor: ['#2563eb', '#16a34a', '#f97316', '#ec4899', '#0f766e', '#8b5cf6', '#f59e0b', '#64748b'],
                borderWidth: 0,
            },
        ],
    };
    const currentSourceTitle = isAllyDashboard ? 'Fuentes de leads de aliados' : 'Fuentes de leads';
    const currentSourceDescription = isAllyDashboard
        ? 'Origen de los leads donde participan aliados en el rango seleccionado.'
        : 'Origen de los leads de AutosQP dentro del rango seleccionado.';
    const currentTrendData = isAllyDashboard
        ? {
            labels: Object.entries(stats.ally_recent_leads_by_day || {}).map(([label]) => label),
            datasets: [
                {
                    label: 'Leads de aliados',
                    data: Object.entries(stats.ally_recent_leads_by_day || {}).map(([, value]) => value),
                    borderColor: '#14b8a6',
                    backgroundColor: 'rgba(20, 184, 166, 0.16)',
                    fill: true,
                    tension: 0.35,
                },
            ],
        }
        : leadTrendData;
    const currentTrendTitle = isAllyDashboard ? 'Ritmo de gestión de aliados' : trendTitle;
    const currentTrendDescription = isAllyDashboard
        ? 'Leads donde un aliado participa dentro del rango seleccionado.'
        : trendDescription;
    const currentRanking = isAllyDashboard ? allyTopManagers : topManagers;

    return (
        <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-cyan-900 px-6 py-7 text-white shadow-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Dashboard de {roleLabel}</h1>
                        <p className="mt-2 max-w-3xl text-sm text-slate-200">
                            Vista operativa general de la empresa: leads, cierres, estados y colas relacionadas según los accesos disponibles para tu rol.
                        </p>
                        {hasAllySection && (
                            <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDashboardView('autosqp')}
                                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${!isAllyDashboard ? 'bg-white text-slate-900 shadow-md' : 'border border-white/20 bg-white/10 text-cyan-50 hover:bg-white/20'}`}
                                >
                                    AutosQP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDashboardView('allies')}
                                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${isAllyDashboard ? 'bg-white text-slate-900 shadow-md' : 'border border-white/20 bg-white/10 text-cyan-50 hover:bg-white/20'}`}
                                >
                                    Aliados
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="w-full max-w-3xl">
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-cyan-100">Rango de fechas</label>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none backdrop-blur-sm transition focus:border-cyan-200"
                            />
                            <input
                                type="date"
                                value={endDate}
                                min={startDate || undefined}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none backdrop-blur-sm transition focus:border-cyan-200"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const range = getLast7DaysRange();
                                    setStartDate(range.start);
                                    setEndDate(range.end);
                                }}
                                className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-white/20"
                            >
                                Últimos 7 días
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DashboardMetric
                    title={isAllyDashboard ? 'Leads de aliados' : 'Leads a cargo'}
                    value={dashboardLeadTotal}
                    helper={isAllyDashboard
                        ? `Incluye solo leads que están en gestión de aliados ${rangeLabel}.`
                        : `Incluye el comportamiento general de leads de AutosQP ${rangeLabel}.`}
                    onClick={(isAllyDashboard ? hasAllySection : hasLeadsSection) ? () => navigate(isAllyDashboard ? '/aliado/dashboard' : leadBoardPath) : undefined}
                />
                <DashboardMetric
                    title="Conversion"
                    value={`${dashboardConversionRate}%`}
                    helper={`${dashboardLeadsSold} cierres registrados en el rango ${rangeLabel}.`}
                    onClick={hasSalesSection ? () => navigate(permissions.has('my_sales') && !permissions.has('sales') ? '/admin/my-sales' : '/admin/sales') : undefined}
                    className="border-emerald-200 bg-emerald-50 text-emerald-900"
                    helperClassName="text-emerald-700"
                />
                <DashboardMetric
                    title={isAllyDashboard ? 'Pipeline activo' : 'Asesor que más gestiona'}
                    value={isAllyDashboard
                        ? dashboardActivePipeline
                        : (topAdvisorManager ? (topAdvisorManager.full_name || topAdvisorManager.email || 'Asesor') : 'Sin datos')}
                    helper={isAllyDashboard
                        ? `${dashboardLeadsNew} leads siguen en estado nuevo ${rangeLabel}.`
                        : (topAdvisorManager
                            ? `${topAdvisorManager.count} acciones registradas para ${topAdvisorManager.role_label || 'Asesor / Vendedor'} en el rango.`
                            : 'Aun no hay acciones registradas por asesores o vendedores en el rango.')}
                    onClick={(isAllyDashboard ? hasAllySection : hasLeadsSection) ? () => navigate(isAllyDashboard ? '/aliado/dashboard' : leadBoardPath) : undefined}
                    className="border-amber-200 bg-amber-50 text-amber-900"
                    helperClassName="text-amber-700"
                />
                <DashboardMetric
                    title="Pendientes por revisar"
                    value={dashboardUnreadReplies}
                    helper={`Tiempo medio de respuesta visible: ${stats.response_time_min} min.`}
                    onClick={(isAllyDashboard ? hasAllySection : hasLeadsSection) ? () => navigate(isAllyDashboard ? '/aliado/dashboard' : leadBoardPath) : undefined}
                    className="border-orange-200 bg-orange-50 text-orange-900"
                    helperClassName="text-orange-700"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DashboardMetric
                    title="Nuevos del rango"
                    value={dashboardNewLeadsInRange}
                    helper="Leads creados dentro del rango seleccionado."
                    onClick={(isAllyDashboard ? hasAllySection : hasLeadsSection) ? () => navigate(isAllyDashboard ? '/aliado/dashboard' : leadBoardPath) : undefined}
                    className="border-blue-200 bg-blue-50 text-blue-900"
                    helperClassName="text-blue-700"
                />
                <DashboardMetric
                    title="Cambios de estado"
                    value={dashboardStatusChanges}
                    helper="Movimientos de estado registrados en el periodo."
                    onClick={(isAllyDashboard ? hasAllySection : hasLeadsSection) ? () => navigate(isAllyDashboard ? '/aliado/dashboard' : leadBoardPath) : undefined}
                    className="border-indigo-200 bg-indigo-50 text-indigo-900"
                    helperClassName="text-indigo-700"
                />
                <DashboardMetric
                    title="Usuario que más gestiona"
                    value={topManager ? (topManager.full_name || topManager.email || 'Usuario') : 'Sin datos'}
                    helper={topManager ? `${topManager.count} cambios de estado registrados en el rango.` : 'Aun no hay cambios de estado registrados en el rango.'}
                    className="border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900"
                    helperClassName="text-fuchsia-700"
                />
            </div>

            {!isAllyDashboard && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {hasCreditsSection && (
                    <DashboardMetric
                        title="Solicitudes de credito"
                        value={stats.credit_total}
                        helper="Solicitudes de crédito generales de la empresa dentro del rango."
                        onClick={() => navigate('/admin/credits')}
                        className="border-violet-200 bg-violet-50 text-violet-900"
                        helperClassName="text-violet-700"
                    />
                )}
                {hasPurchasesSection && (
                    <DashboardMetric
                        title="Solicitudes de compra"
                        value={stats.purchase_total}
                        helper="Búsquedas de vehículo generales de la empresa dentro del rango."
                        onClick={() => navigate('/admin/purchases')}
                        className="border-pink-200 bg-pink-50 text-pink-900"
                        helperClassName="text-pink-700"
                    />
                )}
                {hasSalesSection && (
                    <DashboardMetric
                        title="Ventas"
                        value={stats.sales_total}
                        helper={`${stats.sales_approved} aprobadas y ${stats.sales_pending} pendientes.`}
                        onClick={() => navigate(permissions.has('my_sales') && !permissions.has('sales') ? '/admin/my-sales' : '/admin/sales')}
                        className="border-emerald-200 bg-emerald-50 text-emerald-900"
                        helperClassName="text-emerald-700"
                    />
                )}
                {hasInventorySection && (
                    <DashboardMetric
                        title="Inventario"
                        value={stats.inventory_total}
                        helper="Total de vehículos visibles en la empresa."
                        onClick={() => navigate('/admin/inventory')}
                        className="border-sky-200 bg-sky-50 text-sky-900"
                        helperClassName="text-sky-700"
                    />
                )}
            </div>
            )}

            {(isAllyDashboard ? hasAllySection : hasLeadsSection) && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">{currentTrendTitle}</h3>
                            <p className="text-sm text-slate-500">{currentTrendDescription}</p>
                        </div>
                        <div className="h-80">
                            <Line
                                data={currentTrendData}
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
                            <h3 className="text-lg font-bold text-slate-800">{isAllyDashboard ? 'Estado de leads de aliados' : 'Estado general de leads'}</h3>
                            <p className="text-sm text-slate-500">{isAllyDashboard ? 'Distribución actual de la gestión donde participan aliados.' : 'Distribución actual de los leads de AutosQP en el rango seleccionado.'}</p>
                        </div>
                        <div className="h-80">
                            {isAllyDashboard ? (
                                allyEntries.length > 0 ? (
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
                                        Aun no hay actividad de aliados visible.
                                    </div>
                                )
                            ) : (
                                <Doughnut
                                    data={leadStatusData}
                                    options={{
                                        maintainAspectRatio: false,
                                        plugins: { legend: { position: 'bottom' } },
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {(isAllyDashboard ? hasAllySection : hasLeadsSection) && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">{currentSourceTitle}</h3>
                        <p className="text-sm text-slate-500">{currentSourceDescription}</p>
                    </div>
                    <div className="h-80">
                        {currentSourceEntries.length > 0 ? (
                            <Doughnut
                                data={leadSourceData}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: { legend: { position: 'bottom' } },
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                                Aun no hay fuentes de leads registradas en este rango.
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-800">{isAllyDashboard ? 'Quién asigna leads a aliados' : 'Ranking de gestión por usuario'}</h3>
                    <p className="text-sm text-slate-500">
                        {isAllyDashboard
                            ? 'Gestión registrada sobre leads del tablero de aliados dentro del rango seleccionado.'
                            : 'Acciones registradas en historial dentro del rango seleccionado para todos los usuarios que gestionaron leads.'}
                    </p>
                </div>
                {currentRanking.length > 0 ? (
                    <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                        {currentRanking.map((manager, index) => (
                            <div key={`${manager.user_id}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{manager.full_name || manager.email || `Usuario ${manager.user_id}`}</p>
                                    <p className="text-xs text-slate-500">{manager.email || 'Sin correo visible'}</p>
                                </div>
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
                                    {manager.count}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex h-32 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                        Aun no hay registros para este rango.
                    </div>
                )}
            </div>

            {!isAllyDashboard && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {hasCreditsSection && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Estado de creditos</h3>
                            <p className="text-sm text-slate-500">Solicitudes de crédito generales de la empresa en el rango seleccionado.</p>
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
                                    No hay solicitudes de crédito registradas en este rango.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {hasPurchasesSection && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Estado de compras y busquedas</h3>
                            <p className="text-sm text-slate-500">Solicitudes de compra generales de la empresa y avance de las opciones encontradas.</p>
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
                                    No hay solicitudes de compra registradas en este rango.
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
            )}
        </div>
    );
};

export default AdvisorDashboard;
