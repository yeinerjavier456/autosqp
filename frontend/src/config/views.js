export const SYSTEM_VIEWS = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', menuLabel: 'Dashboard', section: 'general' },
    { id: 'users', label: 'Usuarios', path: '/admin/users', menuLabel: 'Usuarios', section: 'admin' },
    { id: 'roles', label: 'Roles y permisos', path: '/admin/roles', menuLabel: 'Roles y permisos', section: 'admin' },
    { id: 'integrations', label: 'Configuracion', path: '/admin/integrations', menuLabel: 'Configuracion', section: 'admin' },
    { id: 'logs', label: 'Auditoria / Logs', path: '/admin/logs', menuLabel: 'Auditoria / Logs', section: 'admin' },
    { id: 'companies', label: 'Empresas globales', path: '/admin/companies-list', menuLabel: 'Empresas Globales', section: 'global' },
    { id: 'inventory', label: 'Inventario', path: '/admin/inventory', menuLabel: 'Inventario', section: 'crm' },
    { id: 'leads_board', label: 'Tablero de leads', path: '/admin/leads', menuLabel: 'Tablero de Leads', section: 'crm' },
    { id: 'ally_board', label: 'Tablero de aliados', path: '/aliado/dashboard', menuLabel: 'Tablero Aliados', section: 'crm' },
    { id: 'alerts', label: 'Alertas automaticas', path: '/admin/alerts', menuLabel: 'Alertas Auto', section: 'crm' },
    { id: 'sales', label: 'Finanzas y ventas', path: '/admin/sales', menuLabel: 'Finanzas y Ventas', section: 'crm' },
    { id: 'my_sales', label: 'Mis ventas', path: '/admin/my-sales', menuLabel: 'Mis Ventas', section: 'crm' },
    { id: 'credits', label: 'Solicitudes / creditos', path: '/admin/credits', menuLabel: 'Solicitudes / Creditos', section: 'crm' },
    { id: 'facebook_leads', label: 'Facebook leads', path: '/admin/leads/facebook', menuLabel: 'Facebook Leads', section: 'channels' },
    { id: 'tiktok_leads', label: 'TikTok leads', path: '/admin/leads/tiktok', menuLabel: 'TikTok Leads', section: 'channels' },
    { id: 'whatsapp_leads', label: 'WhatsApp leads', path: '/admin/leads/whatsapp', menuLabel: 'WhatsApp', section: 'channels' },
    { id: 'instagram_leads', label: 'Instagram leads', path: '/admin/leads/instagram', menuLabel: 'Instagram', section: 'channels' },
    { id: 'internal_chat', label: 'Chat interno', path: '/internal-chat', menuLabel: 'Chat Interno', section: 'channels' },
    { id: 'whatsapp_dashboard', label: 'Mensajeria WhatsApp', path: '/admin/whatsapp', menuLabel: 'Mensajeria WhatsApp', section: 'channels' },
];

export const VIEW_MAP = SYSTEM_VIEWS.reduce((acc, view) => {
    acc[view.id] = view;
    return acc;
}, {});

export const DEFAULT_ROLE_VIEW_ACCESS = {
    super_admin: SYSTEM_VIEWS.map((view) => view.id),
    admin: [
        'dashboard', 'users', 'roles', 'integrations', 'logs', 'inventory',
        'leads_board', 'ally_board', 'alerts', 'sales', 'credits',
        'facebook_leads', 'tiktok_leads', 'whatsapp_leads', 'instagram_leads',
        'internal_chat', 'whatsapp_dashboard'
    ],
    asesor: [
        'dashboard', 'inventory', 'leads_board', 'my_sales', 'credits', 'internal_chat'
    ],
    aliado: [
        'dashboard', 'ally_board', 'credits', 'internal_chat', 'inventory'
    ],
    inventario: [
        'inventory'
    ],
    compras: [
        'credits'
    ],
    user: []
};

export const DEFAULT_ROLE_MENU_ORDER = {
    super_admin: DEFAULT_ROLE_VIEW_ACCESS.super_admin,
    admin: DEFAULT_ROLE_VIEW_ACCESS.admin,
    asesor: DEFAULT_ROLE_VIEW_ACCESS.asesor,
    aliado: DEFAULT_ROLE_VIEW_ACCESS.aliado,
    inventario: DEFAULT_ROLE_VIEW_ACCESS.inventario,
    compras: DEFAULT_ROLE_VIEW_ACCESS.compras,
    user: []
};

export const getRoleName = (user) => user?.role?.name || (typeof user?.role === 'string' ? user.role : '');

export const getRolePermissions = (role) => {
    if (!role) return [];
    if (Array.isArray(role.permissions) && role.permissions.length > 0) return role.permissions;
    return DEFAULT_ROLE_VIEW_ACCESS[role.name] || [];
};

export const getRoleMenuOrder = (role) => {
    if (!role) return [];
    if (Array.isArray(role.menu_order) && role.menu_order.length > 0) return role.menu_order;
    return DEFAULT_ROLE_MENU_ORDER[role.name] || getRolePermissions(role);
};

export const hasViewAccess = (user, viewId) => {
    const roleName = getRoleName(user);
    if (roleName === 'super_admin' && !user?.company_id) return true;
    const permissions = getRolePermissions(user?.role || { name: roleName });
    return permissions.includes(viewId);
};

export const getOrderedMenuViews = (user) => {
    const role = user?.role || { name: getRoleName(user) };
    const permissions = new Set(getRolePermissions(role));
    const preferredOrder = getRoleMenuOrder(role);
    const ordered = [];

    preferredOrder.forEach((viewId) => {
        if (permissions.has(viewId) && VIEW_MAP[viewId]) {
            ordered.push(VIEW_MAP[viewId]);
            permissions.delete(viewId);
        }
    });

    SYSTEM_VIEWS.forEach((view) => {
        if (permissions.has(view.id)) {
            ordered.push(view);
        }
    });

    return ordered;
};
