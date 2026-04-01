import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const VALID_PURCHASE_STATUSES = ['pending', 'in_review', 'approved', 'rejected', 'completed'];

const normalizePurchaseItems = (responseData) => {
    if (Array.isArray(responseData?.items)) return responseData.items;
    if (Array.isArray(responseData?.payload?.items)) return responseData.payload.items;
    if (Array.isArray(responseData?.payload)) return responseData.payload;
    if (Array.isArray(responseData)) return responseData;
    return [];
};

const buildOptionShareText = (option) => {
    const lines = [option.title];
    if (option.description) lines.push(option.description);
    if (Array.isArray(option.photos) && option.photos.length > 0) {
        lines.push('');
        lines.push('Fotos:');
        option.photos.forEach((photo) => lines.push(`https://autosqp.co/api${photo}`));
    }
    return lines.join('\n');
};

const getApiErrorMessage = (error, fallbackMessage) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
        const firstMessage = detail
            .map((item) => item?.msg || item?.message || item?.detail)
            .find((value) => typeof value === 'string' && value.trim());
        if (firstMessage) return firstMessage;
    }
    if (typeof error?.response?.data?.error === 'string' && error.response.data.error.trim()) {
        return error.response.data.error;
    }
    return fallbackMessage;
};

const STATUS_LABELS = {
    pending: 'Solicitud recibida',
    in_review: 'En busqueda',
    approved: 'Opciones encontradas',
    rejected: 'Sin resultado',
    completed: 'Cerrado'
};

const COLUMNS = {
    pending: { id: 'pending', title: 'Solicitud recibida', color: 'bg-amber-100 text-amber-800' },
    in_review: { id: 'in_review', title: 'En busqueda', color: 'bg-sky-100 text-sky-800' },
    approved: { id: 'approved', title: 'Opciones encontradas', color: 'bg-emerald-100 text-emerald-800' },
    rejected: { id: 'rejected', title: 'Sin resultado', color: 'bg-rose-100 text-rose-800' },
    completed: { id: 'completed', title: 'Cerrado', color: 'bg-slate-200 text-slate-800' }
};

const PurchaseBoard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const effectiveRoleName = user?.role?.base_role_name || user?.role?.name || user?.role;
    const leadBoardPath = effectiveRoleName === 'aliado' ? '/aliado/dashboard' : '/admin/leads';
    const [purchases, setPurchases] = useState([]);
    const [purchaseUsers, setPurchaseUsers] = useState([]);
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [assignedFilter, setAssignedFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [globalStatusFilter, setGlobalStatusFilter] = useState('');
    const [showMyPurchasesOnly, setShowMyPurchasesOnly] = useState(false);
    const [purchaseLeadNotes, setPurchaseLeadNotes] = useState([]);
    const [purchaseLeadFiles, setPurchaseLeadFiles] = useState([]);
    const [purchaseOptions, setPurchaseOptions] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creatingManualPurchase, setCreatingManualPurchase] = useState(false);
    const [manualPurchaseForm, setManualPurchaseForm] = useState({
        client_name: '',
        phone: '',
        email: '',
        desired_vehicle: '',
        notes: ''
    });
    const [purchaseNoteInput, setPurchaseNoteInput] = useState('');
    const [purchaseSelectedFiles, setPurchaseSelectedFiles] = useState([]);
    const [optionTitle, setOptionTitle] = useState('');
    const [optionDescription, setOptionDescription] = useState('');
    const [optionPhotos, setOptionPhotos] = useState([]);
    const [savingPurchaseNote, setSavingPurchaseNote] = useState(false);
    const [uploadingPurchaseFiles, setUploadingPurchaseFiles] = useState(false);
    const [savingPurchaseOption, setSavingPurchaseOption] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        fetchPurchases();
        fetchPurchaseUsers();
    }, [user?.id]);

    useEffect(() => {
        if (!selectedPurchase?.lead_id) {
            setPurchaseLeadNotes([]);
            setPurchaseLeadFiles([]);
            setPurchaseOptions([]);
            setPurchaseNoteInput('');
            setPurchaseSelectedFiles([]);
            setOptionTitle('');
            setOptionDescription('');
            setOptionPhotos([]);
            return;
        }
        fetchSelectedPurchaseResources(selectedPurchase.lead_id);
    }, [selectedPurchase?.id, selectedPurchase?.lead_id]);

    const fetchPurchases = async () => {
        if (!user?.id) return;
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setPurchases([]);
                setLoading(false);
                return;
            }
            const response = await axios.get('https://autosqp.co/api/purchases', {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 500 }
            });
            let items = normalizePurchaseItems(response.data);
            if (items.length === 0) {
                const syncResponse = await axios.post('https://autosqp.co/api/purchases/sync', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                items = normalizePurchaseItems(syncResponse.data);
            }
            setPurchases(items.map((item) => ({
                ...item,
                status: VALID_PURCHASE_STATUSES.includes(item?.status) ? item.status : 'pending'
            })));
        } catch (error) {
            console.error(error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudieron cargar las solicitudes de compra'), 'error');
            setPurchases([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchPurchaseUsers = async () => {
        if (!user?.id) return;
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setPurchaseUsers([]);
                return;
            }
            const response = await axios.get('https://autosqp.co/api/users/', {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 500 }
            });
            setPurchaseUsers(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (error) {
            console.error('Error fetching purchase users', error);
            setPurchaseUsers([]);
        }
    };

    const fetchSelectedPurchaseResources = async (leadId) => {
        try {
            const token = localStorage.getItem('token');
            const [notesResponse, filesResponse, optionsResponse] = await Promise.all([
                axios.get(`https://autosqp.co/api/leads/${leadId}/notes`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`https://autosqp.co/api/leads/${leadId}/files`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`https://autosqp.co/api/purchases/${selectedPurchase.id}/options`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setPurchaseLeadNotes(Array.isArray(notesResponse.data) ? notesResponse.data : []);
            setPurchaseLeadFiles(Array.isArray(filesResponse.data) ? filesResponse.data : []);
            setPurchaseOptions(Array.isArray(optionsResponse.data) ? optionsResponse.data : []);
        } catch (error) {
            console.error('Error fetching purchase lead resources', error);
            setPurchaseLeadNotes([]);
            setPurchaseLeadFiles([]);
            setPurchaseOptions([]);
        }
    };

    const handleDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        const purchaseId = parseInt(draggableId, 10);
        setPurchases((prev) => prev.map((item) => item.id === purchaseId ? { ...item, status: newStatus } : item));

        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://autosqp.co/api/purchases/${purchaseId}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (selectedPurchase?.id === purchaseId) {
                setSelectedPurchase((prev) => prev ? { ...prev, status: newStatus } : prev);
            }
        } catch (error) {
            console.error('Error updating purchase status', error);
            Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
            fetchPurchases();
        }
    };

    const handleSyncPurchases = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('https://autosqp.co/api/purchases/sync', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const items = normalizePurchaseItems(response.data);
            if (items.length > 0) {
                setPurchases(items.map((item) => ({
                    ...item,
                    status: VALID_PURCHASE_STATUSES.includes(item?.status) ? item.status : 'pending'
                })));
            } else {
                await fetchPurchases();
            }
            Swal.fire({
                icon: 'success',
                title: 'Solicitudes de compra resincronizadas',
                html: `<div style="text-align:left"><p><strong>Leads revisados:</strong> ${response.data?.processed || 0}</p><p><strong>Solicitudes creadas:</strong> ${response.data?.created || 0}</p><p><strong>Solicitudes actualizadas:</strong> ${response.data?.updated || 0}</p></div>`,
                confirmButtonText: 'Entendido'
            });
        } catch (error) {
            console.error('Error syncing purchases', error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudieron traer las solicitudes de compra'), 'error');
        }
    };

    const handleCreateManualPurchase = async (e) => {
        e.preventDefault();
        if (!manualPurchaseForm.client_name.trim() || !manualPurchaseForm.phone.trim() || !manualPurchaseForm.desired_vehicle.trim()) {
            Swal.fire('Error', 'Nombre, teléfono y vehículo buscado son obligatorios', 'warning');
            return;
        }

        setCreatingManualPurchase(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'https://autosqp.co/api/purchases/manual',
                {
                    client_name: manualPurchaseForm.client_name.trim(),
                    phone: manualPurchaseForm.phone.trim(),
                    email: manualPurchaseForm.email.trim(),
                    desired_vehicle: manualPurchaseForm.desired_vehicle.trim(),
                    notes: manualPurchaseForm.notes.trim()
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const createdPurchase = {
                ...response.data,
                status: VALID_PURCHASE_STATUSES.includes(response.data?.status) ? response.data.status : 'pending'
            };
            setPurchases((prev) => [createdPurchase, ...prev]);
            setSelectedPurchase(createdPurchase);
            setShowCreateModal(false);
            setManualPurchaseForm({
                client_name: '',
                phone: '',
                email: '',
                desired_vehicle: '',
                notes: ''
            });
            await fetchPurchases();
            Swal.fire('Éxito', 'Solicitud de compra creada correctamente', 'success');
        } catch (error) {
            console.error('Error creating manual purchase request', error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudo crear la solicitud manual'), 'error');
        } finally {
            setCreatingManualPurchase(false);
        }
    };

    const handlePurchaseNoteSubmit = async () => {
        if (!selectedPurchase?.id || !purchaseNoteInput.trim()) return;
        setSavingPurchaseNote(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`https://autosqp.co/api/purchases/${selectedPurchase.id}/notes`, {
                content: purchaseNoteInput.trim()
            }, { headers: { Authorization: `Bearer ${token}` } });
            const updatedPurchase = response.data?.purchase;
            if (updatedPurchase) {
                setSelectedPurchase(updatedPurchase);
                setPurchases((prev) => prev.map((item) => item.id === updatedPurchase.id ? {
                    ...item,
                    ...updatedPurchase,
                    status: VALID_PURCHASE_STATUSES.includes(updatedPurchase?.status) ? updatedPurchase.status : 'pending'
                } : item));
            }
            if (response.data?.lead_note) {
                setPurchaseLeadNotes((prev) => [response.data.lead_note, ...prev]);
            }
            setPurchaseNoteInput('');
            Swal.fire('Éxito', 'Nota agregada correctamente', 'success');
        } catch (error) {
            console.error('Error adding purchase note', error);
            Swal.fire('Error', 'No se pudo agregar la nota', 'error');
        } finally {
            setSavingPurchaseNote(false);
        }
    };

    const handlePurchaseFileUpload = async () => {
        if (!selectedPurchase?.id || purchaseSelectedFiles.length === 0) return;
        setUploadingPurchaseFiles(true);
        try {
            const token = localStorage.getItem('token');
            for (const file of purchaseSelectedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                await axios.post(`https://autosqp.co/api/purchases/${selectedPurchase.id}/files`, formData, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                });
            }
            setPurchaseSelectedFiles([]);
            await fetchSelectedPurchaseResources(selectedPurchase.lead_id);
            Swal.fire('Éxito', 'Documentos agregados correctamente', 'success');
        } catch (error) {
            console.error('Error uploading purchase files', error);
            Swal.fire('Error', 'No se pudieron agregar los documentos', 'error');
        } finally {
            setUploadingPurchaseFiles(false);
        }
    };

    const handleCreatePurchaseOption = async () => {
        if (!selectedPurchase?.id) return;
        if (!optionTitle.trim()) {
            Swal.fire('Error', 'Debes indicar el nombre o referencia de la opción', 'warning');
            return;
        }
        if (optionPhotos.length < 3) {
            Swal.fire('Error', 'Debes adjuntar mínimo 3 fotos por opción', 'warning');
            return;
        }

        setSavingPurchaseOption(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('title', optionTitle.trim());
            formData.append('description', optionDescription.trim());
            optionPhotos.forEach((photo) => formData.append('photos', photo));

            const response = await axios.post(
                `https://autosqp.co/api/purchases/${selectedPurchase.id}/options`,
                formData,
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
            );

            setPurchaseOptions((prev) => [response.data, ...prev]);
            setOptionTitle('');
            setOptionDescription('');
            setOptionPhotos([]);
            await fetchSelectedPurchaseResources(selectedPurchase.lead_id);
            Swal.fire('Éxito', 'Opción agregada correctamente', 'success');
        } catch (error) {
            console.error('Error creating purchase option', error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudo agregar la opcion'), 'error');
        } finally {
            setSavingPurchaseOption(false);
        }
    };

    const handleCopyOptionText = async (option) => {
        try {
            await navigator.clipboard.writeText(buildOptionShareText(option));
            Swal.fire('Éxito', 'Texto copiado para compartir con el lead', 'success');
        } catch (error) {
            console.error('Error copying option text', error);
            Swal.fire('Error', 'No se pudo copiar el texto', 'error');
        }
    };

    const handleDownloadOptionPhotos = (option) => {
        if (!Array.isArray(option.photos) || option.photos.length === 0) return;
        option.photos.forEach((photo, index) => {
            const link = document.createElement('a');
            link.href = `https://autosqp.co/api${photo}`;
            link.download = `${option.title || 'opcion'}-${index + 1}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    const filteredPurchases = purchases.filter((purchase) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch = !normalizedSearch || [purchase.client_name, purchase.phone, purchase.email, purchase.desired_vehicle]
            .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
        const createdDate = purchase.created_at ? String(purchase.created_at).slice(0, 10) : '';
        const matchesDate = !dateFilter || createdDate === dateFilter;
        const matchesMine = !showMyPurchasesOnly || purchase.assigned_to_id === user?.id;
        const parsedUserFilter = userFilter ? parseInt(userFilter, 10) : null;
        const matchesUser = !parsedUserFilter || purchase.assigned_to_id === parsedUserFilter;
        const isAssigned = !!purchase.assigned_to_id;
        const matchesAssigned = !assignedFilter || (assignedFilter === 'assigned' ? isAssigned : !isAssigned);
        const matchesStatus = !globalStatusFilter || (purchase.status || 'pending') === globalStatusFilter;
        return matchesSearch && matchesDate && matchesMine && matchesUser && matchesAssigned && matchesStatus;
    });

    const getPurchasesByStatus = (status) => filteredPurchases.filter((item) => (item.status || 'pending') === status);
    const getPurchaseStatusLabel = (status) => STATUS_LABELS[status] || status || 'Sin estado';

    if (loading) {
        return <div className="p-8 text-slate-500">Cargando solicitudes de compra...</div>;
    }

    return (
        <div className="p-8 min-h-screen">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Compras y Búsquedas</h1>
                    <p className="text-slate-500 mt-1 font-medium">Administra los vehículos que los clientes están buscando cuando no están en inventario.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Nueva solicitud manual
                    </button>
                    <button
                        onClick={handleSyncPurchases}
                        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v6h6M20 20v-6h-6M5.64 18.36A9 9 0 0018.36 18.36M18.36 5.64A9 9 0 005.64 5.64" />
                        </svg>
                        Traer solicitudes de compra
                    </button>
                </div>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <input type="text" placeholder="Buscar por cliente, telefono, email o vehiculo..." className="xl:col-span-2 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <input type="date" className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                    <select className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white" value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
                        <option value="">Asignacion</option>
                        <option value="assigned">Asignadas</option>
                        <option value="unassigned">Sin asignar</option>
                    </select>
                    <select className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                        <option value="">Responsable</option>
                        {purchaseUsers.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.email}</option>)}
                    </select>
                    <select className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white" value={globalStatusFilter} onChange={(e) => setGlobalStatusFilter(e.target.value)}>
                        <option value="">Estado global</option>
                        {Object.values(COLUMNS).map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
                    </select>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={showMyPurchasesOnly} onChange={(e) => setShowMyPurchasesOnly(e.target.checked)} />
                        Mis solicitudes
                    </label>
                    <button type="button" onClick={() => { setSearchTerm(''); setDateFilter(''); setAssignedFilter(''); setUserFilter(''); setGlobalStatusFilter(''); setShowMyPurchasesOnly(false); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
                        Limpiar filtros
                    </button>
                    <span className="text-xs font-medium text-slate-400">{filteredPurchases.length} solicitud(es) visibles</span>
                </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-6 overflow-x-auto pb-8 snap-x">
                    {Object.values(COLUMNS).map((col) => (
                        <div key={col.id} className="min-w-[320px] flex flex-col bg-slate-50/50 rounded-2xl p-4 snap-center border border-slate-200 h-[calc(100vh-200px)]">
                            <div className={`flex items-center justify-between px-3 py-3 mb-4 rounded-xl ${col.color} bg-opacity-20`}>
                                <h3 className="font-bold text-sm uppercase tracking-wide">{col.title}</h3>
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-white bg-opacity-50">{getPurchasesByStatus(col.id).length}</span>
                            </div>
                            <Droppable droppableId={col.id}>
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="flex-1 overflow-y-auto custom-scrollbar px-1">
                                        {getPurchasesByStatus(col.id).map((purchase, index) => (
                                            <Draggable key={purchase.id} draggableId={purchase.id.toString()} index={index}>
                                                {(dragProvided) => (
                                                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} onClick={() => setSelectedPurchase(purchase)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-3 hover:shadow-md transition cursor-pointer group">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-bold text-slate-800">{purchase.client_name}</h4>
                                                            <span className="text-xs text-slate-400 font-mono">#{purchase.id}</span>
                                                        </div>
                                                        <div className="text-sm font-semibold text-blue-600 mb-3">{purchase.desired_vehicle}</div>
                                                        <div className="space-y-1 text-xs text-slate-500">
                                                            <div className="flex justify-between gap-2"><span>Telefono:</span><span className="font-medium text-slate-700 truncate">{purchase.phone || 'Sin telefono'}</span></div>
                                                            {purchase.email && <div className="flex justify-between gap-2"><span>Email:</span><span className="font-medium text-slate-700 truncate">{purchase.email}</span></div>}
                                                        </div>
                                                        {purchase.notes && <p className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg border border-slate-100 p-2 line-clamp-3">{purchase.notes}</p>}
                                                        <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
                                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-pink-50 text-pink-700 border-pink-100">Compras</span>
                                                            <span className="text-[10px] text-slate-400">{new Date(purchase.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>

            {selectedPurchase && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedPurchase(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Solicitud de compra #{selectedPurchase.id}</h2>
                                <p className="text-slate-500 mt-1">{selectedPurchase.client_name}</p>
                            </div>
                            <button onClick={() => setSelectedPurchase(null)} className="text-2xl text-gray-400 hover:text-gray-600">&times;</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Cliente</p>
                                <div className="space-y-2 text-sm text-slate-700">
                                    <p><span className="font-semibold">Telefono:</span> {selectedPurchase.phone || 'Sin telefono'}</p>
                                    <p><span className="font-semibold">Email:</span> {selectedPurchase.email || 'Sin email'}</p>
                                    <p><span className="font-semibold">Vehiculo buscado:</span> {selectedPurchase.desired_vehicle}</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Proceso de compra</p>
                                <div className="space-y-2 text-sm text-slate-700">
                                    <p><span className="font-semibold">Estado:</span> {getPurchaseStatusLabel(selectedPurchase.status)}</p>
                                    <p><span className="font-semibold">Asignado a:</span> {purchaseUsers.find((person) => person.id === selectedPurchase.assigned_to_id)?.full_name || 'Sin asignar'}</p>
                                    <p><span className="font-semibold">Creado:</span> {selectedPurchase.created_at ? new Date(selectedPurchase.created_at).toLocaleString() : 'Sin fecha'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Notas de la solicitud</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedPurchase.notes || 'Sin notas registradas.'}</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Opciones encontradas</p>
                                <span className="text-xs font-semibold text-slate-400">{purchaseOptions.length} opcion(es)</span>
                            </div>
                            {purchaseOptions.length > 0 ? (
                                <div className="space-y-4">
                                    {purchaseOptions.map((option) => (
                                        <div key={option.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-800">{option.title}</h4>
                                                    {option.description && <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{option.description}</p>}
                                                </div>
                                                <span className="text-[11px] text-slate-400">{option.created_at ? new Date(option.created_at).toLocaleDateString() : 'Reciente'}</span>
                                            </div>
                                            {Array.isArray(option.photos) && option.photos.length > 0 && (
                                                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                                                    {option.photos.map((photo, index) => (
                                                        <a key={`${option.id}-${index}`} href={`https://autosqp.co/api${photo}`} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                                            <img src={`https://autosqp.co/api${photo}`} alt={option.title} className="h-28 w-full object-cover" />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyOptionText(option)}
                                                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                                                >
                                                    Copiar texto
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadOptionPhotos(option)}
                                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                                >
                                                    Descargar fotos
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">Aún no se han registrado opciones para este lead.</p>
                            )}

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Agregar opción</p>
                                <div className="grid grid-cols-1 gap-3">
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: Mazda CX-5 2022 gris"
                                        value={optionTitle}
                                        onChange={(e) => setOptionTitle(e.target.value)}
                                    />
                                    <textarea
                                        rows="3"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        placeholder="Describe precio, kilometraje, ubicación, negociación o cualquier detalle relevante..."
                                        value={optionDescription}
                                        onChange={(e) => setOptionDescription(e.target.value)}
                                    />
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="flex-1 text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                                            onChange={(e) => setOptionPhotos(Array.from(e.target.files || []))}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCreatePurchaseOption}
                                            disabled={savingPurchaseOption}
                                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            {savingPurchaseOption ? 'Guardando...' : 'Agregar opción'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500">Debes adjuntar mínimo 3 fotos por opción. Puedes cargar muchas opciones al mismo lead.</p>
                                    {optionPhotos.length > 0 && (
                                        <p className="text-xs font-semibold text-emerald-700">{optionPhotos.length} foto(s) seleccionada(s)</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Agregar nota desde compras</p>
                                {selectedPurchase.lead_id ? (
                                    <>
                                        <textarea rows="3" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500" placeholder="Escribe la nota que quieres dejar en esta búsqueda..." value={purchaseNoteInput} onChange={(e) => setPurchaseNoteInput(e.target.value)} />
                                        <div className="mt-3 flex justify-end">
                                            <button type="button" onClick={handlePurchaseNoteSubmit} disabled={savingPurchaseNote || !purchaseNoteInput.trim()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                                                {savingPurchaseNote ? 'Guardando...' : 'Guardar nota'}
                                            </button>
                                        </div>
                                    </>
                                ) : <p className="text-sm text-slate-500">Esta solicitud no tiene lead relacionado para sincronizar notas.</p>}
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Documentos del proceso</p>
                                {selectedPurchase.lead_id ? (
                                    <>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <input type="file" multiple className="flex-1 text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100" onChange={(e) => setPurchaseSelectedFiles(Array.from(e.target.files || []))} />
                                            <button type="button" onClick={handlePurchaseFileUpload} disabled={uploadingPurchaseFiles || purchaseSelectedFiles.length === 0} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50">
                                                {uploadingPurchaseFiles ? 'Subiendo...' : `Subir ${purchaseSelectedFiles.length > 0 ? `(${purchaseSelectedFiles.length})` : ''}`}
                                            </button>
                                        </div>
                                        {purchaseLeadFiles.length > 0 && (
                                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                {purchaseLeadFiles.map((file) => (
                                                    <a key={file.id} href={`https://autosqp.co/api${file.file_path}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50">
                                                        {file.file_name}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : <p className="text-sm text-slate-500">Solo puedes adjuntar documentos cuando la solicitud esté ligada a un lead.</p>}
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Trazabilidad reflejada en el lead</p>
                                {purchaseLeadNotes.length > 0 ? (
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {purchaseLeadNotes.map((note) => (
                                              <div key={note.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                                  <p className="text-[11px] font-semibold text-slate-500">
                                                      {note.user?.full_name || note.user?.email || 'Usuario'}
                                                  </p>
                                                  <p className="text-sm text-slate-700">{note.content}</p>
                                                  <p className="mt-1 text-[11px] text-slate-400">{note.created_at ? new Date(note.created_at).toLocaleString() : 'Reciente'}</p>
                                              </div>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-slate-500">Aún no hay notas registradas para este lead desde compras.</p>}
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-3">
                            {selectedPurchase.lead_id && (
                                <button onClick={() => navigate(`${leadBoardPath}?leadId=${selectedPurchase.lead_id}`)} className="px-4 py-2 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50">
                                    Abrir lead relacionado
                                </button>
                            )}
                            <button onClick={() => setSelectedPurchase(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Nueva solicitud de compra</h2>
                                <p className="mt-1 text-sm text-slate-500">Crea una búsqueda manual desde compras y quedará ligada a un lead interno.</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-2xl text-slate-400 hover:text-slate-600">&times;</button>
                        </div>

                        <form onSubmit={handleCreateManualPurchase} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700">Nombre del cliente</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        value={manualPurchaseForm.client_name}
                                        onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, client_name: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700">Teléfono</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        value={manualPurchaseForm.phone}
                                        onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, phone: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-bold text-slate-700">Email</label>
                                <input
                                    type="email"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={manualPurchaseForm.email}
                                    onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, email: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-bold text-slate-700">Vehículo buscado</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej: Mazda CX-30 Touring 2023 gris"
                                    value={manualPurchaseForm.desired_vehicle}
                                    onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, desired_vehicle: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-bold text-slate-700">Notas iniciales</label>
                                <textarea
                                    rows="4"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    placeholder="Escribe contexto, presupuesto, ciudad o cualquier dato útil para la búsqueda..."
                                    value={manualPurchaseForm.notes}
                                    onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingManualPurchase}
                                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {creatingManualPurchase ? 'Creando...' : 'Crear solicitud'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseBoard;
