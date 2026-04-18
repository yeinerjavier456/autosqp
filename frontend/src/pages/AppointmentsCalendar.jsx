import React, { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { useAuth } from '../context/AuthContext';

const getAppointmentPalette = (status) => {
    switch ((status || '').toLowerCase()) {
        case 'completed':
            return {
                backgroundColor: '#dcfce7',
                borderColor: '#22c55e',
                textColor: '#166534'
            };
        case 'cancelled':
            return {
                backgroundColor: '#fee2e2',
                borderColor: '#ef4444',
                textColor: '#991b1b'
            };
        default:
            return {
                backgroundColor: '#dbeafe',
                borderColor: '#2563eb',
                textColor: '#1e3a8a'
            };
    }
};

const AppointmentsCalendar = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const getRoleName = (u) => {
        if (!u) return '';
        const role = u.role;
        if (typeof role === 'string') return role;
        if (role && role.base_role_name) return role.base_role_name;
        if (role && role.name) return role.name;
        return '';
    };
    const roleName = getRoleName(user).toLowerCase().trim();
    const isAdmin = roleName === 'admin' || roleName === 'super_admin';

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('all');
    const [activeAppointment, setActiveAppointment] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', note: '', appointment_date: '' });
    const lastFetchedRangeRef = useRef('');
    const currentRangeRef = useRef(null);
    const requestIdRef = useRef(0);

    const fetchAppointments = async (range, currentViewMode = viewMode) => {
        const rangeKey = `${range?.start || ''}|${range?.end || ''}|${currentViewMode}`;
        if (!rangeKey || rangeKey === lastFetchedRangeRef.current) {
            setLoading(false);
            return;
        }

        lastFetchedRangeRef.current = rangeKey;
        requestIdRef.current += 1;
        const currentRequestId = requestIdRef.current;

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params = {};

            if (range?.start) params.start = range.start;
            if (range?.end) params.end = range.end;
            if (currentViewMode !== 'all') params.view_mode = currentViewMode;

            const response = await axios.get('https://autosqp.co/api/appointments/', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            if (currentRequestId === requestIdRef.current) {
                setAppointments(Array.isArray(response.data) ? response.data : []);
            }
        } catch (error) {
            console.error('Error fetching appointments:', error);
            if (currentRequestId === requestIdRef.current) {
                setAppointments([]);
            }
        } finally {
            if (currentRequestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    };

    const events = useMemo(() => (
        appointments.map((appointment) => {
            const palette = getAppointmentPalette(appointment.status);
            const leadName = appointment?.lead?.name || 'Lead sin nombre';

            return {
                id: String(appointment.id),
                title: leadName,
                start: appointment.appointment_date,
                allDay: false,
                backgroundColor: palette.backgroundColor,
                borderColor: palette.borderColor,
                textColor: palette.textColor,
                extendedProps: {
                    leadId: appointment?.lead?.id,
                    phone: appointment?.lead?.phone || '',
                    detail: appointment?.title || appointment?.note || 'Cita programada',
                    advisorName: appointment?.user?.full_name || appointment?.user?.email || 'Sin responsable',
                    status: appointment?.status || 'scheduled'
                }
            };
        })
    ), [appointments]);

    const todayCount = useMemo(() => {
        const today = new Date().toDateString();
        return appointments.filter((appointment) => new Date(appointment.appointment_date).toDateString() === today).length;
    }, [appointments]);

    const upcomingCount = useMemo(() => {
        const now = new Date();
        return appointments.filter((appointment) => new Date(appointment.appointment_date) >= now).length;
    }, [appointments]);

    const handleEventClick = ({ event }) => {
        const appointmentId = event.id;
        const appointment = appointments.find(a => String(a.id) === appointmentId);
        if (appointment) {
            setActiveAppointment(appointment);
            setEditForm({
                title: appointment.title || '',
                note: appointment.note || '',
                appointment_date: new Date(appointment.appointment_date).toISOString().slice(0, 16)
            });
            setIsEditModalOpen(true);
        }
    };

    const handleUpdateAppointment = async () => {
        if (!activeAppointment) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://autosqp.co/api/appointments/${activeAppointment.id}`, {
                title: editForm.title,
                note: editForm.note,
                appointment_date: new Date(editForm.appointment_date).toISOString()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditModalOpen(false);
            if (currentRangeRef.current) {
                fetchAppointments(currentRangeRef.current, viewMode);
            }
        } catch (error) {
            console.error('Error updating appointment:', error);
            alert('Error al actualizar la cita');
        }
    };

    const handleDeleteAppointment = async () => {
        if (!activeAppointment) return;
        if (!window.confirm('¿Estás seguro de que deseas eliminar esta cita?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`https://autosqp.co/api/appointments/${activeAppointment.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditModalOpen(false);
            if (currentRangeRef.current) {
                fetchAppointments(currentRangeRef.current, viewMode);
            }
        } catch (error) {
            console.error('Error deleting appointment:', error);
            alert('Error al eliminar la cita');
        }
    };

    const handleViewLead = () => {
        if (!activeAppointment?.lead?.id) return;
        navigate(`/admin/leads?leadId=${activeAppointment.lead.id}`);
    };

    const handleDatesSet = (arg) => {
        const nextRange = { start: arg.startStr, end: arg.endStr };
        currentRangeRef.current = nextRange;
        fetchAppointments(nextRange, viewMode);
    };

    const handleViewModeChange = (e) => {
        const newMode = e.target.value;
        setViewMode(newMode);
        if (currentRangeRef.current) {
            fetchAppointments(currentRangeRef.current, newMode);
        }
    };

    const renderEventContent = (eventInfo) => {
        const advisorName = eventInfo.event.extendedProps?.advisorName || 'Sin responsable';
        const detail = eventInfo.event.extendedProps?.detail || 'Cita programada';

        return (
            <div className="px-1 py-0.5 leading-tight">
                <div className="text-[11px] font-semibold opacity-80">{eventInfo.timeText}</div>
                <div className="truncate text-xs font-bold">{eventInfo.event.title}</div>
                <div className="truncate text-[11px] opacity-80">Generó: {advisorName}</div>
                <div className="truncate text-[11px] opacity-70">{detail}</div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">Agenda comercial</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">Calendario de Citas</h1>
                        <p className="mt-2 max-w-2xl text-sm text-slate-600">
                            Los administradores ven todas las citas; el resto del equipo solo ve las que agendó. Haz clic en una cita para abrir el lead.
                        </p>
                        {isAdmin && (
                            <div className="mt-4 inline-flex items-center space-x-2">
                                <label htmlFor="viewMode" className="text-sm font-medium text-slate-700">Ver:</label>
                                <select
                                    id="viewMode"
                                    value={viewMode}
                                    onChange={handleViewModeChange}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="all">Todas las citas</option>
                                    <option value="me">Mis citas</option>
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total</p>
                            <p className="mt-1 text-2xl font-black text-blue-900">{appointments.length}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Hoy</p>
                            <p className="mt-1 text-2xl font-black text-emerald-900">{todayCount}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pendientes</p>
                            <p className="mt-1 text-2xl font-black text-amber-900">{upcomingCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                <div className="relative appointments-calendar">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-[1px]">
                            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm">
                                Cargando citas...
                            </div>
                        </div>
                    )}
                    <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="timeGridWeek"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay'
                        }}
                        buttonText={{
                            today: 'Hoy',
                            month: 'Mes',
                            week: 'Semana',
                            day: 'Día'
                        }}
                        locale={esLocale}
                        firstDay={1}
                        height="auto"
                        allDaySlot={false}
                        slotMinTime="07:00:00"
                        slotMaxTime="20:00:00"
                        events={events}
                        eventContent={renderEventContent}
                        eventClick={handleEventClick}
                        datesSet={handleDatesSet}
                        eventTimeFormat={{
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        }}
                    />
                    {!loading && events.length === 0 && (
                        <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-500">
                            No hay citas programadas en este rango.
                        </div>
                    )}
                </div>
            </div>

            {isEditModalOpen && activeAppointment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">Detalles de la Cita</h3>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Título</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha y Hora</label>
                                <input
                                    type="datetime-local"
                                    value={editForm.appointment_date}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, appointment_date: e.target.value }))}
                                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</label>
                                <textarea
                                    value={editForm.note}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                                    rows="3"
                                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex flex-wrap gap-2">
                            <button
                                onClick={handleUpdateAppointment}
                                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                Guardar
                            </button>
                            <button
                                onClick={handleViewLead}
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Ver Lead
                            </button>
                            <button
                                onClick={handleDeleteAppointment}
                                className="flex-1 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentsCalendar;
