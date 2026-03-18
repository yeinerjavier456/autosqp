import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const GmailCreditAudit = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchItems = async () => {
        if (!user?.company_id) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('https://autosqp.co/api/gmail/credits/processed', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    company_id: user.company_id,
                    limit: 200,
                    q: searchTerm || undefined,
                }
            });
            setItems(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudieron cargar los correos verificados', 'error');
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [user?.company_id]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchItems();
    };

    return (
        <div className="p-8 min-h-screen">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Correos Verificados de Credito</h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        Revisa que correos analizo el sistema, con que lead o solicitud los relaciono y el resumen detectado.
                    </p>
                </div>
                <button
                    onClick={fetchItems}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                >
                    Recargar
                </button>
            </div>

            <form onSubmit={handleSearch} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por remitente, asunto o resumen..."
                        className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900"
                    >
                        Buscar
                    </button>
                </div>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Bandeja de auditoria</h2>
                        <p className="text-xs text-slate-500">{items.length} correo(s) cargados</p>
                    </div>
                </div>

                {loading ? (
                    <div className="px-6 py-10 text-center text-slate-500">Cargando correos verificados...</div>
                ) : items.length === 0 ? (
                    <div className="px-6 py-10 text-center text-slate-500">No hay correos verificados para mostrar.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {items.map((item) => (
                            <div key={item.id} className="px-6 py-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                                                Correo verificado
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {item.processed_at ? new Date(item.processed_at).toLocaleString() : ''}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 break-words">
                                            {item.subject || 'Sin asunto'}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500 break-words">
                                            {item.sender || 'Sin remitente'}
                                        </p>
                                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                                {item.summary || 'Sin resumen'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Relacion</p>
                                        <div className="space-y-2 text-sm text-slate-700">
                                            <p><span className="font-semibold">Lead:</span> {item.lead_name || 'Sin lead relacionado'}</p>
                                            <p><span className="font-semibold">Solicitud:</span> {item.credit_client_name || 'Sin solicitud relacionada'}</p>
                                            <p><span className="font-semibold">Message ID:</span> <span className="break-all text-xs">{item.gmail_message_id}</span></p>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {item.lead_id && (
                                                <button
                                                    onClick={() => navigate(`/admin/leads?leadId=${item.lead_id}`)}
                                                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                                >
                                                    Abrir lead
                                                </button>
                                            )}
                                            {item.credit_application_id && (
                                                <button
                                                    onClick={() => navigate(`/admin/credits?creditId=${item.credit_application_id}`)}
                                                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                                >
                                                    Abrir solicitud
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GmailCreditAudit;
