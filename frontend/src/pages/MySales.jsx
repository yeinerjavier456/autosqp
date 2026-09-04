import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

const formatMoney = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;
const formatDate = (value) => value
    ? new Date(value).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
    : 'Sin registrar';
const showValue = (value) => value === null || value === undefined || value === '' ? 'Sin registrar' : value;
const saleStatusLabel = (status) => status === 'approved' ? 'Aprobada' : status === 'rejected' ? 'Rechazada' : 'Pendiente';

const MySales = () => {
    const { user } = useAuth();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit] = useState(10); // Max 10 per page as requested
    const [selectedSale, setSelectedSale] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (user) {
            fetchSales();
        }
    }, [page, search, selectedMonth, selectedYear, user]);

    useEffect(() => {
        if (!selectedSale) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setSelectedSale(null);
        };
        document.addEventListener('keydown', closeOnEscape);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            document.body.style.overflow = '';
        };
    }, [selectedSale]);

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

            const response = await axios.get('/api/sales/', {
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
                            placeholder="Buscar por nombre, correo, placa, documento o teléfono..."
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
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Responsables</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Precio Venta</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Comisión</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Detalle</th>
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
                                                    <div className="font-medium text-slate-800">{sale.lead?.name || sale.tax_buyer_name || 'Cliente Directo'}</div>
                                                    <div className="text-xs text-slate-500">Doc: {sale.client_document_number || sale.tax_buyer_document || 'Sin registrar'}</div>
                                                    <div className="text-xs text-slate-500">Cel: {sale.client_phone || sale.lead?.phone || sale.tax_buyer_phone || 'Sin registrar'}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    <div><span className="font-semibold text-slate-700">Venta:</span> {sale.seller?.full_name || sale.external_seller_name || 'Sin asignar'}</div>
                                                    <div><span className="font-semibold text-slate-700">Compra:</span> {sale.purchase_manager?.full_name || 'Sin asignar'}</div>
                                                    <div><span className="font-semibold text-slate-700">Crédito:</span> {sale.credit_manager?.full_name || 'No aplica / sin asignar'}</div>
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
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedSale(sale)}
                                                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                                                    >
                                                        Ver más
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-10 text-center text-gray-500 italic">
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

                    {selectedSale && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
                            onMouseDown={(event) => {
                                if (event.target === event.currentTarget) setSelectedSale(null);
                            }}
                        >
                            <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-slate-50 shadow-2xl">
                                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
                                    <div>
                                        <h2 className="text-2xl font-extrabold text-slate-900">Detalle de la venta #{selectedSale.id}</h2>
                                        <p className="text-sm text-slate-500">{selectedSale.vehicle?.make} {selectedSale.vehicle?.model} · {selectedSale.vehicle?.plate || 'Sin placa'}</p>
                                    </div>
                                    <button type="button" onClick={() => setSelectedSale(null)} className="rounded-full p-2 text-2xl text-slate-500 hover:bg-slate-100" aria-label="Cerrar">×</button>
                                </div>

                                <div className="grid gap-5 p-6 lg:grid-cols-2">
                                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <h3 className="mb-4 text-lg font-bold text-slate-900">Información de la venta</h3>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Fecha</p><p className="font-medium">{formatDate(selectedSale.sale_date)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Estado</p><p className="font-medium">{saleStatusLabel(selectedSale.status)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Precio de venta</p><p className="font-bold text-slate-900">{formatMoney(selectedSale.sale_price)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Comisión</p><p className="font-bold text-emerald-600">{formatMoney(selectedSale.commission_amount)} ({selectedSale.commission_percentage || 0}%)</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Ingreso neto</p><p className="font-medium">{formatMoney(selectedSale.net_revenue)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Financiación</p><p className="font-medium">{showValue(selectedSale.tax_buyer_financing_entity)}</p></div>
                                        </div>
                                        <div className="mt-5 border-t border-slate-100 pt-4 text-sm">
                                            <p><span className="font-semibold">Asesor vendedor:</span> {selectedSale.seller?.full_name || selectedSale.external_seller_name || 'Sin asignar'}</p>
                                            <p><span className="font-semibold">Encargado de compra:</span> {selectedSale.purchase_manager?.full_name || 'Sin asignar'}</p>
                                            <p><span className="font-semibold">Gestor de crédito:</span> {selectedSale.credit_manager?.full_name || 'No aplica / sin asignar'}</p>
                                        </div>
                                    </section>

                                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <h3 className="mb-4 text-lg font-bold text-slate-900">Información del cliente</h3>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Nombre</p><p className="font-medium">{selectedSale.lead?.name || selectedSale.tax_buyer_name || 'Cliente directo'}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Documento</p><p className="font-medium">{showValue(selectedSale.client_document_number || selectedSale.tax_buyer_document)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Correo</p><p className="break-all font-medium">{showValue(selectedSale.lead?.email || selectedSale.tax_buyer_email)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Celular</p><p className="font-medium">{showValue(selectedSale.client_phone || selectedSale.lead?.phone || selectedSale.tax_buyer_phone)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Dirección</p><p className="font-medium">{showValue(selectedSale.tax_buyer_address)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Medio de pago</p><p className="font-medium">{showValue(selectedSale.tax_buyer_payment_method)}</p></div>
                                        </div>
                                    </section>

                                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                                        <h3 className="mb-4 text-lg font-bold text-slate-900">Información del vehículo</h3>
                                        {Array.isArray(selectedSale.vehicle?.photos) && selectedSale.vehicle.photos.length > 0 && (
                                            <div className="mb-5 flex gap-3 overflow-x-auto pb-2">
                                                {selectedSale.vehicle.photos.map((photo, index) => (
                                                    <img key={`${photo}-${index}`} src={photo} alt={`Vehículo ${index + 1}`} className="h-32 w-44 flex-none rounded-xl border border-slate-200 object-cover" />
                                                ))}
                                            </div>
                                        )}
                                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Marca</p><p className="font-medium">{showValue(selectedSale.vehicle?.make)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Modelo</p><p className="font-medium">{showValue(selectedSale.vehicle?.model)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Año</p><p className="font-medium">{showValue(selectedSale.vehicle?.year)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Placa</p><p className="font-medium">{showValue(selectedSale.vehicle?.plate)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Kilometraje</p><p className="font-medium">{selectedSale.vehicle?.mileage ? `${Number(selectedSale.vehicle.mileage).toLocaleString('es-CO')} km` : 'Sin registrar'}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Color</p><p className="font-medium">{showValue(selectedSale.vehicle?.color)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Combustible</p><p className="font-medium">{showValue(selectedSale.vehicle?.fuel_type)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Transmisión</p><p className="font-medium">{showValue(selectedSale.vehicle?.transmission)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Motor</p><p className="font-medium">{showValue(selectedSale.vehicle?.engine)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Código interno</p><p className="font-medium">{showValue(selectedSale.vehicle?.internal_code)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Ubicación</p><p className="font-medium">{showValue(selectedSale.vehicle?.location)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Precio de compra</p><p className="font-medium">{selectedSale.vehicle?.purchase_price == null ? 'Sin registrar' : formatMoney(selectedSale.vehicle.purchase_price)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">SOAT</p><p className="font-medium">{formatDate(selectedSale.vehicle?.soat)}</p></div>
                                            <div><p className="text-xs font-semibold uppercase text-slate-400">Técnico-mecánica</p><p className="font-medium">{formatDate(selectedSale.vehicle?.tecno)}</p></div>
                                        </div>
                                        {selectedSale.vehicle?.description && (
                                            <div className="mt-5 border-t border-slate-100 pt-4">
                                                <p className="text-xs font-semibold uppercase text-slate-400">Descripción</p>
                                                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{selectedSale.vehicle.description}</p>
                                            </div>
                                        )}
                                    </section>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MySales;
