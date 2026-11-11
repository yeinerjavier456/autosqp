import React, { useState } from 'react';
import { useInventory } from '../inventory';
import { COMPANY_INFO } from '../data/company';
import { Car, Users, Award, ShieldCheck, Search, ArrowRight } from 'lucide-react';

interface HeroProps {
  onSearch: (make: string, model: string, maxPrice: number | '') => void;
  onExploreInventory: () => void;
  onSellMyCar: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onSearch, onExploreInventory, onSellMyCar }) => {
  const { brands: AVAILABLE_BRANDS, vehicles, loading } = useInventory();
  const [selectedMake, setSelectedMake] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(selectedMake, modelQuery, maxPrice);
  };

  return (
    <section className="relative overflow-hidden bg-[#0c0f13] border-b border-[#1b222b]">
      {/* Background with cinematic lighting & road atmosphere */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-radial-[at_75%_35%] from-[#00C896]/15 via-transparent to-transparent opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f13] via-[#0c0f13]/80 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-12 sm:pb-16">
        {/* Hero Top Grid: Copy on left, Hero Vehicle on right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Slogan, Headline & CTAs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Slogan Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161c24] border border-[#26313d] text-xs font-semibold text-[#00C896]">
              <span className="w-2 h-2 rounded-full bg-[#00C896] animate-pulse" />
              <span>{COMPANY_INFO.slogan}</span>
            </div>

            {/* Main Headline (matches reference image exactly) */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white uppercase leading-[1.08] text-balance">
              MÁS QUE AUTOS, <br />
              <span className="text-[#00C896]">CREAMOS CONEXIONES</span>
            </h1>

            {/* Subtitle from PDF */}
            <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              Encuentra el auto que se adapta a tu vida. Calidad, confianza y el mejor servicio en Bogotá. Todos nuestros vehículos son 100% asegurables y revisados.
            </p>

            {/* Action Buttons from reference image */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onExploreInventory}
                className="px-6 py-3.5 text-sm sm:text-base font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] rounded-md transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer flex items-center gap-2"
              >
                <span>Ver inventario</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onSellMyCar}
                className="px-6 py-3.5 text-sm sm:text-base font-bold text-white bg-transparent hover:bg-white/5 border border-white/60 hover:border-white rounded-md transition-all cursor-pointer"
              >
                Vender mi auto
              </button>
            </div>

            {/* Buscador Rápido en el Hero (as recommended in PDF page 2) */}
            <div className="pt-4">
              <form
                onSubmit={handleSubmit}
                className="p-3 sm:p-4 rounded-xl bg-[#13181f]/95 border border-[#263240] shadow-2xl backdrop-blur-md grid grid-cols-1 sm:grid-cols-4 gap-3 items-center"
              >
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Marca
                  </label>
                  <select
                    value={selectedMake}
                    onChange={(e) => setSelectedMake(e.target.value)}
                    className="w-full bg-[#0a0d10] border border-[#2b3744] text-slate-200 text-xs sm:text-sm rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none"
                  >
                    <option value="">Todas las marcas</option>
                    {AVAILABLE_BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Referencia / Modelo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Duster, Fiesta, Fortuner..."
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                    className="w-full bg-[#0a0d10] border border-[#2b3744] text-slate-200 text-xs sm:text-sm rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Precio máximo
                  </label>
                  <select
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-[#0a0d10] border border-[#2b3744] text-slate-200 text-xs sm:text-sm rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none"
                  >
                    <option value="">Sin límite</option>
                    <option value="60000000">Hasta $ 60.000.000</option>
                    <option value="90000000">Hasta $ 90.000.000</option>
                    <option value="130000000">Hasta $ 130.000.000</option>
                    <option value="220000000">Hasta $ 220.000.000</option>
                  </select>
                </div>

                <div className="sm:self-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#00C896] hover:bg-[#00B486] text-slate-950 font-bold text-xs sm:text-sm rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Search className="w-4 h-4" />
                    <span>Buscar</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Hero Visual Asset (high performance image representation matching screenshot aesthetic) */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-2xl overflow-hidden border border-[#26313d] bg-gradient-to-tr from-[#13181f] via-[#1a222c] to-[#0c0f13] shadow-2xl group">
              <img
                src="https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80"
                alt="Autos QP Vehículo Usado Destacado"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f13] via-transparent to-black/30" />

              {/* Overlay Badge */}
              <div className="absolute bottom-4 left-4 right-4 p-3 rounded-lg bg-[#0e1217]/90 backdrop-blur-md border border-[#2b3744] flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#00C896] font-bold uppercase tracking-wider">
                    Concesionario Físico
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {COMPANY_INFO.address}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-medium text-slate-400 block">Bogotá, Colombia</span>
                  <span className="text-xs font-bold text-[#00C896]">Local 128</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Statistics strip (from reference image and PDF page 2) */}
        <div className="mt-12 sm:mt-16 pt-8 border-t border-[#1f2732] grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-[#11161d]/80 border border-[#202936]">
            <div className="p-2.5 rounded-lg bg-[#00C896]/10 text-[#00C896]">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight tabular-nums">
                {loading ? '…' : vehicles.length.toLocaleString('es-CO')}
              </p>
              <p className="text-xs sm:text-sm text-slate-400">Autos disponibles</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-[#11161d]/80 border border-[#202936]">
            <div className="p-2.5 rounded-lg bg-[#00C896]/10 text-[#00C896]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight tabular-nums">
                +850
              </p>
              <p className="text-xs sm:text-sm text-slate-400">Clientes satisfechos</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-[#11161d]/80 border border-[#202936]">
            <div className="p-2.5 rounded-lg bg-[#00C896]/10 text-[#00C896]">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight tabular-nums">
                +5 Años
              </p>
              <p className="text-xs sm:text-sm text-slate-400">De experiencia</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-[#11161d]/80 border border-[#202936]">
            <div className="p-2.5 rounded-lg bg-[#00C896]/10 text-[#00C896]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight tabular-nums">
                100%
              </p>
              <p className="text-xs sm:text-sm text-slate-400">Transparencia</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
