import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { formatBogotaDate, formatBogotaDateForInput, formatBogotaDateTime } from '../utils/dateTime';
import { getRolePermissions } from '../config/views';

const VALID_CREDIT_STATUSES = ['pending', 'in_review', 'approved', 'rejected', 'completed'];
const API_BASE_URL = `${window.location.origin}/crm/api`;

const getCreditSupervisorIds = (credit) => {
    const supervisors = Array.isArray(credit?.lead?.supervisors) ? credit.lead.supervisors : [];
    return supervisors
        .map((supervisor) => parseInt(supervisor?.id, 10))
        .filter((id) => Number.isInteger(id));
};
const buildCreditFileUrl = (filePath) => {
    if (!filePath) return '#';
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return `${API_BASE_URL}${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
};

const normalizeCreditItems = (responseData) => {
    if (Array.isArray(responseData?.items)) return responseData.items;
    if (Array.isArray(responseData?.payload?.items)) return responseData.payload.items;
    if (Array.isArray(responseData?.payload)) return responseData.payload;
    if (Array.isArray(responseData)) return responseData;
    return [];
};

const calculateMinimumDownPaymentFromApproval = (approvedAmount, approvalPercentage) => {
    const safeApprovedAmount = Number(approvedAmount) || 0;
    const safeApprovalPercentage = Number(approvalPercentage) || 0;

    if (!safeApprovedAmount || !safeApprovalPercentage || safeApprovalPercentage <= 0 || safeApprovalPercentage > 100) {
        return 0;
    }

    return Math.max(0, Math.round(safeApprovedAmount * ((100 - safeApprovalPercentage) / 100)));
};

const normalizeRoleName = (value) => {
    if (!value) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ');
};

const CreditBoard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const normalizedBaseRoleName = normalizeRoleName(user?.role?.base_role_name);
    const normalizedSystemRoleName = normalizeRoleName(user?.role?.name || user?.role);
    const effectiveRoleName = user?.role?.base_role_name || user?.role?.name || user?.role;
    const normalizedRoleName = normalizedBaseRoleName || normalizedSystemRoleName;
    const rolePermissions = new Set(getRolePermissions(user?.role || {}));
    const isCompanyAdmin = normalizedRoleName === 'admin' || normalizedRoleName === 'super admin';
    const isCreditManager = [
        'gestion creditos',
        'gestion de creditos',
        'gestor creditos',
        'gestor de creditos',
        'coordinador credito',
        'coordinador de credito',
        'coordinador de creditos',
    ].includes(normalizedRoleName) || [
        'gestion creditos',
        'gestion de creditos',
        'coordinador de creditos',
        'coordinador de credito',
    ].includes(normalizedSystemRoleName);
    const isReadOnlyCreditRole = ['asesor', 'asesor vendedor', 'vendedor', 'aliado', 'aliado estrategico'].includes(normalizedBaseRoleName);
    const canManageCredits = isCompanyAdmin || isCreditManager || (rolePermissions.has('credits') && !isReadOnlyCreditRole);
    const leadBoardPath = effectiveRoleName === 'aliado' ? '/aliado/dashboard' : '/admin/leads';
    const [credits, setCredits] = useState([]);
    const [creditUsers, setCreditUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedCredit, setSelectedCredit] = useState(null); // For details modal
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [assignedFilter, setAssignedFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [globalStatusFilter, setGlobalStatusFilter] = useState('');
    const [showMyCreditsOnly, setShowMyCreditsOnly] = useState(true);
    const [creditLeadNotes, setCreditLeadNotes] = useState([]);
    const [creditLeadFiles, setCreditLeadFiles] = useState([]);
    const [creditNoteInput, setCreditNoteInput] = useState('');
    const [creditSelectedFiles, setCreditSelectedFiles] = useState([]);
    const [savingCreditNote, setSavingCreditNote] = useState(false);
    const [uploadingCreditFiles, setUploadingCreditFiles] = useState(false);
    const [syncingGmailCredits, setSyncingGmailCredits] = useState(false);
    const [creditEditMode, setCreditEditMode] = useState(false);
    const [savingCreditEdit, setSavingCreditEdit] = useState(false);
    const [creditEditStatusNote, setCreditEditStatusNote] = useState('');
    const [creditEditData, setCreditEditData] = useState(null);

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
        'completed': { id: 'completed', title: 'Vendido', color: 'bg-emerald-100 text-emerald-800' }
    };

    useEffect(() => {
        fetchCredits();
        fetchCreditUsers();
    }, []);

    useEffect(() => {
        if (!selectedCredit?.lead_id) {
            setCreditLeadNotes([]);
            setCreditLeadFiles([]);
            setCreditNoteInput('');
            setCreditSelectedFiles([]);
            setCreditEditMode(false);
            setSavingCreditEdit(false);
            setCreditEditStatusNote('');
            setCreditEditData(null);
            return;
        }
        fetchSelectedCreditResources(selectedCredit.lead_id);
    }, [selectedCredit?.id, selectedCredit?.lead_id]);

    useEffect(() => {
        if (!selectedCredit?.id) {
            setCreditEditMode(false);
            setSavingCreditEdit(false);
            setCreditEditStatusNote('');
            setCreditEditData(null);
            return;
        }

        setCreditEditMode(false);
        setSavingCreditEdit(false);
        setCreditEditStatusNote('');
        setCreditEditData({
            client_name: selectedCredit.client_name || '',
            phone: selectedCredit.phone || '',
            email: selectedCredit.email || '',
            desired_vehicle: selectedCredit.desired_vehicle || '',
            monthly_income: selectedCredit.monthly_income ?? 0,
            other_income: selectedCredit.other_income ?? 0,
            occupation: selectedCredit.occupation || 'employee',
            application_mode: selectedCredit.application_mode || 'individual',
            down_payment: selectedCredit.down_payment ?? 0,
            approved_amount: selectedCredit.approved_amount ?? '',
            approval_percentage: selectedCredit.approval_percentage ?? '',
            approved_down_payment: selectedCredit.approved_down_payment ?? '',
            status: selectedCredit.status || 'pending',
            assigned_to_id: selectedCredit.assigned_to_id || '',
            notes: selectedCredit.notes || '',
        });
    }, [selectedCredit?.id]);

    useEffect(() => {
        if (!creditEditMode || !creditEditData) return;

        const approvedAmount = Number(creditEditData.approved_amount);
        const approvalPercentage = Number(creditEditData.approval_percentage);

        if (!approvedAmount || !approvalPercentage || approvalPercentage <= 0 || approvalPercentage > 100) {
            if (creditEditData.approved_down_payment !== '') {
                setCreditEditData((prev) => ({ ...prev, approved_down_payment: '' }));
            }
            return;
        }

        const minimumDownPayment = calculateMinimumDownPaymentFromApproval(approvedAmount, approvalPercentage);
        if (Number(creditEditData.approved_down_payment) !== minimumDownPayment) {
            setCreditEditData((prev) => ({ ...prev, approved_down_payment: minimumDownPayment }));
        }
    }, [creditEditMode, creditEditData?.approved_amount, creditEditData?.approval_percentage]);

    const handleSaveCreditEdit = async () => {
        if (!selectedCredit?.id || !creditEditData || savingCreditEdit) return;
        if (!canManageCredits) {
            Swal.fire('Solo lectura', 'No tienes permisos para modificar solicitudes de crédito.', 'info');
            return;
        }

        const statusChanged = String(creditEditData.status || '').trim() !== String(selectedCredit.status || '').trim();
        if (statusChanged && String(creditEditStatusNote || '').trim().length < 4) {
            Swal.fire('Error', 'Debes escribir una nota para cambiar el estado de la solicitud.', 'warning');
            return;
        }

        setSavingCreditEdit(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                client_name: creditEditData.client_name?.trim() || null,
                phone: creditEditData.phone?.trim() || null,
                email: creditEditData.email?.trim() || null,
                desired_vehicle: creditEditData.desired_vehicle?.trim() || null,
                monthly_income: creditEditData.monthly_income === '' ? null : Number(creditEditData.monthly_income),
                other_income: creditEditData.other_income === '' ? null : Number(creditEditData.other_income),
                occupation: creditEditData.occupation || null,
                application_mode: creditEditData.application_mode || null,
                down_payment: creditEditData.down_payment === '' ? null : Number(creditEditData.down_payment),
                approved_amount: creditEditData.approved_amount === '' ? null : Number(creditEditData.approved_amount),
                approval_percentage: creditEditData.approval_percentage === '' ? null : Number(creditEditData.approval_percentage),
                approved_down_payment: creditEditData.approved_down_payment === '' ? null : Number(creditEditData.approved_down_payment),
                status: creditEditData.status || null,
                assigned_to_id: creditEditData.assigned_to_id ? Number(creditEditData.assigned_to_id) : null,
                notes: creditEditData.notes ?? null,
                ...(statusChanged ? { status_note: creditEditStatusNote.trim() } : {}),
            };

            const response = await axios.put(`${API_BASE_URL}/credits/${selectedCredit.id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCredits((prev) => prev.map((credit) => credit.id === selectedCredit.id ? response.data : credit));
            setSelectedCredit(response.data);
            setCreditEditMode(false);
            setCreditEditStatusNote('');
            Swal.fire('Éxito', 'Solicitud de crédito actualizada.', 'success');
        } catch (error) {
            console.error('Error saving credit edit', error);
            Swal.fire('Error', error?.response?.data?.detail || error?.response?.data?.error || 'No se pudo actualizar la solicitud de crédito.', 'error');
        } finally {
            setSavingCreditEdit(false);
        }
    };

    const fetchCredits = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/credits/`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 500 }
            });
            let items = normalizeCreditItems(response.data);

            if (items.length === 0 && canManageCredits) {
                const syncResponse = await axios.post(
                    `${API_BASE_URL}/credits/sync`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                items = normalizeCreditItems(syncResponse.data);
            }

            setCredits(
                items
                    .map((item) => ({
                        ...item,
                        status: VALID_CREDIT_STATUSES.includes(item?.status) ? item.status : 'pending'
                    }))
            );
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudieron cargar las solicitudes', 'error');
            setCredits([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchCreditUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/users/`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 500 }
            });
            setCreditUsers(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (error) {
            console.error("Error fetching credit users", error);
            setCreditUsers([]);
        }
    };

    const fetchSelectedCreditResources = async (leadId) => {
        try {
            const token = localStorage.getItem('token');
            const [notesResponse, filesResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/leads/${leadId}/notes`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_BASE_URL}/leads/${leadId}/files`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            setCreditLeadNotes(Array.isArray(notesResponse.data) ? notesResponse.data : []);
            setCreditLeadFiles(Array.isArray(filesResponse.data) ? filesResponse.data : []);
        } catch (error) {
            console.error('Error fetching credit lead resources', error);
            setCreditLeadNotes([]);
            setCreditLeadFiles([]);
        }
    };

    const handleDragEnd = async (result) => {
        const { destination, source, draggableId } = result;

        if (!canManageCredits) {
            Swal.fire('Solo lectura', 'Los asesores o vendedores no pueden modificar solicitudes de crédito.', 'info');
            return;
        }

        if (!destination) return;
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const newStatus = destination.droppableId;
        const creditId = parseInt(draggableId);
        const requiresApprovalFields = newStatus === 'approved';

        if (newStatus === 'completed') {
            Swal.fire(
                'Cambio automático',
                'La columna Vendido se actualiza automáticamente cuando el lead pasa a Vendido en el tablero de leads.',
                'info'
            );
            return;
        }

        const { value: modalPayload, isConfirmed } = await Swal.fire({
            title: 'Nota del cambio de estado',
            html: `
                <div style="display:grid; gap:12px; text-align:left;">
                    <label style="display:grid; gap:6px;">
                        <span style="font-size:13px; font-weight:700; color:#334155;">Nota del cambio</span>
                        <span style="font-size:14px; color:#475569;">Describe el motivo del cambio a "${getCreditStatusLabel(newStatus)}"</span>
                        <textarea id="credit-status-note" class="swal2-textarea" placeholder="Escribe aquí el seguimiento, respuesta o razón del cambio..." style="margin:0; width:100%; min-height:110px;"></textarea>
                    </label>
                    ${requiresApprovalFields ? `
                        <div style="display:grid; gap:10px;">
                            <div style="font-weight:700; color:#0f172a; font-size:14px;">Datos obligatorios de la aprobación</div>
                            <label style="display:grid; gap:6px;">
                                <span style="font-size:13px; font-weight:700; color:#334155;">Monto aprobado</span>
                                <input id="credit-approved-amount" class="swal2-input" type="number" min="1" placeholder="Ej: 70000000" style="margin:0; width:100%;" />
                            </label>
                            <label style="display:grid; gap:6px;">
                                <span style="font-size:13px; font-weight:700; color:#334155;">Porcentaje financiado del vehículo</span>
                                <input id="credit-approval-percentage" class="swal2-input" type="number" min="1" max="100" placeholder="Ej: 90" style="margin:0; width:100%;" />
                                <div style="font-size:12px; color:#64748b;">Escribe el porcentaje real que aprobó el banco sobre el valor total del vehículo. Ejemplo: si aprueba el 90%, escribe 90.</div>
                            </label>
                            <label style="display:grid; gap:6px;">
                                <span style="font-size:13px; font-weight:700; color:#334155;">Cuota inicial mínima a pagar</span>
                                <input id="credit-approved-down-payment" class="swal2-input" type="number" min="0" readonly placeholder="Se calcula automáticamente" style="margin:0; width:100%; background:#f8fafc; color:#0f172a; cursor:not-allowed;" />
                                <div id="credit-approved-down-payment-helper" style="font-size:12px; color:#64748b;"></div>
                            </label>
                        </div>
                    ` : ''}
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar cambio',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#64748b',
            didOpen: () => {
                if (!requiresApprovalFields) return;

                const approvedAmountInput = document.getElementById('credit-approved-amount');
                const approvalPercentageInput = document.getElementById('credit-approval-percentage');
                const approvedDownPaymentInput = document.getElementById('credit-approved-down-payment');
                const helper = document.getElementById('credit-approved-down-payment-helper');

                const updateMinimumDownPayment = () => {
                    const approvedAmount = parseInt(approvedAmountInput?.value || '0', 10);
                    const approvalPercentage = parseInt(approvalPercentageInput?.value || '0', 10);

                    if (!approvedAmount || !approvalPercentage || approvalPercentage <= 0 || approvalPercentage > 100) {
                        if (helper) {
                            helper.textContent = 'Ingresa monto aprobado y el porcentaje financiado real para calcular la cuota inicial mínima.';
                        }
                        if (approvedDownPaymentInput) {
                            approvedDownPaymentInput.min = '0';
                            approvedDownPaymentInput.value = '';
                        }
                        return;
                    }

                    const minimumDownPayment = calculateMinimumDownPaymentFromApproval(approvedAmount, approvalPercentage);
                    if (approvedDownPaymentInput) {
                        approvedDownPaymentInput.min = String(minimumDownPayment);
                        approvedDownPaymentInput.value = String(minimumDownPayment);
                    }
                    if (helper) {
                        helper.textContent = `Cuota inicial mínima calculada automáticamente: $${minimumDownPayment.toLocaleString('es-CO')}`;
                    }
                };

                approvedAmountInput?.addEventListener('input', updateMinimumDownPayment);
                approvalPercentageInput?.addEventListener('input', updateMinimumDownPayment);
                updateMinimumDownPayment();
            },
            preConfirm: () => {
                const statusNote = document.getElementById('credit-status-note')?.value?.trim() || '';
                const approvedAmount = document.getElementById('credit-approved-amount')?.value || '';
                const approvalPercentage = document.getElementById('credit-approval-percentage')?.value || '';
                const approvedDownPayment = document.getElementById('credit-approved-down-payment')?.value || '';

                if (statusNote.length < 4) {
                    Swal.showValidationMessage('Debes escribir una nota corta para continuar.');
                    return false;
                }

                if (requiresApprovalFields) {
                    if (!approvedAmount || parseInt(approvedAmount, 10) <= 0) {
                        Swal.showValidationMessage('Debes indicar el monto aprobado.');
                        return false;
                    }
                    if (!approvalPercentage || parseInt(approvalPercentage, 10) <= 0) {
                        Swal.showValidationMessage('Debes indicar el porcentaje de aprobación.');
                        return false;
                    }
                    if (parseInt(approvalPercentage, 10) > 100) {
                        Swal.showValidationMessage('El porcentaje financiado no puede ser mayor a 100.');
                        return false;
                    }
                    const minimumDownPayment = calculateMinimumDownPaymentFromApproval(
                        parseInt(approvedAmount, 10),
                        parseInt(approvalPercentage, 10)
                    );
                    if (approvedDownPayment === '') {
                        Swal.showValidationMessage('No se pudo calcular la cuota inicial mínima. Revisa el monto aprobado y el porcentaje financiado.');
                        return false;
                    }
                    if (parseInt(approvedDownPayment, 10) !== minimumDownPayment) {
                        Swal.showValidationMessage(`La cuota inicial mínima calculada debe ser exactamente $${minimumDownPayment.toLocaleString('es-CO')}.`);
                        return false;
                    }
                }

                return {
                    status_note: statusNote,
                    approved_amount: requiresApprovalFields ? parseInt(approvedAmount, 10) : null,
                    approval_percentage: requiresApprovalFields ? parseInt(approvalPercentage, 10) : null,
                    approved_down_payment: requiresApprovalFields ? parseInt(approvedDownPayment, 10) : null,
                };
            }
        });

        if (!isConfirmed || !modalPayload) return;

        // Optimistic UI Update
        const updatedCredits = credits.map(c =>
            c.id === creditId ? { ...c, status: newStatus } : c
        );
        setCredits(updatedCredits);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(`${API_BASE_URL}/credits/${creditId}`,
                {
                    status: newStatus,
                    status_note: modalPayload.status_note,
                    approved_amount: modalPayload.approved_amount,
                    approval_percentage: modalPayload.approval_percentage,
                    approved_down_payment: modalPayload.approved_down_payment,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (selectedCredit?.id === creditId) {
                setSelectedCredit(response.data);
            }
            setCredits((prev) => prev.map((credit) => credit.id === creditId ? response.data : credit));
        } catch (error) {
            console.error("Error updating status:", error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo actualizar el estado', 'error');
            fetchCredits(); // Revert
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!canManageCredits) {
            Swal.fire('Solo lectura', 'Los asesores o vendedores no pueden modificar solicitudes de crédito.', 'info');
            return;
        }
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

            const response = await axios.post(`${API_BASE_URL}/credits/`, payload, {
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

    const handleSyncCredits = async () => {
        if (!canManageCredits) {
            Swal.fire('Solo lectura', 'Los asesores o vendedores no pueden modificar solicitudes de crédito.', 'info');
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${API_BASE_URL}/credits/sync`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const items = normalizeCreditItems(response.data);
            if (items.length > 0) {
                setCredits(
                    items
                        .map((item) => ({
                            ...item,
                            status: VALID_CREDIT_STATUSES.includes(item?.status) ? item.status : 'pending'
                        }))
                );
            } else {
                await fetchCredits();
            }

            Swal.fire({
                icon: 'success',
                title: 'Solicitudes resincronizadas',
                html: `
                    <div style="text-align:left">
                        <p><strong>Leads revisados:</strong> ${response.data?.processed || 0}</p>
                        <p><strong>Solicitudes creadas:</strong> ${response.data?.created || 0}</p>
                        <p><strong>Solicitudes actualizadas:</strong> ${response.data?.updated || 0}</p>
                    </div>
                `,
                confirmButtonText: 'Entendido'
            });
        } catch (error) {
            console.error('Error syncing credit applications', error);
            Swal.fire('Error', 'No se pudieron traer los leads en solicitud de credito', 'error');
        }
    };

    const handleAnalyzeCreditEmails = async () => {
        if (!canManageCredits) {
            Swal.fire('Solo lectura', 'Los asesores o vendedores no pueden modificar solicitudes de crédito.', 'info');
            return;
        }
        if (!user?.company_id) return;
        setSyncingGmailCredits(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${API_BASE_URL}/gmail/credits/analyze`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { company_id: user.company_id, force_reprocess: true }
                }
            );

            await fetchCredits();
            if (selectedCredit?.lead_id) {
                await fetchSelectedCreditResources(selectedCredit.lead_id);
            }

            Swal.fire({
                icon: 'success',
                title: 'Correos analizados',
                html: `
                    <div style="text-align:left">
                        <p><strong>Correos revisados:</strong> ${response.data?.processed || 0}</p>
                        <p><strong>Relacionados:</strong> ${response.data?.matched || 0}</p>
                        <p><strong>Omitidos por ya procesados:</strong> ${response.data?.skipped || 0}</p>
                        <p><strong>Reprocesados:</strong> ${response.data?.reprocessed || 0}</p>
                        <p><strong>Notas creadas:</strong> ${response.data?.created_notes || 0}</p>
                        <p><strong>Adjuntos guardados:</strong> ${response.data?.attached_files || 0}</p>
                        <p><strong>Solicitudes actualizadas:</strong> ${response.data?.updated_credits || 0}</p>
                        <p><strong>Alertas enviadas:</strong> ${response.data?.notifications_sent || 0}</p>
                    </div>
                `,
                confirmButtonText: 'Entendido'
            });
        } catch (error) {
            console.error('Error analyzing Gmail credit emails', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudieron analizar los correos de credito', 'error');
        } finally {
            setSyncingGmailCredits(false);
        }
    };

    const handleCreditNoteSubmit = async () => {
        if (!canManageCredits) {
            Swal.fire('Solo lectura', 'Los asesores o vendedores no pueden modificar solicitudes de crédito.', 'info');
            return;
        }
        if (!selectedCredit?.id || !creditNoteInput.trim()) return;
        setSavingCreditNote(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${API_BASE_URL}/credits/${selectedCredit.id}/notes`,
                { content: creditNoteInput.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const updatedCredit = response.data?.credit;
            if (updatedCredit) {
                setSelectedCredit(updatedCredit);
                setCredits((prev) => prev.map((item) => item.id === updatedCredit.id ? {
                    ...item,
                    ...updatedCredit,
                    status: VALID_CREDIT_STATUSES.includes(updatedCredit?.status) ? updatedCredit.status : 'pending'
                } : item));
            }
            if (response.data?.lead_note) {
                setCreditLeadNotes((prev) => [response.data.lead_note, ...prev]);
            }
            setCreditNoteInput('');
            Swal.fire('Éxito', 'Nota agregada correctamente', 'success');
        } catch (error) {
            console.error('Error adding credit note', error);
            Swal.fire('Error', 'No se pudo agregar la nota', 'error');
        } finally {
            setSavingCreditNote(false);
        }
    };

    const handleCreditFileUpload = async () => {
        if (!canManageCredits) {
            Swal.fire('Solo lectura', 'Los asesores o vendedores no pueden modificar solicitudes de crédito.', 'info');
            return;
        }
        if (!selectedCredit?.id || creditSelectedFiles.length === 0) return;
        setUploadingCreditFiles(true);
        try {
            const token = localStorage.getItem('token');
            const uploadedFiles = [];

            for (const file of creditSelectedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                const response = await axios.post(
                    `${API_BASE_URL}/credits/${selectedCredit.id}/files`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );
                uploadedFiles.push(response.data);
            }

            setCreditLeadFiles((prev) => [...uploadedFiles, ...prev]);
            setCreditSelectedFiles([]);
            await fetchSelectedCreditResources(selectedCredit.lead_id);
            Swal.fire('Éxito', 'Documentos agregados correctamente', 'success');
        } catch (error) {
            console.error('Error uploading credit files', error);
            Swal.fire('Error', 'No se pudieron agregar los documentos', 'error');
        } finally {
            setUploadingCreditFiles(false);
        }
    };

    // Filter credits by column
    const filteredCredits = credits.filter((credit) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch = !normalizedSearch || [
            credit.client_name,
            credit.phone,
            credit.email,
            credit.desired_vehicle
        ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));

        const createdDate = formatBogotaDateForInput(credit.created_at);
        const matchesDate = !dateFilter || createdDate === dateFilter;
        const supervisorIds = getCreditSupervisorIds(credit);
        const matchesMyCredits = !showMyCreditsOnly
            || credit.assigned_to_id === user?.id
            || supervisorIds.includes(user?.id);
        const parsedUserFilter = userFilter ? parseInt(userFilter, 10) : null;
        const matchesUser = !parsedUserFilter || credit.assigned_to_id === parsedUserFilter;
        const isAssigned = !!credit.assigned_to_id;
        const matchesAssigned = !assignedFilter || (assignedFilter === 'assigned' ? isAssigned : !isAssigned);
        const matchesGlobalStatus = !globalStatusFilter || (credit.status || 'pending') === globalStatusFilter;

        return matchesSearch && matchesDate && matchesMyCredits && matchesUser && matchesAssigned && matchesGlobalStatus;
    });

    const getCreditsByStatus = (status) => {
        if (!Array.isArray(filteredCredits)) return [];
        return filteredCredits.filter(c => (c.status || 'pending') === status);
    };

    // Format Currency
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    };

    const getCreditStatusLabel = (status) => {
        switch (status) {
            case 'pending': return 'Solicitud recibida';
            case 'in_review': return 'En estudio';
            case 'approved': return 'Aprobado';
            case 'rejected': return 'No viable';
            case 'completed': return 'Vendido';
            default: return status || 'Sin estado';
        }
    };

    const getResponsibleName = (credit) => {
        if (!credit) return 'Sin responsable';
        if (credit.assigned_to?.full_name || credit.assigned_to?.email) {
            return credit.assigned_to.full_name || credit.assigned_to.email;
        }
        const assignedUser = creditUsers.find((person) => person.id === credit.assigned_to_id);
        return assignedUser?.full_name || assignedUser?.email || 'Sin responsable';
    };

    return (
        <div className="p-8 min-h-screen">
            {!canManageCredits && (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    Solo lectura: como asesor o vendedor puedes consultar las solicitudes de crédito relacionadas, pero no modificarlas.
                </div>
            )}
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestión de Créditos y Solicitudes</h1>
                    <p className="text-slate-500 mt-1 font-medium">Administra clientes en proceso de aprobación o búsqueda de vehículo.</p>
                </div>
                {canManageCredits && (
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleAnalyzeCreditEmails}
                            disabled={syncingGmailCredits}
                            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h16v16H4z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m4 7 8 6 8-6" />
                            </svg>
                            {syncingGmailCredits ? 'Analizando correos...' : 'Analizar correos de credito'}
                        </button>
                        <button
                            onClick={handleSyncCredits}
                            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v6h6M20 20v-6h-6M5.64 18.36A9 9 0 0018.36 18.36M18.36 5.64A9 9 0 005.64 5.64" />
                            </svg>
                            Traer leads en credito
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:scale-105 transition-all font-bold text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            Nueva Solicitud
                        </button>
                    </div>
                )}
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <input
                        type="text"
                        placeholder="Buscar por cliente, telefono, email o vehiculo..."
                        className="xl:col-span-2 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <input
                        type="date"
                        className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                    />
                    <select
                        className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white"
                        value={assignedFilter}
                        onChange={(e) => setAssignedFilter(e.target.value)}
                    >
                        <option value="">Asignacion</option>
                        <option value="assigned">Asignadas</option>
                        <option value="unassigned">Sin asignar</option>
                    </select>
                    <select
                        className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white"
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                    >
                        <option value="">Responsable</option>
                        {creditUsers.map((person) => (
                            <option key={person.id} value={person.id}>
                                {person.full_name || person.email}
                            </option>
                        ))}
                    </select>
                    <select
                        className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 bg-white"
                        value={globalStatusFilter}
                        onChange={(e) => setGlobalStatusFilter(e.target.value)}
                    >
                        <option value="">Estado global</option>
                        {Object.values(columns).map((column) => (
                            <option key={column.id} value={column.id}>{column.title}</option>
                        ))}
                    </select>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={showMyCreditsOnly}
                            onChange={(e) => setShowMyCreditsOnly(e.target.checked)}
                        />
                        Mis solicitudes
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            setDateFilter('');
                            setAssignedFilter('');
                            setUserFilter('');
                            setGlobalStatusFilter('');
            setShowMyCreditsOnly(true);
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                    >
                        Limpiar filtros
                    </button>
                    <span className="text-xs font-medium text-slate-400">
                        {filteredCredits.length} solicitud(es) visibles
                    </span>
                </div>
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
                                            <Draggable key={credit.id} draggableId={credit.id.toString()} index={index} isDragDisabled={!canManageCredits || credit.status === 'completed'}>
                                                {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...(canManageCredits ? provided.dragHandleProps : {})}
                                                        onClick={() => setSelectedCredit(credit)}
                                                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-3 hover:shadow-md transition cursor-pointer group"
                                                    >
                                                        <div className="mb-2">
                                                            <h4 className="font-bold text-slate-800">{credit.client_name}</h4>
                                                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                                                Gestionado por <span className="text-slate-700">{getResponsibleName(credit)}</span>
                                                            </p>
                                                        </div>

                                                        <div className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-1">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                            {credit.desired_vehicle}
                                                        </div>

                                                        <div className="space-y-1 text-xs text-slate-500">
                                                            <div className="flex justify-between gap-2">
                                                                <span>Telefono:</span>
                                                                <span className="font-medium text-slate-700 truncate">{credit.phone || 'Sin telefono'}</span>
                                                            </div>
                                                            {credit.email && (
                                                                <div className="flex justify-between gap-2">
                                                                    <span>Email:</span>
                                                                    <span className="font-medium text-slate-700 truncate">{credit.email}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between">
                                                                <span>Ingresos M.:</span>
                                                                <span className="font-medium text-slate-700">{formatCurrency(credit.monthly_income)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Inicial Disp.:</span>
                                                                <span className="font-medium text-slate-700">{formatCurrency(credit.down_payment)}</span>
                                                            </div>
                                                        </div>

                                                        {credit.notes && (
                                                            <p className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg border border-slate-100 p-2 line-clamp-3">
                                                                {credit.notes}
                                                            </p>
                                                        )}

                                                        <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
                                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border 
                                                                ${credit.occupation === 'employee' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                                    credit.occupation === 'independent' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                        'bg-gray-50 text-gray-600 border-gray-100'}`}>
                                                                {credit.occupation === 'employee' ? 'Empleado' : credit.occupation === 'independent' ? 'Independiente' : 'Pensionado'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {formatBogotaDate(credit.created_at) || 'Sin fecha'}
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

            {selectedCredit && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCredit(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">{selectedCredit.client_name}</h2>
                                <p className="mt-1 text-sm font-semibold text-slate-500">
                                    Gestionado por <span className="text-slate-700">{getResponsibleName(selectedCredit)}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {canManageCredits && (
                                    creditEditMode ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCreditEditMode(false);
                                                    setCreditEditStatusNote('');
                                                    setCreditEditData({
                                                        client_name: selectedCredit.client_name || '',
                                                        phone: selectedCredit.phone || '',
                                                        email: selectedCredit.email || '',
                                                        desired_vehicle: selectedCredit.desired_vehicle || '',
                                                        monthly_income: selectedCredit.monthly_income ?? 0,
                                                        other_income: selectedCredit.other_income ?? 0,
                                                        occupation: selectedCredit.occupation || 'employee',
                                                        application_mode: selectedCredit.application_mode || 'individual',
                                                        down_payment: selectedCredit.down_payment ?? 0,
                                                        approved_amount: selectedCredit.approved_amount ?? '',
                                                        approval_percentage: selectedCredit.approval_percentage ?? '',
                                                        approved_down_payment: selectedCredit.approved_down_payment ?? '',
                                                        status: selectedCredit.status || 'pending',
                                                        assigned_to_id: selectedCredit.assigned_to_id || '',
                                                        notes: selectedCredit.notes || '',
                                                    });
                                                }}
                                                disabled={savingCreditEdit}
                                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveCreditEdit}
                                                disabled={savingCreditEdit}
                                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {savingCreditEdit ? 'Guardando...' : 'Guardar cambios'}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setCreditEditMode(true)}
                                            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                                        >
                                            Editar
                                        </button>
                                    )
                                )}
                                <button
                                    onClick={() => setSelectedCredit(null)}
                                    className="text-2xl text-gray-400 hover:text-gray-600"
                                    aria-label="Cerrar"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        {creditEditMode && creditEditData ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-6">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-4">Editar solicitud</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Cliente</label>
                                        <input
                                            value={creditEditData.client_name}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, client_name: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                            placeholder="Nombre del cliente"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Responsable</label>
                                        <select
                                            value={creditEditData.assigned_to_id || ''}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, assigned_to_id: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Sin asignar</option>
                                            {creditUsers
                                                .filter((u) => u?.is_active !== false)
                                                .map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.full_name} - {u.role?.label || u.role?.name || u.role}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Telefono</label>
                                        <input
                                            value={creditEditData.phone}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, phone: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                            placeholder="Telefono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Email</label>
                                        <input
                                            value={creditEditData.email}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, email: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                            placeholder="Correo"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Vehiculo deseado</label>
                                        <input
                                            value={creditEditData.desired_vehicle}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, desired_vehicle: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                            placeholder="Vehiculo"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Estado</label>
                                        <select
                                            value={creditEditData.status || 'pending'}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, status: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        >
                                            {VALID_CREDIT_STATUSES.map((status) => (
                                                <option key={status} value={status}>
                                                    {getCreditStatusLabel(status)}
                                                </option>
                                            ))}
                                        </select>
                                        {String(creditEditData.status || '').trim() !== String(selectedCredit.status || '').trim() && (
                                            <div className="mt-3">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Nota obligatoria (cambio de estado)</label>
                                                <textarea
                                                    rows={3}
                                                    value={creditEditStatusNote}
                                                    onChange={(e) => setCreditEditStatusNote(e.target.value)}
                                                    className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Ej: Aprobado con condiciones..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Ocupacion</label>
                                        <select
                                            value={creditEditData.occupation || 'employee'}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, occupation: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="employee">Empleado</option>
                                            <option value="self_employed">Independiente</option>
                                            <option value="pensioner">Pensionado</option>
                                            <option value="student">Estudiante</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Modalidad</label>
                                        <select
                                            value={creditEditData.application_mode || 'individual'}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, application_mode: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="individual">Individual</option>
                                            <option value="co_signer">Codeudor</option>
                                            <option value="company">Empresa</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Ingresos mensuales</label>
                                        <input
                                            type="number"
                                            value={creditEditData.monthly_income}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, monthly_income: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Otros ingresos</label>
                                        <input
                                            type="number"
                                            value={creditEditData.other_income}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, other_income: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Cuota inicial disponible</label>
                                        <input
                                            type="number"
                                            value={creditEditData.down_payment}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, down_payment: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Monto aprobado</label>
                                        <input
                                            type="number"
                                            value={creditEditData.approved_amount}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, approved_amount: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                            placeholder="(Opcional)"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">% financiado</label>
                                        <input
                                            type="number"
                                            value={creditEditData.approval_percentage}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, approval_percentage: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                            placeholder="(Opcional)"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Cuota inicial minima (calculada)</label>
                                        <input
                                            type="number"
                                            value={creditEditData.approved_down_payment}
                                            readOnly
                                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                            placeholder="(Opcional)"
                                        />
                                        <p className="mt-1 text-xs text-slate-500">
                                            Se recalcula automaticamente segun el monto aprobado y el porcentaje financiado.
                                        </p>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Notas</label>
                                        <textarea
                                            rows={4}
                                            value={creditEditData.notes || ''}
                                            onChange={(e) => setCreditEditData((prev) => ({ ...prev, notes: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                            placeholder="Notas internas del credito..."
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Cliente</p>
                                        <div className="space-y-2 text-sm text-slate-700">
                                            <p><span className="font-semibold">Telefono:</span> {selectedCredit.phone || 'Sin telefono'}</p>
                                            <p><span className="font-semibold">Email:</span> {selectedCredit.email || 'Sin email'}</p>
                                            <p><span className="font-semibold">Vehiculo:</span> {selectedCredit.desired_vehicle}</p>
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Proceso</p>
                                        <div className="space-y-2 text-sm text-slate-700">
                                            <p><span className="font-semibold">Estado:</span> {getCreditStatusLabel(selectedCredit.status)}</p>
                                            <p><span className="font-semibold">Ingresos:</span> {formatCurrency(selectedCredit.monthly_income || 0)}</p>
                                            <p><span className="font-semibold">Cuota inicial:</span> {formatCurrency(selectedCredit.down_payment || 0)}</p>
                                            <p><span className="font-semibold">Ocupacion:</span> {selectedCredit.occupation}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Notas de la solicitud</p>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedCredit.notes || 'Sin notas registradas.'}</p>
                                </div>
                            </>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Agregar nota desde créditos</p>
                                {!canManageCredits ? (
                                    <p className="text-sm text-slate-500">Esta solicitud está en modo solo lectura para tu rol.</p>
                                ) : selectedCredit.lead_id ? (
                                    <>
                                        <textarea
                                            rows="3"
                                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                                            placeholder="Escribe la nota que quieres dejar en esta solicitud..."
                                            value={creditNoteInput}
                                            onChange={(e) => setCreditNoteInput(e.target.value)}
                                        />
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleCreditNoteSubmit}
                                                disabled={savingCreditNote || !creditNoteInput.trim()}
                                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {savingCreditNote ? 'Guardando...' : 'Guardar nota'}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500">Esta solicitud no tiene lead relacionado para sincronizar notas.</p>
                                )}
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Documentos del proceso</p>
                                {!canManageCredits ? (
                                    <p className="text-sm text-slate-500">Los documentos de crédito solo pueden ser gestionados por el equipo de créditos o administradores.</p>
                                ) : selectedCredit.lead_id ? (
                                    <>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <input
                                                type="file"
                                                multiple
                                                className="flex-1 text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                                                onChange={(e) => setCreditSelectedFiles(Array.from(e.target.files || []))}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCreditFileUpload}
                                                disabled={uploadingCreditFiles || creditSelectedFiles.length === 0}
                                                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50"
                                            >
                                                {uploadingCreditFiles ? 'Subiendo...' : `Subir ${creditSelectedFiles.length > 0 ? `(${creditSelectedFiles.length})` : ''}`}
                                            </button>
                                        </div>
                                        {creditLeadFiles.length > 0 && (
                                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                {creditLeadFiles.map((file) => (
                                                    <a
                                                        key={file.id}
                                                        href={buildCreditFileUrl(file.file_path)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title={`Abrir ${file.file_name}`}
                                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                                                    >
                                                        {file.file_name}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500">Solo puedes adjuntar documentos cuando la solicitud esté ligada a un lead.</p>
                                )}
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Notas reflejadas en el lead</p>
                                {creditLeadNotes.length > 0 ? (
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {creditLeadNotes.map((note) => (
                                              <div key={note.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                                  <p className="text-[11px] font-semibold text-slate-500">
                                                      {note.user?.full_name || note.user?.email || 'Usuario'}
                                                  </p>
                                                  <p className="text-sm text-slate-700">{note.content}</p>
                                                  <p className="mt-1 text-[11px] text-slate-400">
                                                      {note.created_at ? formatBogotaDateTime(note.created_at) : 'Reciente'}
                                                  </p>
                                              </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">Aún no hay notas registradas para este lead desde créditos.</p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-3">
                            {selectedCredit.lead_id && (
                                <button
                                    onClick={() => navigate(`${leadBoardPath}?leadId=${selectedCredit.lead_id}`)}
                                    className="px-4 py-2 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50"
                                >
                                    Abrir lead relacionado
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedCredit(null)}
                                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreditBoard;
