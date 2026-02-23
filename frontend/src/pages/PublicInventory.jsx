import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const PublicInventory = () => {
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
        color: ''
    });

    const [showFilters, setShowFilters] = useState(false); // Mobile toggle

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
            const res = await axios.get('http://3.234.117.124:8000/vehicles/makes');
            setMakes(res.data);
        } catch (error) {
            console.error("Error fetching makes", error);
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

            const res = await axios.get('http://3.234.117.124:8000/vehicles/public', { params });
            setVehicles(res.data);
        } catch (error) {
            console.error("Error fetching vehicles", error);
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

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            {/* Navbar */}
            <header className="bg-slate-900 shadow-lg sticky top-0 z-50 border-b border-slate-800">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link to="/autos" className="text-2xl font-extrabold text-white tracking-tight">
                            <span className="text-blue-500">Autos</span>QP
                        </Link>
                    </div>

                    <div className="flex-1 max-w-2xl hidden md:block">
                        <div className="relative">
                            <input
                                type="text"
                                name="q"
                                value={filters.q}
                                onChange={handleFilterChange}
                                placeholder="Buscar vehículos..."
                                className="w-full pl-4 pr-10 py-2.5 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-slate-50 border-none"
                            />
                            <button className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-blue-600 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </button>
                        </div>
                    </div>

                    <nav className="flex items-center gap-4 text-sm font-bold">
                        <Link
                            to="/login"
                            className="text-white hover:text-blue-400 transition bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20"
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
                    />
                </div>
            </header>

            <main className="flex">
                {/* Sidebar */}
                <aside
                    className={`
                        fixed inset-y-0 left-0 z-40 bg-slate-900 text-white shadow-xl transition-transform duration-300 ease-in-out transform 
                        ${showFilters ? 'translate-x-0' : '-translate-x-full'} 
                        md:translate-x-0 md:static md:h-[calc(100vh-64px)] md:sticky md:top-16
                        w-64 flex-shrink-0 overflow-y-auto custom-scrollbar border-r border-slate-800
                    `}
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
                            <h4 className="font-semibold text-sm mb-2 text-slate-300">Precio</h4>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    name="price_min"
                                    placeholder="Mín"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    onChange={handleFilterChange}
                                />
                                <span className="text-slate-500">-</span>
                                <input
                                    type="number"
                                    name="price_max"
                                    placeholder="Máx"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    onChange={handleFilterChange}
                                />
                            </div>
                        </div>

                        {/* Brand Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2 text-slate-300">Marca</h4>
                            <select
                                name="make"
                                className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none mb-2"
                                onChange={handleFilterChange}
                                value={filters.make}
                            >
                                <option value="">Todas</option>
                                {makes.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        {/* Year Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2 text-slate-300">Año</h4>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    name="year_from"
                                    placeholder="Desde"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    onChange={handleFilterChange}
                                />
                                <span className="text-slate-500">-</span>
                                <input
                                    type="number"
                                    name="year_to"
                                    placeholder="Hasta"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    onChange={handleFilterChange}
                                />
                            </div>
                        </div>

                        {/* Model Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2 text-slate-300">Modelo</h4>
                            <input
                                type="text"
                                name="model" // Use 'model' distinct from global 'q'
                                placeholder="Escribe el modelo..."
                                className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                onChange={handleFilterChange}
                                value={filters.model || ''}
                            />
                        </div>

                        {/* Mileage Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2 text-slate-300">Kilometraje</h4>
                            <div className="flex gap-2 items-center mb-2">
                                <input
                                    type="number"
                                    name="mileage_min"
                                    placeholder="Mín"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    onChange={handleFilterChange}
                                    value={filters.mileage_min || ''}
                                />
                                <span className="text-slate-500">-</span>
                                <input
                                    type="number"
                                    name="mileage_max"
                                    placeholder="Máx"
                                    className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    onChange={handleFilterChange}
                                    value={filters.mileage_max || ''}
                                />
                            </div>
                        </div>

                        {/* Color Filter */}
                        <div className="mb-6">
                            <h4 className="font-semibold text-sm mb-2 text-slate-300">Color</h4>
                            <input
                                type="text"
                                name="color"
                                placeholder="Ej: Blanco, Rojo..."
                                className="w-full text-sm p-2 bg-slate-800 border-slate-700 border rounded text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                onChange={handleFilterChange}
                                value={filters.color || ''}
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
                                color: ''
                            })}
                            className="text-blue-400 text-sm font-medium hover:text-blue-300 w-full text-center transition-colors pb-10"
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
                        <h1 className="text-2xl font-bold text-gray-800">
                            {filters.make ? `${filters.make}` : 'Carros y Camionetas'}
                            <span className="text-gray-500 font-normal text-base ml-2 bg-white px-2 py-1 rounded-full shadow-sm">{vehicles.length} resultados</span>
                        </h1>
                        <button
                            className="md:hidden flex items-center gap-2 text-slate-700 font-bold bg-white px-4 py-2 rounded-lg shadow-sm"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            Filtros
                        </button>
                    </div >

                    {/* Grid */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="bg-white h-80 rounded-2xl shadow-sm"></div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                {vehicles.map(vehicle => (
                                    <div
                                        key={vehicle.id}
                                        className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group relative border-2 border-slate-100 hover:border-blue-500 flex flex-col"
                                    >
                                        {/* Image Container with Overlay */}
                                        <Link to={`/autos/${vehicle.id}`} className="block relative aspect-[4/3] overflow-hidden">
                                            {vehicle.photos && vehicle.photos.length > 0 ? (
                                                <img
                                                    src={vehicle.photos[0]}
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
                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-wide">
                                                    {vehicle.make}
                                                </span>
                                            </div>

                                            <Link to={`/autos/${vehicle.id}`} className="block">
                                                <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">
                                                    {vehicle.make} {vehicle.model}
                                                </h3>
                                            </Link>

                                            <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-50">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-400 uppercase font-medium">Precio</span>
                                                    <span className="text-xl font-extrabold text-slate-900">
                                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(vehicle.price)}
                                                    </span>
                                                </div>

                                                <Link
                                                    to={`/autos/${vehicle.id}`}
                                                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {vehicles.length === 0 && (
                                <div className="col-span-full p-12 text-center text-gray-500">
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
                                        className="mt-4 text-blue-600 font-semibold"
                                    >
                                        Ver todos los vehículos
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default PublicInventory;
