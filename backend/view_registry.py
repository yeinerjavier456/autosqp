SYSTEM_VIEWS = [
    {"id": "dashboard", "label": "Dashboard", "path": "/admin/dashboard"},
    {"id": "users", "label": "Usuarios", "path": "/admin/users"},
    {"id": "roles", "label": "Roles y permisos", "path": "/admin/roles"},
    {"id": "integrations", "label": "Configuracion", "path": "/admin/integrations"},
    {"id": "logs", "label": "Auditoria / Logs", "path": "/admin/logs"},
    {"id": "companies", "label": "Empresas globales", "path": "/admin/companies-list"},
    {"id": "inventory", "label": "Inventario", "path": "/admin/inventory"},
    {"id": "leads_board", "label": "Tablero de leads", "path": "/admin/leads"},
    {"id": "ally_board", "label": "Tablero de aliados", "path": "/aliado/dashboard"},
    {"id": "alerts", "label": "Alertas automaticas", "path": "/admin/alerts"},
    {"id": "sales", "label": "Finanzas y ventas", "path": "/admin/sales"},
    {"id": "my_sales", "label": "Mis ventas", "path": "/admin/my-sales"},
    {"id": "credits", "label": "Solicitudes / creditos", "path": "/admin/credits"},
    {"id": "facebook_leads", "label": "Facebook leads", "path": "/admin/leads/facebook"},
    {"id": "tiktok_leads", "label": "TikTok leads", "path": "/admin/leads/tiktok"},
    {"id": "whatsapp_leads", "label": "WhatsApp leads", "path": "/admin/leads/whatsapp"},
    {"id": "instagram_leads", "label": "Instagram leads", "path": "/admin/leads/instagram"},
    {"id": "internal_chat", "label": "Chat interno", "path": "/internal-chat"},
    {"id": "whatsapp_dashboard", "label": "Mensajeria WhatsApp", "path": "/admin/whatsapp"},
]

DEFAULT_ROLE_VIEW_ACCESS = {
    "super_admin": [view["id"] for view in SYSTEM_VIEWS],
    "admin": [
        "dashboard", "users", "roles", "integrations", "logs", "inventory",
        "leads_board", "ally_board", "alerts", "sales", "credits",
        "facebook_leads", "tiktok_leads", "whatsapp_leads", "instagram_leads",
        "internal_chat", "whatsapp_dashboard"
    ],
    "asesor": [
        "dashboard", "inventory", "leads_board", "my_sales", "credits", "internal_chat"
    ],
    "aliado": [
        "dashboard", "ally_board", "credits", "internal_chat", "inventory"
    ],
    "inventario": ["inventory"],
    "compras": ["credits"],
    "user": [],
}

DEFAULT_ROLE_MENU_ORDER = {
    role_name: view_ids[:] for role_name, view_ids in DEFAULT_ROLE_VIEW_ACCESS.items()
}

VALID_VIEW_IDS = {view["id"] for view in SYSTEM_VIEWS}
