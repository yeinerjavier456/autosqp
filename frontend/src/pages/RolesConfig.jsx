import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { SYSTEM_VIEWS, getVisibleSystemViews, isRoleAvailableForCompany } from '../config/views';

const SECTION_META = {
    general: { title: 'General', description: 'Pantallas principales del panel.' },
    admin: { title: 'Administracion', description: 'Usuarios, roles, configuraciones y auditoria.' },
    crm: { title: 'CRM', description: 'Leads, aliados, ventas, inventario y solicitudes de credito.' },
    channels: { title: 'Canales', description: 'Mensajeria, chat interno y entradas por canal.' },
    global: { title: 'Global', description: 'Opciones exclusivas del administrador global.' }
};

const normalizeRoleName = (role) => {
    const value = typeof role === 'string'
        ? role
        : [role?.base_role_name, role?.name, role?.label].filter(Boolean).join(' ');
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_-]+/g, ' ');
};

const isCommercialUser = (person) => {
    const roleName = normalizeRoleName(person?.role);
    return roleName.includes('asesor') || roleName.includes('vendedor');
};

const isActiveUser = (person) => person?.is_active !== false && person?.is_active !== 0;

const RolesConfig = () => {
    const { user } = useAuth();
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [form, setForm] = useState({
        label: '',
        permissions: [],
        menu_order: [],
        assignable_role_ids: [],
        advisor_tracking_enabled: false,
        tracked_advisor_ids: []
    });

    const selectedRole = useMemo(
        () => roles.find((role) => role.id === selectedRoleId) || null,
        [roles, selectedRoleId]
    );
    const visibleRoles = useMemo(
        () => roles.filter((role) => isRoleAvailableForCompany(role, user?.company || null)),
        [roles, user]
    );
    const availableViews = useMemo(() => getVisibleSystemViews(user), [user]);
    const groupedViews = useMemo(() => {
        const groups = {};
        availableViews.forEach((view) => {
            const sectionId = view.section || 'general';
            if (!groups[sectionId]) groups[sectionId] = [];
            groups[sectionId].push(view);
        });

        return Object.entries(groups).map(([sectionId, views]) => ({
            id: sectionId,
            title: SECTION_META[sectionId]?.title || sectionId,
            description: SECTION_META[sectionId]?.description || '',
            views
        }));
    }, [availableViews]);
    const groupedMenuOrder = useMemo(() => {
        const groups = [];

        form.menu_order.forEach((viewId, index) => {
            const view = availableViews.find((item) => item.id === viewId);
            if (!view) return;

            const sectionId = view.section || 'general';
            let sectionGroup = groups.find((group) => group.id === sectionId);

            if (!sectionGroup) {
                sectionGroup = {
                    id: sectionId,
                    title: SECTION_META[sectionId]?.title || sectionId,
                    description: SECTION_META[sectionId]?.description || '',
                    items: []
                };
                groups.push(sectionGroup);
            }

            sectionGroup.items.push({ view, index });
        });

        return groups;
    }, [availableViews, form.menu_order]);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/roles/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const items = Array.isArray(response.data) ? response.data : [];
            setRoles(items);
            if (!selectedRoleId && items.length > 0) {
                setSelectedRoleId(items[0].id);
            }
        } catch (error) {
            console.error('Error fetching roles', error);
            Swal.fire('Error', 'No se pudieron cargar los roles.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/users/', {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 1000 }
            });
            setUsers(Array.isArray(response.data?.items) ? response.data.items : []);
        } catch (error) {
            console.error('Error fetching users', error);
            setUsers([]);
        }
    };

    useEffect(() => {
        fetchRoles();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (!selectedRole) {
            setForm({
                label: '',
                permissions: [],
                menu_order: [],
                assignable_role_ids: [],
                advisor_tracking_enabled: false,
                tracked_advisor_ids: []
            });
            return;
        }
        setForm({
            label: selectedRole.label || '',
            permissions: Array.isArray(selectedRole.permissions) ? selectedRole.permissions : [],
            menu_order: Array.isArray(selectedRole.menu_order) ? selectedRole.menu_order : [],
            assignable_role_ids: Array.isArray(selectedRole.assignable_role_ids) ? selectedRole.assignable_role_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id)) : [],
            advisor_tracking_enabled: Boolean(selectedRole.advisor_tracking_enabled),
            tracked_advisor_ids: Array.isArray(selectedRole.tracked_advisor_ids) ? selectedRole.tracked_advisor_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id)) : []
        });
    }, [selectedRole]);

    useEffect(() => {
        if (!selectedRoleId) return;
        const roleStillVisible = visibleRoles.some((role) => role.id === selectedRoleId);
        if (!roleStillVisible) {
            setSelectedRoleId(visibleRoles[0]?.id || null);
        }
    }, [visibleRoles, selectedRoleId]);

    const roleOptionsForAssignment = useMemo(
        () => visibleRoles.filter((role) => role.id !== selectedRoleId),
        [visibleRoles, selectedRoleId]
    );
    const advisorOptions = useMemo(
        () => users
            .filter((person) => isActiveUser(person) && isCommercialUser(person))
            .sort((a, b) => String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''))),
        [users]
    );

    const syncMenuOrder = (permissions, currentOrder) => {
        const nextOrder = currentOrder.filter((viewId) => permissions.includes(viewId));
        permissions.forEach((viewId) => {
            if (!nextOrder.includes(viewId)) nextOrder.push(viewId);
        });
        return nextOrder;
    };

    const togglePermission = (viewId) => {
        setForm((prev) => {
            const permissions = prev.permissions.includes(viewId)
                ? prev.permissions.filter((item) => item !== viewId)
                : [...prev.permissions, viewId];
            return {
                ...prev,
                permissions,
                menu_order: syncMenuOrder(permissions, prev.menu_order)
            };
        });
    };

    const moveView = (viewId, direction) => {
        setForm((prev) => {
            const order = [...prev.menu_order];
            const index = order.indexOf(viewId);
            if (index === -1) return prev;
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= order.length) return prev;
            [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
            return { ...prev, menu_order: order };
        });
    };

    const handleNewRole = () => {
        setSelectedRoleId(null);
        setForm({
            label: '',
            permissions: [],
            menu_order: [],
            assignable_role_ids: [],
            advisor_tracking_enabled: false,
            tracked_advisor_ids: []
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.label.trim()) {
            Swal.fire('Error', 'Debes escribir el nombre visible del rol.', 'warning');
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                label: form.label.trim(),
                permissions: form.permissions,
                menu_order: syncMenuOrder(form.permissions, form.menu_order),
                assignable_role_ids: form.assignable_role_ids,
                advisor_tracking_enabled: Boolean(form.advisor_tracking_enabled),
                tracked_advisor_ids: form.advisor_tracking_enabled ? form.tracked_advisor_ids : []
            };

            if (selectedRoleId) {
                await axios.put(`/api/roles/${selectedRoleId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/roles/', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            await fetchRoles();
            Swal.fire('Exito', 'Rol guardado correctamente.', 'success');
        } catch (error) {
            console.error('Error saving role', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo guardar el rol.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedRoleId || selectedRole?.is_system) return;
        const result = await Swal.fire({
            title: 'Eliminar rol',
            text: 'Esta accion no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/roles/${selectedRoleId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedRoleId(null);
            await fetchRoles();
            Swal.fire('Eliminado', 'El rol fue eliminado.', 'success');
        } catch (error) {
            console.error('Error deleting role', error);
            Swal.fire('Error', error.response?.data?.detail || 'No se pudo eliminar el rol.', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800">Roles y Permisos</h1>
                    <p className="text-slate-500 mt-2">Crea roles personalizados y decide a que vistas pueden entrar y en que orden se muestra el menu.</p>
                </div>
                <button
                    onClick={handleNewRole}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
                >
                    Nuevo Rol
                </button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr] gap-6">
                <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">Roles disponibles</h2>
                    {loading ? (
                        <p className="text-sm text-slate-400">Cargando roles...</p>
                    ) : (
                        <div className="space-y-2">
                            {visibleRoles.map((role) => (
                                <button
                                    key={role.id}
                                    onClick={() => setSelectedRoleId(role.id)}
                                    className={`w-full text-left rounded-xl border px-4 py-3 transition ${selectedRoleId === role.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-slate-800">{role.label}</span>
                                        {role.is_system && (
                                            <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Sistema</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{role.permissions?.length || 0} vistas habilitadas</p>
                                </button>
                            ))}
                        </div>
                    )}
                </aside>

                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre visible del rol</label>
                                <input
                                    type="text"
                                    value={form.label}
                                    onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                                    placeholder="Ej: Coordinador CRM"
                                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            {selectedRole && !selectedRole.is_system && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-4 py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50"
                                >
                                    Eliminar Rol
                                </button>
                            )}
                        </div>

                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Reasignacion de leads</h3>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                    <p className="text-sm font-semibold text-amber-800">La asignacion automatica ahora se configura por usuario.</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Desde esta pantalla solo defines a que roles puede reasignar leads este rol. Los usuarios que reciben leads nuevos o redistribuciones automaticas se marcan individualmente en Usuarios.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-2">Roles a los que puede reasignar leads</label>
                                    <select
                                        multiple
                                        value={form.assignable_role_ids.map(String)}
                                        onChange={(e) => setForm((prev) => ({
                                            ...prev,
                                            assignable_role_ids: Array.from(e.target.selectedOptions)
                                                .map((option) => Number(option.value))
                                                .filter((id) => Number.isInteger(id))
                                        }))}
                                        className="h-40 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        {roleOptionsForAssignment.map((role) => (
                                            <option key={role.id} value={role.id}>
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Lo que selecciones aqui sera lo que aparezca en la lista de usuarios al reasignar un lead para las personas que tengan este rol.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Seguimiento de asesor</h3>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(form.advisor_tracking_enabled)}
                                        onChange={(e) => setForm((prev) => ({
                                            ...prev,
                                            advisor_tracking_enabled: e.target.checked,
                                            tracked_advisor_ids: e.target.checked ? prev.tracked_advisor_ids : []
                                        }))}
                                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                        <p className="font-semibold text-slate-800">Permitir seguimiento de asesores o vendedores</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Los usuarios con este rol podran ver en el tablero los leads asignados o supervisados por los asesores seleccionados.
                                        </p>
                                    </div>
                                </label>

                                {form.advisor_tracking_enabled && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-800 mb-2">Asesores o vendedores visibles para este rol</label>
                                        {advisorOptions.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {advisorOptions.map((person) => {
                                                    const personId = Number(person.id);
                                                    const checked = form.tracked_advisor_ids.includes(personId);
                                                    return (
                                                        <label
                                                            key={person.id}
                                                            className={`flex items-start gap-3 rounded-xl border bg-white p-4 cursor-pointer transition ${checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => setForm((prev) => {
                                                                    const currentIds = Array.isArray(prev.tracked_advisor_ids) ? prev.tracked_advisor_ids : [];
                                                                    const nextIds = currentIds.includes(personId)
                                                                        ? currentIds.filter((id) => id !== personId)
                                                                        : [...currentIds, personId];
                                                                    return { ...prev, tracked_advisor_ids: nextIds };
                                                                })}
                                                                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <div>
                                                                <p className="font-semibold text-slate-800">{person.full_name || person.email}</p>
                                                                <p className="text-xs text-slate-500 mt-1">{person.email}{person.role?.label ? ` - ${person.role.label}` : ''}</p>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                                                No hay asesores o vendedores activos disponibles para seleccionar.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Vistas con acceso</h3>
                            <div className="space-y-5">
                                {groupedViews.map((group) => (
                                    <div key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                        <div className="mb-3">
                                            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">{group.title}</h4>
                                            {group.description && (
                                                <p className="text-xs text-slate-500 mt-1">{group.description}</p>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {group.views.map((view) => {
                                                const checked = form.permissions.includes(view.id);
                                                return (
                                                    <label key={view.id} className={`flex items-start gap-3 rounded-xl border bg-white p-4 cursor-pointer transition ${checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => togglePermission(view.id)}
                                                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <div>
                                                            <p className="font-semibold text-slate-800">{view.label}</p>
                                                            <p className="text-xs text-slate-500 mt-1">{view.path}</p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Orden del menu</h3>
                            <div className="space-y-4">
                                {form.menu_order.length === 0 && (
                                    <p className="text-sm text-slate-400">Selecciona vistas para ordenar el menu.</p>
                                )}
                                {groupedMenuOrder.map((group) => (
                                    <div key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                        <div className="mb-3">
                                            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">{group.title}</h4>
                                            {group.description && (
                                                <p className="text-xs text-slate-500 mt-1">{group.description}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {group.items.map(({ view, index }) => (
                                                <div key={view.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                                    <div className="pl-3 border-l border-slate-200">
                                                        <p className="font-semibold text-slate-800">{index + 1}. {view.menuLabel}</p>
                                                        <p className="text-xs text-slate-500">{view.path}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button type="button" onClick={() => moveView(view.id, 'up')} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Subir</button>
                                                        <button type="button" onClick={() => moveView(view.id, 'down')} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Bajar</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? 'Guardando...' : 'Guardar rol'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
};

export default RolesConfig;
