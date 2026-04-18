SYSTEM_VIEWS = [
    {"id": "dashboard", "label": "Dashboard", "path": "/admin/dashboard", "scope": "company"},
    {"id": "users", "label": "Usuarios", "path": "/admin/users", "scope": "company"},
    {"id": "roles", "label": "Roles y permisos", "path": "/admin/roles", "scope": "company"},
    {"id": "integrations", "label": "Configuracion", "path": "/admin/integrations", "scope": "company"},
    {"id": "logs", "label": "Auditoria / Logs", "path": "/admin/logs", "scope": "company"},
    {"id": "companies", "label": "Empresas globales", "path": "/admin/companies-list", "scope": "global"},
    {"id": "inventory", "label": "Inventario", "path": "/admin/inventory", "scope": "company"},
    {"id": "leads_board", "label": "Tablero de leads", "path": "/admin/leads", "scope": "company"},
    {"id": "appointments_calendar", "label": "Calendario de citas", "path": "/admin/appointments", "scope": "company"},
    {"id": "deleted_leads", "label": "Leads eliminados", "path": "/admin/leads/deleted", "scope": "company"},
    {"id": "ally_board", "label": "Tablero de aliados", "path": "/aliado/dashboard", "scope": "company"},
    {"id": "alerts", "label": "Alertas automaticas", "path": "/admin/alerts", "scope": "company"},
    {"id": "sales", "label": "Finanzas y ventas", "path": "/admin/sales", "scope": "company"},
    {"id": "my_sales", "label": "Mis ventas", "path": "/admin/my-sales", "scope": "company"},
    {"id": "credits", "label": "Tablero de solicitudes de credito", "path": "/admin/credits", "scope": "company"},
    {"id": "gmail_credit_audit", "label": "Correos verificados de credito", "path": "/admin/gmail-credit-audit", "scope": "company"},
    {"id": "purchase_board", "label": "Tablero de compras y busquedas", "path": "/admin/purchases", "scope": "company"},
    {"id": "facebook_leads", "label": "Facebook leads", "path": "/admin/leads/facebook", "scope": "company"},
    {"id": "tiktok_leads", "label": "TikTok leads", "path": "/admin/leads/tiktok", "scope": "company"},
    {"id": "whatsapp_leads", "label": "WhatsApp leads", "path": "/admin/leads/whatsapp", "scope": "company"},
    {"id": "instagram_leads", "label": "Instagram leads", "path": "/admin/leads/instagram", "scope": "company"},
    {"id": "internal_chat", "label": "Chat interno", "path": "/internal-chat", "scope": "company"},
    {"id": "whatsapp_dashboard", "label": "Mensajeria WhatsApp", "path": "/admin/whatsapp", "scope": "company"},
]

DEFAULT_ROLE_VIEW_ACCESS = {
    "super_admin": [view["id"] for view in SYSTEM_VIEWS],
    "admin": [
        "dashboard", "users", "roles", "integrations", "logs", "inventory",
        "leads_board", "appointments_calendar", "deleted_leads", "ally_board", "alerts", "sales", "credits", "gmail_credit_audit", "purchase_board",
        "facebook_leads", "tiktok_leads", "whatsapp_leads", "instagram_leads",
        "internal_chat", "whatsapp_dashboard"
    ],
    "asesor": [
        "dashboard", "inventory", "leads_board", "appointments_calendar", "my_sales", "credits", "gmail_credit_audit", "internal_chat"
    ],
    "aliado": [
        "dashboard", "ally_board", "appointments_calendar", "credits", "gmail_credit_audit", "internal_chat", "inventory"
    ],
    "inventario": ["inventory", "internal_chat"],
    "compras": ["purchase_board", "internal_chat"],
    "user": ["internal_chat"],
}

DEFAULT_ROLE_MENU_ORDER = {
    role_name: view_ids[:] for role_name, view_ids in DEFAULT_ROLE_VIEW_ACCESS.items()
}

VALID_VIEW_IDS = {view["id"] for view in SYSTEM_VIEWS}
COMPANY_VIEW_IDS = {view["id"] for view in SYSTEM_VIEWS if view.get("scope") != "global"}
