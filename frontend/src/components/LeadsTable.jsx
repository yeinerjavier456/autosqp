import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const LeadsTable = ({ source, title }) => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const limit = 50;

    // Selection State
    const [selectedLeads, setSelectedLeads] = useState([]);

    // Assign Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [advisors, setAdvisors] = useState([]);
    const [selectedAdvisor, setSelectedAdvisor] = useState("");

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const skip = (page - 1) * limit;
            const params = { skip, limit };
            if (source) params.source = source;
            if (searchTerm) params.q = searchTerm;
            if (statusFilter) params.status = statusFilter;

            const response = await axios.get('http://54.226.30.192:8000/leads/', {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });
            setLeads(response.data.items);
            setTotal(response.data.total);
            // Clear selection on refresh/filter change ideally? 
            // setSelectedLeads([]); 
        } catch (error) {
            console.error("Error fetching leads", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [page, source, statusFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchLeads();
    };

    // --- Selection Logic ---
    const toggleSelectAll = () => {
        if (selectedLeads.length === leads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(leads.map(l => l.id));
        }
    };

    const toggleSelectLead = (id) => {
        if (selectedLeads.includes(id)) {
            setSelectedLeads(selectedLeads.filter(lid => lid !== id));
        } else {
            setSelectedLeads([...selectedLeads, id]);
        }
    };

    // --- Assignment Logic ---
    const fetchAdvisors = async () => {
        try {
            const token = localStorage.getItem('token');
            // 1. Get Roles to find 'asesor' id
            const rolesRes = await axios.get('http://54.226.30.192:8000/roles/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const asesorRole = rolesRes.data.find(r => r.name === 'asesor');

            if (asesorRole) {
                // 2. Get Users with that role
                const usersRes = await axios.get('http://54.226.30.192:8000/users/', {
                    params: { role_id: asesorRole.id },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setAdvisors(usersRes.data.items);
            }
        } catch (error) {
            console.error("Error fetching advisors", error);
        }
    };

    const openAssignModal = () => {
        fetchAdvisors();
        setIsAssignModalOpen(true);
    };

    const confirmAssignment = async () => {
        if (!selectedAdvisor) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put('http://54.226.30.192:8000/leads/bulk-assign', {
                lead_ids: selectedLeads,
                assigned_to_id: parseInt(selectedAdvisor)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Success
            setIsAssignModalOpen(false);
            setSelectedLeads([]);
            fetchLeads(); // Refresh data
            Swal.fire('Asignación Completada', 'Los leads han sido asignados correctamente.', 'success');
        } catch (error) {
            console.error("Error assigning leads", error);
            Swal.fire('Error', 'Error al asignar leads.', 'error');
        }
    };

    const totalPages = Math.ceil(total / limit);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'new': return <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">Nuevo</span>;
            case 'contacted': return <span className="px-2 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800">Contactado</span>;
            case 'converted': return <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">Convertido</span>;
            case 'closed': return <span className="px-2 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-800">Cerrado</span>;
            default: return <span className="px-2 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    return (
        <div className="">
            <header className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-800">{title}</h1>
                        <p className="text-slate-500 text-sm mt-1">Gestionando {total} leads.</p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-2">
                        {/* Status Filter */}
                        <select
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">Todos los estados</option>
                            <option value="new">Nuevos</option>
                            <option value="contacted">Contactados</option>
                            <option value="converted">Convertidos</option>
                            <option value="closed">Cerrados</option>
                        </select>

                        <form onSubmit={handleSearch} className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition">
                                Buscar
                            </button>
                        </form>
                        <button
                            onClick={fetchLeads}
                            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-slate-600"
                            title="Recargar"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                </div>

                {/* Bulk Actions */}
                {selectedLeads.length > 0 && (
                    <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between border border-blue-100 animate-fade-in-down">
                        <span className="text-sm text-blue-800 font-medium">{selectedLeads.length} leads seleccionados</span>
                        <button
                            onClick={openAssignModal}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition shadow-sm"
                        >
                            Asignar a Asesor
                        </button>
                    </div>
                )}
            </header>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={leads.length > 0 && selectedLeads.length === leads.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Ingreso</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mensaje</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsable</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Últ. Act.</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-gray-500">Cargando leads...</td>
                                </tr>
                            ) : leads.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-gray-500">No se encontraron leads.</td>
                                </tr>
                            ) : (
                                leads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedLeads.includes(lead.id)}
                                                onChange={() => toggleSelectLead(lead.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                            {lead.created_at || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{lead.name || 'Sin Nombre'}</div>
                                            <div className="text-xs text-gray-500">{lead.email}</div>
                                            <div className="text-xs text-blue-600">{lead.phone}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500 max-w-xs truncate" title={lead.message}>
                                                {lead.message || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {lead.assigned_to ? (
                                                <div className="flex items-center">
                                                    <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 mr-2">
                                                        {lead.assigned_to.email[0].toUpperCase()}
                                                    </div>
                                                    <span className="text-xs text-gray-700">{lead.assigned_to.email}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Sin asignar</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(lead.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 hidden md:table-cell">
                                            {lead.updated_at || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > 0 && (
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100">
                                Anterior
                            </button>
                            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100">
                                Siguiente
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Página <span className="font-medium">{page}</span> de <span className="font-medium">{totalPages}</span> ({total} resultados)
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setPage(Math.max(1, page - 1))}
                                        disabled={page === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                                    >
                                        <span className="sr-only">Anterior</span>
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.707 5.293 a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    </button>
                                    <button
                                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                                        disabled={page >= totalPages}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                                    >
                                        <span className="sr-only">Siguiente</span>
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Assign Modal */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Asignar Leads</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Selecciona un asesor para asignar los {selectedLeads.length} leads seleccionados.
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Asesor</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={selectedAdvisor}
                                onChange={(e) => setSelectedAdvisor(e.target.value)}
                            >
                                <option value="">Selecciona un asesor...</option>
                                {advisors.map(adv => (
                                    <option key={adv.id} value={adv.id}>{adv.email}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsAssignModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAssignment}
                                disabled={!selectedAdvisor}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Asignar Leads
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadsTable;
