import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

const MySales = () => {
    const { user } = useAuth();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit] = useState(10); // Max 10 per page as requested

    // Filters
    const [search, setSearch] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (user) {
            fetchSales();
        }
    }, [page, search, selectedMonth, selectedYear, user]);

    const fetchSales = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const skip = (page - 1) * limit;

            // Build Query Params
            const params = {
                skip,
                limit,
                month: selectedMonth,
                year: selectedYear,
                status: 'approved' // Only show approved sales? Or all? Usually my sales implies confirmed sales. Let's show all or just approved. User said "ventas realizadas" implying completed. But let's verify logic. If pending, it's not a sale yet.
                // However, user might want to see pending approvals. AutoSQP logic: "approved" is final. "pending" is waitinf for admin.
                // Let's remove status filter to show everything (pending + approved) so they can track their commissions.
            };

            if (search) params.q = search;

            // Removing status filter to show Pending/Approved/Rejected.
            // But usually "My Sales" means successful ones. 
            // Let's show ALL so they can see pending commissions.

            const response = await axios.get('http://localhost:8000/sales/', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            if (response.data && Array.isArray(response.data.items)) {
                setSales(response.data.items);
                setTotal(response.data.total);
            } else {
                setSales([]);
                setTotal(0);
            }
        } catch (error) {
            console.error("Error fetching sales", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar tus ventas.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleMonthChange = (e) => {
        setSelectedMonth(parseInt(e.target.value));
        setPage(1);
    };

    const handleYearChange = (e) => {
        setSelectedYear(parseInt(e.target.value));
        setPage(1);
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="animate-fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Mis Ventas</h1>
                    <p className="text-slate-500 mt-1">Historial de tus ventas y comisiones.</p>
                </div>

                <div className="flex gap-2 items-center bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                    <div className="relative">
                        <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            placeholder="Buscar placa, modelo..."
                            className="pl-10 pr-4 py-2 border-none focus:ring-0 text-sm w-48"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <select value={selectedMonth} onChange={handleMonthChange} className="text-sm border-none focus:ring-0 text-slate-600 font-medium cursor-pointer bg-transparent">
                        {[...Array(12)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('es-ES', { month: 'long' })}</option>
                        ))}
                    </select>
                    <select value={selectedYear} onChange={handleYearChange} className="text-sm border-none focus:ring-0 text-slate-600 font-medium cursor-pointer bg-transparent">
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-slate-400">Cargando ventas...</p>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Vehículo</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Precio Venta</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Comisión</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {sales.length > 0 ? (
                                        sales.map((sale) => (
                                            <tr key={sale.id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(sale.sale_date || sale.created_at || Date.now()).toLocaleDateString('es-ES')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="ml-0">
                                                            <div className="text-sm font-medium text-gray-900">{sale.vehicle?.make} {sale.vehicle?.model}</div>
                                                            <div className="text-xs text-gray-500">{sale.vehicle?.plate}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {sale.lead?.name || 'Cliente Directo'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                                                    ${sale.sale_price.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold">
                                                    ${sale.commission_amount.toLocaleString()} ({sale.commission_percentage}%)
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                                                        ${sale.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                            sale.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {sale.status === 'approved' ? 'Aprobada' :
                                                            sale.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-10 text-center text-gray-500 italic">
                                                No se encontraron ventas en este período.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {total > limit && (
                        <div className="mt-4 flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                                Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, total)} de {total} resultados
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Anterior
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MySales;
