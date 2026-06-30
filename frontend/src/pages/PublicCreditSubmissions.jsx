import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.DEV ? '/crm/api' : '/api';

const STATUS_OPTIONS = [
    { value: '', label: 'Todos los estados' },
    { value: 'submitted', label: 'Enviada' },
    { value: 'reviewing', label: 'En revisión' },
    { value: 'approved', label: 'Aprobada' },
    { value: 'rejected', label: 'Rechazada' },
];

const statusBadgeClass = (status) => {
    switch (status) {
        case 'approved':
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'rejected':
            return 'bg-rose-100 text-rose-800 border-rose-200';
        case 'reviewing':
            return 'bg-amber-100 text-amber-800 border-amber-200';
        default:
            return 'bg-blue-100 text-blue-800 border-blue-200';
    }
};

const statusLabel = (status) => {
    const found = STATUS_OPTIONS.find((item) => item.value === status);
    return found?.label || status || 'Sin estado';
};

const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return 'Sin dato';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
};

const flattenPayloadSections = (payload) => {
    if (!payload || typeof payload !== 'object') return [];
    return Object.entries(payload).map(([sectionName, sectionValue]) => ({
        sectionName,
        sectionValue: sectionValue && typeof sectionValue === 'object' ? sectionValue : { valor: sectionValue },
    }));
};

const PublicCreditSubmissions = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState('submitted');
    const [savingStatus, setSavingStatus] = useState(false);

    const token = useMemo(() => localStorage.getItem('token'), []);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/public-credit-submissions`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    q: searchTerm || undefined,
                    status: statusFilter || undefined,
                    limit: 200,
                },
            });
            setItems(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudieron cargar las solicitudes públicas de crédito.', 'error');
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const loadDetail = async (id) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/public-credit-submissions/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSelectedItem(response.data);
            setSelectedStatus(response.data?.status || 'submitted');
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo abrir el detalle de la solicitud.', 'error');
        }
    };

    const updateStatus = async () => {
        if (!selectedItem?.id) return;
        setSavingStatus(true);
        try {
            await axios.put(
                `${API_BASE_URL}/public-credit-submissions/${selectedItem.id}`,
                { status: selectedStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Swal.fire('Actualizado', 'El estado de la solicitud fue actualizado.', 'success');
            await Promise.all([fetchItems(), loadDetail(selectedItem.id)]);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', error?.response?.data?.detail || 'No se pudo actualizar el estado.', 'error');
        } finally {
            setSavingStatus(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const attachmentEntries = Object.entries(selectedItem?.attachments || {}).filter(([, value]) => Boolean(value));
    const payloadSections = flattenPayloadSections(selectedItem?.form_payload);

    return (
        <div className="p-8 min-h-screen">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Solicitudes Publicas de Credito</h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        Revisa los formularios públicos enviados, sus adjuntos y el lead creado desde la web.
                    </p>
                </div>
                <button
                    onClick={fetchItems}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                >
                    Recargar
                </button>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre, correo, documento o vehículo..."
                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                    >
                        {STATUS_OPTIONS.map((option) => (
                            <option key={option.value || 'all'} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={fetchItems}
                        className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900"
                    >
                        Buscar
                    </button>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Bandeja</h2>
                            <p className="text-xs text-slate-500">{items.length} solicitud(es)</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="px-6 py-10 text-center text-slate-500">Cargando solicitudes...</div>
                    ) : items.length === 0 ? (
                        <div className="px-6 py-10 text-center text-slate-500">No hay solicitudes para mostrar.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => loadDetail(item.id)}
                                    className={`w-full px-6 py-5 text-left transition hover:bg-slate-50 ${selectedItem?.id === item.id ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(item.status)}`}>
                                                    {statusLabel(item.status)}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-800">{item.applicant_name}</h3>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {item.email} {item.phone ? `· ${item.phone}` : ''}
                                            </p>
                                            <p className="mt-2 text-sm text-slate-700">
                                                <span className="font-semibold">Vehículo:</span> {item.desired_vehicle || 'Sin dato'}
                                            </p>
                                        </div>
                                        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Lead relacionado</p>
                                            <p className="text-sm text-slate-700">
                                                {item.lead_name || 'Sin lead asociado'}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Estado: {item.lead_status || 'Sin estado'}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {!selectedItem ? (
                        <div className="px-6 py-16 text-center text-slate-500">
                            Selecciona una solicitud para revisar el detalle.
                        </div>
                    ) : (
                        <div className="p-6">
                            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">{selectedItem.applicant_name}</h2>
                                    <p className="text-sm text-slate-500">{selectedItem.email}</p>
                                </div>
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(selectedItem.status)}`}>
                                    {statusLabel(selectedItem.status)}
                                </span>
                            </div>

                            <div className="mb-6 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Documento</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">{selectedItem.document_number || 'Sin dato'}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Vehículo deseado</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">{selectedItem.desired_vehicle || 'Sin dato'}</p>
                                </div>
                            </div>

                            <div className="mb-6 rounded-2xl border border-slate-200 p-4">
                                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Gestión interna</p>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                        className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    >
                                        {STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={updateStatus}
                                        disabled={savingStatus}
                                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        {savingStatus ? 'Guardando...' : 'Guardar estado'}
                                    </button>
                                </div>
                            </div>

                            <div className="mb-6 rounded-2xl border border-slate-200 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lead relacionado</p>
                                    {selectedItem.lead_id ? (
                                        <button
                                            onClick={() => navigate(`/admin/leads?leadId=${selectedItem.lead_id}`)}
                                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                        >
                                            Abrir lead
                                        </button>
                                    ) : null}
                                </div>
                                <p className="text-sm text-slate-700">
                                    {selectedItem.lead_name || 'Sin lead asociado'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Estado: {selectedItem.lead_status || 'Sin estado'}
                                </p>
                            </div>

                            <div className="mb-6 rounded-2xl border border-slate-200 p-4">
                                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Adjuntos</p>
                                {attachmentEntries.length === 0 ? (
                                    <p className="text-sm text-slate-500">No hay adjuntos cargados.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {attachmentEntries.map(([key, value]) => (
                                            <a
                                                key={key}
                                                href={value}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-blue-700 hover:bg-slate-100"
                                            >
                                                {key}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                {payloadSections.map(({ sectionName, sectionValue }) => (
                                    <div key={sectionName} className="rounded-2xl border border-slate-200 p-4">
                                        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{sectionName}</p>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {Object.entries(sectionValue).map(([fieldKey, fieldValue]) => (
                                                <div key={fieldKey} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{fieldKey}</p>
                                                    <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-slate-800">
                                                        {formatValue(fieldValue)}
                                                    </pre>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublicCreditSubmissions;
