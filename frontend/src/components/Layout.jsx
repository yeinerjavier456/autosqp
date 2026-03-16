import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import Swal from 'sweetalert2';
import NotificationBell from './NotificationBell';
import FloatingChatButton from './FloatingChatButton';
import { getGroupedMenuViews, getRoleName } from '../config/views';

const MENU_ICONS = {
    dashboard: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    users: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    roles: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l4 2v4c0 2.5-1.5 4.5-4 6-2.5-1.5-4-3.5-4-6V8l4-2z" /></svg>,
    integrations: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    logs: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>,
    companies: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /></svg>,
    inventory: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>,
    leads_board: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2" /></svg>,
    ally_board: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V7" /></svg>,
    alerts: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11" /></svg>,
    sales: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2" /></svg>,
    my_sales: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2" /></svg>,
    credits: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5" /></svg>,
    facebook_leads: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6" /></svg>,
    tiktok_leads: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764" /></svg>,
    whatsapp_leads: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8" /></svg>,
    instagram_leads: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" /></svg>,
    internal_chat: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6" /></svg>,
    whatsapp_dashboard: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6" /></svg>,
};

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();
    const { user, logout, loading } = useAuth();
    const { unreadCount } = useChat();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-slate-500">Cargando menu...</div>;
    }

    const roleName = getRoleName(user);
    const isAliado = roleName === 'aliado';
    const isInventario = roleName === 'inventario';
    const isCompras = roleName === 'compras';
    const primaryColor = user?.company?.primary_color || '#0f172a';
    const secondaryColor = user?.company?.secondary_color || '#2563eb';
    const groupedMenuViews = getGroupedMenuViews(user);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);
    const toggleCollapse = () => setIsCollapsed(!isCollapsed);

    const isActive = (path) => {
        if (path === '/admin/leads') return location.pathname === '/admin/leads';
        if (path === '/aliado/dashboard') return location.pathname === '/aliado/dashboard';
        return location.pathname.startsWith(path);
    };

    const handleLogout = () => {
        Swal.fire({
            title: 'Cerrar sesion',
            text: 'Estas seguro que deseas salir del sistema?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Si, cerrar sesion',
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

    const NavItem = ({ to, icon, label, nested = false }) => (
        <Link
            to={to}
            onClick={closeSidebar}
            className={`
                flex items-center gap-4 py-3 px-4 mx-2 rounded-xl transition-all duration-300 mb-2
                ${isCollapsed ? 'justify-center px-2' : ''}
                ${nested && !isCollapsed ? 'ml-5 mr-1 py-2.5 border-l border-white/10 rounded-l-none' : ''}
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
                    <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${nested ? 'text-[15px]' : ''}`}>{label}</span>
                    {label === 'Chat Interno' && unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                            {unreadCount}
                        </span>
                    )}
                </div>
            )}
        </Link>
    );

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans">
            <div className="md:hidden text-white p-4 flex justify-between items-center z-30 sticky top-0 shadow-md" style={{ backgroundColor: primaryColor }}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: secondaryColor }}>
                        <span className="font-bold text-lg">A</span>
                    </div>
                    <span className="font-bold text-xl tracking-tight">{user?.company?.name || 'AutosQP'}</span>
                </div>
                <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-white/10 transition">
                    {isSidebarOpen ? <span className="text-2xl">&times;</span> : <span className="text-2xl">&#9776;</span>}
                </button>
            </div>

            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={closeSidebar}></div>
            )}

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
                <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 mb-6 relative">
                    <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: secondaryColor }}>
                            <span className="font-bold text-xl">A</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-lg tracking-wide whitespace-nowrap overflow-hidden text-ellipsis capitalize">
                                {user?.email?.split('@')[0].replace('.', ' ') || 'Usuario'}
                            </span>
                            <span className="text-xs text-blue-200 truncate font-normal opacity-80">
                                {isAliado ? 'Aliado' : isInventario ? 'Gestor de Inventario' : isCompras ? 'Gestor de Compras' : (user?.company?.name || 'AutosQP')}
                            </span>
                        </div>
                    </div>

                    {isCollapsed && (
                        <div className="absolute left-1/2 transform -translate-x-1/2 w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: secondaryColor }}>
                            <span className="font-bold text-xl">A</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 absolute right-[-10px] md:right-[-20px]">
                        <NotificationBell />
                        <button
                            onClick={toggleCollapse}
                            className="hidden md:flex w-8 h-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition border border-white/10 shadow-xl backdrop-blur-sm ml-2"
                        >
                            <svg className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                <nav className="flex-1 px-2 space-y-3 overflow-y-auto custom-scrollbar">
                    {groupedMenuViews.map((group) => (
                        <div key={group.id} className="pb-1">
                            {!isCollapsed && (
                                <div className="px-4 mb-2">
                                    <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/45">
                                        {group.label}
                                    </p>
                                </div>
                            )}
                            <div className="space-y-1">
                                {group.views.map((view) => (
                                    <NavItem
                                        key={view.id}
                                        to={view.path}
                                        label={view.menuLabel}
                                        icon={MENU_ICONS[view.id] || MENU_ICONS.dashboard}
                                        nested={!isCollapsed}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <a
                        href="/autos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`
                            flex items-center gap-3 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 transition mb-3
                            ${isCollapsed ? 'justify-center px-2' : ''}
                        `}
                        title={isCollapsed ? 'Ver Web Publica' : ''}
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.6 9h16.8M3.6 15h16.8" />
                        </svg>
                        {!isCollapsed && <span className="font-medium">Ver Web Publica</span>}
                    </a>

                    <button
                        onClick={handleLogout}
                        className={`
                            w-full flex items-center gap-3 py-3 px-4 rounded-xl text-red-200 hover:text-white hover:bg-red-500/20 transition
                            ${isCollapsed ? 'justify-center px-2' : ''}
                        `}
                        title={isCollapsed ? 'Cerrar Sesion' : ''}
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21h8" />
                        </svg>
                        {!isCollapsed && <span className="font-medium">Cerrar Sesion</span>}
                    </button>
                </div>
            </aside>

            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <Outlet />
            </main>

            <FloatingChatButton />
        </div>
    );
};

export default Layout;
