import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const formatDateTime = (value) => {
    if (!value) return 'Sin fecha';
    return new Date(value).toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const DeletedLeads = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchDeletedLeads = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('https://autosqp.co/api/leads/deleted', {
                headers: { Authorization: `Bearer ${token}` },
                params: search.trim() ? { q: search.trim() } : {}
            });
            setItems(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (error) {
            console.error('Error fetching deleted leads', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudieron cargar los leads eliminados', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeletedLeads();
    }, []);

    const total = useMemo(() => items.length, [items]);

    return (
        <div className="p-4 md:p-6 space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Leads eliminados</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Esta vista conserva trazabilidad de los leads ocultados del tablero y el motivo de eliminación.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, telefono o motivo..."
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-80"
                    />
                    <button
                        type="button"
                        onClick={fetchDeletedLeads}
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                        Actualizar
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-700">Registro de leads eliminados</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {total} lead(s)
                    </span>
                </div>

                {loading ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-400">Cargando leads eliminados...</div>
                ) : items.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-400">No hay leads eliminados para mostrar.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Lead</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Telefono</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Origen</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Gestionado por</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Eliminado por</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Motivo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((lead) => (
                                    <tr key={lead.id} className="align-top">
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">{lead.name || 'Sin nombre'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{lead.phone || 'Sin telefono'}</td>
                                        <td className="px-4 py-3 text-sm uppercase text-slate-600">{lead.source || 'Sin origen'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{lead.assigned_to?.full_name || lead.assigned_to?.email || 'Sin responsable'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{lead.deleted_by?.full_name || lead.deleted_by?.email || 'Sistema'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(lead.deleted_at)}</td>
                                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">{lead.deleted_reason || 'Sin motivo registrado'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeletedLeads;
