import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import PublicSalesChatbot from '../components/PublicSalesChatbot';
import PublicBrandLogo from '../components/PublicBrandLogo';
import { normalizeMediaUrl } from '../utils/media';
import { getPublicCompanyHomeUrl, usePublicCompany } from '../utils/publicCompany';

const withAlpha = (hex, alpha = '14') => {
    if (typeof hex !== 'string') return hex;
    const normalized = hex.trim();
    if (!normalized.startsWith('#')) return normalized;
    if (normalized.length === 7) return `${normalized}${alpha}`;
    if (normalized.length === 4) {
        const expanded = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
        return `${expanded}${alpha}`;
    }
    return normalized;
};

const normalizeArrayPayload = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.makes)) return payload.makes;
    return [];
};

const PublicInventory = () => {
    const company = usePublicCompany();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [makes, setMakes] = useState([]);

    // Filters
    const [filters, setFilters] = useState({
        q: '',
        make: '',
        year_from: '',
        year_to: '',
        price_min: '',
        price_max: '',
        model: '',
        mileage_min: '',
        mileage_max: '',
        color: '',
        sort_by: ''
    });

    const [showFilters, setShowFilters] = useState(false); // Mobile toggle
    const safeMakes = normalizeArrayPayload(makes);
    const safeVehicles = normalizeArrayPayload(vehicles);

    useEffect(() => {
        fetchMakes();
        fetchVehicles();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchVehicles();
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [filters]);

    const fetchMakes = async () => {
        try {
            const res = await axios.get('/api/vehicles/makes');
            setMakes(normalizeArrayPayload(res.data));
        } catch (error) {
            console.error("Error fetching makes", error);
            setMakes([]);
        }
    };

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.q) params.q = filters.q;
            if (filters.make) params.make = filters.make;
            if (filters.year_from) params.year_from = filters.year_from;
            if (filters.year_to) params.year_to = filters.year_to;
            if (filters.price_min) params.price_min = filters.price_min;
            if (filters.price_max) params.price_max = filters.price_max;
            if (filters.model) params.model = filters.model;
            if (filters.mileage_min) params.mileage_min = filters.mileage_min;
            if (filters.mileage_max) params.mileage_max = filters.mileage_max;
            if (filters.color) params.color = filters.color;
            if (filters.sort_by) params.sort_by = filters.sort_by;

            const res = await axios.get('/api/vehicles/public', { params });
            setVehicles(normalizeArrayPayload(res.data));
        } catch (error) {
            console.error("Error fetching vehicles", error);
            setVehicles([]);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
    };

    const publicHomeUrl = getPublicCompanyHomeUrl(company.public_domain);
    const brandName = company.name || 'AutosQP';
    const enabledModules = new Set(Array.isArray(company?.enabled_modules) ? company.enabled_modules : []);
    const isCreditFormEnabled = enabledModules.has('public_credit_form');
    const isPublicChatEnabled = enabledModules.has('public_sales_chat');
    const primaryColor = company.primary_color || '#2563eb';
    const secondaryColor = company.secondary_color || '#0f172a';
    const primarySoft = withAlpha(primaryColor, '14');
    const secondarySoft = withAlpha(secondaryColor, 'f0');
    const darkPanel = withAlpha(secondaryColor, 'f7');
    const controlDark = withAlpha(secondaryColor, 'e8');
    const darkBorder = withAlpha(primaryColor, '28');
    const lightBorder = withAlpha(primaryColor, '22');

    const darkInputStyle = {
        backgroundColor: controlDark,
        borderColor: darkBorder,
    };

    const lightInputStyle = {
        borderColor: lightBorder,
        boxShadow: `0 0 0 1px ${withAlpha(primaryColor, '18')}`,
    };

    return (
        <div
            className="min-h-screen font-sans"
            style={{
                '--public-primary': primaryColor,
                '--public-secondary': secondaryColor,
                '--public-primary-soft': primarySoft,
                background: `linear-gradient(180deg, ${withAlpha(primaryColor, '12')} 0%, #f8fafc 24%, #eef2f7 100%)`,
            }}
        >
            {/* Navbar */}
            <header
                className="shadow-lg sticky top-0 z-50 border-b"
                style={{
                    background: `linear-gradient(90deg, ${secondaryColor} 0%, ${withAlpha(primaryColor, 'dd')} 100%)`,
                    borderColor: withAlpha(primaryColor, '30'),
                }}
            >
                <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <a
                            href={publicHomeUrl}
                            title={brandName}
                            className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-90"
                        >
                            <PublicBrandLogo
                                company={company}
                                brandName={brandName}
                                className="h-11 w-auto object-contain md:h-12"
                                fallbackClassName="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white md:h-12 md:w-12"
                                showText={Boolean(company?.logo_url)}
                                textClassName="hidden text-sm font-semibold text-white/85 md:inline"
                                primaryColor={primaryColor}
                                secondaryColor={secondaryColor}
                            />
                        </a>
                    </div>

                    <div className="flex-1 max-w-2xl hidden md:block">
                        <div className="relative">
                            <input
                                type="text"
                                name="q"
                                value={filters.q}
                                onChange={handleFilterChange}
                                placeholder="Buscar vehículos..."
                                className="w-full pl-4 pr-10 py-2.5 rounded-lg shadow-sm focus:outline-none text-slate-700 bg-slate-50 border-none"
                                style={lightInputStyle}
                            />
                            <button className="absolute right-0 top-0 h-full px-3 text-slate-400 transition" style={{ color: primaryColor }}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </button>
                        </div>
                    </div>

                    <nav className="flex items-center gap-4 text-sm font-bold">
                        {isCreditFormEnabled && (
                            <Link
                                to="/credito"
                                className="transition px-4 py-2 rounded-lg border text-white"
                                style={{ borderColor: withAlpha(primaryColor, '55'), backgroundColor: withAlpha(secondaryColor, '44') }}
                            >
                                Formulario de crédito
                            </Link>
                        )}
                        <Link
                            to="/login"
                            className="text-white transition px-4 py-2 rounded-lg"
                            style={{ backgroundColor: primaryColor }}
                        >
                            Ingresa
                        </Link>
                    </nav>
                </div>
                {/* Mobile Search */}
                <div className="md:hidden px-4 pb-3">
                    <input
                        type="text"
                        name="q"
                        value={filters.q}
                        onChange={handleFilterChange}
                        placeholder="Buscar vehículos..."
                        className="w-full pl-4 pr-10 py-2 rounded-sm shadow-sm focus:outline-none text-slate-700"
                        style={lightInputStyle}
                    />
                </div>
            </header>

            <main className="flex">
                {/* Sidebar */}
                <aside
                    className={`
                        fixed inset-y-0 left-0 z-40 text-white shadow-xl transition-transform duration-300 ease-in-out transform 
                        ${showFilters ? 'translate-x-0' : '-translate-x-full'} 
                        md:translate-x-0 md:static md:h-[calc(100vh-64px)] md:sticky md:top-16
                        w-64 flex-shrink-0 overflow-y-auto custom-scrollbar border-r
                    `}
                    style={{
                        background: `linear-gradient(180deg, ${darkPanel} 0%, ${secondaryColor} 100%)`,
                        borderColor: darkBorder,
                    }}
                >
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-white">Filtros</h3>
                            <button
                                className="md:hidden text-slate-400 hover:text-white"
                                onClick={() => setShowFilters(false)}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Price Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2" style={{ color: primaryColor }}>Precio</h4>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    name="price_min"
                                    placeholder="Mín"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 outline-none"
                                    onChange={handleFilterChange}
                                    value={filters.price_min}
                                    style={darkInputStyle}
                                />
                                <span className="text-slate-500">-</span>
                                <input
                                    type="number"
                                    name="price_max"
                                    placeholder="Máx"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 outline-none"
                                    onChange={handleFilterChange}
                                    value={filters.price_max}
                                    style={darkInputStyle}
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2" style={{ color: primaryColor }}>Ordenar por</h4>
                            <select
                                name="sort_by"
                                className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white outline-none"
                                onChange={handleFilterChange}
                                value={filters.sort_by}
                                style={darkInputStyle}
                            >
                                <option value="">Más recientes</option>
                                <option value="price_desc">Precio: mayor a menor</option>
                                <option value="price_asc">Precio: menor a mayor</option>
                                <option value="mileage_desc">Kilometraje: mayor a menor</option>
                                <option value="mileage_asc">Kilometraje: menor a mayor</option>
                            </select>
                        </div>

                        {/* Brand Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2" style={{ color: primaryColor }}>Marca</h4>
                            <select
                                name="make"
                                className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white outline-none mb-2"
                                onChange={handleFilterChange}
                                value={filters.make}
                                style={darkInputStyle}
                            >
                                <option value="">Todas</option>
                                {safeMakes.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        {/* Year Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2" style={{ color: primaryColor }}>Año</h4>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    name="year_from"
                                    placeholder="Desde"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 outline-none"
                                    onChange={handleFilterChange}
                                    style={darkInputStyle}
                                />
                                <span className="text-slate-500">-</span>
                                <input
                                    type="number"
                                    name="year_to"
                                    placeholder="Hasta"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 outline-none"
                                    onChange={handleFilterChange}
                                    style={darkInputStyle}
                                />
                            </div>
                        </div>

                        {/* Model Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2" style={{ color: primaryColor }}>Modelo</h4>
                            <input
                                type="text"
                                name="model" // Use 'model' distinct from global 'q'
                                placeholder="Escribe el modelo..."
                                className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 outline-none"
                                onChange={handleFilterChange}
                                value={filters.model || ''}
                                style={darkInputStyle}
                            />
                        </div>

                        {/* Mileage Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2" style={{ color: primaryColor }}>Kilometraje</h4>
                            <div className="flex gap-2 items-center mb-2">
                                <input
                                    type="number"
                                    name="mileage_min"
                                    placeholder="Mín"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 outline-none"
                                    onChange={handleFilterChange}
                                    value={filters.mileage_min || ''}
                                    style={darkInputStyle}
                                />
                                <span className="text-slate-500">-</span>
                                <input
                                    type="number"
                                    name="mileage_max"
                                    placeholder="Máx"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 outline-none"
                                    onChange={handleFilterChange}
                                    value={filters.mileage_max || ''}
                                    style={darkInputStyle}
                                />
                            </div>
                        </div>

                        {/* Color Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2" style={{ color: primaryColor }}>Color</h4>
                            <input
                                type="text"
                                name="color"
                                placeholder="Ej: Blanco, Rojo..."
                                className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 outline-none"
                                onChange={handleFilterChange}
                                value={filters.color || ''}
                                style={darkInputStyle}
                            />
                        </div>

                        <button
                            onClick={() => setFilters({
                                q: '',
                                make: '',
                                model: '',
                                year_from: '',
                                year_to: '',
                                price_min: '',
                                price_max: '',
                                mileage_min: '',
                                mileage_max: '',
                                color: '',
                                sort_by: ''
                            })}
                            className="text-sm font-medium w-full text-center transition-colors pb-10"
                            style={{ color: primaryColor }}
                        >
                            Limpiar filtros
                        </button>
                    </div>
                </aside>

                {/* Overlay for mobile */}
                {showFilters && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
                        onClick={() => setShowFilters(false)}
                    ></div>
                )}

                {/* Main Content */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto">
                    {/* Header Results */}
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold" style={{ color: secondaryColor }}>
                            {filters.make ? `${filters.make}` : 'Carros y Camionetas'}
                            <span
                                className="font-normal text-base ml-2 px-2 py-1 rounded-full shadow-sm"
                                style={{ color: primaryColor, backgroundColor: primarySoft }}
                            >
                                {safeVehicles.length} resultados
                            </span>
                        </h1>
                        <div className="flex items-center gap-3">
                            <select
                                name="sort_by"
                                value={filters.sort_by}
                                onChange={handleFilterChange}
                                className="hidden md:block rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none transition"
                                style={lightInputStyle}
                            >
                                <option value="">Más recientes</option>
                                <option value="price_desc">Precio: mayor a menor</option>
                                <option value="price_asc">Precio: menor a mayor</option>
                                <option value="mileage_desc">Kilometraje: mayor a menor</option>
                                <option value="mileage_asc">Kilometraje: menor a mayor</option>
                            </select>
                            <button
                                className="md:hidden flex items-center gap-2 font-bold bg-white px-4 py-2 rounded-lg shadow-sm border"
                                onClick={() => setShowFilters(!showFilters)}
                                style={{ color: secondaryColor, borderColor: lightBorder }}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                Filtros
                            </button>
                        </div>
                    </div >

                    {/* Grid */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div
                                        key={i}
                                        className="h-80 rounded-2xl shadow-sm"
                                        style={{
                                            background: `linear-gradient(180deg, #ffffff 0%, ${withAlpha(primaryColor, '08')} 100%)`,
                                            border: `1px solid ${withAlpha(primaryColor, '18')}`,
                                        }}
                                    ></div>
                                ))}
                            </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                {safeVehicles.map(vehicle => (
                                    <div
                                        key={vehicle.id}
                                        className="rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group relative border-2 flex flex-col"
                                        style={{
                                            borderColor: withAlpha(primaryColor, '18'),
                                            background: `linear-gradient(180deg, #ffffff 0%, ${withAlpha(primaryColor, '08')} 100%)`,
                                        }}
                                    >
                                        {/* Image Container with Overlay */}
                                        <Link to={`/autos/${vehicle.id}`} className="block relative aspect-[4/3] overflow-hidden">
                                            {vehicle.photos && vehicle.photos.length > 0 ? (
                                                <img
                                                    src={normalizeMediaUrl(vehicle.photos[0])}
                                                    alt={`${vehicle.make} ${vehicle.model}`}
                                                    className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${vehicle.status === 'sold' ? 'grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100' : ''}`}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                                                    <span className="text-sm">Sin imagen</span>
                                                </div>
                                            )}

                                            {/* Sold Badge - Rectangular & Semi-transparent as requested */}
                                            {vehicle.status === 'sold' && (
                                                <div className="absolute top-4 left-0 bg-red-600/90 text-white font-bold px-6 py-1 shadow-lg z-10 backdrop-blur-sm">
                                                    VENDIDO
                                                </div>
                                            )}

                                            {/* Hover Overlay with Quick Stats */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex justify-between text-white text-xs font-medium backdrop-blur-[2px]">
                                                <div className="flex flex-col items-center">
                                                    <span className="opacity-70 uppercase tracking-wider text-[10px]">Año</span>
                                                    <span>{vehicle.year}</span>
                                                </div>
                                                <div className="h-8 w-px bg-white/20"></div>
                                                <div className="flex flex-col items-center">
                                                    <span className="opacity-70 uppercase tracking-wider text-[10px]">Km</span>
                                                    <span>{vehicle.mileage?.toLocaleString()}</span>
                                                </div>
                                                <div className="h-8 w-px bg-white/20"></div>
                                                <div className="flex flex-col items-center">
                                                    <span className="opacity-70 uppercase tracking-wider text-[10px]">Color</span>
                                                    <span>{vehicle.color || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </Link>

                                        {/* Card Body */}
                                        <div className="p-5">
                                            <div className="mb-3">
                                                <span
                                                    className="text-xs font-bold px-2 py-1 rounded uppercase tracking-wide"
                                                    style={{
                                                        color: primaryColor,
                                                        backgroundColor: primarySoft,
                                                    }}
                                                >
                                                    {vehicle.make}
                                                </span>
                                            </div>

                                            <Link to={`/autos/${vehicle.id}`} className="block">
                                                <h3
                                                    className="text-lg font-bold mb-1 transition-colors line-clamp-1"
                                                    style={{ color: secondaryColor }}
                                                >
                                                    {vehicle.make} {vehicle.model}
                                                </h3>
                                            </Link>

                                            <div
                                                className="flex justify-between items-end mt-4 pt-4 border-t"
                                                style={{ borderColor: withAlpha(primaryColor, '14') }}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-400 uppercase font-medium">Precio</span>
                                                    <span className="text-xl font-extrabold" style={{ color: secondaryColor }}>
                                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(vehicle.price)}
                                                    </span>
                                                </div>

                                                <Link
                                                    to={`/autos/${vehicle.id}`}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                                                    style={{
                                                        backgroundColor: primarySoft,
                                                        color: primaryColor,
                                                    }}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {safeVehicles.length === 0 && (
                                <div
                                    className="col-span-full rounded-2xl p-12 text-center"
                                    style={{
                                        color: secondaryColor,
                                        backgroundColor: '#ffffff',
                                        border: `1px solid ${withAlpha(primaryColor, '18')}`,
                                    }}
                                >
                                    <p className="text-lg">No encontramos vehículos que coincidan con tu búsqueda.</p>
                                    <button
                                        onClick={() => setFilters({
                                            q: '',
                                            make: '',
                                            model: '',
                                            year_from: '',
                                            year_to: '',
                                            price_min: '',
                                            price_max: '',
                                            mileage_min: '',
                                            mileage_max: '',
                                            color: ''
                                        })}
                                        className="mt-4 font-semibold"
                                        style={{ color: primaryColor }}
                                    >
                                        Ver todos los vehículos
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
            {isPublicChatEnabled && (
                <PublicSalesChatbot
                    brandName={brandName}
                    sessionStorageKey={`public_chat_session_${company.public_domain || window.location.host}`}
                />
            )}
        </div>
    );
};

export default PublicInventory;
