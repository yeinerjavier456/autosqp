import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import Swal from 'sweetalert2';

// Draggable Lead Card Component
const LeadCard = ({ lead, status, onDragStart, onViewHistory }) => {
    const getSourceColor = (source) => {
        switch (source?.toLowerCase()) {
            case 'facebook': return 'bg-blue-100 text-blue-700';
            case 'instagram': return 'bg-pink-100 text-pink-700';
            case 'whatsapp': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div
            draggable="true"
            onDragStart={(e) => onDragStart(e, lead.id)}
            className="bg-white p-4 rounded-xl shadow-sm border-2 hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-grab active:cursor-grabbing group relative animate-fade-in"
            style={{
                borderColor: '#e5e7eb',
                borderLeftColor:
                    status === 'new' ? '#3b82f6' :
                        status === 'contacted' ? '#eab308' :
                            status === 'interested' ? '#f97316' :
                                status === 'sold' ? '#22c55e' : '#9ca3af',
                borderLeftWidth: '6px'
            }}
        >
            <div className="flex justify-between items-start mb-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${getSourceColor(lead.source)}`}>
                    {lead.source || 'WEB'}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                    {new Date(lead.created_at).toLocaleDateString()}
                </span>
            </div>

            <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight">{lead.name}</h4>

            {lead.phone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 font-medium">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {lead.phone}
                </div>
            )}

            <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic mb-3">
                "{lead.message}"
            </p>

            {/* Actions Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-auto">
                {/* Advisor Info */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 text-[9px]">
                        {lead.assigned_to?.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                </div>

                {/* View History Button */}
                <button
                    onClick={() => onViewHistory(lead)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    title="Ver historial de seguimiento"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Seguimiento
                </button>
            </div>
        </div>
    );
};

// Kanban Column
const KanbanColumn = ({ title, status, leads, color, onDragOver, onDrop, onDragStart, onViewHistory }) => {
    return (
        <div
            className="flex-1 min-w-[320px] bg-slate-50/80 rounded-2xl p-4 border border-slate-200 flex flex-col h-full backdrop-blur-sm"
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, status)}
        >
            <div className={`flex items-center justify-between mb-4 pb-3 border-b border-gray-200 ${color}`}>
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-current shadow-sm"></span>
                    {title}
                </h3>
                <span className="bg-white text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                    {leads.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar pb-10">
                {leads.map(lead => (
                    <LeadCard
                        key={lead.id}
                        lead={lead}
                        status={status}
                        onDragStart={onDragStart}
                        onViewHistory={onViewHistory}
                    />
                ))}
            </div>
        </div>
    );
};

// History Modal Component
const HistoryModal = ({ lead, onClose, onUpdate, advisors, onAssign }) => {
    const [assignedAdvisor, setAssignedAdvisor] = useState(lead?.assigned_to?.id || '');
    const { createReminder } = useNotifications();
    const [newComment, setNewComment] = useState('');
    const [newStatus, setNewStatus] = useState(lead?.status || 'new');
    const [loading, setLoading] = useState(false);

    // Load Lead Messages
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Reply State
    const [replyMessage, setReplyMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    // Reminder State
    const [reminderDate, setReminderDate] = useState('');
    const [reminderNote, setReminderNote] = useState('');

    useEffect(() => {
        if (lead && lead.id) {
            fetchMessages();
        }
    }, [lead]);

    const fetchMessages = async () => {
        setLoadingMessages(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`https://autosqp.co/api/leads/${lead.id}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Reverse so oldest is top, newest is bottom
            setMessages(Array.isArray(response.data) ? response.data.reverse() : []);
        } catch (error) {
            console.error("Error fetching lead messages", error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!replyMessage.trim()) return;

        // Ensure we have a conversation ID (from existing messages)
        const conversationId = messages.length > 0 ? messages[0].conversation_id : null;
        if (!conversationId && lead.source !== 'whatsapp') {
            Swal.fire('Atención', 'Este cliente aún no ha iniciado una conversación en Meta.', 'info');
            return;
        }

        setSendingReply(true);
        try {
            const token = localStorage.getItem('token');
            const source = lead.source?.toLowerCase();

            if (source === 'whatsapp') {
                // Determine Whatsapp Route
                await axios.post('https://autosqp.co/api/whatsapp/send_message', {
                    phone_number: lead.phone,
                    message_text: replyMessage
                }, { headers: { Authorization: `Bearer ${token}` } });

            } else if (source === 'facebook' || source === 'instagram') {
                // Determine Meta Route
                await axios.post(`https://autosqp.co/api/meta/conversations/${conversationId}/send`, {
                    conversation_id: conversationId,
                    sender_type: 'user',
                    content: replyMessage,
                    message_type: 'text'
                }, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                Swal.fire('Error', 'Este lead no proviene de una red social conectada.', 'error');
                setSendingReply(false);
                return;
            }

            setReplyMessage('');
            fetchMessages(); // Refresh chat
        } catch (error) {
            console.error("Error sending reply", error);
            Swal.fire('Error', 'No se pudo enviar el mensaje', 'error');
        } finally {
            setSendingReply(false);
        }
    };

    if (!lead) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) {
            Swal.fire('Error', 'Debes escribir una nota o comentario', 'warning');
            return;
        }

        setLoading(true);
        try {
            await onUpdate(lead.id, newStatus, newComment);
            setNewComment('');
        } catch (error) {
            console.error("Update failed", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateReminder = async () => {
        if (!reminderDate || !reminderNote) {
            Swal.fire('Error', 'Fecha y nota son requeridas', 'warning');
            return;
        }
        await createReminder(lead.id, reminderDate, reminderNote);
        setReminderDate('');
        setReminderNote('');
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-fade-in-up border border-gray-100 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Detalles del Lead</h2>
                        <p className="text-sm text-gray-500">Cliente: <span className="font-semibold text-blue-600">{lead.name}</span></p>
                        <div className="text-sm text-gray-500 mt-2 flex items-center gap-2">Asignado a:
                            <select
                                className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 focus:ring-blue-500 outline-none font-semibold text-indigo-600"
                                value={assignedAdvisor}
                                onChange={(e) => {
                                    setAssignedAdvisor(e.target.value);
                                    if (onAssign) onAssign(lead.id, e.target.value);
                                }}
                            >
                                <option value="">Sin asignar</option>
                                {advisors && advisors.map(adv => (
                                    <option key={adv.id} value={adv.id}>{adv.full_name || adv.email}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 space-y-6">

                    {/* Reminder Section */}
                    <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                        <h3 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Programar Recordatorio
                        </h3>
                        <div className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="w-full sm:flex-1">
                                <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Fecha y Hora</label>
                                <input
                                    type="datetime-local"
                                    className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                    value={reminderDate}
                                    onChange={(e) => setReminderDate(e.target.value)}
                                />
                            </div>
                            <div className="w-full sm:flex-[2]">
                                <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Nota</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Llamar..."
                                    className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                    value={reminderNote}
                                    onChange={(e) => setReminderNote(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleCreateReminder}
                                className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm h-[38px]"
                            >
                                Agendar
                            </button>
                        </div>
                    </div>

                    {/* Status Update Section */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Agregar Nota / Actualizar Estado
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-1">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Estado</label>
                                    <select
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="new">Nuevo</option>
                                        <option value="contacted">Contactado</option>
                                        <option value="interested">Interesado</option>
                                        <option value="lost">Perdido</option>
                                        <option value="sold">Vendido</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nota / Comentario</label>
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        rows="1"
                                        placeholder="Escribe detalles..."
                                    ></textarea>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {loading ? 'Guardando...' : 'Guardar Nota y Actualizar'}
                            </button>
                        </form>
                    </div>

                    {/* Chat Messages List */}
                    {messages.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 mt-4 overflow-hidden flex flex-col h-80">
                            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    Conversación del Cliente ({messages.length})
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 custom-scrollbar">
                                {loadingMessages ? (
                                    <div className="text-center text-sm text-gray-400 py-4">Cargando mensajes...</div>
                                ) : (
                                    messages.map((msg, index) => (
                                        <div key={msg.id || index} className={`flex flex-col ${msg.sender_type === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className="flex items-end gap-1 mb-1">
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    {msg.sender_type === 'user' ? (msg.sender?.email || 'Nosotros') : lead.name}
                                                </span>
                                            </div>
                                            <div className={`px-4 py-2 rounded-2xl max-w-[85%] ${msg.sender_type === 'user'
                                                ? 'bg-blue-600 text-white rounded-br-sm shadow-sm'
                                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                                                }`}>
                                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                            </div>
                                            <span className="text-[9px] text-gray-400 mt-1">
                                                {new Date(msg.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Reply Input Form */}
                            {(lead.source === 'facebook' || lead.source === 'instagram' || lead.source === 'whatsapp') && (
                                <form onSubmit={handleSendReply} className="bg-white border-t border-gray-200 p-2 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder={`Responder por ${lead.source}...`}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={replyMessage}
                                        onChange={(e) => setReplyMessage(e.target.value)}
                                        disabled={sendingReply}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!replyMessage.trim() || sendingReply}
                                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {sendingReply ? '...' : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    {/* History List */}
                    <div>
                        <div className="flex border-b border-gray-200 mb-4">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-b-2 border-blue-600 py-2 inline-block">
                                Historial de Cambios
                            </h3>
                        </div>
                        <div className="space-y-4">
                            {lead.history && lead.history.length > 0 ? (
                                [...lead.history].reverse().map((record) => (
                                    <div key={record.id} className="flex gap-4 group">
                                        <div className="flex flex-col items-center">
                                            <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 ring-4 ring-white"></div>
                                            <div className="w-0.5 flex-1 bg-gray-100 group-last:hidden"></div>
                                        </div>
                                        <div className="flex-1 pb-6">
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 group-hover:border-blue-100 transition shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white bg-gray-400`}>
                                                            {record.previous_status || 'N/A'}
                                                        </span>
                                                        <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white 
                                                                ${record.new_status === 'sold' ? 'bg-green-500' :
                                                                record.new_status === 'lost' ? 'bg-gray-500' : 'bg-blue-500'}`}>
                                                            {record.new_status}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-mono">
                                                        {record.created_at ? new Date(record.created_at).toLocaleString() : 'Reciente'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 italic">"{record.comment || 'Sin comentario'}"</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    No hay historial registrado para este lead.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LeadsBoard = () => {
    const { user } = useAuth();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [assignedFilter, setAssignedFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [globalStatusFilter, setGlobalStatusFilter] = useState('');
    const [showFiltersMenu, setShowFiltersMenu] = useState(false);

    // Modal State - Sales
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [selectedLeadForSale, setSelectedLeadForSale] = useState(null);
    const [availableVehicles, setAvailableVehicles] = useState([]);
    const [advisors, setAdvisors] = useState([]);
    const [saleForm, setSaleForm] = useState({ vehicle_id: '', sale_price: '', seller_id: '' });

    // Modal State - Status Comment
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState(null);
    const [statusComment, setStatusComment] = useState('');

    // Modal State - History View
    const [selectedLeadForHistory, setSelectedLeadForHistory] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    // Modal State - New Lead
    const [showAddLeadModal, setShowAddLeadModal] = useState(false);
    const [newLeadForm, setNewLeadForm] = useState({
        name: '',
        email: '',
        phone: '',
        source: 'web',
        message: '',
        status: 'new'
    });

    useEffect(() => {
        fetchLeads();
        fetchAdvisors();
    }, []);

    const handleCreateLead = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('https://autosqp.co/api/leads', {
                ...newLeadForm,
                company_id: user?.company_id || 1
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setLeads(prev => [response.data, ...prev]);
            setShowAddLeadModal(false);
            setNewLeadForm({ name: '', email: '', phone: '', source: 'web', message: '', status: 'new' });

            Swal.fire({
                icon: 'success',
                title: 'Lead Creado',
                text: 'El lead se ha creado exitosamente.',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: "Error creando el lead: " + (error.response?.data?.detail || error.message)
            });
        }
    };

    const fetchLeads = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('https://autosqp.co/api/leads', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLeads(Array.isArray(response.data.items) ? response.data.items : []);
        } catch (error) {
            console.error("Error fetching leads", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableVehicles = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('https://autosqp.co/api/vehicles/?status=available', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAvailableVehicles(response.data.items || []);
        } catch (error) {
            console.error("Error fetching vehicles", error);
        }
    };

    const fetchAdvisors = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('https://autosqp.co/api/users/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const validRoles = ['advisor', 'seller', 'vendedor', 'asesor'];
            const users = response.data.items.filter(u => validRoles.includes(u.role?.name));
            setAdvisors(users);
        } catch (error) {
            console.error("Error fetching advisors", error);
        }
    };

    const handleViewHistory = (lead) => {
        setSelectedLeadForHistory(lead);
        setShowHistoryModal(true);
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e, leadId) => {
        e.dataTransfer.setData("leadId", leadId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, newStatus) => {
        const leadId = e.dataTransfer.getData("leadId");
        if (leadId) {
            const id = parseInt(leadId);
            const lead = leads.find(l => l.id === id);

            if (lead.status === newStatus) return;

            setPendingStatusChange({ leadId: id, newStatus });
            setStatusComment('');

            if (newStatus === 'sold') {
                initiateSale(id);
            } else {
                setShowCommentModal(true);
            }
        }
    };

    const initiateSale = (leadId) => {
        const lead = leads.find(l => l.id === leadId);
        setSelectedLeadForSale(lead);
        const defaultSellerId = lead.assigned_to?.id || '';
        setSaleForm({ vehicle_id: '', sale_price: '', seller_id: defaultSellerId });
        setShowSaleModal(true);
        fetchAvailableVehicles();
        if (user?.role?.name === 'admin' || user?.role?.name === 'super_admin') {
            fetchAdvisors();
        }
    };

    const confirmStatusChange = async () => {
        // Validation Logic
        if (!statusComment || statusComment.trim().length < 6) {
            Swal.fire({
                icon: 'warning',
                title: 'Información Requerida',
                text: 'Se debe describir el seguimiento para poder cambiar de etapa.',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        if (!pendingStatusChange) return;

        const { leadId, newStatus } = pendingStatusChange;

        try {
            // Optimistic UI Update
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
            setShowCommentModal(false);

            const token = localStorage.getItem('token');
            await axios.put(`https://autosqp.co/api/leads/${leadId}`,
                {
                    status: newStatus,
                    comment: statusComment
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Refresh leads to get updated history
            fetchLeads();

        } catch (error) {
            console.error("Error updating lead", error);
            Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
            fetchLeads(); // Revert
        }
    };

    const handleUpdateHistory = async (leadId, newStatus, comment) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://autosqp.co/api/leads/${leadId}`,
                {
                    status: newStatus,
                    comment: comment
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Optimistic update or refresh
            setLeads(prev => prev.map(l => {
                if (l.id === leadId) {
                    return { ...l, status: newStatus };
                }
                return l;
            }));

            // Re-fetch to get the new history record
            fetchLeads(); // Or fetch specific lead if optimized

            Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                text: 'El lead ha sido actualizado correctamente.',
                timer: 1500,
                showConfirmButton: false
            });
            setShowHistoryModal(false); // Optional: close or keep open
        } catch (error) {
            console.error("Error updating lead history", error);
            Swal.fire('Error', 'No se pudo actualizar el lead', 'error');
            throw error; // Propagate to modal to stop loading state
        }
    };

    const handleAssignLead = async (leadId, advisorId) => {
        try {
            const token = localStorage.getItem('token');
            // If empty string, send null
            const payload = {
                assigned_to_id: advisorId ? parseInt(advisorId) : null,
                comment: `Lead asignado a un nuevo responsable`
            };

            await axios.put(`https://autosqp.co/api/leads/${leadId}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Swal.fire({
                icon: 'success',
                title: 'Lead Asignado',
                text: 'El responsable del lead ha sido actualizado.',
                timer: 1500,
                showConfirmButton: false
            });
            fetchLeads(); // Refresh board to show new assignee initial
        } catch (error) {
            console.error("Error assigning lead", error);
            Swal.fire('Error', 'No se pudo asignar el lead', 'error');
        }
    };

    const handleConfirmSale = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const payload = {
                lead_id: selectedLeadForSale.id,
                vehicle_id: parseInt(saleForm.vehicle_id),
                sale_price: parseInt(saleForm.sale_price)
            };

            if (saleForm.seller_id) {
                payload.seller_id = parseInt(saleForm.seller_id);
            }

            await axios.post('https://autosqp.co/api/sales/', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            await axios.put(`https://autosqp.co/api/leads/${selectedLeadForSale.id}`,
                { status: 'sold', comment: `Venta registrada: Vehículo ID ${saleForm.vehicle_id}` },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setShowSaleModal(false);
            setSaleForm({ vehicle_id: '', sale_price: '', seller_id: '' });

            setLeads(prev => prev.map(l => l.id === selectedLeadForSale.id ? { ...l, status: 'sold' } : l));
            fetchLeads();

            Swal.fire({
                icon: 'success',
                title: '¡Venta Registrada!',
                text: 'La venta ha sido creada exitosamente.',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: "Error registrando la venta: " + (error.response?.data?.detail || error.message)
            });
        }
    };

    const filterByStatus = (status) => {
        return leads.filter(l => {
            if (l.status !== status) return false;

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchName = l.name?.toLowerCase().includes(term);
                const matchPhone = l.phone?.toLowerCase().includes(term);
                if (!matchName && !matchPhone) return false;
            }

            if (dateFilter) {
                const leadDate = l.created_at ? l.created_at.substring(0, 10) : '';
                if (leadDate !== dateFilter) return false;
            }

            if (assignedFilter) {
                if (assignedFilter === 'assigned' && !l.assigned_to) return false;
                if (assignedFilter === 'unassigned' && l.assigned_to) return false;
            }

            if (userFilter) {
                if (!l.assigned_to || l.assigned_to.id !== parseInt(userFilter)) return false;
            }

            if (globalStatusFilter) {
                if (l.status !== globalStatusFilter) return false;
            }

            return true;
        });
    };

    if (loading) return (
        <div className="flex justify-center items-center h-[calc(100vh-100px)]">
            <div className="text-xl text-blue-600 font-semibold animate-pulse">Cargando Tablero...</div>
        </div>
    );

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col relative bg-gray-50/50 -m-4 p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Tablero de Leads</h1>
                    <p className="text-slate-500 mt-1 font-medium">Arrastra y suelta para gestionar el ciclo de vida de tus clientes.</p>
                </div>
                <button
                    onClick={() => setShowAddLeadModal(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:scale-105 transition-all font-bold text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Nuevo Lead Manual
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 relative">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por nombre o teléfono..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowFiltersMenu(!showFiltersMenu)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-colors ${showFiltersMenu || globalStatusFilter || userFilter || assignedFilter || dateFilter ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        Filtros {(globalStatusFilter || userFilter || assignedFilter || dateFilter) && (<span className="w-2 h-2 rounded-full bg-blue-600"></span>)}
                    </button>

                    {/* Dropdown Menu */}
                    {showFiltersMenu && (
                        <div className="absolute right-0 top-12 mt-2 w-72 md:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-40 p-5 origin-top-right animate-fade-in-down py-6 grid gap-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-bold text-gray-800">Filtros Avanzados</h3>
                                {(globalStatusFilter || userFilter || assignedFilter || dateFilter) && (
                                    <button
                                        onClick={() => {
                                            setGlobalStatusFilter('');
                                            setUserFilter('');
                                            setAssignedFilter('');
                                            setDateFilter('');
                                        }}
                                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                                    >Limpiar todo</button>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado en Tablero</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm bg-slate-50 hover:bg-white transition-colors"
                                    value={globalStatusFilter}
                                    onChange={(e) => setGlobalStatusFilter(e.target.value)}
                                >
                                    <option value="">Todos los Estados</option>
                                    <option value="new">Nuevos</option>
                                    <option value="contacted">Contactados</option>
                                    <option value="interested">Interesados</option>
                                    <option value="sold">Vendidos</option>
                                    <option value="lost">Perdidos</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Asesor Encargado</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm bg-slate-50 hover:bg-white transition-colors"
                                    value={userFilter}
                                    onChange={(e) => {
                                        setUserFilter(e.target.value);
                                        if (e.target.value) setAssignedFilter('');
                                    }}
                                >
                                    <option value="">Cualquier Usuario</option>
                                    {advisors.map(adv => (
                                        <option key={adv.id} value={adv.id}>{adv.email}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Asignación Global</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm bg-slate-50 hover:bg-white transition-colors"
                                    value={assignedFilter}
                                    onChange={(e) => {
                                        setAssignedFilter(e.target.value);
                                        if (e.target.value) setUserFilter('');
                                    }}
                                >
                                    <option value="">Todas las asignaciones</option>
                                    <option value="assigned">✅ Asignados</option>
                                    <option value="unassigned">⏳ Sin Asignar</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha Exacta</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm bg-slate-50 hover:bg-white transition-colors"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex gap-6 overflow-x-auto pb-6 h-full items-start">
                <KanbanColumn
                    title="Nuevos"
                    status="new"
                    color="text-blue-600"
                    leads={filterByStatus('new')}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onViewHistory={handleViewHistory}
                />
                <KanbanColumn
                    title="Contactados"
                    status="contacted"
                    color="text-yellow-600"
                    leads={filterByStatus('contacted')}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onViewHistory={handleViewHistory}
                />
                <KanbanColumn
                    title="Interesados"
                    status="interested"
                    color="text-orange-600"
                    leads={filterByStatus('interested')}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onViewHistory={handleViewHistory}
                />
                <KanbanColumn
                    title="Vendidos"
                    status="sold"
                    color="text-green-600"
                    leads={filterByStatus('sold')}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onViewHistory={handleViewHistory}
                />
                <KanbanColumn
                    title="Perdidos"
                    status="lost"
                    color="text-gray-400"
                    leads={filterByStatus('lost')}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onViewHistory={handleViewHistory}
                />
            </div>

            {/* Comment Modal for Status Change */}
            {showCommentModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up border border-gray-100">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Confirmar cambio de estado</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Estás cambiando el lead a: <span className="font-bold text-blue-600 uppercase">
                                {pendingStatusChange?.newStatus === 'new' ? 'NUEVO' :
                                    pendingStatusChange?.newStatus === 'contacted' ? 'CONTACTADO' :
                                        pendingStatusChange?.newStatus === 'interested' ? 'INTERESADO' :
                                            pendingStatusChange?.newStatus === 'lost' ? 'PERDIDO' :
                                                pendingStatusChange?.newStatus === 'sold' ? 'VENDIDO' : pendingStatusChange?.newStatus}
                            </span>.
                            <br />Por favor, indica el motivo o un comentario para el seguimiento.
                        </p>

                        <textarea
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                            rows="3"
                            placeholder="Escribe aquí el motivo del cambio..."
                            value={statusComment}
                            onChange={(e) => setStatusComment(e.target.value)}
                            autoFocus
                        ></textarea>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowCommentModal(false); setStatusComment(''); }}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmStatusChange}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                            >
                                Guardar y Cambiar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sale Modal */}
            {showSaleModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-fade-in-up border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">Cerrar Venta</h2>
                            <button onClick={() => setShowSaleModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <div className="bg-green-50 p-4 rounded-lg mb-6 flex items-start gap-3 border border-green-100">
                            <div className="bg-green-100 p-2 rounded-full text-green-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-green-800">¡Felicitaciones!</h3>
                                <p className="text-sm text-green-700">Estás a punto de registrar una venta para <strong>{selectedLeadForSale?.name}</strong>.</p>
                            </div>
                        </div>

                        <form onSubmit={handleConfirmSale} className="space-y-5">
                            {(user?.role?.name === 'admin' || user?.role?.name === 'super_admin') && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Asignar Venta A:</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                        value={saleForm.seller_id}
                                        onChange={e => setSaleForm({ ...saleForm, seller_id: e.target.value })}
                                    >
                                        <option value="">(Yo mismo) - {user.email}</option>
                                        {advisors.map(adv => (
                                            <option key={adv.id} value={adv.id}>
                                                {adv.email} {adv.id === selectedLeadForSale?.assigned_to?.id ? '(Asignado)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Vehículo Vendido</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    value={saleForm.vehicle_id}
                                    onChange={e => setSaleForm({ ...saleForm, vehicle_id: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccione un vehículo del inventario...</option>
                                    {availableVehicles.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.make} {v.model} ({v.plate}) - ${parseInt(v.price).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Precio Final de Venta</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono text-lg"
                                        placeholder="0"
                                        value={saleForm.sale_price}
                                        onChange={e => setSaleForm({ ...saleForm, sale_price: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowSaleModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition font-bold"
                                >
                                    Confirmar Venta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <HistoryModal
                    lead={selectedLeadForHistory}
                    onClose={() => setShowHistoryModal(false)}
                    onUpdate={handleUpdateHistory}
                    advisors={advisors}
                    onAssign={handleAssignLead}
                />
            )}

            {/* Add Lead Manual Modal */}
            {showAddLeadModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-fade-in-up border border-gray-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">Nuevo Lead</h2>
                            <button onClick={() => setShowAddLeadModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <form onSubmit={handleCreateLead} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={newLeadForm.name}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newLeadForm.phone}
                                        onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Email (Opcional)</label>
                                    <input
                                        type="email"
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newLeadForm.email}
                                        onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Fuente</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={newLeadForm.source}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                                >
                                    <option value="web">Web / Directo</option>
                                    <option value="facebook">Facebook Ads</option>
                                    <option value="instagram">Instagram Ads</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="tiktok">TikTok</option>
                                    <option value="referral">Referido</option>
                                    <option value="showroom">Showroom (Físico)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Mensaje / Interés Inicial</label>
                                <textarea
                                    rows="3"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="¿En qué vehículo está interesado?"
                                    value={newLeadForm.message}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, message: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddLeadModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold shadow-lg"
                                >
                                    Crear Lead
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadsBoard;
