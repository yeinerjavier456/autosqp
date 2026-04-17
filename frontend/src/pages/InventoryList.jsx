import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

const InventoryList = () => {
    const { user } = useAuth();
    const roleName = user?.role?.name || (typeof user?.role === 'string' ? user?.role : '');
    const isCompanyAdmin = roleName === 'admin' || (roleName === 'super_admin' && !!user?.company_id);
    const canEditInventory = isCompanyAdmin || roleName === 'inventario';

    const [vehicles, setVehicles] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(20); // Max 20 per page as requested
    const [activeTab, setActiveTab] = useState('available'); // 'available' or 'sold'
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [internalSellers, setInternalSellers] = useState([]);

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const skip = (page - 1) * limit;
            const effectiveStatus = canEditInventory ? activeTab : 'available';
            const params = { skip, limit, status: effectiveStatus }; // Filter by status
            if (search) params.q = search;

            const response = await axios.get('https://autosqp.co/api/vehicles/', {
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
        fetchVehicles();
    }, [page, search, activeTab]);

    useEffect(() => {
        const fetchInternalSellers = async () => {
            if (!canEditInventory) return;
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('https://autosqp.co/api/users/', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const items = Array.isArray(response.data?.items) ? response.data.items : [];
                setInternalSellers(
                    items.filter((item) => {
                        const roleBaseName = (item?.role?.base_role_name || item?.role?.name || '').toLowerCase();
                        return roleBaseName !== 'aliado';
                    })
                );
            } catch (error) {
                console.error('Error fetching internal sellers', error);
            }
        };

        fetchInternalSellers();
    }, [canEditInventory]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleTabChange = (tab) => {
        if (!canEditInventory) return;
        setActiveTab(tab);
        setPage(1);
    };

    const handleChangeStatus = async (vehicle) => {
        const { value: newStatus } = await Swal.fire({
            title: 'Cambiar Estado',
            text: `Selecciona el nuevo estado para: ${vehicle.make} ${vehicle.model} (${vehicle.year})`,
            input: 'select',
            inputOptions: {
                'available': 'Disponible',
                'alistamiento': 'Alistamiento',
                'desembolso': 'Desembolso',
                'reserved': 'Separado',
                'sold': 'Vendido'
            },
            inputValue: vehicle.status,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg',
                input: 'border border-gray-300 rounded-lg p-2 text-gray-700 w-4/5 flex justify-center mx-auto outline-none focus:ring-2 focus:ring-blue-500'
            },
            buttonsStyling: false
        });

        if (newStatus && newStatus !== vehicle.status) {
            try {
                const token = localStorage.getItem('token');
                let payload = { status: newStatus };
                if (newStatus === 'sold') {
                    const internalSellerOptions = internalSellers.reduce((acc, seller) => {
                        acc[seller.id] = seller.full_name || seller.email;
                        return acc;
                    }, {});
                    const { value: soldData } = await Swal.fire({
                        title: 'Registrar venta manual',
                        html: `
                            <div class="space-y-3 text-left">
                                <div>
                                    <label class="mb-1 block text-sm font-semibold text-gray-700">Valor de venta</label>
                                    <input id="sold-price" type="number" min="1" class="swal2-input" value="${vehicle.price || ''}" placeholder="Valor de venta" />
                                </div>
                                <div>
                                    <label class="mb-1 block text-sm font-semibold text-gray-700">Vendido por</label>
                                    <select id="sold-by-type" class="swal2-select">
                                        <option value="internal">Asesor interno</option>
                                        <option value="external">Asesor externo</option>
                                    </select>
                                </div>
                                <div id="internal-seller-wrapper">
                                    <label class="mb-1 block text-sm font-semibold text-gray-700">Asesor interno</label>
                                    <select id="internal-seller-id" class="swal2-select">
                                        <option value="">Selecciona un asesor</option>
                                        ${Object.entries(internalSellerOptions).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}
                                    </select>
                                </div>
                                <div id="external-seller-wrapper" style="display:none;">
                                    <label class="mb-1 block text-sm font-semibold text-gray-700">Asesor externo</label>
                                    <input id="external-seller-name" type="text" class="swal2-input" placeholder="Nombre del asesor externo" />
                                </div>
                            </div>
                        `,
                        showCancelButton: true,
                        confirmButtonText: 'Guardar',
                        cancelButtonText: 'Cancelar',
                        focusConfirm: false,
                        didOpen: () => {
                            const typeSelect = document.getElementById('sold-by-type');
                            const internalWrapper = document.getElementById('internal-seller-wrapper');
                            const externalWrapper = document.getElementById('external-seller-wrapper');
                            const toggleSellerInputs = () => {
                                const isExternal = typeSelect?.value === 'external';
                                if (internalWrapper) internalWrapper.style.display = isExternal ? 'none' : 'block';
                                if (externalWrapper) externalWrapper.style.display = isExternal ? 'block' : 'none';
                            };
                            typeSelect?.addEventListener('change', toggleSellerInputs);
                            toggleSellerInputs();
                        },
                        preConfirm: () => {
                            const soldPrice = Number(document.getElementById('sold-price')?.value || 0);
                            const soldByType = document.getElementById('sold-by-type')?.value || 'internal';
                            const soldByInternalUserId = document.getElementById('internal-seller-id')?.value || '';
                            const soldByExternalName = (document.getElementById('external-seller-name')?.value || '').trim();
                            if (!soldPrice || soldPrice <= 0) {
                                Swal.showValidationMessage('Debes indicar un valor de venta valido');
                                return false;
                            }
                            if (soldByType === 'internal' && !soldByInternalUserId) {
                                Swal.showValidationMessage('Debes seleccionar el asesor interno');
                                return false;
                            }
                            if (soldByType === 'external' && !soldByExternalName) {
                                Swal.showValidationMessage('Debes indicar el asesor externo');
                                return false;
                            }
                            return {
                                sold_price: soldPrice,
                                sold_by_type: soldByType,
                                sold_by_internal_user_id: soldByType === 'internal' ? Number(soldByInternalUserId) : null,
                                sold_by_external_name: soldByType === 'external' ? soldByExternalName : null
                            };
                        },
                        customClass: {
                            confirmButton: 'bg-blue-600 text-white px-4 py-2 rounded-lg ml-2',
                            cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
                        },
                        buttonsStyling: false
                    });
                    if (!soldData) return;
                    payload = { ...payload, ...soldData };
                }
                await axios.put(`https://autosqp.co/api/vehicles/${vehicle.id}`,
                    payload,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                Swal.fire({
                    title: 'Actualizado',
                    text: 'El estado del vehiculo ha sido cambiado.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchVehicles(); // Refresh list
            } catch (error) {
                console.error("Error cambiando estado", error);
                Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
            }
        }
    };

    const handleDeleteVehicle = async (vehicleId) => {
        const result = await Swal.fire({
            title: '¿Desactivar Vehículo?',
            text: "El vehículo se ocultará de todo el sistema.",
            icon: 'error',
            showCancelButton: true,
            confirmButtonText: 'Sí, desactivar',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'bg-red-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
            }
        });

        if (result.isConfirmed) {
            try {
                const token = localStorage.getItem('token');
                await axios.delete(`https://autosqp.co/api/vehicles/${vehicleId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Desactivado', 'El vehículo se ocultó correctamente.', 'success');
                fetchVehicles();
            } catch (error) {
                console.error("Error al desactivar vehículo", error);
                Swal.fire('Error', 'No se pudo desactivar el vehículo.', 'error');
            }
        }
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
    };

    const handleShareWhatsApp = async (vehicle) => {
        const { value: formValues } = await Swal.fire({
            title: 'Enviar vehículo por WhatsApp',
            html: `
                <div class="space-y-3 text-left">
                    <div>
                        <label class="mb-1 block text-sm font-semibold text-gray-700">Número destino</label>
                        <input id="whatsapp-destination-number" type="text" class="swal2-input" placeholder="Ej: 3212959493 o +573212959493" />
                        <p class="mt-1 text-xs text-slate-500">Se enviará usando el número de WhatsApp configurado para tu empresa.</p>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-semibold text-gray-700">Mensaje inicial opcional</label>
                        <textarea id="whatsapp-custom-message" class="swal2-textarea" placeholder="Ej: Hola, te comparto este vehículo disponible."></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Enviar',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const toNumber = (document.getElementById('whatsapp-destination-number')?.value || '').trim();
                const customMessage = (document.getElementById('whatsapp-custom-message')?.value || '').trim();

                if (!toNumber) {
                    Swal.showValidationMessage('Debes ingresar el número de destino');
                    return false;
                }

                return {
                    to_number: toNumber,
                    custom_message: customMessage || null,
                };
            },
            customClass: {
                confirmButton: 'bg-green-600 text-white px-4 py-2 rounded-lg ml-2',
                cancelButton: 'bg-gray-400 text-white px-4 py-2 rounded-lg'
            },
            buttonsStyling: false
        });

        if (!formValues) return;

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'https://autosqp.co/api/whatsapp/send-vehicle',
                {
                    vehicle_id: vehicle.id,
                    to_number: formValues.to_number,
                    custom_message: formValues.custom_message,
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            Swal.fire(
                'Enviado',
                `Se enviaron ${response.data.sent_messages} mensaje(s) al número ${response.data.to_number}.`,
                'success'
            );
        } catch (error) {
            console.error('Error enviando vehículo por WhatsApp', error);
            Swal.fire(
                'Error',
                error?.response?.data?.detail || 'No se pudo enviar la información del vehículo por WhatsApp.',
                'error'
            );
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="bg-gray-50 min-h-full">
            <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800">Inventario de Vehiculos</h1>
                    <p className="text-slate-500 mt-2">Gestiona el inventario de tu concesionario.</p>
                </div>
                {canEditInventory && <div className="mt-4 md:mt-0 flex gap-2">
                    {isCompanyAdmin && (
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
                                    await axios.post('https://autosqp.co/api/vehicles/', demoVehicle, {
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
                    )}
                    <Link to="/admin/inventory/new" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 transition">
                        + Nuevo Vehículo
                    </Link>
                </div>}
            </header>

            {/* Status Tabs */}
            <div className="flex space-x-1 mb-4 border-b border-gray-200">
                <button
                    onClick={() => handleTabChange('available')}
                    className={`px-6 py-2 font-medium text-sm rounded-t-lg transition-colors ${activeTab === 'available'
                        ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    Disponibles
                </button>
                {canEditInventory && (
                    <>
                        <button
                            onClick={() => handleTabChange('sold')}
                            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${activeTab === 'sold'
                                ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            Vendidos
                        </button>
                        <button
                            onClick={() => handleTabChange('alistamiento')}
                            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${activeTab === 'alistamiento'
                                ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            Alistamiento
                        </button>
                        <button
                            onClick={() => handleTabChange('desembolso')}
                            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${activeTab === 'desembolso'
                                ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            Desembolso
                        </button>
                    </>
                )}
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
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehiculo</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ano</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placa</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio (COP) *</th>
                                {activeTab === 'sold' && (
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendido Por</th>
                                )}
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={activeTab === 'sold' ? 8 : 7} className="px-6 py-10 text-center text-gray-500">Cargando...</td>
                                </tr>
                            ) : vehicles.length === 0 ? (
                                <tr>
                                    <td colSpan={activeTab === 'sold' ? 8 : 7} className="px-6 py-10 text-center text-gray-500">No se encontraron vehiculos.</td>
                                </tr>
                            ) : (
                                vehicles.map((vehicle) => (
                                    <tr key={vehicle.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="h-12 w-16 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                                                {vehicle.photos && vehicle.photos.length > 0 ? (
                                                    <img src={normalizeMediaUrl(vehicle.photos[0])} alt={vehicle.model} className="h-full w-full object-cover" />
                                                ) : (
                                                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-normal min-w-[200px]">
                                            <div className="text-sm font-medium text-gray-900 leading-tight">{vehicle.make} {vehicle.model}</div>
                                            <div className="text-xs text-gray-500 mt-1">{vehicle.color}</div>
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
                                        {activeTab === 'sold' && (
                                            <td className="px-6 py-4 whitespace-normal min-w-[220px]">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {vehicle.sold_by_name || 'Sin registro'}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {vehicle.sold_by_type === 'external' ? 'Asesor externo' : 'Asesor interno'}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                        ${vehicle.status === 'available' ? 'bg-green-100 text-green-800' :
                                                    vehicle.status === 'sold' ? 'bg-red-100 text-red-800' :
                                                        vehicle.status === 'alistamiento' ? 'bg-purple-100 text-purple-800' :
                                                            vehicle.status === 'desembolso' ? 'bg-indigo-100 text-indigo-800' :
                                                                'bg-yellow-100 text-yellow-800'}`}>
                                                {vehicle.status === 'available' ? 'Disponible' :
                                                    vehicle.status === 'sold' ? 'Vendido' :
                                                        vehicle.status === 'alistamiento' ? 'Alistamiento' :
                                                            vehicle.status === 'desembolso' ? 'Desembolso' :
                                                                'Separado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                            {!canEditInventory ? (
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button
                                                        onClick={() => handleShareWhatsApp(vehicle)}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 focus:ring-2 focus:ring-green-500 rounded-lg transition-colors"
                                                        title="Compartir por WhatsApp"
                                                    >
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                                                    </button>
                                                    <Link to={`/admin/inventory/${vehicle.id}`} className="text-gray-600 hover:text-blue-600 hover:underline">
                                                        Ver Detalles
                                                    </Link>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button
                                                        onClick={() => handleShareWhatsApp(vehicle)}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 focus:ring-2 focus:ring-green-500 rounded-lg transition-colors"
                                                        title="Compartir por WhatsApp"
                                                    >
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                                                    </button>
                                                    <Link
                                                        to={`/admin/inventory/${vehicle.id}`}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </Link>

                                                    {vehicle.status !== 'sold' && (
                                                        <button
                                                            onClick={() => handleChangeStatus(vehicle)}
                                                            className="p-1.5 text-orange-500 hover:bg-orange-50 focus:ring-2 focus:ring-orange-500 rounded-lg transition-colors"
                                                            title="Cambiar Estado"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                        </button>
                                                    )}

                                                    {canEditInventory && (
                                                        <button
                                                            onClick={() => handleDeleteVehicle(vehicle.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-500 rounded-lg transition-colors"
                                                            title="Desactivar Vehículo"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    )}
                                                </div>
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
                            <nav className="relative z-0 inline-flex items-center shadow-sm rounded-md" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                    Anterior
                                </button>

                                <span className="relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700">
                                    Pagina {page} de {totalPages || 1}
                                </span>

                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page >= totalPages}
                                    className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
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



