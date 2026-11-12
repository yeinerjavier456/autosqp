import { webText } from "../content";
import React, { useState } from 'react';
import { Vehicle } from '../types';
import { formatCOP } from '../utils/formatters';
import { ShieldCheck, Info, ChevronRight } from 'lucide-react';
import { COMPANY_INFO } from '../data/company';
interface FeaturedVehiclesProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onViewAll: () => void;
}
export const FeaturedVehicles: React.FC<FeaturedVehiclesProps> = ({
  vehicles,
  onSelectVehicle,
  onViewAll
}) => {
  const [activeWarrantyTooltip, setActiveWarrantyTooltip] = useState<string | null>(null);

  // Filter 4 featured vehicles from inventory (or take top 4)
  const featured = [...vehicles.filter(v => v.isFeatured), ...vehicles.filter(v => !v.isFeatured)].slice(0, 4);
  return <section className="py-16 sm:py-24 bg-[#0d1014] border-b border-[#1b222b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title matching reference screenshot: DESTACADOS DE AUTOS QP */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white uppercase">{webText("FeaturedVehicles.f4b25d7bc4e9", "DESTACADOS DE ")}<span className="text-[#00C896]">{webText("FeaturedVehicles.a6c6ff664289", "AUTOS QP")}</span>
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-400">{webText("FeaturedVehicles.654fd29f918c", "Veh\xEDculos verificados, con peritaje al d\xEDa y listos para entrega inmediata en Bogot\xE1.")}</p>
        </div>

        {/* 4 Cards Grid - replicates screenshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map(car => {
          const isTooltipOpen = activeWarrantyTooltip === car.id;
          return <div key={car.id} className="relative rounded-2xl bg-[#11151a] border border-[#232c37] hover:border-[#00C896]/50 transition-all duration-300 flex flex-col justify-between overflow-hidden group shadow-lg">
                {/* AutosQP badge top-left corner */}
                <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-1 bg-[#0b0e12]/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-[#232a33]">
                  <span className="text-[11px] font-bold text-white tracking-wider">{webText("FeaturedVehicles.48df5b18cbf7", "Autos")}</span>
                  <span className="text-[11px] font-bold text-[#00C896]">{webText("FeaturedVehicles.0e97614e3af8", "QP")}</span>
                </div>

                {/* 'Nuevo ingreso' badge if applicable */}
                {car.isNewArrival && <div className="absolute top-3.5 right-3.5 z-20 bg-[#00C896] text-slate-950 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow">{webText("FeaturedVehicles.e56b811685ae", "Nuevo ingreso")}</div>}

                {/* Car Image Container with studio gradient and reflection */}
                <div className="relative w-full aspect-[4/3] bg-gradient-to-b from-[#18202a] via-[#10141a] to-[#0c0f13] overflow-hidden flex items-center justify-center p-2">
                  <img src={car.images[0]} alt={`${car.make} ${car.model}`} className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-500 ease-out" loading="lazy" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#11151a] via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Card Info Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Make & Reference in bold */}
                    <div className="space-y-0.5">
                      <p className="text-xs font-black tracking-wider text-slate-400 uppercase">
                        {car.make}
                      </p>
                      <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight group-hover:text-[#00C896] transition-colors leading-snug">
                        {car.model} {car.version}
                      </h3>
                    </div>

                    {/* Metadata: Year · Transmission · Fuel */}
                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
                      <span>{car.year}</span>
                      <span aria-hidden="true" className="text-slate-600">{"\xB7"}</span>
                      <span>{car.transmission}</span>
                      <span aria-hidden="true" className="text-slate-600">{"\xB7"}</span>
                      <span>{car.fuel}</span>
                    </div>

                    {/* Price in COP format */}
                    <div className="mt-4">
                      <p className="text-lg sm:text-xl font-extrabold text-white tracking-tight tabular-nums">{"$ "}{car.price?.toLocaleString('es-CO')}
                      </p>
                    </div>

                    {/* Optional Warranty Stamp (models < 10 years old) */}
                    {car.hasOptionalWarranty && <div className="mt-3 relative">
                        <button type="button" onClick={() => setActiveWarrantyTooltip(isTooltipOpen ? null : car.id)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00C896] hover:text-[#00B486] transition-colors cursor-pointer text-left">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                          <span>{webText("FeaturedVehicles.4009625c945a", "Garant\xEDa opcional disponible")}</span>
                          <Info className="w-3 h-3 text-slate-400 hover:text-white" />
                        </button>

                        {/* Interactive Tooltip Popover */}
                        {isTooltipOpen && <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-[#19222c] border border-[#2e3b4a] rounded-lg shadow-2xl z-30 text-[11px] text-slate-200 leading-normal animate-in fade-in duration-150">
                            <p className="font-semibold text-white mb-1">{webText("FeaturedVehicles.a5703a715608", "Garant\xEDa Opcional:")}</p>
                            <p className="text-slate-300">
                              {COMPANY_INFO.warrantyNotice}
                            </p>
                            <button type="button" onClick={() => setActiveWarrantyTooltip(null)} className="mt-2 text-[10px] text-[#00C896] font-bold underline cursor-pointer">{webText("FeaturedVehicles.d4231114127d", "Cerrar aviso")}</button>
                          </div>}
                      </div>}
                  </div>

                  {/* Ver Detalles Button */}
                  <div className="pt-2">
                    <button onClick={() => onSelectVehicle(car)} className="w-full py-2.5 px-4 rounded-md text-xs sm:text-sm font-semibold text-slate-200 bg-[#171f28] hover:bg-[#202a36] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                      <span>{webText("FeaturedVehicles.6744cd6b43e4", "Ver detalles")}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>;
        })}
        </div>

        {/* Button at end of section: "Ver todos los vehículos" (matching reference screenshot) */}
        <div className="mt-12 text-center">
          <button onClick={onViewAll} className="px-8 py-3.5 text-sm sm:text-base font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] rounded-md transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer inline-flex items-center gap-2">
            <span>{webText("FeaturedVehicles.b8366f8ce84f", "Ver todos los veh\xEDculos")}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>;
};
