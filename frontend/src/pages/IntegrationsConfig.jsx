import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const IntegrationTab = ({ active, label, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`
            flex items-center gap-2 px-6 py-3 font-medium text-sm transition-all duration-300 border-b-2
            ${active
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
        `}
    >
        {icon}
        {label}
    </button>
);

const IntegrationsConfig = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('facebook');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(true);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Initial state matching backend schema
    const [settings, setSettings] = useState({
        facebook_access_token: '',
        facebook_pixel_id: '',
        instagram_access_token: '',
        tiktok_access_token: '',
        tiktok_pixel_id: '',
        whatsapp_api_key: '',
        whatsapp_phone_number_id: '',
        openai_api_key: '',
        gw_model: 'gpt-4o'
    });

    useEffect(() => {
        const fetchSettings = async () => {
            if (!user?.company_id) return; // Should handle global admin distinctively if needed

            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`https://autosqp.co/api/companies/${user.company_id}/integrations`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Merge with defaults to ensure controlled inputs
                setSettings(prev => ({ ...prev, ...response.data }));
            } catch (error) {
                console.error("Error fetching integration settings", error);
                setStatus({ type: 'error', message: 'No se pudieron cargar las configuraciones.' });
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchSettings();
        }
    }, [user]);

    const handleChange = (e) => {
        setSettings({
            ...settings,
            [e.target.name]: e.target.value
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setStatus({ type: 'loading', message: 'Guardando configuración...' });

        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `https://autosqp.co/api/companies/${user.company_id}/integrations`,
                settings,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setStatus({ type: 'success', message: '¡Configuración guardada exitosamente!' });

            // Clear success message after 3 seconds
            setTimeout(() => setStatus({ type: '', message: '' }), 3000);
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Error al guardar los cambios.' });
        }
    };

    const handleUploadExcel = async () => {
        if (!uploadFile) return;
        setUploading(true);
        setStatus({ type: 'loading', message: 'Leyendo datos, esto puede tardar unos segundos...' });

        const formData = new FormData();
        formData.append('file', uploadFile);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `https://autosqp.co/api/vehicles/upload`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const { inserted, updated, errors } = response.data;
            setStatus({
                type: 'success',
                message: `✅ Importado: ${inserted} nuevos, ${updated} actualizados. ❌ Errores: ${errors}`
            });
            setTimeout(() => setStatus({ type: '', message: '' }), 10000);
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: error.response?.data?.detail || 'Error al importar archivo. Verifica el formato.' });
            setTimeout(() => setStatus({ type: '', message: '' }), 5000);
        } finally {
            setUploading(false);
            setUploadFile(null);
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Cargando integraciones...</div>;

    return (
        <div className="max-w-5xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-800">Integraciones & API</h1>
                <p className="text-slate-500 mt-2">
                    Conecta tus plataformas favoritas para potenciar tu CRM.
                </p>
            </header>

            {status.message && (
                <div className={`mb-6 p-4 rounded-lg text-white font-bold shadow-lg transform transition-all duration-500 ${status.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
                    {status.message}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Tabs Header */}
                <div className="flex border-b border-gray-100 overflow-x-auto">
                    <IntegrationTab
                        active={activeTab === 'facebook'}
                        label="Meta (FB e IG)"
                        onClick={() => setActiveTab('facebook')}
                        icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>}
                    />
                    <IntegrationTab
                        active={activeTab === 'tiktok'}
                        label="TikTok"
                        onClick={() => setActiveTab('tiktok')}
                        icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v6.16c0 3.13-2.69 5.89-5.91 5.75-2.74-.12-4.97-2.31-5.14-5.05-.18-2.9 1.83-5.59 4.71-5.89 1.02-.11 1.95.2 2.87.58v4.06c-.34-.31-.58-.55-1.02-.69-.94-.29-2.02-.13-2.79.52-.92.79-1.19 2.19-.65 3.3.69 1.45 2.59 1.94 3.99 1.25 1.13-.56 1.74-1.93 1.74-3.18V4.76c-1.49 0-2.97-.01-4.46 0v-4.74z" /></svg>}
                    />
                    <IntegrationTab
                        active={activeTab === 'whatsapp'}
                        label="WhatsApp"
                        onClick={() => setActiveTab('whatsapp')}
                        icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.506-.669-.516-.173-.009-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>}
                    />
                    <IntegrationTab
                        active={activeTab === 'gpt'}
                        label="ChatGPT / AI"
                        onClick={() => setActiveTab('gpt')}
                        icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.28 9.06a8.55 8.55 0 0 0-1.28-4.47 8.76 8.76 0 0 0-3.32-3.15 8.61 8.61 0 0 0-6.91-.4 8.67 8.67 0 0 0-4.48 2.5 8.62 8.62 0 0 0-2.52 4.48A8.61 8.61 0 0 0 4.15 15a8.59 8.59 0 0 0 1.28 4.47 8.76 8.76 0 0 0 3.32 3.15 8.68 8.68 0 0 0 3.84.88 8.62 8.62 0 0 0 3.06-.57 8.68 8.68 0 0 0 4.48-2.5 8.57 8.57 0 0 0 2.5-4.48 8.68 8.68 0 0 0-.4-6.91ZM10.74 3a6.83 6.83 0 0 1 3.86 1.36 1.21 1.21 0 0 1 .4 1.57l-.05.07-.12.18-.76 1.32-.47.81a6.6 6.6 0 0 0-4.07.6c-.19.09-.4.15-.61.16-.42.06-.85-.09-1.16-.38l-1.3-1.34a1.22 1.22 0 0 1 .15-1.84A6.73 6.73 0 0 1 10.74 3Zm-6.52 7a6.69 6.69 0 0 1 .84-3.52 1.22 1.22 0 0 1 1.62-.31l.07.05.18.11 1.35.77.8.46a6.56 6.56 0 0 0 2.22 3.49c.14.15.26.33.34.52.17.4.11.86-.15 1.21l-1.32 1.32a1.22 1.22 0 0 1-1.84-.13A6.74 6.74 0 0 1 4.22 10Zm2.94 8.73a6.79 6.79 0 0 1-2.9-2.92 1.22 1.22 0 0 1 .32-1.63l.06-.05.18-.11 1.35-.77.8-.46a6.61 6.61 0 0 0 4.12.22c.2-.06.4-.16.57-.31.33-.29.5-.72.45-1.15l-.26-1.85a1.22 1.22 0 0 1 .91-1.36 6.79 6.79 0 0 1 6.13.91 1.22 1.22 0 0 1 .32 1.63l-.06.05-.18.12-1.34.76-.8.46a6.57 6.57 0 0 0-2.23-3.48 1.58 1.58 0 0 1-.35-.53 1.22 1.22 0 0 1 .16-1.2l1.32-1.33a1.22 1.22 0 0 1 1.84.13 6.77 6.77 0 0 1 1.09 3.86 6.83 6.83 0 0 1-3.86 3.09 1.21 1.21 0 0 1-1.57-.4l-.06-.06-.11-.18-.77-1.33-.46-.8a6.59 6.59 0 0 0-4.06-.6 1.45 1.45 0 0 1-1.78.22l-1.34-1.34a1.22 1.22 0 0 1-.15-1.84Zm-6.52 7a6.69 6.69 0 0 1 .84-3.52 1.22 1.22 0 0 1 1.62-.31l.07.05.18.11 1.35.77.8.46a6.56 6.56 0 0 0 2.22 3.49c.14.15.26.33.34.52.17.4.11.86-.15 1.21l-1.32 1.32a1.22 1.22 0 0 1-1.84-.13A6.74 6.74 0 0 1 4.22 10Zm2.94 8.73a6.79 6.79 0 0 1-2.9-2.92 1.22 1.22 0 0 1 .32-1.63l.06-.05.18-.11 1.35-.77.8-.46a6.61 6.61 0 0 0 4.12.22c.2-.06.4-.16.57-.31.33-.29.5-.72.45-1.15l-.26-1.85a1.22 1.22 0 0 1 .91-1.36 6.79 6.79 0 0 1 6.13.91 1.22 1.22 0 0 1 .32 1.63l-.06.05-.18.12-1.34.76-.8.46a6.57 6.57 0 0 0-2.23-3.48 1.58 1.58 0 0 1-.35-.53 1.22 1.22 0 0 1 .16-1.2l1.32-1.33a1.22 1.22 0 0 1 1.84.13 6.77 6.77 0 0 1 1.09 3.86 6.83 6.83 0 0 1-3.86 3.09 1.21 1.21 0 0 1-1.57-.4l-.06-.06-.11-.18-.77-1.33-.46-.8a6.59 6.59 0 0 0-4.06-.6 1.45 1.45 0 0 1-1.78.22l-1.34-1.34a1.22 1.22 0 0 1-.15-1.84Z" /></svg>}
                    />
                    <IntegrationTab
                        active={activeTab === 'import'}
                        label="Importar Inventario"
                        onClick={() => setActiveTab('import')}
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                    />
                </div>

                {/* Content */}
                <form onSubmit={handleSave} className="p-8">

                    {/* Facebook Tab */}
                    {activeTab === 'facebook' && (
                        <div className="space-y-6 fade-in">
                            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Configuración de Meta (FB e IG)</h2>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Access Token (Facebook Developer App)</label>
                                <input
                                    type="text"
                                    name="facebook_access_token"
                                    value={settings.facebook_access_token || ''}
                                    onChange={handleChange}
                                    placeholder="EAAB..."
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">Token de acceso Graph API para leer y recibir mensajes de tus Páginas de FB e IG vinculadas.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Pixel ID</label>
                                <input
                                    type="text"
                                    name="facebook_pixel_id"
                                    value={settings.facebook_pixel_id || ''}
                                    onChange={handleChange}
                                    placeholder="1234567890"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Instagram Tab - Removed as it's merged with Meta */}

                    {/* TikTok Tab */}
                    {activeTab === 'tiktok' && (
                        <div className="space-y-6 fade-in">
                            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Configuración de TikTok Business</h2>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Access Token</label>
                                <input
                                    type="text"
                                    name="tiktok_access_token"
                                    value={settings.tiktok_access_token || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Pixel ID</label>
                                <input
                                    type="text"
                                    name="tiktok_pixel_id"
                                    value={settings.tiktok_pixel_id || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* WhatsApp Tab */}
                    {activeTab === 'whatsapp' && (
                        <div className="space-y-6 fade-in">
                            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">WhatsApp Business API</h2>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Phone Number ID</label>
                                <input
                                    type="text"
                                    name="whatsapp_phone_number_id"
                                    value={settings.whatsapp_phone_number_id || ''}
                                    onChange={handleChange}
                                    placeholder="100345..."
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Permanent Access Token / API Key</label>
                                <input
                                    type="password"
                                    name="whatsapp_api_key"
                                    value={settings.whatsapp_api_key || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* ChatGPT Tab */}
                    {activeTab === 'gpt' && (
                        <div className="space-y-6 fade-in">
                            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Inteligencia Artificial (OpenAI)</h2>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">OpenAI API Key</label>
                                <input
                                    type="password"
                                    name="openai_api_key"
                                    value={settings.openai_api_key || ''}
                                    onChange={handleChange}
                                    placeholder="sk-..."
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">Se usará para generar respuestas automáticas y análisis.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Modelo Preferido</label>
                                <select
                                    name="gw_model"
                                    value={settings.gw_model || 'gpt-4o'}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="gpt-4o">GPT-4o (Recomendado)</option>
                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Import Tab */}
                    {activeTab === 'import' && (
                        <div className="space-y-6 fade-in">
                            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Importar Inventario desde Excel</h2>

                            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm mb-4">
                                <p className="font-semibold mb-1">Instrucciones:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Sube el archivo Excel con el formato "INVENTARIO PAGINA WEB CRM.xlsx".</li>
                                    <li>Las columnas deben coincidir con la plantilla oficial (Marca & Modelo, Año, Precio, etc).</li>
                                    <li>Los vehículos nuevos se agregarán, los existentes (por Placa) se actualizarán.</li>
                                </ul>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Seleccionar archivo Excel (.xlsx)</label>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={(e) => setUploadFile(e.target.files[0])}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                                />
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleUploadExcel}
                                    disabled={uploading || !uploadFile}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-all disabled:opacity-50"
                                >
                                    {uploading ? 'Procesando archivo...' : 'Subir e Importar Inventario'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab !== 'import' && (
                        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={status.type === 'loading'}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-all transform hover:-translate-y-0.5 disabled:opacity-70"
                            >
                                {status.type === 'loading' ? 'Guardando...' : 'Guardar Configuración'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default IntegrationsConfig;
