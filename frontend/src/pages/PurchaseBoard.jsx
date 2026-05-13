import React, { useRef, useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const VALID_PURCHASE_STATUSES = ['pending', 'in_review', 'approved', 'purchase_process', 'car_purchased', 'rejected', 'completed'];
const API_BASE_URL = `${window.location.origin}/crm/api`;
const PURCHASE_EXPENSE_TYPES = [
    { value: 'traspaso', label: 'Traspaso' },
    { value: 'peritaje', label: 'Peritaje' },
    { value: 'llantas', label: 'Llantas' },
    { value: 'alistamiento', label: 'Alistamiento' },
    { value: 'kit de carretera', label: 'Kit de carretera' },
    { value: 'arreglos', label: 'Arreglos' },
    { value: 'otro', label: 'Otro (Especificar)' },
];

const normalizePurchaseItems = (responseData) => {
    if (Array.isArray(responseData?.items)) return responseData.items;
    if (Array.isArray(responseData?.payload?.items)) return responseData.payload.items;
    if (Array.isArray(responseData?.payload)) return responseData.payload;
    if (Array.isArray(responseData)) return responseData;
    return [];
};

const buildOptionShareText = (option) => {
    const lines = [option.title];
    if (option.description) lines.push(option.description);
    if (Array.isArray(option.photos) && option.photos.length > 0) {
        lines.push('');
        lines.push('Fotos:');
        option.photos.forEach((photo) => lines.push(buildPurchasePhotoUrl(photo)));
    }
    return lines.join('\n');
};

const buildPurchasePhotoUrl = (filePath) => {
    if (!filePath) return '#';
    if (/^https?:\/\//i.test(filePath)) return filePath;

    // Backend serves uploads via app.mount("/static", ...). Older rows may still contain "/api/static/...".
    let normalized = String(filePath).trim();
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;
    if (normalized.startsWith('/crm/api/')) normalized = normalized.replace('/crm/api/', '/');
    if (normalized.startsWith('/api/static/')) normalized = normalized.replace('/api/static/', '/static/');

    // In dev the Vite proxy is configured for /crm/api (not /static), so serve static through the API prefix.
    return `${API_BASE_URL}${normalized}`;
};

const getApiErrorMessage = (error, fallbackMessage) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
        const firstMessage = detail
            .map((item) => item?.msg || item?.message || item?.detail)
            .find((value) => typeof value === 'string' && value.trim());
        if (firstMessage) return firstMessage;
    }
    if (typeof error?.response?.data?.error === 'string' && error.response.data.error.trim()) {
        return error.response.data.error;
    }
    return fallbackMessage;
};

const formatPurchaseCurrency = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 'Sin definir';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(numericValue);
};

const getPurchaseCreditUsedAmount = (purchase) => {
    const numericValue = Number(purchase?.lead?.process_detail?.credit_used_amount);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const getPurchaseMinimumPayment = (purchase) => {
    const approvedAmount = Number(purchase?.approved_amount);
    const approvedDownPayment = Number(purchase?.approved_down_payment);
    const approvalPercentage = Number(purchase?.approval_percentage);
    const creditUsedAmount = getPurchaseCreditUsedAmount(purchase);

    const baseDownPayment = Number.isFinite(approvedDownPayment) && approvedDownPayment > 0 ? approvedDownPayment : 0;
    if (!Number.isFinite(creditUsedAmount) || creditUsedAmount <= 0) {
        return baseDownPayment || null;
    }

    if (Number.isFinite(approvalPercentage) && approvalPercentage > 0 && approvalPercentage < 100) {
        const remainingPercentage = 1 - (approvalPercentage / 100);
        const remainingCashNeeded = Math.max(creditUsedAmount * remainingPercentage, 0);
        return Math.round(remainingCashNeeded);
    }

    if (Number.isFinite(approvedAmount) && approvedAmount > 0) {
        const remainingCashNeeded = Math.max(approvedAmount - creditUsedAmount, 0);
        return Math.round(remainingCashNeeded);
    }

    return baseDownPayment || null;
};

const STATUS_LABELS = {
    pending: 'Solicitud recibida',
    in_review: 'En busqueda',
    approved: 'Opciones encontradas',
    purchase_process: 'Proceso de compra',
    car_purchased: 'Carro comprado',
    rejected: 'Sin resultado',
    completed: 'Cerrado'
};

const COLUMNS = {
    pending: { id: 'pending', title: 'Solicitud recibida', color: 'bg-amber-100 text-amber-800' },
    in_review: { id: 'in_review', title: 'En busqueda', color: 'bg-sky-100 text-sky-800' },
    approved: { id: 'approved', title: 'Opciones encontradas', color: 'bg-emerald-100 text-emerald-800' },
    purchase_process: { id: 'purchase_process', title: 'Proceso de compra', color: 'bg-indigo-100 text-indigo-800' },
    car_purchased: { id: 'car_purchased', title: 'Carro comprado', color: 'bg-fuchsia-100 text-fuchsia-800' },
    rejected: { id: 'rejected', title: 'Sin resultado', color: 'bg-rose-100 text-rose-800' },
    completed: { id: 'completed', title: 'Cerrado', color: 'bg-slate-200 text-slate-800' }
};

const getPurchaseOptionDecisionMeta = (decisionStatus) => {
    const normalized = (decisionStatus || 'pending').toLowerCase();
    if (normalized === 'accepted') {
        return {
            label: 'Opción aceptada',
            className: 'border-emerald-200 bg-emerald-50 text-emerald-700'
        };
    }
    if (normalized === 'rejected') {
        return {
            label: 'Opción rechazada',
            className: 'border-rose-200 bg-rose-50 text-rose-700'
        };
    }
    return {
        label: 'Pendiente por decidir',
        className: 'border-amber-200 bg-amber-50 text-amber-700'
    };
};

const createPurchaseExpenseRow = () => ({
    expense_type: 'traspaso',
    amount: '',
    notes: '',
});

const PurchaseBoard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const effectiveRoleName = user?.role?.base_role_name || user?.role?.name || user?.role;
    const leadBoardPath = effectiveRoleName === 'aliado' ? '/aliado/dashboard' : '/admin/leads';
    const [purchases, setPurchases] = useState([]);
    const [purchaseUsers, setPurchaseUsers] = useState([]);
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [assignedFilter, setAssignedFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [globalStatusFilter, setGlobalStatusFilter] = useState('');
    const [showMyPurchasesOnly, setShowMyPurchasesOnly] = useState(false);
    const [purchaseLeadNotes, setPurchaseLeadNotes] = useState([]);
    const [purchaseLeadFiles, setPurchaseLeadFiles] = useState([]);
    const [purchaseOptions, setPurchaseOptions] = useState([]);
    const [activePurchaseOptionTab, setActivePurchaseOptionTab] = useState('');
    const [activePurchaseDetailTab, setActivePurchaseDetailTab] = useState('documents');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreateOptionModal, setShowCreateOptionModal] = useState(false);
    const [creatingManualPurchase, setCreatingManualPurchase] = useState(false);
    const [manualPurchaseForm, setManualPurchaseForm] = useState({
        client_name: '',
        phone: '',
        email: '',
        desired_vehicle: '',
        notes: ''
    });
    const [purchaseNoteInput, setPurchaseNoteInput] = useState('');
    const [purchaseSelectedFiles, setPurchaseSelectedFiles] = useState([]);
    const [optionVehicle, setOptionVehicle] = useState('');
    const [optionModel, setOptionModel] = useState('');
    const [optionMileage, setOptionMileage] = useState('');
    const [optionLocation, setOptionLocation] = useState('');
    const [optionDescription, setOptionDescription] = useState('');
    const [optionPhotos, setOptionPhotos] = useState([]);
    const [optionPhotoPreviews, setOptionPhotoPreviews] = useState([]);
    const [savingPurchaseNote, setSavingPurchaseNote] = useState(false);
    const [uploadingPurchaseFiles, setUploadingPurchaseFiles] = useState(false);
    const [savingPurchaseOption, setSavingPurchaseOption] = useState(false);
    const [processingInitialDecision, setProcessingInitialDecision] = useState(false);
    const [processingPurchaseOptionDecision, setProcessingPurchaseOptionDecision] = useState(false);
    const [isDraggingOptionPhotos, setIsDraggingOptionPhotos] = useState(false);
    const [showCarPurchasedModal, setShowCarPurchasedModal] = useState(false);
    const [carPurchasedTarget, setCarPurchasedTarget] = useState(null);
    const [savingCarPurchased, setSavingCarPurchased] = useState(false);
    const [carPurchasedForm, setCarPurchasedForm] = useState({
        purchase_vehicle_name: '',
        purchase_vehicle_model: '',
        purchase_vehicle_year: '',
        purchase_vehicle_plate: '',
        purchase_vehicle_mileage: '',
        purchase_vehicle_location: '',
        purchase_price: '',
        purchase_sale_price: '',
        purchase_expenses: [createPurchaseExpenseRow()],
    });
    const optionPhotoInputRef = useRef(null);
    const normalizedCurrentUserRole = String(user?.role?.base_role_name || user?.role?.name || user?.role || '').trim().toLowerCase();
    const canManagePurchaseOptions = normalizedCurrentUserRole === 'compras' || normalizedCurrentUserRole === 'super_admin' || normalizedCurrentUserRole === 'super admin' || normalizedCurrentUserRole === 'admin';

    useEffect(() => {
        if (!user?.id) return;
        fetchPurchases();
        fetchPurchaseUsers();
    }, [user?.id]);

    useEffect(() => {
        if (!selectedPurchase?.lead_id) {
            setPurchaseLeadNotes([]);
            setPurchaseLeadFiles([]);
            setPurchaseOptions([]);
            setActivePurchaseOptionTab('');
            setActivePurchaseDetailTab('documents');
            setPurchaseNoteInput('');
            setPurchaseSelectedFiles([]);
            setOptionVehicle('');
            setOptionModel('');
            setOptionMileage('');
            setOptionLocation('');
            setOptionDescription('');
            setOptionPhotos([]);
            setOptionPhotoPreviews([]);
            return;
        }
        fetchSelectedPurchaseResources(selectedPurchase.lead_id);
    }, [selectedPurchase?.id, selectedPurchase?.lead_id]);

    useEffect(() => {
        const previews = optionPhotos.map((file) => ({
            key: `${file.name}-${file.size}-${file.lastModified}`,
            name: file.name,
            url: URL.createObjectURL(file),
        }));
        setOptionPhotoPreviews(previews);

        return () => {
            previews.forEach((preview) => URL.revokeObjectURL(preview.url));
        };
    }, [optionPhotos]);

    const hasCarPurchasedData = Boolean(
        selectedPurchase?.purchase_vehicle_name ||
        selectedPurchase?.purchase_vehicle_model ||
        selectedPurchase?.purchase_vehicle_year ||
        selectedPurchase?.purchase_price ||
        selectedPurchase?.purchase_sale_price ||
        (Array.isArray(selectedPurchase?.purchase_expenses) && selectedPurchase.purchase_expenses.length > 0)
    );

    useEffect(() => {
        if (!selectedPurchase?.id) {
            setActivePurchaseOptionTab('');
            setActivePurchaseDetailTab('documents');
            return;
        }

        if (purchaseOptions.length === 0) {
            setActivePurchaseOptionTab('');
            setActivePurchaseDetailTab(
                selectedPurchase?.status === 'car_purchased' && hasCarPurchasedData ? 'purchased-data' : 'documents'
            );
            return;
        }

        setActivePurchaseDetailTab((currentTab) => {
            if (currentTab === 'documents' || currentTab === 'history' || currentTab === 'purchased-data') {
                return currentTab;
            }
            const exists = purchaseOptions.some((option) => currentTab === `option-${option.id}`);
            return exists ? currentTab : 'documents';
        });
    }, [selectedPurchase?.id, selectedPurchase?.status, purchaseOptions, hasCarPurchasedData]);

    useEffect(() => {
        if (!activePurchaseDetailTab?.startsWith('option-')) {
            return;
        }
        const optionId = activePurchaseDetailTab.replace('option-', '');
        const exists = purchaseOptions.some((option) => String(option.id) === String(optionId));
        if (!exists) {
            setActivePurchaseOptionTab('');
            return;
        }
        setActivePurchaseOptionTab(String(optionId));
    }, [purchaseOptions, activePurchaseDetailTab]);

    const fetchPurchases = async () => {
        if (!user?.id) return;
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setPurchases([]);
                setLoading(false);
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/purchases/`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 500 }
            });
            let items = normalizePurchaseItems(response.data);
            if (items.length === 0) {
                const syncResponse = await axios.post(`${API_BASE_URL}/purchases/sync`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                items = normalizePurchaseItems(syncResponse.data);
            }
            setPurchases(items.map((item) => ({
                ...item,
                status: VALID_PURCHASE_STATUSES.includes(item?.status) ? item.status : 'pending'
            })));
        } catch (error) {
            console.error(error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudieron cargar las solicitudes de compra'), 'error');
            setPurchases([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchPurchaseUsers = async () => {
        if (!user?.id) return;
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setPurchaseUsers([]);
                return;
            }
            const response = await axios.get(`${API_BASE_URL}/users/`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 500 }
            });
            setPurchaseUsers(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (error) {
            console.error('Error fetching purchase users', error);
            setPurchaseUsers([]);
        }
    };

    const fetchSelectedPurchaseResources = async (leadId) => {
        try {
            const token = localStorage.getItem('token');
            const [notesResponse, filesResponse, optionsResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/leads/${leadId}/notes`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/leads/${leadId}/files`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/purchases/${selectedPurchase.id}/options`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setPurchaseLeadNotes(Array.isArray(notesResponse.data) ? notesResponse.data : []);
            setPurchaseLeadFiles(Array.isArray(filesResponse.data) ? filesResponse.data : []);
            setPurchaseOptions(Array.isArray(optionsResponse.data) ? optionsResponse.data : []);
        } catch (error) {
            console.error('Error fetching purchase lead resources', error);
            setPurchaseLeadNotes([]);
            setPurchaseLeadFiles([]);
            setPurchaseOptions([]);
        }
    };

    const resetCarPurchasedForm = (purchase = null) => {
        setCarPurchasedForm({
            purchase_vehicle_name: purchase?.purchase_vehicle_name || purchase?.desired_vehicle || '',
            purchase_vehicle_model: purchase?.purchase_vehicle_model || '',
            purchase_vehicle_year: purchase?.purchase_vehicle_year ? String(purchase.purchase_vehicle_year) : '',
            purchase_vehicle_plate: purchase?.purchase_vehicle_plate || '',
            purchase_vehicle_mileage: purchase?.purchase_vehicle_mileage ? String(purchase.purchase_vehicle_mileage) : '',
            purchase_vehicle_location: purchase?.purchase_vehicle_location || '',
            purchase_price: purchase?.purchase_price ? String(purchase.purchase_price) : '',
            purchase_sale_price: purchase?.purchase_sale_price ? String(purchase.purchase_sale_price) : '',
            purchase_expenses: Array.isArray(purchase?.purchase_expenses) && purchase.purchase_expenses.length > 0
                ? purchase.purchase_expenses.map((expense) => ({
                    expense_type: expense?.expense_type || 'traspaso',
                    amount: expense?.amount != null ? String(expense.amount) : '',
                    notes: expense?.notes || '',
                }))
                : [createPurchaseExpenseRow()],
        });
    };

    const openCarPurchasedModal = (purchase) => {
        setCarPurchasedTarget(purchase);
        resetCarPurchasedForm(purchase);
        setShowCarPurchasedModal(true);
    };

    const updateCarPurchasedExpense = (index, field, value) => {
        setCarPurchasedForm((prev) => ({
            ...prev,
            purchase_expenses: prev.purchase_expenses.map((expense, expenseIndex) => (
                expenseIndex === index ? { ...expense, [field]: value } : expense
            )),
        }));
    };

    const addCarPurchasedExpenseRow = () => {
        setCarPurchasedForm((prev) => ({
            ...prev,
            purchase_expenses: [...prev.purchase_expenses, createPurchaseExpenseRow()],
        }));
    };

    const removeCarPurchasedExpenseRow = (index) => {
        setCarPurchasedForm((prev) => ({
            ...prev,
            purchase_expenses: prev.purchase_expenses.length <= 1
                ? [createPurchaseExpenseRow()]
                : prev.purchase_expenses.filter((_, expenseIndex) => expenseIndex !== index),
        }));
    };

    const handleDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        const purchaseId = parseInt(draggableId, 10);
        const purchase = purchases.find((item) => item.id === purchaseId);
        if (newStatus === 'car_purchased') {
            openCarPurchasedModal(purchase);
            return;
        }
        setPurchases((prev) => prev.map((item) => item.id === purchaseId ? { ...item, status: newStatus } : item));

        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/purchases/${purchaseId}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (selectedPurchase?.id === purchaseId) {
                setSelectedPurchase((prev) => prev ? { ...prev, status: newStatus } : prev);
            }
        } catch (error) {
            console.error('Error updating purchase status', error);
            Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
            fetchPurchases();
        }
    };

    const handleInitialPurchaseDecision = async (purchase, decision) => {
        if (!purchase?.id || processingInitialDecision) return;

        let payload = null;
        if (decision === 'accept') {
            const confirmation = await Swal.fire({
                title: 'Aceptar solicitud de compra',
                text: 'La solicitud pasará automáticamente a En búsqueda.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Aceptar solicitud',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#059669'
            });
            if (!confirmation.isConfirmed) return;
            payload = {
                status: 'in_review',
                status_note: 'Solicitud aceptada para iniciar la búsqueda del vehículo.'
            };
        } else {
            const { value: rejectionReason } = await Swal.fire({
                title: 'Cancelar solicitud de compra',
                input: 'textarea',
                inputLabel: 'Motivo de cancelación',
                inputPlaceholder: 'Explica por qué se rechaza esta solicitud...',
                showCancelButton: true,
                confirmButtonText: 'Cancelar solicitud',
                cancelButtonText: 'Volver',
                confirmButtonColor: '#dc2626',
                inputValidator: (value) => {
                    if (!value || !value.trim()) {
                        return 'Debes indicar el motivo de cancelación';
                    }
                    return null;
                }
            });
            if (!rejectionReason) return;
            payload = {
                status: 'rejected',
                status_note: rejectionReason.trim()
            };
        }

        setProcessingInitialDecision(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(`${API_BASE_URL}/purchases/${purchase.id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const updatedPurchase = {
                ...response.data,
                status: VALID_PURCHASE_STATUSES.includes(response.data?.status) ? response.data.status : 'pending'
            };
            setPurchases((prev) => prev.map((item) => item.id === updatedPurchase.id ? { ...item, ...updatedPurchase } : item));
            setSelectedPurchase((prev) => prev && prev.id === updatedPurchase.id ? { ...prev, ...updatedPurchase } : prev);
            await fetchPurchases();
            Swal.fire(
                'Éxito',
                decision === 'accept'
                    ? 'La solicitud pasó a En búsqueda.'
                    : 'La solicitud fue cancelada correctamente.',
                'success'
            );
        } catch (error) {
            console.error('Error updating purchase request', error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudo actualizar la solicitud de compra'), 'error');
        } finally {
            setProcessingInitialDecision(false);
        }
    };

    const handleMarkCarPurchased = async () => {
        if (!carPurchasedTarget?.id || savingCarPurchased) return;

        const requiredFields = [
            ['purchase_vehicle_name', 'Debes indicar el carro comprado'],
            ['purchase_vehicle_model', 'Debes indicar el modelo del carro'],
            ['purchase_vehicle_year', 'Debes indicar el año del carro'],
            ['purchase_price', 'Debes indicar el valor de la compra'],
            ['purchase_sale_price', 'Debes indicar el valor de la venta'],
        ];

        for (const [field, message] of requiredFields) {
            if (!String(carPurchasedForm[field] || '').trim()) {
                Swal.fire('Error', message, 'warning');
                return;
            }
        }

        const normalizedExpenses = carPurchasedForm.purchase_expenses
            .filter((expense) => String(expense.amount || '').trim())
            .map((expense) => ({
                expense_type: expense.expense_type === 'otro' ? (expense.custom_type || 'Otro') : expense.expense_type,
                amount: Number(expense.amount),
                notes: expense.notes?.trim() || null,
            }));

        if (normalizedExpenses.some((expense) => !Number.isFinite(expense.amount) || expense.amount < 0)) {
            Swal.fire('Error', 'Todos los gastos deben tener un valor válido', 'warning');
            return;
        }

        setSavingCarPurchased(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                status: 'car_purchased',
                purchase_vehicle_name: carPurchasedForm.purchase_vehicle_name.trim(),
                purchase_vehicle_model: carPurchasedForm.purchase_vehicle_model.trim(),
                purchase_vehicle_year: Number(carPurchasedForm.purchase_vehicle_year),
                purchase_vehicle_plate: carPurchasedForm.purchase_vehicle_plate.trim() || null,
                purchase_vehicle_mileage: carPurchasedForm.purchase_vehicle_mileage.trim() ? Number(carPurchasedForm.purchase_vehicle_mileage) : null,
                purchase_vehicle_location: carPurchasedForm.purchase_vehicle_location.trim() || null,
                purchase_price: Number(carPurchasedForm.purchase_price),
                purchase_sale_price: Number(carPurchasedForm.purchase_sale_price),
                purchase_expenses: normalizedExpenses,
                status_note: 'Carro comprado registrado desde compras.',
            };
            const response = await axios.put(`${API_BASE_URL}/purchases/${carPurchasedTarget.id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const updatedPurchase = {
                ...response.data,
                status: VALID_PURCHASE_STATUSES.includes(response.data?.status) ? response.data.status : 'pending'
            };
            setPurchases((prev) => prev.map((item) => item.id === updatedPurchase.id ? { ...item, ...updatedPurchase } : item));
            setSelectedPurchase((prev) => prev && prev.id === updatedPurchase.id ? { ...prev, ...updatedPurchase } : prev);
            setShowCarPurchasedModal(false);
            setCarPurchasedTarget(null);
            await fetchPurchases();
            if (updatedPurchase.lead_id) {
                await fetchSelectedPurchaseResources(updatedPurchase.lead_id);
            }
            Swal.fire('Éxito', 'El carro comprado quedó registrado correctamente', 'success');
        } catch (error) {
            console.error('Error marking purchase as car purchased', error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudo registrar el carro comprado'), 'error');
        } finally {
            setSavingCarPurchased(false);
        }
    };

    const handleSyncPurchases = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE_URL}/purchases/sync`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const items = normalizePurchaseItems(response.data);
            if (items.length > 0) {
                setPurchases(items.map((item) => ({
                    ...item,
                    status: VALID_PURCHASE_STATUSES.includes(item?.status) ? item.status : 'pending'
                })));
            } else {
                await fetchPurchases();
            }
            Swal.fire({
                icon: 'success',
                title: 'Solicitudes de compra resincronizadas',
                html: `<div style="text-align:left"><p><strong>Leads revisados:</strong> ${response.data?.processed || 0}</p><p><strong>Solicitudes creadas:</strong> ${response.data?.created || 0}</p><p><strong>Solicitudes actualizadas:</strong> ${response.data?.updated || 0}</p></div>`,
                confirmButtonText: 'Entendido'
            });
        } catch (error) {
            console.error('Error syncing purchases', error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudieron traer las solicitudes de compra'), 'error');
        }
    };

    const handleCreateManualPurchase = async (e) => {
        e.preventDefault();
        if (!manualPurchaseForm.client_name.trim() || !manualPurchaseForm.phone.trim() || !manualPurchaseForm.desired_vehicle.trim()) {
            Swal.fire('Error', 'Nombre, teléfono y vehículo buscado son obligatorios', 'warning');
            return;
        }

        setCreatingManualPurchase(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                    `${API_BASE_URL}/purchases/manual`,
                {
                    client_name: manualPurchaseForm.client_name.trim(),
                    phone: manualPurchaseForm.phone.trim(),
                    email: manualPurchaseForm.email.trim(),
                    desired_vehicle: manualPurchaseForm.desired_vehicle.trim(),
                    notes: manualPurchaseForm.notes.trim()
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const createdPurchase = {
                ...response.data,
                status: VALID_PURCHASE_STATUSES.includes(response.data?.status) ? response.data.status : 'pending'
            };
            setPurchases((prev) => [createdPurchase, ...prev]);
            setSelectedPurchase(createdPurchase);
            setShowCreateModal(false);
            setManualPurchaseForm({
                client_name: '',
                phone: '',
                email: '',
                desired_vehicle: '',
                notes: ''
            });
            await fetchPurchases();
            Swal.fire('Éxito', 'Solicitud de compra creada correctamente', 'success');
        } catch (error) {
            console.error('Error creating manual purchase request', error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudo crear la solicitud manual'), 'error');
        } finally {
            setCreatingManualPurchase(false);
        }
    };

    const handlePurchaseNoteSubmit = async () => {
        if (!selectedPurchase?.id || !purchaseNoteInput.trim()) return;
        setSavingPurchaseNote(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE_URL}/purchases/${selectedPurchase.id}/notes`, {
                content: purchaseNoteInput.trim()
            }, { headers: { Authorization: `Bearer ${token}` } });
            const updatedPurchase = response.data?.purchase;
            if (updatedPurchase) {
                setSelectedPurchase(updatedPurchase);
                setPurchases((prev) => prev.map((item) => item.id === updatedPurchase.id ? {
                    ...item,
                    ...updatedPurchase,
                    status: VALID_PURCHASE_STATUSES.includes(updatedPurchase?.status) ? updatedPurchase.status : 'pending'
                } : item));
            }
            if (response.data?.lead_note) {
                setPurchaseLeadNotes((prev) => [response.data.lead_note, ...prev]);
            }
            setPurchaseNoteInput('');
            Swal.fire('Éxito', 'Nota agregada correctamente', 'success');
        } catch (error) {
            console.error('Error adding purchase note', error);
            Swal.fire('Error', 'No se pudo agregar la nota', 'error');
        } finally {
            setSavingPurchaseNote(false);
        }
    };

    const handlePurchaseFileUpload = async () => {
        if (!selectedPurchase?.id || purchaseSelectedFiles.length === 0) return;
        setUploadingPurchaseFiles(true);
        try {
            const token = localStorage.getItem('token');
            for (const file of purchaseSelectedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                await axios.post(`${API_BASE_URL}/purchases/${selectedPurchase.id}/files`, formData, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                });
            }
            setPurchaseSelectedFiles([]);
            await fetchSelectedPurchaseResources(selectedPurchase.lead_id);
            Swal.fire('Éxito', 'Documentos agregados correctamente', 'success');
        } catch (error) {
            console.error('Error uploading purchase files', error);
            Swal.fire('Error', 'No se pudieron agregar los documentos', 'error');
        } finally {
            setUploadingPurchaseFiles(false);
        }
    };

    const handleCreatePurchaseOption = async () => {
        if (!selectedPurchase?.id) return;
        if (!optionVehicle.trim()) {
            Swal.fire('Error', 'Debes indicar el carro sugerido', 'warning');
            return;
        }
        if (!optionModel.trim()) {
            Swal.fire('Error', 'Debes indicar el modelo', 'warning');
            return;
        }
        if (!optionMileage.trim()) {
            Swal.fire('Error', 'Debes indicar el kilometraje', 'warning');
            return;
        }
        if (!optionLocation.trim()) {
            Swal.fire('Error', 'Debes indicar la ubicación', 'warning');
            return;
        }
        if (optionPhotos.length < 3) {
            Swal.fire('Error', 'Debes adjuntar mínimo 3 fotos por opción', 'warning');
            return;
        }

        setSavingPurchaseOption(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            const optionTitle = `${optionVehicle.trim()} ${optionModel.trim()}`.trim();
            const detailLines = [
                `Carro: ${optionVehicle.trim()}`,
                `Modelo: ${optionModel.trim()}`,
                `Kilometraje: ${optionMileage.trim()}`,
                `Ubicación: ${optionLocation.trim()}`,
            ];
            if (optionDescription.trim()) {
                detailLines.push(`Detalles adicionales: ${optionDescription.trim()}`);
            }

            formData.append('title', optionTitle);
            formData.append('description', detailLines.join('\n'));
            optionPhotos.forEach((photo) => formData.append('photos', photo));

            const response = await axios.post(
                `${API_BASE_URL}/purchases/${selectedPurchase.id}/options`,
                formData,
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
            );

            setPurchaseOptions((prev) => [response.data, ...prev]);
            setActivePurchaseOptionTab(String(response.data?.id || 'new-option'));
            setOptionVehicle('');
            setOptionModel('');
            setOptionMileage('');
            setOptionLocation('');
            setOptionDescription('');
            setOptionPhotos([]);
            setOptionPhotoPreviews([]);
            await fetchSelectedPurchaseResources(selectedPurchase.lead_id);
            Swal.fire('Éxito', 'Opción agregada correctamente', 'success');
            return response.data;
        } catch (error) {
            console.error('Error creating purchase option', error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudo agregar la opcion'), 'error');
            return null;
        } finally {
            setSavingPurchaseOption(false);
        }
    };

    const handlePurchaseOptionDecision = async (option, decisionStatus) => {
        if (!option?.id || processingPurchaseOptionDecision) return;
        if (!canManagePurchaseOptions) {
            Swal.fire('Sin permisos', 'Solo compras o administradores pueden decidir una opción.', 'warning');
            return;
        }

        const isAccepted = decisionStatus === 'accepted';
        const { value: decisionNote } = await Swal.fire({
            title: isAccepted ? 'Aceptar opción' : 'Rechazar opción',
            input: 'textarea',
            inputLabel: 'Nota obligatoria',
            inputPlaceholder: isAccepted
                ? 'Explica por qué esta opción fue aceptada o qué sigue con el cliente...'
                : 'Explica por qué esta opción fue rechazada...',
            showCancelButton: true,
            confirmButtonText: isAccepted ? 'Aceptar opción' : 'Rechazar opción',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: isAccepted ? '#059669' : '#dc2626',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Debes escribir una nota para continuar';
                }
                return null;
            }
        });

        if (!decisionNote) return;

        setProcessingPurchaseOptionDecision(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(
                `${API_BASE_URL}/purchases/options/${option.id}/decision`,
                {
                    decision_status: decisionStatus,
                    decision_note: decisionNote.trim()
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const updatedOption = response.data;
            setPurchaseOptions((prev) => prev.map((item) => item.id === updatedOption.id ? updatedOption : item));
            setActivePurchaseOptionTab(String(updatedOption.id));
            setActivePurchaseDetailTab(`option-${updatedOption.id}`);
            await fetchPurchases();
            if (selectedPurchase?.lead_id) {
                await fetchSelectedPurchaseResources(selectedPurchase.lead_id);
            }
            Swal.fire('Éxito', `La opción fue ${isAccepted ? 'aceptada' : 'rechazada'} correctamente`, 'success');
        } catch (error) {
            console.error('Error updating purchase option decision', error);
            Swal.fire('Error', getApiErrorMessage(error, 'No se pudo actualizar la opción'), 'error');
        } finally {
            setProcessingPurchaseOptionDecision(false);
        }
    };

    const mergeOptionPhotos = (incomingFiles = []) => {
        if (!Array.isArray(incomingFiles) || incomingFiles.length === 0) return;
        setOptionPhotos((prev) => {
            const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
            const uniqueIncoming = incomingFiles.filter((file) => {
                const key = `${file.name}-${file.size}-${file.lastModified}`;
                if (existingKeys.has(key)) return false;
                existingKeys.add(key);
                return true;
            });
            return [...prev, ...uniqueIncoming];
        });
    };

    const handleOptionPhotosSelected = (event) => {
        const files = Array.from(event.target.files || []);
        mergeOptionPhotos(files);
        event.target.value = '';
    };

    const handleOptionPhotosDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOptionPhotos(false);
        const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type?.startsWith('image/'));
        mergeOptionPhotos(files);
    };

    const handleOptionPhotosDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOptionPhotos(true);
    };

    const handleOptionPhotosDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOptionPhotos(false);
    };

    const handleCopyOptionText = async (option) => {
        try {
            await navigator.clipboard.writeText(buildOptionShareText(option));
            Swal.fire('Éxito', 'Texto copiado para compartir con el lead', 'success');
        } catch (error) {
            console.error('Error copying option text', error);
            Swal.fire('Error', 'No se pudo copiar el texto', 'error');
        }
    };

    const handleDownloadOptionPhotos = (option) => {
        if (!Array.isArray(option.photos) || option.photos.length === 0) return;
        option.photos.forEach((photo, index) => {
            const link = document.createElement('a');
            link.href = buildPurchasePhotoUrl(photo);
            link.download = `${option.title || 'opcion'}-${index + 1}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    const filteredPurchases = purchases.filter((purchase) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch = !normalizedSearch || [purchase.client_name, purchase.phone, purchase.email, purchase.desired_vehicle]
            .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
        const createdDate = purchase.created_at ? String(purchase.created_at).slice(0, 10) : '';
        const matchesDate = !dateFilter || createdDate === dateFilter;
        const matchesMine = !showMyPurchasesOnly || purchase.assigned_to_id === user?.id;
        const parsedUserFilter = userFilter ? parseInt(userFilter, 10) : null;
        const matchesUser = !parsedUserFilter || purchase.assigned_to_id === parsedUserFilter;
        const isAssigned = !!purchase.assigned_to_id;
        const matchesAssigned = !assignedFilter || (assignedFilter === 'assigned' ? isAssigned : !isAssigned);
        const matchesStatus = !globalStatusFilter || (purchase.status || 'pending') === globalStatusFilter;
        return matchesSearch && matchesDate && matchesMine && matchesUser && matchesAssigned && matchesStatus;
    });

    const getPurchasesByStatus = (status) => filteredPurchases.filter((item) => (item.status || 'pending') === status);
    const getPurchaseStatusLabel = (status) => STATUS_LABELS[status] || status || 'Sin estado';
    const purchaseDetailTabs = [
        ...(hasCarPurchasedData ? [{ id: 'purchased-data', label: 'Datos de compra' }] : []),
        { id: 'documents', label: 'Documentos del proceso' },
        { id: 'history', label: 'Historial' },
        ...purchaseOptions.map((option, index) => ({
            id: `option-${option.id}`,
            label: `Opción ${index + 1}`,
            decisionStatus: option?.decision_status || 'pending',
            optionId: option.id,
        })),
    ];
    const activePurchaseOption = purchaseOptions.find((option) => activePurchaseDetailTab === `option-${option.id}`) || purchaseOptions.find((option) => String(option.id) === String(activePurchaseOptionTab)) || purchaseOptions[0] || null;

    if (loading) {
        return <div className="p-8 text-slate-500">Cargando solicitudes de compra...</div>;
    }

    return (
        <div className="p-8 min-h-screen">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Compras y Búsquedas</h1>
                    <p className="text-slate-500 mt-1 font-medium">Administra los vehículos que los clientes están buscando cuando no están en inventario.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Nueva solicitud manual
                    </button>
                    <button
                        onClick={handleSyncPurchases}
                        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v6h6M20 20v-6h-6M5.64 18.36A9 9 0 0018.36 18.36M18.36 5.64A9 9 0 005.64 5.64" />
                        </svg>
                        Traer solicitudes de compra
                    </button>
                </div>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <input type="text" placeholder="Buscar por cliente, telefono, email o vehiculo..." className="xl:col-span-2 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <input type="date" className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                    <select className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white" value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
                        <option value="">Asignacion</option>
                        <option value="assigned">Asignadas</option>
                        <option value="unassigned">Sin asignar</option>
                    </select>
                    <select className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                        <option value="">Responsable</option>
                        {purchaseUsers.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.email}</option>)}
                    </select>
                    <select className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white" value={globalStatusFilter} onChange={(e) => setGlobalStatusFilter(e.target.value)}>
                        <option value="">Estado global</option>
                        {Object.values(COLUMNS).map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
                    </select>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={showMyPurchasesOnly} onChange={(e) => setShowMyPurchasesOnly(e.target.checked)} />
                        Mis solicitudes
                    </label>
                    <button type="button" onClick={() => { setSearchTerm(''); setDateFilter(''); setAssignedFilter(''); setUserFilter(''); setGlobalStatusFilter(''); setShowMyPurchasesOnly(false); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
                        Limpiar filtros
                    </button>
                    <span className="text-xs font-medium text-slate-400">{filteredPurchases.length} solicitud(es) visibles</span>
                </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-6 overflow-x-auto pb-8 snap-x">
                    {Object.values(COLUMNS).map((col) => (
                        <div key={col.id} className="min-w-[320px] flex flex-col bg-slate-50/50 rounded-2xl p-4 snap-center border border-slate-200 h-[calc(100vh-200px)]">
                            <div className={`flex items-center justify-between px-3 py-3 mb-4 rounded-xl ${col.color} bg-opacity-20`}>
                                <h3 className="font-bold text-sm uppercase tracking-wide">{col.title}</h3>
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-white bg-opacity-50">{getPurchasesByStatus(col.id).length}</span>
                            </div>
                            <Droppable droppableId={col.id}>
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="flex-1 overflow-y-auto custom-scrollbar px-1">
                                        {getPurchasesByStatus(col.id).map((purchase, index) => (
                                            <Draggable key={purchase.id} draggableId={purchase.id.toString()} index={index} isDragDisabled={purchase.status === 'pending' || purchase.status === 'completed' || purchase.status === 'car_purchased'}>
                                                {(dragProvided) => (
                                                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} onClick={() => setSelectedPurchase(purchase)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-3 hover:shadow-md transition cursor-pointer group">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-bold text-slate-800">{purchase.client_name}</h4>
                                                            <span className="text-xs text-slate-400 font-mono">#{purchase.id}</span>
                                                        </div>
                                                        <div className="text-sm font-semibold text-blue-600 mb-3">{purchase.desired_vehicle}</div>
                                                        <div className="space-y-1 text-xs text-slate-500">
                                                            <div className="flex justify-between gap-2"><span>Telefono:</span><span className="font-medium text-slate-700 truncate">{purchase.phone || 'Sin telefono'}</span></div>
                                                            {purchase.email && <div className="flex justify-between gap-2"><span>Email:</span><span className="font-medium text-slate-700 truncate">{purchase.email}</span></div>}
                                                        </div>
                                                        {purchase.notes && <p className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg border border-slate-100 p-2 line-clamp-3">{purchase.notes}</p>}
                                                        <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
                                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-pink-50 text-pink-700 border-pink-100">Compras</span>
                                                            <span className="text-[10px] text-slate-400">{new Date(purchase.created_at).toLocaleDateString()}</span>
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

            {selectedPurchase && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedPurchase(null)}>
                    <div className="bg-white rounded-2xl p-6 w-[min(97vw,1700px)] shadow-2xl border border-gray-100 h-[96vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Solicitud de compra #{selectedPurchase.id}</h2>
                                <p className="text-slate-500 mt-1">{selectedPurchase.client_name}</p>
                            </div>
                            <button onClick={() => setSelectedPurchase(null)} className="text-2xl text-gray-400 hover:text-gray-600">&times;</button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5 mb-6">
                            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 shadow-sm">
                                <p className="text-sm font-medium text-cyan-700">Vehículo solicitado</p>
                                <p className="mt-2 text-2xl font-bold text-cyan-950 break-words">{selectedPurchase.desired_vehicle || 'Sin definir'}</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
                                <p className="text-sm font-medium text-emerald-700">Monto aprobado</p>
                                <p className="mt-2 text-2xl font-bold text-emerald-950">{formatPurchaseCurrency(selectedPurchase.approved_amount)}</p>
                            </div>
                            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 shadow-sm">
                                <p className="text-sm font-medium text-indigo-700">Credito a usar</p>
                                <p className="mt-2 text-2xl font-bold text-indigo-950">{formatPurchaseCurrency(getPurchaseCreditUsedAmount(selectedPurchase))}</p>
                            </div>
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
                                <p className="text-sm font-medium text-amber-700">Pago mínimo</p>
                                <p className="mt-2 text-2xl font-bold text-amber-950">{formatPurchaseCurrency(getPurchaseMinimumPayment(selectedPurchase))}</p>
                                {getPurchaseCreditUsedAmount(selectedPurchase) ? (
                                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                                        Recalculado con el credito a usar
                                    </p>
                                ) : null}
                            </div>
                            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 shadow-sm">
                                <p className="text-sm font-medium text-violet-700">Separación</p>
                                <p className="mt-2 text-2xl font-bold text-violet-950">
                                    {formatPurchaseCurrency(selectedPurchase.lead?.process_detail?.reservation_amount)}
                                </p>
                                {selectedPurchase.lead?.process_detail?.reservation_payment_method && (
                                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
                                        {selectedPurchase.lead.process_detail.reservation_payment_method}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Estado de la solicitud</p>
                                    <p className="text-sm text-slate-700">
                                        <span className="font-semibold">Estado:</span> {getPurchaseStatusLabel(selectedPurchase.status)}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        <span className="font-semibold">Asignado a:</span> {purchaseUsers.find((person) => person.id === selectedPurchase.assigned_to_id)?.full_name || 'Sin asignar'}
                                    </p>
                                </div>
                                {selectedPurchase.status === 'pending' && (
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleInitialPurchaseDecision(selectedPurchase, 'accept')}
                                            disabled={processingInitialDecision}
                                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            {processingInitialDecision ? 'Procesando...' : 'Aceptar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleInitialPurchaseDecision(selectedPurchase, 'cancel')}
                                            disabled={processingInitialDecision}
                                            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                                        >
                                            {processingInitialDecision ? 'Procesando...' : 'Cancelar'}
                                        </button>
                                    </div>
                                )}
                                {canManagePurchaseOptions && selectedPurchase.status === 'car_purchased' && (
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openCarPurchasedModal(selectedPurchase)}
                                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                                        >
                                            Editar compra
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap gap-2">
                                    {purchaseDetailTabs.map((tab) => {
                                        const isActive = activePurchaseDetailTab === tab.id;
                                        const decisionMeta = tab.decisionStatus ? getPurchaseOptionDecisionMeta(tab.decisionStatus) : null;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => {
                                                    setActivePurchaseDetailTab(tab.id);
                                                    if (tab.optionId) {
                                                        setActivePurchaseOptionTab(String(tab.optionId));
                                                    }
                                                }}
                                                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                                                    isActive
                                                        ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span>{tab.label}</span>
                                                    {decisionMeta && (
                                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${decisionMeta.className}`}>
                                                            {decisionMeta.label}
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateOptionModal(true)}
                                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                                >
                                    Nueva opción
                                </button>
                            </div>

                            {activePurchaseDetailTab === 'purchased-data' && (
                                <div className="space-y-5">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Datos del carro comprado</p>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Carro</p>
                                            <p className="mt-2 text-lg font-bold text-slate-900">
                                                {selectedPurchase.purchase_vehicle_name || selectedPurchase.desired_vehicle || 'Sin definir'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Modelo</p>
                                            <p className="mt-2 text-lg font-bold text-slate-900">
                                                {selectedPurchase.purchase_vehicle_model || 'Sin definir'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Año</p>
                                            <p className="mt-2 text-lg font-bold text-slate-900">
                                                {selectedPurchase.purchase_vehicle_year || 'Sin definir'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Placa</p>
                                            <p className="mt-2 text-lg font-bold text-slate-900">
                                                {selectedPurchase.purchase_vehicle_plate || 'Sin definir'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kilometraje</p>
                                            <p className="mt-2 text-lg font-bold text-slate-900">
                                                {selectedPurchase.purchase_vehicle_mileage != null ? `${selectedPurchase.purchase_vehicle_mileage} km` : 'Sin definir'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ubicación</p>
                                            <p className="mt-2 text-lg font-bold text-slate-900">
                                                {selectedPurchase.purchase_vehicle_location || 'Sin definir'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Valor de compra</p>
                                            <p className="mt-2 text-2xl font-bold text-emerald-950">
                                                {formatPurchaseCurrency(selectedPurchase.purchase_price)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Valor de venta</p>
                                            <p className="mt-2 text-2xl font-bold text-blue-950">
                                                {formatPurchaseCurrency(selectedPurchase.purchase_sale_price)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4">
                                            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Gastos registrados</p>
                                            <p className="mt-2 text-2xl font-bold text-violet-950">
                                                {formatPurchaseCurrency(
                                                    (selectedPurchase.purchase_expenses || []).reduce(
                                                        (sum, item) => sum + (Number(item?.amount) || 0),
                                                        0
                                                    )
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Detalle de gastos</p>
                                        {Array.isArray(selectedPurchase.purchase_expenses) && selectedPurchase.purchase_expenses.length > 0 ? (
                                            <div className="space-y-3">
                                                {selectedPurchase.purchase_expenses.map((expense, index) => (
                                                    <div key={`expense-view-${index}`} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800 capitalize">{expense?.expense_type || 'Gasto'}</p>
                                                            {expense?.notes && (
                                                                <p className="mt-1 text-sm text-slate-600">{expense.notes}</p>
                                                            )}
                                                        </div>
                                                        <p className="text-lg font-bold text-slate-900">
                                                            {formatPurchaseCurrency(expense?.amount)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500">No se registraron gastos para esta compra.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activePurchaseDetailTab === 'documents' && (
                                <div className="space-y-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Documentos del proceso</p>
                                    {selectedPurchase.lead_id ? (
                                        <>
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                                <input type="file" multiple className="flex-1 text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100" onChange={(e) => setPurchaseSelectedFiles(Array.from(e.target.files || []))} />
                                                <button type="button" onClick={handlePurchaseFileUpload} disabled={uploadingPurchaseFiles || purchaseSelectedFiles.length === 0} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50">
                                                    {uploadingPurchaseFiles ? 'Subiendo...' : `Subir ${purchaseSelectedFiles.length > 0 ? `(${purchaseSelectedFiles.length})` : ''}`}
                                                </button>
                                            </div>
                                            {purchaseLeadFiles.length > 0 ? (
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    {purchaseLeadFiles.map((file) => (
                                                        <a key={file.id} href={buildPurchasePhotoUrl(file.file_path)} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50">
                                                            {file.file_name}
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500">Aún no hay documentos cargados para esta solicitud.</p>
                                            )}
                                        </>
                                    ) : <p className="text-sm text-slate-500">Solo puedes adjuntar documentos cuando la solicitud esté ligada a un lead.</p>}
                                </div>
                            )}

                            {activePurchaseDetailTab === 'history' && (
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Agregar nota desde compras</p>
                                        {selectedPurchase.lead_id ? (
                                            <>
                                                <textarea rows="3" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500" placeholder="Escribe la nota que quieres dejar en esta búsqueda..." value={purchaseNoteInput} onChange={(e) => setPurchaseNoteInput(e.target.value)} />
                                                <div className="mt-3 flex justify-end">
                                                    <button type="button" onClick={handlePurchaseNoteSubmit} disabled={savingPurchaseNote || !purchaseNoteInput.trim()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                                                        {savingPurchaseNote ? 'Guardando...' : 'Guardar nota'}
                                                    </button>
                                                </div>
                                            </>
                                        ) : <p className="text-sm text-slate-500">Esta solicitud no tiene lead relacionado para sincronizar notas.</p>}
                                    </div>
                                    <div className="border-t border-slate-100 pt-4">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Trazabilidad reflejada en el lead</p>
                                        {purchaseLeadNotes.length > 0 ? (
                                            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                                                {purchaseLeadNotes.map((note) => (
                                                    <div key={note.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                                        <p className="text-[11px] font-semibold text-slate-500">
                                                            {note.user?.full_name || note.user?.email || 'Usuario'}
                                                        </p>
                                                        <p className="text-sm text-slate-700">{note.content}</p>
                                                        <p className="mt-1 text-[11px] text-slate-400">{note.created_at ? new Date(note.created_at).toLocaleString() : 'Reciente'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <p className="text-sm text-slate-500">Aún no hay notas registradas para este lead desde compras.</p>}
                                    </div>
                                </div>
                            )}

                            {!['documents', 'history'].includes(activePurchaseDetailTab) && (
                                activePurchaseOption ? (
                                    <div className="space-y-4">
                                        <>
                                            <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-800">{activePurchaseOption.title}</h4>
                                                    {activePurchaseOption.description && <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{activePurchaseOption.description}</p>}
                                                </div>
                                                <span className="text-[11px] text-slate-400">{activePurchaseOption.created_at ? new Date(activePurchaseOption.created_at).toLocaleDateString() : 'Reciente'}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${getPurchaseOptionDecisionMeta(activePurchaseOption.decision_status).className}`}>
                                                    {getPurchaseOptionDecisionMeta(activePurchaseOption.decision_status).label}
                                                </span>
                                                {canManagePurchaseOptions && (!activePurchaseOption.decision_status || activePurchaseOption.decision_status === 'pending') && (
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePurchaseOptionDecision(activePurchaseOption, 'accepted')}
                                                            disabled={processingPurchaseOptionDecision}
                                                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                                        >
                                                            {processingPurchaseOptionDecision ? 'Procesando...' : 'Aceptar opción'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePurchaseOptionDecision(activePurchaseOption, 'rejected')}
                                                            disabled={processingPurchaseOptionDecision}
                                                            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                                                        >
                                                            {processingPurchaseOptionDecision ? 'Procesando...' : 'Rechazar opción'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {Array.isArray(activePurchaseOption.photos) && activePurchaseOption.photos.length > 0 ? (
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                    {activePurchaseOption.photos.map((photo, index) => (
                                                        <a key={`${activePurchaseOption.id}-${index}`} href={buildPurchasePhotoUrl(photo)} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                                            <img src={buildPurchasePhotoUrl(photo)} alt={activePurchaseOption.title} className="h-56 w-full object-cover" />
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500">Esta opción aún no tiene fotos visibles.</p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyOptionText(activePurchaseOption)}
                                                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                                                >
                                                    Copiar texto
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadOptionPhotos(activePurchaseOption)}
                                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                                >
                                                    Descargar fotos
                                                </button>
                                            </div>
                                        </>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">Aún no hay opciones registradas para esta solicitud.</p>
                                )
                            )}
                        </div>

                        <div className="flex flex-wrap justify-end gap-3">
                            {selectedPurchase.lead_id && (
                                <button onClick={() => navigate(`${leadBoardPath}?leadId=${selectedPurchase.lead_id}`)} className="px-4 py-2 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50">
                                    Abrir lead relacionado
                                </button>
                            )}
                            <button onClick={() => setSelectedPurchase(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCarPurchasedModal && carPurchasedTarget && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCarPurchasedModal(false)}>
                    <div className="w-full max-w-5xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Registrar carro comprado</h2>
                                <p className="mt-1 text-sm text-slate-500">Completa los datos del vehículo, los valores de compra/venta y los gastos del proceso.</p>
                            </div>
                            <button onClick={() => setShowCarPurchasedModal(false)} className="text-2xl text-slate-400 hover:text-slate-600">&times;</button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Carro</span>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={carPurchasedForm.purchase_vehicle_name}
                                    onChange={(e) => setCarPurchasedForm((prev) => ({ ...prev, purchase_vehicle_name: e.target.value }))}
                                />
                            </label>
                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Modelo</span>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={carPurchasedForm.purchase_vehicle_model}
                                    onChange={(e) => setCarPurchasedForm((prev) => ({ ...prev, purchase_vehicle_model: e.target.value }))}
                                />
                            </label>
                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Año</span>
                                <input
                                    type="number"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={carPurchasedForm.purchase_vehicle_year}
                                    onChange={(e) => setCarPurchasedForm((prev) => ({ ...prev, purchase_vehicle_year: e.target.value }))}
                                />
                            </label>
                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Placa</span>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={carPurchasedForm.purchase_vehicle_plate}
                                    onChange={(e) => setCarPurchasedForm((prev) => ({ ...prev, purchase_vehicle_plate: e.target.value.toUpperCase() }))}
                                />
                            </label>
                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Kilometraje</span>
                                <input
                                    type="number"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={carPurchasedForm.purchase_vehicle_mileage}
                                    onChange={(e) => setCarPurchasedForm((prev) => ({ ...prev, purchase_vehicle_mileage: e.target.value }))}
                                />
                            </label>
                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ubicación</span>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={carPurchasedForm.purchase_vehicle_location}
                                    onChange={(e) => setCarPurchasedForm((prev) => ({ ...prev, purchase_vehicle_location: e.target.value }))}
                                />
                            </label>
                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Valor de la compra</span>
                                <input
                                    type="number"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={carPurchasedForm.purchase_price}
                                    onChange={(e) => setCarPurchasedForm((prev) => ({ ...prev, purchase_price: e.target.value }))}
                                />
                            </label>
                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Valor de la venta</span>
                                <input
                                    type="number"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={carPurchasedForm.purchase_sale_price}
                                    onChange={(e) => setCarPurchasedForm((prev) => ({ ...prev, purchase_sale_price: e.target.value }))}
                                />
                            </label>
                        </div>

                        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Gastos del proceso</h3>
                                    <p className="text-xs text-slate-500">Agrega uno o varios gastos del carro comprado.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addCarPurchasedExpenseRow}
                                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                                >
                                    Agregar gasto
                                </button>
                            </div>

                            <div className="space-y-3">
                                {carPurchasedForm.purchase_expenses.map((expense, index) => (
                                    <div key={`expense-${index}`} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1.2fr_0.8fr_1fr_auto]">
                                        <label className="grid gap-2">
                                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tipo de gasto</span>
                                            {expense.expense_type === 'otro' ? (
                                                <div className="flex gap-2">
                                                    <select
                                                        className="w-1/3 rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white"
                                                        value={expense.expense_type}
                                                        onChange={(e) => updateCarPurchasedExpense(index, 'expense_type', e.target.value)}
                                                    >
                                                        {PURCHASE_EXPENSE_TYPES.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre del gasto"
                                                        className="w-2/3 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                                        value={expense.custom_type || ''}
                                                        onChange={(e) => updateCarPurchasedExpense(index, 'custom_type', e.target.value)}
                                                    />
                                                </div>
                                            ) : (
                                                <select
                                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white"
                                                    value={expense.expense_type}
                                                    onChange={(e) => updateCarPurchasedExpense(index, 'expense_type', e.target.value)}
                                                >
                                                    {PURCHASE_EXPENSE_TYPES.map((option) => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </label>
                                        <label className="grid gap-2">
                                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Valor</span>
                                            <input
                                                type="number"
                                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                                value={expense.amount}
                                                onChange={(e) => updateCarPurchasedExpense(index, 'amount', e.target.value)}
                                            />
                                        </label>
                                        <label className="grid gap-2">
                                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Notas</span>
                                            <input
                                                type="text"
                                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                                value={expense.notes}
                                                onChange={(e) => updateCarPurchasedExpense(index, 'notes', e.target.value)}
                                            />
                                        </label>
                                        <div className="flex items-end">
                                            <button
                                                type="button"
                                                onClick={() => removeCarPurchasedExpenseRow(index)}
                                                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowCarPurchasedModal(false)}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleMarkCarPurchased}
                                disabled={savingCarPurchased}
                                className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-700 disabled:opacity-50"
                            >
                                {savingCarPurchased ? 'Guardando...' : 'Guardar carro comprado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Nueva solicitud de compra</h2>
                                <p className="mt-1 text-sm text-slate-500">Crea una búsqueda manual desde compras y quedará ligada a un lead interno.</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-2xl text-slate-400 hover:text-slate-600">&times;</button>
                        </div>

                        <form onSubmit={handleCreateManualPurchase} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700">Nombre del cliente</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        value={manualPurchaseForm.client_name}
                                        onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, client_name: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-bold text-slate-700">Teléfono</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        value={manualPurchaseForm.phone}
                                        onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, phone: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-bold text-slate-700">Email</label>
                                <input
                                    type="email"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    value={manualPurchaseForm.email}
                                    onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, email: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-bold text-slate-700">Vehículo buscado</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej: Mazda CX-30 Touring 2023 gris"
                                    value={manualPurchaseForm.desired_vehicle}
                                    onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, desired_vehicle: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-bold text-slate-700">Notas iniciales</label>
                                <textarea
                                    rows="4"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    placeholder="Escribe contexto, presupuesto, ciudad o cualquier dato útil para la búsqueda..."
                                    value={manualPurchaseForm.notes}
                                    onChange={(e) => setManualPurchaseForm((prev) => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingManualPurchase}
                                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {creatingManualPurchase ? 'Creando...' : 'Crear solicitud'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCreateOptionModal && selectedPurchase && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreateOptionModal(false)}>
                    <div className="w-full max-w-4xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Nueva opción para compra</h2>
                                <p className="mt-1 text-sm text-slate-500">Completa la información del vehículo encontrado y adjunta mínimo 3 fotos.</p>
                            </div>
                            <button onClick={() => setShowCreateOptionModal(false)} className="text-2xl text-slate-400 hover:text-slate-600">&times;</button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <label className="grid gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Carro</span>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: Mazda 3"
                                        value={optionVehicle}
                                        onChange={(e) => setOptionVehicle(e.target.value)}
                                    />
                                </label>
                                <label className="grid gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Modelo</span>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: Touring 2022"
                                        value={optionModel}
                                        onChange={(e) => setOptionModel(e.target.value)}
                                    />
                                </label>
                                <label className="grid gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Kilometraje</span>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: 48.000 km"
                                        value={optionMileage}
                                        onChange={(e) => setOptionMileage(e.target.value)}
                                    />
                                </label>
                                <label className="grid gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ubicación</span>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: Pereira"
                                        value={optionLocation}
                                        onChange={(e) => setOptionLocation(e.target.value)}
                                    />
                                </label>
                            </div>
                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Detalles adicionales</span>
                                <textarea
                                    rows="3"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                    placeholder="Negociación, precio esperado, observaciones o detalles relevantes..."
                                    value={optionDescription}
                                    onChange={(e) => setOptionDescription(e.target.value)}
                                />
                            </label>
                            <div className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Fotos del vehículo</span>
                                <input
                                    ref={optionPhotoInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleOptionPhotosSelected}
                                />
                                <div
                                    onClick={() => optionPhotoInputRef.current?.click()}
                                    onDrop={handleOptionPhotosDrop}
                                    onDragOver={handleOptionPhotosDragOver}
                                    onDragLeave={handleOptionPhotosDragLeave}
                                    className={`cursor-pointer rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${
                                        isDraggingOptionPhotos
                                            ? 'border-emerald-400 bg-emerald-50'
                                            : 'border-slate-300 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/60'
                                    }`}
                                >
                                    <p className="text-sm font-semibold text-slate-700">Arrastra y suelta las fotos aquí</p>
                                    <p className="mt-1 text-xs text-slate-500">o haz clic para seleccionarlas desde tu equipo</p>
                                    <p className="mt-3 text-xs font-medium text-emerald-700">Debes adjuntar mínimo 3 fotos por opción.</p>
                                </div>
                            </div>
                            {optionPhotos.length > 0 && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                    <p className="text-xs font-semibold text-emerald-800">{optionPhotos.length} foto(s) seleccionada(s)</p>
                                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                                        {optionPhotoPreviews.map((photo) => (
                                            <div key={photo.key} className="overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
                                                <img src={photo.url} alt={photo.name} className="h-32 w-full object-cover" />
                                                <div className="border-t border-emerald-100 px-2 py-1.5 text-[11px] font-medium text-slate-600 truncate" title={photo.name}>
                                                    {photo.name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateOptionModal(false)}
                                    className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const createdOption = await handleCreatePurchaseOption();
                                        if (!createdOption?.id) return;
                                        setShowCreateOptionModal(false);
                                        setActivePurchaseOptionTab(String(createdOption.id));
                                        setActivePurchaseDetailTab(`option-${createdOption.id}`);
                                    }}
                                    disabled={savingPurchaseOption}
                                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {savingPurchaseOption ? 'Guardando...' : 'Agregar opción'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseBoard;

