export const SYSTEM_VIEWS = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', menuLabel: 'Dashboard', section: 'general', scope: 'company' },
    { id: 'users', label: 'Usuarios', path: '/admin/users', menuLabel: 'Usuarios', section: 'admin', scope: 'company' },
    { id: 'roles', label: 'Roles y permisos', path: '/admin/roles', menuLabel: 'Roles y permisos', section: 'admin', scope: 'company' },
    { id: 'integrations', label: 'Configuracion', path: '/admin/integrations', menuLabel: 'Configuracion', section: 'admin', scope: 'company' },
    { id: 'logs', label: 'Auditoria / Logs', path: '/admin/logs', menuLabel: 'Auditoria / Logs', section: 'admin', scope: 'company' },
    { id: 'companies', label: 'Empresas globales', path: '/admin/companies-list', menuLabel: 'Empresas Globales', section: 'global', scope: 'global' },
    { id: 'inventory', label: 'Inventario', path: '/admin/inventory', menuLabel: 'Inventario', section: 'crm', scope: 'company' },
    { id: 'leads_board', label: 'Tablero de leads', path: '/admin/leads', menuLabel: 'Tablero de Leads', section: 'crm', scope: 'company' },
    { id: 'appointments_calendar', label: 'Calendario de citas', path: '/admin/appointments', menuLabel: 'Calendario de Citas', section: 'crm', scope: 'company' },
    { id: 'deleted_leads', label: 'Leads eliminados', path: '/admin/leads/deleted', menuLabel: 'Leads Eliminados', section: 'crm', scope: 'company' },
    { id: 'ally_board', label: 'Tablero de aliados', path: '/aliado/dashboard', menuLabel: 'Tablero Aliados', section: 'crm', scope: 'company' },
    { id: 'alerts', label: 'Alertas automaticas', path: '/admin/alerts', menuLabel: 'Alertas Auto', section: 'crm', scope: 'company' },
    { id: 'sales', label: 'Finanzas y ventas', path: '/admin/sales', menuLabel: 'Finanzas y Ventas', section: 'crm', scope: 'company' },
    { id: 'payment_receipts', label: 'Agregar recibo de compra / venta', path: '/admin/receipts/new', menuLabel: 'Agregar Recibo', section: 'crm', scope: 'company' },
    { id: 'my_sales', label: 'Mis ventas', path: '/admin/my-sales', menuLabel: 'Mis Ventas', section: 'crm', scope: 'company' },
    { id: 'credits', label: 'Tablero de solicitudes de credito', path: '/admin/credits', menuLabel: 'Solicitudes de Credito', section: 'crm', scope: 'company' },
    { id: 'public_credit_submissions', label: 'Solicitudes publicas de credito', path: '/admin/public-credit-submissions', menuLabel: 'Solicitudes Publicas', section: 'crm', scope: 'company' },
    { id: 'gmail_credit_audit', label: 'Correos verificados de credito', path: '/admin/gmail-credit-audit', menuLabel: 'Correos de Credito', section: 'crm', scope: 'company' },
    { id: 'purchase_board', label: 'Tablero de compras y busquedas', path: '/admin/purchases', menuLabel: 'Solicitudes de Compra', section: 'crm', scope: 'company' },
    { id: 'facebook_leads', label: 'Facebook leads', path: '/admin/leads/facebook', menuLabel: 'Facebook Leads', section: 'channels', scope: 'company' },
    { id: 'tiktok_leads', label: 'TikTok leads', path: '/admin/leads/tiktok', menuLabel: 'TikTok Leads', section: 'channels', scope: 'company' },
    { id: 'whatsapp_leads', label: 'WhatsApp leads', path: '/admin/leads/whatsapp', menuLabel: 'WhatsApp', section: 'channels', scope: 'company' },
    { id: 'instagram_leads', label: 'Instagram leads', path: '/admin/leads/instagram', menuLabel: 'Instagram', section: 'channels', scope: 'company' },
    { id: 'internal_chat', label: 'Chat interno', path: '/internal-chat', menuLabel: 'Chat Interno', section: 'channels', scope: 'company' },
    { id: 'whatsapp_dashboard', label: 'Mensajeria WhatsApp', path: '/admin/whatsapp', menuLabel: 'Mensajeria WhatsApp', section: 'channels', scope: 'company' },
];

export const COMPANY_MODULE_OPTIONS = [
    ...SYSTEM_VIEWS.filter((view) => view.scope === 'company'),
    {
        id: 'public_credit_form',
        label: 'Formulario público de crédito',
        menuLabel: 'Formulario público de crédito',
        section: 'crm',
        scope: 'company',
        configOnly: true,
    },
    {
        id: 'public_sales_chat',
        label: 'Chat público de ventas',
        menuLabel: 'Chat público de ventas',
        section: 'channels',
        scope: 'company',
        configOnly: true,
    },
];

export const VIEW_SECTIONS = {
    general: { id: 'general', label: 'General' },
    admin: { id: 'admin', label: 'Configuracion' },
    crm: { id: 'crm', label: 'CRM' },
    channels: { id: 'channels', label: 'Canales' },
    global: { id: 'global', label: 'Global' },
};

export const VIEW_MAP = SYSTEM_VIEWS.reduce((acc, view) => {
    acc[view.id] = view;
    return acc;
}, {});

export const DEFAULT_ROLE_VIEW_ACCESS = {
    super_admin: SYSTEM_VIEWS.map((view) => view.id),
    admin: [
        'dashboard', 'users', 'roles', 'integrations', 'logs', 'inventory',
        'leads_board', 'appointments_calendar', 'deleted_leads', 'ally_board', 'alerts', 'sales', 'payment_receipts', 'credits', 'public_credit_submissions', 'purchase_board',
        'gmail_credit_audit',
        'facebook_leads', 'tiktok_leads', 'whatsapp_leads', 'instagram_leads',
        'internal_chat', 'whatsapp_dashboard'
    ],
    asesor: [
        'dashboard', 'inventory', 'leads_board', 'appointments_calendar', 'my_sales', 'credits', 'gmail_credit_audit', 'internal_chat'
    ],
    gestion_creditos: [
        'dashboard', 'leads_board', 'appointments_calendar', 'credits', 'public_credit_submissions', 'gmail_credit_audit', 'internal_chat'
    ],
    aliado: [
        'dashboard', 'ally_board', 'appointments_calendar', 'credits', 'gmail_credit_audit', 'internal_chat', 'inventory'
    ],
    inventario: [
        'inventory', 'internal_chat'
    ],
    compras: [
        'purchase_board', 'internal_chat'
    ],
    user: ['internal_chat']
};

export const DEFAULT_ROLE_MENU_ORDER = {
    super_admin: DEFAULT_ROLE_VIEW_ACCESS.super_admin,
    admin: DEFAULT_ROLE_VIEW_ACCESS.admin,
    asesor: DEFAULT_ROLE_VIEW_ACCESS.asesor,
    gestion_creditos: DEFAULT_ROLE_VIEW_ACCESS.gestion_creditos,
    aliado: DEFAULT_ROLE_VIEW_ACCESS.aliado,
    inventario: DEFAULT_ROLE_VIEW_ACCESS.inventario,
    compras: DEFAULT_ROLE_VIEW_ACCESS.compras,
    user: []
};

export const ROLE_REQUIRED_MODULES = {
    inventario: ['inventory'],
    compras: ['purchase_board'],
    gestion_creditos: ['credits'],
    aliado: ['ally_board'],
};

export const getRoleName = (user) =>
    user?.role?.base_role_name ||
    user?.role?.name ||
    (typeof user?.role === 'string' ? user.role : '');

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

export const getGroupedMenuViews = (user) => {
    const orderedViews = getOrderedMenuViews(user);
    const groups = [];

    orderedViews.forEach((view) => {
        const sectionId = view.section || 'general';
        let sectionGroup = groups.find((group) => group.id === sectionId);

        if (!sectionGroup) {
            sectionGroup = {
                id: sectionId,
                label: VIEW_SECTIONS[sectionId]?.label || sectionId,
                views: [],
            };
            groups.push(sectionGroup);
        }

        sectionGroup.views.push(view);
    });

    return groups;
};

export const getVisibleSystemViews = (user) => {
    const isCompanyUser = Boolean(user?.company_id);
    const enabledModules = new Set(
        Array.isArray(user?.company?.enabled_modules) && user.company.enabled_modules.length > 0
            ? user.company.enabled_modules
            : SYSTEM_VIEWS.filter((view) => view.scope === 'company').map((view) => view.id)
    );
    return SYSTEM_VIEWS.filter((view) => {
        if (isCompanyUser && view.scope === 'global') return false;
        if (view.scope !== 'company') return true;
        return enabledModules.has(view.id);
    });
};

export const isRoleAvailableForCompany = (role, company) => {
    if (!role) return false;
    if (!company) return true;

    const roleName = role.base_role_name || role.name || '';
    const requiredModules = ROLE_REQUIRED_MODULES[roleName];
    if (!requiredModules || requiredModules.length === 0) {
        return true;
    }

    const enabledModules = new Set(
        Array.isArray(company.enabled_modules) && company.enabled_modules.length > 0
            ? company.enabled_modules
            : SYSTEM_VIEWS.filter((view) => view.scope === 'company').map((view) => view.id)
    );

    return requiredModules.some((moduleId) => enabledModules.has(moduleId));
};
