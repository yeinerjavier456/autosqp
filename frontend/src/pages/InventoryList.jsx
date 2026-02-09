import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

const InventoryList = () => {
    const { user } = useAuth();
    const isAdvisor = user?.role?.name === 'asesor' || user?.role === 'asesor';

    const [vehicles, setVehicles] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(50); // Max 50 per page as requested
    const [activeTab, setActiveTab] = useState('available'); // 'available' or 'sold'
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const skip = (page - 1) * limit;
            const params = { skip, limit, status: activeTab }; // Filter by status
            if (search) params.q = search;

            const response = await axios.get('http://localhost:8000/vehicles/', {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });
            setVehicles(response.data.items);
            setTotal(response.data.total);
        } catch (error) {
            console.error("Error fetching vehicles", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1); // Reset page when tab changes
        fetchVehicles();
    }, [page, search, activeTab]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleMarkSold = async (vehicleId) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "¿Quieres marcar este vehículo como VENDIDO?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, marcar vendido',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-red-600 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`http://localhost:8000/vehicles/${vehicleId}`,
                { status: 'sold' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Swal.fire('Vendido', 'El vehículo ha sido marcado como vendido.', 'success');
            fetchVehicles(); // Refresh list
        } catch (error) {
            console.error("Error marking as sold", error);
            Swal.fire('Error', 'Error al actualizar el estado', 'error');
        }
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="bg-gray-50 min-h-full">
            <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800">Inventario de Vehículos</h1>
                    <p className="text-slate-500 mt-2">Gestiona el inventario de tu concesionario.</p>
                </div>
                <div className="mt-4 md:mt-0 flex gap-2">
                    <button
                        onClick={async () => {
                            const brands = ['Renault', 'Chevrolet', 'Mazda', 'Toyota', 'Kia', 'Ford'];
                            const models = ['Logan', 'Spark', 'Mazda 3', 'Hilux', 'Picanto', 'Fiesta'];
                            const rand = Math.floor(Math.random() * brands.length);
                            const demoVehicle = {
                                make: brands[rand],
                                model: models[rand],
                                year: 2018 + Math.floor(Math.random() * 7),
                                price: (20 + Math.floor(Math.random() * 80)) * 1000000,
                                plate: "DEM-" + Math.floor(100 + Math.random() * 900),
                                mileage: Math.floor(Math.random() * 50000),
                                color: "Gris",
                                status: "available",
                                description: "Vehículo de prueba generado automáticamente"
                            };
                            try {
                                const token = localStorage.getItem('token');
                                await axios.post('http://localhost:8000/vehicles/', demoVehicle, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                fetchVehicles();
                                Swal.fire('Simulación', 'Vehículo de prueba creado', 'success');
                            } catch (error) {
                                Swal.fire('Error', "Error simulando vehículo: " + error.message, 'error');
                            }
                        }}
                        className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg shadow hover:bg-purple-700 transition text-sm"
                    >
                        + Simular Vehículo
                    </button>
                    <Link to="/admin/inventory/new" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 transition">
                        + Nuevo Vehículo
                    </Link>
                </div>
            </header>

            {/* Status Tabs */}
            <div className="flex space-x-1 mb-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('available')}
                    className={`px-6 py-2 font-medium text-sm rounded-t-lg transition-colors ${activeTab === 'available'
                        ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    Disponibles
                </button>
                <button
                    onClick={() => setActiveTab('sold')}
                    className={`px-6 py-2 font-medium text-sm rounded-t-lg transition-colors ${activeTab === 'sold'
                        ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    Vendidos
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 rounded-tl-none">
                {/* Search Bar */}
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center">
                    <div className="relative w-full md:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por Marca, Modelo o Placa..."
                            value={search}
                            onChange={handleSearch}
                            className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black bg-white"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Foto</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehículo</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Año</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placa</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-gray-500">Cargando...</td>
                                </tr>
                            ) : vehicles.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-gray-500">No se encontraron vehículos.</td>
                                </tr>
                            ) : (
                                vehicles.map((vehicle) => (
                                    <tr key={vehicle.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="h-12 w-16 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                                                {vehicle.photos && vehicle.photos.length > 0 ? (
                                                    <img src={vehicle.photos[0]} alt={vehicle.model} className="h-full w-full object-cover" />
                                                ) : (
                                                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{vehicle.make} {vehicle.model}</div>
                                            <div className="text-xs text-gray-500">{vehicle.color}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {vehicle.year}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono font-bold text-gray-700 border border-gray-300">
                                                {vehicle.plate.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            {formatPrice(vehicle.price)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                        ${vehicle.status === 'available' ? 'bg-green-100 text-green-800' :
                                                    vehicle.status === 'sold' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'}`}>
                                                {vehicle.status === 'available' ? 'Disponible' :
                                                    vehicle.status === 'sold' ? 'Vendido' : 'Reservado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                            {isAdvisor ? (
                                                <Link to={`/admin/inventory/${vehicle.id}`} className="text-gray-600 hover:text-blue-600 hover:underline">
                                                    Ver Detalles
                                                </Link>
                                            ) : (
                                                <>
                                                    <Link to={`/admin/inventory/${vehicle.id}`} className="text-blue-600 hover:text-blue-900 hover:underline">Editar</Link>

                                                    {vehicle.status !== 'sold' && (
                                                        <button
                                                            onClick={() => handleMarkSold(vehicle.id)}
                                                            className="text-green-600 hover:text-green-900 hover:underline"
                                                            title="Marcar como Vendido"
                                                        >
                                                            Vendido
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Mostrando <span className="font-medium text-gray-800">{Math.min((page - 1) * limit + 1, total)}</span> a <span className="font-medium text-gray-800">{Math.min(page * limit, total)}</span> de <span className="font-medium text-gray-800">{total}</span> resultados
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                    Anterior
                                </button>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page >= totalPages}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                    Siguiente
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryList;
