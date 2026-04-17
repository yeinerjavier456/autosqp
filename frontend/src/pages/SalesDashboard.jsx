import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const getLastMonthRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    const formatDate = (date) => date.toISOString().slice(0, 10);

    return {
        start: formatDate(start),
        end: formatDate(end)
    };
};

const SalesDashboard = () => {
    const defaultRange = getLastMonthRange();
    const [stats, setStats] = useState({
        total_revenue: 0,
        total_commissions: 0,
        total_sales_count: 0,
        pending_sales_count: 0,
        monthly_revenue: 0,
        monthly_commissions: 0,
        payroll_expenses: 0,
        receipts_total_count: 0,
        receipts_total_amount: 0,
        receipts_monthly_amount: 0,
        accounting_income_total: 0,
        accounting_expense_total: 0,
        accounting_balance_total: 0,
        accounting_income_monthly: 0,
        accounting_expense_monthly: 0,
        accounting_balance_monthly: 0
    });
    const [sales, setSales] = useState([]);
    const [approvedSales, setApprovedSales] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('pending');
    const [activeTab, setActiveTab] = useState('sales');
    const [salesSearch, setSalesSearch] = useState('');
    const [receiptSearch, setReceiptSearch] = useState('');
    const [receiptCategory, setReceiptCategory] = useState('');
    const [receiptMovementType, setReceiptMovementType] = useState('');
    const [periodPreset, setPeriodPreset] = useState('last_month');
    const [startDate, setStartDate] = useState(defaultRange.start);
    const [endDate, setEndDate] = useState(defaultRange.end);
    const [creatingReceipt, setCreatingReceipt] = useState(false);
    const [receiptForm, setReceiptForm] = useState({
        sale_id: '',
        concept: '',
        movement_type: 'income',
        amount: '',
        payment_date: new Date().toISOString().slice(0, 10),
        receipt_number: '',
        category: 'sale_payment',
        notes: '',
        file: null
    });

    useEffect(() => {
        fetchData();
    }, [filterStatus, salesSearch, receiptSearch, receiptCategory, receiptMovementType, startDate, endDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const rangeParams = periodPreset === 'all'
                ? {}
                : {
                    start_date: startDate || undefined,
                    end_date: endDate || undefined
                };

            const [statsRes, salesRes, approvedSalesRes, receiptsRes] = await Promise.all([
                axios.get('https://autosqp.co/api/finance/stats', { headers, params: rangeParams }),
                axios.get('https://autosqp.co/api/sales/', {
                    headers,
                    params: {
                        status: filterStatus,
                        q: salesSearch || undefined,
                        limit: 300,
                        ...rangeParams
                    }
                }),
                axios.get('https://autosqp.co/api/sales/?status=approved&limit=300', { headers }),
                axios.get('https://autosqp.co/api/finance/receipts', {
                    headers,
                    params: {
                        q: receiptSearch || undefined,
                        category: receiptCategory || undefined,
                        movement_type: receiptMovementType || undefined,
                        limit: 300,
                        ...rangeParams
                    }
                })
            ]);

            setStats(statsRes.data || {});
            setSales(Array.isArray(salesRes.data?.items) ? salesRes.data.items : []);
            setApprovedSales(Array.isArray(approvedSalesRes.data?.items) ? approvedSalesRes.data.items : []);
            setReceipts(Array.isArray(receiptsRes.data?.items) ? receiptsRes.data.items : []);
        } catch (error) {
            console.error('Error fetching sales data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (saleId) => {
        const result = await Swal.fire({
            title: 'Confirmar esta venta',
            text: "Se registrara la comision y el vehiculo pasara a 'Vendido'.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, aprobar venta',
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
            await axios.put(`https://autosqp.co/api/sales/${saleId}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Swal.fire('Exito', 'Venta aprobada exitosamente', 'success');
            fetchData();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Error al aprobar: ' + (error.response?.data?.detail || error.message), 'error');
        }
    };

    const handleReject = async (saleId) => {
        const result = await Swal.fire({
            title: 'Negar solicitud de venta',
            text: 'La venta quedara negada y el vehiculo volvera a disponible.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, negar venta',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'bg-red-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-slate-600 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://autosqp.co/api/sales/${saleId}/reject`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Swal.fire('Exito', 'Venta negada y vehiculo liberado', 'success');
            fetchData();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Error al negar: ' + (error.response?.data?.detail || error.message), 'error');
        }
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getSellerLabel = (sale) => {
        if (sale?.seller_type === 'external') {
            return sale?.external_seller_name || 'Asesor externo';
        }
        return sale?.seller?.full_name || sale?.seller?.email || 'Sin asesor';
    };

    const handleEditSalePrice = async (sale) => {
        const { value: salePrice } = await Swal.fire({
            title: 'Editar valor de venta',
            input: 'number',
            inputLabel: `${sale.vehicle?.make || ''} ${sale.vehicle?.model || ''}`.trim(),
            inputValue: sale.sale_price || sale.vehicle?.price || '',
            inputAttributes: {
                min: 1,
                step: 1
            },
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            inputValidator: (value) => {
                if (!value || Number(value) <= 0) {
                    return 'Debes ingresar un valor valido';
                }
                return undefined;
            },
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!salePrice) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://autosqp.co/api/sales/${sale.id}`, {
                sale_price: Number(salePrice)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchData();
            Swal.fire('Exito', 'El valor de la venta fue actualizado.', 'success');
        } catch (error) {
            console.error('Error updating sale price', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo actualizar el valor de la venta.', 'error');
        }
    };

    const handleCreateReceipt = async (e) => {
        e.preventDefault();
        if ((!receiptForm.sale_id && !receiptForm.concept.trim()) || !receiptForm.amount || Number(receiptForm.amount) <= 0) {
            Swal.fire('Atencion', 'Debes elegir una venta o escribir un concepto y poner un valor valido.', 'warning');
            return;
        }

        setCreatingReceipt(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            if (receiptForm.sale_id) {
                formData.append('sale_id', receiptForm.sale_id);
            }
            formData.append('concept', receiptForm.concept);
            formData.append('movement_type', receiptForm.movement_type);
            formData.append('amount', receiptForm.amount);
            formData.append('payment_date', receiptForm.payment_date);
            formData.append('receipt_number', receiptForm.receipt_number);
            formData.append('category', receiptForm.category);
            formData.append('notes', receiptForm.notes);
            if (receiptForm.file) {
                formData.append('file', receiptForm.file);
            }

            await axios.post('https://autosqp.co/api/finance/receipts', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setReceiptForm({
                sale_id: '',
                concept: '',
                movement_type: 'income',
                amount: '',
                payment_date: new Date().toISOString().slice(0, 10),
                receipt_number: '',
                category: 'sale_payment',
                notes: '',
                file: null
            });
            await fetchData();
            Swal.fire('Exito', 'Recibo de pago registrado correctamente.', 'success');
        } catch (error) {
            console.error('Error creating receipt', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo registrar el recibo.', 'error');
        } finally {
            setCreatingReceipt(false);
        }
    };

    const handleDeleteReceipt = async (receiptId) => {
        const result = await Swal.fire({
            title: 'Eliminar recibo',
            text: 'Este recibo dejara de contabilizarse. Esta accion no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'bg-red-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-slate-600 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`https://autosqp.co/api/finance/receipts/${receiptId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchData();
            Swal.fire('Exito', 'Recibo eliminado correctamente.', 'success');
        } catch (error) {
            console.error('Error deleting receipt', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo eliminar el recibo.', 'error');
        }
    };

    const handleEditReceipt = async (receipt) => {
        const { value: updatedData } = await Swal.fire({
            title: 'Editar registro contable',
            html: `
                <div class="space-y-3 text-left">
                    <div>
                        <label class="mb-1 block text-sm font-semibold text-gray-700">Venta aprobada</label>
                        <select id="edit-receipt-sale-id" class="swal2-select">
                            <option value="">Sin venta asociada</option>
                            ${approvedSales.map((sale) => `
                                <option value="${sale.id}" ${Number(receipt.sale?.id) === Number(sale.id) ? 'selected' : ''}>
                                    #${sale.id} - ${sale.vehicle?.make || ''} ${sale.vehicle?.model || ''} - ${sale.vehicle?.plate || ''}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-semibold text-gray-700">Concepto</label>
                            <input id="edit-receipt-concept" type="text" class="swal2-input" value="${escapeHtml(receipt.concept || '')}" placeholder="Concepto contable" />
                    </div>
                    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label class="mb-1 block text-sm font-semibold text-gray-700">Tipo</label>
                            <select id="edit-receipt-movement-type" class="swal2-select">
                                <option value="income" ${(receipt.movement_type || 'income') === 'income' ? 'selected' : ''}>Ingreso</option>
                                <option value="expense" ${(receipt.movement_type || 'income') === 'expense' ? 'selected' : ''}>Egreso</option>
                            </select>
                        </div>
                        <div>
                            <label class="mb-1 block text-sm font-semibold text-gray-700">Valor</label>
                            <input id="edit-receipt-amount" type="number" min="1" class="swal2-input" value="${Number(receipt.amount || 0)}" placeholder="Valor" />
                        </div>
                    </div>
                    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label class="mb-1 block text-sm font-semibold text-gray-700">Fecha</label>
                            <input id="edit-receipt-payment-date" type="date" class="swal2-input" value="${receipt.payment_date ? new Date(receipt.payment_date).toISOString().slice(0, 10) : ''}" />
                        </div>
                        <div>
                            <label class="mb-1 block text-sm font-semibold text-gray-700">Numero de recibo</label>
                            <input id="edit-receipt-number" type="text" class="swal2-input" value="${escapeHtml(receipt.receipt_number || '')}" placeholder="Consecutivo" />
                        </div>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-semibold text-gray-700">Categoria</label>
                        <select id="edit-receipt-category" class="swal2-select">
                            <option value="sale_payment" ${(receipt.category || 'sale_payment') === 'sale_payment' ? 'selected' : ''}>Pago de venta</option>
                            <option value="other_income" ${(receipt.category || '') === 'other_income' ? 'selected' : ''}>Otro ingreso</option>
                            <option value="commission_payment" ${(receipt.category || '') === 'commission_payment' ? 'selected' : ''}>Pago de comision</option>
                            <option value="expense" ${(receipt.category || '') === 'expense' ? 'selected' : ''}>Egreso</option>
                        </select>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-semibold text-gray-700">Nota contable</label>
                        <textarea id="edit-receipt-notes" class="swal2-textarea" placeholder="Observaciones">${escapeHtml(receipt.notes || '')}</textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Guardar cambios',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const saleId = document.getElementById('edit-receipt-sale-id')?.value || '';
                const concept = (document.getElementById('edit-receipt-concept')?.value || '').trim();
                const movementType = document.getElementById('edit-receipt-movement-type')?.value || 'income';
                const amount = Number(document.getElementById('edit-receipt-amount')?.value || 0);
                const paymentDate = document.getElementById('edit-receipt-payment-date')?.value || '';
                const receiptNumber = (document.getElementById('edit-receipt-number')?.value || '').trim();
                const category = document.getElementById('edit-receipt-category')?.value || 'sale_payment';
                const notes = (document.getElementById('edit-receipt-notes')?.value || '').trim();

                if (!amount || amount <= 0) {
                    Swal.showValidationMessage('Debes ingresar un valor valido');
                    return false;
                }
                if (!saleId && !concept) {
                    Swal.showValidationMessage('Debes asociar una venta o escribir un concepto');
                    return false;
                }
                if (!paymentDate) {
                    Swal.showValidationMessage('Debes indicar la fecha del registro');
                    return false;
                }

                return {
                    sale_id: saleId ? Number(saleId) : null,
                    concept,
                    movement_type: movementType,
                    amount,
                    payment_date: paymentDate,
                    receipt_number: receiptNumber || null,
                    category,
                    notes: notes || null
                };
            },
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!updatedData) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://autosqp.co/api/finance/receipts/${receipt.id}`, updatedData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchData();
            Swal.fire('Exito', 'El registro contable fue actualizado.', 'success');
        } catch (error) {
            console.error('Error updating receipt', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo actualizar el registro contable.', 'error');
        }
    };

    if (loading) {
        return <div className="p-10 text-center">Cargando finanzas...</div>;
    }

    const hasDateFilter = periodPreset !== 'all' && Boolean(startDate && endDate);

    return (
        <div className="animate-fade-in space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-800">Finanzas y Comisiones</h1>
                <p className="text-gray-500">Gestion de ventas, aprobaciones, contabilidad y control de ingresos.</p>
            </header>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</label>
                        <select
                            value={periodPreset}
                            onChange={(e) => {
                                const nextPreset = e.target.value;
                                setPeriodPreset(nextPreset);

                                if (nextPreset === 'last_month') {
                                    const range = getLastMonthRange();
                                    setStartDate(range.start);
                                    setEndDate(range.end);
                                    return;
                                }

                                if (nextPreset === 'all') {
                                    return;
                                }
                            }}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="last_month">Último mes</option>
                            <option value="all">Todo</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha inicial</label>
                        <input
                            type="date"
                            value={startDate}
                            disabled={periodPreset === 'all'}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha final</label>
                        <input
                            type="date"
                            value={endDate}
                            disabled={periodPreset === 'all'}
                            min={startDate || undefined}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={() => {
                                const range = getLastMonthRange();
                                setPeriodPreset('last_month');
                                setStartDate(range.start);
                                setEndDate(range.end);
                            }}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:w-auto"
                        >
                            Restablecer
                        </button>
                    </div>
                </div>
            </div>

            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'sales' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    Ventas
                </button>
                <button
                    onClick={() => setActiveTab('accounting')}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'accounting' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    Contabilidad
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium uppercase text-gray-500">Ingresos Totales</p>
                    <p className="mt-2 text-3xl font-bold text-slate-800">${stats.total_revenue?.toLocaleString() || '0'}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium uppercase text-gray-500">{hasDateFilter ? 'Ingresos del periodo' : 'Ingresos del Mes'}</p>
                    <p className="mt-2 text-3xl font-bold text-green-600">${stats.monthly_revenue?.toLocaleString() || '0'}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium uppercase text-gray-500">{hasDateFilter ? 'Comisiones del periodo' : 'Comisiones del Mes'}</p>
                    <p className="mt-2 text-3xl font-bold text-blue-600">${stats.monthly_commissions?.toLocaleString() || '0'}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-medium uppercase text-gray-500">Nomina Estimada</p>
                    <p className="mt-2 text-3xl font-bold text-purple-600">${stats.payroll_expenses?.toLocaleString() || '0'}</p>
                </div>
            </div>

            {activeTab === 'sales' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500">Ventas Cerradas</p>
                            <p className="mt-2 text-3xl font-bold text-slate-800">{stats.total_sales_count || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500">Comisiones Totales</p>
                            <p className="mt-2 text-3xl font-bold text-slate-800">${stats.total_commissions?.toLocaleString() || '0'}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500">Pendientes de Aprobacion</p>
                            <p className="mt-2 text-3xl font-bold text-orange-500">{stats.pending_sales_count || 0}</p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                        <div className="flex items-center justify-between border-b bg-gray-50 p-6">
                            <div className="w-full space-y-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <h3 className="text-lg font-bold text-gray-800">
                                        {filterStatus === 'pending' ? 'Solicitudes Pendientes' : 'Historial de Ventas'}
                                    </h3>
                                    <div className="flex gap-2 rounded-lg border border-gray-200 bg-white p-1">
                                        <button
                                            onClick={() => setFilterStatus('pending')}
                                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${filterStatus === 'pending' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Pendientes
                                        </button>
                                        <button
                                            onClick={() => setFilterStatus('approved')}
                                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${filterStatus === 'approved' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Aprobadas
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                    <input
                                        type="text"
                                        value={salesSearch}
                                        onChange={(e) => setSalesSearch(e.target.value)}
                                        placeholder="Buscar por placa, marca o modelo..."
                                        className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setSalesSearch('')}
                                        className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                        Limpiar filtro
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-600">
                                        <th className="border-b p-4">Fecha</th>
                                        <th className="border-b p-4">Vehiculo</th>
                                        <th className="border-b p-4">Vendedor</th>
                                        <th className="border-b p-4">Precio Venta</th>
                                        <th className="border-b p-4">Comision (%)</th>
                                        <th className="border-b p-4">Comision ($)</th>
                                        <th className="border-b p-4">Ingreso Neto</th>
                                        <th className="border-b p-4 text-right">Editar</th>
                                        {filterStatus === 'pending' && <th className="border-b p-4 text-right">Accion</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-gray-50">
                                            <td className="p-4 text-sm text-gray-500">
                                                {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : 'Pendiente'}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-gray-800">
                                                    {sale.vehicle?.make} {sale.vehicle?.model}
                                                </div>
                                                <div className="text-xs text-gray-500">{sale.vehicle?.plate}</div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600">{getSellerLabel(sale)}</td>
                                            <td className="p-4 font-bold text-gray-800">${sale.sale_price?.toLocaleString()}</td>
                                            <td className="p-4 text-sm text-gray-600">{sale.commission_percentage}%</td>
                                            <td className="p-4 font-medium text-blue-600">${sale.commission_amount?.toLocaleString()}</td>
                                            <td className="p-4 font-medium text-green-600">${sale.net_revenue?.toLocaleString()}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleEditSalePrice(sale)}
                                                    className="rounded bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-200"
                                                >
                                                    Editar valor
                                                </button>
                                            </td>
                                            {filterStatus === 'pending' && (
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleApprove(sale.id)}
                                                            className="rounded bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-200"
                                                        >
                                                            Aprobar
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(sale.id)}
                                                            className="rounded bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-200"
                                                        >
                                                            Negar
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {sales.length === 0 && (
                                        <tr>
                                            <td colSpan={filterStatus === 'pending' ? 9 : 8} className="p-8 text-center italic text-gray-400">
                                                No hay ventas en esta seccion.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500">Movimientos Registrados</p>
                            <p className="mt-2 text-3xl font-bold text-slate-800">{stats.receipts_total_count || 0}</p>
                            <p className="mt-2 text-xs text-slate-500">Total de soportes cargados en contabilidad.</p>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500">Ingresos Totales</p>
                            <p className="mt-2 text-3xl font-bold text-emerald-600">${stats.accounting_income_total?.toLocaleString() || '0'}</p>
                            <p className="mt-2 text-xs text-emerald-700">Suma historica de ingresos contabilizados.</p>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500">Balance Total</p>
                            <p className={`mt-2 text-3xl font-bold ${Number(stats.accounting_balance_total || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>${stats.accounting_balance_total?.toLocaleString() || '0'}</p>
                            <p className="mt-2 text-xs text-blue-700">Ingresos menos egresos contabilizados.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500">Egresos Totales</p>
                            <p className="mt-2 text-3xl font-bold text-rose-600">${stats.accounting_expense_total?.toLocaleString() || '0'}</p>
                            <p className="mt-2 text-xs text-rose-700">Gastos y salidas de caja registradas.</p>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500">Ingresos del Mes</p>
                            <p className="mt-2 text-3xl font-bold text-emerald-600">${stats.accounting_income_monthly?.toLocaleString() || '0'}</p>
                            <p className="mt-2 text-xs text-emerald-700">{hasDateFilter ? 'Ingresos contabilizados dentro del rango seleccionado.' : 'Ingresos contabilizados en el mes actual.'}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500">{hasDateFilter ? 'Balance del periodo' : 'Balance del Mes'}</p>
                            <p className={`mt-2 text-3xl font-bold ${Number(stats.accounting_balance_monthly || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>${stats.accounting_balance_monthly?.toLocaleString() || '0'}</p>
                            <p className="mt-2 text-xs text-blue-700">{hasDateFilter ? 'Resultado neto dentro del rango seleccionado.' : 'Resultado neto del mes actual.'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px,1fr]">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-800">Agregar recibo de pago</h3>
                            <p className="mt-1 text-sm text-gray-500">Registra soportes ligados a ventas o movimientos contables libres.</p>

                            <form onSubmit={handleCreateReceipt} className="mt-5 space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-gray-700">Venta aprobada</label>
                                    <select
                                        value={receiptForm.sale_id}
                                        onChange={(e) => setReceiptForm({ ...receiptForm, sale_id: e.target.value })}
                                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Sin venta asociada</option>
                                        {approvedSales.map((sale) => (
                                            <option key={sale.id} value={sale.id}>
                                                #{sale.id} - {sale.vehicle?.make} {sale.vehicle?.model} - {sale.vehicle?.plate}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-gray-700">Concepto</label>
                                    <input
                                        type="text"
                                        value={receiptForm.concept}
                                        onChange={(e) => setReceiptForm({ ...receiptForm, concept: e.target.value })}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: pago de traspaso, caja menor, anticipo, gasto operativo"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Si no asocias una venta, este concepto sera obligatorio.</p>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-gray-700">Tipo de movimiento</label>
                                        <select
                                            value={receiptForm.movement_type}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, movement_type: e.target.value })}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="income">Ingreso</option>
                                            <option value="expense">Egreso</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-gray-700">
                                            {receiptForm.movement_type === 'expense' ? 'Valor del egreso' : 'Valor del ingreso'}
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={receiptForm.amount}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-gray-700">Fecha de pago</label>
                                        <input
                                            type="date"
                                            value={receiptForm.payment_date}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, payment_date: e.target.value })}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-gray-700">Numero de recibo</label>
                                        <input
                                            type="text"
                                            value={receiptForm.receipt_number}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, receipt_number: e.target.value })}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Ej: RC-2026-001"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-gray-700">Categoria</label>
                                        <select
                                            value={receiptForm.category}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, category: e.target.value })}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="sale_payment">Pago de venta</option>
                                            <option value="other_income">Otro ingreso</option>
                                            <option value="commission_payment">Pago de comision</option>
                                            <option value="expense">Egreso</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-gray-700">Nota contable</label>
                                    <textarea
                                        rows="4"
                                        value={receiptForm.notes}
                                        onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Detalle del pago, referencia, observaciones..."
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-gray-700">Adjunto del recibo</label>
                                    <input
                                        type="file"
                                        onChange={(e) => setReceiptForm({ ...receiptForm, file: e.target.files?.[0] || null })}
                                        className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={creatingReceipt}
                                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:shadow-lg disabled:opacity-60"
                                >
                                    {creatingReceipt ? 'Guardando recibo...' : 'Guardar recibo'}
                                </button>
                            </form>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                            <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
                                <h3 className="text-lg font-bold text-gray-800">Libro de recibos</h3>
                                <p className="text-sm text-gray-500">Soportes cargados desde contabilidad.</p>
                                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_200px_200px_auto]">
                                    <input
                                        type="text"
                                        value={receiptSearch}
                                        onChange={(e) => setReceiptSearch(e.target.value)}
                                        placeholder="Buscar por concepto, recibo, placa..."
                                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-blue-500"
                                    />
                                    <select
                                        value={receiptCategory}
                                        onChange={(e) => setReceiptCategory(e.target.value)}
                                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Todas las categorías</option>
                                        <option value="sale_payment">Pago de venta</option>
                                        <option value="other_income">Otro ingreso</option>
                                        <option value="commission_payment">Pago de comisión</option>
                                        <option value="expense">Egreso</option>
                                    </select>
                                    <select
                                        value={receiptMovementType}
                                        onChange={(e) => setReceiptMovementType(e.target.value)}
                                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Todos los movimientos</option>
                                        <option value="income">Ingreso</option>
                                        <option value="expense">Egreso</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReceiptSearch('');
                                            setReceiptCategory('');
                                            setReceiptMovementType('');
                                        }}
                                        className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left">
                                    <thead>
                                        <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-600">
                                            <th className="border-b p-4">Fecha</th>
                                            <th className="border-b p-4">Venta</th>
                                            <th className="border-b p-4">Recibo</th>
                                            <th className="border-b p-4">Tipo</th>
                                            <th className="border-b p-4">Categoria</th>
                                            <th className="border-b p-4">Valor</th>
                                            <th className="border-b p-4">Soporte</th>
                                            <th className="border-b p-4 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {receipts.map((receipt) => (
                                            <tr key={receipt.id} className="hover:bg-gray-50">
                                                <td className="p-4 text-sm text-gray-600">
                                                    {receipt.payment_date ? new Date(receipt.payment_date).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-gray-800">
                                                        {receipt.sale?.id
                                                            ? `#${receipt.sale.id} - ${receipt.sale?.vehicle?.make || ''} ${receipt.sale?.vehicle?.model || ''}`.trim()
                                                            : (receipt.concept || 'Movimiento contable')}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {receipt.sale?.id
                                                            ? `${receipt.sale?.vehicle?.plate || ''} · ${receipt.sale?.seller?.full_name || receipt.sale?.seller?.email || ''}`
                                                            : 'Sin venta asociada'}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm text-gray-600">
                                                    <div className="font-medium">{receipt.receipt_number || 'Sin consecutivo'}</div>
                                                    <div className="line-clamp-2 text-xs text-gray-500">{receipt.notes || 'Sin nota'}</div>
                                                </td>
                                                <td className="p-4 text-sm">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${receipt.movement_type === 'expense' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {receipt.movement_type === 'expense' ? 'Egreso' : 'Ingreso'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm capitalize text-gray-600">
                                                    {(receipt.category || 'sale_payment').replaceAll('_', ' ')}
                                                </td>
                                                <td className={`p-4 font-semibold ${receipt.movement_type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    ${Number(receipt.amount || 0).toLocaleString()}
                                                </td>
                                                <td className="p-4 text-sm">
                                                    {receipt.file_path ? (
                                                        <a
                                                            href={`https://autosqp.com/api${receipt.file_path}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                                                        >
                                                            Ver adjunto
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400">Sin archivo</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEditReceipt(receipt)}
                                                            className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                                                        >
                                                            Editar
                                                        </button>
                                                        <a
                                                            href={`https://autosqp.com/api/finance/receipts/${receipt.id}/pdf`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100"
                                                        >
                                                            PDF
                                                        </a>
                                                        <button
                                                            onClick={() => handleDeleteReceipt(receipt.id)}
                                                            className="inline-flex items-center rounded-lg bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {receipts.length === 0 && (
                                            <tr>
                                                <td colSpan="8" className="p-8 text-center italic text-gray-400">
                                                    Aun no hay recibos registrados en contabilidad.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesDashboard;
