
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const AdminCompanySettings = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [company, setCompany] = useState({
        name: 'Nueva Empresa',
        logo_url: 'https://via.placeholder.com/150',
        primary_color: '#3B82F6', // Blue-500
        secondary_color: '#1E40AF', // Blue-800
    });
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        if (id) {
            setIsEditing(true);
            const fetchCompany = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await axios.get(`http://localhost:8000/companies/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setCompany(response.data);
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

    const handleSave = async () => {
        setStatus({ type: 'loading', message: 'Guardando...' });
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Note: We need to implement PUT endpoint for full update. 
            // For now, if editing, we might need a specific update endpoint or handling.
            // Assuming we'll add PUT /companies/{id} soon. Re-using POST for now will fail due to unique name constraint if name unchanged.

            if (isEditing) {
                // Pending: Implement PUT in backend. For now, we simulate success or warn user.
                // let's assume we implement PUT below.
                await axios.put(`http://localhost:8000/companies/${id}`, company, { headers });
                setStatus({ type: 'success', message: `Empresa "${company.name}" actualizada exitosamente!` });
            } else {
                const response = await axios.post('http://localhost:8000/companies/', company, { headers });
                setStatus({ type: 'success', message: `Empresa "${response.data.name}" creada exitosamente!` });
                // navigate(`/admin/companies/${response.data.id}`); // Optional: redirect to edit mode
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

