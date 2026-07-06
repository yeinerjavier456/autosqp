import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

const LEAD_STATUS_OPTIONS = [
    { value: 'new', label: 'Nuevo' },
    { value: 'contacted', label: 'Contactado' },
    { value: 'in_process', label: 'En proceso' },
    { value: 'credit_study', label: 'Estudio de credito' },
    { value: 'approvals', label: 'Aprobaciones' },
    { value: 'reserved', label: 'Reservado' },
    { value: 'preparation', label: 'Alistamientos' },
    { value: 'lost', label: 'Perdido' },
    { value: 'sold', label: 'Vendido' },
];

const TIME_UNIT_LABELS = {
    minutes: 'minutos',
    hours: 'horas',
    days: 'dias',
};

const isAdvisorUser = (person) => {
    const roleText = [
        person?.role?.base_role_name,
        person?.role?.name,
        person?.role?.label,
    ].filter(Boolean).join(' ').toLowerCase();
    return roleText.includes('asesor') || roleText.includes('vendedor');
};

const canReceiveAlertReassignment = (person) => (
    isAdvisorUser(person) && Boolean(person?.auto_assign_leads)
);

const isAdminUser = (person) => {
    const roleText = [
        person?.role?.base_role_name,
        person?.role?.name,
        person?.role?.label,
    ].filter(Boolean).join(' ').toLowerCase();
    return (
        roleText.includes('super_admin') ||
        roleText.includes('super admin') ||
        roleText.includes('super administrador') ||
        roleText.includes('admin') ||
        roleText.includes('administrador')
    );
};

const AdminAlerts = () => {
    const { user } = useAuth();
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [users, setUsers] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        event_type: 'time_in_status',
        condition_value: 'new',
        time_value: 1,
        time_unit: 'hours',
        recipient_type: 'assigned_advisor',
        specific_user_id: '',
        is_repeating: false,
        repeat_interval: 60,
        reassign_after_alerts_enabled: false,
        reassign_after_alerts_count: 1,
        reassign_to_user_id: 'random'
    });

    const [editingId, setEditingId] = useState(null);

    const getStatusLabel = (status) => LEAD_STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
    const companyUsers = users.filter((person) => {
        if (person?.is_active === false || person?.is_active === 0) return false;
        if (user?.company_id && String(person?.company_id || '') !== String(user.company_id)) return false;
        return true;
    });
    const notificationUsers = companyUsers.filter((person) => !isAdminUser(person));
    const advisorUsers = companyUsers.filter((person) => canReceiveAlertReassignment(person));

    useEffect(() => {
        fetchRules();
        fetchUsers();
    }, []);

    const fetchRules = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/rules/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRules(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/users/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data.items || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const payload = {
                ...formData,
                specific_user_id: formData.specific_user_id ? parseInt(formData.specific_user_id) : null,
                reassign_after_alerts_enabled: Boolean(formData.reassign_after_alerts_enabled),
                reassign_after_alerts_count: formData.reassign_after_alerts_enabled ? parseInt(formData.reassign_after_alerts_count || 1, 10) : 0,
                reassign_to_user_id: formData.reassign_after_alerts_enabled && formData.reassign_to_user_id && formData.reassign_to_user_id !== 'random' ? parseInt(formData.reassign_to_user_id, 10) : null,
                is_active: 1
            };

            if (editingId) {
                await axios.put(`/api/rules/${editingId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/rules/', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            fetchRules();
            setShowModal(false);
            resetForm();
            Swal.fire('Guardado', 'Regla guardada correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo guardar la regla', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "No podrás revertir esto",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar'
        });

        if (result.isConfirmed) {
            try {
                const token = localStorage.getItem('token');
                await axios.delete(`/api/rules/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                fetchRules();
                Swal.fire('Eliminado', 'La regla ha sido eliminada', 'success');
            } catch (error) {
                Swal.fire('Error', error.response?.data?.detail || 'No se pudo eliminar', 'error');
            }
        }
    };

    const handleEdit = (rule) => {
        setFormData({
            name: rule.name,
            event_type: rule.event_type,
            condition_value: rule.condition_value,
            time_value: rule.time_value,
            time_unit: rule.time_unit,
            recipient_type: rule.recipient_type,
            specific_user_id: rule.specific_user_id || '',
            is_repeating: rule.is_repeating || false,
            repeat_interval: rule.repeat_interval || 60,
            reassign_after_alerts_enabled: Boolean(rule.reassign_after_alerts_enabled),
            reassign_after_alerts_count: rule.reassign_after_alerts_count || 1,
            reassign_to_user_id: rule.reassign_to_user_id || 'random'
        });
        setEditingId(rule.id);
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            event_type: 'time_in_status',
            condition_value: 'new',
            time_value: 1,
            time_unit: 'hours',
            recipient_type: 'assigned_advisor',
            specific_user_id: '',
            is_repeating: false,
            repeat_interval: 60,
            reassign_after_alerts_enabled: false,
            reassign_after_alerts_count: 1,
            reassign_to_user_id: 'random'
        });
        setEditingId(null);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando reglas...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Automatización de Alertas</h1>
                    <p className="text-slate-500 mt-1">Configura recordatorios y alertas automáticas basadas en el estado de tus leads.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition transform hover:scale-105"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Nueva Regla
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rules.map(rule => (
                    <div key={rule.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-slate-800">{rule.name}</h3>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(rule)} className="text-blue-600 hover:text-blue-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:text-red-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>
                                    Si el estado es <strong className="text-slate-800">{getStatusLabel(rule.condition_value)}</strong> por mas de <strong>{rule.time_value} {TIME_UNIT_LABELS[rule.time_unit] || rule.time_unit}</strong>
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                <span>
                                    Enviar a: <strong>{
                                        rule.recipient_type === 'assigned_advisor' ? 'Asesor Asignado' :
                                            rule.recipient_type === 'all_admins' ? 'Todos los Admins' :
                                                notificationUsers.find(u => u.id === rule.specific_user_id)?.email || 'Usuario Específico'
                                    }</strong>
                                </span>
                            </div>
                            {rule.reassign_after_alerts_enabled && (
                                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" /></svg>
                                    <span>
                                        Reasignar tras <strong>{rule.reassign_after_alerts_count || 1}</strong> alerta(s) a <strong>{rule.reassign_to_user_id ? (users.find(u => u.id === rule.reassign_to_user_id)?.email || 'usuario destino') : 'asesor con asignación automática disponible'}</strong>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative animate-fade-in-up">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        <h2 className="text-2xl font-bold mb-6 text-slate-800">{editingId ? 'Editar Regla' : 'Nueva Regla de Alerta'}</h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nombre de la Alerta</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Ej: Lead desatendido por 2 horas"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Si el lead está en estado</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.condition_value}
                                        onChange={e => setFormData({ ...formData, condition_value: e.target.value })}
                                    >
                                        {LEAD_STATUS_OPTIONS.map((status) => (
                                            <option key={status.value} value={status.value}>{status.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Durante más de</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            className="w-20 border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.time_value}
                                            onChange={e => setFormData({ ...formData, time_value: parseInt(e.target.value) })}
                                            min="1"
                                            required
                                        />
                                        <select
                                            className="flex-1 border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.time_unit}
                                            onChange={e => setFormData({ ...formData, time_unit: e.target.value })}
                                        >
                                            <option value="minutes">Minutos</option>
                                            <option value="hours">Horas</option>
                                            <option value="days">Días</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Enviar notificación a</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.recipient_type}
                                    onChange={e => setFormData({ ...formData, recipient_type: e.target.value })}
                                >
                                    <option value="assigned_advisor">Asesor Asignado</option>
                                    <option value="specific_user">Usuario Específico</option>
                                </select>
                            </div>

                            {/* Repetition Settings */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        id="is_repeating"
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        checked={formData.is_repeating}
                                        onChange={e => setFormData({ ...formData, is_repeating: e.target.checked })}
                                    />
                                    <label htmlFor="is_repeating" className="text-sm font-bold text-slate-700 select-none cursor-pointer">
                                        ¿Repetir alerta si la condición persiste?
                                    </label>
                                </div>

                                {formData.is_repeating && (
                                    <div className="ml-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Repetir cada (minutos)</label>
                                        <input
                                            type="number"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.repeat_interval}
                                            onChange={e => setFormData({ ...formData, repeat_interval: parseInt(e.target.value) })}
                                            min="1"
                                            required={formData.is_repeating}
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Se enviará una nueva notificación cada X minutos mientras el lead siga en ese estado.</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        id="reassign_after_alerts_enabled"
                                        className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                        checked={formData.reassign_after_alerts_enabled}
                                        onChange={e => setFormData({
                                            ...formData,
                                            reassign_after_alerts_enabled: e.target.checked,
                                            reassign_to_user_id: e.target.checked ? (formData.reassign_to_user_id || 'random') : 'random',
                                            reassign_after_alerts_count: e.target.checked ? formData.reassign_after_alerts_count : 1
                                        })}
                                    />
                                    <div>
                                        <label htmlFor="reassign_after_alerts_enabled" className="text-sm font-bold text-amber-900 select-none cursor-pointer">
                                            Reasignar el lead automáticamente
                                        </label>
                                        <p className="text-xs text-amber-800 mt-1">
                                            Si el lead sigue sin atenderse y esta alerta aparece varias veces, se reasigna a un asesor o vendedor con asignación automática habilitada.
                                        </p>
                                    </div>
                                </div>

                                {formData.reassign_after_alerts_enabled && (
                                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Después de alertas</label>
                                            <input
                                                type="number"
                                                className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                value={formData.reassign_after_alerts_count}
                                                onChange={e => setFormData({ ...formData, reassign_after_alerts_count: parseInt(e.target.value || '1', 10) })}
                                                min="1"
                                                required={formData.reassign_after_alerts_enabled}
                                            />
                                            {Number(formData.reassign_after_alerts_count || 0) > 1 && !formData.is_repeating && (
                                                <p className="mt-1 text-xs font-semibold text-red-600">Activa repetir alerta para usar más de 1 aparición.</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Reasignar a</label>
                                            <select
                                                className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                value={formData.reassign_to_user_id}
                                                onChange={e => setFormData({ ...formData, reassign_to_user_id: e.target.value })}
                                                required={formData.reassign_after_alerts_enabled}
                                            >
                                                <option value="random">Aleatorio entre asesores/vendedores con asignación automática</option>
                                                {advisorUsers.map(u => (
                                                    <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role?.label || u.role?.name || 'Asesor'})</option>
                                                ))}
                                            </select>
                                            <p className="mt-1 text-xs text-amber-800">
                                                Aleatorio excluye al asesor actual y solo usa usuarios con asignación automática activa.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {formData.recipient_type === 'specific_user' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Seleccionar Usuario</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.specific_user_id}
                                        onChange={e => setFormData({ ...formData, specific_user_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Selecciona un usuario...</option>
                                        {notificationUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.email} ({u.role?.label || u.role?.name || 'Sin rol'})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg"
                                >
                                    Guardar Regla
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAlerts;
