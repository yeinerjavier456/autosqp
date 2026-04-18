import React, { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

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
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const lastFetchedRangeRef = useRef('');
    const requestIdRef = useRef(0);

    const fetchAppointments = async (range) => {
        const rangeKey = `${range?.start || ''}|${range?.end || ''}`;
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
        const leadId = event.extendedProps?.leadId;
        if (!leadId) return;
        navigate(`/admin/leads?leadId=${leadId}`);
    };

    const handleDatesSet = (arg) => {
        const nextRange = { start: arg.startStr, end: arg.endStr };
        fetchAppointments(nextRange);
    };

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">Agenda comercial</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">Calendario de Citas</h1>
                        <p className="mt-2 max-w-2xl text-sm text-slate-600">
                            Consulta las citas programadas por la empresa y abre el lead con un clic para seguir la gestión.
                        </p>
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
        </div>
    );
};

export default AppointmentsCalendar;
