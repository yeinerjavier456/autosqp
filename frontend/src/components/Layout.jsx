import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import Swal from 'sweetalert2';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();
    const { user, logout, loading } = useAuth();
    const { unreadCount } = useChat();

    console.log("Layout Render - User:", user, "Loading:", loading);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-slate-500">Cargando menú...</div>;
    }

    // Role Map Fallback
    const ROLE_MAP = { 1: 'super_admin', 2: 'admin', 3: 'asesor', 4: 'user' };

    // Role Checks
    // Handle role being an object (new), string (legacy), or fallback to ID
    let roleName = user?.role?.name || (typeof user?.role === 'string' ? user?.role : '');
    if (!roleName && user?.role_id) {
        roleName = ROLE_MAP[user.role_id] || '';
    }

    const isGlobalAdmin = roleName === 'super_admin' && !user?.company_id;
    const isCompanyAdmin = roleName === 'admin' || (roleName === 'super_admin' && user?.company_id);
    const isAdvisor = roleName === 'asesor';
    const isCustomer = roleName === 'user';
    const isAliado = roleName === 'aliado';

    // Dynamic Styling
    const primaryColor = user?.company?.primary_color || '#0f172a'; // Default slate-900
    const secondaryColor = user?.company?.secondary_color || '#2563eb'; // Default blue-600

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);
    const toggleCollapse = () => setIsCollapsed(!isCollapsed);

    const isActive = (path) => location.pathname.startsWith(path);

    const NavItem = ({ to, icon, label }) => (
        <Link
            to={to}
            onClick={closeSidebar}
            className={`
                flex items-center gap-4 py-3 px-4 mx-2 rounded-xl transition-all duration-300 mb-2
                ${isCollapsed ? 'justify-center px-2' : ''}
                ${!isActive(to) ? 'hover:bg-white/10 text-slate-300 hover:text-white' : 'text-white shadow-lg'}
            `}
            style={isActive(to) ? { backgroundColor: secondaryColor } : {}}
            title={isCollapsed ? label : ''}
        >
            <div className="w-6 h-6 flex-shrink-0 relative">
                {icon}
                {label === 'Chat Interno' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </div>
            {!isCollapsed && (
                <div className="flex justify-between items-center w-full">
                    <span className="font-medium whitespace-nowrap overflow-hidden transition-all duration-300">{label}</span>
                    {label === 'Chat Interno' && unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                            {unreadCount}
                        </span>
                    )}
                </div>
            )}
        </Link>
    );

    const handleLogout = () => {
        Swal.fire({
            title: '¿Cerrar Sesión?',
            text: "¿Estás seguro que deseas salir del sistema?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar sesión',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-red-600 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                logout();
                window.location.href = '/login';
            }
        });
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans">
            {/* Mobile Header */}
            <div
                className="md:hidden text-white p-4 flex justify-between items-center z-30 sticky top-0 shadow-md"
                style={{ backgroundColor: primaryColor }}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: secondaryColor }}
                    >
                        <span className="font-bold text-lg">A</span>
                    </div>
                    <span className="font-bold text-xl tracking-tight">{user?.company?.name || 'AutosQP'}</span>
                </div>
                <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-white/10 transition">
                    {isSidebarOpen ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    )}
                </button>
            </div>

            {/* Sidebar Overlay for Mobile */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={closeSidebar}></div>
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed md:sticky top-0 left-0 h-screen text-white z-30
                    transform transition-all duration-300 ease-in-out shadow-2xl flex flex-col
                    ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
                    ${isCollapsed ? 'md:w-20' : 'md:w-72'}
                    pt-0 md:pt-0
                `}
                style={{ backgroundColor: primaryColor }}
            >
                {/* Desktop Header & Toggle */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 mb-6 relative">
                    <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ backgroundColor: secondaryColor }}
                        >
                            <span className="font-bold text-xl">A</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-lg tracking-wide whitespace-nowrap overflow-hidden text-ellipsis capitalize">
                                {user?.email?.split('@')[0].replace('.', ' ') || 'Usuario'}
                            </span>
                            <span className="text-xs text-blue-200 truncate font-normal opacity-80">
                                {isAdvisor ? 'Asesor Comercial' : (isAliado ? 'Aliado' : (user?.company?.name || 'AutosQP'))}
                            </span>
                        </div>
                    </div>

                    {/* Only show logo icon centered when collapsed */}
                    {isCollapsed && (
                        <div
                            className="absolute left-1/2 transform -translate-x-1/2 w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: secondaryColor }}
                        >
                            <span className="font-bold text-xl">A</span>
                        </div>
                    )}

                    <button
                        onClick={toggleCollapse}
                        className="hidden md:flex w-8 h-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition absolute -right-4 border border-white/10 shadow-xl backdrop-blur-sm"
                    >
                        <svg className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>

                <nav className="flex-1 px-2 space-y-2 overflow-y-auto custom-scrollbar">
                    {/* Common Dashboard Link */}
                    {isAliado ? (
                        <>
                            <NavItem
                                to="/aliado/dashboard"
                                label="Tablero de Leads"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                            />
                            <NavItem
                                to="/internal-chat"
                                label="Chat Interno"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>}
                            />
                        </>
                    ) : (
                        <NavItem
                            to="/admin/dashboard"
                            label="Dashboard"
                            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
                        />
                    )}

                    {/* Global Super Admin Links */}
                    {isGlobalAdmin && (
                        <>
                            <NavItem
                                to="/admin/companies-list"
                                label="Empresas Globales"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                            />
                            <NavItem
                                to="/admin/users"
                                label="Usuarios Globales"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                            />
                        </>
                    )}

                    {/* Company Admin & Advisor & Aliado Links */}
                    {(isCompanyAdmin || isAdvisor || isAliado) && (
                        <>
                            <NavItem
                                to="/admin/inventory"
                                label="Inventario"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}
                            />

                            {/* CRM only for Admin/Advisor */}
                            {(isCompanyAdmin || isAdvisor) && (
                                <>
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4 px-4">CRM</div>
                                    <NavItem
                                        to="/admin/leads"
                                        label="Tablero de Leads"
                                        icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                                    />
                                </>
                            )}

                            {isCompanyAdmin && (
                                <>
                                    <NavItem
                                        to="/admin/sales"
                                        label="Finanzas y Ventas"
                                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                    />

                                    <hr className="my-4 border-gray-700" />
                                    <NavItem
                                        to="/admin/users"
                                        label="Usuarios"
                                        icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                                    />
                                </>
                            )}
                        </>
                    )}

                    {/* Advisor - Mis Ventas only (Inventory is above) */}
                    {isAdvisor && (
                        <NavItem
                            to="/admin/my-sales"
                            label="Mis Ventas"
                            icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        />
                    )}

                    {/* Customer Links */}
                    {isCustomer && (
                        <>
                            <NavItem
                                to="#"
                                label="Mis Compras"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                            />
                        </>
                    )}

                    <div className="my-4 border-t border-white/10 mx-4"></div>

                    {(isGlobalAdmin || isCompanyAdmin) && (
                        <>
                            <div className="my-4 border-t border-white/10 mx-4"></div>
                            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Leads y Mensajes</p>

                            <NavItem
                                to="/admin/leads/facebook"
                                label="Facebook Leads"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>}
                            />
                            <NavItem
                                to="/admin/leads/tiktok"
                                label="TikTok Leads"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                            />
                            <NavItem
                                to="/admin/leads/whatsapp"
                                label="WhatsApp"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                            />
                            <NavItem
                                to="/admin/leads/instagram"
                                label="Instagram"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                            />

                            <NavItem
                                to="/internal-chat"
                                label="Chat Interno"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>}
                            />

                            <NavItem
                                to="/admin/whatsapp"
                                label="Mensajería WhatsApp"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
                            />

                            <NavItem
                                to="/admin/credits"
                                label="Solicitudes / Créditos"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                            />

                            <div className="my-4 border-t border-white/10 mx-4"></div>
                        </>
                    )}

                    {(roleName === 'admin' || roleName === 'super_admin') && (
                        <>
                            <hr className="my-4 border-gray-700" />


                            <NavItem
                                to="/admin/integrations"
                                label="Configuración"
                                icon={<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                            />
                        </>
                    )}
                </nav>

                {/* User Profile / Logout */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className={`
                            w-full flex items-center gap-3 py-3 px-4 rounded-xl text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors
                            ${isCollapsed ? 'justify-center px-0' : ''}
                        `}
                        title="Cerrar Sesión"
                    >
                        <div className="w-5 h-5 flex-shrink-0">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </div>
                        {!isCollapsed && <span className="font-bold text-sm">Salir</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 h-[calc(100vh-theme(spacing.16))] md:h-screen">
                <div className="p-6 md:p-10 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
