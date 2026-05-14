import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatBogotaDateTime } from '../utils/dateTime';

const API_BASE_URL = `${window.location.origin}/crm/api`;

const extractCreditVehicleTrace = (comment) => {
    const text = (comment || '').trim();
    if (!text) return { vehicleTrace: '', mainComment: '' };

    const vehicleMatch = text.match(/(Veh[ií]culo (?:por buscar|de inventario):[^|"]+)/i);
    const vehicleTrace = vehicleMatch ? vehicleMatch[1].trim() : '';
    const mainComment = vehicleTrace
        ? text
            .replace(vehicleMatch[1], '')
            .replace(/\s*\|\s*/g, ' | ')
            .replace(/^(\|\s*)|(\s*\|)$/g, '')
            .trim()
        : text;

    return { vehicleTrace, mainComment };
};

const formatLeadCurrencyValue = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return value || '';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(numericValue);
};

const extractSalesApprovalSummary = (text) => {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return null;
    if (!normalizedText.toLowerCase().includes('resumen para ventas:')) return null;

    const vehicleMatch = normalizedText.match(/veh[ií]culo\s+(.+?)\s*\|\s*monto aprobado/i);
    const approvedAmountMatch = normalizedText.match(/monto aprobado\s+\$?\s*([\d.,]+)/i);
    const approvalPercentageMatch = normalizedText.match(/porcentaje aprobado\s+([\d.,]+)%/i);
    const minimumDownPaymentMatch = normalizedText.match(/cuota inicial m[ií]nima\s+\$?\s*([\d.,]+)/i);

    const parseNumericValue = (rawValue) => {
        if (!rawValue) return null;
        const digitsOnly = String(rawValue).replace(/[^\d]/g, '');
        if (!digitsOnly) return null;
        const numericValue = Number(digitsOnly);
        return Number.isFinite(numericValue) ? numericValue : null;
    };

    const parsePercentageValue = (rawValue) => {
        if (!rawValue) return null;
        const normalizedNumber = String(rawValue).replace(',', '.').trim();
        const numericValue = Number(normalizedNumber);
        return Number.isFinite(numericValue) ? numericValue : null;
    };

    return {
        vehicle: vehicleMatch?.[1]?.trim() || '',
        approvedAmount: parseNumericValue(approvedAmountMatch?.[1]),
        approvalPercentage: parsePercentageValue(approvalPercentageMatch?.[1]),
        minimumDownPayment: parseNumericValue(minimumDownPaymentMatch?.[1]),
    };
};

const extractApprovalMetrics = (text) => {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return null;

    const approvedAmountMatch = normalizedText.match(/monto aprobado[:\s]+\$?\s*([\d.,]+)/i);
    const approvalPercentageMatch = normalizedText.match(/porcentaje aprobado[:\s]+([\d.,]+)%/i);
    const minimumDownPaymentMatch = normalizedText.match(/cuota inicial(?: m[ií]nima)?[:\s]+\$?\s*([\d.,]+)/i);

    const parseMoney = (rawValue) => {
        if (!rawValue) return null;
        const digitsOnly = String(rawValue).replace(/[^\d]/g, '');
        if (!digitsOnly) return null;
        const numericValue = Number(digitsOnly);
        return Number.isFinite(numericValue) ? numericValue : null;
    };

    const parsePercentage = (rawValue) => {
        if (!rawValue) return null;
        const normalizedNumber = String(rawValue).replace(',', '.').trim();
        const numericValue = Number(normalizedNumber);
        return Number.isFinite(numericValue) ? numericValue : null;
    };

    const approvedAmount = parseMoney(approvedAmountMatch?.[1]);
    const approvalPercentage = parsePercentage(approvalPercentageMatch?.[1]);
    const minimumDownPayment = parseMoney(minimumDownPaymentMatch?.[1]);

    if (approvedAmount == null && approvalPercentage == null && minimumDownPayment == null) {
        return null;
    }

    return {
        approvedAmount,
        approvalPercentage,
        minimumDownPayment,
    };
};

const extractLatestPurchaseRejectionReason = (text) => {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return '';

    const matches = [...normalizedText.matchAll(/Solicitud de compra cancelada\.\s*Motivo:\s*(.+)/gi)];
    if (matches.length === 0) return '';
    return String(matches[matches.length - 1]?.[1] || '').trim();
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

// Draggable Lead Card Component
const LeadCard = ({ lead, status, onDragStart, onViewHistory, isHighlighted = false, boardMode = 'general', canDrag = true }) => {
    const getLeadAgePalette = (createdAt) => {
        if (!createdAt) {
            return {
                cardClassName: 'bg-white',
                borderClassName: 'border-slate-200',
                dividerClassName: 'border-slate-200',
                titleClassName: 'text-slate-800',
                metaClassName: 'text-slate-600',
                mutedClassName: 'text-slate-500',
                assignedLabelClassName: 'text-slate-400',
                actionButtonClassName: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50',
            };
        }

        const createdDate = new Date(createdAt);
        if (Number.isNaN(createdDate.getTime())) {
            return {
                cardClassName: 'bg-white',
                borderClassName: 'border-slate-200',
                dividerClassName: 'border-slate-200',
                titleClassName: 'text-slate-800',
                metaClassName: 'text-slate-600',
                mutedClassName: 'text-slate-500',
                assignedLabelClassName: 'text-slate-400',
                actionButtonClassName: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50',
            };
        }

        const ageInDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

        if (ageInDays <= 3) {
            return {
                cardClassName: 'bg-red-100',
                borderClassName: 'border-red-300',
                dividerClassName: 'border-red-200',
                titleClassName: 'text-red-950',
                metaClassName: 'text-red-900',
                mutedClassName: 'text-red-800',
                assignedLabelClassName: 'text-red-700',
                actionButtonClassName: 'text-red-900 hover:text-red-950 hover:bg-red-200/70',
            };
        }

        if (ageInDays <= 6) {
            return {
                cardClassName: 'bg-amber-100',
                borderClassName: 'border-amber-300',
                dividerClassName: 'border-amber-300',
                titleClassName: 'text-amber-950',
                metaClassName: 'text-amber-900',
                mutedClassName: 'text-amber-800',
                assignedLabelClassName: 'text-amber-700',
                actionButtonClassName: 'text-amber-900 hover:text-amber-950 hover:bg-amber-200/70',
            };
        }

        return {
            cardClassName: 'bg-white',
            borderClassName: 'border-slate-200',
            dividerClassName: 'border-slate-200',
            titleClassName: 'text-slate-800',
            metaClassName: 'text-slate-600',
            mutedClassName: 'text-slate-500',
            assignedLabelClassName: 'text-slate-400',
            actionButtonClassName: 'text-blue-600 hover:text-blue-800 hover:bg-blue-50',
        };
    };

    const getSourceColor = (source) => {
        switch (source?.toLowerCase()) {
            case 'facebook': return 'bg-blue-100 text-blue-700';
            case 'instagram': return 'bg-pink-100 text-pink-700';
            case 'whatsapp': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getCreditStatusMeta = (creditStatus) => {
        switch (creditStatus) {
            case 'pending': return { label: 'Solicitud recibida', className: 'bg-amber-100 text-amber-800 border-amber-200' };
            case 'in_review': return { label: 'Respuesta crédito: En estudio', className: 'bg-sky-100 text-sky-800 border-sky-200' };
            case 'approved': return { label: 'Respuesta crédito: Viable', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
            case 'rejected': return { label: 'Respuesta crédito: Rechazado', className: 'bg-rose-100 text-rose-800 border-rose-200' };
            case 'completed': return { label: 'Finalizado', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
            default: return null;
        }
    };

    const getLeadVisualPalette = (leadItem, leadStatus) => {
        const normalizedLeadStatus = normalizeLeadStatus(leadStatus || leadItem?.status);
        const normalizedCreditStatus = String(leadItem?.credit_application_status || '').trim().toLowerCase();
        const normalizedPurchaseRequestStatus = String(leadItem?.purchase_request_status || '').trim().toLowerCase();

        if (
            ['reserved', 'preparation'].includes(normalizedLeadStatus) &&
            normalizedPurchaseRequestStatus === 'rejected'
        ) {
            return {
                cardClassName: 'bg-red-100',
                borderClassName: 'border-red-300',
                dividerClassName: 'border-red-200',
                titleClassName: 'text-red-950',
                metaClassName: 'text-red-900',
                mutedClassName: 'text-red-800',
                assignedLabelClassName: 'text-red-700',
                actionButtonClassName: 'text-red-900 hover:text-red-950 hover:bg-red-200/70',
            };
        }

        if (normalizedLeadStatus === 'credit_study' || normalizedLeadStatus === 'approvals') {
            if (normalizedCreditStatus === 'approved') {
                return {
                    cardClassName: 'bg-emerald-100',
                    borderClassName: 'border-emerald-300',
                    dividerClassName: 'border-emerald-200',
                    titleClassName: 'text-emerald-950',
                    metaClassName: 'text-emerald-900',
                    mutedClassName: 'text-emerald-800',
                    assignedLabelClassName: 'text-emerald-700',
                    actionButtonClassName: 'text-emerald-900 hover:text-emerald-950 hover:bg-emerald-200/70',
                };
            }

            if (normalizedCreditStatus === 'in_review') {
                return {
                    cardClassName: 'bg-amber-100',
                    borderClassName: 'border-amber-300',
                    dividerClassName: 'border-amber-300',
                    titleClassName: 'text-amber-950',
                    metaClassName: 'text-amber-900',
                    mutedClassName: 'text-amber-800',
                    assignedLabelClassName: 'text-amber-700',
                    actionButtonClassName: 'text-amber-900 hover:text-amber-950 hover:bg-amber-200/70',
                };
            }

            if (normalizedCreditStatus === 'rejected') {
                return {
                    cardClassName: 'bg-red-100',
                    borderClassName: 'border-red-300',
                    dividerClassName: 'border-red-200',
                    titleClassName: 'text-red-950',
                    metaClassName: 'text-red-900',
                    mutedClassName: 'text-red-800',
                    assignedLabelClassName: 'text-red-700',
                    actionButtonClassName: 'text-red-900 hover:text-red-950 hover:bg-red-200/70',
                };
            }
        }

        return getLeadAgePalette(leadItem?.created_at);
    };

    const getPurchaseOptionsMeta = (leadItem) => {
        const options = Array.isArray(leadItem?.purchase_options) ? leadItem.purchase_options : [];
        if (options.length === 0) return null;

        const acceptedCount = options.filter((option) => option?.decision_status === 'accepted').length;
        const rejectedCount = options.filter((option) => option?.decision_status === 'rejected').length;
        const pendingCount = options.length - acceptedCount - rejectedCount;

        if (acceptedCount > 0) {
            return {
                label: acceptedCount === 1 ? 'Opcion aceptada' : `${acceptedCount} opciones aceptadas`,
                className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
            };
        }
        if (pendingCount > 0) {
            return {
                label: pendingCount === 1 ? 'Opcion encontrada' : `${pendingCount} opciones encontradas`,
                className: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
            };
        }
        return {
            label: rejectedCount === 1 ? 'Opcion rechazada' : `${rejectedCount} opciones rechazadas`,
            className: 'bg-rose-100 text-rose-800 border-rose-200'
        };
    };

    const getPurchaseRequestMeta = (leadItem) => {
        const statusValue = String(leadItem?.purchase_request_status || '').trim().toLowerCase();
        if (!statusValue) return null;

        switch (statusValue) {
            case 'pending':
                return { label: 'Solicitud de compra recibida', className: 'bg-amber-100 text-amber-800 border-amber-200' };
            case 'in_review':
                return { label: 'Compra: en búsqueda', className: 'bg-sky-100 text-sky-800 border-sky-200' };
            case 'approved':
                return { label: 'Compra: opciones encontradas', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
            case 'rejected':
                return { label: 'Solicitud de compra rechazada', className: 'bg-rose-100 text-rose-800 border-rose-200' };
            case 'completed':
                return { label: 'Compra cerrada', className: 'bg-slate-200 text-slate-800 border-slate-300' };
            default:
                return null;
        }
    };

    const creditStatusMeta = getCreditStatusMeta(lead.credit_application_status);
    const purchaseOptionsMeta = getPurchaseOptionsMeta(lead);
    const purchaseRequestMeta = getPurchaseRequestMeta(lead);
    const assignedPersonName = lead?.assigned_to?.full_name || lead?.assigned_to?.email || 'Sin asignar';
    const assignedPersonInitial = assignedPersonName?.charAt(0)?.toUpperCase() || '?';
    const assignedLeadUserId = getLeadAssignedUserId(lead);
    const additionalResponsibleUsers = getLeadSupervisorUsers(lead).filter((user) => user?.id !== assignedLeadUserId);
    const additionalResponsibleLabel = additionalResponsibleUsers.length === 1
        ? (additionalResponsibleUsers[0]?.full_name || additionalResponsibleUsers[0]?.email || '1 adicional')
        : additionalResponsibleUsers.length > 1
            ? `${additionalResponsibleUsers.length} adicionales`
            : '';
    const agePalette = getLeadVisualPalette(lead, status);
    const normalizedStatus = normalizeLeadStatus(status);
    const statusMeta = getLeadStatusMeta(normalizedStatus);

    return (
        <div
            id={`lead-card-${lead.id}`}
            draggable={canDrag}
            onDragStart={(e) => onDragStart(e, lead.id)}
            className={`p-3 rounded-lg shadow-sm border-2 hover:shadow-md transition-all transform hover:-translate-y-0.5 group relative animate-fade-in ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-95'} ${agePalette.cardClassName} ${agePalette.borderClassName}`}
            style={{
                borderColor: isHighlighted ? '#2563eb' : undefined,
                borderLeftColor: statusMeta.borderColor,
                borderLeftWidth: '6px',
                boxShadow: isHighlighted ? '0 0 0 3px rgba(37, 99, 235, 0.18)' : undefined
            }}
        >
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${getSourceColor(lead.source)}`}>
                    {lead.source || 'WEB'}
                </span>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {isHighlighted && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wide border border-blue-200">
                            Desde alerta
                        </span>
                    )}
                    {Number(lead.has_unread_reply || 0) > 0 && (
                        <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide border border-amber-200"
                            title="Este lead respondió y está pendiente por revisar"
                        >
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            Respondió
                        </span>
                    )}
                    {creditStatusMeta && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${creditStatusMeta.className}`}>
                            <span className="h-2 w-2 rounded-full bg-current opacity-70"></span>
                            {creditStatusMeta.label}
                        </span>
                    )}
                    {purchaseOptionsMeta && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${purchaseOptionsMeta.className}`}>
                            <span className="h-2 w-2 rounded-full bg-current opacity-70"></span>
                            {purchaseOptionsMeta.label}
                        </span>
                    )}
                    {purchaseRequestMeta && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${purchaseRequestMeta.className}`}>
                            <span className="h-2 w-2 rounded-full bg-current opacity-70"></span>
                            {purchaseRequestMeta.label}
                        </span>
                    )}
                </div>
            </div>

            <h4 className={`font-bold text-base mb-1.5 leading-tight ${agePalette.titleClassName}`}>{lead.name}</h4>

            {lead.phone && (
                <div className={`flex items-center gap-1.5 text-[11px] mb-2 font-medium ${agePalette.mutedClassName}`}>
                    <svg className={`w-3.5 h-3.5 ${agePalette.assignedLabelClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {lead.phone}
                </div>
            )}

            {/* Actions Footer */}
            <div className={`flex items-center justify-between border-t pt-2 mt-auto ${agePalette.dividerClassName}`}>
                <div className={`min-w-0 flex items-center gap-1.5 text-[11px] ${agePalette.metaClassName}`}>
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 text-[9px]">
                        {assignedPersonInitial}
                    </div>
                    <div className="min-w-0">
                        <p className={`text-[9px] font-bold uppercase tracking-wide ${agePalette.assignedLabelClassName}`}>Asignado a</p>
                        <p className={`truncate text-[11px] font-semibold ${agePalette.metaClassName}`}>{assignedPersonName}</p>
                        {additionalResponsibleLabel && (
                            <p className={`truncate text-[10px] ${agePalette.mutedClassName}`}>Equipo: {additionalResponsibleLabel}</p>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => onViewHistory(lead)}
                    className={`text-[11px] font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 ${agePalette.actionButtonClassName}`}
                    title="Ver historial de seguimiento"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Seguimiento
                </button>
            </div>
        </div>
    );
};

const getDisplayRoleName = (role) => {
    if (!role) return 'Usuario';
    if (typeof role === 'string') return role;
    if (role.label) return role.label;

    const effectiveName = role.base_role_name || role.name || '';
    switch (effectiveName) {
        case 'super_admin': return 'Super Admin';
        case 'admin': return 'Administrador';
        case 'asesor': return 'Asesor';
        case 'aliado': return 'Aliado';
        case 'inventario': return 'Inventario';
        case 'compras': return 'Compras';
        case 'user': return 'Usuario';
        default: return effectiveName || 'Usuario';
    }
};

const getEffectiveRoleName = (role) => {
    if (!role) return '';
    if (typeof role === 'string') return role;
    return role.base_role_name || role.name || '';
};

const normalizeRoleKey = (role) => {
    const directRoleName = getEffectiveRoleName(role);
    const normalizedDirectRoleName = String(directRoleName || '').trim().toLowerCase();
    if (normalizedDirectRoleName.includes('super_admin') || normalizedDirectRoleName.includes('super admin')) {
        return 'super_admin';
    }
    if (normalizedDirectRoleName.includes('admin')) {
        return 'admin';
    }
    if (normalizedDirectRoleName.includes('asesor') || normalizedDirectRoleName.includes('vendedor')) {
        return 'asesor';
    }
    if (normalizedDirectRoleName.includes('aliado')) {
        return 'aliado';
    }
    if (normalizedDirectRoleName.includes('compra')) {
        return 'compras';
    }
    if (normalizedDirectRoleName.includes('inventario')) {
        return 'inventario';
    }
    if (normalizedDirectRoleName) {
        return normalizedDirectRoleName;
    }

    const rawLabel = typeof role === 'object' ? role?.label : role;
    const normalizedLabel = String(rawLabel || '').trim().toLowerCase();
    if (normalizedLabel === 'administrador de empresa' || normalizedLabel === 'administrador') {
        return 'admin';
    }
    if (normalizedLabel === 'super admin' || normalizedLabel === 'super administrador') {
        return 'super_admin';
    }
    return normalizedLabel;
};

const getLeadSupervisorIds = (lead) => {
    if (!lead) return [];
    if (Array.isArray(lead.supervisor_ids) && lead.supervisor_ids.length > 0) {
        return lead.supervisor_ids
            .map((id) => parseInt(id, 10))
            .filter((id) => Number.isInteger(id));
    }
    if (Array.isArray(lead.supervisors)) {
        return lead.supervisors
            .map((user) => parseInt(user?.id, 10))
            .filter((id) => Number.isInteger(id));
    }
    return [];
};

const getLeadSupervisorUsers = (lead) => (
    Array.isArray(lead?.supervisors) ? lead.supervisors.filter(Boolean) : []
);

const getAssignableRoleIds = (role) => {
    if (!role || typeof role !== 'object' || !Array.isArray(role.assignable_role_ids)) {
        return [];
    }
    return role.assignable_role_ids
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id));
};

const parseUserId = (value) => {
    const parsedValue = parseInt(value, 10);
    return Number.isInteger(parsedValue) ? parsedValue : null;
};

const LEGACY_LEAD_STATUS_MAP = {
    interested: 'in_process',
    credit_application: 'credit_study',
    qualified: 'approvals',
    ally_managed: 'new',
};

const LEAD_STATUS_OPTIONS = [
    { value: 'new', label: 'Nuevos', columnColor: 'text-blue-600', borderColor: '#3b82f6', historyBadgeClass: 'bg-blue-500' },
    { value: 'contacted', label: 'Contactados', columnColor: 'text-amber-600', borderColor: '#eab308', historyBadgeClass: 'bg-amber-500' },
    { value: 'in_process', label: 'En proceso', columnColor: 'text-orange-600', borderColor: '#f97316', historyBadgeClass: 'bg-orange-500' },
    { value: 'credit_study', label: 'Estudio de crédito', columnColor: 'text-teal-600', borderColor: '#0f766e', historyBadgeClass: 'bg-teal-500' },
    { value: 'approvals', label: 'Aprobaciones', columnColor: 'text-cyan-600', borderColor: '#0891b2', historyBadgeClass: 'bg-cyan-500' },
    { value: 'reserved', label: 'Reservas', columnColor: 'text-violet-600', borderColor: '#8b5cf6', historyBadgeClass: 'bg-violet-500' },
    { value: 'preparation', label: 'Alistamientos', columnColor: 'text-fuchsia-600', borderColor: '#c026d3', historyBadgeClass: 'bg-fuchsia-500' },
    { value: 'sold', label: 'Vendidos', columnColor: 'text-green-600', borderColor: '#22c55e', historyBadgeClass: 'bg-green-500' },
    { value: 'lost', label: 'Perdidos', columnColor: 'text-slate-500', borderColor: '#64748b', historyBadgeClass: 'bg-slate-500' },
];

const LEAD_STATUS_META = LEAD_STATUS_OPTIONS.reduce((accumulator, statusOption) => {
    accumulator[statusOption.value] = statusOption;
    return accumulator;
}, {});

const normalizeLeadStatus = (status) => {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (!normalizedStatus) return 'new';
    return LEGACY_LEAD_STATUS_MAP[normalizedStatus] || normalizedStatus;
};

const getLeadStatusMeta = (status) => (
    LEAD_STATUS_META[normalizeLeadStatus(status)] || LEAD_STATUS_META.new
);

const getLeadStatusLabel = (status) => getLeadStatusMeta(status).label;

const normalizeLeadRecord = (lead) => {
    if (!lead) return lead;
    return {
        ...lead,
        status: normalizeLeadStatus(lead.status),
        history: Array.isArray(lead.history)
            ? lead.history.map((entry) => ({
                ...entry,
                previous_status: entry?.previous_status ? normalizeLeadStatus(entry.previous_status) : entry?.previous_status,
                new_status: entry?.new_status ? normalizeLeadStatus(entry.new_status) : entry?.new_status,
            }))
            : lead.history,
    };
};

const getLeadApprovalMetrics = (lead) => {
    if (!lead) {
        return { approvedAmount: null, approvalPercentage: null, minimumDownPayment: null };
    }

    const extracted = [
        ...(Array.isArray(lead?.notes) ? lead.notes.map((note) => note?.content || '') : []),
        ...(Array.isArray(lead?.history) ? lead.history.map((entry) => entry?.comment || '') : []),
        lead?.message || '',
    ]
        .map((content) => extractApprovalMetrics(content))
        .find(Boolean);

    const approvedAmount = extracted?.approvedAmount
        ?? lead?.credit_application?.approved_amount
        ?? lead?.credit_application_approved_amount
        ?? null;
    const approvalPercentage = extracted?.approvalPercentage
        ?? lead?.credit_application?.approval_percentage
        ?? lead?.credit_application_approval_percentage
        ?? null;
    const minimumDownPayment = extracted?.minimumDownPayment
        ?? lead?.credit_application?.approved_down_payment
        ?? lead?.credit_application_approved_down_payment
        ?? null;

    return {
        approvedAmount,
        approvalPercentage,
        minimumDownPayment,
    };
};

const calculateMinimumDownPaymentFromApproval = (approvedAmount, approvalPercentage) => {
    const safeApprovedAmount = Number(approvedAmount) || 0;
    const safeApprovalPercentage = Number(approvalPercentage) || 0;

    if (!safeApprovedAmount || !safeApprovalPercentage || safeApprovalPercentage <= 0 || safeApprovalPercentage > 100) {
        return null;
    }

    return Math.max(0, Math.round(safeApprovedAmount * ((100 - safeApprovalPercentage) / 100)));
};

const getLeadAssignedUserId = (lead) => parseUserId(lead?.assigned_to?.id ?? lead?.assigned_to_id);

const isCompanyAdminRole = (role) => {
    const normalizedRole = normalizeRoleKey(role);
    return normalizedRole === 'admin' || normalizedRole === 'super_admin';
};

const isSupervisorOnlyCreditViewer = (lead, currentUserId, currentUserRole) => {
    if (!lead || currentUserId === null || isCompanyAdminRole(currentUserRole)) return false;
    if (normalizeLeadStatus(lead?.status) !== 'credit_study') return false;
    const supervisorIds = getLeadSupervisorIds(lead);
    const assignedUserId = getLeadAssignedUserId(lead);
    return supervisorIds.includes(currentUserId) && assignedUserId !== currentUserId;
};

const isCreditNotificationForLead = (notification, leadId) => {
    if (!notification || !leadId) return false;
    const link = String(notification.link || '');
    const haystack = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
    return link.includes(`leadId=${leadId}`) && haystack.includes('crédito');
};

const isCreditNotificationForBoard = (notification, boardMode = 'general') => {
    if (!notification) return false;
    const link = String(notification.link || '');
    const haystack = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
    const expectedRoute = boardMode === 'ally' ? '/aliado/dashboard' : '/admin/leads';
    return (
        Number(notification?.is_read || 0) === 0 &&
        link.includes(expectedRoute) &&
        (haystack.includes('crédito') || haystack.includes('credito'))
    );
};

const isUserActive = (user) => {
    const value = user?.is_active;
    return value === undefined || value === null || value === true || value === 1;
};

const sanitizeSupervisorIds = (supervisorIds, advisors) => {
    if (!Array.isArray(supervisorIds)) return null;
    const activeAdvisorIds = new Set(
        (Array.isArray(advisors) ? advisors : [])
            .filter((advisor) => isUserActive(advisor))
            .map((advisor) => parseUserId(advisor?.id))
            .filter((id) => id !== null)
    );

    return supervisorIds
        .map((id) => parseUserId(id))
        .filter((id) => id !== null && activeAdvisorIds.has(id));
};

const buildPublicStaticUrl = (filePath) => {
    if (!filePath) return '#';
    if (/^https?:\/\//i.test(filePath)) return filePath;
    let normalized = String(filePath).trim();
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;
    if (normalized.startsWith('/crm/api/')) normalized = normalized.replace('/crm/api/', '/');
    if (normalized.startsWith('/api/static/')) normalized = normalized.replace('/api/static/', '/static/');
    // In dev the Vite proxy is configured for /crm/api (not /static), so serve static through the API prefix.
    return `${window.location.origin}/crm/api${normalized}`;
};

const buildPurchaseOptionShareText = (lead, option) => {
    const lines = [
        `Lead: ${lead?.name || 'Cliente'}`,
        `Opcion: ${option?.title || 'Sin titulo'}`
    ];

    if (option?.description) {
        lines.push('');
        lines.push(option.description);
    }

    if (Array.isArray(option?.photos) && option.photos.length > 0) {
        lines.push('');
        lines.push('Fotos:');
        option.photos.forEach((photo) => lines.push(buildPublicStaticUrl(photo)));
    }

    return lines.join('\n');
};

// Kanban Column
const KanbanColumn = ({ title, status, leads, color, onDragOver, onDrop, onDragStart, onViewHistory, highlightedLeadId, boardMode = 'general', currentUserId = null, currentUserRole = '' }) => {
    return (
        <div
            className={`flex-1 min-w-[290px] rounded-xl p-3 border flex flex-col h-full backdrop-blur-sm ${boardMode === 'ally' ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50/80 border-slate-200'}`}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, status)}
        >
            <div className={`flex items-center justify-between mb-3 pb-2 border-b border-gray-200 ${color}`}>
                <h3 className="font-bold text-base flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-current shadow-sm"></span>
                    {title}
                </h3>
                <span className="bg-white text-slate-600 text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 shadow-sm">
                    {leads.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar pb-8">
                {leads.map(lead => (
                    <LeadCard
                        key={lead.id}
                        lead={lead}
                        status={status}
                        onDragStart={onDragStart}
                        onViewHistory={onViewHistory}
                        isHighlighted={lead.id === highlightedLeadId}
                        boardMode={boardMode}
                        canDrag={!isSupervisorOnlyCreditViewer(lead, currentUserId, currentUserRole)}
                    />
                ))}
            </div>
        </div>
    );
};

// History Modal Component
const HistoryModal = ({ lead, onClose, onUpdate, onUpdateContact, onSaveSupervisors, onDeleteLead, advisors, onAssign, onRefreshLeadBoard, availableVehicles, currentUserRole, boardMode = 'general', loadingDetail = false }) => {
    const { user } = useAuth();
    const [assignedAdvisor, setAssignedAdvisor] = useState(getLeadAssignedUserId(lead) || '');
    const [selectedSupervisors, setSelectedSupervisors] = useState(getLeadSupervisorIds(lead));
    const { createAppointment } = useNotifications();
    const [newComment, setNewComment] = useState('');
    const [newStatus, setNewStatus] = useState(normalizeLeadStatus(lead?.status || 'new'));
    const [loading, setLoading] = useState(false);
    const [savingSupervisors, setSavingSupervisors] = useState(false);
    const [isSupervisionSelectorOpen, setIsSupervisionSelectorOpen] = useState(false);

    // Process Detail States
    const [hasVehicle, setHasVehicle] = useState(
        typeof lead?.process_detail?.has_vehicle === 'boolean' ? lead.process_detail.has_vehicle : null
    );
    const [selectedVehicleId, setSelectedVehicleId] = useState(lead?.process_detail?.vehicle_id || '');
    const [desiredVehicle, setDesiredVehicle] = useState(lead?.process_detail?.desired_vehicle || '');
    const [reservationAmount, setReservationAmount] = useState(lead?.process_detail?.reservation_amount ? String(lead.process_detail.reservation_amount) : '');
    const [reservationCreditUsedAmount, setReservationCreditUsedAmount] = useState(lead?.process_detail?.credit_used_amount ? String(lead.process_detail.credit_used_amount) : '');
    const [reservationPaymentMethod, setReservationPaymentMethod] = useState(lead?.process_detail?.reservation_payment_method || '');
    const [deliveryDocumentsComplete, setDeliveryDocumentsComplete] = useState(Boolean(lead?.process_detail?.delivery_documents_complete));
    const [deliveryRoadKit, setDeliveryRoadKit] = useState(Boolean(lead?.process_detail?.delivery_road_kit));
    const [deliveryBasicTools, setDeliveryBasicTools] = useState(Boolean(lead?.process_detail?.delivery_basic_tools));
    const [deliveryCreditDisbursement, setDeliveryCreditDisbursement] = useState(Boolean(lead?.process_detail?.delivery_credit_disbursement));
    const [deliveryScheduledAt, setDeliveryScheduledAt] = useState(lead?.process_detail?.delivery_scheduled_at || '');
    const [deliveryScheduledNote, setDeliveryScheduledNote] = useState(lead?.process_detail?.delivery_scheduled_note || '');
    const [savingDeliveryChecklist, setSavingDeliveryChecklist] = useState(false);
    const [schedulingDelivery, setSchedulingDelivery] = useState(false);

    // Load Lead Messages
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Reply State
    const [replyMessage, setReplyMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [activeDetailTab, setActiveDetailTab] = useState('resumen');

    // Reminder State
    const [reminderDate, setReminderDate] = useState('');
    const [reminderNote, setReminderNote] = useState('');
    const [leadAppointments, setLeadAppointments] = useState([]);
    const [loadingAppointments, setLoadingAppointments] = useState(false);

    // Notes & Files State
    const [noteContent, setNoteContent] = useState('');
    const [uploadingNote, setUploadingNote] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [leadNotes, setLeadNotes] = useState([]);
    const [leadFiles, setLeadFiles] = useState([]);
    const [purchaseOptions, setPurchaseOptions] = useState(Array.isArray(lead?.purchase_options) ? lead.purchase_options : []);
    const [activeLeadPurchaseOptionTab, setActiveLeadPurchaseOptionTab] = useState('');
    const [activeLeadPurchaseOptionGroup, setActiveLeadPurchaseOptionGroup] = useState('pending');
    const [creditDetail, setCreditDetail] = useState(null);
    const [loadingCreditDetail, setLoadingCreditDetail] = useState(false);
    const [purchaseDetail, setPurchaseDetail] = useState(null);
    const [loadingPurchaseDetail, setLoadingPurchaseDetail] = useState(false);
    const [processingPurchaseDecision, setProcessingPurchaseDecision] = useState(false);
    const [editableLeadName, setEditableLeadName] = useState(lead?.name || '');
    const [editableLeadEmail, setEditableLeadEmail] = useState(lead?.email || '');
    const [editableLeadPhone, setEditableLeadPhone] = useState(lead?.phone || '');
    const [savingContactInfo, setSavingContactInfo] = useState(false);
    const supervisorSyncKey = JSON.stringify(getLeadSupervisorIds(lead));
    useEffect(() => {
        setActiveDetailTab('resumen');
        setActiveLeadPurchaseOptionTab('');
        setActiveLeadPurchaseOptionGroup('pending');
    }, [lead?.id]);

    useEffect(() => {
        setAssignedAdvisor(getLeadAssignedUserId(lead) || '');
        setSelectedSupervisors(getLeadSupervisorIds(lead));
        setIsSupervisionSelectorOpen(false);
        setEditableLeadName(lead?.name || '');
        setEditableLeadEmail(lead?.email || '');
        setEditableLeadPhone(lead?.phone || '');
        setNewStatus(normalizeLeadStatus(lead?.status || 'new'));
        setHasVehicle(typeof lead?.process_detail?.has_vehicle === 'boolean' ? lead.process_detail.has_vehicle : null);
        setSelectedVehicleId(lead?.process_detail?.vehicle_id || '');
        setDesiredVehicle(lead?.process_detail?.desired_vehicle || '');
        setReservationAmount(lead?.process_detail?.reservation_amount ? String(lead.process_detail.reservation_amount) : '');
        setReservationCreditUsedAmount(lead?.process_detail?.credit_used_amount ? String(lead.process_detail.credit_used_amount) : '');
        setReservationPaymentMethod(lead?.process_detail?.reservation_payment_method || '');
        setDeliveryDocumentsComplete(Boolean(lead?.process_detail?.delivery_documents_complete));
        setDeliveryRoadKit(Boolean(lead?.process_detail?.delivery_road_kit));
        setDeliveryBasicTools(Boolean(lead?.process_detail?.delivery_basic_tools));
        setDeliveryCreditDisbursement(Boolean(lead?.process_detail?.delivery_credit_disbursement));
        setDeliveryScheduledAt(lead?.process_detail?.delivery_scheduled_at || '');
        setDeliveryScheduledNote(lead?.process_detail?.delivery_scheduled_note || '');
    }, [lead?.id, lead?.assigned_to?.id, lead?.assigned_to_id, supervisorSyncKey]);

    useEffect(() => {
        if (lead && lead.id) {
            fetchMessages();
            setLeadNotes(lead.notes || []);
            setLeadFiles(lead.files || []);
            setPurchaseOptions(Array.isArray(lead.purchase_options) ? lead.purchase_options : []);
            fetchLeadAppointments();
            fetchCreditDetail();
            fetchPurchaseDetail();
        }
    }, [lead]);

    useEffect(() => {
        if (!Array.isArray(purchaseOptions) || purchaseOptions.length === 0) {
            setActiveLeadPurchaseOptionTab('');
            return;
        }
        const groupedOptions = {
            pending: purchaseOptions.filter((option) => (option?.decision_status || 'pending') === 'pending'),
            accepted: purchaseOptions.filter((option) => option?.decision_status === 'accepted'),
            rejected: purchaseOptions.filter((option) => option?.decision_status === 'rejected'),
        };

        setActiveLeadPurchaseOptionGroup((currentGroup) => {
            if (groupedOptions[currentGroup]?.length > 0) return currentGroup;
            if (groupedOptions.pending.length > 0) return 'pending';
            if (groupedOptions.accepted.length > 0) return 'accepted';
            if (groupedOptions.rejected.length > 0) return 'rejected';
            return 'pending';
        });
    }, [purchaseOptions]);

    useEffect(() => {
        const groupedOptions = {
            pending: purchaseOptions.filter((option) => (option?.decision_status || 'pending') === 'pending'),
            accepted: purchaseOptions.filter((option) => option?.decision_status === 'accepted'),
            rejected: purchaseOptions.filter((option) => option?.decision_status === 'rejected'),
        };
        const currentOptions = groupedOptions[activeLeadPurchaseOptionGroup] || [];
        if (currentOptions.length === 0) {
            setActiveLeadPurchaseOptionTab('');
            return;
        }
        const exists = currentOptions.some((option) => String(option.id) === String(activeLeadPurchaseOptionTab));
        if (!exists) {
            setActiveLeadPurchaseOptionTab(String(currentOptions[0].id));
        }
    }, [purchaseOptions, activeLeadPurchaseOptionGroup, activeLeadPurchaseOptionTab]);

    const fetchMessages = async () => {
        setLoadingMessages(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/leads/${lead.id}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Reverse so oldest is top, newest is bottom
            setMessages(Array.isArray(response.data) ? response.data.reverse() : []);
        } catch (error) {
            console.error("Error fetching lead messages", error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const fetchCreditDetail = async () => {
        if (!lead?.id) return;
        setLoadingCreditDetail(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/credits/by-lead/${lead.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCreditDetail(response.data || null);
        } catch (error) {
            console.error('Error fetching credit detail', error);
            setCreditDetail(null);
        } finally {
            setLoadingCreditDetail(false);
        }
    };

    const fetchPurchaseDetail = async () => {
        if (!lead?.id) return;
        setLoadingPurchaseDetail(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/purchases/by-lead/${lead.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data) {
                setPurchaseDetail(response.data || null);
                return;
            }

            const purchaseRequestId = lead?.purchase_request_id ? parseInt(lead.purchase_request_id, 10) : null;
            if (!purchaseRequestId) {
                setPurchaseDetail(null);
                return;
            }

            const fallback = await axios.get(`${API_BASE_URL}/purchases/${purchaseRequestId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPurchaseDetail(fallback.data || null);
        } catch (error) {
            console.error('Error fetching purchase detail', error);
            setPurchaseDetail(null);
        } finally {
            setLoadingPurchaseDetail(false);
        }
    };

    const fetchLeadAppointments = async () => {
        if (!lead?.id) return;
        setLoadingAppointments(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/appointments/leads/${lead.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLeadAppointments(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching lead appointments', error);
            setLeadAppointments([]);
        } finally {
            setLoadingAppointments(false);
        }
    };

    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }
        if (!replyMessage.trim()) return;

        // Ensure we have a conversation ID (from existing messages)
        const conversationId = messages.length > 0 ? messages[0].conversation_id : null;
        if (!conversationId && lead.source !== 'whatsapp') {
            Swal.fire('Atención', 'Este cliente aún no ha iniciado una conversación en Meta.', 'info');
            return;
        }

        setSendingReply(true);
        try {
            const token = localStorage.getItem('token');
            const source = lead.source?.toLowerCase();

            if (source === 'whatsapp') {
                // Determine Whatsapp Route
                await axios.post(`${API_BASE_URL}/whatsapp/send_message`, {
                    phone_number: lead.phone,
                    message_text: replyMessage
                }, { headers: { Authorization: `Bearer ${token}` } });

            } else if (source === 'facebook' || source === 'instagram') {
                // Determine Meta Route
                await axios.post(`${API_BASE_URL}/meta/conversations/${conversationId}/send`, {
                    conversation_id: conversationId,
                    sender_type: 'user',
                    content: replyMessage,
                    message_type: 'text'
                }, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                Swal.fire('Error', 'Este lead no proviene de una red social conectada.', 'error');
                setSendingReply(false);
                return;
            }

            setReplyMessage('');
            fetchMessages(); // Refresh chat
        } catch (error) {
            console.error("Error sending reply", error);
            Swal.fire('Error', 'No se pudo enviar el mensaje', 'error');
        } finally {
            setSendingReply(false);
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }
        if (!noteContent.trim()) return;
        setUploadingNote(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE_URL}/leads/${lead.id}/notes`, {
                content: noteContent
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLeadNotes([...leadNotes, res.data]);
            setNoteContent('');
            Swal.fire('Éxito', 'Nota agregada', 'success');
        } catch (error) {
            console.error("Error adding note", error);
            Swal.fire('Error', 'No se pudo agregar la nota', 'error');
        } finally {
            setUploadingNote(false);
        }
    };

    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }
        if (!selectedFiles || selectedFiles.length === 0) return;
        setUploadingFile(true);
        try {
            const token = localStorage.getItem('token');
            const newUploadedFiles = [];

            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                const res = await axios.post(`${API_BASE_URL}/leads/${lead.id}/files`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                newUploadedFiles.push(res.data);
            }

            setLeadFiles(prevFiles => [...prevFiles, ...newUploadedFiles]);
            setSelectedFiles([]);
            const fileInput = document.getElementById("file-upload-input");
            if (fileInput) fileInput.value = "";
            Swal.fire('Éxito', `${newUploadedFiles.length} Archivo(s) subido(s) correctamente`, 'success');
        } catch (error) {
            console.error("Error uploading file", error);
            Swal.fire('Error', 'No se pudieron subir los archivos', 'error');
        } finally {
            setUploadingFile(false);
        }
    };

    const handleDeleteLeadFile = async (fileToDelete) => {
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }
        const { value: reason } = await Swal.fire({
            title: 'Eliminar documento',
            input: 'textarea',
            inputLabel: 'Motivo de eliminación',
            inputPlaceholder: 'Escribe por qué se elimina este documento',
            inputAttributes: { 'aria-label': 'Motivo de eliminación' },
            showCancelButton: true,
            confirmButtonText: 'Eliminar documento',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Debes indicar el motivo de eliminación';
                }
                return null;
            }
        });

        if (!reason) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/leads/${lead.id}/files/${fileToDelete.id}`, {
                headers: { Authorization: `Bearer ${token}` },
                data: { reason: reason.trim() }
            });

            setLeadFiles((prevFiles) => prevFiles.filter((file) => file.id !== fileToDelete.id));
            setLeadNotes((prevNotes) => [
                ...prevNotes,
                {
                    id: `deleted-file-note-${fileToDelete.id}-${Date.now()}`,
                    content: `Se eliminó el documento '${fileToDelete.file_name}'. Motivo: ${reason.trim()}`,
                    created_at: new Date().toISOString(),
                    user_id: user?.id,
                    user: user || null,
                }
            ]);
            Swal.fire('Éxito', 'Documento eliminado correctamente', 'success');
        } catch (error) {
            console.error('Error deleting lead file', error);
            Swal.fire('Error', 'No se pudo eliminar el documento', 'error');
        }
    };

    if (!lead) return null;

    const formatLeadDate = (value) => {
        if (!value) return '';
        return formatBogotaDateTime(value);
    };

    const getCreditStatusLabel = (creditStatus) => {
        switch (creditStatus) {
            case 'pending': return 'Solicitud recibida';
            case 'in_review': return 'En estudio';
            case 'approved': return 'Aprobado';
            case 'rejected': return 'No viable';
            case 'completed': return 'Finalizado';
            default: return creditStatus || '';
        }
    };

    const getPurchaseRequestStatusLabel = (purchaseStatus) => {
        switch (purchaseStatus) {
            case 'pending': return 'Solicitud recibida';
            case 'in_review': return 'En búsqueda';
            case 'approved': return 'Opciones encontradas';
            case 'purchase_process': return 'Proceso de compra';
            case 'car_purchased': return 'Carro comprado';
            case 'rejected': return 'Solicitud rechazada';
            case 'completed': return 'Cerrado';
            default: return purchaseStatus || '';
        }
    };

    const hasManualCreationEntry = Array.isArray(lead.history) && lead.history.some((record) => {
        if (!record) return false;
        const normalizedComment = (record.comment || '').trim();
        const normalizedMessage = (lead.message || '').trim();
        return normalizedComment && normalizedMessage && normalizedComment === normalizedMessage && !record.previous_status;
    });

    const historyEntries = [
        ...(!hasManualCreationEntry && lead.message ? [{
            id: `initial-${lead.id}`,
            previous_status: null,
            new_status: lead.status || 'new',
            comment: lead.message,
            created_at: lead.created_at,
            user: lead.created_by || null,
            isInitialDescription: true
        }] : []),
        ...(Array.isArray(lead.history) ? lead.history : [])
    ];

    const normalizedPurchaseStatus = String(purchaseDetail?.status || lead?.purchase_request_status || '').trim().toLowerCase();

    const showPurchasedTabs = ['car_purchased', 'completed'].includes(normalizedPurchaseStatus)
        || ['preparation', 'sold'].includes(normalizeLeadStatus(lead?.status));

    const detailTabs = [
        { id: 'resumen', label: 'Resumen' },
        { id: 'credito', label: 'Crédito' },
        { id: 'compras', label: 'Compras' },
        ...(showPurchasedTabs ? [
            { id: 'carro-comprado', label: 'Carro comprado' },
            { id: 'entrega', label: 'Entrega' },
        ] : []),
        { id: 'gestion', label: 'Gestión' },
        { id: 'citas', label: 'Citas' },
        { id: 'conversacion', label: 'Conversación' },
        { id: 'historial', label: 'Historial' },
    ];

    const normalizedCurrentUserRole = normalizeRoleKey(user?.role) || normalizeRoleKey(currentUserRole);
    const canAssignToAnyRole = normalizedCurrentUserRole === 'admin' || normalizedCurrentUserRole === 'super_admin' || normalizedCurrentUserRole === 'aliado';
    const configuredAssignableRoleIds = getAssignableRoleIds(user?.role);
    const hasConfiguredAssignableRoles = configuredAssignableRoleIds.length > 0;
    const isCompanyAdmin = normalizedCurrentUserRole === 'admin' || normalizedCurrentUserRole === 'super_admin';
    const currentUserId = user?.id ? parseInt(user.id, 10) : null;
    const leadSupervisorIds = getLeadSupervisorIds(lead);
    const isAssignedLeadOwner = getLeadAssignedUserId(lead) === currentUserId;
    const isSupervisorOnlyViewer = !isCompanyAdmin && leadSupervisorIds.includes(currentUserId) && !isAssignedLeadOwner;
    const canModifyLead = !isSupervisorOnlyViewer;
    const canManageSupervision = isCompanyAdmin;
    const availableAssignableUsers = Array.isArray(advisors)
        ? advisors.filter((adv) => {
            if (!isUserActive(adv)) return false;
            const roleName = normalizeRoleKey(adv.role);
            if (canAssignToAnyRole && boardMode === 'ally') {
                return roleName !== 'user';
            }
            return canAssignToAnyRole || roleName === 'asesor';
        })
        : [];
    const assignableUsers = Array.isArray(availableAssignableUsers)
        ? (() => {
            if (!hasConfiguredAssignableRoles) return availableAssignableUsers;
            const configuredMatches = availableAssignableUsers.filter((adv) => {
                const advisorRoleId = parseUserId(adv?.role?.id);
                return advisorRoleId !== null && configuredAssignableRoleIds.includes(advisorRoleId);
            });
            return configuredMatches.length > 0 ? configuredMatches : availableAssignableUsers;
        })()
        : [];
    const supervisorOptions = Array.isArray(advisors)
        ? advisors.filter((adv) => isUserActive(adv) && normalizeRoleKey(adv.role) !== 'user')
        : [];
    const selectedSupervisorUsers = supervisorOptions.filter((person) => selectedSupervisors.includes(person.id));
    const headerLeadName = lead?.name || 'Sin cliente';
    const headerResponsibleName = lead?.assigned_to?.full_name || lead?.assigned_to?.email || 'Sin responsable';
    const supervisionSummary = selectedSupervisorUsers.length > 0
        ? `${selectedSupervisorUsers.length} supervisor(es) seleccionados`
        : 'Sin supervisores';
    const supervisionNames = selectedSupervisorUsers.length > 0
        ? selectedSupervisorUsers.map((person) => person.full_name || person.email).join(', ')
        : 'Aun no hay personas en supervision para este lead.';
    const leadDesiredVehicle = lead?.process_detail?.desired_vehicle?.trim() || '';
    const selectedInventoryVehicle = hasVehicle === true && selectedVehicleId
        ? availableVehicles?.find((vehicle) => String(vehicle.id) === String(selectedVehicleId))
        : null;
    const persistedInventoryVehicle = lead?.process_detail?.has_vehicle && lead?.process_detail?.vehicle_id
        ? availableVehicles?.find((vehicle) => String(vehicle.id) === String(lead.process_detail.vehicle_id))
        : null;
    const visibleVehicleText = selectedInventoryVehicle
        ? [selectedInventoryVehicle.make, selectedInventoryVehicle.model, selectedInventoryVehicle.year].filter(Boolean).join(' ')
        : persistedInventoryVehicle
            ? [persistedInventoryVehicle.make, persistedInventoryVehicle.model, persistedInventoryVehicle.year].filter(Boolean).join(' ')
            : leadDesiredVehicle;
    const vehicleTrackingLabel = lead?.process_detail?.has_vehicle ? 'Vehículo desde inventario' : 'Vehículo solicitado';
    const creditRelatedNotes = leadNotes.filter((note) => /cr[eé]dito|solicitud de cr[eé]dito|aprobado|viable|rechazado|en estudio/i.test(note?.content || ''));
    const purchaseRelatedNotes = leadNotes.filter((note) => /compra|veh[ií]culo|opci[oó]n|b[uú]squeda/i.test(note?.content || ''));
    const latestSalesApprovalNote = [...leadNotes]
        .reverse()
        .find((note) => extractSalesApprovalSummary(note?.content));
    const salesApprovalSummary = latestSalesApprovalNote
        ? extractSalesApprovalSummary(latestSalesApprovalNote.content)
        : null;
    const effectiveCreditDetail = creditDetail || (lead?.credit_application_status ? {
        status: lead.credit_application_status,
        desired_vehicle: visibleVehicleText || '',
        approved_amount: salesApprovalSummary?.approvedAmount ?? null,
        approval_percentage: salesApprovalSummary?.approvalPercentage ?? null,
        approved_down_payment: salesApprovalSummary?.minimumDownPayment ?? null,
        notes: latestSalesApprovalNote?.content || '',
        updated_at: lead.credit_application_updated_at || latestSalesApprovalNote?.created_at || null,
        assigned_to: null,
        monthly_income: null,
        other_income: null,
        occupation: null,
        application_mode: null,
    } : null);
    const creditSummarySource = [
        creditDetail?.notes || '',
        latestSalesApprovalNote?.content || '',
        ...creditRelatedNotes.map((note) => note?.content || ''),
    ].find((content) => extractApprovalMetrics(content)) || '';
    let approvalMetrics = extractApprovalMetrics(creditSummarySource) || {
        approvedAmount: effectiveCreditDetail?.approved_amount ?? salesApprovalSummary?.approvedAmount ?? null,
        approvalPercentage: effectiveCreditDetail?.approval_percentage ?? salesApprovalSummary?.approvalPercentage ?? null,
        minimumDownPayment: effectiveCreditDetail?.approved_down_payment ?? salesApprovalSummary?.minimumDownPayment ?? null,
    };
    if (approvalMetrics.minimumDownPayment == null && approvalMetrics.approvedAmount != null && approvalMetrics.approvalPercentage != null) {
        const calculatedMinimum = calculateMinimumDownPaymentFromApproval(approvalMetrics.approvedAmount, approvalMetrics.approvalPercentage);
        if (calculatedMinimum != null) {
            approvalMetrics = { ...approvalMetrics, minimumDownPayment: calculatedMinimum };
        }
    }
    const creditAssignedName = creditDetail?.assigned_to?.full_name || creditDetail?.assigned_to?.email || 'Sin responsable';
    const purchaseRequestId = purchaseDetail?.id || lead?.purchase_request_id || null;
    const purchaseAssignedToId = purchaseDetail?.assigned_to_id ?? purchaseDetail?.assigned_to?.id ?? null;
    const purchaseAssignedIsActive = purchaseDetail?.assigned_to ? purchaseDetail.assigned_to.is_active !== false : true;
    const purchaseAssignedName = (purchaseAssignedIsActive ? (purchaseDetail?.assigned_to?.full_name || purchaseDetail?.assigned_to?.email) : null)
        || (
            normalizedPurchaseStatus
                ? 'Sin asignar'
                : 'Sin responsable'
        );
    const canManagePurchaseRequest = (
        isCompanyAdminRole(currentUserRole) ||
        (
            normalizedCurrentUserRole === 'compras' &&
            purchaseAssignedToId != null &&
            currentUser?.id != null &&
            Number(purchaseAssignedToId) === Number(currentUser.id)
        )
    );
    const isAdvisorOrSellerRole = ['asesor', 'vendedor', 'asesor vendedor', 'aliado'].includes(normalizedCurrentUserRole);
    const canResubmitPurchaseRequest = (
        normalizedPurchaseStatus === 'rejected' &&
        (
            isCompanyAdmin ||
            (isAdvisorOrSellerRole && isAssignedLeadOwner)
        ) &&
        normalizedCurrentUserRole !== 'compras'
    );
    const reservationAmountValue = lead?.process_detail?.reservation_amount ?? null;
    const reservationCreditUsedAmountValue = lead?.process_detail?.credit_used_amount ?? null;
    const reservationPaymentMethodValue = lead?.process_detail?.reservation_payment_method || '';
    const creditUsedAmountValue = reservationCreditUsedAmountValue != null
        ? reservationCreditUsedAmountValue
        : (purchaseDetail?.credit_used_amount ?? null);
    const purchaseSummarySource = [
        purchaseDetail?.notes || '',
        lead?.purchase_request_notes || '',
        ...purchaseRelatedNotes.map((note) => note?.content || ''),
    ].filter(Boolean).join('\n');
    const purchaseRejectionReason = extractLatestPurchaseRejectionReason(purchaseSummarySource);
    const purchaseOptionGroups = {
        pending: purchaseOptions.filter((option) => (option?.decision_status || 'pending') === 'pending'),
        accepted: purchaseOptions.filter((option) => option?.decision_status === 'accepted'),
        rejected: purchaseOptions.filter((option) => option?.decision_status === 'rejected'),
    };
    const activeLeadPurchaseOptions = purchaseOptionGroups[activeLeadPurchaseOptionGroup] || [];
    const activeLeadPurchaseOption = activeLeadPurchaseOptions.find((option) => String(option.id) === String(activeLeadPurchaseOptionTab))
        || activeLeadPurchaseOptions[0]
        || null;
    const purchaseExpenses = Array.isArray(purchaseDetail?.purchase_expenses) ? purchaseDetail.purchase_expenses : [];
    const totalPurchaseExpenses = purchaseExpenses.reduce((sum, expense) => {
        const value = Number(expense?.amount || expense?.value || 0);
        return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    const vehicleSaleValue = Number(purchaseDetail?.purchase_sale_price || 0);
    const maxApprovedCredit = Number(approvalMetrics.approvedAmount || 0);
    const reservationValueNumber = Number(reservationAmountValue || 0);
    const approvedPercentage = Number(approvalMetrics.approvalPercentage || 0);
    const downPayment = Number(approvalMetrics.minimumDownPayment || 0);
    
    let creditDisbursementTotal = maxApprovedCredit;
    if (vehicleSaleValue > 0) {
        if (approvedPercentage > 0 && approvedPercentage <= 100) {
            creditDisbursementTotal = vehicleSaleValue * (approvedPercentage / 100);
            if (maxApprovedCredit > 0) {
                creditDisbursementTotal = Math.min(maxApprovedCredit, creditDisbursementTotal);
            }
        } else {
            const amountNeeded = Math.max(0, vehicleSaleValue - reservationValueNumber - downPayment);
            creditDisbursementTotal = Math.min(maxApprovedCredit, amountNeeded);
        }
    }
    
    const pendingPaymentValue = Math.max(0, vehicleSaleValue - creditDisbursementTotal - reservationValueNumber);

    const creditDisbursementPct = vehicleSaleValue > 0 ? ((creditDisbursementTotal / vehicleSaleValue) * 100).toFixed(1) : 0;
    const reservationPct = vehicleSaleValue > 0 ? ((reservationValueNumber / vehicleSaleValue) * 100).toFixed(1) : 0;
    const pendingPaymentPct = vehicleSaleValue > 0 ? ((pendingPaymentValue / vehicleSaleValue) * 100).toFixed(1) : 0;
    const deliveryChecklistComplete = [
        deliveryDocumentsComplete,
        deliveryRoadKit,
        deliveryBasicTools,
        deliveryCreditDisbursement,
    ].every(Boolean);

    useEffect(() => {
        if (!detailTabs.some((tab) => tab.id === activeDetailTab)) {
            setActiveDetailTab('resumen');
        }
    }, [activeDetailTab, detailTabs]);

    const showReadOnlyWarning = () => {
        Swal.fire('Solo lectura', 'Tienes este lead en supervisión. Puedes verlo, pero solo un administrador puede modificarlo.', 'info');
    };

    const buildCurrentProcessDetailPayload = (overrides = {}) => {
        const parsedReservationAmount = Number(String(reservationAmount || '').replace(/[^\d]/g, ''));
        const parsedCreditUsedAmount = Number(String(reservationCreditUsedAmount || '').replace(/[^\d]/g, ''));
        return {
            has_vehicle: typeof hasVehicle === 'boolean'
                ? hasVehicle
                : (typeof lead?.process_detail?.has_vehicle === 'boolean' ? lead.process_detail.has_vehicle : false),
            vehicle_id: selectedVehicleId ? parseInt(selectedVehicleId, 10) : (lead?.process_detail?.vehicle_id || null),
            desired_vehicle: desiredVehicle?.trim() || lead?.process_detail?.desired_vehicle || null,
            reservation_amount: Number.isFinite(parsedReservationAmount) && parsedReservationAmount > 0
                ? parsedReservationAmount
                : (lead?.process_detail?.reservation_amount ?? null),
            credit_used_amount: Number.isFinite(parsedCreditUsedAmount) && parsedCreditUsedAmount > 0
                ? parsedCreditUsedAmount
                : (lead?.process_detail?.credit_used_amount ?? null),
            reservation_payment_method: reservationPaymentMethod || lead?.process_detail?.reservation_payment_method || null,
            delivery_documents_complete: deliveryDocumentsComplete,
            delivery_road_kit: deliveryRoadKit,
            delivery_basic_tools: deliveryBasicTools,
            delivery_credit_disbursement: deliveryCreditDisbursement,
            delivery_scheduled_at: deliveryScheduledAt || null,
            delivery_scheduled_note: deliveryScheduledNote?.trim() || null,
            ...overrides,
        };
    };

    const handleSaveDeliveryChecklist = async () => {
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }
        setSavingDeliveryChecklist(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `${API_BASE_URL}/leads/${lead.id}`,
                {
                    status: normalizeLeadStatus(lead?.status),
                    comment: 'Checklist de entrega actualizado.',
                    process_detail: buildCurrentProcessDetailPayload(),
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await refreshLeadDetailSnapshot();
            Swal.fire('Éxito', 'El checklist de entrega fue actualizado.', 'success');
        } catch (error) {
            console.error('Error saving delivery checklist', error);
            Swal.fire('Error', error?.response?.data?.detail || 'No se pudo guardar el checklist de entrega.', 'error');
        } finally {
            setSavingDeliveryChecklist(false);
        }
    };

    const handleScheduleDelivery = async () => {
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }
        if (!deliveryChecklistComplete) {
            Swal.fire('Atención', 'Debes completar todo el checklist antes de agendar la entrega.', 'warning');
            return;
        }
        if (!deliveryScheduledAt) {
            Swal.fire('Atención', 'Debes seleccionar la fecha y hora de la entrega.', 'warning');
            return;
        }
        setSchedulingDelivery(true);
        try {
            await createAppointment(
                lead.id,
                deliveryScheduledAt,
                deliveryScheduledNote?.trim()
                    ? `Entrega de vehículo: ${deliveryScheduledNote.trim()}`
                    : 'Entrega de vehículo'
            );
            const token = localStorage.getItem('token');
            await axios.put(
                `${API_BASE_URL}/leads/${lead.id}`,
                {
                    status: normalizeLeadStatus(lead?.status),
                    comment: 'Entrega del vehículo agendada.',
                    process_detail: buildCurrentProcessDetailPayload({
                        delivery_scheduled_at: deliveryScheduledAt,
                        delivery_scheduled_note: deliveryScheduledNote?.trim() || null,
                    }),
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await fetchLeadAppointments();
            await refreshLeadDetailSnapshot();
            Swal.fire('Éxito', 'La entrega fue agendada correctamente.', 'success');
        } catch (error) {
            console.error('Error scheduling delivery', error);
            Swal.fire('Error', error?.response?.data?.detail || 'No se pudo agendar la entrega.', 'error');
        } finally {
            setSchedulingDelivery(false);
        }
    };

    const refreshLeadDetailSnapshot = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/leads/${lead.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const refreshedLead = normalizeLeadRecord(response.data);
            if (typeof onRefreshLeadBoard === 'function') {
                await onRefreshLeadBoard();
            }
            if (typeof onUpdateContact === 'function') {
                // no-op placeholder to keep modal callbacks untouched
            }
            return refreshedLead;
        } catch (error) {
            console.error('Error refreshing lead detail snapshot', error);
            return null;
        }
    };

    const handlePurchaseRequestDecision = async (decision) => {
        if (!purchaseRequestId || processingPurchaseDecision) return;
        const isResubmitDecision = decision === 'resubmit';
        if (isResubmitDecision && !canResubmitPurchaseRequest) {
            Swal.fire('Sin permisos', 'Solo el asesor responsable del lead o un administrador pueden volver a solicitar compras.', 'warning');
            return;
        }
        if (!isResubmitDecision && !canManagePurchaseRequest) {
            Swal.fire('Sin permisos', 'Solo el gestor de compras o un administrador pueden decidir esta solicitud.', 'warning');
            return;
        }

        let statusPayload = null;
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
            statusPayload = {
                status: 'in_review',
                status_note: 'Solicitud aceptada para iniciar la búsqueda del vehículo.'
            };
        } else if (decision === 'cancel') {
            const { value: rejectionReason } = await Swal.fire({
                title: 'Cancelar solicitud de compra',
                input: 'textarea',
                inputLabel: 'Motivo de cancelación',
                inputPlaceholder: 'Explica por qué se rechaza esta solicitud...',
                inputAttributes: { 'aria-label': 'Motivo de cancelación' },
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
            statusPayload = {
                status: 'rejected',
                status_note: rejectionReason.trim()
            };
        } else if (decision === 'resubmit') {
            const currentApprovedAmount = approvalMetrics?.approvedAmount ?? '';
            const currentApprovalPercentage = approvalMetrics?.approvalPercentage ?? '';
            const currentApprovedDownPayment = approvalMetrics?.minimumDownPayment ?? '';
            const currentCreditUsedAmount = reservationCreditUsedAmountValue ?? '';
            const { value: resubmitPayload } = await Swal.fire({
                title: 'Volver a solicitar búsqueda',
                html: `
                    <div style="display:grid; gap:12px; text-align:left;">
                        <div>
                            <label style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Vehículo solicitado</label>
                            <input id="swal-purchase-vehicle" class="swal2-input" style="margin:0; width:100%;" value="${(purchaseDetail?.desired_vehicle || visibleVehicleText || '').replace(/"/g, '&quot;')}" placeholder="Ej: Mazda 3 Touring" />
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Separación entregada</label>
                            <input id="swal-purchase-separation" type="number" min="0" class="swal2-input" style="margin:0; width:100%;" value="${reservationAmountValue ?? ''}" placeholder="Ej: 10000000" />
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Medio de pago</label>
                            <select id="swal-purchase-payment-method" class="swal2-select" style="margin:0; width:100%;">
                                <option value="">Selecciona una opción</option>
                                <option value="efectivo" ${reservationPaymentMethodValue === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                                <option value="transferencia" ${reservationPaymentMethodValue === 'transferencia' ? 'selected' : ''}>Transferencia</option>
                            </select>
                        </div>
                        <div style="margin-top:6px; padding-top:12px; border-top:1px solid #e2e8f0;">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px;">
                                <div style="font-size:12px; font-weight:800; color:#0f172a;">Datos del crédito</div>
                                <div style="font-size:11px; color:#64748b;">Puedes corregir aprobación, cuota y crédito a usar.</div>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                                <div>
                                    <label style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Monto aprobado</label>
                                    <input id="swal-credit-approved-amount" type="number" min="0" class="swal2-input" style="margin:0; width:100%;" value="${currentApprovedAmount}" placeholder="Ej: 70000000" />
                                </div>
                                <div>
                                    <label style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Porcentaje aprobado</label>
                                    <input id="swal-credit-approval-percentage" type="number" min="0" max="100" class="swal2-input" style="margin:0; width:100%;" value="${currentApprovalPercentage}" placeholder="Ej: 90" />
                                </div>
                                <div>
                                    <label style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Cuota inicial mínima</label>
                                    <input id="swal-credit-approved-down-payment" type="number" min="0" class="swal2-input" style="margin:0; width:100%;" value="${currentApprovedDownPayment}" placeholder="Ej: 7000000" />
                                    <div style="font-size:11px; color:#64748b; margin-top:4px;">Si la dejas vacía, se calcula con monto y porcentaje.</div>
                                </div>
                                <div>
                                    <label style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Crédito a usar</label>
                                    <input id="swal-credit-used-amount" type="number" min="0" class="swal2-input" style="margin:0; width:100%;" value="${currentCreditUsedAmount}" placeholder="Ej: 50000000" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">Motivo para volver a solicitar</label>
                            <textarea id="swal-purchase-resubmit-reason" class="swal2-textarea" style="margin:0; width:100%;" placeholder="Explica por qué se debe volver a solicitar la búsqueda..."></textarea>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Reenviar a compras',
                cancelButtonText: 'Volver',
                confirmButtonColor: '#2563eb',
                preConfirm: () => {
                    const desiredVehicleValue = document.getElementById('swal-purchase-vehicle')?.value?.trim() || '';
                    const reservationAmountRaw = document.getElementById('swal-purchase-separation')?.value?.trim() || '';
                    const reservationPaymentMethodValue = document.getElementById('swal-purchase-payment-method')?.value?.trim() || '';
                    const resubmitReasonValue = document.getElementById('swal-purchase-resubmit-reason')?.value?.trim() || '';
                    const approvedAmountRaw = document.getElementById('swal-credit-approved-amount')?.value?.trim() || '';
                    const approvalPercentageRaw = document.getElementById('swal-credit-approval-percentage')?.value?.trim() || '';
                    const approvedDownPaymentRaw = document.getElementById('swal-credit-approved-down-payment')?.value?.trim() || '';
                    const creditUsedAmountRaw = document.getElementById('swal-credit-used-amount')?.value?.trim() || '';

                    if (!desiredVehicleValue) {
                        Swal.showValidationMessage('Debes indicar el vehículo solicitado');
                        return false;
                    }
                    if (!reservationAmountRaw || Number(reservationAmountRaw) <= 0) {
                        Swal.showValidationMessage('Debes indicar el valor de la separación');
                        return false;
                    }
                    if (!reservationPaymentMethodValue) {
                        Swal.showValidationMessage('Debes indicar el medio de pago de la separación');
                        return false;
                    }
                    if (!resubmitReasonValue) {
                        Swal.showValidationMessage('Debes indicar el motivo para volver a solicitar');
                        return false;
                    }

                    const parsedApprovedAmount = approvedAmountRaw ? Number(approvedAmountRaw) : null;
                    const parsedApprovalPercentage = approvalPercentageRaw ? Number(approvalPercentageRaw) : null;
                    let parsedApprovedDownPayment = approvedDownPaymentRaw ? Number(approvedDownPaymentRaw) : null;
                    const parsedCreditUsedAmount = creditUsedAmountRaw ? Number(creditUsedAmountRaw) : null;

                    if (parsedApprovedAmount != null && (!Number.isFinite(parsedApprovedAmount) || parsedApprovedAmount < 0)) {
                        Swal.showValidationMessage('El monto aprobado debe ser un número válido');
                        return false;
                    }
                    if (parsedApprovalPercentage != null && (!Number.isFinite(parsedApprovalPercentage) || parsedApprovalPercentage < 0 || parsedApprovalPercentage > 100)) {
                        Swal.showValidationMessage('El porcentaje aprobado debe estar entre 0 y 100');
                        return false;
                    }
                    if (parsedApprovedDownPayment != null && (!Number.isFinite(parsedApprovedDownPayment) || parsedApprovedDownPayment < 0)) {
                        Swal.showValidationMessage('La cuota inicial mínima debe ser un número válido');
                        return false;
                    }
                    if (parsedCreditUsedAmount != null && (!Number.isFinite(parsedCreditUsedAmount) || parsedCreditUsedAmount < 0)) {
                        Swal.showValidationMessage('El crédito a usar debe ser un número válido');
                        return false;
                    }

                    // Auto-calculate minimum down payment if omitted but amount + percentage are provided.
                    if ((parsedApprovedDownPayment == null || parsedApprovedDownPayment === 0) && parsedApprovedAmount && parsedApprovalPercentage) {
                        const calculated = calculateMinimumDownPaymentFromApproval(parsedApprovedAmount, parsedApprovalPercentage);
                        if (calculated != null) parsedApprovedDownPayment = calculated;
                    }

                    return {
                        desired_vehicle: desiredVehicleValue,
                        reservation_amount: Number(reservationAmountRaw),
                        reservation_payment_method: reservationPaymentMethodValue,
                        reason: resubmitReasonValue,
                        approved_amount: parsedApprovedAmount,
                        approval_percentage: parsedApprovalPercentage,
                        approved_down_payment: parsedApprovedDownPayment,
                        credit_used_amount: parsedCreditUsedAmount,
                    };
                }
            });
            if (!resubmitPayload) return;
            statusPayload = {
                status: 'pending',
                status_note: `Solicitud reenviada por asesor. Motivo: ${resubmitPayload.reason}`,
                desired_vehicle: resubmitPayload.desired_vehicle,
                reservation_amount: resubmitPayload.reservation_amount,
                reservation_payment_method: resubmitPayload.reservation_payment_method,
                credit_used_amount: resubmitPayload.credit_used_amount,
                approved_amount: resubmitPayload.approved_amount,
                approval_percentage: resubmitPayload.approval_percentage,
                approved_down_payment: resubmitPayload.approved_down_payment,
            };
        } else {
            return;
        }

        setProcessingPurchaseDecision(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(
                `${API_BASE_URL}/purchases/${purchaseRequestId}`,
                statusPayload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (decision === 'resubmit') {
                // Keep lead and purchase request in sync for credit/reservation data.
                try {
                    await axios.put(
                        `${API_BASE_URL}/leads/${lead.id}`,
                        {
                            status: normalizeLeadStatus(lead?.status),
                            comment: 'Datos actualizados al reenviar solicitud de compra.',
                            process_detail: buildCurrentProcessDetailPayload({
                                desired_vehicle: statusPayload.desired_vehicle,
                                reservation_amount: statusPayload.reservation_amount,
                                reservation_payment_method: statusPayload.reservation_payment_method,
                                credit_used_amount: statusPayload.credit_used_amount ?? null,
                            }),
                            ...(statusPayload.approved_amount != null ? { approved_amount: statusPayload.approved_amount } : {}),
                            ...(statusPayload.approval_percentage != null ? { approval_percentage: statusPayload.approval_percentage } : {}),
                            ...(statusPayload.approved_down_payment != null ? { approved_down_payment: statusPayload.approved_down_payment } : {}),
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (leadSyncError) {
                    console.error('Error syncing lead after resubmit', leadSyncError);
                }
                if (statusPayload.desired_vehicle) {
                    setDesiredVehicle(statusPayload.desired_vehicle);
                }
                if (statusPayload.reservation_amount != null) {
                    setReservationAmount(String(statusPayload.reservation_amount));
                }
                if (statusPayload.credit_used_amount != null) {
                    setReservationCreditUsedAmount(String(statusPayload.credit_used_amount));
                }
                if (statusPayload.reservation_payment_method) {
                    setReservationPaymentMethod(statusPayload.reservation_payment_method);
                }
            }
            setPurchaseDetail(response.data || null);
            await fetchPurchaseDetail();
            await refreshLeadDetailSnapshot();
            Swal.fire(
                'Éxito',
                decision === 'accept'
                    ? 'La solicitud pasó a En búsqueda.'
                    : decision === 'cancel'
                        ? 'La solicitud fue cancelada correctamente.'
                        : 'La solicitud fue reenviada a compras.',
                'success'
            );
        } catch (error) {
            console.error('Error updating purchase request status', error);
            Swal.fire('Error', error?.response?.data?.detail || 'No se pudo actualizar la solicitud de compra.', 'error');
        } finally {
            setProcessingPurchaseDecision(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }

        // Si no es status 'interested', comprobamos el comment
        const adminCanSaveWithoutNote = currentUserRole === 'admin' || currentUserRole === 'super_admin';
        if (!adminCanSaveWithoutNote && !newComment.trim() && newStatus !== 'in_process' && newStatus === normalizeLeadStatus(lead?.status)) {
            Swal.fire('Error', 'Debes escribir una nota o comentario', 'warning');
            return;
        }

        if (newStatus === 'in_process') {
            if (hasVehicle === null) {
                Swal.fire('Atención', 'Debes indicar si el vehículo está disponible en inventario o si toca conseguirlo.', 'warning');
                return;
            }
            const desiredVehicleFallback = desiredVehicle.trim() || lead?.process_detail?.desired_vehicle?.trim() || lead?.message?.trim() || 'Por definir';
            if (!hasVehicle && !desiredVehicleFallback) {
                Swal.fire('Atención', 'Debes indicar qué vehículo busca el cliente.', 'warning');
                return;
            }
        }

        if (newStatus === 'reserved') {
            const parsedReservationAmount = Number(String(reservationAmount || '').replace(/[^\d]/g, ''));
            const parsedCreditUsedAmount = Number(String(reservationCreditUsedAmount || '').replace(/[^\d]/g, ''));
            const normalizedPaymentMethod = String(reservationPaymentMethod || '').trim().toLowerCase();
            if (!Number.isFinite(parsedReservationAmount) || parsedReservationAmount <= 0) {
                Swal.fire('Atención', 'Debes indicar el monto de la separación para pasar el lead a Reservas.', 'warning');
                return;
            }
            if (!['efectivo', 'transferencia'].includes(normalizedPaymentMethod)) {
                Swal.fire('Atención', 'Debes indicar si la separación fue en efectivo o transferencia.', 'warning');
                return;
            }
        }

        if (newStatus === 'sold') {
            if (!deliveryChecklistComplete) {
                Swal.fire('Atención', 'Debes completar todo el checklist de entrega antes de pasar el lead a Vendido.', 'warning');
                return;
            }
            if (!deliveryScheduledAt) {
                Swal.fire('Atención', 'Debes agendar la entrega antes de pasar el lead a Vendido.', 'warning');
                return;
            }
        }

        setLoading(true);
        try {
            let processDetail = null;
            if (newStatus === 'in_process') {
                const desiredVehicleFallback = desiredVehicle.trim() || lead?.process_detail?.desired_vehicle?.trim() || lead?.message?.trim() || 'Por definir';
                const shouldMoveToPurchaseSearch = hasVehicle === true && !selectedVehicleId;
                processDetail = {
                    has_vehicle: shouldMoveToPurchaseSearch ? false : hasVehicle,
                    vehicle_id: hasVehicle && selectedVehicleId ? parseInt(selectedVehicleId) : null,
                    desired_vehicle: (!hasVehicle || shouldMoveToPurchaseSearch) ? desiredVehicleFallback : null
                };
            } else if (newStatus === 'reserved') {
                const parsedCreditUsedAmount = Number(String(reservationCreditUsedAmount || '').replace(/[^\d]/g, ''));
                processDetail = {
                    has_vehicle: typeof lead?.process_detail?.has_vehicle === 'boolean' ? lead.process_detail.has_vehicle : false,
                    vehicle_id: lead?.process_detail?.vehicle_id || null,
                    desired_vehicle: lead?.process_detail?.desired_vehicle || desiredVehicle.trim() || lead?.message?.trim() || 'Por definir',
                    reservation_amount: Number(String(reservationAmount || '').replace(/[^\d]/g, '')),
                    credit_used_amount: Number.isFinite(parsedCreditUsedAmount) && parsedCreditUsedAmount > 0 ? parsedCreditUsedAmount : null,
                    reservation_payment_method: String(reservationPaymentMethod || '').trim().toLowerCase(),
                };
            } else if (newStatus === 'sold') {
                processDetail = buildCurrentProcessDetailPayload();
            }
            await onUpdate(lead.id, newStatus, newComment, processDetail, canManageSupervision ? selectedSupervisors : null);
            setNewComment('');
        } catch (error) {
            console.error("Update failed", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAppointment = async () => {
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }
        if (!reminderDate || !reminderNote) {
            Swal.fire('Error', 'Fecha y detalle de la cita son requeridos', 'warning');
            return;
        }
        await createAppointment(lead.id, reminderDate, reminderNote);
        setReminderDate('');
        setReminderNote('');
        await fetchLeadAppointments();
    };

    const handleSaveSupervisorSelection = async () => {
        if (!onSaveSupervisors) return;
        if (!canManageSupervision) {
            Swal.fire('Sin permisos', 'Solo un administrador puede agregar o quitar supervisores de un lead.', 'info');
            return;
        }
        setSavingSupervisors(true);
        try {
            await onSaveSupervisors(lead.id, selectedSupervisors);
        } catch (error) {
            console.error("Error saving supervisors", error);
        } finally {
            setSavingSupervisors(false);
        }
    };

    const handleRemoveSupervisor = (supervisorId) => {
        if (!canManageSupervision) return;
        setSelectedSupervisors((currentSupervisors) => currentSupervisors.filter((id) => id !== supervisorId));
    };

    const handleDeleteLead = async () => {
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }
        if (!onDeleteLead) return;

        const { value: reason } = await Swal.fire({
            title: 'Eliminar lead',
            input: 'textarea',
            inputLabel: 'Motivo obligatorio',
            inputPlaceholder: 'Explica por qué se elimina este lead del tablero',
            inputAttributes: { 'aria-label': 'Motivo obligatorio' },
            showCancelButton: true,
            confirmButtonText: 'Eliminar lead',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Debes indicar el motivo de eliminación';
                }
                return null;
            }
        });

        if (!reason) return;
        await onDeleteLead(lead.id, reason.trim());
        onClose();
    };

    const handleSaveContactInfo = async () => {
        if (!onUpdateContact || savingContactInfo) return;

        const normalizedName = (editableLeadName || '').trim();
        const normalizedEmail = (editableLeadEmail || '').trim();
        const normalizedPhone = (editableLeadPhone || '').trim();

        if (!normalizedName) {
            Swal.fire('Atención', 'El nombre del lead es obligatorio.', 'warning');
            return;
        }

        setSavingContactInfo(true);
        try {
            await onUpdateContact(lead.id, {
                name: normalizedName,
                email: normalizedEmail || null,
                phone: normalizedPhone || null,
                ...(canModifyLead ? { process_detail: buildCurrentProcessDetailPayload() } : {}),
            });
        } catch (error) {
            console.error('Error updating lead contact info', error);
        } finally {
            setSavingContactInfo(false);
        }
    };

    const handleCopyPurchaseOptionText = async (option) => {
        try {
            await navigator.clipboard.writeText(buildPurchaseOptionShareText(lead, option));
            Swal.fire('Exito', 'Texto copiado para compartir con el lead', 'success');
        } catch (error) {
            console.error('Error copying purchase option text', error);
            Swal.fire('Error', 'No se pudo copiar el texto de la opcion', 'error');
        }
    };

    const handleDownloadPurchaseOptionPhotos = (option) => {
        if (!Array.isArray(option?.photos) || option.photos.length === 0) {
            Swal.fire('Info', 'Esta opcion no tiene fotos para descargar', 'info');
            return;
        }

        option.photos.forEach((photo, index) => {
            const link = document.createElement('a');
            link.href = buildPublicStaticUrl(photo);
            link.download = `${option.title || 'opcion'}-${index + 1}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    const handlePurchaseOptionDecision = async (option, decisionStatus) => {
        if (!canModifyLead) {
            showReadOnlyWarning();
            return;
        }
        const isAccepted = decisionStatus === 'accepted';
        const { value: decisionNote } = await Swal.fire({
            title: isAccepted ? 'Aceptar opcion' : 'Rechazar opcion',
            input: 'textarea',
            inputLabel: 'Nota obligatoria',
            inputPlaceholder: isAccepted
                ? 'Explica por que esta opcion fue aceptada o que sigue con el cliente'
                : 'Explica por que esta opcion fue rechazada por el lead',
            inputAttributes: { 'aria-label': 'Nota obligatoria' },
            showCancelButton: true,
            confirmButtonText: isAccepted ? 'Aceptar opcion' : 'Rechazar opcion',
            cancelButtonText: 'Cancelar',
            buttonsStyling: false,
            customClass: {
                confirmButton: isAccepted
                    ? 'inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700'
                    : 'inline-flex items-center justify-center rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700',
                cancelButton: 'inline-flex items-center justify-center rounded-lg bg-slate-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 ml-3'
            },
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Debes escribir una nota para continuar';
                }
                return null;
            }
        });

        if (!decisionNote) return;

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
            setActiveLeadPurchaseOptionGroup(decisionStatus);
            setActiveLeadPurchaseOptionTab(String(updatedOption.id));
            setLeadNotes((prevNotes) => [
                ...prevNotes,
                {
                    id: `purchase-option-decision-${updatedOption.id}-${Date.now()}`,
                    content: `Se ${isAccepted ? 'acepto' : 'rechazo'} la opcion '${updatedOption.title}'. Nota: ${decisionNote.trim()}`,
                    created_at: new Date().toISOString(),
                    user_id: user?.id,
                    user: user || null,
                }
            ]);
            if (onRefreshLeadBoard) {
                await onRefreshLeadBoard();
            }
            Swal.fire('Exito', `La opcion fue ${isAccepted ? 'aceptada' : 'rechazada'} correctamente`, 'success');
        } catch (error) {
            console.error('Error updating purchase option decision', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo actualizar la opcion', 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl p-5 md:p-6 w-[min(97vw,1700px)] shadow-2xl animate-fade-in-up border border-gray-100 h-[96vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4 gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 className="text-xl font-bold text-gray-800">Detalles del Lead</h2>
                            <p className="text-sm font-semibold text-slate-600">
                                <span className="text-blue-600">{headerLeadName}</span>
                                <span className="mx-2 text-slate-400">-</span>
                                <span className="text-slate-500">Gestionado por</span>
                                <span className="ml-2 text-slate-700">{headerResponsibleName}</span>
                            </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {lead.source && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                                    {lead.source}
                                </span>
                            )}
                        </div>
                        {loadingDetail && (
                            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                                Cargando detalle completo del lead...
                            </div>
                        )}
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Datos del lead</p>
                                <button
                                    type="button"
                                    onClick={handleSaveContactInfo}
                                    disabled={savingContactInfo}
                                    className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {savingContactInfo ? 'Guardando...' : 'Guardar datos'}
                                </button>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Nombre</label>
                                    <input
                                        type="text"
                                        value={editableLeadName}
                                        onChange={(e) => setEditableLeadName(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Correo</label>
                                    <input
                                        type="email"
                                        value={editableLeadEmail}
                                        onChange={(e) => setEditableLeadEmail(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Teléfono</label>
                                    <input
                                        type="text"
                                        value={editableLeadPhone}
                                        onChange={(e) => setEditableLeadPhone(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Estado actual</label>
                                    <div className="flex h-[42px] items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                                        {getLeadStatusLabel(normalizeLeadStatus(lead.status))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 space-y-6">
                    {isSupervisorOnlyViewer && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Este lead está en modo solo lectura para ti por estar en supervisión. Solo un administrador puede modificarlo.
                        </div>
                    )}
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {detailTabs.map((tab) => {
                                const isActive = activeDetailTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveDetailTab(tab.id)}
                                        className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                                            isActive
                                                ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={handleDeleteLead}
                            disabled={!canModifyLead}
                            className="self-start rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 lg:self-auto"
                        >
                            Eliminar lead
                        </button>
                    </div>

                    {activeDetailTab === 'citas' && (
                        <div className="space-y-4">
                            <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                                <h3 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Programar Cita
                                </h3>
                                <div className="flex flex-col sm:flex-row gap-3 items-end">
                                    <div className="w-full sm:flex-1">
                                        <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Fecha y Hora</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                            value={reminderDate}
                                            onChange={(e) => setReminderDate(e.target.value)}
                                            disabled={!canModifyLead}
                                        />
                                    </div>
                                    <div className="w-full sm:flex-[2]">
                                        <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Detalle de la cita</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Cita en showroom, prueba de manejo, visita..."
                                            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                            value={reminderNote}
                                            onChange={(e) => setReminderNote(e.target.value)}
                                            disabled={!canModifyLead}
                                        />
                                    </div>
                                    <button
                                        onClick={handleCreateAppointment}
                                        disabled={!canModifyLead}
                                        className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Programar cita
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-bold text-slate-800">Historial de citas agendadas</h3>
                                    <span className="text-xs font-medium text-slate-400">{leadAppointments.length} cita(s)</span>
                                </div>
                                {loadingAppointments ? (
                                    <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                                        Cargando citas...
                                    </div>
                                ) : leadAppointments.length > 0 ? (
                                    <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                                        {leadAppointments.map((appointment) => (
                                            <div key={appointment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{appointment.title || 'Cita programada'}</p>
                                                        <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{appointment.note || 'Sin detalle adicional.'}</p>
                                                    </div>
                                                    <div className="flex flex-col items-start gap-1 md:items-end">
                                                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                                                            {appointment.status || 'scheduled'}
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-500">
                                                            {formatBogotaDateTime(appointment.appointment_date)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                                                    <span><strong className="text-slate-700">Lead:</strong> {appointment?.lead?.name || lead.name}</span>
                                                    <span><strong className="text-slate-700">Agendada por:</strong> {appointment?.user?.full_name || appointment?.user?.email || 'Sin registro'}</span>
                                                    <span><strong className="text-slate-700">Creada:</strong> {formatBogotaDateTime(appointment.created_at)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                                        Aún no hay citas programadas para este lead.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeDetailTab === 'gestion' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Agregar Nota / Actualizar Estado
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-1">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Estado</label>
                                    <select
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value)}
                                        disabled={!canModifyLead}
                                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        {LEAD_STATUS_OPTIONS.map((statusOption) => (
                                            <option key={statusOption.value} value={statusOption.value}>
                                                {statusOption.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nota / Comentario</label>
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        disabled={!canModifyLead}
                                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        rows="1"
                                        placeholder="Escribe detalles..."
                                    ></textarea>
                                </div>
                            </div>

                            {/* Process Detail conditional UI */}
                            {newStatus === 'in_process' && (
                                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 flex flex-col gap-3 animate-fade-in shadow-sm">
                                    <div>
                                        <p className="text-sm font-bold text-gray-700 mb-2">Disponibilidad del vehículo</p>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                disabled={!canModifyLead}
                                                onClick={() => {
                                                    setHasVehicle(true);
                                                    setDesiredVehicle('');
                                                }}
                                                className={`rounded-lg border px-3 py-2 text-sm font-semibold text-left transition ${hasVehicle === true ? 'border-orange-500 bg-white text-orange-700 shadow-sm' : 'border-orange-200 bg-orange-50 text-gray-600 hover:bg-white'} disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                Lo tenemos en inventario
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!canModifyLead}
                                                onClick={() => {
                                                    setHasVehicle(false);
                                                    setSelectedVehicleId('');
                                                }}
                                                className={`rounded-lg border px-3 py-2 text-sm font-semibold text-left transition ${hasVehicle === false ? 'border-orange-500 bg-white text-orange-700 shadow-sm' : 'border-orange-200 bg-orange-50 text-gray-600 hover:bg-white'} disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                Toca conseguirlo
                                            </button>
                                        </div>
                                        <p className="mt-2 text-xs text-gray-500">
                                            Debes escoger una opción para poder guardar este lead en En proceso.
                                        </p>
                                    </div>
                                    {hasVehicle === null ? (
                                        <div className="rounded-lg border border-dashed border-orange-200 bg-white/70 px-3 py-3 text-sm text-gray-500">
                                            Selecciona primero si el vehículo está en inventario o si debe entrar a búsqueda.
                                        </div>
                                    ) : hasVehicle === true ? (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Seleccionar Vehículo / Placa</label>
                                            <select
                                                className="w-full text-sm border border-orange-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500 bg-white shadow-inner"
                                                value={selectedVehicleId}
                                                disabled={!canModifyLead}
                                                onChange={(e) => setSelectedVehicleId(e.target.value)}
                                            >
                                                <option value="">-- Buscar Auto Disponible --</option>
                                                {availableVehicles?.map(v => (
                                                    <option key={v.id} value={v.id}>{v.make} {v.model} - Placa: {v.plate}</option>
                                                ))}
                                            </select>
                                            <p className="mt-2 text-xs text-gray-500">
                                                Si no seleccionas un carro del inventario, el lead pasará automáticamente a solicitud de búsqueda.
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Vehículo de Interés que Busca (Texto Libre)</label>
                                            <input
                                                type="text"
                                                className="w-full text-sm border border-orange-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500 bg-white shadow-inner"
                                                value={desiredVehicle}
                                                disabled={!canModifyLead}
                                                onChange={(e) => setDesiredVehicle(e.target.value)}
                                                placeholder="Ej: Toyota Hilux 2020 Color Blanco..."
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SECCIÓN DE NOTAS MÚLTIPLES - Siempre visible */}
                            <div className="mt-4 border-t border-gray-200 pt-3">
                                <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">Notas del Proceso</h4>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                        placeholder="Agregar una nueva nota..."
                                        value={noteContent}
                                        onChange={(e) => setNoteContent(e.target.value)}
                                        disabled={!canModifyLead}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddNote}
                                        disabled={uploadingNote || !noteContent.trim() || !canModifyLead}
                                        className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-50"
                                    >
                                        {uploadingNote ? 'Guardando...' : 'Agregar'}
                                    </button>
                                </div>
                                {/* Lista de notas */}
                                {leadNotes.length > 0 && (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {leadNotes.map((note) => (
                                              <div key={note.id} className="bg-white p-2 rounded border border-gray-100 shadow-sm text-sm">
                                                  <p className="text-[11px] font-semibold text-slate-500">
                                                      {note.user?.full_name || note.user?.email || 'Usuario'}
                                                  </p>
                                                  <p className="text-gray-800">{note.content}</p>
                                                  <span className="text-[10px] text-gray-400">
                                                      {formatBogotaDateTime(note.created_at)}
                                                  </span>
                                              </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* SECCIÓN DE ARCHIVOS */}
                            <div className="mt-4 border-t border-gray-200 pt-3">
                                <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">Archivos Adjuntos / Documentos</h4>
                                <div className="flex gap-2 mb-3 items-center">
                                    <input
                                        id="file-upload-input"
                                        type="file"
                                        multiple
                                        accept="*"
                                        className="flex-1 text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
                                        disabled={!canModifyLead}
                                        onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleFileUpload}
                                        disabled={uploadingFile || selectedFiles.length === 0 || !canModifyLead}
                                        className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-50"
                                    >
                                        {uploadingFile ? 'Subiendo...' : `Subir ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
                                    </button>
                                </div>
                                {/* Lista de archivos */}
                                {leadFiles.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {leadFiles.map((file) => (
                                            <div key={file.id} className="bg-white p-2 rounded border border-gray-200 shadow-sm flex flex-col gap-2">
                                                    <a href={`${API_BASE_URL}${file.file_path}`} target="_blank" rel="noopener noreferrer" className="hover:border-orange-500 transition flex flex-col items-center gap-1 group">
                                                    {file.file_type && file.file_type.includes('image') ? (
                                                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                                                            <img src={`${API_BASE_URL}${file.file_path}`} alt="File" className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <svg className="w-8 h-8 text-gray-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                    )}
                                                    <span className="text-[10px] text-gray-600 truncate w-full text-center">{file.file_name}</span>
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteLeadFile(file)}
                                                    disabled={!canModifyLead}
                                                    className="w-full rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !canModifyLead}
                                className="w-full bg-blue-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Guardando...' : 'Guardar Nota y Actualizar'}
                            </button>
                        </form>
                    </div>
                    )}

                    {activeDetailTab === 'resumen' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Estado actual</p>
                                    {lead.updated_at && (
                                        <span className="text-[11px] font-medium text-slate-400">
                                            Actualizado: {formatLeadDate(lead.updated_at)}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                                        {getLeadStatusLabel(lead.status)}
                                    </span>
                                    {lead.credit_application_status && (
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                                            Crédito: {getCreditStatusLabel(lead.credit_application_status)}
                                        </span>
                                    )}
                                </div>
                                {visibleVehicleText && (
                                    <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                        <span className="font-semibold">{vehicleTrackingLabel}:</span> {visibleVehicleText}
                                    </div>
                                )}
                            </div>

                            {salesApprovalSummary && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Resumen para ventas</p>
                                            <p className="mt-1 text-sm text-emerald-900">
                                                Aprobación lista para que ventas continúe el proceso sin buscar la nota manualmente.
                                            </p>
                                        </div>
                                        {latestSalesApprovalNote?.created_at && (
                                            <span className="text-[11px] font-medium text-emerald-700/80">
                                                Registrado: {formatLeadDate(latestSalesApprovalNote.created_at)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Vehículo</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                {salesApprovalSummary.vehicle || visibleVehicleText || 'Sin definir'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Monto aprobado</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                {formatLeadCurrencyValue(salesApprovalSummary.approvedAmount)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Porcentaje aprobado</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                {salesApprovalSummary.approvalPercentage != null ? `${salesApprovalSummary.approvalPercentage}%` : 'Sin definir'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Cuota inicial mínima</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                {formatLeadCurrencyValue(salesApprovalSummary.minimumDownPayment)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {newStatus === 'reserved' && (
                                <div className="p-3 bg-violet-50 rounded-lg border border-violet-100 flex flex-col gap-3 animate-fade-in shadow-sm">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Monto de la separación</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={reservationAmount}
                                                disabled={!canModifyLead}
                                                onChange={(e) => setReservationAmount(e.target.value.replace(/[^\d]/g, ''))}
                                                className="w-full text-sm border border-violet-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 bg-white shadow-inner"
                                                placeholder="Ej: 2000000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Monto del crÃ©dito a usar</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={reservationCreditUsedAmount}
                                                disabled={!canModifyLead}
                                                onChange={(e) => setReservationCreditUsedAmount(e.target.value.replace(/[^\d]/g, ''))}
                                                className="w-full text-sm border border-violet-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 bg-white shadow-inner"
                                                placeholder="Ej: 25000000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Medio de pago</label>
                                            <select
                                                value={reservationPaymentMethod}
                                                disabled={!canModifyLead}
                                                onChange={(e) => setReservationPaymentMethod(e.target.value)}
                                                className="w-full text-sm border border-violet-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 bg-white shadow-inner"
                                            >
                                                <option value="">Selecciona una opción</option>
                                                <option value="efectivo">Efectivo</option>
                                                <option value="transferencia">Transferencia</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Sin estos datos no se puede mover el lead a Reservas ni enviarlo a búsqueda en compras.
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 xl:grid-cols-[420px,minmax(0,1fr)] gap-4">
                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Asignado a</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-blue-500 outline-none font-semibold text-indigo-600"
                                        value={assignedAdvisor}
                                        disabled={!canModifyLead}
                                        onChange={(e) => {
                                            if (!canModifyLead) return;
                                            setAssignedAdvisor(e.target.value);
                                            if (onAssign) onAssign(lead.id, e.target.value, canManageSupervision ? selectedSupervisors : null);
                                        }}
                                    >
                                        <option value="">Sin asignar</option>
                                        {assignableUsers.map(adv => (
                                            <option key={adv.id} value={adv.id}>
                                                {adv.full_name || adv.email} - {getDisplayRoleName(adv.role)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Supervision del lead</p>
                                        <span className="text-[11px] text-slate-400">{selectedSupervisors.length} persona(s)</span>
                                    </div>
                                    <div className="relative mt-2">
                                        <button
                                            type="button"
                                            disabled={!canManageSupervision}
                                            onClick={() => {
                                                if (!canManageSupervision) return;
                                                setIsSupervisionSelectorOpen((prev) => !prev);
                                            }}
                                            className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-indigo-600">{supervisionSummary}</p>
                                                <p className="truncate text-xs text-slate-500">{supervisionNames}</p>
                                            </div>
                                            <svg className={`ml-3 h-4 w-4 shrink-0 text-slate-500 transition-transform ${isSupervisionSelectorOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {isSupervisionSelectorOpen && canManageSupervision && (
                                            <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                                                    {supervisorOptions.map((person) => {
                                                        const personId = Number(person.id);
                                                        const isSelected = selectedSupervisors.includes(personId);
                                                        return (
                                                            <label
                                                                key={person.id}
                                                                className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm transition ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => {
                                                                        setSelectedSupervisors((currentSupervisors) => (
                                                                            isSelected
                                                                                ? currentSupervisors.filter((id) => id !== personId)
                                                                                : [...currentSupervisors, personId]
                                                                        ));
                                                                    }}
                                                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="min-w-0">
                                                                    <span className="block truncate font-semibold text-slate-700">
                                                                        {person.full_name || person.email}
                                                                    </span>
                                                                    <span className="block truncate text-xs text-slate-500">
                                                                        {getDisplayRoleName(person.role)}
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsSupervisionSelectorOpen(false)}
                                                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
                                                    >
                                                        Listo
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 flex flex-col gap-3">
                                        <p className="text-xs text-slate-500">
                                            {canManageSupervision
                                                ? 'Selecciona las personas desde el selector compacto y luego guarda la supervision.'
                                                : 'Solo un administrador puede agregar o quitar personas en supervisión.'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleSaveSupervisorSelection}
                                            disabled={savingSupervisors || !canManageSupervision}
                                            className="self-start rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {savingSupervisors ? 'Guardando...' : 'Guardar supervision'}
                                        </button>
                                    </div>
                                    {selectedSupervisorUsers.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {selectedSupervisorUsers.map((person) => (
                                                <span key={person.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200">
                                                    <span>{person.full_name || person.email}</span>
                                                    {canManageSupervision && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSupervisor(person.id)}
                                                            className="rounded-full px-1 text-[10px] leading-none text-blue-700 transition hover:bg-blue-100"
                                                            aria-label={`Quitar a ${person.full_name || person.email} de supervision`}
                                                        >
                                                            x
                                                        </button>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <h3 className="text-sm font-bold text-gray-700 mb-3">Archivos adjuntos / documentos</h3>
                                    <div className="flex gap-2 mb-3 items-center">
                                        <input
                                            id="file-upload-input"
                                            type="file"
                                            multiple
                                            accept="*"
                                            className="flex-1 text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
                                            disabled={!canModifyLead}
                                            onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleFileUpload}
                                            disabled={uploadingFile || selectedFiles.length === 0 || !canModifyLead}
                                            className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-50"
                                        >
                                            {uploadingFile ? 'Subiendo...' : `Subir ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
                                        </button>
                                    </div>
                                    {leadFiles.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                                            {leadFiles.map((file) => (
                                                <div key={file.id} className="bg-white p-2 rounded border border-gray-200 shadow-sm flex flex-col gap-2">
                                                    <a href={`${API_BASE_URL}${file.file_path}`} target="_blank" rel="noopener noreferrer" className="hover:border-orange-500 transition flex flex-col items-center gap-1 group">
                                                        {file.file_type && file.file_type.includes('image') ? (
                                                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                                                                <img src={`${API_BASE_URL}${file.file_path}`} alt="File" className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <svg className="w-8 h-8 text-gray-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                        )}
                                                        <span className="text-[10px] text-gray-600 truncate w-full text-center">{file.file_name}</span>
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteLeadFile(file)}
                                                        disabled={!canModifyLead}
                                                        className="w-full rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                                            No hay documentos cargados para este lead.
                                        </div>
                                    )}
                                </div>

                            </div>
                            </div>
                        </div>
                    )}

                    {activeDetailTab === 'credito' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-emerald-700">Monto aprobado</p>
                                        <p className="mt-2 text-3xl font-bold text-emerald-950">
                                            {approvalMetrics.approvedAmount != null ? formatLeadCurrencyValue(approvalMetrics.approvedAmount) : 'Sin definir'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-sky-700">Porcentaje aprobado</p>
                                        <p className="mt-2 text-3xl font-bold text-sky-950">
                                            {approvalMetrics.approvalPercentage != null ? `${approvalMetrics.approvalPercentage}%` : 'Sin definir'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-amber-700">Cuota inicial mínima</p>
                                        <p className="mt-2 text-3xl font-bold text-amber-950">
                                            {approvalMetrics.minimumDownPayment != null ? formatLeadCurrencyValue(approvalMetrics.minimumDownPayment) : 'Sin definir'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeDetailTab === 'compras' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Información de compras</p>
                                        <p className="mt-1 text-sm text-slate-600">Resumen claro del caso para compras y decisión inicial de la solicitud.</p>
                                    </div>
                                    {loadingPurchaseDetail && (
                                        <span className="text-xs font-medium text-slate-400">Cargando...</span>
                                    )}
                                </div>
                                {(purchaseDetail || normalizedPurchaseStatus || purchaseRelatedNotes.length > 0 || lead?.purchase_request_notes) ? (
                                    <>
                                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                                            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 shadow-sm">
                                                <p className="text-sm font-medium text-cyan-700">Vehículo solicitado</p>
                                                <p className="mt-2 text-2xl font-bold text-cyan-950 break-words">
                                                    {purchaseDetail?.desired_vehicle || visibleVehicleText || 'Sin definir'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
                                                <p className="text-sm font-medium text-emerald-700">Monto aprobado</p>
                                                <p className="mt-2 text-2xl font-bold text-emerald-950">
                                                    {approvalMetrics.approvedAmount != null ? formatLeadCurrencyValue(approvalMetrics.approvedAmount) : 'Sin definir'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 shadow-sm">
                                                <p className="text-sm font-medium text-indigo-700">Crédito a usar</p>
                                                <p className="mt-2 text-2xl font-bold text-indigo-950">
                                                    {creditUsedAmountValue != null ? formatLeadCurrencyValue(creditUsedAmountValue) : 'Sin definir'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
                                                <p className="text-sm font-medium text-amber-700">Pago mínimo</p>
                                                <p className="mt-2 text-2xl font-bold text-amber-950">
                                                    {approvalMetrics.minimumDownPayment != null ? formatLeadCurrencyValue(approvalMetrics.minimumDownPayment) : 'Sin definir'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 shadow-sm">
                                                <p className="text-sm font-medium text-violet-700">Separación</p>
                                                <p className="mt-2 text-2xl font-bold text-violet-950">
                                                    {reservationAmountValue != null ? formatLeadCurrencyValue(reservationAmountValue) : 'Sin definir'}
                                                </p>
                                                {reservationPaymentMethodValue && (
                                                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
                                                        {reservationPaymentMethodValue}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {normalizedPurchaseStatus && (
                                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Estado de la solicitud</p>
                                                        <p className="mt-1 text-sm font-semibold text-slate-800">{getPurchaseRequestStatusLabel(normalizedPurchaseStatus)}</p>
                                                        <p className="mt-1 text-xs text-slate-500">Responsable: {purchaseAssignedName}</p>
                                                    </div>
                                                    {normalizedPurchaseStatus === 'pending' && canManagePurchaseRequest && (
                                                        <div className="flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePurchaseRequestDecision('accept')}
                                                                disabled={processingPurchaseDecision}
                                                                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                                            >
                                                                {processingPurchaseDecision ? 'Procesando...' : 'Aceptar'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePurchaseRequestDecision('cancel')}
                                                                disabled={processingPurchaseDecision}
                                                                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                                                            >
                                                                {processingPurchaseDecision ? 'Procesando...' : 'Cancelar'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {normalizedPurchaseStatus === 'rejected' && (
                                                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                                                        <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">Solicitud cancelada</p>
                                                        <p className="mt-1 text-sm text-rose-900">
                                                            {purchaseRejectionReason || 'Compras canceló esta solicitud sin dejar un motivo visible.'}
                                                        </p>
                                                        {canResubmitPurchaseRequest && (
                                                            <div className="mt-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePurchaseRequestDecision('resubmit')}
                                                                    disabled={processingPurchaseDecision}
                                                                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                                                >
                                                                    {processingPurchaseDecision ? 'Procesando...' : 'Volver a solicitar'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Opciones encontradas</p>
                                                <span className="text-xs font-semibold text-slate-400">{purchaseOptions.length} opción(es)</span>
                                            </div>
                                            {purchaseOptions.length > 0 ? (
                                                <div className="mt-4 space-y-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            { id: 'pending', label: 'Opciones', count: purchaseOptionGroups.pending.length },
                                                            { id: 'accepted', label: 'Aceptadas', count: purchaseOptionGroups.accepted.length },
                                                            { id: 'rejected', label: 'Rechazadas', count: purchaseOptionGroups.rejected.length },
                                                        ].map((group) => {
                                                            const isActive = activeLeadPurchaseOptionGroup === group.id;
                                                            return (
                                                                <button
                                                                    key={group.id}
                                                                    type="button"
                                                                    onClick={() => setActiveLeadPurchaseOptionGroup(group.id)}
                                                                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                                                                        isActive
                                                                            ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                                    }`}
                                                                >
                                                                    {group.label} <span className="ml-1 text-xs opacity-70">({group.count})</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {activeLeadPurchaseOptions.map((option, index) => {
                                                            const isActive = String(option.id) === String(activeLeadPurchaseOptionTab);
                                                            return (
                                                                <button
                                                                    key={option.id || index}
                                                                    type="button"
                                                                    onClick={() => setActiveLeadPurchaseOptionTab(String(option.id))}
                                                                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                                                                        isActive
                                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm'
                                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                                    }`}
                                                                >
                                                                    {option.title || `Opción ${index + 1}`}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {activeLeadPurchaseOption && (
                                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <h4 className="text-sm font-bold text-slate-800">
                                                                        {activeLeadPurchaseOption.title || 'Opción'}
                                                                    </h4>
                                                                    {activeLeadPurchaseOption.description && (
                                                                        <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">
                                                                            {activeLeadPurchaseOption.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] text-slate-400">
                                                                    {activeLeadPurchaseOption.created_at
                                                                        ? formatBogotaDateTime(activeLeadPurchaseOption.created_at, { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                                        : 'Reciente'}
                                                                </span>
                                                            </div>

                                                            {Array.isArray(activeLeadPurchaseOption.photos) && activeLeadPurchaseOption.photos.length > 0 && (
                                                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                                    {activeLeadPurchaseOption.photos.map((photo, photoIndex) => (
                                                                        <a
                                                                            key={`${activeLeadPurchaseOption.id || activeLeadPurchaseOptionTab}-${photoIndex}`}
                                                                            href={buildPublicStaticUrl(photo)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                                                                        >
                                                                            <img
                                                                                src={buildPublicStaticUrl(photo)}
                                                                                alt={activeLeadPurchaseOption.title || 'Opción'}
                                                                                className="h-44 w-full object-cover"
                                                                            />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${getPurchaseOptionDecisionMeta(activeLeadPurchaseOption.decision_status).className}`}>
                                                                    {getPurchaseOptionDecisionMeta(activeLeadPurchaseOption.decision_status).label}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopyPurchaseOptionText(activeLeadPurchaseOption)}
                                                                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                                                                >
                                                                    Copiar texto
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDownloadPurchaseOptionPhotos(activeLeadPurchaseOption)}
                                                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                                                >
                                                                    Descargar fotos
                                                                </button>
                                                                {canModifyLead && (!activeLeadPurchaseOption.decision_status || activeLeadPurchaseOption.decision_status === 'pending') && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handlePurchaseOptionDecision(activeLeadPurchaseOption, 'accepted')}
                                                                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                                                                        >
                                                                            Aceptar opción
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handlePurchaseOptionDecision(activeLeadPurchaseOption, 'rejected')}
                                                                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700"
                                                                        >
                                                                            Rechazar opción
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {activeLeadPurchaseOptions.length === 0 && (
                                                        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                                            No hay opciones en esta categoría.
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="mt-3 text-sm text-slate-500">Aún no hay opciones registradas para esta solicitud de compra.</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                                        Este lead todavía no tiene información relacionada en compras.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeDetailTab === 'carro-comprado' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Carro comprado</p>
                                        <p className="mt-1 text-sm text-slate-600">Datos finales del vehículo que compras consiguió para este lead.</p>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-cyan-700">Carro comprado</p>
                                        <p className="mt-2 text-2xl font-bold text-cyan-950 break-words">
                                            {[purchaseDetail?.purchase_vehicle_name, purchaseDetail?.purchase_vehicle_model, purchaseDetail?.purchase_vehicle_year].filter(Boolean).join(' ') || 'Sin definir'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-slate-600">Placa</p>
                                        <p className="mt-2 text-2xl font-bold text-slate-900">{purchaseDetail?.purchase_vehicle_plate || 'Sin definir'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-slate-600">Kilometraje</p>
                                        <p className="mt-2 text-2xl font-bold text-slate-900">{purchaseDetail?.purchase_vehicle_mileage ?? 'Sin definir'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-slate-600">Ubicación</p>
                                        <p className="mt-2 text-2xl font-bold text-slate-900 break-words">{purchaseDetail?.purchase_vehicle_location || 'Sin definir'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-emerald-700">Valor de compra</p>
                                        <p className="mt-2 text-2xl font-bold text-emerald-950">{purchaseDetail?.purchase_price != null ? formatLeadCurrencyValue(purchaseDetail.purchase_price) : 'Sin definir'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-indigo-700">Valor de venta</p>
                                        <p className="mt-2 text-2xl font-bold text-indigo-950">{purchaseDetail?.purchase_sale_price != null ? formatLeadCurrencyValue(purchaseDetail.purchase_sale_price) : 'Sin definir'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-amber-700">Total gastos</p>
                                        <p className="mt-2 text-2xl font-bold text-amber-950">{formatLeadCurrencyValue(totalPurchaseExpenses)}</p>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Gastos registrados</p>
                                    {purchaseExpenses.length > 0 ? (
                                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                            {purchaseExpenses.map((expense, index) => (
                                                <div key={`${expense?.expense_type || 'expense'}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                    <p className="text-sm font-bold text-slate-800">{expense?.expense_type || 'Gasto'}</p>
                                                    <p className="mt-1 text-lg font-semibold text-slate-900">{formatLeadCurrencyValue(expense?.amount || expense?.value || 0)}</p>
                                                    {expense?.notes && (
                                                        <p className="mt-1 text-sm text-slate-600">{expense.notes}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-sm text-slate-500">Aún no hay gastos registrados para esta compra.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeDetailTab === 'entrega' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Checklist de entrega</p>
                                    <p className="mt-1 text-sm text-slate-600">El vendedor debe completar este checklist antes de agendar la entrega o pasar el lead a vendido.</p>
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-indigo-700">Venta del vehículo</p>
                                        <p className="mt-2 text-2xl font-bold text-indigo-950">
                                            {vehicleSaleValue > 0 ? formatLeadCurrencyValue(vehicleSaleValue) : 'Sin definir'}
                                            {vehicleSaleValue > 0 && <span className="text-sm font-medium ml-2 text-indigo-700">(100%)</span>}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-emerald-700">Total desembolso</p>
                                        <p className="mt-2 text-2xl font-bold text-emerald-950">
                                            {creditDisbursementTotal > 0 ? formatLeadCurrencyValue(creditDisbursementTotal) : 'Sin definir'}
                                            {vehicleSaleValue > 0 && creditDisbursementTotal > 0 && <span className="text-sm font-medium ml-2 text-emerald-700">({creditDisbursementPct}%)</span>}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-violet-700">Separación</p>
                                        <p className="mt-2 text-2xl font-bold text-violet-950">
                                            {reservationValueNumber > 0 ? formatLeadCurrencyValue(reservationValueNumber) : 'Sin definir'}
                                            {vehicleSaleValue > 0 && reservationValueNumber > 0 && <span className="text-sm font-medium ml-2 text-violet-700">({reservationPct}%)</span>}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
                                        <p className="text-sm font-medium text-amber-700">Pago faltante</p>
                                        <p className="mt-2 text-2xl font-bold text-amber-950">
                                            {formatLeadCurrencyValue(pendingPaymentValue)}
                                            {vehicleSaleValue > 0 && pendingPaymentValue > 0 && <span className="text-sm font-medium ml-2 text-amber-700">({pendingPaymentPct}%)</span>}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                                            <input type="checkbox" checked={deliveryDocumentsComplete} onChange={(e) => setDeliveryDocumentsComplete(e.target.checked)} disabled={!isCompanyAdmin} />
                                            <span className="text-sm font-medium text-slate-700">Carpeta con documentos completos</span>
                                        </label>
                                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                                            <input type="checkbox" checked={deliveryRoadKit} onChange={(e) => setDeliveryRoadKit(e.target.checked)} disabled={!canModifyLead} />
                                            <span className="text-sm font-medium text-slate-700">Kit de carretera</span>
                                        </label>
                                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                                            <input type="checkbox" checked={deliveryBasicTools} onChange={(e) => setDeliveryBasicTools(e.target.checked)} disabled={!canModifyLead} />
                                            <span className="text-sm font-medium text-slate-700">Herramientas básicas</span>
                                        </label>
                                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                                            <input type="checkbox" checked={deliveryCreditDisbursement} onChange={(e) => setDeliveryCreditDisbursement(e.target.checked)} disabled={!isCompanyAdmin} />
                                            <span className="text-sm font-medium text-slate-700">Desembolso de crédito</span>
                                        </label>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={handleSaveDeliveryChecklist}
                                            disabled={!canModifyLead || savingDeliveryChecklist}
                                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {savingDeliveryChecklist ? 'Guardando...' : 'Guardar checklist'}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Entrega del vehículo</p>
                                    {deliveryChecklistComplete ? (
                                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                            <div className="md:col-span-1">
                                                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Fecha y hora</label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                                    value={deliveryScheduledAt}
                                                    onChange={(e) => setDeliveryScheduledAt(e.target.value)}
                                                    disabled={!canModifyLead}
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Detalle</label>
                                                <input
                                                    type="text"
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                                    placeholder="Ej: entrega en sala, firma final, revisión..."
                                                    value={deliveryScheduledNote}
                                                    onChange={(e) => setDeliveryScheduledNote(e.target.value)}
                                                    disabled={!canModifyLead}
                                                />
                                            </div>
                                            <div className="md:col-span-3">
                                                <button
                                                    type="button"
                                                    onClick={handleScheduleDelivery}
                                                    disabled={!canModifyLead || schedulingDelivery}
                                                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    {schedulingDelivery ? 'Agendando...' : 'Agendar entrega'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-sm text-amber-700">
                                            Completa todo el checklist para habilitar la agenda de entrega y el cambio a vendido.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeDetailTab === 'conversacion' && (
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col min-h-[540px] max-h-[68vh]">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    Conversación del cliente ({messages.length})
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 custom-scrollbar min-h-0">
                                {loadingMessages ? (
                                    <div className="text-center text-sm text-gray-400 py-4">Cargando mensajes...</div>
                                ) : messages.length > 0 ? (
                                    messages.map((msg, index) => (
                                        <div key={msg.id || index} className={`flex flex-col ${msg.sender_type === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className="flex items-end gap-1 mb-1">
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    {msg.sender_type === 'user' ? (msg.sender?.email || 'Nosotros') : lead.name}
                                                </span>
                                            </div>
                                            <div className={`px-4 py-2 rounded-2xl max-w-[85%] ${msg.sender_type === 'user'
                                                ? 'bg-blue-600 text-white rounded-br-sm shadow-sm'
                                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                                                }`}>
                                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                            </div>
                                            <span className="text-[9px] text-gray-400 mt-1">
                                                {formatBogotaDateTime(msg.created_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex items-center justify-center text-sm text-gray-400">
                                        No hay mensajes cargados para este lead.
                                    </div>
                                )}
                            </div>
                            {(lead.source === 'facebook' || lead.source === 'instagram' || lead.source === 'whatsapp') && (
                                <form onSubmit={handleSendReply} className="bg-white border-t border-gray-200 p-3 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder={`Responder por ${lead.source}...`}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={replyMessage}
                                        onChange={(e) => setReplyMessage(e.target.value)}
                                        disabled={sendingReply || !canModifyLead}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!replyMessage.trim() || sendingReply || !canModifyLead}
                                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {sendingReply ? '...' : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    {activeDetailTab === 'historial' && (
                    <div>
                        <div className="flex border-b border-gray-200 mb-4">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-b-2 border-blue-600 py-2 inline-block">
                                Historial de Cambios
                            </h3>
                        </div>
                        <div className="space-y-4">
                            {historyEntries.length > 0 ? (
                                [...historyEntries].reverse().map((record) => {
                                    const { vehicleTrace, mainComment } = extractCreditVehicleTrace(record.comment);
                                    const fallbackVehicleTrace = !vehicleTrace && normalizeLeadStatus(record.new_status) === 'credit_study' && visibleVehicleText
                                        ? `${vehicleTrackingLabel}: ${visibleVehicleText}`
                                        : '';
                                    const effectiveVehicleTrace = vehicleTrace || fallbackVehicleTrace;
                                    return (
                                    <div key={record.id} className="flex gap-4 group">
                                        <div className="flex flex-col items-center">
                                            <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 ring-4 ring-white"></div>
                                            <div className="w-0.5 flex-1 bg-gray-100 group-last:hidden"></div>
                                        </div>
                                        <div className="flex-1 pb-6">
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 group-hover:border-blue-100 transition shadow-sm">
                                                  <div className="flex justify-between items-start mb-2">
                                                      <div className="flex flex-col gap-2">
                                                          <div className="flex items-center gap-2">
                                                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white ${record.isInitialDescription ? 'bg-slate-500' : 'bg-gray-400'}`}>
                                                              {record.isInitialDescription ? 'creacion' : (record.previous_status || 'N/A')}
                                                          </span>
                                                          {!record.isInitialDescription && (
                                                              <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                        )}
                                                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white ${
                                                              record.isInitialDescription
                                                                  ? 'bg-indigo-500'
                                                                  : getLeadStatusMeta(record.new_status).historyBadgeClass
                                                          }`}>
                                                              {record.isInitialDescription
                                                                  ? 'lead creado'
                                                                  : getLeadStatusLabel(record.new_status)}
                                                          </span>
                                                          </div>
                                                          <p className="text-[11px] font-semibold text-slate-500">
                                                              {record.user?.full_name || record.user?.email || 'Sistema'}
                                                          </p>
                                                      </div>
                                                      <span className="text-[10px] text-gray-400 font-mono">
                                                          {record.created_at ? formatBogotaDateTime(record.created_at) : 'Reciente'}
                                                      </span>
                                                </div>
                                                {effectiveVehicleTrace && (
                                                    <div className="mb-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                                                        <span className="font-semibold">Vehículo relacionado:</span> {effectiveVehicleTrace.replace(/^Veh[ií]culo (?:por buscar|de inventario|solicitado|desde inventario):\s*/i, '')}
                                                    </div>
                                                )}
                                                <p className="text-sm text-gray-700 italic">"{mainComment || record.comment || 'Sin comentario'}"</p>
                                            </div>
                                        </div>
                                    </div>
                                )})
                            ) : (
                                <div className="text-center py-12 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    No hay historial registrado para este lead.
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LeadsBoard = ({ boardMode = 'general' }) => {
    const { user } = useAuth();
    const { notifications, fetchNotifications, markAsRead } = useNotifications();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [assignedFilter, setAssignedFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [globalStatusFilter, setGlobalStatusFilter] = useState('');
    const [showFiltersMenu, setShowFiltersMenu] = useState(false);
    const [showMyLeadsOnly, setShowMyLeadsOnly] = useState(false);

    // Modal State - Sales
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [selectedLeadForSale, setSelectedLeadForSale] = useState(null);
    const [salePurchaseDetail, setSalePurchaseDetail] = useState(null);
    const [loadingSalePurchaseDetail, setLoadingSalePurchaseDetail] = useState(false);
    const [saleDeliveryFiles, setSaleDeliveryFiles] = useState([]);
    const [availableVehicles, setAvailableVehicles] = useState([]);
    const [advisors, setAdvisors] = useState([]);
    const [saleForm, setSaleForm] = useState({ vehicle_id: '', sale_price: '', seller_id: '' });

    // Modal State - Status Comment
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState(null);
    const [statusComment, setStatusComment] = useState('');
    const [dragHasVehicle, setDragHasVehicle] = useState(null);
    const [dragSelectedVehicleId, setDragSelectedVehicleId] = useState('');
    const [dragDesiredVehicle, setDragDesiredVehicle] = useState('');
    const [dragReservationAmount, setDragReservationAmount] = useState('');
    const [dragCreditUsedAmount, setDragCreditUsedAmount] = useState('');
    const [dragReservationPaymentMethod, setDragReservationPaymentMethod] = useState('');
    const [dragApprovedAmount, setDragApprovedAmount] = useState('');
    const [dragApprovalPercentage, setDragApprovalPercentage] = useState('');
    const [dragApprovedDownPayment, setDragApprovedDownPayment] = useState('');
    // Board list payload doesn't always include credit approval details; for "Reservas" we fetch full lead detail to prefill.
    const [pendingLeadDetailOverride, setPendingLeadDetailOverride] = useState(null);

    // Modal State - History View
    const [selectedLeadForHistory, setSelectedLeadForHistory] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [loadingLeadDetail, setLoadingLeadDetail] = useState(false);
    const [highlightedLeadId, setHighlightedLeadId] = useState(null);

    // Modal State - New Lead
    const [showAddLeadModal, setShowAddLeadModal] = useState(false);
    const [newLeadForm, setNewLeadForm] = useState({
        name: '',
        email: '',
        phone: '',
        source: boardMode === 'ally' ? 'referral' : 'web',
        message: '',
        status: 'new',
        assigned_to_id: '',
        supervisor_ids: []
    });

    const isAllyBoard = boardMode === 'ally';
    const currentUserId = parseUserId(user?.id);
    const currentRoleName = normalizeRoleKey(user?.role);
    const boardTitle = isAllyBoard ? 'Tablero de Aliados' : 'Tablero de Leads';
    const boardDescription = isAllyBoard
        ? 'Gestiona los leads que estan en manos de aliados y transfiere al tablero general cuando corresponda.'
        : 'Arrastra y suelta para gestionar el ciclo de vida de tus clientes.';
    const createButtonLabel = isAllyBoard ? 'Nuevo Lead para Aliado' : 'Nuevo Lead Manual';
    const allyUsers = advisors.filter((adv) => {
        const roleName = normalizeRoleKey(adv.role);
        return roleName === 'aliado';
    });
    const supervisionUsers = advisors.filter((adv) => normalizeRoleKey(adv.role) !== 'user');
    const shownBoardCreditNotificationsRef = React.useRef('');

    useEffect(() => {
        setLoading(true);
        setLeads([]);
        setSelectedLeadForHistory(null);
        setShowHistoryModal(false);
        setHighlightedLeadId(null);
        setPendingStatusChange(null);
        setStatusComment('');
        setDragHasVehicle(null);
        setDragSelectedVehicleId('');
        setDragDesiredVehicle('');
        setDragReservationAmount('');
        setDragCreditUsedAmount('');
        setDragReservationPaymentMethod('');
        setDragApprovedAmount('');
        setDragApprovalPercentage('');
        setDragApprovedDownPayment('');
        setPendingLeadDetailOverride(null);
        setNewLeadForm({
            name: '',
            email: '',
            phone: '',
            source: boardMode === 'ally' ? 'referral' : 'web',
            message: '',
            status: 'new',
            assigned_to_id: '',
            supervisor_ids: []
        });
        fetchLeads('');
        fetchAdvisors();
        fetchAvailableVehicles();
    }, [boardMode]);

    useEffect(() => {
        if (!fetchNotifications) return;
        shownBoardCreditNotificationsRef.current = '';
        fetchNotifications({ silentToast: true });
    }, [boardMode]);

    useEffect(() => {
        if (!Array.isArray(notifications) || !markAsRead || !fetchNotifications) return;

        const unreadCreditNotifications = notifications.filter((notification) =>
            isCreditNotificationForBoard(notification, boardMode)
        );

        if (unreadCreditNotifications.length === 0) return;

        const notificationKey = `${boardMode}:${unreadCreditNotifications.map((notification) => notification.id).join(',')}`;
        if (shownBoardCreditNotificationsRef.current === notificationKey) return;
        shownBoardCreditNotificationsRef.current = notificationKey;

        const showUnreadCreditNotifications = async () => {
            await Swal.fire({
                title: 'Novedades de crédito',
                html: `
                    <div style="display:grid; gap:12px; text-align:left;">
                        ${unreadCreditNotifications.map((notification) => `
                            <div style="border:1px solid #dbeafe; border-radius:12px; padding:12px; background:#f8fbff;">
                                <div style="font-weight:700; color:#1d4ed8; margin-bottom:4px;">${notification.title || 'Actualización'}</div>
                                <div style="font-size:14px; color:#334155;">${notification.message || ''}</div>
                            </div>
                        `).join('')}
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#2563eb'
            });

            await Promise.all(unreadCreditNotifications.map((notification) => markAsRead(notification.id)));
            await fetchNotifications({ silentToast: true });
        };

        showUnreadCreditNotifications();
    }, [boardMode, notifications]);

    useEffect(() => {
        const searchTimer = setTimeout(() => {
            fetchLeads(searchTerm);
        }, 250);

        return () => clearTimeout(searchTimer);
    }, [searchTerm, boardMode]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchLeads(searchTerm);
        }, 15000);

        return () => clearInterval(intervalId);
    }, [boardMode, searchTerm]);

    useEffect(() => {
        const leadIdFromQuery = parseInt(searchParams.get('leadId') || '', 10);
        if (!leadIdFromQuery || leads.length === 0 || showHistoryModal) return;

        const targetLead = leads.find(lead => lead.id === leadIdFromQuery);
        if (!targetLead) return;

        handleViewHistory(targetLead);
        navigate(isAllyBoard ? '/aliado/dashboard' : '/admin/leads', { replace: true });
    }, [searchParams, leads, showHistoryModal, navigate, isAllyBoard]);

    useEffect(() => {
        if (!highlightedLeadId) return;

        const timer = setTimeout(() => {
            const card = document.getElementById(`lead-card-${highlightedLeadId}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [highlightedLeadId, leads]);

    const handleCreateLead = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
        if (isAllyBoard && currentRoleName !== 'aliado' && !newLeadForm.assigned_to_id) {
                Swal.fire('Error', 'Debes seleccionar el aliado responsable de este lead.', 'warning');
                return;
            }

            const payload = {
                ...newLeadForm,
                company_id: user?.company_id || 1
            };

            if (newLeadForm.assigned_to_id) {
                payload.assigned_to_id = parseInt(newLeadForm.assigned_to_id, 10);
            } else {
                delete payload.assigned_to_id;
            }
            payload.supervisor_ids = Array.isArray(newLeadForm.supervisor_ids)
                ? newLeadForm.supervisor_ids
                    .map((id) => parseInt(id, 10))
                    .filter((id) => Number.isInteger(id))
                : [];

            const response = await axios.post(`${API_BASE_URL}/leads`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setLeads(prev => [response.data, ...prev]);
            setShowAddLeadModal(false);
            setNewLeadForm({ name: '', email: '', phone: '', source: isAllyBoard ? 'referral' : 'web', message: '', status: 'new', assigned_to_id: '', supervisor_ids: [] });

            Swal.fire({
                icon: 'success',
                title: 'Lead Creado',
                text: 'El lead se ha creado exitosamente.',
                timer: 2000,
                showConfirmButton: false,
                confirmButtonColor: '#2563eb'
            });
        } catch (error) {
            console.error("Error creating lead", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: "Error creando el lead: " + (error.response?.data?.error || error.response?.data?.detail || error.message),
                confirmButtonColor: '#2563eb'
            });
        }
    };

    const fetchLeads = async (term = '') => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/leads`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    board_scope: boardMode,
                    limit: 5000,
                    q: term?.trim() || undefined
                }
            });
            const items = Array.isArray(response.data.items) ? response.data.items : [];
            setLeads(items.map(normalizeLeadRecord));
        } catch (error) {
            console.error("Error fetching leads", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLeadDetail = async (leadId) => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/leads/${leadId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return normalizeLeadRecord(response.data);
    };

    const fetchAvailableVehicles = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/vehicles/?status=available`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAvailableVehicles(response.data.items || []);
        } catch (error) {
            console.error("Error fetching vehicles", error);
        }
    };

    const fetchPurchaseDetailByLead = async (leadId) => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/purchases/by-lead/${leadId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data || null;
    };

    const fetchAdvisors = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/users/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const users = (response.data.items || []).filter((user) => isUserActive(user));
            setAdvisors(users);
        } catch (error) {
            console.error("Error fetching advisors", error);
        }
    };

    const handleViewHistory = async (lead) => {
        const updatedLead = { ...lead, has_unread_reply: 0 };
        setLeads(prev => prev.map(item => item.id === lead.id ? { ...item, has_unread_reply: 0 } : item));
        setSelectedLeadForHistory(updatedLead);
        setHighlightedLeadId(lead.id);
        setShowHistoryModal(true);
        setLoadingLeadDetail(true);
        try {
            const detailedLead = await fetchLeadDetail(lead.id);
            setSelectedLeadForHistory({
                ...detailedLead,
                has_unread_reply: 0
            });
        } catch (error) {
            console.error('Error fetching lead detail', error);
            Swal.fire('Error', 'No se pudo cargar el detalle del lead', 'error');
        } finally {
            setLoadingLeadDetail(false);
        }
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e, leadId) => {
        e.dataTransfer.setData("leadId", leadId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = async (e, newStatus) => {
        const leadId = e.dataTransfer.getData("leadId");
        if (leadId) {
            const id = parseInt(leadId);
            const lead = leads.find(l => l.id === id);
            if (!lead) return;

            if (isSupervisorOnlyCreditViewer(lead, currentUserId, currentRoleName)) {
                Swal.fire('Solo lectura', 'Como supervisor en Estudio de crédito puedes ver el lead, pero no cambiarle el estado desde este tablero.', 'info');
                return;
            }

            if (lead.status === newStatus) return;

            setPendingStatusChange({ leadId: id, newStatus });
            setStatusComment('');
            setPendingLeadDetailOverride(null);
            setDragHasVehicle(null);
            setDragSelectedVehicleId('');
            setDragDesiredVehicle('');
            setDragReservationAmount('');
            setDragCreditUsedAmount(lead?.process_detail?.credit_used_amount ? String(lead.process_detail.credit_used_amount) : '');
            setDragReservationPaymentMethod('');
            const leadApprovalMetrics = getLeadApprovalMetrics(lead);
            setDragApprovedAmount(leadApprovalMetrics.approvedAmount ? String(leadApprovalMetrics.approvedAmount) : '');
            setDragApprovalPercentage(leadApprovalMetrics.approvalPercentage ? String(leadApprovalMetrics.approvalPercentage) : '');
            setDragApprovedDownPayment(leadApprovalMetrics.minimumDownPayment ? String(leadApprovalMetrics.minimumDownPayment) : '');

            if (newStatus === 'sold') {
                initiateSale(id);
            } else {
                setShowCommentModal(true);
                if (normalizeLeadStatus(newStatus) === 'reserved') {
                    try {
                        const detailedLead = await fetchLeadDetail(id);
                        if (detailedLead && detailedLead.id === id) {
                            setPendingLeadDetailOverride(detailedLead);
                            const detailedMetrics = getLeadApprovalMetrics(detailedLead);
                            if (detailedMetrics.approvedAmount != null) setDragApprovedAmount(String(detailedMetrics.approvedAmount));
                            if (detailedMetrics.approvalPercentage != null) setDragApprovalPercentage(String(detailedMetrics.approvalPercentage));
                            if (detailedMetrics.minimumDownPayment != null) setDragApprovedDownPayment(String(detailedMetrics.minimumDownPayment));

                            const existingReservationAmount = detailedLead?.process_detail?.reservation_amount;
                            const existingPaymentMethod = detailedLead?.process_detail?.reservation_payment_method;
                            const existingCreditUsedAmount = detailedLead?.process_detail?.credit_used_amount;
                            if (existingReservationAmount != null && Number(existingReservationAmount) > 0) {
                                setDragReservationAmount(String(existingReservationAmount));
                            }
                            if (existingPaymentMethod) {
                                setDragReservationPaymentMethod(String(existingPaymentMethod));
                            }
                            if (existingCreditUsedAmount != null && Number(existingCreditUsedAmount) > 0) {
                                setDragCreditUsedAmount(String(existingCreditUsedAmount));
                            }
                        }
                    } catch (error) {
                        console.error('Error fetching detailed lead for Reservas', error);
                    }
                }
            }
        }
    };

    const initiateSale = async (leadId) => {
        const lead = leads.find(l => l.id === leadId);
        setSelectedLeadForSale(lead);
        setSalePurchaseDetail(null);
        setSaleDeliveryFiles([]);
        const defaultSellerId = getLeadAssignedUserId(lead) || '';
        setSaleForm({ vehicle_id: '', sale_price: '', seller_id: defaultSellerId });
        setShowSaleModal(true);
        fetchAvailableVehicles();
        if (currentRoleName === 'admin' || currentRoleName === 'super_admin') {
            fetchAdvisors();
        }
        if (!leadId) return;
        setLoadingSalePurchaseDetail(true);
        try {
            const [detailedLead, purchaseDetail] = await Promise.all([
                fetchLeadDetail(leadId).catch(() => null),
                fetchPurchaseDetailByLead(leadId).catch(() => null),
            ]);
            const detailSource = detailedLead?.process_detail || lead?.process_detail || {};
            const deliveryChecklistReady = [
                Boolean(detailSource?.delivery_documents_complete),
                Boolean(detailSource?.delivery_road_kit),
                Boolean(detailSource?.delivery_basic_tools),
                Boolean(detailSource?.delivery_credit_disbursement),
            ].every(Boolean);
            if (!deliveryChecklistReady || !detailSource?.delivery_scheduled_at) {
                setShowSaleModal(false);
                Swal.fire(
                    'Atención',
                    'Antes de cerrar la venta debes completar el checklist y agendar la entrega en el detalle del lead.',
                    'warning'
                );
                return;
            }
            if (detailedLead) {
                setSelectedLeadForSale(detailedLead);
            }
            setSalePurchaseDetail(purchaseDetail);
            setSaleForm((prev) => ({
                ...prev,
                sale_price: String(
                    purchaseDetail?.purchase_sale_price
                    || purchaseDetail?.purchase_price
                    || prev.sale_price
                    || ''
                ),
            }));
        } catch (error) {
            console.error('Error loading sale purchase detail', error);
        } finally {
            setLoadingSalePurchaseDetail(false);
        }
    };

    const confirmStatusChange = async () => {
        // Validation Logic
        if (!statusComment || statusComment.trim().length < 6) {
            Swal.fire({
                icon: 'warning',
                title: 'Información Requerida',
                text: 'Se debe describir el seguimiento para poder cambiar de etapa.',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        if (!pendingStatusChange) return;

        const { leadId, newStatus } = pendingStatusChange;

        let processDetail = null;
        let reservedApprovalPayload = null;
        if (newStatus === 'in_process') {
            if (dragHasVehicle === null) {
                Swal.fire('Atención', 'Debes indicar si el vehiculo está disponible en inventario o si toca conseguirlo.', 'warning');
                return;
            }
            const desiredVehicleFallback = dragDesiredVehicle.trim() || 'Por definir';
            if (!dragHasVehicle && !desiredVehicleFallback) {
                Swal.fire('Atención', 'Debes indicar qué vehiculo busca el cliente.', 'warning');
                return;
            }
            const shouldMoveToPurchaseSearch = dragHasVehicle === true && !dragSelectedVehicleId;
            processDetail = {
                has_vehicle: shouldMoveToPurchaseSearch ? false : dragHasVehicle,
                vehicle_id: dragHasVehicle && dragSelectedVehicleId ? parseInt(dragSelectedVehicleId) : null,
                desired_vehicle: (!dragHasVehicle || shouldMoveToPurchaseSearch) ? desiredVehicleFallback : null
            };
        } else if (newStatus === 'reserved') {
            const parsedReservationAmount = Number(String(dragReservationAmount || '').replace(/[^\d]/g, ''));
            const parsedCreditUsedAmount = Number(String(dragCreditUsedAmount || '').replace(/[^\d]/g, ''));
            const parsedApprovedAmount = Number(String(dragApprovedAmount || '').replace(/[^\d]/g, ''));
            const parsedApprovalPercentage = Number(String(dragApprovalPercentage || '').replace(/[^\d]/g, ''));
            const parsedApprovedDownPayment = Number(String(dragApprovedDownPayment || '').replace(/[^\d]/g, ''));
            const normalizedPaymentMethod = String(dragReservationPaymentMethod || '').trim().toLowerCase();
            const leadRef = (pendingLeadDetailOverride?.id === leadId)
                ? pendingLeadDetailOverride
                : leads.find((item) => item.id === leadId);
            const leadApprovalMetrics = getLeadApprovalMetrics(leadRef);
            const leadApprovedAmount = Number(leadApprovalMetrics.approvedAmount || 0) || 0;
            const leadApprovalPercentage = Number(leadApprovalMetrics.approvalPercentage || 0) || 0;
            const leadApprovedDownPayment = Number(leadApprovalMetrics.minimumDownPayment || 0) || 0;
            const finalApprovedAmount = leadApprovedAmount > 0 ? leadApprovedAmount : (Number.isFinite(parsedApprovedAmount) && parsedApprovedAmount > 0 ? parsedApprovedAmount : null);
            const finalApprovalPercentage = leadApprovalPercentage > 0 ? leadApprovalPercentage : (Number.isFinite(parsedApprovalPercentage) && parsedApprovalPercentage > 0 ? parsedApprovalPercentage : null);
            const finalApprovedDownPayment = leadApprovedDownPayment > 0 ? leadApprovedDownPayment : (Number.isFinite(parsedApprovedDownPayment) && parsedApprovedDownPayment > 0 ? parsedApprovedDownPayment : null);
            if (!Number.isFinite(parsedReservationAmount) || parsedReservationAmount <= 0) {
                Swal.fire('Atención', 'Debes indicar el monto de la separación para pasar el lead a Reservas.', 'warning');
                return;
            }
            if (!finalApprovedAmount) {
                Swal.fire('Atención', 'Debes indicar el monto aprobado del crédito para este lead.', 'warning');
                return;
            }
            if (!finalApprovalPercentage || finalApprovalPercentage <= 0 || finalApprovalPercentage > 100) {
                Swal.fire('Atención', 'Debes indicar el porcentaje aprobado del crédito.', 'warning');
                return;
            }
            if (!finalApprovedDownPayment) {
                Swal.fire('Atención', 'Debes indicar la cuota inicial mínima aprobada.', 'warning');
                return;
            }
            if (finalApprovedAmount > 0 && (!Number.isFinite(parsedCreditUsedAmount) || parsedCreditUsedAmount <= 0)) {
                Swal.fire('Atención', 'Debes indicar el monto del crédito a usar para pasar el lead a Reservas.', 'warning');
                return;
            }
            if (!['efectivo', 'transferencia'].includes(normalizedPaymentMethod)) {
                Swal.fire('Atención', 'Debes indicar si la separación fue en efectivo o transferencia.', 'warning');
                return;
            }
            processDetail = {
                has_vehicle: typeof leadRef?.process_detail?.has_vehicle === 'boolean' ? leadRef.process_detail.has_vehicle : false,
                vehicle_id: leadRef?.process_detail?.vehicle_id || null,
                desired_vehicle: leadRef?.process_detail?.desired_vehicle || leadRef?.message?.trim() || 'Por definir',
                reservation_amount: parsedReservationAmount,
                credit_used_amount: Number.isFinite(parsedCreditUsedAmount) && parsedCreditUsedAmount > 0 ? parsedCreditUsedAmount : null,
                reservation_payment_method: normalizedPaymentMethod,
            };
            reservedApprovalPayload = {
                approved_amount: finalApprovedAmount,
                approval_percentage: finalApprovalPercentage,
                approved_down_payment: finalApprovedDownPayment,
            };
        }

        try {
            // Optimistic UI Update
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
            setShowCommentModal(false);

            const token = localStorage.getItem('token');
            const payload = {
                status: newStatus,
                comment: statusComment
            };
            if (processDetail) {
                payload.process_detail = processDetail;
            }
            if (newStatus === 'reserved' && reservedApprovalPayload) {
                payload.approved_amount = reservedApprovalPayload.approved_amount;
                payload.approval_percentage = reservedApprovalPayload.approval_percentage;
                payload.approved_down_payment = reservedApprovalPayload.approved_down_payment;
            }
            await axios.put(`${API_BASE_URL}/leads/${leadId}`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Refresh leads to get updated history
            fetchLeads();

        } catch (error) {
            console.error("Error updating lead", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo actualizar el estado: ' + (error.response?.data?.error || error.message),
                confirmButtonColor: '#2563eb'
            });
            fetchLeads(); // Revert
        }
    };

    const handleUpdateHistory = async (leadId, newStatus, comment, processDetail = null, supervisorIds = null) => {
        try {
            const token = localStorage.getItem('token');
            const payload = {
                status: newStatus,
                comment: comment
            };
            if (processDetail) {
                payload.process_detail = processDetail;
            }
            if (Array.isArray(supervisorIds)) {
                payload.supervisor_ids = supervisorIds;
            }

            await axios.put(`${API_BASE_URL}/leads/${leadId}`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Optimistic update or refresh
            setLeads(prev => prev.map(l => {
                if (l.id === leadId) {
                    return {
                        ...l,
                        status: newStatus,
                        supervisor_ids: Array.isArray(supervisorIds) ? supervisorIds : l.supervisor_ids,
                        supervisors: Array.isArray(supervisorIds)
                            ? advisors.filter((adv) => supervisorIds.includes(adv.id))
                            : l.supervisors
                    };
                }
                return l;
            }));

            // Re-fetch to get the new history record
            fetchLeads(); // Or fetch specific lead if optimized

            Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                text: 'El lead ha sido actualizado correctamente.',
                timer: 1500,
                showConfirmButton: false,
                confirmButtonColor: '#2563eb'
            });
            setShowHistoryModal(false); // Optional: close or keep open
        } catch (error) {
            console.error("Error updating lead history", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo actualizar el lead: ' + (error.response?.data?.error || error.message),
                confirmButtonColor: '#2563eb'
            });
            throw error; // Propagate to modal to stop loading state
        }
    };

    const handleUpdateLeadContact = async (leadId, contactData) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(
                `${API_BASE_URL}/leads/${leadId}`,
                contactData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const updatedLead = response.data;
            setLeads((prev) => prev.map((lead) => (
                lead.id === leadId
                    ? {
                        ...lead,
                        name: updatedLead.name,
                        email: updatedLead.email,
                        phone: updatedLead.phone,
                        process_detail: updatedLead.process_detail ?? lead.process_detail,
                    }
                    : lead
            )));
            setSelectedLeadForHistory((prev) => (
                prev && prev.id === leadId
                    ? {
                        ...prev,
                        name: updatedLead.name,
                        email: updatedLead.email,
                        phone: updatedLead.phone,
                        process_detail: updatedLead.process_detail ?? prev.process_detail,
                    }
                    : prev
            ));

            Swal.fire({
                icon: 'success',
                title: 'Datos actualizados',
                text: 'La información del lead se guardó correctamente.',
                timer: 1500,
                showConfirmButton: false,
                confirmButtonColor: '#2563eb'
            });
        } catch (error) {
            console.error('Error updating lead contact', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron actualizar los datos del lead: ' + (error.response?.data?.detail || error.message),
                confirmButtonColor: '#2563eb'
            });
            throw error;
        }
    };

    const handleSaveSupervisors = async (leadId, supervisorIds) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(`${API_BASE_URL}/leads/${leadId}`,
                {
                    supervisor_ids: supervisorIds,
                    comment: 'Supervision actualizada'
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const normalizedLead = normalizeLeadRecord(response.data);
            setLeads(prev => prev.map((lead) => (
                lead.id === leadId
                    ? normalizedLead
                    : lead
            )));
            setSelectedLeadForHistory(prev => (prev && prev.id === leadId ? normalizedLead : prev));

            await fetchLeads();
            Swal.fire({
                icon: 'success',
                title: 'Supervision actualizada',
                text: 'La supervision del lead se guardo correctamente.',
                timer: 1400,
                showConfirmButton: false,
                confirmButtonColor: '#2563eb'
            });
        } catch (error) {
            console.error("Error saving supervisors", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo guardar la supervision: ' + (error.response?.data?.error || error.message),
                confirmButtonColor: '#2563eb'
            });
            throw error;
        }
    };

    const handleAssignLead = async (leadId, advisorId, supervisorIds = null) => {
        try {
            const token = localStorage.getItem('token');
            const sanitizedSupervisorIds = sanitizeSupervisorIds(supervisorIds, advisors);
            // If empty string, send null
            const payload = {
                assigned_to_id: advisorId ? parseInt(advisorId) : null,
                comment: `Lead asignado a un nuevo responsable`
            };
            if (Array.isArray(sanitizedSupervisorIds)) {
                payload.supervisor_ids = sanitizedSupervisorIds;
            }

            await axios.put(`${API_BASE_URL}/leads/${leadId}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Swal.fire({
                icon: 'success',
                title: 'Lead Asignado',
                text: 'El responsable del lead ha sido actualizado.',
                timer: 1500,
                showConfirmButton: false,
                confirmButtonColor: '#2563eb'
            });
            const parsedAdvisorId = advisorId ? parseInt(advisorId) : null;
            const advisorData = parsedAdvisorId
                ? advisors.find(adv => adv.id === parsedAdvisorId) || null
                : null;
            const supervisorUsers = Array.isArray(sanitizedSupervisorIds)
                ? advisors.filter((adv) => sanitizedSupervisorIds.includes(adv.id))
                : null;

            setLeads(prev => prev.map(l => (
                l.id === leadId
                    ? {
                        ...l,
                        assigned_to: advisorData,
                        assigned_to_id: parsedAdvisorId,
                        supervisor_ids: Array.isArray(sanitizedSupervisorIds) ? sanitizedSupervisorIds : l.supervisor_ids,
                        supervisors: Array.isArray(sanitizedSupervisorIds) ? supervisorUsers : l.supervisors
                    }
                    : l
            )));

            setSelectedLeadForHistory(prev => (
                prev && prev.id === leadId
                    ? {
                        ...prev,
                        assigned_to: advisorData,
                        assigned_to_id: parsedAdvisorId,
                        supervisor_ids: Array.isArray(sanitizedSupervisorIds) ? sanitizedSupervisorIds : prev.supervisor_ids,
                        supervisors: Array.isArray(sanitizedSupervisorIds) ? supervisorUsers : prev.supervisors
                    }
                    : prev
            ));

            fetchLeads(); // Refresh board to show final backend state
        } catch (error) {
            console.error("Error assigning lead", error);
            Swal.fire('Error', 'No se pudo asignar el lead', 'error');
        }
    };

    const handleDeleteLead = async (leadId, reason) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/leads/${leadId}`, {
                headers: { Authorization: `Bearer ${token}` },
                data: { reason }
            });

            setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
            setSelectedLeadForHistory((prev) => (prev && prev.id === leadId ? null : prev));
            setShowHistoryModal(false);
            fetchLeads();

            Swal.fire({
                icon: 'success',
                title: 'Lead eliminado',
                text: 'El lead se ocultó del tablero correctamente.',
                timer: 1800,
                showConfirmButton: false,
                confirmButtonColor: '#2563eb'
            });
        } catch (error) {
            console.error('Error deleting lead', error);
            Swal.fire(
                'Error',
                error.response?.data?.detail || 'No se pudo eliminar el lead',
                'error'
            );
            throw error;
        }
    };

    const handleConfirmSale = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const payload = {
                lead_id: selectedLeadForSale.id,
                sale_price: parseInt(saleForm.sale_price)
            };

            if (saleForm.vehicle_id) {
                payload.vehicle_id = parseInt(saleForm.vehicle_id, 10);
            }

            if (!payload.vehicle_id) {
                const fallbackVehicleId = selectedLeadForSale?.process_detail?.vehicle_id
                    ? parseInt(selectedLeadForSale.process_detail.vehicle_id, 10)
                    : null;
                if (fallbackVehicleId) {
                    payload.vehicle_id = fallbackVehicleId;
                }
            }

            if (!payload.vehicle_id) {
                Swal.fire('Error', 'No se encontró un vehículo para registrar la venta. Selecciona un vehículo o asegúrate de que compras haya asignado uno.', 'error');
                return;
            }

            if (saleForm.seller_id) {
                payload.seller_id = parseInt(saleForm.seller_id);
            }

            await axios.post(`${API_BASE_URL}/sales/`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            await axios.put(`${API_BASE_URL}/leads/${selectedLeadForSale.id}`,
                {
                    status: 'sold',
                    comment: `Venta registrada: ${salePurchaseDetail?.purchase_vehicle_name || salePurchaseDetail?.desired_vehicle || 'Vehículo vendido'}`
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (saleDeliveryFiles.length > 0) {
                await Promise.all(
                    saleDeliveryFiles.map((file) => {
                        const formData = new FormData();
                        formData.append('file', file);
                        return axios.post(
                            `${API_BASE_URL}/leads/${selectedLeadForSale.id}/files`,
                            formData,
                            {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'multipart/form-data'
                                }
                            }
                        );
                    })
                );
            }

            setShowSaleModal(false);
            setSaleForm({ vehicle_id: '', sale_price: '', seller_id: '' });
            setSalePurchaseDetail(null);
            setSaleDeliveryFiles([]);

            setLeads(prev => prev.map(l => l.id === selectedLeadForSale.id ? { ...l, status: 'sold' } : l));
            fetchLeads();

            Swal.fire({
                icon: 'success',
                title: '¡Venta Registrada!',
                text: 'La venta ha sido creada exitosamente.',
                timer: 2000,
                showConfirmButton: false,
                confirmButtonColor: '#2563eb'
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: "Error registrando la venta: " + (error.response?.data?.error || error.response?.data?.detail || error.message),
                confirmButtonColor: '#2563eb'
            });
        }
    };

    const pendingLeadForStatusChange = pendingStatusChange
        ? (
            pendingLeadDetailOverride?.id === pendingStatusChange.leadId
                ? pendingLeadDetailOverride
                : (leads.find((item) => item.id === pendingStatusChange.leadId) || null)
        )
        : null;
    const pendingLeadApprovalMetrics = getLeadApprovalMetrics(pendingLeadForStatusChange);

    const hasPurchasedVehicleDataForSale = Boolean(
        salePurchaseDetail?.purchase_vehicle_name
        || salePurchaseDetail?.purchase_vehicle_model
        || salePurchaseDetail?.purchase_vehicle_year
        || salePurchaseDetail?.purchase_vehicle_plate
    );
    const purchasedVehicleLabelForSale = [
        salePurchaseDetail?.purchase_vehicle_name,
        salePurchaseDetail?.purchase_vehicle_model,
        salePurchaseDetail?.purchase_vehicle_year,
    ].filter(Boolean).join(' ');
    const purchasedVehicleMetaForSale = [
        salePurchaseDetail?.purchase_vehicle_plate ? `Placa: ${salePurchaseDetail.purchase_vehicle_plate}` : null,
        salePurchaseDetail?.purchase_vehicle_mileage ? `Kilometraje: ${salePurchaseDetail.purchase_vehicle_mileage}` : null,
        salePurchaseDetail?.purchase_vehicle_location ? `Ubicación: ${salePurchaseDetail.purchase_vehicle_location}` : null,
    ].filter(Boolean).join(' | ');

    const filterByStatus = (status) => {
        return leads.filter(lead => {
            const supervisorIds = getLeadSupervisorIds(lead);
            const assignedUserId = getLeadAssignedUserId(lead);
            const matchesStatus = normalizeLeadStatus(lead.status) === normalizeLeadStatus(status);
            const matchesSearch =
                lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.phone?.includes(searchTerm);

            const matchesDate = !dateFilter || lead.created_at?.startsWith(dateFilter);

            // "Mis Leads" Filter (Priority)
            const matchesMyLeads = !showMyLeadsOnly || assignedUserId === currentUserId || supervisorIds.includes(currentUserId);

            // Specific User filter
            const parsedUserFilter = parseUserId(userFilter);
            const matchesUser = !parsedUserFilter || assignedUserId === parsedUserFilter || supervisorIds.includes(parsedUserFilter);

            const hasAnyResponsible = !!lead.assigned_to || supervisorIds.length > 0;
            const matchesAssigned = !assignedFilter ||
                (assignedFilter === 'assigned' ? hasAnyResponsible : !hasAnyResponsible);

            const matchesGlobalStatus = !globalStatusFilter || normalizeLeadStatus(lead.status) === normalizeLeadStatus(globalStatusFilter);

            return matchesStatus && matchesSearch && matchesDate && matchesUser && matchesAssigned && matchesGlobalStatus && matchesMyLeads;
        });
    };

    if (loading) return (
        <div className="flex justify-center items-center h-[calc(100vh-100px)]">
            <div className="text-xl text-blue-600 font-semibold animate-pulse">Cargando Tablero...</div>
        </div>
    );

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col relative bg-gray-50/50 -m-4 p-3 md:p-5">
            <div className="flex flex-col md:flex-row justify-between items-center mb-5 gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">{boardTitle}</h1>
                    <p className="text-slate-500 mt-1 text-sm font-medium">{boardDescription}</p>
                </div>
                <button
                    onClick={() => setShowAddLeadModal(true)}
                    className={`flex items-center gap-2 text-white px-4 py-2 rounded-xl hover:shadow-md hover:scale-[1.02] transition-all font-bold text-sm ${isAllyBoard ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    {createButtonLabel}
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-3 mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200 relative">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por nombre o teléfono..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowFiltersMenu(!showFiltersMenu)}
                        className={`flex items-center gap-2 px-3.5 py-2 border rounded-lg text-sm font-semibold transition-colors ${showFiltersMenu || globalStatusFilter || userFilter || assignedFilter || dateFilter ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        Filtros {(globalStatusFilter || userFilter || assignedFilter || dateFilter) && (<span className="w-2 h-2 rounded-full bg-blue-600"></span>)}
                    </button>

                    {/* Dropdown Menu */}
                    {showFiltersMenu && (
                        <div className="absolute right-0 top-12 mt-2 w-72 md:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-40 p-5 origin-top-right animate-fade-in-down py-6 grid gap-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-bold text-gray-800">Filtros Avanzados</h3>
                                {(globalStatusFilter || userFilter || assignedFilter || dateFilter) && (
                                    <button
                                        onClick={() => {
                                            setGlobalStatusFilter('');
                                            setUserFilter('');
                                            setAssignedFilter('');
                                            setDateFilter('');
                                        }}
                                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                                    >Limpiar todo</button>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado en Tablero</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm bg-slate-50 hover:bg-white transition-colors"
                                    value={globalStatusFilter}
                                    onChange={(e) => setGlobalStatusFilter(e.target.value)}
                                >
                                    <option value="">Todos los Estados</option>
                                    {LEAD_STATUS_OPTIONS.map((statusOption) => (
                                        <option key={statusOption.value} value={statusOption.value}>
                                            {statusOption.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Asesor Encargado</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm bg-slate-50 hover:bg-white transition-colors"
                                    value={userFilter}
                                    onChange={(e) => {
                                        setUserFilter(e.target.value);
                                        if (e.target.value) setAssignedFilter('');
                                    }}
                                >
                                    <option value="">Cualquier Usuario</option>
                                    {advisors.map(adv => (
                                        <option key={adv.id} value={adv.id}>{adv.email}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Asignación Global</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm bg-slate-50 hover:bg-white transition-colors"
                                    value={assignedFilter}
                                    onChange={(e) => {
                                        setAssignedFilter(e.target.value);
                                        if (e.target.value) setUserFilter('');
                                    }}
                                >
                                    <option value="">Todas las asignaciones</option>
                                    <option value="assigned">✅ Asignados</option>
                                    <option value="unassigned">⏳ Sin Asignar</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha Exacta</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm bg-slate-50 hover:bg-white transition-colors"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                />
                            </div>

                            <div className="md:col-span-1 flex items-end pb-1">
                                <label className="flex items-center gap-3 cursor-pointer group bg-blue-50/50 px-4 py-2 rounded-xl border border-blue-100/50 hover:bg-blue-50 transition-colors w-full">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-blue-600 checked:bg-blue-600 focus:ring-2 focus:ring-blue-400"
                                            checked={showMyLeadsOnly}
                                            onChange={(e) => setShowMyLeadsOnly(e.target.checked)}
                                        />
                                        <svg
                                            className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-blue-800 select-none">Mis Leads 👤</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4 h-full items-start">
                {LEAD_STATUS_OPTIONS.map((statusOption) => (
                    <KanbanColumn
                        key={statusOption.value}
                        title={statusOption.label}
                        status={statusOption.value}
                        color={statusOption.columnColor}
                        leads={filterByStatus(statusOption.value)}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onViewHistory={handleViewHistory}
                        highlightedLeadId={highlightedLeadId}
                        boardMode={boardMode}
                        currentUserId={currentUserId}
                        currentUserRole={currentRoleName}
                    />
                ))}
            </div>

            {/* Comment Modal for Status Change */}
            {showCommentModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up border border-gray-100">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Confirmar cambio de estado</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Estás cambiando el lead a: <span className="font-bold text-blue-600 uppercase">
                                {getLeadStatusLabel(pendingStatusChange?.newStatus)}
                            </span>.
                            <br />Por favor, indica el motivo o un comentario para el seguimiento.
                        </p>

                        <textarea
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                            rows="3"
                            placeholder="Escribe aquí el motivo del cambio..."
                            value={statusComment}
                            onChange={(e) => setStatusComment(e.target.value)}
                            autoFocus
                        ></textarea>

                        {normalizeLeadStatus(pendingStatusChange?.newStatus) === 'in_process' && (
                            <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Información del Vehículo</label>
                                <div className="space-y-3">
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input type="radio" className="w-4 h-4 text-blue-600 focus:ring-blue-500" checked={dragHasVehicle === true} onChange={() => setDragHasVehicle(true)} />
                                            <span>En Inventario</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input type="radio" className="w-4 h-4 text-blue-600 focus:ring-blue-500" checked={dragHasVehicle === false} onChange={() => { setDragHasVehicle(false); setDragSelectedVehicleId(''); }} />
                                            <span>Buscar en mercado</span>
                                        </label>
                                    </div>
                                    {dragHasVehicle === true && (
                                        <div>
                                            <select className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={dragSelectedVehicleId} onChange={(e) => setDragSelectedVehicleId(e.target.value)}>
                                                <option value="">-- Seleccionar vehículo del inventario --</option>
                                                {availableVehicles.map(v => (
                                                    <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.year}) - {v.license_plate}</option>
                                                ))}
                                            </select>
                                            <span className="text-xs text-gray-500 mt-1 block">Si no lo encuentras, márcalo como Buscar en mercado u omítelo para encargar compras.</span>
                                        </div>
                                    )}
                                    {dragHasVehicle === false && (
                                        <div>
                                            <input type="text" className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="¿Qué carro busca? (Ej: Mazda 3 2020 rojo)" value={dragDesiredVehicle} onChange={(e) => setDragDesiredVehicle(e.target.value)} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {normalizeLeadStatus(pendingStatusChange?.newStatus) === 'reserved' && (
                            <div className="mb-4 bg-violet-50 p-4 rounded-lg border border-violet-200">
                                <label className="block text-sm font-bold text-gray-700 mb-3">Información obligatoria de la reserva</label>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <div className="rounded-lg border border-violet-200 bg-white px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Monto aprobado</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                {pendingLeadApprovalMetrics.approvedAmount != null ? formatLeadCurrencyValue(pendingLeadApprovalMetrics.approvedAmount) : 'Sin definir'}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-violet-200 bg-white px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Porcentaje aprobado</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                {pendingLeadApprovalMetrics.approvalPercentage != null ? `${pendingLeadApprovalMetrics.approvalPercentage}%` : 'Sin definir'}
                                            </p>
                                        </div>
                                    </div>
                                    {(pendingLeadApprovalMetrics.approvedAmount == null || pendingLeadApprovalMetrics.approvalPercentage == null || pendingLeadApprovalMetrics.minimumDownPayment == null) && (
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto aprobado</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    className="w-full border border-violet-200 rounded p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                                    placeholder="Ej: 70000000"
                                                    value={dragApprovedAmount}
                                                    onChange={(e) => setDragApprovedAmount(e.target.value.replace(/[^\d]/g, ''))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Porcentaje aprobado</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    className="w-full border border-violet-200 rounded p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                                    placeholder="Ej: 90"
                                                    value={dragApprovalPercentage}
                                                    onChange={(e) => setDragApprovalPercentage(e.target.value.replace(/[^\d]/g, ''))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cuota inicial mínima</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    className="w-full border border-violet-200 rounded p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                                    placeholder="Ej: 7000000"
                                                    value={dragApprovedDownPayment}
                                                    onChange={(e) => setDragApprovedDownPayment(e.target.value.replace(/[^\d]/g, ''))}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto de la separación</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full border border-violet-200 rounded p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                            placeholder="Ej: 2000000"
                                            value={dragReservationAmount}
                                            onChange={(e) => setDragReservationAmount(e.target.value.replace(/[^\d]/g, ''))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto del crédito a usar</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full border border-violet-200 rounded p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                            placeholder="Ej: 25000000"
                                            value={dragCreditUsedAmount}
                                            onChange={(e) => setDragCreditUsedAmount(e.target.value.replace(/[^\d]/g, ''))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Medio de pago de la separación</label>
                                        <select
                                            className="w-full border border-violet-200 rounded p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                            value={dragReservationPaymentMethod}
                                            onChange={(e) => setDragReservationPaymentMethod(e.target.value)}
                                        >
                                            <option value="">Selecciona una opción</option>
                                            <option value="efectivo">Efectivo</option>
                                            <option value="transferencia">Transferencia</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Sin esta información no se podrá guardar el lead en Reservas ni enviarlo al tablero de compras.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCommentModal(false);
                                    setStatusComment('');
                                    setDragReservationAmount('');
                                    setDragCreditUsedAmount('');
                                    setDragReservationPaymentMethod('');
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmStatusChange}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                            >
                                Guardar y Cambiar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sale Modal */}
            {showSaleModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-fade-in-up border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">Cerrar Venta</h2>
                            <button onClick={() => { setShowSaleModal(false); setSalePurchaseDetail(null); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <div className="bg-green-50 p-4 rounded-lg mb-6 flex items-start gap-3 border border-green-100">
                            <div className="bg-green-100 p-2 rounded-full text-green-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-green-800">¡Felicitaciones!</h3>
                                <p className="text-sm text-green-700">Estás a punto de registrar una venta para <strong>{selectedLeadForSale?.name}</strong>.</p>
                            </div>
                        </div>

                        <form onSubmit={handleConfirmSale} className="space-y-5">
                        {(currentRoleName === 'admin' || currentRoleName === 'super_admin') && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Asignar Venta A:</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                        value={saleForm.seller_id}
                                        onChange={e => setSaleForm({ ...saleForm, seller_id: e.target.value })}
                                    >
                                        <option value="">(Yo mismo) - {user.email}</option>
                                        {advisors.map(adv => (
                                            <option key={adv.id} value={adv.id}>
                                                {adv.full_name || adv.email} - {getDisplayRoleName(adv.role)} {adv.id === getLeadAssignedUserId(selectedLeadForSale) ? '(Asignado)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Vehículo Vendido</label>
                                {loadingSalePurchaseDetail ? (
                                    <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                                        Cargando información del carro comprado...
                                    </div>
                                ) : hasPurchasedVehicleDataForSale ? (
                                    <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                                        <div className="font-bold text-emerald-900">{purchasedVehicleLabelForSale || salePurchaseDetail?.desired_vehicle || 'Vehículo comprado'}</div>
                                        {purchasedVehicleMetaForSale && (
                                            <p className="mt-1 text-sm text-emerald-700">{purchasedVehicleMetaForSale}</p>
                                        )}
                                        <p className="mt-2 text-xs text-emerald-700">
                                            Este carro viene desde compras y ya no necesitas seleccionarlo manualmente.
                                        </p>
                                    </div>
                                ) : (
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                        value={saleForm.vehicle_id}
                                        onChange={e => setSaleForm({ ...saleForm, vehicle_id: e.target.value })}
                                        required={!hasPurchasedVehicleDataForSale}
                                    >
                                        <option value="">Seleccione un vehículo del inventario...</option>
                                        {availableVehicles.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.make} {v.model} ({v.plate}) - ${parseInt(v.price).toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Precio Final de Venta</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono text-lg"
                                        placeholder="0"
                                        value={saleForm.sale_price}
                                        onChange={e => setSaleForm({ ...saleForm, sale_price: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Fotos de la entrega</label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    onChange={(e) => setSaleDeliveryFiles(Array.from(e.target.files || []))}
                                />
                                <p className="mt-2 text-xs text-slate-500">
                                    Estas fotos se guardarán como documentos adjuntos del lead al confirmar la venta.
                                </p>
                                {saleDeliveryFiles.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {saleDeliveryFiles.map((file, index) => (
                                            <span key={`${file.name}-${index}`} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                                {file.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                        {(currentRoleName === 'admin' || currentRoleName === 'super_admin') && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Personas en supervision</label>
                                    <select
                                        multiple
                                        className="h-32 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        value={(newLeadForm.supervisor_ids || []).map(String)}
                                        onChange={e => setNewLeadForm({
                                            ...newLeadForm,
                                            supervisor_ids: Array.from(e.target.selectedOptions)
                                                .map((option) => parseInt(option.value, 10))
                                                .filter((id) => Number.isInteger(id))
                                        })}
                                    >
                                        {supervisionUsers.map((person) => (
                                            <option key={person.id} value={person.id}>
                                                {person.full_name || person.email} - {getDisplayRoleName(person.role)}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Puedes dejar varias personas siguiendo este lead desde el inicio.
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowSaleModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition font-bold"
                                >
                                    Confirmar Venta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <HistoryModal
                    lead={selectedLeadForHistory}
                    onClose={() => setShowHistoryModal(false)}
                    onUpdate={handleUpdateHistory}
                    onUpdateContact={handleUpdateLeadContact}
                    onSaveSupervisors={handleSaveSupervisors}
                    onDeleteLead={handleDeleteLead}
                    advisors={advisors}
                    onAssign={handleAssignLead}
                    onRefreshLeadBoard={fetchLeads}
                    availableVehicles={availableVehicles}
                    currentUserRole={currentRoleName}
                    boardMode={boardMode}
                    loadingDetail={loadingLeadDetail}
                />
            )}

            {/* Add Lead Manual Modal */}
            {showAddLeadModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-fade-in-up border border-gray-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">{isAllyBoard ? 'Nuevo Lead para Cola de Aliados' : 'Nuevo Lead'}</h2>
                            <button onClick={() => setShowAddLeadModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <form onSubmit={handleCreateLead} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={newLeadForm.name}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newLeadForm.phone}
                                        onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Email (Opcional)</label>
                                <input
                                    type="email"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={newLeadForm.email}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                                />
                            </div>
                        </div>

                        {isAllyBoard && currentRoleName !== 'aliado' && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Asignar a aliado</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                                    value={newLeadForm.assigned_to_id}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, assigned_to_id: e.target.value })}
                                >
                                    <option value="">Selecciona un aliado</option>
                                    {allyUsers.map((ally) => (
                                        <option key={ally.id} value={ally.id}>
                                            {ally.full_name || ally.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Fuente</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={newLeadForm.source}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                                >
                                    <option value="web">Web / Directo</option>
                                    <option value="facebook">Facebook Ads</option>
                                    <option value="instagram">Instagram Ads</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="tiktok">TikTok</option>
                                    <option value="referral">Referido</option>
                                    <option value="showroom">Showroom (Físico)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Mensaje / Interés Inicial</label>
                                <textarea
                                    rows="3"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="¿En qué vehículo está interesado?"
                                    value={newLeadForm.message}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, message: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddLeadModal(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={`flex-1 px-4 py-3 text-white rounded-xl transition font-bold shadow-lg ${isAllyBoard ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    {isAllyBoard ? 'Crear y dejar en aliados' : 'Crear Lead'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadsBoard;
