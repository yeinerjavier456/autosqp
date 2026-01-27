import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import Webcam from 'react-webcam';

const VehicleForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        price: '',
        plate: '',
        mileage: '',
        color: '',
        description: '',
        status: 'available',
        photos: []
    });

    // Data Lists
    const [brands, setBrands] = useState([]);
    const [modelsList, setModelsList] = useState([]);

    // Camera & Upload State
    const webcamRef = useRef(null);
    const [showCamera, setShowCamera] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            fetchVehicle();
        }
        fetchBrands();
    }, [id]);

    const fetchBrands = async () => {
        try {
            const response = await axios.get('http://localhost:8000/brands/');
            setBrands(response.data);
        } catch (error) {
            console.error("Error fetching brands", error);
        }
    };

    // When Make changes (and it matches a brand), fetch models
    useEffect(() => {
        if (formData.make && brands.length > 0) {
            const selectedBrand = brands.find(b => b.name === formData.make);
            if (selectedBrand) {
                fetchModels(selectedBrand.id);
            }
        }
    }, [formData.make, brands]);

    const fetchModels = async (brandId) => {
        try {
            const response = await axios.get(`http://localhost:8000/brands/${brandId}/models/`);
            setModelsList(response.data);
        } catch (error) {
            console.error("Error fetching models", error);
        }
    };

    const fetchVehicle = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:8000/vehicles/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = response.data;
            setFormData({
                make: data.make,
                model: data.model,
                year: data.year,
                price: data.price,
                plate: data.plate,
                mileage: data.mileage || '',
                color: data.color || '',
                description: data.description || '',
                status: data.status,
                photos: data.photos || []
            });
        } catch (error) {
            console.error("Error fetching vehicle", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Reset model if make changes
        if (name === 'make') {
            setFormData(prev => ({ ...prev, make: value, model: '' }));
            setModelsList([]);
        }
    };

    const handleSeedBrands = async () => {
        try {
            setLoading(true);
            const response = await axios.post('http://localhost:8000/seed/brands');
            alert(response.data.message);
            fetchBrands();
        } catch (error) {
            console.error("Error seeding", error);
            alert("Error al cargar marcas");
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        await uploadFiles(files);
    };

    const capturePhoto = async () => {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
            // Convert base64 to blob to upload
            const res = await fetch(imageSrc);
            const blob = await res.blob();
            const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            await uploadFiles([file]);
            setShowCamera(false);
        }
    };

    const uploadFiles = async (files) => {
        const token = localStorage.getItem('token');
        const uploadedUrls = [];

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await axios.post('http://localhost:8000/upload/', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${token}`
                    }
                });
                uploadedUrls.push(response.data.url);
            } catch (error) {
                console.error("Error uploading file", error);
                alert("Error al subir imagen");
            }
        }

        setFormData(prev => ({
            ...prev,
            photos: [...prev.photos, ...uploadedUrls]
        }));
    };

    const removePhoto = (index) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const token = localStorage.getItem('token');
        const payload = {
            ...formData,
            year: parseInt(formData.year),
            price: parseInt(formData.price),
            mileage: formData.mileage ? parseInt(formData.mileage) : 0
        };

        try {
            if (isEditMode) {
                await axios.put(`http://localhost:8000/vehicles/${id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert("Vehículo actualizado correctamente");
            } else {
                await axios.post('http://localhost:8000/vehicles/', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert("Vehículo creado correctamente");
            }
            navigate('/admin/inventory');
        } catch (error) {
            console.error("Error saving vehicle", error);
            alert("Error al guardar vehículo");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Cargando...</div>;

    return (
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in border border-gray-100">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">{isEditMode ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
                    <p className="opacity-80 text-sm mt-1">Completa la información del vehículo.</p>
                </div>
                {brands.length === 0 && (
                    <button onClick={handleSeedBrands} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded">
                        Recargar Marcas
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-8">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Marca *</label>
                        <select
                            name="make"
                            required
                            value={brands.find(b => b.name === formData.make) ? formData.make : (formData.make ? 'OTRA' : '')}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'OTRA') {
                                    setFormData(prev => ({ ...prev, make: '', model: '' }));
                                    setModelsList([]);
                                } else {
                                    setFormData(prev => ({ ...prev, make: val, model: '' }));
                                }
                            }}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white mb-2"
                        >
                            <option value="">Selecciona Marca</option>
                            {brands.map(brand => (
                                <option key={brand.id} value={brand.name}>{brand.name}</option>
                            ))}
                            <option value="OTRA">OTRA (Escribir manual)</option>
                        </select>
                        {(!brands.find(b => b.name === formData.make) && (formData.make || formData.make === '')) && (
                            <input
                                type="text"
                                name="make"
                                value={formData.make}
                                onChange={handleChange}
                                placeholder="Escribe la marca..."
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white border-blue-300"
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Modelo *</label>
                        {brands.find(b => b.name === formData.make) ? (
                            <>
                                <select
                                    name="model"
                                    required
                                    value={modelsList.find(m => m.name === formData.model) ? formData.model : (formData.model ? 'OTRO' : '')}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'OTRO') {
                                            setFormData(prev => ({ ...prev, model: '' }));
                                        } else {
                                            setFormData(prev => ({ ...prev, model: val }));
                                        }
                                    }}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white mb-2"
                                >
                                    <option value="">Selecciona Modelo</option>
                                    {modelsList.map(model => (
                                        <option key={model.id} value={model.name}>{model.name}</option>
                                    ))}
                                    <option value="OTRO">OTRO (Escribir manual)</option>
                                </select>
                                {((!modelsList.find(m => m.name === formData.model) && formData.model !== undefined) || !formData.model) &&
                                    (!modelsList.find(m => m.name === formData.model)) && (
                                        <input
                                            type="text"
                                            name="model"
                                            value={formData.model}
                                            onChange={handleChange}
                                            placeholder="Escribe el modelo..."
                                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white border-blue-300 ${!modelsList.find(m => m.name === formData.model) && formData.model ? '' : 'hidden'}`}
                                            style={{ display: !modelsList.find(m => m.name === formData.model) ? 'block' : 'none' }}
                                        />
                                    )}
                            </>
                        ) : (
                            <input
                                type="text"
                                name="model"
                                required
                                value={formData.model}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Escribe el modelo..."
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Placa *</label>
                        <input type="text" name="plate" required value={formData.plate} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="ABC-123" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Año *</label>
                        <input type="number" name="year" required value={formData.year} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Precio (COP) *</label>
                        <input type="number" name="price" required value={formData.price} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: 50000000" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Kilometraje</label>
                        <input type="number" name="mileage" value={formData.mileage} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                        <input type="text" name="color" value={formData.color} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                            <option value="available">Disponible</option>
                            <option value="reserved">Reservado</option>
                            <option value="sold">Vendido</option>
                        </select>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                    <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                </div>

                {/* Photos Section */}
                <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Fotos del Vehículo</h3>

                    {/* Actions */}
                    <div className="flex gap-4 mb-4">
                        <button
                            type="button"
                            onClick={() => setShowCamera(!showCamera)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {showCamera ? 'Cerrar Cámara' : 'Tomar Foto'}
                        </button>

                        <label className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Subir Fotos
                            <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                        </label>
                    </div>

                    {/* Camera View */}
                    {showCamera && (
                        <div className="mb-4 bg-black rounded-lg overflow-hidden flex flex-col items-center p-4">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="rounded-lg mb-4 max-h-96 w-full object-contain"
                            />
                            <button
                                type="button"
                                onClick={capturePhoto}
                                className="bg-white text-black font-bold py-2 px-6 rounded-full hover:bg-gray-200 transition"
                            >
                                Capturar!
                            </button>
                        </div>
                    )}

                    {/* Image Preview Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {formData.photos.map((url, index) => (
                            <div key={index} className="relative group">
                                <img src={url} alt={`Foto ${index}`} className="w-full h-32 object-cover rounded-lg shadow-sm" />
                                <button
                                    type="button"
                                    onClick={() => removePhoto(index)}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                        {formData.photos.length === 0 && (
                            <div className="col-span-full text-center py-8 text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                                No hay fotos aún. Sube o toma algunas fotos del vehículo.
                            </div>
                        )}
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/inventory')}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-md disabled:opacity-50"
                    >
                        {submitting ? 'Guardando...' : (isEditMode ? 'Actualizar Vehículo' : 'Crear Vehículo')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default VehicleForm;
