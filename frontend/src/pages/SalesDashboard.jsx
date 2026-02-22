import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

const SalesDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        total_revenue: 0,
        total_commissions: 0,
        total_sales_count: 0,
        pending_sales_count: 0
    });
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('pending'); // pending, approved

    useEffect(() => {
        fetchData();
    }, [filterStatus]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch Stats
            const statsRes = await axios.get('http://54.226.30.192:8000/finance/stats', { headers });
            setStats(statsRes.data);

            // Fetch Sales List
            const salesRes = await axios.get(`http://54.226.30.192:8000/sales/?status=${filterStatus}`, { headers });
            setSales(salesRes.data.items);

        } catch (error) {
            console.error("Error fetching sales data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (saleId) => {
        const result = await Swal.fire({
            title: '¿Confirmar esta venta?',
            text: "Se registrará la comisión y el vehículo pasará a 'Vendido'.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, aprobar venta',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-red-600 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`http://54.226.30.192:8000/sales/${saleId}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Swal.fire('Éxito', "Venta aprobada exitosamente", 'success');
            // Refresh
            fetchData();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', "Error al aprobar: " + (error.response?.data?.detail || error.message), 'error');
        }
    };

    if (loading && !stats) return <div className="p-10 text-center">Cargando finanzas...</div>;

    return (
        <div className="animate-fade-in space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-800">Finanzas y Comisiones</h1>
                <p className="text-gray-500">Gestión de ventas, aprobaciones y control de ingresos.</p>
            </header>

            {/* KPI Cards */}
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium uppercase">Ingresos Totales (Histórico)</p>
                    <p className="text-3xl font-bold text-slate-800 mt-2">
                        ${stats.total_revenue?.toLocaleString() || '0'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium uppercase">Ingresos del Mes</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                        ${stats.monthly_revenue?.toLocaleString() || '0'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium uppercase">Comisiones (Mes)</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                        ${stats.monthly_commissions?.toLocaleString() || '0'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium uppercase">Nómina Mensual (Estimada)</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">
                        ${stats.payroll_expenses?.toLocaleString() || '0'}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium uppercase">Ventas Cerradas</p>
                    <p className="text-3xl font-bold text-slate-800 mt-2">
                        {stats.total_sales_count}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium uppercase">Comisiones Totales (Hist.)</p>
                    <p className="text-3xl font-bold text-slate-600 mt-2">
                        ${stats.total_commissions?.toLocaleString() || '0'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium uppercase">Pendientes Aprobación</p>
                    <p className="text-3xl font-bold text-orange-500 mt-2">
                        {stats.pending_sales_count}
                    </p>
                </div>
            </div>

            {/* Sales List */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">
                        {filterStatus === 'pending' ? 'Solicitudes Pendientes' : 'Historial de Ventas'}
                    </h3>
                    <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={() => setFilterStatus('pending')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${filterStatus === 'pending' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Pendientes
                        </button>
                        <button
                            onClick={() => setFilterStatus('approved')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${filterStatus === 'approved' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Aprobadas
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                                <th className="p-4 border-b">Fecha</th>
                                <th className="p-4 border-b">Vehículo</th>
                                <th className="p-4 border-b">Vendedor</th>
                                <th className="p-4 border-b">Precio Venta</th>
                                <th className="p-4 border-b">Comisión (%)</th>
                                <th className="p-4 border-b">Comisión ($)</th>
                                <th className="p-4 border-b">Ingreso Neto</th>
                                {filterStatus === 'pending' && <th className="p-4 border-b text-right">Acción</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-gray-50 group">
                                    <td className="p-4 text-sm text-gray-500">
                                        {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : 'Pendiente'}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium text-gray-800">
                                            {sale.vehicle?.make} {sale.vehicle?.model}
                                        </div>
                                        <div className="text-xs text-gray-500">{sale.vehicle?.plate}</div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600">
                                        {sale.seller?.email}
                                    </td>
                                    <td className="p-4 font-bold text-gray-800">
                                        ${sale.sale_price.toLocaleString()}
                                    </td>
                                    <td className="p-4 text-sm text-gray-600">
                                        {sale.commission_percentage}%
                                    </td>
                                    <td className="p-4 font-medium text-blue-600">
                                        ${sale.commission_amount.toLocaleString()}
                                    </td>
                                    <td className="p-4 font-medium text-green-600">
                                        ${sale.net_revenue.toLocaleString()}
                                    </td>
                                    {filterStatus === 'pending' && (
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleApprove(sale.id)}
                                                className="bg-green-100 text-green-700 px-3 py-1.5 rounded hover:bg-green-200 text-sm font-medium transition"
                                            >
                                                Aprobar
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {sales.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-gray-400 italic">
                                        No hay ventas en esta sección.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SalesDashboard;
