import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { COMPANY_MODULE_OPTIONS } from '../config/views';
import { normalizeMediaUrl } from '../utils/media';

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
        website_url: '',
        logo_url: 'https://via.placeholder.com/150',
        contact_address: '',
        contact_phone: '',
        social_instagram: '',
        social_tiktok: '',
        social_facebook: '',
        primary_color: '#3B82F6', // Blue-500
        secondary_color: '#1E40AF', // Blue-800
        max_users: '',
        max_leads: '',
        max_active_accounts: '',
        license_start_date: '',
        license_end_date: '',
        enabled_modules: COMPANY_VIEWS.map((view) => view.id),
        public_credit_requires_email_validation: true,
        facebook_access_token: '',
        facebook_pixel_id: '',
        instagram_access_token: '',
        tiktok_access_token: '',
        tiktok_pixel_id: '',
        whatsapp_api_key: '',
        whatsapp_phone_number_id: '',
        whatsapp_documents_enabled: true,
        whatsapp_calling_enabled: false,
        whatsapp_calling_mode: 'whatsapp_link',
        whatsapp_calling_provider_url: '',
        whatsapp_calling_provider_token: '',
        whatsapp_calling_provider_token_configured: false,
        openai_api_key: '',
        gw_model: 'gpt-4o',
        chatbot_bot_name: 'Jennifer Quimbayo',
        chatbot_typing_min_ms: 7000,
        chatbot_typing_max_ms: 18000,
        gmail_enabled: false,
        gmail_client_id: '',
        gmail_client_secret: '',
        gmail_redirect_uri: '',
        gmail_refresh_token: '',
        gmail_monitored_sender: '',
        gmail_label: '',
        gmail_sync_days: 7,
        gmail_sync_max_results: 20,
        smtp_enabled: false,
        smtp_host: '',
        smtp_port: 587,
        smtp_username: '',
        smtp_password: '',
        smtp_password_configured: false,
        smtp_from: '',
        smtp_use_tls: true,
        smtp_always_recipients: '',
    });
    const [domainDraft, setDomainDraft] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
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
                        contact_address: companyResponse.data.contact_address || '',
                        contact_phone: companyResponse.data.contact_phone || '',
                        social_instagram: companyResponse.data.social_instagram || '',
                        social_tiktok: companyResponse.data.social_tiktok || '',
                        social_facebook: companyResponse.data.social_facebook || '',
                        enabled_modules: Array.isArray(companyResponse.data.enabled_modules)
                            ? companyResponse.data.enabled_modules
                            : COMPANY_VIEWS.map((view) => view.id),
                        public_credit_requires_email_validation: companyResponse.data.public_credit_requires_email_validation ?? true,
                        facebook_access_token: integrationSettings.facebook_access_token || '',
                        facebook_pixel_id: integrationSettings.facebook_pixel_id || '',
                        instagram_access_token: integrationSettings.instagram_access_token || '',
                        tiktok_access_token: integrationSettings.tiktok_access_token || '',
                        tiktok_pixel_id: integrationSettings.tiktok_pixel_id || '',
                        whatsapp_api_key: integrationSettings.whatsapp_api_key || '',
                        whatsapp_phone_number_id: integrationSettings.whatsapp_phone_number_id || '',
                        whatsapp_documents_enabled: integrationSettings.whatsapp_documents_enabled ?? true,
                        whatsapp_calling_enabled: Boolean(integrationSettings.whatsapp_calling_enabled),
                        whatsapp_calling_mode: integrationSettings.whatsapp_calling_mode || 'whatsapp_link',
                        whatsapp_calling_provider_url: integrationSettings.whatsapp_calling_provider_url || '',
                        whatsapp_calling_provider_token: '',
                        whatsapp_calling_provider_token_configured: Boolean(integrationSettings.whatsapp_calling_provider_token_configured),
                        openai_api_key: integrationSettings.openai_api_key || '',
                        gw_model: integrationSettings.gw_model || 'gpt-4o',
                        chatbot_bot_name: integrationSettings.chatbot_bot_name || 'Jennifer Quimbayo',
                        chatbot_typing_min_ms: integrationSettings.chatbot_typing_min_ms ?? 7000,
                        chatbot_typing_max_ms: integrationSettings.chatbot_typing_max_ms ?? 18000,
                        gmail_enabled: Boolean(integrationSettings.gmail_enabled),
                        gmail_client_id: integrationSettings.gmail_client_id || '',
                        gmail_client_secret: integrationSettings.gmail_client_secret || '',
                        gmail_redirect_uri: integrationSettings.gmail_redirect_uri || '',
                        gmail_refresh_token: integrationSettings.gmail_refresh_token || '',
                        gmail_monitored_sender: integrationSettings.gmail_monitored_sender || '',
                        gmail_label: integrationSettings.gmail_label || '',
                        gmail_sync_days: integrationSettings.gmail_sync_days ?? 7,
                        gmail_sync_max_results: integrationSettings.gmail_sync_max_results ?? 20,
                        smtp_enabled: Boolean(integrationSettings.smtp_enabled),
                        smtp_host: integrationSettings.smtp_host || '',
                        smtp_port: integrationSettings.smtp_port ?? 587,
                        smtp_username: integrationSettings.smtp_username || '',
                        smtp_password: '',
                        smtp_password_configured: Boolean(integrationSettings.smtp_password_configured),
                        smtp_from: integrationSettings.smtp_from || '',
                        smtp_use_tls: integrationSettings.smtp_use_tls ?? true,
                        smtp_always_recipients: integrationSettings.smtp_always_recipients || '',
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

    const handleLogoUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setStatus({ type: 'error', message: 'El logo debe ser una imagen.' });
            event.target.value = '';
            return;
        }

        setUploadingLogo(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('file', file);
            const response = await axios.post('/api/upload/', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });
            const uploadedUrl = response.data?.url_relative || response.data?.url;
            if (!uploadedUrl) {
                throw new Error('El servidor no devolvió la URL del logo.');
            }
            setCompany((prev) => ({ ...prev, logo_url: uploadedUrl }));
            setStatus({ type: 'success', message: 'Logo cargado. Recuerda guardar los cambios de la empresa.' });
        } catch (error) {
            console.error('Error uploading company logo', error);
            setStatus({ type: 'error', message: 'No se pudo cargar el logo.' });
        } finally {
            setUploadingLogo(false);
            event.target.value = '';
        }
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
                facebook_access_token,
                facebook_pixel_id,
                instagram_access_token,
                tiktok_access_token,
                tiktok_pixel_id,
                whatsapp_api_key,
                whatsapp_phone_number_id,
                whatsapp_documents_enabled,
                whatsapp_calling_enabled,
                whatsapp_calling_mode,
                whatsapp_calling_provider_url,
                whatsapp_calling_provider_token,
                whatsapp_calling_provider_token_configured,
                openai_api_key,
                gw_model,
                chatbot_bot_name,
                chatbot_typing_min_ms,
                chatbot_typing_max_ms,
                gmail_enabled,
                gmail_client_id,
                gmail_client_secret,
                gmail_redirect_uri,
                gmail_refresh_token,
                gmail_monitored_sender,
                gmail_label,
                gmail_sync_days,
                gmail_sync_max_results,
                smtp_enabled,
                smtp_host,
                smtp_port,
                smtp_username,
                smtp_password,
                smtp_password_configured,
                smtp_from,
                smtp_use_tls,
                smtp_always_recipients,
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
                public_credit_requires_email_validation: Boolean(companyOnlyFields.public_credit_requires_email_validation),
            };
            const integrationPayload = {
                facebook_access_token: facebook_access_token || '',
                facebook_pixel_id: facebook_pixel_id || '',
                instagram_access_token: instagram_access_token || '',
                tiktok_access_token: tiktok_access_token || '',
                tiktok_pixel_id: tiktok_pixel_id || '',
                whatsapp_api_key: whatsapp_api_key || '',
                whatsapp_phone_number_id: whatsapp_phone_number_id || '',
                whatsapp_documents_enabled: Boolean(whatsapp_documents_enabled),
                whatsapp_calling_enabled: Boolean(whatsapp_calling_enabled),
                whatsapp_calling_mode: whatsapp_calling_mode || 'whatsapp_link',
                whatsapp_calling_provider_url: whatsapp_calling_provider_url || '',
                whatsapp_calling_provider_token: whatsapp_calling_provider_token ? whatsapp_calling_provider_token : null,
                openai_api_key: openai_api_key || '',
                gw_model: gw_model || 'gpt-4o',
                chatbot_bot_name: chatbot_bot_name || 'Jennifer Quimbayo',
                chatbot_typing_min_ms: chatbot_typing_min_ms === '' ? 7000 : parseInt(chatbot_typing_min_ms, 10),
                chatbot_typing_max_ms: chatbot_typing_max_ms === '' ? 18000 : parseInt(chatbot_typing_max_ms, 10),
                gmail_enabled: Boolean(gmail_enabled),
                gmail_client_id: gmail_client_id || '',
                gmail_client_secret: gmail_client_secret || '',
                gmail_redirect_uri: gmail_redirect_uri || '',
                gmail_refresh_token: gmail_refresh_token || '',
                gmail_monitored_sender: gmail_monitored_sender || '',
                gmail_label: gmail_label || '',
                gmail_sync_days: gmail_sync_days === '' ? 7 : parseInt(gmail_sync_days, 10),
                gmail_sync_max_results: gmail_sync_max_results === '' ? 20 : parseInt(gmail_sync_max_results, 10),
                smtp_enabled: Boolean(smtp_enabled),
                smtp_host: smtp_host || '',
                smtp_port: smtp_port === '' ? 587 : parseInt(smtp_port, 10),
                smtp_username: smtp_username || '',
                smtp_password: smtp_password ? smtp_password : null,
                smtp_from: smtp_from || '',
                smtp_use_tls: Boolean(smtp_use_tls),
                smtp_always_recipients: smtp_always_recipients || '',
            };

            if (isEditing) {
                await axios.put(`/api/companies/${id}`, payload, { headers });
                await axios.put(`/api/companies/${id}/integrations`, integrationPayload, { headers });
                setCompany((prev) => ({
                    ...prev,
                    smtp_password: '',
                    smtp_password_configured: Boolean(prev.smtp_password_configured || smtp_password),
                    whatsapp_calling_provider_token: '',
                    whatsapp_calling_provider_token_configured: Boolean(prev.whatsapp_calling_provider_token_configured || whatsapp_calling_provider_token),
                }));
                setStatus({ type: 'success', message: `Empresa "${company.name}" actualizada exitosamente!` });
            } else {
                const response = await axios.post('/api/companies/', payload, { headers });
                await axios.put(`/api/companies/${response.data.id}/integrations`, integrationPayload, { headers });
                setCompany((prev) => ({
                    ...prev,
                    smtp_password: '',
                    smtp_password_configured: Boolean(smtp_password),
                    whatsapp_calling_provider_token: '',
                    whatsapp_calling_provider_token_configured: Boolean(whatsapp_calling_provider_token),
                }));
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
                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-slate-50">
                                    {company.logo_url ? (
                                        <img src={normalizeMediaUrl(company.logo_url)} alt="Logo" className="h-full w-full object-contain" />
                                    ) : (
                                        <span className="text-xs text-slate-400">Sin logo</span>
                                    )}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        name="logo_url"
                                        value={company.logo_url}
                                        onChange={handleChange}
                                        placeholder="Pega una URL o carga una imagen"
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <label className={`inline-flex cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-semibold ${uploadingLogo ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                                            {uploadingLogo ? 'Cargando logo...' : 'Cargar logo'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleLogoUpload}
                                                disabled={uploadingLogo}
                                            />
                                        </label>
                                        <span className="text-xs text-slate-400">Formatos recomendados: PNG, JPG o WEBP.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">URL del sitio web</label>
                            <input
                                type="text"
                                name="website_url"
                                value={company.website_url || ''}
                                onChange={handleChange}
                                placeholder="Ej: https://benitezcars.com o https://miweb.com"
                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                            />
                            <p className="mt-1 text-xs text-slate-400">
                                Si lo dejas vacío, el botón enviará al inventario público /crm/autos.
                            </p>
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
                            <h3 className="text-lg font-bold mb-4 text-slate-700">Datos de contacto y redes</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Dirección</label>
                                    <input
                                        type="text"
                                        name="contact_address"
                                        value={company.contact_address || ''}
                                        onChange={handleChange}
                                        placeholder="Ej: Av. de las Americas #62-84 Local 128 segundo piso"
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Teléfono</label>
                                    <input
                                        type="text"
                                        name="contact_phone"
                                        value={company.contact_phone || ''}
                                        onChange={handleChange}
                                        placeholder="Ej: +573044113335"
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Instagram</label>
                                        <input
                                            type="text"
                                            name="social_instagram"
                                            value={company.social_instagram || ''}
                                            onChange={handleChange}
                                            placeholder="Ej: benitezcars_ / tomasbenitezcars"
                                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">TikTok</label>
                                        <input
                                            type="text"
                                            name="social_tiktok"
                                            value={company.social_tiktok || ''}
                                            onChange={handleChange}
                                            placeholder="Ej: benitezcars_"
                                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Facebook</label>
                                        <input
                                            type="text"
                                            name="social_facebook"
                                            value={company.social_facebook || ''}
                                            onChange={handleChange}
                                            placeholder="Ej: Benitez Cars"
                                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                        />
                                    </div>
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
                            <h3 className="text-lg font-bold mb-4 text-slate-700">Integraciones por empresa</h3>
                            <div className="space-y-5">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Meta, Facebook e Instagram</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Page Access Token / Meta Access Token</label>
                                            <textarea
                                                rows={3}
                                                name="facebook_access_token"
                                                value={company.facebook_access_token || ''}
                                                onChange={handleChange}
                                                placeholder="EAAB..."
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Page ID / Recipient ID de Facebook</label>
                                            <input
                                                type="text"
                                                name="facebook_pixel_id"
                                                value={company.facebook_pixel_id || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Instagram Access Token</label>
                                            <input
                                                type="text"
                                                name="instagram_access_token"
                                                value={company.instagram_access_token || ''}
                                                onChange={handleChange}
                                                placeholder="Opcional"
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">TikTok y WhatsApp</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">TikTok Access Token</label>
                                            <input
                                                type="text"
                                                name="tiktok_access_token"
                                                value={company.tiktok_access_token || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">TikTok Pixel ID</label>
                                            <input
                                                type="text"
                                                name="tiktok_pixel_id"
                                                value={company.tiktok_pixel_id || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">WhatsApp Phone Number ID</label>
                                            <input
                                                type="text"
                                                name="whatsapp_phone_number_id"
                                                value={company.whatsapp_phone_number_id || ''}
                                                onChange={handleChange}
                                                placeholder="ID del número en Meta"
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">WhatsApp API Token</label>
                                            <input
                                                type="password"
                                                name="whatsapp_api_key"
                                                value={company.whatsapp_api_key || ''}
                                                onChange={handleChange}
                                                placeholder="Token de WhatsApp Cloud API"
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div className="md:col-span-2 rounded-lg border border-emerald-100 bg-white p-3">
                                            <label className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(company.whatsapp_documents_enabled)}
                                                    onChange={(e) => setCompany((prev) => ({ ...prev, whatsapp_documents_enabled: e.target.checked }))}
                                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>
                                                    <span className="block text-sm font-semibold text-slate-700">Permitir envío de documentos desde leads</span>
                                                    <span className="block text-xs text-slate-500">Habilita adjuntar PDF, imágenes u otros soportes en el tab Conversación del lead.</span>
                                                </span>
                                            </label>
                                        </div>
                                        <div className="md:col-span-2 rounded-lg border border-blue-100 bg-white p-3">
                                            <label className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(company.whatsapp_calling_enabled)}
                                                    onChange={(e) => setCompany((prev) => ({ ...prev, whatsapp_calling_enabled: e.target.checked }))}
                                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>
                                                    <span className="block text-sm font-semibold text-slate-700">Permitir llamadas desde la conversación del lead</span>
                                                    <span className="block text-xs text-slate-500">El CRM puede abrir WhatsApp, abrir el marcador o llamar a un proveedor externo configurado.</span>
                                                </span>
                                            </label>
                                            {company.whatsapp_calling_enabled && (
                                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-600 mb-1">Modo de llamada</label>
                                                        <select
                                                            name="whatsapp_calling_mode"
                                                            value={company.whatsapp_calling_mode || 'whatsapp_link'}
                                                            onChange={handleChange}
                                                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                                        >
                                                            <option value="whatsapp_link">Abrir chat de WhatsApp</option>
                                                            <option value="phone_link">Abrir marcador del dispositivo</option>
                                                            <option value="provider_webhook">Proveedor externo / BSP</option>
                                                        </select>
                                                    </div>
                                                    {company.whatsapp_calling_mode === 'provider_webhook' && (
                                                        <>
                                                            <div>
                                                                <label className="block text-sm font-medium text-slate-600 mb-1">URL del proveedor</label>
                                                                <input
                                                                    type="url"
                                                                    name="whatsapp_calling_provider_url"
                                                                    value={company.whatsapp_calling_provider_url || ''}
                                                                    onChange={handleChange}
                                                                    placeholder="https://proveedor.com/calls"
                                                                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                                                />
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                                                    Token del proveedor {company.whatsapp_calling_provider_token_configured ? '(ya configurado)' : ''}
                                                                </label>
                                                                <input
                                                                    type="password"
                                                                    name="whatsapp_calling_provider_token"
                                                                    value={company.whatsapp_calling_provider_token || ''}
                                                                    onChange={handleChange}
                                                                    placeholder={company.whatsapp_calling_provider_token_configured ? 'Dejar vacío para conservar el token actual' : 'Bearer token opcional'}
                                                                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">IA y chatbot web</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">OpenAI API Key</label>
                                            <input
                                                type="password"
                                                name="openai_api_key"
                                                value={company.openai_api_key || ''}
                                                onChange={handleChange}
                                                placeholder="sk-..."
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Modelo</label>
                                            <input
                                                type="text"
                                                name="gw_model"
                                                value={company.gw_model || ''}
                                                onChange={handleChange}
                                                placeholder="gpt-4o"
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Nombre del bot</label>
                                            <input
                                                type="text"
                                                name="chatbot_bot_name"
                                                value={company.chatbot_bot_name || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">Typing mín. ms</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    name="chatbot_typing_min_ms"
                                                    value={company.chatbot_typing_min_ms ?? 7000}
                                                    onChange={handleChange}
                                                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">Typing máx. ms</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    name="chatbot_typing_max_ms"
                                                    value={company.chatbot_typing_max_ms ?? 18000}
                                                    onChange={handleChange}
                                                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-3 flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            name="gmail_enabled"
                                            checked={Boolean(company.gmail_enabled)}
                                            onChange={(e) => setCompany((prev) => ({ ...prev, gmail_enabled: e.target.checked }))}
                                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Gmail</h4>
                                            <p className="text-xs text-slate-500">Activa lectura y análisis de correo para esta empresa.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Google OAuth Client ID</label>
                                            <input
                                                type="text"
                                                name="gmail_client_id"
                                                value={company.gmail_client_id || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Google OAuth Client Secret</label>
                                            <input
                                                type="password"
                                                name="gmail_client_secret"
                                                value={company.gmail_client_secret || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Redirect URI</label>
                                            <input
                                                type="text"
                                                name="gmail_redirect_uri"
                                                value={company.gmail_redirect_uri || ''}
                                                onChange={handleChange}
                                                placeholder="/api/gmail/oauth/callback"
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Refresh Token</label>
                                            <textarea
                                                rows={3}
                                                name="gmail_refresh_token"
                                                value={company.gmail_refresh_token || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Remitentes a monitorear</label>
                                            <textarea
                                                rows={3}
                                                name="gmail_monitored_sender"
                                                value={company.gmail_monitored_sender || ''}
                                                onChange={handleChange}
                                                placeholder="correo@banco.com"
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Label de Gmail</label>
                                            <input
                                                type="text"
                                                name="gmail_label"
                                                value={company.gmail_label || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                            />
                                            <div className="mt-3 grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-600 mb-1">Días</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="90"
                                                        name="gmail_sync_days"
                                                        value={company.gmail_sync_days ?? 7}
                                                        onChange={handleChange}
                                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-600 mb-1">Máx.</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        name="gmail_sync_max_results"
                                                        value={company.gmail_sync_max_results ?? 20}
                                                        onChange={handleChange}
                                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <h3 className="text-lg font-bold mb-4 text-slate-700">Correo SMTP de la empresa</h3>
                            <label className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <input
                                    type="checkbox"
                                    name="public_credit_requires_email_validation"
                                    checked={Boolean(company.public_credit_requires_email_validation)}
                                    onChange={(e) => setCompany((prev) => ({
                                        ...prev,
                                        public_credit_requires_email_validation: e.target.checked,
                                    }))}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <p className="font-medium text-slate-800">Requerir código de validación por correo</p>
                                    <p className="text-xs text-slate-500">
                                        Si está desactivado, el formulario de crédito se puede enviar sin OTP. El correo SMTP seguirá enviando copias y PDFs si está configurado.
                                    </p>
                                </div>
                            </label>
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
                                        placeholder={company.smtp_password_configured ? 'Deja vacio para conservar la contrasena actual' : 'App password o credencial SMTP'}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                    {company.smtp_password_configured && (
                                        <p className="mt-1 text-xs text-slate-500">
                                            Ya hay una contrasena SMTP guardada. Escribe una nueva solo si quieres reemplazarla.
                                        </p>
                                    )}
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
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Destinatarios permanentes del formulario de crédito
                                    </label>
                                    <textarea
                                        name="smtp_always_recipients"
                                        value={company.smtp_always_recipients}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder={'creditos@empresa.com\nadministracion@empresa.com'}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                    />
                                    <p className="mt-1 text-xs text-slate-500">
                                        Separa los correos por comas o saltos de línea. El solicitante siempre recibirá su propia copia.
                                    </p>
                                </div>
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
                                    {company.logo_url ? (
                                        <img src={normalizeMediaUrl(company.logo_url)} alt="Logo" className="w-full h-full object-cover" />
                                    ) : null}
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

