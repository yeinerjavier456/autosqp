import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { formatBogotaDateTime } from '../utils/dateTime';

export default function DashboardTransitionLeads({ selection, statusLabels, onClose }) {
    const [offset, setOffset] = useState(0);
    const [retry, setRetry] = useState(0);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const closeButton = useRef(null);
    const limit = 50;
    useEffect(() => {
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButton.current?.focus();
        const keydown = event => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'Tab') {
                const controls = Array.from(document.querySelectorAll('[data-transition-dialog] button:not(:disabled)'));
                const first = controls[0], last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        };
        document.addEventListener('keydown', keydown);
        return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); previousFocus?.focus(); };
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError('');
        axios.get('/api/stats/advisor/transitions', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            params: { status: selection.status, start_date: selection.start, end_date: selection.end,
                employee_id: selection.employee || undefined, offset, limit },
            signal: controller.signal, timeout: 30000,
        }).then(({ data }) => { if (!controller.signal.aborted) setResult(data); })
            .catch(failure => {
                if (!controller.signal.aborted) setError(typeof failure.response?.data?.detail === 'string'
                    ? failure.response.data.detail : 'No fue posible cargar los leads. Intenta nuevamente.');
            }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [selection, offset, retry]);

    return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <section data-transition-dialog role="dialog" aria-modal="true" aria-labelledby="transition-dialog-title" className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b p-5">
                <div>
                    <h2 id="transition-dialog-title" className="text-xl font-bold">Leads que pasaron a {statusLabels[selection.status] || selection.status}</h2>
                    <p className="mt-1 text-sm text-slate-600">{selection.employeeName} · Del {selection.start} al {selection.end} · Bogotá, Colombia</p>
                    <p className="mt-2 text-xs text-slate-500">Un registro por lead. La fecha corresponde al último paso a este estado dentro del rango; el estado y responsable actuales pueden ser diferentes.</p>
                </div>
                <button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar listado de leads" className="rounded-xl border px-3 py-2 font-bold hover:bg-slate-100">✕</button>
            </header>
            <div className="min-h-32 overflow-auto p-5" aria-busy={loading}>
                {loading ? <p role="status" className="py-8 text-center text-slate-600">Cargando leads del estado…</p> : error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}<button type="button" onClick={() => setRetry(value => value + 1)} className="ml-3 rounded-lg border px-3 py-2 font-semibold">Reintentar</button></div> : <>
                    <p className="mb-4 text-sm font-semibold">{result?.total || 0} {result?.total === 1 ? 'lead encontrado' : 'leads encontrados'}</p>
                    {!result?.items?.length ? <p className="rounded-xl bg-slate-50 p-8 text-center text-slate-600">No hay leads que coincidan con este estado, empleado y rango.</p> : <table className="w-full min-w-[850px] text-left text-sm">
                        <thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr>{['Lead', 'Teléfono', 'Correo', 'Último paso al estado', 'Estado actual', 'Responsable actual'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
                        <tbody>{result.items.map(lead => <tr key={lead.id} className="border-b border-slate-100 align-top">
                            <td className="p-3"><p className="font-semibold">{lead.name || 'Sin nombre'}</p><span className="text-xs text-slate-500">#{lead.id}</span></td>
                            <td className="p-3">{lead.phone || '—'}</td><td className="break-all p-3">{lead.email || '—'}</td>
                            <td className="p-3">{formatBogotaDateTime(lead.transitioned_at)}</td>
                            <td className="p-3">{statusLabels[lead.current_status] || lead.current_status || 'Sin estado'}</td>
                            <td className="p-3">{lead.assigned_name || 'Sin asignar'}</td>
                        </tr>)}</tbody>
                    </table>}
                </>}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
                <p className="text-sm text-slate-600">{result && !loading && !error ? `Página ${Math.floor(offset / limit) + 1} de ${Math.max(1, Math.ceil(result.total / limit))}` : 'Listado de gestiones'}</p>
                <div className="flex gap-2"><button type="button" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - limit))} className="rounded-xl border px-4 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={loading || Boolean(error) || !result || offset + limit >= result.total} onClick={() => setOffset(value => value + limit)} className="rounded-xl border px-4 py-2 disabled:opacity-40">Siguiente</button><button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Cerrar</button></div>
            </footer>
        </section>
    </div>, document.body);
}
