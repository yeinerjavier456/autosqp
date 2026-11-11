import React, { useState } from 'react';
import { Vehicle } from '../types';
import { COMPANY_INFO } from '../data/company';
import { openChat } from '../chat';
import { X, ShieldCheck, Check, MessageSquare, Calculator, Calendar, Gauge, Fuel, Cog, Palette, MapPin } from 'lucide-react';

interface VehicleDetailModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSimulateCredit: (price: number) => void;
}

export const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({
  vehicle,
  onClose,
  onSimulateCredit
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  if (!vehicle) return null;

  const handleWhatsAppInquiry = () => {
    const text = `Hola Autos QP, estoy interesado en el ${vehicle.make} ${vehicle.model} ${vehicle.version} (${vehicle.year}) publicado por $ ${vehicle.price?.toLocaleString('es-CO')} COP. ¿Sigue disponible?`;
    openChat(vehicle.id); onClose();
  };

  const handleSimulate = () => {
    onSimulateCredit(vehicle.price);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#11161d] border border-[#232c37] rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-[#0a0d10]/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
          {/* Left Column: Image Gallery */}
          <div className="md:col-span-6 bg-[#0a0d10] p-4 sm:p-6 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Main Image */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
                <img
                  src={vehicle.images[selectedImageIndex] || vehicle.images[0]}
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#0b0e12]/85 px-2.5 py-1 rounded-md border border-slate-700">
                  <span className="text-[10px] font-bold text-white">Autos</span>
                  <span className="text-[10px] font-bold text-[#00C896]">QP</span>
                </div>
                {vehicle.isNewArrival && (
                  <div className="absolute top-3 right-3 bg-[#00C896] text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                    Nuevo ingreso
                  </div>
                )}
              </div>

              {/* Thumbnails if multiple images exist */}
              {vehicle.images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {vehicle.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 cursor-pointer shrink-0 transition-all ${
                        selectedImageIndex === idx ? 'border-[#00C896]' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="Miniatura" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick 100% asegurabilidad notice */}
            <div className="mt-4 p-3 rounded-xl bg-[#00C896]/10 border border-[#00C896]/30 flex items-center gap-2.5 text-xs text-slate-200">
              <ShieldCheck className="w-5 h-5 text-[#00C896] shrink-0" />
              <span>Vehículo verificado en historial, libre de embargos y <strong>100% asegurable</strong>.</span>
            </div>
          </div>

          {/* Right Column: Technical Sheet & Actions */}
          <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="space-y-4">
              {/* Make & Model Title */}
              <div>
                <span className="text-xs font-black tracking-wider text-[#00C896] uppercase">
                  {vehicle.make}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase">
                  {vehicle.model}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  {vehicle.version}
                </p>
              </div>

              {/* Price */}
              <div className="py-2 border-y border-slate-800 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block uppercase">Precio de contado:</span>
                  <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                    $ {vehicle.price?.toLocaleString('es-CO')} COP
                  </p>
                </div>
                <span className="text-xs text-[#00C896] font-semibold">Listo para traspaso</span>
              </div>

              {/* Ficha Técnica Grid */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ficha técnica y especificaciones
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#0b0e12] border border-[#1f2834] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span><strong>Año:</strong> {vehicle.year}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0e12] border border-[#1f2834] flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-slate-400" />
                    <span><strong>Km:</strong> {vehicle.mileage?.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0e12] border border-[#1f2834] flex items-center gap-2">
                    <Cog className="w-4 h-4 text-slate-400" />
                    <span><strong>Caja:</strong> {vehicle.transmission}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0e12] border border-[#1f2834] flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-slate-400" />
                    <span><strong>Combustible:</strong> {vehicle.fuel}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0e12] border border-[#1f2834] flex items-center gap-2">
                    <Palette className="w-4 h-4 text-slate-400" />
                    <span><strong>Color:</strong> {vehicle.specs.color}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0e12] border border-[#1f2834] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span><strong>Placa:</strong> Termina en {vehicle.specs.plateEnding}</span>
                  </div>
                </div>
              </div>

              {/* Engine & Docs */}
              <div className="text-xs text-slate-300 space-y-1 p-3 rounded-xl bg-[#0d1217] border border-slate-800">
                <p><strong>Motor:</strong> {vehicle.specs.engine}</p>
                <p><strong>SOAT vigente:</strong> {vehicle.specs.soatValidUntil}</p>
                <p><strong>Tecnomecánica:</strong> {vehicle.specs.technoValidUntil}</p>
                <p className="pt-1 text-slate-400">{vehicle.description}</p>
              </div>

              {/* Optional Warranty Legal Notice for vehicles < 10 years */}
              {vehicle.hasOptionalWarranty && (
                <div className="p-3.5 rounded-xl bg-[#141b22] border border-[#00C896]/30 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#00C896] font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Garantía Opcional de Caja y Motor Disponible</span>
                  </div>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    {COMPANY_INFO.warrantyLegalFull}
                  </p>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleWhatsAppInquiry}
                className="w-full py-3 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Preguntar al asesor virtual</span>
              </button>

              <button
                onClick={handleSimulate}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-slate-300 hover:text-white bg-[#19222c] hover:bg-[#222e3b] transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs"
              >
                <Calculator className="w-4 h-4 text-[#00C896]" />
                <span>Simular crédito para este valor ($ {vehicle.price?.toLocaleString('es-CO')})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
