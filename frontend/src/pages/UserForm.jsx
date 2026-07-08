import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import { isRoleAvailableForCompany } from '../config/views';
import { normalizeMediaUrl } from '../utils/media';
import { getEcardPublicUrl, normalizeEcardSlug } from '../utils/ecards';

const API_BASE_URL = import.meta.env.DEV ? '/crm/api' : '/api';

const ROLE_LABELS = {
    super_admin: 'Super Admin Global',
    admin: 'Administrador de Empresa',
    inventario: 'Gestor de Inventario',
    asesor: 'Asesor / Vendedor',
    gestion_creditos: 'Gestión de Créditos',
    aliado: 'Aliado Estratégico',
    compras: 'Gestor de Compras',
    user: 'Usuario Básico',
};

const TAB_ITEMS = [
    {
        id: 'general',
        label: 'General',
        description: 'Perfil, acceso y rol',
    },
    {
        id: 'operacion',
        label: 'Operación',
        description: 'Leads, seguimiento y pagos',
    },
    {
        id: 'ecard',
        label: 'Tarjeta virtual',
        description: 'Tarjeta pública y QR',
    },
];

const INPUT_CLASS = 'w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-black outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500';
const SECTION_CLASS = 'rounded-2xl border border-slate-200 bg-slate-50/80 p-6';

const createInitialUserState = () => ({
    full_name: '',
    email: '',
    password: '',
    role_id: '',
    company_id: '',
    auto_assign_leads: false,
    tracked_advisor_ids: [],
    commission_percentage: 0,
    base_salary: '',
    payment_dates: '',
    ecard_enabled: false,
    ecard_slug: '',
    ecard_photo_url: '',
    ecard_position: '',
    ecard_display_email: '',
    ecard_display_phone: '',
    ecard_headline: '',
    ecard_headline_highlight: '',
    ecard_subheadline: '',
    ecard_visit_title: '',
    ecard_visit_text: '',
    ecard_footer_label_1: '',
    ecard_footer_label_2: '',
    ecard_footer_label_3: '',
    ecard_show_instagram: false,
    ecard_instagram_url: '',
    ecard_show_facebook: false,
    ecard_facebook_url: '',
    ecard_show_tiktok: false,
    ecard_tiktok_url: '',
    ecard_show_whatsapp: true,
    ecard_whatsapp_url: '',
    ecard_header_color: '',
    ecard_header_text_color: '',
    ecard_card_color: '',
    ecard_text_color: '',
    ecard_accent_color: '',
});

const normalizeRoleText = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ');

const getRoleName = (role) => {
    const roleText = [
        role?.base_role_name,
        role?.name,
        role?.label,
    ].map(normalizeRoleText).join(' ');

    if (roleText.includes('super') && (roleText.includes('admin') || roleText.includes('administrador'))) {
        return 'super_admin';
    }
    if (roleText.includes('admin') || roleText.includes('administrador')) {
        return 'admin';
    }
    if (roleText.includes('aliado')) {
        return 'aliado';
    }
    if (roleText.includes('asesor') || roleText.includes('vendedor')) {
        return 'asesor';
    }
    if (roleText.includes('credit')) {
        return 'gestion_creditos';
    }
    if (roleText.includes('compra')) {
        return 'compras';
    }
    if (roleText.includes('inventario')) {
        return 'inventario';
    }
    return role?.base_role_name || role?.name || '';
};

const isAdvisorRole = (role) => getRoleName(role) === 'asesor';

const isActiveUser = (candidate) => candidate?.is_active !== false && candidate?.is_active !== 0;

const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const UserForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const isEditing = Boolean(id);

    const [user, setUser] = useState(createInitialUserState);
    const [companies, setCompanies] = useState([]);
    const [roles, setRoles] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [ecardPhotoFile, setEcardPhotoFile] = useState(null);
    const [ecardQrDataUrl, setEcardQrDataUrl] = useState('');
    const [activeTab, setActiveTab] = useState('general');

    const currentRoleName = getRoleName(currentUser?.role);
    const isSuperAdmin = currentRoleName === 'super_admin';
    const selectedRole = useMemo(
        () => roles.find((role) => String(role.id) === String(user.role_id)),
        [roles, user.role_id]
    );
    const isInventarioRoleSelected = getRoleName(selectedRole) === 'inventario';
    const isAdvisorRoleSelected = isAdvisorRole(selectedRole);
    const canTrackAdvisors = Boolean(selectedRole?.advisor_tracking_enabled);
    const selectedCompany = isSuperAdmin
        ? companies.find((company) => String(company.id) === String(user.company_id))
        : currentUser?.company || null;

    const availableRoles = useMemo(
        () => roles.filter((role) => {
            if (currentUser?.company_id && role.name === 'super_admin') return false;
            return isRoleAvailableForCompany(role, selectedCompany);
        }),
        [roles, currentUser?.company_id, selectedCompany]
    );

    const currentUserAssignableRoleIds = (Array.isArray(currentUser?.role?.assignable_role_ids) ? currentUser.role.assignable_role_ids : [])
        .map((roleId) => Number(roleId))
        .filter((roleId) => Number.isInteger(roleId));

    const advisorTrackingOptions = useMemo(() => {
        const targetCompanyId = user.company_id || currentUser?.company_id || null;
        return availableUsers
            .filter((candidate) => {
                if (String(candidate.id) === String(id)) return false;
                if (!isActiveUser(candidate)) return false;
                if (targetCompanyId && String(candidate.company_id || '') !== String(targetCompanyId)) return false;
                return true;
            })
            .sort((a, b) => String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || '')));
    }, [availableUsers, currentUser?.company_id, id, user.company_id]);

    const reassignmentCandidates = useMemo(() => {
        const targetCompanyId = user.company_id || currentUser?.company_id || null;
        const canAssignAnyRole = ['admin', 'super_admin', 'aliado'].includes(currentRoleName);

        return availableUsers
            .filter((candidate) => {
                if (String(candidate.id) === String(id)) return false;
                if (!isActiveUser(candidate)) return false;
                if (!candidate?.role) return false;
                if (targetCompanyId && String(candidate.company_id || '') !== String(targetCompanyId)) return false;

                const candidateRoleName = getRoleName(candidate.role);
                if (!candidateRoleName || candidateRoleName === 'user') return false;

                if (currentUserAssignableRoleIds.length > 0) {
                    return currentUserAssignableRoleIds.includes(Number(candidate.role?.id));
                }

                return canAssignAnyRole || isAdvisorRole(candidate.role);
            })
            .sort((a, b) => String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || '')));
    }, [availableUsers, currentRoleName, currentUser?.company_id, currentUserAssignableRoleIds, id, user.company_id]);

    const generateTemporaryPassword = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        const nextPassword = Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
        setUser((current) => ({
            ...current,
            password: nextPassword,
        }));
        setShowPassword(true);
    };

    useEffect(() => {
        const fetchDependencies = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token}` };

                const rolesRes = await axios.get(`${API_BASE_URL}/roles/`, { headers });
                setRoles(rolesRes.data);

                const usersRes = await axios.get(`${API_BASE_URL}/users/?limit=1000`, { headers });
                setAvailableUsers(Array.isArray(usersRes.data?.items) ? usersRes.data.items : []);

                if (isSuperAdmin) {
                    const companiesRes = await axios.get(`${API_BASE_URL}/companies/?limit=100`, { headers });
                    setCompanies(Array.isArray(companiesRes.data?.items) ? companiesRes.data.items : []);
                }
            } catch (error) {
                console.error('Error fetching dependencies', error);
            }
        };

        fetchDependencies();
    }, [isSuperAdmin]);

    useEffect(() => {
        if (!isEditing) return;

        const fetchUser = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`${API_BASE_URL}/users/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const { role, ...userData } = response.data;
                const loadedRoleId = userData.role_id || role?.id || '';

                setUser({
                    ...createInitialUserState(),
                    ...userData,
                    role_id: loadedRoleId,
                    auto_assign_leads: Boolean(userData.auto_assign_leads),
                    tracked_advisor_ids: Array.isArray(userData.tracked_advisor_ids)
                        ? userData.tracked_advisor_ids.map((item) => Number(item)).filter((item) => Number.isInteger(item))
                        : [],
                    commission_percentage: userData.commission_percentage ?? 0,
                    base_salary: userData.base_salary ?? '',
                    payment_dates: userData.payment_dates || '',
                    ecard_enabled: Boolean(userData.ecard_enabled),
                    ecard_slug: userData.ecard_slug || normalizeEcardSlug(userData.full_name || userData.email),
                    ecard_photo_url: userData.ecard_photo_url || '',
                    ecard_position: userData.ecard_position || '',
                    ecard_display_email: userData.ecard_display_email || userData.email || '',
                    ecard_display_phone: userData.ecard_display_phone || '',
                    ecard_headline: userData.ecard_headline || '',
                    ecard_headline_highlight: userData.ecard_headline_highlight || '',
                    ecard_subheadline: userData.ecard_subheadline || '',
                    ecard_visit_title: userData.ecard_visit_title || '',
                    ecard_visit_text: userData.ecard_visit_text || '',
                    ecard_footer_label_1: userData.ecard_footer_label_1 || '',
                    ecard_footer_label_2: userData.ecard_footer_label_2 || '',
                    ecard_footer_label_3: userData.ecard_footer_label_3 || '',
                    ecard_show_instagram: Boolean(userData.ecard_show_instagram),
                    ecard_instagram_url: userData.ecard_instagram_url || '',
                    ecard_show_facebook: Boolean(userData.ecard_show_facebook),
                    ecard_facebook_url: userData.ecard_facebook_url || '',
                    ecard_show_tiktok: Boolean(userData.ecard_show_tiktok),
                    ecard_tiktok_url: userData.ecard_tiktok_url || '',
                    ecard_show_whatsapp: userData.ecard_show_whatsapp !== false,
                    ecard_whatsapp_url: userData.ecard_whatsapp_url || '',
                    ecard_header_color: userData.ecard_header_color || '',
                    ecard_header_text_color: userData.ecard_header_text_color || '',
                    ecard_card_color: userData.ecard_card_color || '',
                    ecard_text_color: userData.ecard_text_color || '',
                    ecard_accent_color: userData.ecard_accent_color || '',
                    password: '',
                });
            } catch (error) {
                console.error('Error fetching user', error);
                const detail = error.response?.data?.detail || error.message;
                setStatus({ type: 'error', message: `Error al cargar: ${detail}` });
            }
        };

        fetchUser();
    }, [id, isEditing]);

    const ecardPhotoPreview = useMemo(
        () => (ecardPhotoFile ? URL.createObjectURL(ecardPhotoFile) : normalizeMediaUrl(user.ecard_photo_url)),
        [ecardPhotoFile, user.ecard_photo_url]
    );

    useEffect(() => {
        if (!ecardPhotoFile || !ecardPhotoPreview) return undefined;
        return () => URL.revokeObjectURL(ecardPhotoPreview);
    }, [ecardPhotoFile, ecardPhotoPreview]);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        const nextValue = type === 'checkbox' ? checked : name === 'ecard_slug' ? normalizeEcardSlug(value) : value;

        if (name === 'role_id') {
            const nextRole = availableRoles.find((role) => String(role.id) === String(nextValue));
            const nextCanTrackAdvisors = Boolean(nextRole?.advisor_tracking_enabled);
            setUser((current) => ({
                ...current,
                role_id: nextValue,
                auto_assign_leads: isAdvisorRole(nextRole) ? Boolean(current.auto_assign_leads) : false,
                tracked_advisor_ids: nextCanTrackAdvisors ? current.tracked_advisor_ids : [],
            }));
            return;
        }

        if (name === 'company_id' && isSuperAdmin) {
            const nextCompany = companies.find((company) => String(company.id) === String(nextValue)) || null;
            const nextAvailableRoles = roles.filter((role) => isRoleAvailableForCompany(role, nextCompany));
            const roleStillAvailable = nextAvailableRoles.some((role) => String(role.id) === String(user.role_id));

            setUser((current) => ({
                ...current,
                company_id: nextValue,
                role_id: roleStillAvailable ? current.role_id : '',
                auto_assign_leads: roleStillAvailable ? current.auto_assign_leads : false,
                tracked_advisor_ids: [],
            }));
            return;
        }

        setUser((current) => ({
            ...current,
            [name]: nextValue,
            ...(name === 'full_name' && !current.ecard_slug ? { ecard_slug: normalizeEcardSlug(value) } : {}),
        }));
    };

    const handleSave = async (event) => {
        event.preventDefault();
        setStatus({ type: 'loading', message: 'Guardando...' });

        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const payload = { ...user };

            if (isEditing && !payload.password) {
                delete payload.password;
            }

            if (payload.company_id === '' || payload.company_id === '0') {
                payload.company_id = null;
            } else if (payload.company_id) {
                payload.company_id = parseInt(payload.company_id, 10);
            }

            if (payload.role_id) {
                payload.role_id = parseInt(payload.role_id, 10);
            }

            payload.auto_assign_leads = Boolean(payload.auto_assign_leads);
            payload.commission_percentage = payload.commission_percentage === '' || payload.commission_percentage == null
                ? 0
                : Number(payload.commission_percentage);
            payload.base_salary = payload.base_salary === '' || payload.base_salary == null
                ? null
                : parseInt(payload.base_salary, 10);
            payload.payment_dates = (payload.payment_dates || '').trim() || null;

            const selectedRoleForSave = roles.find((role) => role.id === payload.role_id);
            if (!selectedRoleForSave) {
                throw new Error('Debes seleccionar un rol válido para guardar el usuario.');
            }
            payload.tracked_advisor_ids = selectedRoleForSave?.advisor_tracking_enabled
                ? (Array.isArray(payload.tracked_advisor_ids) ? payload.tracked_advisor_ids : [])
                    .map((item) => Number(item))
                    .filter((item) => Number.isInteger(item))
                : [];

            if (getRoleName(selectedRoleForSave) === 'inventario') {
                payload.commission_percentage = 0;
                payload.base_salary = null;
                payload.payment_dates = null;
            }

            if (!isAdvisorRole(selectedRoleForSave)) {
                payload.auto_assign_leads = false;
            }

            let savedUser = null;
            if (isEditing) {
                const response = await axios.put(`${API_BASE_URL}/users/${id}`, payload, { headers });
                savedUser = response.data;
                setStatus({ type: 'success', message: 'Usuario actualizado exitosamente.' });
            } else {
                const response = await axios.post(`${API_BASE_URL}/users/`, payload, { headers });
                savedUser = response.data;
                setStatus({ type: 'success', message: 'Usuario creado exitosamente.' });
            }

            if (ecardPhotoFile && savedUser?.id) {
                const photoPayload = new FormData();
                photoPayload.append('file', ecardPhotoFile);
                await axios.post(`${API_BASE_URL}/users/${savedUser.id}/ecard-photo`, photoPayload, {
                    headers: { ...headers, 'Content-Type': 'multipart/form-data' },
                });
            }

            setTimeout(() => {
                navigate('/admin/users');
            }, 1000);
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.detail || 'Error al conectar con el servidor';
            setStatus({ type: 'error', message: `Error: ${errorMsg}` });
        }
    };

    const ecardPublicUrl = getEcardPublicUrl(selectedCompany, user.ecard_slug);

    useEffect(() => {
        let ignore = false;
        if (!ecardPublicUrl) return undefined;

        QRCode.toDataURL(ecardPublicUrl, {
            width: 320,
            margin: 2,
            color: {
                dark: '#0f172a',
                light: '#ffffff',
            },
            errorCorrectionLevel: 'M',
        }).then((dataUrl) => {
            if (!ignore) setEcardQrDataUrl(dataUrl);
        }).catch(() => {
            if (!ignore) setEcardQrDataUrl('');
        });

        return () => {
            ignore = true;
        };
    }, [ecardPublicUrl]);

    const visibleEcardQrDataUrl = ecardPublicUrl ? ecardQrDataUrl : '';

    const downloadEcardQr = () => {
        if (!visibleEcardQrDataUrl) return;
        const link = document.createElement('a');
        link.href = visibleEcardQrDataUrl;
        link.download = `qr-${user.ecard_slug || 'tarjeta'}.png`;
        link.click();
    };

    const handleDelete = async () => {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        let assignedLeadCount = 0;

        try {
            const leadsResponse = await axios.get(`${API_BASE_URL}/leads`, {
                params: {
                    assigned_to_id: id,
                    limit: 1,
                },
                headers,
            });
            assignedLeadCount = Number(leadsResponse.data?.total || 0);
        } catch (error) {
            console.error('Error fetching assigned leads count', error);
        }

        if (assignedLeadCount > 0 && reassignmentCandidates.length === 0) {
            Swal.fire(
                'Sin destinatarios disponibles',
                'Este usuario tiene leads asignados y no hay otro usuario activo y válido para recibirlos en esta empresa.',
                'warning'
            );
            return;
        }

        const placeholderOption = assignedLeadCount > 0
            ? '<option value="">Selecciona un usuario</option>'
            : '<option value="">Sin reasignación</option>';

        const reassignmentOptions = reassignmentCandidates
            .map((candidate) => `
                <option value="${candidate.id}">
                    ${escapeHtml(candidate.full_name || candidate.email)}${candidate.role?.label ? ` - ${escapeHtml(candidate.role.label)}` : ''}
                </option>
            `)
            .join('');

        const result = await Swal.fire({
            title: 'Inhabilitar usuario',
            html: `
                <div style="text-align:left">
                    <p style="margin-bottom:12px;">
                        El usuario no se eliminará físicamente. Se inhabilitará para conservar métricas e historial.
                    </p>
                    <p style="margin-bottom:12px;font-size:13px;color:#475569;">
                        ${assignedLeadCount > 0
                            ? `Tiene <strong>${assignedLeadCount}</strong> lead(s) asignado(s). Debes elegir quién continuará la gestión.`
                            : 'No tiene leads asignados en este momento.'}
                    </p>
                    <label for="reassign-user-select" style="display:block;margin-bottom:6px;font-weight:600;">
                        ${assignedLeadCount > 0 ? 'Pasar leads a:' : 'Destino opcional para leads futuros:'}
                    </label>
                    <select id="reassign-user-select" class="swal2-select" style="display:flex;width:100%;margin:0;">
                        ${placeholderOption}
                        ${reassignmentOptions}
                    </select>
                    <p style="margin-top:10px;font-size:12px;color:#64748b;">
                        Los leads se transfieren conservando el mismo estado en el que están actualmente.
                    </p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, inhabilitar',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const select = document.getElementById('reassign-user-select');
                const selectedValue = select?.value ? parseInt(select.value, 10) : null;

                if (assignedLeadCount > 0 && !selectedValue) {
                    Swal.showValidationMessage('Debes elegir un usuario para recibir los leads antes de inhabilitar.');
                    return false;
                }

                return {
                    reassign_leads_to_user_id: selectedValue,
                };
            },
        });

        if (!result.isConfirmed) return;

        setStatus({ type: 'loading', message: 'Inhabilitando...' });
        try {
            const response = await axios.delete(`${API_BASE_URL}/users/${id}`, {
                headers,
                data: result.value || {},
            });

            const reassignedCount = Number(response.data?.reassigned_leads || 0);
            Swal.fire(
                'Usuario inhabilitado',
                reassignedCount > 0
                    ? `El usuario quedó inhabilitado y ${reassignedCount} lead(s) se reasignaron conservando su estado actual.`
                    : 'El usuario ya no estará visible ni podrá iniciar sesión.',
                'success'
            );
            navigate('/admin/users');
        } catch (error) {
            console.error('Error deleting user', error);
            const errorMsg = error.response?.data?.detail || 'No se pudo inhabilitar el usuario';
            setStatus({ type: 'error', message: `Error: ${errorMsg}` });
            Swal.fire('Error', errorMsg, 'error');
        }
    };

    const renderGeneralTab = () => (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_320px]">
            <div className="space-y-6">
                <section className={SECTION_CLASS}>
                    <div className="mb-5">
                        <h2 className="text-lg font-extrabold text-slate-800">Datos del usuario</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Información principal para identificar al usuario dentro del CRM.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-slate-600">Nombre completo</label>
                            <input
                                type="text"
                                name="full_name"
                                value={user.full_name || ''}
                                onChange={handleChange}
                                placeholder="Ej: Juan Pérez"
                                className={INPUT_CLASS}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
                            <input
                                type="email"
                                name="email"
                                required
                                value={user.email}
                                onChange={handleChange}
                                className={INPUT_CLASS}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-slate-600">
                                Contraseña {isEditing ? '(dejar en blanco para mantener la actual)' : ''}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required={!isEditing}
                                    value={user.password}
                                    onChange={handleChange}
                                    className={`${INPUT_CLASS} pr-12`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((current) => !current)}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 transition hover:text-blue-600"
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {showPassword ? (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 3l18 18" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.584 10.587A2 2 0 0013.414 13.417" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9.88 5.09A9.953 9.953 0 0112 4.8c5.05 0 9.27 3.11 10.8 7.5a11.827 11.827 0 01-4.04 5.58M6.61 6.61A11.836 11.836 0 001.2 12.3a11.817 11.817 0 005.6 6.3 9.954 9.954 0 005.2 1.4 9.948 9.948 0 003.07-.48" />
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z" />
                                            <circle cx="12" cy="12" r="3" strokeWidth="1.8" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={SECTION_CLASS}>
                    <div className="mb-5">
                        <h2 className="text-lg font-extrabold text-slate-800">Rol y alcance</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Define el perfil del usuario y la empresa sobre la que trabajará.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600">Rol</label>
                            <select
                                name="role_id"
                                value={user.role_id}
                                onChange={handleChange}
                                required
                                className={INPUT_CLASS}
                            >
                                <option value="">Seleccionar rol</option>
                                {availableRoles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                        {ROLE_LABELS[role.name] || role.label || role.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {isSuperAdmin ? (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-600">Empresa</label>
                                <select
                                    name="company_id"
                                    value={user.company_id || ''}
                                    onChange={handleChange}
                                    className={INPUT_CLASS}
                                >
                                    <option value="">Sin empresa (global)</option>
                                    {companies.map((company) => (
                                        <option key={company.id} value={company.id}>
                                            {company.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-600">Empresa</label>
                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-700">
                                    {currentUser?.company?.name || 'Empresa actual'}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <aside className="space-y-6">
                <section className={`${SECTION_CLASS} bg-slate-900 text-white`}>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">Resumen</p>
                    <h2 className="mt-3 text-2xl font-extrabold">
                        {user.full_name || user.email || 'Usuario nuevo'}
                    </h2>
                    <div className="mt-4 space-y-3 text-sm text-slate-200">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Rol seleccionado</p>
                            <p className="mt-1 font-semibold text-white">
                                {selectedRole ? (ROLE_LABELS[selectedRole.name] || selectedRole.label || selectedRole.name) : 'Sin definir'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Empresa</p>
                            <p className="mt-1 font-semibold text-white">
                                {selectedCompany?.name || currentUser?.company?.name || 'Global'}
                            </p>
                        </div>
                    </div>
                </section>

                {isEditing && (
                    <section className={SECTION_CLASS}>
                        <h2 className="text-base font-extrabold text-slate-800">Acceso rápido</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            La contraseña actual no se puede mostrar porque se guarda con hash seguro.
                        </p>
                        <button
                            type="button"
                            onClick={generateTemporaryPassword}
                            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                        >
                            Generar contraseña temporal
                        </button>
                    </section>
                )}
            </aside>
        </div>
    );

    const renderOperationTab = () => (
        <div className="space-y-6">
            {isInventarioRoleSelected ? (
                <section className={SECTION_CLASS}>
                    <h2 className="text-lg font-extrabold text-slate-800">Configuración comercial no aplica</h2>
                    <p className="mt-2 text-sm text-slate-500">
                        El rol de inventario no participa en asignación automática de leads ni usa campos de comisión o nómina comercial.
                    </p>
                </section>
            ) : (
                <>
                    {isAdvisorRoleSelected && (
                        <section className={SECTION_CLASS}>
                            <h2 className="text-lg font-extrabold text-slate-800">Recepción de leads</h2>
                            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4">
                                <input
                                    type="checkbox"
                                    name="auto_assign_leads"
                                    checked={Boolean(user.auto_assign_leads)}
                                    onChange={handleChange}
                                    className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="block text-sm font-semibold text-slate-700">Permitir asignación automática</span>
                                    <span className="mt-1 block text-xs text-slate-500">
                                        Si está activo, este usuario podrá recibir leads nuevos por asignación automática y entrar en redistribuciones automáticas cuando aplique.
                                    </span>
                                </div>
                            </label>
                        </section>
                    )}

                    {canTrackAdvisors && (
                        <section className={SECTION_CLASS}>
                            <div className="mb-4">
                                <h2 className="text-lg font-extrabold text-slate-800">Usuarios en supervisión</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Selecciona qué usuarios de la empresa podrá monitorear este perfil en sus tableros.
                                </p>
                            </div>

                            {advisorTrackingOptions.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {advisorTrackingOptions.map((candidate) => {
                                        const candidateId = Number(candidate.id);
                                        const checked = Array.isArray(user.tracked_advisor_ids) && user.tracked_advisor_ids.includes(candidateId);
                                        return (
                                            <label
                                                key={candidate.id}
                                                className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-4 py-4 transition ${
                                                    checked ? 'border-blue-400 bg-blue-50' : 'border-blue-100 hover:border-blue-300'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => setUser((current) => {
                                                        const currentIds = Array.isArray(current.tracked_advisor_ids) ? current.tracked_advisor_ids : [];
                                                        const nextIds = currentIds.includes(candidateId)
                                                            ? currentIds.filter((advisorId) => advisorId !== candidateId)
                                                            : [...currentIds, candidateId];
                                                        return { ...current, tracked_advisor_ids: nextIds };
                                                    })}
                                                    className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div>
                                                    <span className="block text-sm font-semibold text-slate-700">
                                                        {candidate.full_name || candidate.email}
                                                    </span>
                                                    <span className="mt-1 block text-xs text-slate-500">
                                                        {candidate.email}{candidate.role?.label ? ` - ${candidate.role.label}` : ''}
                                                    </span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="rounded-xl border border-blue-100 bg-white px-4 py-4 text-sm text-slate-500">
                                    No hay usuarios activos disponibles para esta empresa.
                                </p>
                            )}
                        </section>
                    )}

                    <section className={SECTION_CLASS}>
                        <div className="mb-5">
                            <h2 className="text-lg font-extrabold text-slate-800">Compensación</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Configuración comercial y administrativa asociada al usuario.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-600">Comisión (%)</label>
                                <input
                                    type="number"
                                    name="commission_percentage"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={user.commission_percentage ?? 0}
                                    onChange={handleChange}
                                    placeholder="Ej: 5.0"
                                    className={INPUT_CLASS}
                                />
                                <p className="mt-1 text-xs text-slate-400">Porcentaje aplicado a las ventas de este usuario.</p>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-600">Sueldo base</label>
                                <input
                                    type="number"
                                    name="base_salary"
                                    value={user.base_salary ?? ''}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className={INPUT_CLASS}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-600">Fechas de pago</label>
                                <input
                                    type="text"
                                    name="payment_dates"
                                    value={user.payment_dates || ''}
                                    onChange={handleChange}
                                    placeholder="Ej: 15 y 30"
                                    className={INPUT_CLASS}
                                />
                            </div>
                        </div>
                    </section>

                    {!isAdvisorRoleSelected && !canTrackAdvisors && (
                        <section className={SECTION_CLASS}>
                            <h2 className="text-base font-extrabold text-slate-800">Configuración adicional</h2>
                            <p className="mt-2 text-sm text-slate-500">
                                Este rol no recibe leads por asignación automática ni supervisa otros usuarios, pero sí puede conservar información de compensación si la operación lo necesita.
                            </p>
                        </section>
                    )}
                </>
            )}
        </div>
    );

    const renderEcardTab = () => (
        <div className="space-y-6">
            <section className={SECTION_CLASS}>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-800">Tarjeta virtual pública</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Carnet digital del empleado para compartir con clientes.
                        </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                        <input
                            type="checkbox"
                            name="ecard_enabled"
                            checked={Boolean(user.ecard_enabled)}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                        Habilitada
                    </label>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-600">URL pública</label>
                        <div className="flex gap-2">
                            <span className="flex items-center rounded-xl border border-blue-100 bg-white px-3 text-sm text-slate-500">
                                /crm/nuestroequipo/
                            </span>
                            <input
                                type="text"
                                name="ecard_slug"
                                value={user.ecard_slug || ''}
                                onChange={handleChange}
                                placeholder="juan-perez"
                                className={`${INPUT_CLASS} min-w-0 flex-1`}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-600">Cargo visible</label>
                        <input
                            type="text"
                            name="ecard_position"
                            value={user.ecard_position || ''}
                            onChange={handleChange}
                            placeholder="Ej: Asesor comercial"
                            className={INPUT_CLASS}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-600">Email a mostrar</label>
                        <input
                            type="email"
                            name="ecard_display_email"
                            value={user.ecard_display_email || ''}
                            onChange={handleChange}
                            placeholder={user.email || 'correo@empresa.com'}
                            className={INPUT_CLASS}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-600">Teléfono / WhatsApp a mostrar</label>
                        <input
                            type="text"
                            name="ecard_display_phone"
                            value={user.ecard_display_phone || ''}
                            onChange={handleChange}
                            placeholder={selectedCompany?.contact_phone || 'Ej: 3001234567'}
                            className={INPUT_CLASS}
                        />
                        <p className="mt-1 text-xs text-slate-500">
                            Si lo dejas vacío, la tarjeta usará el teléfono configurado en la empresa.
                        </p>
                    </div>

                    <div className="md:col-span-2">
                        <p className="mb-3 text-sm font-semibold text-slate-700">Colores de la tarjeta</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {[
                                ['ecard_header_color', 'Cabecera', selectedCompany?.secondary_color || '#071225'],
                                ['ecard_header_text_color', 'Texto cabecera', '#ffffff'],
                                ['ecard_card_color', 'Card', '#ffffff'],
                                ['ecard_text_color', 'Texto principal', '#071225'],
                                ['ecard_accent_color', 'Acento / botón', selectedCompany?.primary_color || '#2fe6bd'],
                            ].map(([fieldName, label, defaultColor]) => (
                                <label key={fieldName} className="rounded-xl border border-blue-100 bg-white p-3">
                                    <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            name={fieldName}
                                            value={user[fieldName] || defaultColor}
                                            onChange={handleChange}
                                            className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-white p-1"
                                        />
                                        <input
                                            type="text"
                                            name={fieldName}
                                            value={user[fieldName] || ''}
                                            onChange={handleChange}
                                            placeholder={defaultColor}
                                            className="min-w-0 flex-1 rounded-lg border border-blue-100 px-3 py-2 text-sm text-slate-700"
                                        />
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <p className="mb-3 text-sm font-semibold text-slate-700">Textos de la tarjeta</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {[
                                ['ecard_headline', 'Título cabecera', 'Gracias por confiar'],
                                ['ecard_headline_highlight', 'Texto destacado', 'en nosotros'],
                                ['ecard_subheadline', 'Subtítulo cabecera', 'Estamos aquí para ayudarte a encontrar el carro ideal.'],
                                ['ecard_visit_title', 'Título de visita', 'Visítanos en nuestra empresa'],
                                ['ecard_visit_text', 'Texto de visita', 'Conoce nuestras instalaciones y encuentra tu próximo carro.'],
                                ['ecard_footer_label_1', 'Texto inferior 1', 'Transparencia'],
                                ['ecard_footer_label_2', 'Texto inferior 2', 'Confianza'],
                                ['ecard_footer_label_3', 'Texto inferior 3', 'Calidad'],
                            ].map(([fieldName, label, placeholder]) => (
                                <label
                                    key={fieldName}
                                    className={fieldName === 'ecard_subheadline' || fieldName === 'ecard_visit_text' ? 'md:col-span-2' : ''}
                                >
                                    <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
                                    <input
                                        type="text"
                                        name={fieldName}
                                        value={user[fieldName] || ''}
                                        onChange={handleChange}
                                        placeholder={placeholder}
                                        className={INPUT_CLASS}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <p className="mb-3 text-sm font-semibold text-slate-700">Redes sociales visibles</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {[
                                ['instagram', 'Instagram'],
                                ['facebook', 'Facebook'],
                                ['tiktok', 'TikTok'],
                                ['whatsapp', 'WhatsApp'],
                            ].map(([network, label]) => {
                                const showField = `ecard_show_${network}`;
                                const urlField = `ecard_${network}_url`;
                                return (
                                    <div key={network} className="rounded-xl border border-blue-100 bg-white p-3">
                                        <label className="mb-3 flex items-center gap-3 text-sm font-semibold text-slate-700">
                                            <input
                                                type="checkbox"
                                                name={showField}
                                                checked={Boolean(user[showField])}
                                                onChange={handleChange}
                                                className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            Mostrar {label}
                                        </label>
                                        <input
                                            type="url"
                                            name={urlField}
                                            value={user[urlField] || ''}
                                            onChange={handleChange}
                                            placeholder={network === 'whatsapp' ? 'https://wa.me/573001234567' : `Link de ${label}`}
                                            className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-slate-700"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            Para WhatsApp puedes dejar el link vacío y se usará el teléfono configurado en la tarjeta.
                        </p>
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-600">Foto del empleado</label>
                        <div className="grid gap-4 rounded-2xl border border-dashed border-blue-200 bg-white p-4 md:grid-cols-[120px_1fr] md:items-center">
                            <div className="h-28 w-28 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                                {ecardPhotoPreview ? (
                                    <img src={ecardPhotoPreview} alt="Vista previa tarjeta" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                                        Sin imagen
                                    </div>
                                )}
                            </div>
                            <div>
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={(event) => setEcardPhotoFile(event.target.files?.[0] || null)}
                                    className="w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
                                />
                                <p className="mt-2 text-xs text-slate-500">
                                    Puedes usar JPG, PNG o WEBP. La imagen se mostrará en la tarjeta pública.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {ecardPublicUrl && (
                <section className={SECTION_CLASS}>
                    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                            {visibleEcardQrDataUrl ? (
                                <img src={visibleEcardQrDataUrl} alt="QR de tarjeta virtual" className="h-36 w-36 rounded-lg bg-white p-1" />
                            ) : (
                                <div className="flex h-36 w-36 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-400">
                                    QR
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={downloadEcardQr}
                                disabled={!visibleEcardQrDataUrl}
                                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Descargar QR
                            </button>
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Acceso para compartir</p>
                            <div className="flex flex-col gap-2">
                                <input
                                    value={ecardPublicUrl}
                                    readOnly
                                    className="min-w-0 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700"
                                />
                                <div className="flex flex-col gap-2 md:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => navigator.clipboard?.writeText(ecardPublicUrl)}
                                        className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                                    >
                                        Copiar enlace
                                    </button>
                                    <a
                                        href={ecardPublicUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-slate-800"
                                    >
                                        Ver tarjeta
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );

    return (
        <div>
            <header className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-800 md:text-4xl">
                    {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h1>
                <p className="mt-2 text-slate-500">
                    {isEditing ? 'Configura el usuario por pestañas para trabajar más rápido.' : 'Crea un nuevo usuario en el sistema.'}
                </p>
            </header>

            {status.message && (
                <div className={`mb-6 rounded-xl p-4 font-bold text-white ${
                    status.type === 'error'
                        ? 'bg-red-500'
                        : status.type === 'success'
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                }`}>
                    {status.message}
                </div>
            )}

            <div className="max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-6 md:px-8">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Configuración</p>
                            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
                                {user.full_name || user.email || (isEditing ? 'Usuario' : 'Nuevo perfil')}
                            </h2>
                        </div>

                        {isEditing && (currentRoleName === 'super_admin' || currentRoleName === 'admin') && (
                            <p className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Al inhabilitar, si el usuario tiene leads podrás escoger a quién pasarlos y conservarán el mismo estado actual.
                            </p>
                        )}
                    </div>

                    <div className="mt-6 flex gap-3 overflow-x-auto pb-1">
                        {TAB_ITEMS.map((tab) => {
                            const isCurrent = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`min-w-[210px] rounded-2xl border px-4 py-3 text-left transition ${
                                        isCurrent
                                            ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="block text-sm font-extrabold">{tab.label}</span>
                                    <span className={`mt-1 block text-xs ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                                        {tab.description}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-8 px-6 py-6 md:px-8 md:py-8">
                    {activeTab === 'general' && renderGeneralTab()}
                    {activeTab === 'operacion' && renderOperationTab()}
                    {activeTab === 'ecard' && renderEcardTab()}

                    <div className="flex flex-col gap-4 border-t border-slate-200 pt-6 md:flex-row">
                        <button
                            type="submit"
                            disabled={status.type === 'loading'}
                            className="flex-1 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {status.type === 'loading' ? 'Guardando...' : 'Guardar usuario'}
                        </button>

                        {isEditing && (currentRoleName === 'super_admin' || currentRoleName === 'admin') && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={status.type === 'loading'}
                                className="flex-1 rounded-xl bg-red-600 px-6 py-3 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                Inhabilitar usuario
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserForm;
