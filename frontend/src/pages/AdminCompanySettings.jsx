import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { COMPANY_MODULE_OPTIONS } from '../config/views';

const COMPANY_VIEWS = COMPANY_MODULE_OPTIONS;
const COMPANY_VIEW_GROUPS = COMPANY_VIEWS.reduce((acc, view) => {
    if (!acc[view.section]) acc[view.section] = [];
    acc[view.section].push(view);
    return acc;
}, {});
const SECTION_LABELS = {
    general: 'General',
    admin: 'Configuracion',
    crm: 'CRM',
    channels: 'Canales',
};

const AdminCompanySettings = () => {
    const { id } = useParams();
    const [company, setCompany] = useState({
        name: 'Nueva Empresa',
        public_domain: '',
        public_domains: [],
        logo_url: 'https://via.placeholder.com/150',
        primary_color: '#3B82F6', // Blue-500
        secondary_color: '#1E40AF', // Blue-800
        max_users: '',
        max_leads: '',
        max_active_accounts: '',
        license_start_date: '',
        license_end_date: '',
        enabled_modules: COMPANY_VIEWS.map((view) => view.id),
        smtp_enabled: false,
        smtp_host: '',
        smtp_port: 587,
        smtp_username: '',
        smtp_password: '',
        smtp_from: '',
        smtp_use_tls: true,
    });
    const [domainDraft, setDomainDraft] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const groupedViews = useMemo(() => COMPANY_VIEW_GROUPS, []);

    useEffect(() => {
        if (id) {
            setIsEditing(true);
            const fetchCompany = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const [companyResponse, integrationsResponse] = await Promise.all([
                        axios.get(`/api/companies/${id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        }),
                        axios.get(`/api/companies/${id}/integrations`, {
                            headers: { Authorization: `Bearer ${token}` }
                        }).catch(() => ({ data: {} })),
                    ]);
                    const integrationSettings = integrationsResponse.data || {};
                    setCompany({
                        ...companyResponse.data,
                        public_domains: Array.isArray(companyResponse.data.public_domains)
                            ? companyResponse.data.public_domains
                            : (companyResponse.data.public_domain ? [companyResponse.data.public_domain] : []),
                        max_users: companyResponse.data.max_users ?? '',
                        max_leads: companyResponse.data.max_leads ?? '',
                        max_active_accounts: companyResponse.data.max_active_accounts ?? '',
                        license_start_date: companyResponse.data.license_start_date || '',
                        license_end_date: companyResponse.data.license_end_date || '',
                        enabled_modules: Array.isArray(companyResponse.data.enabled_modules)
                            ? companyResponse.data.enabled_modules
                            : COMPANY_VIEWS.map((view) => view.id),
                        smtp_enabled: Boolean(integrationSettings.smtp_enabled),
                        smtp_host: integrationSettings.smtp_host || '',
                        smtp_port: integrationSettings.smtp_port ?? 587,
                        smtp_username: integrationSettings.smtp_username || '',
                        smtp_password: integrationSettings.smtp_password || '',
                        smtp_from: integrationSettings.smtp_from || '',
                        smtp_use_tls: integrationSettings.smtp_use_tls ?? true,
                    });
                } catch (error) {
                    console.error("Error fetching company", error);
                    setStatus({ type: 'error', message: 'Error al cargar la empresa.' });
                }
            };
            fetchCompany();
        }
    }, [id]);

    const handleChange = (e) => {
        setCompany({
            ...company,
            [e.target.name]: e.target.value,
        });
    };

    const handleModuleToggle = (moduleId) => {
        setCompany((prev) => {
            const current = new Set(prev.enabled_modules || []);
            if (current.has(moduleId)) {
                current.delete(moduleId);
            } else {
                current.add(moduleId);
            }
            return {
                ...prev,
                enabled_modules: COMPANY_VIEWS
                    .map((view) => view.id)
                    .filter((viewId) => current.has(viewId)),
            };
        });
    };

    const normalizeDomain = (value) => {
        const trimmed = String(value || '').trim().toLowerCase();
        if (!trimmed) return '';
        return trimmed
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/.*$/, '')
            .replace(/:\d+$/, '');
    };

    const handleAddDomain = () => {
        const normalizedDomain = normalizeDomain(domainDraft);
        if (!normalizedDomain) {
            return;
        }

        if (company.public_domains.includes(normalizedDomain)) {
            setDomainDraft('');
            return;
        }

        setCompany((prev) => ({
            ...prev,
            public_domain: prev.public_domain || normalizedDomain,
            public_domains: [...prev.public_domains, normalizedDomain],
        }));
        setDomainDraft('');
    };

    const handleRemoveDomain = (domainToRemove) => {
        setCompany((prev) => {
            const nextDomains = prev.public_domains.filter((domain) => domain !== domainToRemove);
            return {
                ...prev,
                public_domain: nextDomains[0] || '',
                public_domains: nextDomains,
            };
        });
    };

    const handleSave = async () => {
        if (company.license_start_date && company.license_end_date && company.license_end_date < company.license_start_date) {
            setStatus({ type: 'error', message: 'La fecha final no puede ser menor que la fecha inicial.' });
            return;
        }
        setStatus({ type: 'loading', message: 'Guardando...' });
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const {
                smtp_enabled,
                smtp_host,
                smtp_port,
                smtp_username,
                smtp_password,
                smtp_from,
                smtp_use_tls,
                ...companyOnlyFields
            } = company;
            const payload = {
                ...companyOnlyFields,
                public_domain: companyOnlyFields.public_domains?.[0] || '',
                public_domains: companyOnlyFields.public_domains || [],
                max_users: companyOnlyFields.max_users === '' ? null : parseInt(companyOnlyFields.max_users, 10),
                max_leads: companyOnlyFields.max_leads === '' ? null : parseInt(companyOnlyFields.max_leads, 10),
                max_active_accounts: companyOnlyFields.max_active_accounts === '' ? null : parseInt(companyOnlyFields.max_active_accounts, 10),
                license_start_date: companyOnlyFields.license_start_date || null,
                license_end_date: companyOnlyFields.license_end_date || null,
                enabled_modules: companyOnlyFields.enabled_modules || [],
            };
            const integrationPayload = {
                smtp_enabled: Boolean(smtp_enabled),
                smtp_host: smtp_host || '',
                smtp_port: smtp_port === '' ? 587 : parseInt(smtp_port, 10),
                smtp_username: smtp_username || '',
                smtp_password: smtp_password || '',
                smtp_from: smtp_from || '',
                smtp_use_tls: Boolean(smtp_use_tls),
            };

            if (isEditing) {
                await axios.put(`/api/companies/${id}`, payload, { headers });
                await axios.put(`/api/companies/${id}/integrations`, integrationPayload, { headers });
                setStatus({ type: 'success', message: `Empresa "${company.name}" actualizada exitosamente!` });
            } else {
                const response = await axios.post('/api/companies/', payload, { headers });
                await axios.put(`/api/companies/${response.data.id}/integrations`, integrationPayload, { headers });
                setStatus({ type: 'success', message: `Empresa "${response.data.name}" creada exitosamente!` });
            }
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.detail || 'Error al conectar con el servidor';
            setStatus({ type: 'error', message: `Error: ${errorMsg}` });
        }
    };

    return (
        <div className="">
            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800">
                    {isEditing ? 'Editar Empresa' : 'Nueva Empresa'}
                </h1>
                <p className="text-slate-500 mt-2">
                    {isEditing ? 'Modifica los detalles de la empresa existente.' : 'Define la identidad visual de la nueva empresa.'}
                </p>
            </header>

            {status.message && (
                <div className={`mb-6 p-4 rounded-lg text-white font-bold ${status.type === 'error' ? 'bg-red-500' : status.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}>
                    {status.message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Form Section */}
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                    <h2 className="text-xl font-bold mb-6 text-slate-700">Configuración General</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Nombre de la Empresa</label>
                            <input
                                type="text"
                                name="name"
                                value={company.name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none text-black bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">URL del Logo</label>
                            <input
                                type="text"
                                name="logo_url"
                                value={company.logo_url}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-600">Dominios públicos</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={domainDraft}
                                    onChange={(e) => setDomainDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddDomain();
                                        }
                                    }}
                                    placeholder="Ej: autosprime.com"
                                    className="flex-1 px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddDomain}
                                    className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold"
                                >
                                    Agregar
                                </button>
                            </div>
                            <p className="text-xs text-slate-400">Sin http ni https. El primero de la lista será el dominio principal.</p>
                            <div className="flex flex-wrap gap-2">
                                {company.public_domains?.map((domain, index) => (
                                    <div key={domain} className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-slate-700">
                                        <span>{domain}{index === 0 ? ' (principal)' : ''}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDomain(domain)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            x
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Color Primario</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="color"
                                        name="primary_color"
                                        value={company.primary_color}
                                        onChange={handleChange}
                                        className="h-10 w-10 p-0 border-none rounded cursor-pointer"
                                    />
                                    <span className="text-gray-500 text-sm font-mono">{company.primary_color}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Color Secundario</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="color"
                                        name="secondary_color"
                                        value={company.secondary_color}
                                        onChange={handleChange}
                                        className="h-10 w-10 p-0 border-none rounded cursor-pointer"
                                    />
                                    <span className="text-gray-500 text-sm font-mono">{company.secondary_color}</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <h3 className="text-lg font-bold mb-4 text-slate-700">Licencia y Limites</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Limite de usuarios</label>
                                    <input
                                        type="number"
                                        min="0"
                                        name="max_users"
                                        value={company.max_users}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                        placeholder="Sin limite"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Limite de leads</label>
                                    <input
                                        type="number"
                                        min="0"
                                        name="max_leads"
                                        value={company.max_leads}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                        placeholder="Sin limite"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Limite de cuentas activas</label>
                                    <input
                                        type="number"
                                        min="0"
                                        name="max_active_accounts"
                                        value={company.max_active_accounts}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                        placeholder="Sin limite"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Fecha de inicio</label>
                                    <input
                                        type="date"
                                        name="license_start_date"
                                        value={company.license_start_date || ''}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Fecha de fin</label>
                                    <input
                                        type="date"
                                        name="license_end_date"
                                        value={company.license_end_date || ''}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <h3 className="text-lg font-bold mb-4 text-slate-700">Correo SMTP de la empresa</h3>
                            <label className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <input
                                    type="checkbox"
                                    name="smtp_enabled"
                                    checked={Boolean(company.smtp_enabled)}
                                    onChange={(e) => setCompany((prev) => ({ ...prev, smtp_enabled: e.target.checked }))}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <p className="font-medium text-slate-800">Usar SMTP propio para esta empresa</p>
                                    <p className="text-xs text-slate-500">Se usa para OTP y correos públicos del formulario de crédito.</p>
                                </div>
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Servidor SMTP</label>
                                    <input
                                        type="text"
                                        name="smtp_host"
                                        value={company.smtp_host}
                                        onChange={handleChange}
                                        placeholder="smtp.gmail.com"
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Puerto</label>
                                    <input
                                        type="number"
                                        min="1"
                                        name="smtp_port"
                                        value={company.smtp_port}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Usuario SMTP</label>
                                    <input
                                        type="text"
                                        name="smtp_username"
                                        value={company.smtp_username}
                                        onChange={handleChange}
                                        placeholder="notificaciones@empresa.com"
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Correo remitente</label>
                                    <input
                                        type="email"
                                        name="smtp_from"
                                        value={company.smtp_from}
                                        onChange={handleChange}
                                        placeholder="no-reply@empresa.com"
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Contrasena SMTP</label>
                                    <input
                                        type="password"
                                        name="smtp_password"
                                        value={company.smtp_password}
                                        onChange={handleChange}
                                        placeholder="App password o credencial SMTP"
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                                <label className="flex items-center gap-3 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        name="smtp_use_tls"
                                        checked={Boolean(company.smtp_use_tls)}
                                        onChange={(e) => setCompany((prev) => ({ ...prev, smtp_use_tls: e.target.checked }))}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>Usar TLS / STARTTLS</span>
                                </label>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <h3 className="text-lg font-bold mb-4 text-slate-700">Modulos habilitados</h3>
                            <div className="space-y-4">
                                {Object.entries(groupedViews).map(([sectionId, views]) => (
                                    <div key={sectionId} className="rounded-xl border border-slate-200 p-4">
                                        <h4 className="text-sm font-bold text-slate-700 mb-3">{SECTION_LABELS[sectionId] || sectionId}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {views.map((view) => (
                                                <label key={view.id} className="flex items-center gap-3 text-sm text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={(company.enabled_modules || []).includes(view.id)}
                                                        onChange={() => handleModuleToggle(view.id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span>{view.menuLabel || view.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleSave}
                                disabled={status.type === 'loading'}
                                className="w-full py-3 px-6 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                                style={{ backgroundColor: company.primary_color }}
                            >
                                {status.type === 'loading' ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Live Preview Section */}
                <div>
                    <h2 className="text-xl font-bold mb-6 text-slate-700">Previsualización en Vivo</h2>
                    <div className="border-4 border-slate-900 rounded-[2rem] overflow-hidden shadow-2xl relative bg-white" style={{ height: '600px' }}>
                        {/* Mock Mobile App UI */}
                        <div className="bg-slate-900 h-8 w-full absolute top-0 left-0 z-10 flex justify-center items-center">
                            <div className="w-20 h-4 bg-black rounded-full"></div>
                        </div>

                        <div className="mt-8 h-full flex flex-col">
                            {/* App Header */}
                            <div className="p-4 flex justify-between items-center text-white transition-colors duration-300" style={{ backgroundColor: company.primary_color }}>
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                    <div className="w-4 h-0.5 bg-white"></div>
                                </div>
                                <span className="font-semibold tracking-wide truncate max-w-[150px]">{company.name}</span>
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-white border-2 border-white/50">
                                    <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover" />
                                </div>
                            </div>

                            {/* App Content */}
                            <div className="flex-1 bg-gray-100 p-4 space-y-4 overflow-hidden">
                                <div className="bg-white p-4 rounded-xl shadow-sm">
                                    <h3 className="font-bold text-gray-800 mb-2">Vehículos Disponibles</h3>
                                    <div className="h-32 bg-gray-200 rounded-lg mb-2"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-lg font-bold" style={{ color: company.secondary_color }}>$25,000</span>
                                        <button
                                            className="px-4 py-1.5 rounded-full text-white text-sm font-medium"
                                            style={{ backgroundColor: company.primary_color }}
                                        >
                                            Ver Detalles
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-xl shadow-sm">
                                    <div className="flex gap-4">
                                        <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                                        <div className="flex-1">
                                            <div className="h-4 bg-gray-200 w-3/4 rounded mb-2"></div>
                                            <div className="h-3 bg-gray-100 w-1/2 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mock Bottom Nav */}
                            <div className="bg-white border-t border-gray-200 p-4 flex justify-around">
                                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: company.primary_color }}></div>
                                <div className="w-6 h-6 rounded-full bg-gray-300"></div>
                                <div className="w-6 h-6 rounded-full bg-gray-300"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminCompanySettings;

