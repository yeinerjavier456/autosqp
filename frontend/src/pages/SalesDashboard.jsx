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

const formatCurrencyInput = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('es-CO');
};

const parseCurrencyInput = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits ? Number(digits) : 0;
};

const attachCurrencyFormatter = (input) => {
    if (!input) return;
    input.addEventListener('input', () => {
        const formatted = formatCurrencyInput(input.value);
        input.value = formatted;
        try {
            input.setSelectionRange(formatted.length, formatted.length);
        } catch {}
    });
};

const sortReceiptsByRecentFirst = (items = []) => {
    return [...items].sort((left, right) => {
        const leftTime = new Date(left?.payment_date || left?.created_at || 0).getTime();
        const rightTime = new Date(right?.payment_date || right?.created_at || 0).getTime();
        if (rightTime !== leftTime) return rightTime - leftTime;
        return Number(right?.id || 0) - Number(left?.id || 0);
    });
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
    const [taxRows, setTaxRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('pending');
    const [activeTab, setActiveTab] = useState('sales');
    const [salesSearch, setSalesSearch] = useState('');
    const [receiptSearch, setReceiptSearch] = useState('');
    const [receiptCategory, setReceiptCategory] = useState('');
    const [receiptMovementType, setReceiptMovementType] = useState('');
    const [selectedReceiptGroup, setSelectedReceiptGroup] = useState(null);
    const [editingGroupName, setEditingGroupName] = useState('');
    const [saleAttachments, setSaleAttachments] = useState([]);
    const [editingReceipt, setEditingReceipt] = useState(null);
    const [editReceiptForm, setEditReceiptForm] = useState({});
    const [editReceiptFile, setEditReceiptFile] = useState(null);
    const [savingEditReceipt, setSavingEditReceipt] = useState(false);
    const [periodPreset, setPeriodPreset] = useState('last_month');
    const [startDate, setStartDate] = useState(defaultRange.start);
    const [endDate, setEndDate] = useState(defaultRange.end);
    const [creatingReceipt, setCreatingReceipt] = useState(false);
    const [receiptForm, setReceiptForm] = useState({
        sale_id: '',
        display_name: '',
        concept: '',
        concept_detail: '',
        movement_type: 'income',
        amount: '',
        payment_date: new Date().toISOString().slice(0, 10),
        receipt_number: '',
        category: 'sale_payment',
        notes: '',
        payment_method: '',
        bank: '',
        file: null
    });

    const receiptConceptOptions = [
        'Venta de Vehiculo',
        'Compra de Vehiculo',
        'Abono compra',
        'Separación del vehículo',
        'Traspaso / Tramites',
        'Peritaje',
        'Mantenimiento / Alistamiento',
        'Lavado',
        'Pago SOAT',
        'Pago Impuestos',
        'Pago Comision',
        'Pago Arriendo',
        'Servicios Publicos',
        'Pago Nomina',
        'Caja Menor',
        'Publicidad',
        'Otros'
    ];
    const receiptCategoryOptions = [
        ['ingreso_venta', 'Ingresos por Venta'],
        ['costo_vehiculo', 'Costo de Vehículo (Compra)'],
        ['vehicle_purchase', 'Compra de Vehículo'],
        ['purchase_payment', 'Abono compra'],
        ['vehicle_separation', 'Separación del vehículo'],
        ['gasto_tramites', 'Gastos de Trámites y Alistamiento'],
        ['vehicle_expense', 'Gastos del Vehículo'],
        ['gasto_operativo', 'Gastos Operativos y Administrativos'],
        ['comisiones', 'Pago de Comisiones'],
        ['otros', 'Otros Movimientos']
    ];
    const paymentMethodOptions = [
        ['efectivo', 'Efectivo'],
        ['transferencia', 'Transferencia']
    ];
    const bankOptions = [
        'BANCOLOMBIA',
        'BBVA',
        'NEQUI JENN',
        'NEQUI DIEGO',
        'DAVIVIENDA',
        'COLPATRIA',
        'CUENTA DE BOLD'
    ];

    const getReceiptDefaultsForConcept = (concept) => {
        if (concept === 'Venta de Vehiculo') return { category: 'ingreso_venta', movement_type: 'income' };
        if (concept === 'Compra de Vehiculo') return { category: 'costo_vehiculo', movement_type: 'expense' };
        if (concept === 'Abono compra') return { category: 'purchase_payment', movement_type: 'expense' };
        if (concept === 'Separación del vehículo') return { category: 'vehicle_separation', movement_type: 'income' };
        if (['Traspaso / Tramites', 'Peritaje', 'Mantenimiento / Alistamiento', 'Lavado', 'Pago SOAT', 'Pago Impuestos'].includes(concept)) {
            return { category: 'gasto_tramites', movement_type: 'expense' };
        }
        if (['Pago Arriendo', 'Servicios Publicos', 'Pago Nomina', 'Publicidad'].includes(concept)) {
            return { category: 'gasto_operativo', movement_type: 'expense' };
        }
        if (concept === 'Pago Comision') return { category: 'comisiones', movement_type: 'expense' };
        return { category: 'otros', movement_type: 'expense' };
    };

    useEffect(() => {
        fetchData();
    }, [filterStatus, salesSearch, receiptSearch, receiptCategory, receiptMovementType, startDate, endDate]);

    useEffect(() => {
        if (selectedReceiptGroup?.sale?.id) {
            fetchSaleAttachments(selectedReceiptGroup.sale.id);
        } else {
            setSaleAttachments([]);
        }
    }, [selectedReceiptGroup?.sale?.id]);

    useEffect(() => {
        if (selectedReceiptGroup) {
            const groups = buildReceiptGroups(receipts);
            const updatedGroup = groups.find(g => g.key === selectedReceiptGroup.key);
            if (updatedGroup) {
                setSelectedReceiptGroup(updatedGroup);
            }
        }
    }, [receipts]);

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

            const activeYear = startDate ? Number(startDate.slice(0, 4)) : new Date().getFullYear();
            const [statsRes, salesRes, approvedSalesRes, receiptsRes, taxRes] = await Promise.all([
                axios.get('/api/finance/stats', { headers, params: rangeParams }),
                axios.get('/api/sales/', {
                    headers,
                    params: {
                        status: filterStatus,
                        q: salesSearch || undefined,
                        limit: 300,
                        ...rangeParams
                    }
                }),
                axios.get('/api/sales/?status=approved&limit=300', { headers }),
                axios.get('/api/finance/receipts', {
                    headers,
                    params: {
                        q: receiptSearch || undefined,
                        category: receiptCategory || undefined,
                        movement_type: receiptMovementType || undefined,
                        limit: 300,
                        ...rangeParams
                    }
                }),
                axios.get('/api/finance/tax-report', {
                    headers,
                    params: {
                        year: activeYear,
                        limit: 500
                    }
                })
            ]);

            setStats(statsRes.data || {});
            setSales(Array.isArray(salesRes.data?.items) ? salesRes.data.items : []);
            setApprovedSales(Array.isArray(approvedSalesRes.data?.items) ? approvedSalesRes.data.items : []);
            setReceipts(Array.isArray(receiptsRes.data?.items) ? receiptsRes.data.items : []);
            setTaxRows(Array.isArray(taxRes.data?.items) ? taxRes.data.items : []);
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
            await axios.put(`/api/sales/${saleId}/approve`, {}, {
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
            await axios.put(`/api/sales/${saleId}/reject`, {}, {
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

    const getBestGroupDisplayName = (receiptsGroup) => {
        const candidates = (Array.isArray(receiptsGroup) ? receiptsGroup : [])
            .map((item) => String(item?.display_name || '').trim())
            .filter(Boolean);

        if (candidates.length === 0) return '';

        const scoreName = (value) => {
            const hasDigits = /\d/.test(value) ? 1 : 0;
            const wordCount = value.split(/\s+/).filter(Boolean).length;
            return [hasDigits, wordCount, value.length];
        };

        return candidates.reduce((best, current) => {
            if (!best) return current;
            const bestScore = scoreName(best);
            const currentScore = scoreName(current);
            for (let index = 0; index < currentScore.length; index += 1) {
                if (currentScore[index] > bestScore[index]) return current;
                if (currentScore[index] < bestScore[index]) return best;
            }
            return best;
        }, '');
    };

    const getSellerLabel = (sale) => {
        if (sale?.seller_type === 'external') {
            return sale?.external_seller_name || 'Asesor externo';
        }
        return sale?.seller?.full_name || sale?.seller?.email || 'Sin asesor';
    };

    const getCategoryLabel = (category) => {
        if (category === 'ingreso_venta') return 'Ingresos por Venta';
        if (category === 'costo_vehiculo') return 'Costo de Vehículo (Compra)';
        if (category === 'vehicle_purchase') return 'Compra de Vehículo';
        if (category === 'purchase_payment') return 'Abono compra';
        if (category === 'vehicle_separation') return 'Separación del vehículo';
        if (category === 'gasto_tramites') return 'Gastos de Trámites y Alistamiento';
        if (category === 'vehicle_expense') return 'Gastos del Vehículo';
        if (category === 'gasto_operativo') return 'Gastos Operativos y Administrativos';
        if (category === 'comisiones') return 'Pago de Comisiones';
        if (category === 'otros') return 'Otros Movimientos';
        return (category || 'Sin cuenta').replaceAll('_', ' ');
    };

    const buildReceiptGroups = (receiptItems) => {
        const groupsByKey = new Map();

        receiptItems.forEach((receipt) => {
            const saleId = receipt.sale?.id || receipt.sale_id;
            const receiptNumber = (receipt.receipt_number || '').trim();
            const key = saleId
                ? `sale-${saleId}`
                : receiptNumber
                    ? `support-${receiptNumber}`
                    : `receipt-${receipt.id}`;
            const existing = groupsByKey.get(key);

            if (existing) {
                existing.receipts.push(receipt);
                return;
            }

            groupsByKey.set(key, {
                key,
                sale: receipt.sale || null,
                receiptNumber: saleId ? null : receiptNumber || null,
                receipts: [receipt]
            });
        });

        return Array.from(groupsByKey.values()).map((group) => {
            const orderedReceipts = sortReceiptsByRecentFirst(group.receipts);
            const latestReceipt = group.receipts.reduce((latest, receipt) => {
                const latestTime = new Date(latest.payment_date || latest.created_at || 0).getTime();
                const receiptTime = new Date(receipt.payment_date || receipt.created_at || 0).getTime();
                return receiptTime > latestTime ? receipt : latest;
            }, orderedReceipts[0]);
            const incomeTotal = orderedReceipts
                .filter((receipt) => (receipt.movement_type || 'income') === 'income')
                .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
            const expenseTotal = orderedReceipts
                .filter((receipt) => (receipt.movement_type || 'income') === 'expense')
                .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);

            return {
                ...group,
                receipts: orderedReceipts,
                latestReceipt,
                incomeTotal,
                expenseTotal,
                balanceTotal: incomeTotal - expenseTotal,
                isSaleGroup: Boolean(group.sale?.id),
                isAccountingSupportGroup: !group.sale?.id && Boolean(group.receiptNumber)
            };
        });
    };

    const appendReceiptToSelectedGroup = (newReceipt) => {
        setSelectedReceiptGroup((current) => {
            if (!current) return current;

            const currentSaleId = current.sale?.id || null;
            const newSaleId = newReceipt.sale?.id || newReceipt.sale_id || null;
            const currentReceiptNumber = current.receiptNumber || null;
            const newReceiptNumber = (newReceipt.receipt_number || '').trim() || null;

            if (currentSaleId && currentSaleId !== newSaleId) return current;
            if (!currentSaleId && currentReceiptNumber && currentReceiptNumber !== newReceiptNumber) return current;

            return {
                ...current,
                receipts: sortReceiptsByRecentFirst([...current.receipts, newReceipt])
            };
        });
    };

    const loadReceiptGroupDetails = async (group) => {
        if (!group) return null;

        const token = localStorage.getItem('token');
        const params = {
            limit: 500
        };

        if (group.sale?.id) {
            params.sale_id = group.sale.id;
        } else if (group.receiptNumber) {
            params.receipt_number = group.receiptNumber;
        } else if (group.latestReceipt?.id) {
            params.q = group.latestReceipt.display_name || group.latestReceipt.receipt_number || String(group.latestReceipt.id);
        }

        const response = await axios.get('/api/finance/receipts', {
            headers: { Authorization: `Bearer ${token}` },
            params
        });

        const fetchedItems = Array.isArray(response.data?.items) ? response.data.items : [];
        const fetchedGroups = buildReceiptGroups(fetchedItems);
        const targetKey = group.key;
        const updatedGroup = fetchedGroups.find((item) => item.key === targetKey)
            || fetchedGroups[0]
            || null;

        if (updatedGroup) {
            setSelectedReceiptGroup(updatedGroup);
        }

        return updatedGroup;
    };

    const ensureAccountingSupportNumber = async (group, token) => {
        if (group?.sale?.id) return null;
        if (group?.receiptNumber) return group.receiptNumber;

        const fallbackReceiptId = group?.latestReceipt?.id || group?.receipts?.[0]?.id;
        if (!fallbackReceiptId) {
            throw new Error('No se pudo identificar el soporte contable');
        }

        const generatedReceiptNumber = `CONT-LEGACY-${fallbackReceiptId}`;
        const receiptsWithoutSupport = (group?.receipts || []).filter((receipt) => !(receipt?.receipt_number || '').trim());

        await Promise.all(receiptsWithoutSupport.map((receipt) => axios.put(`/api/finance/receipts/${receipt.id}`, {
            sale_id: receipt.sale?.id || receipt.sale_id || null,
            concept: receipt.concept || null,
            display_name: receipt.display_name || null,
            movement_type: receipt.movement_type || 'income',
            receipt_number: generatedReceiptNumber,
            payment_date: receipt.payment_date || receipt.created_at || null,
            amount: Number(receipt.amount || 0),
            category: receipt.category || 'sale_payment',
            notes: receipt.notes || null,
            payment_method: receipt.payment_method || null,
            bank: receipt.bank || null
        }, {
            headers: { Authorization: `Bearer ${token}` }
        })));

        setSelectedReceiptGroup((current) => current ? ({
            ...current,
            receiptNumber: generatedReceiptNumber,
            receipts: current.receipts.map((receipt) => ({
                ...receipt,
                receipt_number: receipt.receipt_number || generatedReceiptNumber
            }))
        }) : current);

        return generatedReceiptNumber;
    };

    const receiptGroups = buildReceiptGroups(receipts);
    const selectedReceiptGroupTotals = selectedReceiptGroup ? {
        incomeTotal: selectedReceiptGroup.receipts
            .filter((receipt) => (receipt.movement_type || 'income') === 'income')
            .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0),
        expenseTotal: selectedReceiptGroup.receipts
            .filter((receipt) => (receipt.movement_type || 'income') === 'expense')
            .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0)
    } : null;
    if (selectedReceiptGroupTotals) {
        selectedReceiptGroupTotals.balanceTotal = selectedReceiptGroupTotals.incomeTotal - selectedReceiptGroupTotals.expenseTotal;
    }

    const handleDownloadTaxReport = () => {
        const token = localStorage.getItem('token');
        const activeYear = startDate ? Number(startDate.slice(0, 4)) : new Date().getFullYear();
        window.open(`/api/finance/tax-report.xlsx?year=${activeYear}&token=${token}`, '_blank');
    };

    const handleDownloadReceiptsReport = () => {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams();
        params.set('token', token);
        window.open(`/api/finance/receipts.xlsx?${params.toString()}`, '_blank');
    };

    const handleEditTaxInfo = async (row = null) => {
        const isManual = row?.source === 'manual' || !row;
        const fieldLabels = [
            ...(isManual ? [
                ['month', 'Mes'],
                ['year', 'Año'],
                ['make', 'Marca'],
                ['reference', 'Referencia'],
                ['plate', 'Placa'],
                ['model_year', 'Modelo'],
                ['purchase_price', 'Precio compra / consignación'],
                ['sale_price', 'Precio venta']
            ] : []),
            ['transaction_type', 'Intermediación o venta completa'],
            ['transfer_to_cars', 'Traspaso a Cars SI/NO'],
            ['seller_name', 'Vendedor del carro - Nombre o razón social'],
            ['seller_document', 'Vendedor del carro - Documento/NIT'],
            ['seller_email', 'Vendedor del carro - Email'],
            ['seller_address', 'Vendedor del carro - Dirección'],
            ['seller_phone', 'Vendedor del carro - Teléfono'],
            ['seller_payment_method', 'Forma de pago al vendedor'],
            ['buyer_name', 'Comprador - Nombre'],
            ['buyer_document', 'Comprador - Documento'],
            ['buyer_email', 'Comprador - Email'],
            ['buyer_address', 'Comprador - Dirección'],
            ['buyer_phone', 'Comprador - Teléfono'],
            ['buyer_payment_method', 'Forma de pago del comprador'],
            ['buyer_financing_entity', 'Entidad / observación']
        ];
        const valueByField = {
            month: row?.month || '',
            year: row?.year || (startDate ? Number(startDate.slice(0, 4)) : new Date().getFullYear()),
            make: row?.make || '',
            reference: row?.reference || '',
            plate: row?.plate || '',
            model_year: row?.model_year || '',
            purchase_price: row?.purchase_price || '',
            sale_price: row?.sale_price || '',
            transaction_type: row?.transaction_type || 'INTERMEDIACION',
            transfer_to_cars: row?.transfer_to_cars || '',
            seller_name: row?.seller_name || '',
            seller_document: row?.seller_document || '',
            seller_email: row?.seller_email || '',
            seller_address: row?.seller_address || '',
            seller_phone: row?.seller_phone || '',
            seller_payment_method: row?.seller_payment_method || '',
            buyer_name: row?.buyer_name || '',
            buyer_document: row?.buyer_document || '',
            buyer_email: row?.buyer_email || '',
            buyer_address: row?.buyer_address || '',
            buyer_phone: row?.buyer_phone || '',
            buyer_payment_method: row?.buyer_payment_method || '',
            buyer_financing_entity: row?.buyer_financing_entity || ''
        };
        const renderInput = (field, label, options = {}) => {
            const value = escapeHtml(valueByField[field] ?? '');
            if (options.type === 'select') {
                return `
                    <label class="tax-field">
                        <span>${label}</span>
                        <select id="tax-${field}" class="tax-input">
                            <option value="">Seleccionar</option>
                            ${options.items.map((item) => `<option value="${escapeHtml(item)}" ${String(valueByField[field] || '').toUpperCase() === String(item).toUpperCase() ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
                        </select>
                    </label>
                `;
            }
            return `
                <label class="tax-field">
                    <span>${label}</span>
                    <input id="tax-${field}" class="tax-input" type="${options.type || 'text'}" value="${value}" placeholder="${label}" />
                </label>
            `;
        };

        const { value } = await Swal.fire({
            title: row ? `Editar tributación ${isManual ? 'manual' : `venta #${row.sale_id}`}` : 'Agregar tributación manual',
            width: 760,
            html: `
                <style>
                    .tax-modal { text-align:left; }
                    .tax-tabs { display:grid; grid-template-columns:repeat(${isManual ? 4 : 3}, minmax(0, 1fr)); border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:16px; }
                    .tax-tab { border:0; background:#fff; padding:14px 10px; font-weight:700; color:#64748b; cursor:pointer; display:flex; flex-direction:column; gap:5px; align-items:center; }
                    .tax-tab.active { color:#2563eb; background:#f8fbff; box-shadow:inset 0 -3px 0 #2563eb; }
                    .tax-card { border:1px solid #e5e7eb; border-radius:10px; padding:18px; box-shadow:0 8px 20px rgba(15,23,42,.05); }
                    .tax-title { display:flex; align-items:center; gap:8px; color:#2563eb; font-weight:800; margin-bottom:16px; }
                    .tax-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:14px; }
                    .tax-field { display:flex; flex-direction:column; gap:7px; font-size:12px; font-weight:700; color:#475569; }
                    .tax-input { width:100%; border:1px solid #dbe3ef; border-radius:6px; padding:10px 11px; font-size:13px; color:#0f172a; outline:none; }
                    .tax-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
                    .tax-help { margin:22px auto 4px; max-width:520px; border-radius:10px; background:#f0f6ff; text-align:center; padding:22px; color:#475569; }
                    .tax-help-icon { font-size:38px; line-height:1; margin-bottom:8px; }
                    .tax-help strong { display:block; color:#1e293b; margin-bottom:4px; }
                    .tax-nav { display:flex; justify-content:space-between; align-items:center; margin-top:20px; }
                    .tax-nav button { border:0; border-radius:8px; padding:10px 18px; font-weight:700; cursor:pointer; }
                    .tax-prev { background:#f1f5f9; color:#64748b; }
                    .tax-next { background:#2563eb; color:#fff; }
                    .tax-prev:disabled, .tax-next:disabled { opacity:.45; cursor:not-allowed; }
                    .tax-section { display:none; }
                    .tax-section.active { display:block; }
                    @media (max-width: 720px) { .tax-grid { grid-template-columns:1fr; } .tax-tabs { grid-template-columns:1fr 1fr; } }
                </style>
                <div class="tax-modal">
                    <div class="tax-tabs">
                        ${isManual ? '<button type="button" class="tax-tab active" data-tax-tab="vehicle"><span>🚙</span><span>Vehículo</span></button>' : ''}
                        <button type="button" class="tax-tab ${isManual ? '' : 'active'}" data-tax-tab="operation"><span>💲</span><span>Operación</span></button>
                        <button type="button" class="tax-tab" data-tax-tab="seller"><span>♙</span><span>Vendedor</span></button>
                        <button type="button" class="tax-tab" data-tax-tab="buyer"><span>♙</span><span>Comprador</span></button>
                    </div>
                    ${isManual ? `
                        <section class="tax-section active" data-tax-section="vehicle">
                            <div class="tax-card">
                                <div class="tax-title">🚙 <span>Datos del vehículo</span></div>
                                <div class="tax-grid">
                                    ${renderInput('month', 'Mes', { type: 'select', items: ['ENE', 'FEB', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPT', 'OCT', 'NOV', 'DIC'] })}
                                    ${renderInput('year', 'Año', { type: 'number' })}
                                    ${renderInput('make', 'Marca')}
                                    ${renderInput('model_year', 'Modelo', { type: 'number' })}
                                    ${renderInput('plate', 'Placa')}
                                    ${renderInput('reference', 'Referencia')}
                                </div>
                                <div class="tax-help"><div class="tax-help-icon">🚙</div><strong>Ingresa los datos básicos del vehículo</strong>Estos datos serán utilizados para la tributación y gestión.</div>
                            </div>
                        </section>
                    ` : ''}
                    <section class="tax-section ${isManual ? '' : 'active'}" data-tax-section="operation">
                        <div class="tax-card">
                            <div class="tax-title">💲 <span>Datos de operación</span></div>
                            <div class="tax-grid">
                                ${isManual ? renderInput('purchase_price', 'Precio compra / consignación', { type: 'number' }) : ''}
                                ${isManual ? renderInput('sale_price', 'Precio venta', { type: 'number' }) : ''}
                                ${renderInput('transaction_type', 'Intermediación o venta completa', { type: 'select', items: ['INTERMEDIACION', 'VENTA COMPLETA'] })}
                                ${renderInput('transfer_to_cars', 'Traspaso a Cars SI/NO', { type: 'select', items: ['SI', 'NO'] })}
                            </div>
                            <div class="tax-help"><div class="tax-help-icon">💲</div><strong>Define valores y tipo de operación</strong>Estos datos alimentan comisión, IVA y exportación contable.</div>
                        </div>
                    </section>
                    <section class="tax-section" data-tax-section="seller">
                        <div class="tax-card">
                            <div class="tax-title">♙ <span>A quien le compré el carro</span></div>
                            <div class="tax-grid">
                                ${renderInput('seller_name', 'Nombre o razón social')}
                                ${renderInput('seller_document', 'Documento / NIT')}
                                ${renderInput('seller_email', 'Email')}
                                ${renderInput('seller_address', 'Dirección')}
                                ${renderInput('seller_phone', 'Teléfono')}
                                ${renderInput('seller_payment_method', 'Forma de pago a vendedor')}
                            </div>
                        </div>
                    </section>
                    <section class="tax-section" data-tax-section="buyer">
                        <div class="tax-card">
                            <div class="tax-title">♙ <span>A quien le vendí el carro</span></div>
                            <div class="tax-grid">
                                ${renderInput('buyer_name', 'Nombre')}
                                ${renderInput('buyer_document', 'Documento')}
                                ${renderInput('buyer_email', 'Email')}
                                ${renderInput('buyer_address', 'Dirección')}
                                ${renderInput('buyer_phone', 'Teléfono')}
                                ${renderInput('buyer_payment_method', 'Forma de pago del comprador')}
                                ${renderInput('buyer_financing_entity', 'Entidad / observación')}
                            </div>
                        </div>
                    </section>
                    <div class="tax-nav">
                        <button type="button" class="tax-prev" id="tax-prev">← Anterior</button>
                        <button type="button" class="tax-next" id="tax-next">Siguiente →</button>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => fieldLabels.reduce((payload, [field]) => {
                payload[field] = document.getElementById(`tax-${field}`)?.value || '';
                return payload;
            }, {}),
            didOpen: () => {
                const tabs = Array.from(document.querySelectorAll('.tax-tab'));
                const sections = Array.from(document.querySelectorAll('.tax-section'));
                const previous = document.getElementById('tax-prev');
                const next = document.getElementById('tax-next');
                let activeIndex = 0;
                const setActive = (index) => {
                    activeIndex = Math.max(0, Math.min(index, tabs.length - 1));
                    const activeName = tabs[activeIndex]?.dataset.taxTab;
                    tabs.forEach((tab, tabIndex) => tab.classList.toggle('active', tabIndex === activeIndex));
                    sections.forEach((section) => section.classList.toggle('active', section.dataset.taxSection === activeName));
                    if (previous) previous.disabled = activeIndex === 0;
                    if (next) next.disabled = activeIndex === tabs.length - 1;
                };
                tabs.forEach((tab, index) => tab.addEventListener('click', () => setActive(index)));
                previous?.addEventListener('click', () => setActive(activeIndex - 1));
                next?.addEventListener('click', () => setActive(activeIndex + 1));
                setActive(0);
            },
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!value) return;

        try {
            const token = localStorage.getItem('token');
            if (!row) {
                await axios.post('/api/finance/tax-report/manual', value, { headers: { Authorization: `Bearer ${token}` } });
            } else if (isManual) {
                await axios.put(`/api/finance/tax-report/manual/${row.manual_entry_id}`, value, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                const salePayload = {};
                Object.entries(value).forEach(([field, fieldValue]) => {
                    salePayload[`tax_${field}`] = fieldValue;
                });
                await axios.put(`/api/sales/${row.sale_id}/tax-info`, salePayload, { headers: { Authorization: `Bearer ${token}` } });
            }
            await fetchData();
            Swal.fire('Exito', 'Datos de tributación actualizados.', 'success');
        } catch (error) {
            console.error('Error updating tax info', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo actualizar tributación.', 'error');
        }
    };

    const handleDeleteManualTaxInfo = async (row) => {
        const result = await Swal.fire({
            title: 'Eliminar registro manual',
            text: 'Este registro saldrá del cuadro de tributación y del Excel.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'bg-red-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });
        if (!result.isConfirmed) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/finance/tax-report/manual/${row.manual_entry_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchData();
            Swal.fire('Exito', 'Registro manual eliminado.', 'success');
        } catch (error) {
            console.error('Error deleting manual tax info', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo eliminar el registro.', 'error');
        }
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
            await axios.put(`/api/sales/${sale.id}`, {
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
        const parsedAmount = parseCurrencyInput(receiptForm.amount);
        if (!receiptForm.concept.trim() || !parsedAmount || parsedAmount <= 0) {
            Swal.fire('Atencion', 'Debes seleccionar un concepto y poner un valor valido.', 'warning');
            return;
        }

        setCreatingReceipt(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            if (receiptForm.sale_id) {
                formData.append('sale_id', receiptForm.sale_id);
            }
            formData.append('display_name', receiptForm.display_name || '');
            formData.append('concept', receiptForm.concept === 'Otros' ? (receiptForm.concept_detail || 'Otros') : receiptForm.concept);
            formData.append('movement_type', receiptForm.movement_type);
            formData.append('amount', String(parsedAmount));
            formData.append('payment_date', receiptForm.payment_date);
            formData.append('category', receiptForm.category);
            formData.append('notes', receiptForm.notes);
            formData.append('payment_method', receiptForm.payment_method || '');
            formData.append('bank', receiptForm.bank || '');
            if (receiptForm.file) {
                formData.append('file', receiptForm.file);
            }

            await axios.post('/api/finance/receipts', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setReceiptForm({
                sale_id: '',
                display_name: '',
                concept: '',
                concept_detail: '',
                movement_type: 'income',
                amount: '',
                payment_date: new Date().toISOString().slice(0, 10),
                receipt_number: '',
                category: 'sale_payment',
                notes: '',
                payment_method: '',
                bank: '',
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

    const fetchSaleAttachments = async (saleId) => {
        if (!saleId) return;
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/finance/sales/${saleId}/attachments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSaleAttachments(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (error) {
            console.error('Error loading sale attachments', error);
            setSaleAttachments([]);
        }
    };

    const handleUploadSaleAttachment = async (sale) => {
        if (!sale?.id) return;
        const { value } = await Swal.fire({
            title: 'Adjuntar comprobante',
            width: 520,
            html: `
                <div class="space-y-4 text-left">
                    <label class="block text-sm font-semibold text-slate-700">
                        Archivo
                        <input id="sale-attachment-file" type="file" class="swal2-file" />
                    </label>
                    <label class="block text-sm font-semibold text-slate-700">
                        Nota
                        <textarea id="sale-attachment-note" class="swal2-textarea" placeholder="Nombre, detalle u observación del comprobante"></textarea>
                    </label>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Subir comprobante',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const file = document.getElementById('sale-attachment-file')?.files?.[0];
                if (!file) {
                    Swal.showValidationMessage('Debes seleccionar un archivo');
                    return false;
                }
                return {
                    file,
                    note: (document.getElementById('sale-attachment-note')?.value || '').trim()
                };
            },
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!value) return;
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('file', value.file);
            formData.append('note', value.note || '');
            await axios.post(`/api/finance/sales/${sale.id}/attachments`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            await fetchSaleAttachments(sale.id);
            Swal.fire('Exito', 'Comprobante adjuntado a la venta.', 'success');
        } catch (error) {
            console.error('Error uploading sale attachment', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo subir el comprobante.', 'error');
        }
    };

    const handleDeleteSaleAttachment = async (attachment) => {
        if (!selectedReceiptGroup?.sale?.id || !attachment?.id) return;
        const result = await Swal.fire({
            title: 'Eliminar comprobante',
            text: 'El archivo se quitará de esta venta.',
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
            await axios.delete(`/api/finance/sales/${selectedReceiptGroup.sale.id}/attachments/${attachment.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchSaleAttachments(selectedReceiptGroup.sale.id);
            Swal.fire('Exito', 'Comprobante eliminado.', 'success');
        } catch (error) {
            console.error('Error deleting sale attachment', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo eliminar el comprobante.', 'error');
        }
    };

    const handleCreateReceiptForGroup = async (group) => {
        if (!group?.sale?.id && !group?.latestReceipt?.id && !group?.receipts?.length) return;
        const defaultDate = new Date().toISOString().slice(0, 10);
        const sale = group?.sale || null;
        const supportLabel = group?.receiptNumber || group?.latestReceipt?.receipt_number || `CONT-LEGACY-${group?.latestReceipt?.id || group?.receipts?.[0]?.id || ''}`;
        const isSaleGroup = Boolean(sale?.id);

        const { value } = await Swal.fire({
            title: isSaleGroup ? 'Agregar ítem a la venta' : `Agregar ítem al soporte ${supportLabel}`,
            width: 560,
            html: `
                <style>
                    .sale-item-modal { text-align: left; }
                    .sale-item-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                    .sale-item-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%); }
                    .sale-item-card.green { background: linear-gradient(135deg, #ffffff 0%, #f3fff8 100%); }
                    .sale-item-card.purple { background: linear-gradient(135deg, #ffffff 0%, #fbf7ff 100%); }
                    .sale-item-card.amber { background: linear-gradient(135deg, #ffffff 0%, #fffaf0 100%); }
                    .sale-item-card.full { grid-column: 1 / -1; }
                    .sale-item-title { margin-bottom: 14px; font-weight: 800; color: #2563eb; }
                    .sale-item-card.green .sale-item-title { color: #16a34a; }
                    .sale-item-card.purple .sale-item-title { color: #7c3aed; }
                    .sale-item-card.amber .sale-item-title { color: #f59e0b; }
                    .sale-item-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                    .sale-item-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 700; color: #475569; }
                    .sale-item-field input, .sale-item-field select, .sale-item-field textarea {
                        width: 100%; border: 1px solid #dbe3ee; border-radius: 6px; padding: 10px 12px;
                        font-size: 13px; font-weight: 600; color: #334155; outline: none; background: white;
                    }
                    .sale-item-field textarea { min-height: 86px; resize: vertical; font-weight: 500; }
                    @media (max-width: 640px) {
                        .sale-item-grid, .sale-item-row { grid-template-columns: 1fr; }
                        .sale-item-card.full { grid-column: auto; }
                    }
                </style>
                <div class="sale-item-modal">
                    <div class="sale-item-grid">
                        <section class="sale-item-card">
                            <div class="sale-item-title">Información general</div>
                            <div class="sale-item-field" style="margin-bottom: 12px;">
                                Nombre
                                <input id="new-receipt-display-name" type="text" placeholder="Ej: Chevrolet Spark FLX485" />
                            </div>
                            <div class="sale-item-field">
                                Concepto
                                <select id="new-receipt-concept">
                                    ${receiptConceptOptions.map((option) => `<option value="${option}">${option}</option>`).join('')}
                                </select>
                            </div>
                            <div class="sale-item-field" style="margin-top: 12px;">
                                Valor
                                <input id="new-receipt-amount" type="text" inputmode="numeric" placeholder="$ 0,00" />
                            </div>
                        </section>
                        <section class="sale-item-card green">
                            <div class="sale-item-title">Clasificación</div>
                            <div class="sale-item-row">
                                <label class="sale-item-field">
                                    Tipo
                                    <select id="new-receipt-movement-type">
                                        <option value="expense">Egreso</option>
                                        <option value="income">Ingreso</option>
                                    </select>
                                </label>
                                <label class="sale-item-field">
                                    Fecha
                                    <input id="new-receipt-payment-date" type="date" value="${defaultDate}" />
                                </label>
                            </div>
                        </section>
                        <section class="sale-item-card purple full">
                            <div class="sale-item-title">Contabilidad</div>
                            <label class="sale-item-field">
                                Cuenta contable
                                <select id="new-receipt-category">
                                    ${receiptCategoryOptions.map(([optionValue, label]) => `<option value="${optionValue}" ${optionValue === 'vehicle_expense' ? 'selected' : ''}>${label}</option>`).join('')}
                                </select>
                            </label>
                        </section>
                        <section class="sale-item-card full">
                            <div class="sale-item-title">Movimiento de dinero</div>
                            <div class="sale-item-row">
                                <label class="sale-item-field">
                                    Sale o entra por
                                    <select id="new-receipt-payment-method">
                                        <option value="">Seleccionar</option>
                                        ${paymentMethodOptions.map(([optionValue, label]) => `<option value="${optionValue}">${label}</option>`).join('')}
                                    </select>
                                </label>
                                <label class="sale-item-field">
                                    Banco / cuenta
                                    <select id="new-receipt-bank">
                                        <option value="">Seleccionar banco</option>
                                        ${bankOptions.map((option) => `<option value="${option}">${option}</option>`).join('')}
                                    </select>
                                </label>
                            </div>
                        </section>
                        <section class="sale-item-card amber full">
                            <div class="sale-item-title">Información adicional</div>
                            <div class="sale-item-row">
                                <label class="sale-item-field">
                                    Detalle, referencia u observación
                                    <textarea id="new-receipt-detail" placeholder="Escribe un detalle, referencia u observación"></textarea>
                                </label>
                                <label class="sale-item-field">
                                    Nota
                                    <textarea id="new-receipt-notes" placeholder="Nota adicional (opcional)"></textarea>
                                </label>
                            </div>
                        </section>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Guardar ítem',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const amount = parseCurrencyInput(document.getElementById('new-receipt-amount')?.value || 0);
                const paymentDate = document.getElementById('new-receipt-payment-date')?.value || '';
                if (!amount || amount <= 0) {
                    Swal.showValidationMessage('Debes ingresar un valor válido');
                    return false;
                }
                if (!paymentDate) {
                    Swal.showValidationMessage('Debes indicar la fecha');
                    return false;
                }
                return {
                    display_name: (document.getElementById('new-receipt-display-name')?.value || '').trim(),
                    concept: document.getElementById('new-receipt-concept')?.value || 'Otros',
                    movement_type: document.getElementById('new-receipt-movement-type')?.value || 'expense',
                    amount,
                    payment_date: paymentDate,
                    category: document.getElementById('new-receipt-category')?.value || 'vehicle_expense',
                    notes: [
                        (document.getElementById('new-receipt-detail')?.value || '').trim(),
                        (document.getElementById('new-receipt-notes')?.value || '').trim()
                    ].filter(Boolean).join('\n'),
                    payment_method: document.getElementById('new-receipt-payment-method')?.value || '',
                    bank: document.getElementById('new-receipt-bank')?.value || ''
                };
            },
            didOpen: () => {
                const conceptSelect = document.getElementById('new-receipt-concept');
                const movementSelect = document.getElementById('new-receipt-movement-type');
                const categorySelect = document.getElementById('new-receipt-category');
                const applyDefaults = () => {
                    const defaults = getReceiptDefaultsForConcept(conceptSelect?.value || '');
                    if (movementSelect) movementSelect.value = defaults.movement_type;
                    if (categorySelect) categorySelect.value = defaults.category;
                };
                attachCurrencyFormatter(document.getElementById('new-receipt-amount'));
                conceptSelect?.addEventListener('change', applyDefaults);
                applyDefaults();
            },
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!value) return;

        try {
            const token = localStorage.getItem('token');
            const supportNumber = !sale?.id
                ? await ensureAccountingSupportNumber(group, token)
                : null;
            const formData = new FormData();
            if (sale?.id) {
                formData.append('sale_id', String(sale.id));
            }
            if (!sale?.id && supportNumber) {
                formData.append('receipt_number', supportNumber);
            }
            formData.append('display_name', value.display_name || '');
            formData.append('concept', value.concept);
            formData.append('movement_type', value.movement_type);
            formData.append('amount', String(value.amount));
            formData.append('payment_date', value.payment_date);
            formData.append('category', value.category);
            formData.append('notes', value.notes || '');
            formData.append('payment_method', value.payment_method || '');
            formData.append('bank', value.bank || '');
            const response = await axios.post('/api/finance/receipts', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setReceipts((current) => sortReceiptsByRecentFirst([
                response.data,
                ...current.filter((item) => item.id !== response.data.id)
            ]));
            await loadReceiptGroupDetails({
                ...group,
                receiptNumber: supportNumber || group.receiptNumber || response.data.receipt_number || null
            });
            fetchData();
            Swal.fire('Exito', isSaleGroup ? 'Ítem agregado a la venta.' : 'Ítem agregado al soporte contable.', 'success');
        } catch (error) {
            console.error('Error creating grouped receipt item', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo agregar el ítem.', 'error');
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
            await axios.delete(`/api/finance/receipts/${receiptId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchData();
            Swal.fire('Exito', 'Recibo eliminado correctamente.', 'success');
        } catch (error) {
            console.error('Error deleting receipt', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo eliminar el recibo.', 'error');
        }
    };

    const handleEditReceipt = (receipt) => {
        const isKnownConcept = receiptConceptOptions.includes(receipt.concept);
        setEditReceiptForm({
            sale_id: receipt.sale?.id ? String(receipt.sale.id) : '',
            display_name: receipt.display_name || '',
            receipt_number: receipt.receipt_number || '',
            concept: isKnownConcept ? receipt.concept : 'Otros',
            concept_detail: isKnownConcept ? '' : (receipt.concept || ''),
            movement_type: receipt.movement_type || 'income',
            amount: formatCurrencyInput(receipt.amount || 0),
            payment_date: receipt.payment_date ? new Date(receipt.payment_date).toISOString().slice(0, 10) : '',
            category: receipt.category || 'otros',
            notes: receipt.notes || '',
            payment_method: receipt.payment_method || '',
            bank: receipt.bank || '',
        });
        setEditReceiptFile(null);
        setEditingReceipt(receipt);
    };

    const handleSaveEditReceipt = async () => {
        const concept = editReceiptForm.concept === 'Otros'
            ? (editReceiptForm.concept_detail || 'Otros')
            : editReceiptForm.concept;
        const amount = parseCurrencyInput(editReceiptForm.amount || 0);

        if (!amount || amount <= 0) return Swal.fire('Error', 'Debes ingresar un valor válido', 'error');
        if (!editReceiptForm.payment_date) return Swal.fire('Error', 'Debes indicar la fecha', 'error');

        setSavingEditReceipt(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                sale_id: editReceiptForm.sale_id ? Number(editReceiptForm.sale_id) : null,
                display_name: editReceiptForm.display_name.trim() || null,
                receipt_number: (editReceiptForm.receipt_number || '').trim() || null,
                concept,
                movement_type: editReceiptForm.movement_type,
                amount,
                payment_date: editReceiptForm.payment_date,
                category: editReceiptForm.category,
                notes: editReceiptForm.notes.trim() || null,
                payment_method: editReceiptForm.payment_method || null,
                bank: editReceiptForm.bank || null,
            };
            await axios.put(`/api/finance/receipts/${editingReceipt.id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (editReceiptFile) {
                const fd = new FormData();
                fd.append('file', editReceiptFile);
                await axios.post(`/api/finance/receipts/${editingReceipt.id}/upload`, fd, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                });
            }
            await fetchData();
            setEditingReceipt(null);
            Swal.fire('Éxito', 'Registro contable actualizado.', 'success');
        } catch (error) {
            console.error('Error updating receipt', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo actualizar el registro contable.', 'error');
        } finally {
            setSavingEditReceipt(false);
        }
    };

    const handleRenameReceiptGroup = async (group) => {
        if (!group?.receipts?.length) return;

        const currentName = getBestGroupDisplayName(group.receipts) || '';
        const { value: updatedName } = await Swal.fire({
            title: 'Editar nombre del soporte',
            input: 'text',
            inputValue: currentName,
            inputLabel: 'Nombre visible del soporte',
            inputPlaceholder: 'Ej: Chevrolet Spark FLX485',
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            inputValidator: (value) => {
                if (!(value || '').trim()) {
                    return 'Debes ingresar un nombre';
                }
                return null;
            },
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!updatedName) return;

        try {
            const token = localStorage.getItem('token');
            const normalizedName = updatedName.trim();

            await Promise.all(
                group.receipts.map((receipt) =>
                    axios.put(
                        `/api/finance/receipts/${receipt.id}`,
                        {
                            sale_id: receipt.sale?.id || null,
                            receipt_number: receipt.receipt_number || null,
                            display_name: normalizedName,
                            concept: receipt.concept || 'Otros',
                            movement_type: receipt.movement_type || 'income',
                            amount: Number(receipt.amount || 0),
                            payment_date: receipt.payment_date
                                ? new Date(receipt.payment_date).toISOString().slice(0, 10)
                                : new Date().toISOString().slice(0, 10),
                            category: receipt.category || 'sale_payment',
                            notes: receipt.notes || null,
                            payment_method: receipt.payment_method || null,
                            bank: receipt.bank || null
                        },
                        {
                            headers: { Authorization: `Bearer ${token}` }
                        }
                    )
                )
            );

            await fetchData();
            setSelectedReceiptGroup(null);
            Swal.fire('Exito', 'El nombre del soporte fue actualizado.', 'success');
        } catch (error) {
            console.error('Error renaming receipt group', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo actualizar el nombre del soporte.', 'error');
        }
    };

    const handleDeleteSale = async (sale) => {
        if (!sale?.id) return;

        const result = await Swal.fire({
            title: 'Eliminar registro de venta',
            text: 'La venta, sus recibos y adjuntos asociados serán eliminados. El vehículo quedará disponible nuevamente.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
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
            await axios.delete(`/api/sales/${sale.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchData();
            Swal.fire('Exito', 'La venta fue eliminada correctamente.', 'success');
        } catch (error) {
            console.error('Error deleting sale', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo eliminar la venta.', 'error');
        }
    };

    if (loading) {
        return <div className="p-10 text-center">Cargando finanzas...</div>;
    }

    const hasDateFilter = periodPreset !== 'all' && Boolean(startDate && endDate);

    return (
        <>
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
                <button
                    onClick={() => setActiveTab('tax')}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'tax' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    Tributación
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
                                        <th className="border-b p-4 text-right">Eliminar</th>
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
                                                <div className="mt-2 space-y-1">
                                                    {(sale.payment_receipts || [])
                                                        .filter(r => r.movement_type === "expense")
                                                        .map(r => (
                                                            <div key={r.id} className="flex items-center justify-between text-[10px] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                                <span className="text-gray-600 truncate max-w-[120px]">{r.concept || r.category.replace("_", " ")}</span>
                                                                <span className="font-semibold text-rose-600 ml-2">${Number(r.amount || 0).toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                    <button 
                                                        onClick={() => {
                                                            setReceiptForm({
                                                                ...receiptForm,
                                                                sale_id: String(sale.id),
                                                                movement_type: "expense",
                                                                category: "vehicle_expense"
                                                            });
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        className="text-[10px] text-blue-600 hover:underline flex items-center font-medium"
                                                    >
                                                        + Agregar gasto
                                                    </button>
                                                </div>
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
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteSale(sale)}
                                                    className="rounded bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-200"
                                                >
                                                    Eliminar
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
                                            <td colSpan={filterStatus === 'pending' ? 10 : 9} className="p-8 text-center italic text-gray-400">
                                                No hay ventas en esta seccion.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'accounting' ? (
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
                            <h3 className="text-lg font-bold text-gray-800">Agregar recibo de compra / venta</h3>
                            <p className="mt-1 text-sm text-gray-500">Registra soportes contables y operativos de la empresa.</p>

                            <form onSubmit={handleCreateReceipt} className="mt-5 space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-gray-700">Concepto Contable</label>
                                    <select
                                        value={receiptForm.concept}
                                        onChange={(e) => {
                                            const concept = e.target.value;
                                            const defaults = getReceiptDefaultsForConcept(concept);

                                            setReceiptForm({ 
                                                ...receiptForm, 
                                                concept: concept,
                                                category: defaults.category,
                                                movement_type: defaults.movement_type
                                            });
                                        }}
                                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Seleccione un concepto...</option>
                                        {receiptConceptOptions.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                    {receiptForm.concept === 'Otros' && (
                                        <input
                                            type="text"
                                            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Especifique el concepto..."
                                            onChange={(e) => setReceiptForm({ ...receiptForm, concept_detail: e.target.value })}
                                        />
                                    )}
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
                                            type="text"
                                            inputMode="numeric"
                                            value={receiptForm.amount}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, amount: formatCurrencyInput(e.target.value) })}
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
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-gray-700">Sale o entra por</label>
                                        <select
                                            value={receiptForm.payment_method}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, payment_method: e.target.value })}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Seleccione...</option>
                                            {paymentMethodOptions.map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-gray-700">Banco / cuenta</label>
                                        <select
                                            value={receiptForm.bank}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, bank: e.target.value })}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Seleccione banco...</option>
                                            {bankOptions.map((bank) => (
                                                <option key={bank} value={bank}>{bank}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-gray-700">Nombre</label>
                                        <input
                                            type="text"
                                            value={receiptForm.display_name}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, display_name: e.target.value })}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Ej: Chevrolet Spark FLX485"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold text-gray-700">Categoria</label>
                                        <select
                                            value={receiptForm.category}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, category: e.target.value })}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="ingreso_venta">Ingresos por Venta</option>
                                            <option value="costo_vehiculo">Costo de Vehículo (Compra)</option>
                                            <option value="vehicle_purchase">Compra de Vehículo</option>
                                            <option value="purchase_payment">Abono compra</option>
                                            <option value="vehicle_separation">Separación del vehículo</option>
                                            <option value="gasto_tramites">Gastos de Trámites y Alistamiento</option>
                                            <option value="vehicle_expense">Gastos del Vehículo</option>
                                            <option value="gasto_operativo">Gastos Operativos y Administrativos</option>
                                            <option value="comisiones">Pago de Comisiones</option>
                                            <option value="otros">Otros Movimientos</option>
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
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800">Libro de recibos</h3>
                                        <p className="text-sm text-gray-500">Soportes cargados desde contabilidad.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleDownloadReceiptsReport}
                                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                                    >
                                        Descargar Excel
                                    </button>
                                </div>
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
                                        <option value="">Todas las cuentas</option>
                                        {receiptCategoryOptions.map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
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
                                            <th className="border-b p-4">Cuenta</th>
                                            <th className="border-b p-4">Valor</th>
                                            <th className="border-b p-4">Soporte</th>
                                            <th className="border-b p-4 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {receiptGroups.map((group) => {
                                            const receipt = group.latestReceipt;
                                            const isEditableGroup = true;
                                            const supportDisplayId = group.receiptNumber || receipt.receipt_number || `REC-${receipt.id}`;
                                            const supportDisplayName = getBestGroupDisplayName(group.receipts);
                                            return (
                                            <tr key={group.key} className="hover:bg-gray-50">
                                                <td className="p-4 text-sm text-gray-600">
                                                    {receipt.payment_date ? new Date(receipt.payment_date).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-gray-800">
                                                        {supportDisplayName || (group.sale?.id
                                                            ? `#${group.sale.id} - ${group.sale?.vehicle?.make || ''} ${group.sale?.vehicle?.model || ''}`.trim()
                                                            : `Soporte ${supportDisplayId}`)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {group.sale?.id
                                                            ? `${supportDisplayName ? `#${group.sale.id} - ${group.sale?.vehicle?.make || ''} ${group.sale?.vehicle?.model || ''} · ` : ''}${group.sale?.vehicle?.plate || 'Sin placa'} · ${group.sale?.seller?.full_name || group.sale?.seller?.email || ''}`
                                                            : `Soporte ${supportDisplayId}`}
                                                    </div>
                                                    {isEditableGroup && (
                                                        <div className="mt-1 text-xs font-semibold text-blue-600">
                                                            {group.receipts.length} movimientos relacionados
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-sm text-gray-600">
                                                    <div className="font-medium">
                                                        {supportDisplayId}
                                                    </div>
                                                    <div className="line-clamp-2 text-xs text-gray-500">
                                                        {group.receipts.map((item) => item.concept || item.notes || getCategoryLabel(item.category)).filter(Boolean).slice(0, 3).join(' · ')}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${group.incomeTotal > 0 && group.expenseTotal > 0 ? 'bg-blue-100 text-blue-700' : receipt.movement_type === 'expense' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {group.incomeTotal > 0 && group.expenseTotal > 0 ? 'Mixto' : receipt.movement_type === 'expense' ? 'Egreso' : 'Ingreso'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm font-medium text-gray-600">
                                                    {group.sale?.id ? 'Venta consolidada' : 'Soporte consolidado'}
                                                </td>
                                                <td className="p-4 text-sm">
                                                    <div className="space-y-1">
                                                        <div className="font-semibold text-emerald-600">Ingresos: ${group.incomeTotal.toLocaleString()}</div>
                                                        <div className="font-semibold text-rose-600">Egresos: ${group.expenseTotal.toLocaleString()}</div>
                                                        <div className={`font-bold ${group.balanceTotal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Neto: ${group.balanceTotal.toLocaleString()}</div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm">
                                                    <span className="text-gray-500">
                                                        {group.receipts.filter((item) => item.file_path).length} adjuntos
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => loadReceiptGroupDetails(group)}
                                                            className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                                                        >
                                                            Editar
                                                        </button>
                                                        {group.sale?.id && (
                                                            <a
                                                                href={`/api/finance/sales/${group.sale.id}/invoice.pdf?token=${localStorage.getItem('token')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100"
                                                            >
                                                                Factura
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )})}
                                        {receiptGroups.length === 0 && (
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
            ) : activeTab === 'tax' ? (
                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 px-6 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Cuadro de tributación</h3>
                            <p className="text-sm text-gray-500">Información anual para comisión, IVA y datos de comprador/vendedor.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => handleEditTaxInfo()}
                                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                            >
                                Agregar manual
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadTaxReport}
                                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                            >
                                Descargar Excel
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-600">
                                    <th className="border-b p-4">Mes</th>
                                    <th className="border-b p-4">Vehículo</th>
                                    <th className="border-b p-4">Compra</th>
                                    <th className="border-b p-4">Comisión</th>
                                    <th className="border-b p-4">IVA</th>
                                    <th className="border-b p-4">Venta</th>
                                    <th className="border-b p-4">Vendedor carro</th>
                                    <th className="border-b p-4">Comprador</th>
                                    <th className="border-b p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {taxRows.map((row) => (
                                    <tr key={`${row.source}-${row.sale_id || row.manual_entry_id}`} className="hover:bg-gray-50">
                                        <td className="p-4 text-sm text-gray-600">{row.month} {row.year}</td>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">
                                                {row.source === 'manual' ? `Manual #${row.manual_entry_id}` : `#${row.sale_id}`} - {row.make} {row.reference}
                                            </div>
                                            <div className="text-xs text-gray-500">{row.plate || 'Sin placa'} · Modelo {row.model_year || '-'}</div>
                                        </td>
                                        <td className="p-4 font-semibold text-slate-700">${Number(row.purchase_price || 0).toLocaleString()}</td>
                                        <td className="p-4 font-semibold text-blue-700">${Number(row.commission_base || 0).toLocaleString()}</td>
                                        <td className="p-4 font-semibold text-purple-700">${Number(row.tax_iva || 0).toLocaleString()}</td>
                                        <td className="p-4 font-semibold text-emerald-700">${Number(row.sale_price || 0).toLocaleString()}</td>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">{row.seller_name || 'Pendiente'}</div>
                                            <div className="text-xs text-gray-500">{row.seller_document || ''}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">{row.buyer_name || 'Pendiente'}</div>
                                            <div className="text-xs text-gray-500">{row.buyer_document || row.buyer_phone || ''}</div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditTaxInfo(row)}
                                                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                                                >
                                                    Editar datos
                                                </button>
                                                {row.source === 'manual' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteManualTaxInfo(row)}
                                                        className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                                                    >
                                                        Eliminar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {taxRows.length === 0 && (
                                    <tr>
                                        <td colSpan="9" className="p-8 text-center italic text-gray-400">
                                            No hay registros para el cuadro de tributación.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
            {selectedReceiptGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                        {(() => {
                            const isSaleGroup = Boolean(selectedReceiptGroup.sale?.id);
                            const supportDisplayName = getBestGroupDisplayName(selectedReceiptGroup.receipts) || '';
                            const groupTitle = isSaleGroup
                                ? `#${selectedReceiptGroup.sale?.id} - ${selectedReceiptGroup.sale?.vehicle?.make} ${selectedReceiptGroup.sale?.vehicle?.model} · ${selectedReceiptGroup.sale?.vehicle?.plate || 'Sin placa'}`
                                : `Soporte ${selectedReceiptGroup.receiptNumber || selectedReceiptGroup.latestReceipt?.receipt_number || ''}`;
                            const modalTitle = isSaleGroup ? 'Editar movimientos de la venta' : 'Editar soporte contable';

                            return (
                        <>
                        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className="text-xl font-bold text-slate-900">
                                    {supportDisplayName || modalTitle}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">{groupTitle}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editingGroupName !== '' ? editingGroupName : supportDisplayName}
                                        onChange={(e) => setEditingGroupName(e.target.value)}
                                        onFocus={() => { if (editingGroupName === '') setEditingGroupName(supportDisplayName); }}
                                        placeholder="Nombre visible de la venta o soporte..."
                                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const nameToSave = (editingGroupName || supportDisplayName).trim();
                                            if (!nameToSave) return;
                                            try {
                                                const token = localStorage.getItem('token');
                                                await Promise.all(
                                                    selectedReceiptGroup.receipts.map((receipt) =>
                                                        axios.put(`/api/finance/receipts/${receipt.id}`, {
                                                            sale_id: receipt.sale?.id || receipt.sale_id || null,
                                                            receipt_number: receipt.receipt_number || null,
                                                            display_name: nameToSave,
                                                            concept: receipt.concept || 'Otros',
                                                            movement_type: receipt.movement_type || 'income',
                                                            amount: Number(receipt.amount || 0),
                                                            payment_date: receipt.payment_date
                                                                ? new Date(receipt.payment_date).toISOString().slice(0, 10)
                                                                : new Date().toISOString().slice(0, 10),
                                                            category: receipt.category || 'otros',
                                                            notes: receipt.notes || null,
                                                            payment_method: receipt.payment_method || null,
                                                            bank: receipt.bank || null
                                                        }, { headers: { Authorization: `Bearer ${token}` } })
                                                    )
                                                );
                                                setEditingGroupName('');
                                                await fetchData();
                                                Swal.fire('Guardado', 'Nombre actualizado correctamente.', 'success');
                                            } catch (err) {
                                                Swal.fire('Error', 'No se pudo guardar el nombre.', 'error');
                                            }
                                        }}
                                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isSaleGroup && (
                                    <a
                                        href={`/api/finance/sales/${selectedReceiptGroup.sale?.id}/invoice.pdf?token=${localStorage.getItem('token')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                                    >
                                        Descargar factura
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleCreateReceiptForGroup(selectedReceiptGroup)}
                                    className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                    Agregar ítem
                                </button>
                                {isSaleGroup && (
                                    <button
                                        type="button"
                                        onClick={() => handleUploadSaleAttachment(selectedReceiptGroup.sale)}
                                        className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                                    >
                                        Adjuntar comprobante
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => { setSelectedReceiptGroup(null); setEditingGroupName(''); }}
                                    className="rounded-full bg-slate-100 px-3 py-1 text-lg font-bold text-slate-600 hover:bg-slate-200"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
                            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="rounded-xl bg-emerald-50 p-4">
                                    <p className="text-xs font-semibold uppercase text-emerald-700">Ingresos</p>
                                    <p className="mt-1 text-xl font-bold text-emerald-700">${selectedReceiptGroupTotals.incomeTotal.toLocaleString()}</p>
                                </div>
                                <div className="rounded-xl bg-rose-50 p-4">
                                    <p className="text-xs font-semibold uppercase text-rose-700">Egresos</p>
                                    <p className="mt-1 text-xl font-bold text-rose-700">${selectedReceiptGroupTotals.expenseTotal.toLocaleString()}</p>
                                </div>
                                <div className="rounded-xl bg-blue-50 p-4">
                                    <p className="text-xs font-semibold uppercase text-blue-700">Neto</p>
                                    <p className={`mt-1 text-xl font-bold ${selectedReceiptGroupTotals.balanceTotal >= 0 ? 'text-blue-700' : 'text-red-700'}`}>${selectedReceiptGroupTotals.balanceTotal.toLocaleString()}</p>
                                </div>
                            </div>
                            {isSaleGroup && (
                            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Comprobantes de la venta</p>
                                        <p className="text-xs text-slate-500">Archivos generales asociados a esta venta, separados de los movimientos contables.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleUploadSaleAttachment(selectedReceiptGroup.sale)}
                                        className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
                                    >
                                        Adjuntar archivo
                                    </button>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {saleAttachments.map((attachment) => (
                                        <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                            <div className="min-w-0">
                                                <a
                                                    href={`/api${attachment.file_path}?token=${localStorage.getItem('token')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block truncate text-sm font-semibold text-blue-700 hover:underline"
                                                >
                                                    {attachment.file_name}
                                                </a>
                                                <p className="truncate text-xs text-slate-500">{attachment.note || 'Sin nota'}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSaleAttachment(attachment)}
                                                className="shrink-0 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    ))}
                                    {saleAttachments.length === 0 && (
                                        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-sm text-slate-400 md:col-span-2">
                                            No hay comprobantes generales adjuntos a esta venta.
                                        </div>
                                    )}
                                </div>
                            </div>
                            )}
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
                                        <th className="border-b p-3">Fecha</th>
                                        <th className="border-b p-3">Concepto</th>
                                        <th className="border-b p-3">Cuenta</th>
                                        <th className="border-b p-3">Tipo</th>
                                        <th className="border-b p-3">Valor</th>
                                        <th className="border-b p-3">Soporte</th>
                                        <th className="border-b p-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedReceiptGroup.receipts.map((receipt) => (
                                        <tr key={receipt.id}>
                                            <td className="p-3 text-sm text-slate-600">{receipt.payment_date ? new Date(receipt.payment_date).toLocaleDateString() : '-'}</td>
                                            <td className="p-3">
                                                <div className="font-medium text-slate-800">{receipt.concept || 'Movimiento contable'}</div>
                                                <div className="text-xs text-slate-500">{receipt.notes || receipt.receipt_number || 'Sin nota'}</div>
                                                {(receipt.payment_method || receipt.bank) && (
                                                    <div className="mt-1 text-xs font-medium text-slate-500">
                                                        {[receipt.payment_method === 'efectivo' ? 'Efectivo' : receipt.payment_method === 'transferencia' ? 'Transferencia' : receipt.payment_method, receipt.bank].filter(Boolean).join(' · ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-sm text-slate-600">{getCategoryLabel(receipt.category)}</td>
                                            <td className="p-3 text-sm">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${receipt.movement_type === 'expense' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {receipt.movement_type === 'expense' ? 'Egreso' : 'Ingreso'}
                                                </span>
                                            </td>
                                            <td className={`p-3 font-semibold ${receipt.movement_type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                ${Number(receipt.amount || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-sm">
                                                {receipt.file_path ? (
                                                    <a
                                                        href={`/api${receipt.file_path}?token=${localStorage.getItem('token')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-medium text-blue-700 hover:underline"
                                                    >
                                                        Ver adjunto
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400">Sin archivo</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedReceiptGroup(null);
                                                            handleEditReceipt(receipt);
                                                        }}
                                                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                                                    >
                                                        Editar
                                                    </button>
                                                    <a
                                                        href={`/api/finance/receipts/${receipt.id}/pdf?token=${localStorage.getItem('token')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                                                    >
                                                        PDF
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedReceiptGroup(null);
                                                            handleDeleteReceipt(receipt.id);
                                                        }}
                                                        className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
        {/* ── MODAL EDITAR REGISTRO CONTABLE (native React) ── */}
        {editingReceipt && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
                <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Editar registro contable</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {editingReceipt.receipt_number || `#${editingReceipt.id}`} · {editingReceipt.concept}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEditingReceipt(null)}
                            className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
                        {/* Venta asociada */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Venta asociada</label>
                            <select
                                value={editReceiptForm.sale_id || ''}
                                onChange={(e) => setEditReceiptForm({ ...editReceiptForm, sale_id: e.target.value })}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">Sin venta asociada</option>
                                {approvedSales.map((sale) => (
                                    <option key={sale.id} value={String(sale.id)}>
                                        #{sale.id} – {sale.vehicle?.make} {sale.vehicle?.model} · {sale.vehicle?.plate || 'Sin placa'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Nombre visible */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre visible</label>
                            <input
                                type="text"
                                value={editReceiptForm.display_name || ''}
                                onChange={(e) => setEditReceiptForm({ ...editReceiptForm, display_name: e.target.value })}
                                placeholder="Ej: Chevrolet Spark FLX485"
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        {/* Nro. de Soporte / Recibo */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Número de Soporte / Recibo</label>
                            <input
                                type="text"
                                value={editReceiptForm.receipt_number || ''}
                                onChange={(e) => setEditReceiptForm({ ...editReceiptForm, receipt_number: e.target.value })}
                                placeholder="Ej: REC-1025"
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        {/* Concepto contable */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Concepto contable</label>
                            <select
                                value={editReceiptForm.concept || ''}
                                onChange={(e) => {
                                    const concept = e.target.value;
                                    const defaults = getReceiptDefaultsForConcept(concept);
                                    setEditReceiptForm({
                                        ...editReceiptForm,
                                        concept,
                                        concept_detail: '',
                                        ...(concept !== 'Otros' ? { movement_type: defaults.movement_type, category: defaults.category } : {})
                                    });
                                }}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                {receiptConceptOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            {editReceiptForm.concept === 'Otros' && (
                                <input
                                    type="text"
                                    value={editReceiptForm.concept_detail || ''}
                                    onChange={(e) => setEditReceiptForm({ ...editReceiptForm, concept_detail: e.target.value })}
                                    placeholder="Especifique el concepto..."
                                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            )}
                        </div>

                        {/* Tipo + Valor */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</label>
                                <select
                                    value={editReceiptForm.movement_type || 'expense'}
                                    onChange={(e) => setEditReceiptForm({ ...editReceiptForm, movement_type: e.target.value })}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="income">Ingreso</option>
                                    <option value="expense">Egreso</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor ($)</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={editReceiptForm.amount || ''}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/\D/g, '');
                                        setEditReceiptForm({ ...editReceiptForm, amount: raw ? Number(raw).toLocaleString('es-CO') : '' });
                                    }}
                                    placeholder="0"
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        {/* Fecha + Método de pago */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</label>
                                <input
                                    type="date"
                                    value={editReceiptForm.payment_date || ''}
                                    onChange={(e) => setEditReceiptForm({ ...editReceiptForm, payment_date: e.target.value })}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sale o entra por</label>
                                <select
                                    value={editReceiptForm.payment_method || ''}
                                    onChange={(e) => setEditReceiptForm({ ...editReceiptForm, payment_method: e.target.value })}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">Sin definir</option>
                                    {paymentMethodOptions.map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Banco */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Banco / cuenta</label>
                            <select
                                value={editReceiptForm.bank || ''}
                                onChange={(e) => setEditReceiptForm({ ...editReceiptForm, bank: e.target.value })}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">Sin banco</option>
                                {bankOptions.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>

                        {/* Cuenta contable */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cuenta contable</label>
                            <select
                                value={editReceiptForm.category || 'otros'}
                                onChange={(e) => setEditReceiptForm({ ...editReceiptForm, category: e.target.value })}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                {receiptCategoryOptions.map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Nota contable */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nota contable</label>
                            <textarea
                                rows={3}
                                value={editReceiptForm.notes || ''}
                                onChange={(e) => setEditReceiptForm({ ...editReceiptForm, notes: e.target.value })}
                                placeholder="Detalle del pago, referencia, observaciones..."
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                            />
                        </div>

                        {/* Adjuntar documento */}
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Adjuntar soporte / comprobante</label>
                            {editingReceipt.file_path && (
                                <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <a
                                        href={`/api${editingReceipt.file_path}?token=${localStorage.getItem('token')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline truncate"
                                    >
                                        {editingReceipt.file_name || 'Ver archivo actual'}
                                    </a>
                                    <span className="ml-auto text-xs text-slate-400">actual</span>
                                </div>
                            )}
                            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                <span className="text-sm text-slate-600">
                                    {editReceiptFile ? editReceiptFile.name : 'Seleccionar archivo (PDF, imagen…)'}
                                </span>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={(e) => setEditReceiptFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                        <button
                            type="button"
                            onClick={() => setEditingReceipt(null)}
                            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveEditReceipt}
                            disabled={savingEditReceipt}
                            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition flex items-center gap-2"
                        >
                            {savingEditReceipt && (
                                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                            )}
                            Guardar cambios
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default SalesDashboard;
