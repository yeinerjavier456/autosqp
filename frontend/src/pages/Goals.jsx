import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_BASE_URL = import.meta.env.DEV ? '/crm/api' : '/api';

const getBogotaMonth = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
}).format(new Date());

const TABS = [
    { id: 'purchase', label: 'Metas de compra' },
    { id: 'sales', label: 'Metas de ventas' },
    { id: 'financial', label: 'Activación financiera' },
];

const Goals = () => {
    const [activeTab, setActiveTab] = useState('purchase');
    const [month, setMonth] = useState(getBogotaMonth);
    const [items, setItems] = useState([]);
    const [values, setValues] = useState({});
    const [loading, setLoading] = useState(false);
    const [savingUserId, setSavingUserId] = useState(null);

    const activeLabel = useMemo(
        () => TABS.find((tab) => tab.id === activeTab)?.label || 'Metas',
        [activeTab]
    );
    const totals = useMemo(() => items.reduce((result, item) => ({
        target: result.target + Number(item.target_count || 0),
        actual: result.actual + Number(item.actual_count || 0),
    }), { target: 0, actual: 0 }), [items]);

    const fetchGoals = async () => {
        if (activeTab === 'financial') {
            setItems([]);
            setValues({});
            return;
        }
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/goals`, {
                params: { goal_type: activeTab, month },
                headers: { Authorization: `Bearer ${token}` },
            });
            const nextItems = Array.isArray(response.data?.items) ? response.data.items : [];
            setItems(nextItems);
            setValues(nextItems.reduce((result, item) => ({
                ...result,
                [item.user_id]: String(item.target_count ?? 0),
            }), {}));
        } catch (error) {
            Swal.fire('Error', error.response?.data?.detail || 'No se pudieron cargar las metas', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGoals();
    }, [activeTab, month]);

    const saveGoal = async (item) => {
        const targetCount = Number.parseInt(values[item.user_id] || '0', 10);
        if (!Number.isInteger(targetCount) || targetCount < 0) {
            Swal.fire('Dato inválido', 'La meta debe ser un número entero igual o mayor que cero.', 'warning');
            return;
        }
        setSavingUserId(item.user_id);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(`${API_BASE_URL}/goals`, {
                user_id: item.user_id,
                goal_type: activeTab,
                month,
                target_count: targetCount,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setItems((current) => current.map((currentItem) => (
                currentItem.user_id === item.user_id
                    ? {
                        ...currentItem,
                        ...response.data,
                        actual_count: currentItem.actual_count || 0,
                        completion_percentage: targetCount
                            ? Number((((currentItem.actual_count || 0) / targetCount) * 100).toFixed(2))
                            : 0,
                    }
                    : currentItem
            )));
            Swal.fire({
                icon: 'success',
                title: 'Meta guardada',
                text: `${item.full_name || item.email}: ${targetCount} para ${month}.`,
                timer: 1600,
                showConfirmButton: false,
            });
        } catch (error) {
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo guardar la meta', 'error');
        } finally {
            setSavingUserId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 px-6 py-7 text-white shadow-xl">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold">Metas</h1>
                        <p className="mt-2 text-sm text-blue-100">Configura objetivos mensuales por usuario y conserva el historial de cada periodo.</p>
                    </div>
                    <label className="w-full max-w-xs text-xs font-bold uppercase tracking-wide text-blue-100">
                        Mes y año de las metas y métricas
                        <input
                            type="month"
                            value={month}
                            onChange={(event) => setMonth(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-300"
                        />
                    </label>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`rounded-xl px-5 py-3 text-sm font-bold transition ${activeTab === tab.id ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'financial' ? (
                <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-12 text-center">
                    <div className="text-4xl">⏳</div>
                    <h2 className="mt-4 text-xl font-extrabold text-amber-900">Activación financiera</h2>
                    <p className="mt-2 text-sm text-amber-700">Esta sección está pendiente de definición.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                            <p className="text-xs font-bold uppercase text-blue-600">Meta total del mes</p>
                            <p className="mt-2 text-3xl font-extrabold text-blue-900">{totals.target}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                            <p className="text-xs font-bold uppercase text-emerald-600">Resultado del mes</p>
                            <p className="mt-2 text-3xl font-extrabold text-emerald-900">{totals.actual}</p>
                        </div>
                        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                            <p className="text-xs font-bold uppercase text-violet-600">Cumplimiento general</p>
                            <p className="mt-2 text-3xl font-extrabold text-violet-900">{totals.target ? ((totals.actual / totals.target) * 100).toFixed(1) : '0.0'}%</p>
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-5">
                        <h2 className="text-xl font-extrabold text-slate-800">{activeLabel}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {activeTab === 'purchase' ? 'Usuarios con rol de compras.' : 'Usuarios con rol de asesor o vendedor.'}
                        </p>
                    </div>
                    {loading ? (
                        <div className="p-12 text-center font-semibold text-slate-500">Cargando metas...</div>
                    ) : items.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">No hay usuarios activos con el rol requerido.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-500">Usuario</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-500">Rol</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-500">Mes</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-500">Meta del mes</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-500">Resultado actual</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-500">Cumplimiento</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase text-slate-500">Consecutivo</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold uppercase text-slate-500">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item) => (
                                        <tr key={item.user_id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-800">{item.full_name || item.email}</p>
                                                <p className="text-xs text-slate-500">{item.email}</p>
                                            </td>
                                            <td className="px-6 py-4 text-lg font-extrabold text-emerald-700">{item.actual_count || 0}</td>
                                            <td className="px-6 py-4">
                                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${(item.completion_percentage || 0) >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                    {Number(item.completion_percentage || 0).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{item.role_label || item.role_name}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-700">{month}</td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={values[item.user_id] ?? '0'}
                                                    onChange={(event) => setValues((current) => ({ ...current, [item.user_id]: event.target.value }))}
                                                    className="w-32 rounded-xl border border-blue-200 px-4 py-2 text-right font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-500">
                                                {item.sequence_number ? `#${item.sequence_number}` : 'Se asigna al guardar'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => saveGoal(item)}
                                                    disabled={savingUserId === item.user_id}
                                                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {savingUserId === item.user_id ? 'Guardando...' : 'Guardar meta'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Goals;
