import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const VehicleDetail = () => {
    const { id } = useParams();
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState('');
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);

    useEffect(() => {
        const fetchVehicle = async () => {
            try {
                const res = await axios.get(`http://3.234.117.124:8000/vehicles/public/${id}`);
                setVehicle(res.data);
                if (res.data.photos && res.data.photos.length > 0) {
                    setSelectedImage(res.data.photos[0]);
                }
            } catch (error) {
                console.error("Error fetching vehicle details", error);
            } finally {
                setLoading(false);
            }
        };

        fetchVehicle();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!vehicle) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-600">
                <h2 className="text-2xl font-bold mb-4">Vehículo no encontrado</h2>
                <Link to="/autos" className="text-blue-600 hover:underline">Volver al inventario</Link>
            </div>
        );
    }

    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
    };

    const nextImage = (e) => {
        if (e) e.stopPropagation();
        if (vehicle.photos && vehicle.photos.length > 0) {
            const currentIndex = vehicle.photos.indexOf(selectedImage);
            if (currentIndex !== -1) {
                const nextIndex = (currentIndex + 1) % vehicle.photos.length;
                setSelectedImage(vehicle.photos[nextIndex]);
            }
        }
    };

    const prevImage = (e) => {
        if (e) e.stopPropagation();
        if (vehicle.photos && vehicle.photos.length > 0) {
            const currentIndex = vehicle.photos.indexOf(selectedImage);
            if (currentIndex !== -1) {
                const prevIndex = (currentIndex - 1 + vehicle.photos.length) % vehicle.photos.length;
                setSelectedImage(vehicle.photos[prevIndex]);
            }
        }
    };

    const toggleZoom = (e) => {
        e.stopPropagation();
        setIsZoomed(!isZoomed);
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans pb-12">
            {/* Navbar */}
            <header className="bg-slate-900 shadow-lg sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/autos" className="text-2xl font-extrabold text-white tracking-tight">
                        <span className="text-blue-500">Autos</span>QP
                    </Link>
                    <nav className="flex items-center gap-4 text-sm font-bold">
                        <Link
                            to="/login"
                            className="text-white hover:text-blue-400 transition bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20"
                        >
                            Ingresa
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                {/* Breadcrumb */}
                <nav className="text-xs text-gray-500 mb-6 flex items-center gap-2">
                    <Link to="/autos" className="hover:text-blue-600 hover:underline">Volver al listado</Link>
                    <span>/</span>
                    <span className="text-gray-800 font-semibold">{vehicle.make} {vehicle.model}</span>
                </nav>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex flex-col lg:flex-row">
                        {/* Left Column: Gallery */}
                        <div className="lg:w-2/3 p-4 bg-gray-50">
                            {/* Main Image */}
                            <div
                                className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-gray-200 mb-4 cursor-zoom-in relative group"
                                onClick={() => setIsLightboxOpen(true)}
                            >
                                {selectedImage ? (
                                    <>
                                        <img
                                            src={selectedImage}
                                            alt={`${vehicle.make} ${vehicle.model}`}
                                            className="w-full h-full object-contain"
                                        />

                                        {/* Expand Button (Mobile/Desktop) */}
                                        <button
                                            className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
                                            onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(true); }}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L2 2m0 0l5-2 5 2M2 2l2 5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </button>

                                        {/* Navigation Arrows (Desktop overlay) */}
                                        {vehicle.photos?.length > 1 && (
                                            <>
                                                <button
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white p-2 rounded-full transition opacity-0 group-hover:opacity-100"
                                                    onClick={prevImage}
                                                >
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                                </button>
                                                <button
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white p-2 rounded-full transition opacity-0 group-hover:opacity-100"
                                                    onClick={nextImage}
                                                >
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <span className="text-sm">Sin imagen</span>
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
                                    <span className="bg-black/60 text-white px-3 py-1 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                        Clic para ampliar
                                    </span>
                                </div>
                            </div>

                            {/* Thumbnails */}
                            {vehicle.photos?.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                    {vehicle.photos?.map((photo, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setSelectedImage(photo)}
                                            className={`
                                                flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all
                                                ${selectedImage === photo ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'}
                                            `}
                                        >
                                            <img src={photo} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right Column: Details */}
                        <div className="lg:w-1/3 p-6 lg:border-l border-gray-100 flex flex-col">
                            <div className="mb-6">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                                    {vehicle.year} · {vehicle.mileage?.toLocaleString()} Km
                                </span>
                                <h1 className="text-3xl font-bold text-gray-900 mb-2 leading-tight">
                                    {vehicle.make} {vehicle.model}
                                </h1>
                                <p className="text-4xl font-light text-slate-900 mb-4">
                                    {formatPrice(vehicle.price)}
                                </p>
                            </div>

                            <div className="space-y-4 text-sm text-gray-600 flex-1">
                                <h3 className="font-bold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-2">Especificaciones</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-xs text-gray-400">Marca</span>
                                        <span className="font-medium text-gray-800">{vehicle.make}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-400">Modelo</span>
                                        <span className="font-medium text-gray-800">{vehicle.model}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-400">Año</span>
                                        <span className="font-medium text-gray-800">{vehicle.year}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-400">Kilometraje</span>
                                        <span className="font-medium text-gray-800">{vehicle.mileage?.toLocaleString()} km</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-400">Color</span>
                                        <span className="font-medium text-gray-800">{vehicle.color || 'No especificado'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-400">Placa</span>
                                        <span className="font-medium text-gray-800">***{vehicle.plate?.slice(-3) || '***'}</span>
                                    </div>
                                </div>

                                {vehicle.description && (
                                    <div className="mt-6 pt-4 border-t border-gray-100">
                                        <h3 className="font-bold text-gray-800 uppercase tracking-wide mb-2">Descripción</h3>
                                        <p className="whitespace-pre-line leading-relaxed">{vehicle.description}</p>
                                    </div>
                                )}
                            </div>

                            <a
                                href={`https://wa.me/573000000000?text=Hola, estoy interesado en el ${vehicle.make} ${vehicle.model} de ${formatPrice(vehicle.price)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-green-500/30 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 mt-6"
                            >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                                Contactar por WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            {/* Lightbox Modal */}
            {isLightboxOpen && (
                <div
                    className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => { setIsLightboxOpen(false); setIsZoomed(false); }}
                >
                    <button
                        className="absolute top-4 right-4 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 transition z-50"
                        onClick={() => { setIsLightboxOpen(false); setIsZoomed(false); }}
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {/* Left Arrow */}
                    {vehicle.photos?.length > 1 && (
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-4 rounded-full hover:bg-white/10 transition z-50"
                            onClick={prevImage}
                        >
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}

                    <div
                        className="relative overflow-hidden flex items-center justify-center pointer-events-auto w-full h-full"
                        onMouseMove={(e) => {
                            if (!isZoomed) return;
                            const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - left) / width) * 100;
                            const y = ((e.clientY - top) / height) * 100;
                            e.currentTarget.querySelector('img').style.transformOrigin = `${x}% ${y}%`;
                        }}
                        style={{ maxHeight: '90vh', maxWidth: '100%' }}
                    >
                        <img
                            src={selectedImage}
                            alt="Full view"
                            className={`max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl transition-transform duration-200 ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                            onClick={toggleZoom}
                            style={{ transform: isZoomed ? 'scale(2.5)' : 'scale(1)' }}
                        />
                    </div>

                    {/* Right Arrow */}
                    {vehicle.photos?.length > 1 && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-4 rounded-full hover:bg-white/10 transition z-50"
                            onClick={nextImage}
                        >
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    )}

                    {/* Thumbnails in Lightbox */}
                    {vehicle.photos?.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90vw] p-2 bg-black/50 rounded-xl z-50" onClick={(e) => e.stopPropagation()}>
                            {vehicle.photos?.map((photo, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedImage(photo)}
                                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition ${selectedImage === photo ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
                                >
                                    <img src={photo} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VehicleDetail;
