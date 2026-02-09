import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

const CreditBoard = () => {
    const { user } = useAuth();
    const [credits, setCredits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedCredit, setSelectedCredit] = useState(null); // For details modal

    // Form State
    const [formData, setFormData] = useState({
        client_name: '',
        phone: '',
        email: '',
        desired_vehicle: '',
        monthly_income: '',
        occupation: 'employee',
        application_mode: 'individual',
        down_payment: '',
        notes: ''
    });

    const columns = {
        'pending': { id: 'pending', title: 'Solicitud Recibida', color: 'bg-yellow-100 text-yellow-800' },
        'in_review': { id: 'in_review', title: 'En Estudio', color: 'bg-blue-100 text-blue-800' },
        'approved': { id: 'approved', title: 'Aprobado (Viable)', color: 'bg-green-100 text-green-800' },
        'rejected': { id: 'rejected', title: 'No Viable / Rechazado', color: 'bg-red-100 text-red-800' },
        'completed': { id: 'completed', title: 'Finalizado / Vendido', color: 'bg-indigo-100 text-indigo-800' }
    };

    useEffect(() => {
        fetchCredits();
    }, []);

    const fetchCredits = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:8000/credits', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCredits(response.data.items);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudieron cargar las solicitudes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = async (result) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const newStatus = destination.droppableId;
        const creditId = parseInt(draggableId);

        // Optimistic UI Update
        const updatedCredits = credits.map(c =>
            c.id === creditId ? { ...c, status: newStatus } : c
        );
        setCredits(updatedCredits);

        try {
            const token = localStorage.getItem('token');
            await axios.put(`http://localhost:8000/credits/${creditId}`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error("Error updating status:", error);
            Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
            fetchCredits(); // Revert
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');

            // Clean/Format data
            const payload = {
                ...formData,
                monthly_income: parseInt(formData.monthly_income) || 0,
                down_payment: parseInt(formData.down_payment) || 0,
                other_income: 0,
                company_id: user?.company_id || 1,
                status: 'pending'
            };

            const response = await axios.post('http://localhost:8000/credits', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCredits([response.data, ...credits]);
            setShowAddModal(false);
            setFormData({
                client_name: '', phone: '', email: '', desired_vehicle: '',
                monthly_income: '', occupation: 'employee', application_mode: 'individual',
                down_payment: '', notes: ''
            });

            Swal.fire({
                icon: 'success',
                title: 'Solicitud Creada',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire('Error', 'Error al crear la solicitud', 'error');
        }
    };

    // Filter credits by column
    const getCreditsByStatus = (status) => {
        return credits.filter(c => (c.status || 'pending') === status);
    };

    // Format Currency
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    };

    return (
        <div className="p-8 min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Créditos y Solicitudes</h1>
                    <p className="text-slate-500 mt-1 font-medium">Administra clientes en proceso de aprobación o búsqueda de vehículo.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:scale-105 transition-all font-bold text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Nueva Solicitud
                </button>
            </div>

            {/* Kanban Board */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-6 overflow-x-auto pb-8 snap-x">
                    {Object.values(columns).map(col => (
                        <div key={col.id} className="min-w-[320px] flex flex-col bg-slate-50/50 rounded-2xl p-4 snap-center border border-slate-200 h-[calc(100vh-200px)]">
                            <div className={`flex items-center justify-between px-3 py-3 mb-4 rounded-xl ${col.color} bg-opacity-20`}>
                                <h3 className="font-bold text-sm uppercase tracking-wide">{col.title}</h3>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full bg-white bg-opacity-50`}>
                                    {getCreditsByStatus(col.id).length}
                                </span>
                            </div>

                            <Droppable droppableId={col.id}>
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="flex-1 overflow-y-auto custom-scrollbar px-1"
                                    >
                                        {getCreditsByStatus(col.id).map((credit, index) => (
                                            <Draggable key={credit.id} draggableId={credit.id.toString()} index={index}>
                                                {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        onClick={() => setSelectedCredit(credit)}
                                                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-3 hover:shadow-md transition cursor-pointer group"
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-bold text-slate-800">{credit.client_name}</h4>
                                                            <span className="text-xs text-slate-400 font-mono">#{credit.id}</span>
                                                        </div>

                                                        <div className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-1">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                            {credit.desired_vehicle}
                                                        </div>

                                                        <div className="space-y-1 text-xs text-slate-500">
                                                            <div className="flex justify-between">
                                                                <span>Ingresos M.:</span>
                                                                <span className="font-medium text-slate-700">{formatCurrency(credit.monthly_income)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Inicial Disp.:</span>
                                                                <span className="font-medium text-slate-700">{formatCurrency(credit.down_payment)}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
                                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border 
                                                                ${credit.occupation === 'employee' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                                    credit.occupation === 'independent' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                        'bg-gray-50 text-gray-600 border-gray-100'}`}>
                                                                {credit.occupation === 'employee' ? 'Empleado' : credit.occupation === 'independent' ? 'Independiente' : 'Pensionado'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {new Date(credit.created_at).toLocaleDateString()}
                                                            </span>
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

            {/* Create Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl animate-fade-in-up border border-gray-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">Nueva Solicitud de Crédito / Búsqueda</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Cliente</label>
                                    <input type="text" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono</label>
                                    <input type="tel" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Vehículo Buscado</label>
                                <input type="text" required placeholder="Ej: Mazda 3 2020 Rojo" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.desired_vehicle} onChange={e => setFormData({ ...formData, desired_vehicle: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Ocupación</label>
                                    <select className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.occupation} onChange={e => setFormData({ ...formData, occupation: e.target.value })}>
                                        <option value="employee">Empleado</option>
                                        <option value="independent">Independiente</option>
                                        <option value="pensioner">Pensionado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Modalidad</label>
                                    <select className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.application_mode} onChange={e => setFormData({ ...formData, application_mode: e.target.value })}>
                                        <option value="individual">Individual / Solo</option>
                                        <option value="conjoint">Con Codeudor/Cónyuge</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Ingresos Mensuales</label>
                                    <input type="number" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.monthly_income} onChange={e => setFormData({ ...formData, monthly_income: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Cuota Inicial Disponible</label>
                                <input type="number" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.down_payment} onChange={e => setFormData({ ...formData, down_payment: e.target.value })} />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Notas Adicionales</label>
                                <textarea rows="3" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition">Cancelar</button>
                                <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold shadow-lg">Crear Solicitud</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreditBoard;
