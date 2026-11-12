import { webText } from "../content";
import React, { useState } from 'react';
import { useInquiry } from '../useInquiry';
import { X, Car, ShieldCheck, Send, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../inventory';
interface SellCarModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export const SellCarModal: React.FC<SellCarModalProps> = ({
  isOpen,
  onClose
}) => {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [mileage, setMileage] = useState('');
  const [plate, setPlate] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const {
    brands: AVAILABLE_BRANDS
  } = useInventory();
  const {
    submitted,
    sending,
    error,
    submit
  } = useInquiry();
  if (!isOpen) return null;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = `Hola Autos QP, deseo vender mi auto / solicitar retoma:\nMarca: ${make}\nModelo: ${model}\nAño: ${year}\nKm: ${mileage || 'No especificado'}\nPlaca: ${plate}\nPropietario: ${name}\nTeléfono: ${phone}`;
    await submit({
      name,
      phone,
      subject: 'Vender mi vehículo',
      message,
      vehicle_make: make,
      vehicle_model: model,
      vehicle_year: Number(year) || null,
      vehicle_plate: plate,
      vehicle_mileage: mileage ? Number(mileage) : null
    });
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#11161d] border border-[#232c37] rounded-3xl p-6 sm:p-8 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-[#0a0d10] text-slate-400 hover:text-white transition-colors cursor-pointer" aria-label={webText("SellCarModal.0c4bfc3411d1", "Cerrar modal")}>
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">
            <Car className="w-3.5 h-3.5" />
            <span>{webText("SellCarModal.875c633faabd", "Valoraci\xF3n Gratuita")}</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{webText("SellCarModal.05fc3c831b43", "Vende tu auto a Autos QP")}</h2>
          <p className="text-xs sm:text-sm text-slate-300">{webText("SellCarModal.3376167760e3", "Te ofrecemos la mejor valoraci\xF3n y una venta segura. Sin intermediarios ni complicaciones.")}</p>
        </div>

        {submitted ? <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[#00C896] mx-auto" />
            <h3 className="text-lg font-bold text-white">{webText("SellCarModal.fda56c47b6c0", "\xA1Solicitud de tasaci\xF3n enviada!")}</h3>
            <p className="text-xs text-slate-300">{webText("SellCarModal.46c07b5b65d6", "Nos pondremos en contacto contigo de inmediato para revisar las fotos y agendar peritaje en el C.C. Outlet Factory.")}</p>
            <button onClick={onClose} className="mt-4 px-6 py-2.5 rounded-lg bg-[#00C896] text-slate-950 font-bold text-xs">{webText("SellCarModal.401a96ab7d7e", "Cerrar")}</button>
          </div> : <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{webText("SellCarModal.9310d0744202", "Marca *")}</label>
                <input list="sell-car-brands" required value={make} onChange={e => setMake(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-2.5 py-2.5 focus:border-[#00C896] focus:outline-none" />
                <datalist id="sell-car-brands">
                  {AVAILABLE_BRANDS.map(b => <option key={b} value={b}>
                      {b}
                    </option>)}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{webText("SellCarModal.963e7e319d1a", "Modelo / L\xEDnea *")}</label>
                <input type="text" required placeholder={webText("SellCarModal.f225a67c0f94", "Ej. Duster, Stepway, Tracker...")} value={model} onChange={e => setModel(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{webText("SellCarModal.0fbdecdf0d16", "A\xF1o *")}</label>
                <input type="number" min="2005" max={new Date().getFullYear() + 1} required value={year} onChange={e => setYear(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-2.5 py-2.5 focus:border-[#00C896] focus:outline-none" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{webText("SellCarModal.907d21a842a6", "Kilometraje")}</label>
                <input type="text" placeholder={webText("SellCarModal.935df433a83b", "Ej. 45.000")} value={mileage} onChange={e => setMileage(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-2.5 py-2.5 focus:border-[#00C896] focus:outline-none" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{webText("SellCarModal.06cc0b33ca97", "Placa (ciudad)")}</label>
                <input type="text" placeholder={webText("SellCarModal.f1a8a1b71b44", "Ej. Bogot\xE1")} value={plate} onChange={e => setPlate(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-2.5 py-2.5 focus:border-[#00C896] focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{webText("SellCarModal.93e71bcba1ff", "Tu nombre *")}</label>
                <input type="text" required placeholder={webText("SellCarModal.e7227ee2cd55", "Nombre y apellido")} value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{webText("SellCarModal.b2ec30e056a7", "WhatsApp / Celular *")}</label>
                <input type="tel" required placeholder={webText("SellCarModal.0dad2c8fc0de", "300 123 4567")} value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#090d10] border border-slate-800 flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-[#00C896] shrink-0" />
              <span>{webText("SellCarModal.c4cc7825bdfb", "Te ofrecemos compra de contado, retoma como parte de pago o venta en consignaci\xF3n.")}</span>
            </div>

            <button type="submit" disabled={sending} className="w-full py-3.5 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer flex items-center justify-center gap-2 text-sm">
              <Send className="w-4 h-4" />
              <span>{sending ? webText("SellCarModal.d731279d0300", "Registrando solicitud\u2026") : webText("SellCarModal.547c0a078ede", "Enviar datos para cotizaci\xF3n")}</span>
            </button>
          </form>}
      </div>
    </div>;
};
