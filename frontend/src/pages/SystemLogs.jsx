import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function SystemLogs() {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [moduleFilter, setModuleFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [appliedFilters, setAppliedFilters] = useState({
        user: '',
        module: '',
        date: ''
    });

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 25;

    useEffect(() => {
        fetchLogs();
    }, [page, appliedFilters]);

    const fetchLogs = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const skip = (page - 1) * limit;

            const response = await axios.get('https://autosqp.co/api/logs/', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    skip,
                    limit,
                    user_query: appliedFilters.user || undefined,
                    module_query: appliedFilters.module || undefined,
                    log_date: appliedFilters.date || undefined
                }
            });

            setLogs(response.data.items);
            setTotalPages(Math.ceil(response.data.total / limit));
        } catch (err) {
            console.error('Error fetching logs:', err);
            setError('No se pudo cargar el historial del sistema. Verifique sus permisos de administrador.');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        setPage(1);
        setAppliedFilters({
            user: userFilter.trim(),
            module: moduleFilter.trim(),
            date: dateFilter
        });
    };

    const clearFilters = () => {
        setUserFilter('');
        setModuleFilter('');
        setDateFilter('');
        setPage(1);
        setAppliedFilters({
            user: '',
            module: '',
            date: ''
        });
    };

    const roleName = user?.role?.name;
    if (roleName !== 'super_admin' && roleName !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <h2 className="text-2xl font-bold text-gray-800">Acceso Denegado</h2>
                <p className="text-gray-600 mt-2">No tienes los permisos necesarios para ver la auditoría del sistema.</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Auditoría del Sistema</h1>
                    <p className="text-sm text-gray-500 mt-1">Historial de acciones y eventos realizados por los usuarios</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                    Actualizar
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Usuario</label>
                        <input
                            type="text"
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                            placeholder="Nombre o correo"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Módulo</label>
                        <input
                            type="text"
                            value={moduleFilter}
                            onChange={(e) => setModuleFilter(e.target.value)}
                            placeholder="Lead, Vehículo, Auth..."
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha</label>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500"
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <button
                            onClick={applyFilters}
                            className="inline-flex flex-1 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                            Buscar
                        </button>
                        <button
                            onClick={clearFilters}
                            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white shadow rounded-lg overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha / Hora</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Módulo</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        Cargando registros...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        No se encontraron registros de auditoría.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-l-4" style={{ borderLeftColor: log.action === 'DELETE' ? '#EF4444' : log.action === 'CREATE' ? '#10B981' : log.action === 'LOGIN' ? '#8B5CF6' : '#3B82F6' }}>
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {log.user ? (log.user.full_name || log.user.email) : 'Sistema / Desconocido'}
                                            </div>
                                            <div className="text-xs text-gray-500">{log.ip_address || ''}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                {{ 'User': 'Usuario', 'Lead': 'Lead', 'Vehicle': 'Vehículo', 'Auth': 'Autenticación', 'Sale': 'Venta' }[log.entity_type] || log.entity_type || 'General'} {log.entity_id ? `(#${log.entity_id})` : ''}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                                            {{ 'CREATE': 'CREACIÓN', 'UPDATE': 'ACTUALIZACIÓN', 'DELETE': 'ELIMINACIÓN', 'LOGIN': 'INICIO DE SESIÓN' }[log.action] || log.action}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs break-words whitespace-pre-wrap">
                                            {log.details || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            Anterior
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || totalPages === 0}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            Siguiente
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Mostrando página <span className="font-medium">{page}</span> de <span className="font-medium">{totalPages || 1}</span>
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                                >
                                    <span className="sr-only">Anterior</span>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || totalPages === 0}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
                                >
                                    <span className="sr-only">Siguiente</span>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SystemLogs;
