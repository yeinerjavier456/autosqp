import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import { isRoleAvailableForCompany } from '../config/views';
import { normalizeMediaUrl } from '../utils/media';
import { getEcardPublicUrl, normalizeEcardSlug } from '../utils/ecards';

const API_BASE_URL = import.meta.env.DEV ? '/crm/api' : '/api';

const UserForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const [user, setUser] = useState({
        full_name: '',
        email: '',
        password: '',
        role_id: '',
        company_id: '',
        auto_assign_leads: false,
        tracked_advisor_ids: [],
        ecard_enabled: false,
        ecard_slug: '',
        ecard_photo_url: '',
        ecard_position: '',
    });
    const [companies, setCompanies] = useState([]);
    const [roles, setRoles] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [ecardPhotoFile, setEcardPhotoFile] = useState(null);
    const [ecardPhotoPreview, setEcardPhotoPreview] = useState('');
    const [ecardQrDataUrl, setEcardQrDataUrl] = useState('');

    const ROLE_LABELS = {
        super_admin: 'Super Admin Global',
        admin: 'Administrador de Empresa',
        inventario: 'Gestor de Inventario (crear/editar vehículos)',
        asesor: 'Asesor / Vendedor',
        gestion_creditos: 'Gestión de Créditos',
        aliado: 'Aliado Estratégico',
        compras: 'Gestor de Compras',
        user: 'Usuario Básico',
    };
    const normalizeRoleText = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_-]+/g, ' ');
    const isAdvisorRole = (role) => {
        const roleText = [
            role?.base_role_name,
            role?.name,
            role?.label,
        ].map(normalizeRoleText).join(' ');
        return roleText.includes('asesor') || roleText.includes('vendedor');
    };
    const selectedRole = roles.find(r => String(r.id) === String(user.role_id));
    const isInventarioRoleSelected = (selectedRole?.base_role_name || selectedRole?.name) === 'inventario';
    const isAdvisorRoleSelected = isAdvisorRole(selectedRole);
    const canTrackAdvisors = Boolean(selectedRole?.advisor_tracking_enabled);
    const currentRoleName = currentUser?.role?.base_role_name || currentUser?.role?.name;
    const isSuperAdmin = currentRoleName === 'super_admin';
    const selectedCompany = isSuperAdmin
        ? companies.find((company) => String(company.id) === String(user.company_id))
        : currentUser?.company || null;
    const availableRoles = roles.filter((role) => {
        if (currentUser?.company_id && role.name === 'super_admin') return false;
        return isRoleAvailableForCompany(role, selectedCompany);
    });
    const advisorTrackingOptions = React.useMemo(() => {
        const targetCompanyId = user.company_id || currentUser?.company_id || null;
        return availableUsers
            .filter((candidate) => {
                if (String(candidate.id) === String(id)) return false;
                if (candidate?.is_active === false || candidate?.is_active === 0) return false;
                if (!isAdvisorCandidate(candidate)) return false;
                if (targetCompanyId && String(candidate.company_id || '') !== String(targetCompanyId)) return false;
                return true;
            })
            .sort((a, b) => String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || '')));
    }, [availableUsers, currentUser?.company_id, id, user.company_id]);

    const generateTemporaryPassword = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        const nextPassword = Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
        setUser((current) => ({
            ...current,
            password: nextPassword,
        }));
        setShowPassword(true);
    };

    function isAdvisorCandidate(candidate) {
        const roleName = (
            candidate?.role?.base_role_name ||
            candidate?.role?.name ||
            candidate?.role?.label ||
            ''
        ).toString().trim().toLowerCase();

        return roleName.includes('asesor') || roleName.includes('vendedor');
    }

    useEffect(() => {
        const fetchDependencies = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token}` };

                // Fetch Roles
                const rolesRes = await axios.get(`${API_BASE_URL}/roles/`, { headers });
                setRoles(rolesRes.data);

                const usersRes = await axios.get(`${API_BASE_URL}/users/?limit=1000`, { headers });
                setAvailableUsers(Array.isArray(usersRes.data?.items) ? usersRes.data.items : []);

                // Fetch Companies if Super Admin
                if (isSuperAdmin) {
                    const compRes = await axios.get(`${API_BASE_URL}/companies/?limit=100`, { headers });
                    setCompanies(compRes.data.items);
                }
            } catch (error) {
                console.error("Error fetching dependencies", error);
            }
        };
        fetchDependencies();

        if (id) {
            setIsEditing(true);
            const fetchUser = async () => {
                try {
                    const token = localStorage.getItem('token');
                    console.log(`Fetching user ${id}...`);
                    const response = await axios.get(`${API_BASE_URL}/users/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    console.log("User data loaded:", response.data);

                    const { hashed_password, role, ...userData } = response.data;

                    // Logic to determine correct role_id from response
                    // Priorities: userData.role_id -> role object -> nothing
                    let loadedRoleId = userData.role_id;
                    if (!loadedRoleId && role && role.id) {
                        loadedRoleId = role.id;
                    }

                    setUser({
                        ...userData,
                        role_id: loadedRoleId || '',
                        auto_assign_leads: Boolean(userData.auto_assign_leads),
                        ecard_enabled: Boolean(userData.ecard_enabled),
                        ecard_slug: userData.ecard_slug || normalizeEcardSlug(userData.full_name || userData.email),
                        ecard_photo_url: userData.ecard_photo_url || '',
                        ecard_position: userData.ecard_position || '',
                        tracked_advisor_ids: Array.isArray(userData.tracked_advisor_ids)
                            ? userData.tracked_advisor_ids.map((item) => Number(item)).filter((item) => Number.isInteger(item))
                            : [],
                        password: ''
                    });
                } catch (error) {
                    console.error("Error fetching user", error);
                    const detail = error.response?.data?.detail || error.message;
                    setStatus({ type: 'error', message: `Error al cargar: ${detail}` });
                }
            };
            fetchUser();
        }
    }, [id, currentUser, isSuperAdmin]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const nextValue = type === 'checkbox' ? checked : name === 'ecard_slug' ? normalizeEcardSlug(value) : value;
        if (name === 'role_id') {
            const nextRole = availableRoles.find((role) => String(role.id) === String(nextValue));
            const nextIsAdvisorRole = isAdvisorRole(nextRole);
            const nextCanTrackAdvisors = Boolean(nextRole?.advisor_tracking_enabled);
            setUser({
                ...user,
                role_id: nextValue,
                auto_assign_leads: nextIsAdvisorRole ? Boolean(user.auto_assign_leads) : false,
                tracked_advisor_ids: nextCanTrackAdvisors ? user.tracked_advisor_ids : [],
            });
            return;
        }
        setUser({
            ...user,
            [name]: nextValue,
            ...(name === 'full_name' && !user.ecard_slug ? { ecard_slug: normalizeEcardSlug(value) } : {}),
        });
    };

    useEffect(() => {
        if (!user.role_id) return;
        const roleStillAvailable = availableRoles.some((role) => String(role.id) === String(user.role_id));
        if (!roleStillAvailable) {
            setUser((current) => ({
                ...current,
                role_id: '',
                auto_assign_leads: false,
                tracked_advisor_ids: [],
            }));
        }
    }, [availableRoles, user.role_id]);

    useEffect(() => {
        if (!canTrackAdvisors) return;
        const availableIds = new Set(advisorTrackingOptions.map((candidate) => Number(candidate.id)));
        setUser((current) => {
            const currentIds = Array.isArray(current.tracked_advisor_ids) ? current.tracked_advisor_ids : [];
            const nextIds = currentIds.filter((advisorId) => availableIds.has(Number(advisorId)));
            if (nextIds.length === currentIds.length) return current;
            return { ...current, tracked_advisor_ids: nextIds };
        });
    }, [advisorTrackingOptions, canTrackAdvisors]);

    useEffect(() => {
        if (!ecardPhotoFile) {
            setEcardPhotoPreview(normalizeMediaUrl(user.ecard_photo_url));
            return undefined;
        }
        const objectUrl = URL.createObjectURL(ecardPhotoFile);
        setEcardPhotoPreview(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [ecardPhotoFile, user.ecard_photo_url]);

    const handleSave = async (e) => {
        e.preventDefault();
        setStatus({ type: 'loading', message: 'Guardando...' });
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Prepare payload. Remove password if empty on edit.
            const payload = { ...user };
            if (isEditing && !payload.password) {
                delete payload.password;
            }
            if (payload.company_id === '' || payload.company_id === '0') {
                payload.company_id = null;
            } else if (payload.company_id) {
                payload.company_id = parseInt(payload.company_id);
            }
            // Ensure role_id is integer
            if (payload.role_id) {
                payload.role_id = parseInt(payload.role_id);
            }
            payload.auto_assign_leads = Boolean(payload.auto_assign_leads);

            // Inventory role must not persist payroll/commission fields
            const selectedRoleForSave = roles.find(r => r.id === payload.role_id);
            payload.tracked_advisor_ids = selectedRoleForSave?.advisor_tracking_enabled
                ? (Array.isArray(payload.tracked_advisor_ids) ? payload.tracked_advisor_ids : [])
                    .map((item) => Number(item))
                    .filter((item) => Number.isInteger(item))
                : [];
            if ((selectedRoleForSave?.base_role_name || selectedRoleForSave?.name) === 'inventario') {
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
                setStatus({ type: 'success', message: 'Usuario actualizado exitosamente!' });
            } else {
                const response = await axios.post(`${API_BASE_URL}/users/`, payload, { headers });
                savedUser = response.data;
                setStatus({ type: 'success', message: 'Usuario creado exitosamente!' });
            }

            if (ecardPhotoFile && savedUser?.id) {
                const photoPayload = new FormData();
                photoPayload.append('file', ecardPhotoFile);
                await axios.post(`${API_BASE_URL}/users/${savedUser.id}/ecard-photo`, photoPayload, {
                    headers: { ...headers, 'Content-Type': 'multipart/form-data' },
                });
            }

            // Redirect after short delay to show success message
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
        if (!ecardPublicUrl) {
            setEcardQrDataUrl('');
            return undefined;
        }
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

    const downloadEcardQr = () => {
        if (!ecardQrDataUrl) return;
        const link = document.createElement('a');
        link.href = ecardQrDataUrl;
        link.download = `qr-${user.ecard_slug || 'tarjeta'}.png`;
        link.click();
    };

    const handleDelete = async () => {
        const reassignmentOptions = availableUsers
            .filter((candidate) => String(candidate.id) !== String(id) && isAdvisorCandidate(candidate) && candidate?.is_active !== false)
            .map((candidate) => `
                <option value="${candidate.id}">
                    ${(candidate.full_name || candidate.email)}${candidate.role?.label ? ` - ${candidate.role.label}` : ''}
                </option>
            `)
            .join('');

        const result = await Swal.fire({
            title: 'Inhabilitar usuario',
            html: `
                <div style="text-align:left">
                    <p style="margin-bottom:12px;">El usuario no se eliminará físicamente. Se inhabilitará para conservar métricas e historial.</p>
                    <label for="reassign-user-select" style="display:block;margin-bottom:6px;font-weight:600;">Reasignar todos sus leads a:</label>
                    <select id="reassign-user-select" class="swal2-select" style="display:flex;width:100%;margin:0;">
                        <option value="">Sin reasignación</option>
                        ${reassignmentOptions}
                    </select>
                    <p style="margin-top:10px;font-size:12px;color:#64748b;">Si el usuario tiene leads asignados, debes escoger aquí un Asesor / Vendedor activo como nuevo responsable.</p>
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
                return {
                    reassign_leads_to_user_id: select?.value ? parseInt(select.value, 10) : null
                };
            }
        });

        if (result.isConfirmed) {
            setStatus({ type: 'loading', message: 'Inhabilitando...' });
            try {
                const token = localStorage.getItem('token');
                await axios.delete(`${API_BASE_URL}/users/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    data: result.value || {}
                });
                Swal.fire('Usuario inhabilitado', 'El usuario ya no estará visible ni podrá iniciar sesión.', 'success');
                navigate('/admin/users');
            } catch (error) {
                console.error("Error deleting user", error);
                const errorMsg = error.response?.data?.detail || 'No se pudo inhabilitar el usuario';
                setStatus({ type: 'error', message: `Error: ${errorMsg}` });
                Swal.fire('Error', errorMsg, 'error');
            }
        }
    };

    return (
        <div className="">
            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800">
                    {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h1>
                <p className="text-slate-500 mt-2">
                    {isEditing ? 'Modifica los datos del usuario.' : 'Crea un nuevo usuario en el sistema.'}
                </p>
            </header>

            {status.message && (
                <div className={`mb-6 p-4 rounded-lg text-white font-bold ${status.type === 'error' ? 'bg-red-500' : status.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}>
                    {status.message}
                </div>
            )}

            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-2xl">
                <form onSubmit={handleSave} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            name="full_name"
                            value={user.full_name || ''}
                            onChange={handleChange}
                            placeholder="Ej: Juan Pérez"
                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            required
                            value={user.email}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Contraseña {isEditing && '(Dejar en blanco para mantener actual)'}</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                required={!isEditing}
                                value={user.password}
                                onChange={handleChange}
                                className="w-full px-4 py-2 pr-12 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((current) => !current)}
                                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 transition hover:text-blue-600"
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                        {isEditing && (
                            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <p className="text-sm text-slate-500">
                                    La contraseña actual no se puede mostrar porque se guarda encriptada con hash seguro.
                                </p>
                                <button
                                    type="button"
                                    onClick={generateTemporaryPassword}
                                    className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                                >
                                    Generar contraseña temporal
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Rol</label>
                            <select
                                name="role_id"
                                value={user.role_id}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                            >
                                <option value="">Seleccionar Rol</option>
                                {availableRoles.map(role => (
                                    <option key={role.id} value={role.id}>
                                        {ROLE_LABELS[role.name] || role.label || role.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {isSuperAdmin && (
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Empresa</label>
                                <select
                                    name="company_id"
                                    value={user.company_id || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                >
                                    <option value="">Sin Empresa (Global)</option>
                                    {companies.map(company => (
                                        <option key={company.id} value={company.id}>
                                            {company.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {!isInventarioRoleSelected && (
                            <>
                                {isAdvisorRoleSelected && (
                                    <div className="md:col-span-2">
                                        <label className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                name="auto_assign_leads"
                                                checked={Boolean(user.auto_assign_leads)}
                                                onChange={handleChange}
                                                className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div>
                                                <span className="block text-sm font-semibold text-slate-700">Permitir asignación automática</span>
                                                <span className="block text-xs text-slate-500 mt-1">
                                                    Si está activo, este usuario podrá recibir leads nuevos por asignación automática y entrar en redistribuciones automáticas cuando aplique.
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {canTrackAdvisors && (
                                    <div className="md:col-span-2">
                                        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
                                            <div className="mb-3">
                                                <p className="text-sm font-semibold text-slate-700">Seguimiento de asesores</p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Selecciona los asesores o vendedores cuyos leads podra ver este usuario en el tablero.
                                                </p>
                                            </div>
                                            {advisorTrackingOptions.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {advisorTrackingOptions.map((candidate) => {
                                                        const candidateId = Number(candidate.id);
                                                        const checked = Array.isArray(user.tracked_advisor_ids) && user.tracked_advisor_ids.includes(candidateId);
                                                        return (
                                                            <label
                                                                key={candidate.id}
                                                                className={`flex items-start gap-3 rounded-lg border bg-white px-3 py-3 cursor-pointer transition ${checked ? 'border-blue-400 bg-blue-50' : 'border-blue-100 hover:border-blue-300'}`}
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
                                                                    <span className="block text-sm font-semibold text-slate-700">{candidate.full_name || candidate.email}</span>
                                                                    <span className="block text-xs text-slate-500 mt-1">
                                                                        {candidate.email}{candidate.role?.label ? ` - ${candidate.role.label}` : ''}
                                                                    </span>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="rounded-lg border border-blue-100 bg-white px-3 py-3 text-sm text-slate-500">
                                                    No hay asesores o vendedores activos disponibles para esta empresa.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Commission Field - Only for Admin/SuperAdmin to set on others */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Comisión (%)</label>
                                    <input
                                        type="number"
                                        name="commission_percentage"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={user.commission_percentage || 0}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                        placeholder="Ej: 5.0"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Porcentaje aplicado a las ventas de este usuario.</p>
                                </div>

                                {/* Base Salary */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Sueldo Base</label>
                                    <input
                                        type="number"
                                        name="base_salary"
                                        value={user.base_salary || ''}
                                        onChange={handleChange}
                                        placeholder="0"
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>

                                {/* Payment Dates */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Fechas de Pago</label>
                                    <input
                                        type="text"
                                        name="payment_dates"
                                        value={user.payment_dates || ''}
                                        onChange={handleChange}
                                        placeholder="Ej: 15 y 30"
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-slate-50 p-5">
                        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
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

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">URL pública</label>
                                <div className="flex gap-2">
                                    <span className="flex items-center rounded-lg border border-blue-100 bg-white px-3 text-sm text-slate-500">
                                        /nuestroequipo/
                                    </span>
                                    <input
                                        type="text"
                                        name="ecard_slug"
                                        value={user.ecard_slug || ''}
                                        onChange={handleChange}
                                        placeholder="juan-perez"
                                        className="min-w-0 flex-1 px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Cargo visible</label>
                                <input
                                    type="text"
                                    name="ecard_position"
                                    value={user.ecard_position || ''}
                                    onChange={handleChange}
                                    placeholder="Ej: Asesor comercial"
                                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black bg-white"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Foto o GIF del empleado</label>
                                <div className="grid gap-4 rounded-xl border border-dashed border-blue-200 bg-white p-4 md:grid-cols-[120px_1fr] md:items-center">
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
                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                            onChange={(event) => setEcardPhotoFile(event.target.files?.[0] || null)}
                                            className="w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
                                        />
                                        <p className="mt-2 text-xs text-slate-500">
                                            Puedes usar JPG, PNG, WEBP o GIF. La imagen se mostrará en la tarjeta pública.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {ecardPublicUrl && (
                            <div className="mt-4 grid gap-4 rounded-xl border border-blue-100 bg-white p-4 md:grid-cols-[160px_1fr]">
                                <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                    {ecardQrDataUrl ? (
                                        <img src={ecardQrDataUrl} alt="QR de tarjeta virtual" className="h-32 w-32 rounded-lg bg-white p-1" />
                                    ) : (
                                        <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-400">
                                            QR
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={downloadEcardQr}
                                        disabled={!ecardQrDataUrl}
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
                                            className="min-w-0 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
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
                        )}
                    </div>

                    <div className="pt-4 flex flex-col md:flex-row gap-4">
                        <button
                            type="submit"
                            disabled={status.type === 'loading'}
                            className="flex-1 py-3 px-6 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {status.type === 'loading' ? 'Guardando...' : 'Guardar Usuario'}
                        </button>

                        {isEditing && (currentRoleName === 'super_admin' || currentRoleName === 'admin') && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={status.type === 'loading'}
                                className="flex-1 py-3 px-6 bg-red-600 text-white font-bold rounded-lg shadow-lg hover:bg-red-700 transition transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                Inhabilitar Usuario
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserForm;


