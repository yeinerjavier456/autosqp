import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

const AliadoDashboard = () => {
    const { user } = useAuth();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [advisors, setAdvisors] = useState([]);

    // Modal State - New Lead
    const [showAddLeadModal, setShowAddLeadModal] = useState(false);

    // Modal State - History
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedLeadForHistory, setSelectedLeadForHistory] = useState(null);

    const [newLeadForm, setNewLeadForm] = useState({
        name: '',
        email: '',
        phone: '',
        source: 'referral', // Default for Aliado
        message: '',
        status: 'new',
        assigned_to_id: ''
    });

    useEffect(() => {
        fetchLeads();
        fetchAdvisors();
    }, []);

    const fetchLeads = async () => {
        try {
            const token = localStorage.getItem('token');
            // Backend filters leads created by or assigned to this Aliado
            const response = await axios.get('http://localhost:8000/leads', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLeads(Array.isArray(response.data.items) ? response.data.items : []);
        } catch (error) {
            console.error("Error fetching leads", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdvisors = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:8000/users/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Filter only advisors/sellers
            const validRoles = ['asesor', 'vendedor', 'admin'];
            const users = response.data.items.filter(u => validRoles.includes(u.role?.name));
            setAdvisors(users);
        } catch (error) {
            console.error("Error fetching advisors", error);
        }
    };

    const handleCreateLead = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');

            const payload = {
                ...newLeadForm,
                company_id: user?.company_id || 1
            };

            // Should be handled by backend logic if assigned_to_id is present
            if (newLeadForm.assigned_to_id) {
                payload.assigned_to_id = parseInt(newLeadForm.assigned_to_id);
            } else {
                Swal.fire('Error', 'Debes asignar el lead a un usuario.', 'error');
                return;
            }

            const response = await axios.post('http://localhost:8000/leads', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setLeads(prev => [response.data, ...prev]);
            setShowAddLeadModal(false);
            setNewLeadForm({
                name: '',
                email: '',
                phone: '',
                source: 'referral',
                message: '',
                status: 'new',
                assigned_to_id: ''
            });

            Swal.fire({
                icon: 'success',
                title: 'Lead Creado',
                text: 'El lead ha sido creado y asignado exitosamente.',
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

    const getStatusBadge = (status) => {
        const colors = {
            new: 'bg-blue-100 text-blue-800',
            contacted: 'bg-yellow-100 text-yellow-800',
            interested: 'bg-orange-100 text-orange-800',
            sold: 'bg-green-100 text-green-800',
            lost: 'bg-gray-100 text-gray-800'
        };
        const labels = {
            new: 'Nuevo',
            contacted: 'Contactado',
            interested: 'Interesado',
            sold: 'Vendido',
            lost: 'Perdido'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${colors[status] || 'bg-gray-100'}`}>
                {labels[status] || status}
            </span>
        );
    };

    const handleViewHistory = (lead) => {
        setSelectedLeadForHistory(lead);
        setShowHistoryModal(true);
    };

    // --- Status Change Logic (Simplified for Aliado) ---
    // Allow Aliado to add notes (comments) to history without necessarily changing status, 
    // or change status if needed.
    const handleAddNote = async (leadId, comment, status) => {
        try {
            const token = localStorage.getItem('token');

            const lead = leads.find(l => l.id === leadId);
            if (!lead) return;

            const response = await axios.put(`http://localhost:8000/leads/${leadId}`,
                {
                    status: status || lead.status, // Keep same status if undefined
                    comment: comment
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                text: 'Nota agregada / Estado actualizado',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });

            // Update local state and selected lead
            await fetchLeads();
            // We need to update the selected lead immediately to show changes in modal
            // fetchLeads runs async, but we can't depend on it to update selectedLeadForHistory automatically 
            // because selectedLeadForHistory is a separate state object, not a reference to leads array item.
            // So we update it manually with response data
            setSelectedLeadForHistory(response.data);

        } catch (error) {
            console.error("Error adding note", error);
            Swal.fire('Error', 'No se pudo actualizar el lead', 'error');
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-[calc(100vh-100px)]">
            <div className="text-xl text-blue-600 font-semibold animate-pulse">Cargando Tablero...</div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800">Mis Referidos</h1>
                    <p className="text-slate-500 mt-1">Gestiona los leads que has subido y asignado.</p>
                </div>
                <button
                    onClick={() => setShowAddLeadModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition shadow-lg font-bold"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Nuevo Lead
                </button>
            </div>

            {/* Leads List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500">
                            <th className="px-6 py-4 font-bold">Cliente</th>
                            <th className="px-6 py-4 font-bold">Estado</th>
                            <th className="px-6 py-4 font-bold">Asignado A</th>
                            <th className="px-6 py-4 font-bold">Fecha</th>
                            <th className="px-6 py-4 font-bold text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {leads.length > 0 ? (
                            leads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-gray-50/50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{lead.name}</div>
                                        <div className="text-sm text-slate-500">{lead.phone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(lead.status)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {lead.assigned_to ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                    {lead.assigned_to.email.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-slate-600">{lead.assigned_to.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400 italic">Sin asignar</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(lead.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleViewHistory(lead)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
                                        >
                                            Ver Detalles y Notas
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">
                                    No has creado leads todavía. ¡Empieza ahora!
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Lead Modal */}
            {showAddLeadModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-fade-in-up border border-gray-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">Registrar Nuevo Lead</h2>
                            <button onClick={() => setShowAddLeadModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <form onSubmit={handleCreateLead} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Cliente</label>
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
                                        required
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
                                <label className="block text-sm font-bold text-gray-700 mb-1">Asignar A (Obligatorio)</label>
                                <select
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    value={newLeadForm.assigned_to_id}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, assigned_to_id: e.target.value })}
                                >
                                    <option value="">-- Seleccionar Asesor / Admin --</option>
                                    {advisors.map(adv => (
                                        <option key={adv.id} value={adv.id}>
                                            {adv.email} ({adv.role?.name})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Mensaje / Notas</label>
                                <textarea
                                    rows="3"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Detalles sobre el interés del cliente..."
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
                                    Crear y Asignar
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
                    onAddNote={handleAddNote}
                />
            )}
        </div>
    );
};

export default AliadoDashboard;


// --- Internal Components (Copied/Adapted from LeadsBoard) ---

const HistoryModal = ({ lead, onClose, onAddNote }) => {
    const [activeTab, setActiveTab] = useState('history');
    const [newNote, setNewNote] = useState('');
    const [newStatus, setNewStatus] = useState(lead.status || 'new');

    useEffect(() => {
        if (lead) {
            setNewStatus(lead.status || 'new');
        }
    }, [lead]);

    if (!lead) return null;

    const messages = lead.conversation?.messages
        ? [...lead.conversation.messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        : [];

    const handleNoteSubmit = (e) => {
        e.preventDefault();
        onAddNote(lead.id, newNote, newStatus);
        setNewNote('');
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-fade-in-up border border-gray-100 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Detalles del Lead</h2>
                        <div className="flex gap-2 text-sm mt-1">
                            <span className="text-gray-500">{lead.name}</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-blue-600 font-medium">{lead.phone}</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-gray-500">{lead.email || 'Sin email'}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-4">
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-2 text-sm font-bold text-center border-b-2 transition ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Historial y Notas
                    </button>
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={`flex-1 py-2 text-sm font-bold text-center border-b-2 transition ${activeTab === 'messages' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Mensajes ({messages.length})
                    </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 space-y-4 mb-4">
                    {activeTab === 'history' ? (
                        <>
                            {/* Add Note Section */}
                            <form onSubmit={handleNoteSubmit} className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-4">
                                <label className="block text-xs font-bold text-blue-800 mb-1">Actualizar Estado / Agregar Nota</label>
                                <div className="flex flex-col gap-2">
                                    <select
                                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value)}
                                    >
                                        <option value="new">Nuevo</option>
                                        <option value="contacted">Contactado</option>
                                        <option value="interested">Interesado</option>
                                        <option value="sold">Vendido</option>
                                        <option value="lost">Perdido</option>
                                    </select>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Escribe una nota sobre este cliente..."
                                            value={newNote}
                                            onChange={(e) => setNewNote(e.target.value)}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!newNote.trim() && newStatus === lead.status}
                                            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {lead.history && lead.history.length > 0 ? (
                                [...lead.history].reverse().map((record) => (
                                    <div key={record.id} className="flex gap-4 group">
                                        <div className="flex flex-col items-center">
                                            <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 ring-4 ring-white"></div>
                                            <div className="w-0.5 flex-1 bg-gray-100 group-last:hidden"></div>
                                        </div>
                                        <div className="flex-1 pb-6">
                                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 group-hover:border-blue-100 transition shadow-sm">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white bg-gray-400`}>
                                                            {record.previous_status || 'N/A'}
                                                        </span>
                                                        <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white 
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
                                <div className="text-center py-8 text-gray-400 italic">
                                    No hay historial registrado.
                                </div>
                            )}
                        </>
                    ) : (
                        messages.length > 0 ? (
                            <div className="space-y-3">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${msg.sender_type === 'user'
                                            ? 'bg-green-100 text-green-900 rounded-tr-none'
                                            : 'bg-white border border-gray-200 text-slate-800 rounded-tl-none'
                                            }`}>
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content || '(Multimedia)'}</p>
                                            <div className={`text-[10px] mt-1 flex items-center gap-1 ${msg.sender_type === 'user' ? 'text-green-700' : 'text-slate-400'}`}>
                                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400 italic">
                                No hay mensajes en esta conversación.
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
