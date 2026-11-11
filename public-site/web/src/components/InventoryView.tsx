import React, { useState, useMemo } from 'react';
import { Vehicle, FilterState, BodyType } from '../types';
import { useInventory } from '../inventory';
import { COMPANY_INFO } from '../data/company';
import { Filter, RotateCcw, ShieldCheck, ChevronRight, Info, Search } from 'lucide-react';

interface InventoryViewProps {
  vehicles: Vehicle[];
  initialFilters?: Partial<FilterState>;
  onSelectVehicle: (vehicle: Vehicle) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  vehicles,
  initialFilters,
  onSelectVehicle
}) => {
  const { brands: AVAILABLE_BRANDS } = useInventory();
  const [filters, setFilters] = useState<FilterState>({
    search: initialFilters?.search || '',
    make: initialFilters?.make || '',
    model: initialFilters?.model || '',
    minYear: initialFilters?.minYear || '',
    maxYear: initialFilters?.maxYear || '',
    minPrice: initialFilters?.minPrice || '',
    maxPrice: initialFilters?.maxPrice || '',
    transmission: initialFilters?.transmission || '',
    fuel: initialFilters?.fuel || '',
    bodyType: initialFilters?.bodyType || ''
  });

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const handleClearFilters = () => {
    setFilters({
      search: '',
      make: '',
      model: '',
      minYear: '',
      maxYear: '',
      minPrice: '',
      maxPrice: '',
      transmission: '',
      fuel: '',
      bodyType: ''
    });
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((car) => {
      // Free search
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesQuery =
          car.make.toLowerCase().includes(query) ||
          car.model.toLowerCase().includes(query) ||
          car.version.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // Make
      if (filters.make && car.make.toUpperCase() !== filters.make.toUpperCase()) {
        return false;
      }

      // Model
      if (filters.model && !car.model.toLowerCase().includes(filters.model.toLowerCase())) {
        return false;
      }

      // Year range
      if (filters.minYear && car.year < Number(filters.minYear)) return false;
      if (filters.maxYear && car.year > Number(filters.maxYear)) return false;

      // Price range
      if (filters.minPrice && car.price < Number(filters.minPrice)) return false;
      if (filters.maxPrice && car.price > Number(filters.maxPrice)) return false;

      // Transmission
      if (filters.transmission && car.transmission !== filters.transmission) return false;

      // Fuel
      if (filters.fuel && car.fuel !== filters.fuel) return false;

      // Body Type
      if (filters.bodyType && car.bodyType !== filters.bodyType) return false;

      return true;
    });
  }, [vehicles, filters]);

  const bodyCategories: BodyType[] = [
    'Sedán',
    'Camioneta / SUV',
    'Pickup',
    'Hatchback'
  ];

  return (
    <div className="py-10 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Intro from PDF Page 4 */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">
            Catálogo Verificado
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Nuestro <span className="text-[#00C896]">Inventario</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            En Autos QP encontrarás una amplia selección de vehículos usados verificados, de todas las marcas y referencias. Actualizamos nuestro inventario constantemente para ofrecerte siempre las mejores opciones al mejor precio. Todos nuestros vehículos son 100% asegurables.
          </p>
        </div>

        {/* Filters Bar visible on top as specified in PDF */}
        <div className="bg-[#12171e] border border-[#222c38] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#202936]">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Filter className="w-4 h-4 text-[#00C896]" />
              <span>Filtros de búsqueda</span>
            </div>
            <button
              onClick={handleClearFilters}
              className="text-xs text-slate-400 hover:text-[#00C896] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Make */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Marca
              </label>
              <select
                value={filters.make}
                onChange={(e) => setFilters({ ...filters, make: e.target.value })}
                className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none"
              >
                <option value="">Todas</option>
                {AVAILABLE_BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference / Model */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Referencia / Modelo
              </label>
              <input
                type="text"
                placeholder="Ej. Duster, Fiesta..."
                value={filters.model}
                onChange={(e) => setFilters({ ...filters, model: e.target.value })}
                className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none placeholder:text-slate-600"
              />
            </div>

            {/* Year Range */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Año (Desde)
              </label>
              <select
                value={filters.minYear}
                onChange={(e) =>
                  setFilters({ ...filters, minYear: e.target.value === '' ? '' : Number(e.target.value) })
                }
                className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none"
              >
                <option value="">Cualquier año</option>
                <option value="2016">2016 en adelante</option>
                <option value="2018">2018 en adelante</option>
                <option value="2020">2020 en adelante</option>
                <option value="2022">2022 en adelante</option>
              </select>
            </div>

            {/* Price Max */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Precio máximo
              </label>
              <select
                value={filters.maxPrice}
                onChange={(e) =>
                  setFilters({ ...filters, maxPrice: e.target.value === '' ? '' : Number(e.target.value) })
                }
                className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none"
              >
                <option value="">Sin tope</option>
                <option value="60000000">Hasta $ 60.000.000</option>
                <option value="90000000">Hasta $ 90.000.000</option>
                <option value="120000000">Hasta $ 120.000.000</option>
                <option value="180000000">Hasta $ 180.000.000</option>
              </select>
            </div>

            {/* Transmission */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Transmisión
              </label>
              <select
                value={filters.transmission}
                onChange={(e) => setFilters({ ...filters, transmission: e.target.value })}
                className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none"
              >
                <option value="">Todas</option>
                <option value="Mecánico">Manual (Mecánico)</option>
                <option value="Automático">Automática</option>
              </select>
            </div>

            {/* Fuel */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Combustible
              </label>
              <select
                value={filters.fuel}
                onChange={(e) => setFilters({ ...filters, fuel: e.target.value })}
                className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="Gasolina">Gasolina</option>
                <option value="Híbrido">Híbrido</option>
                <option value="Diésel">Diésel</option>
                <option value="Eléctrico">Eléctrico</option>
              </select>
            </div>
          </div>


        </div>

        {/* Counter of results */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <p>
            Mostrando <span className="text-white font-bold">{filteredVehicles.length}</span> vehículos disponibles
          </p>
          <span className="text-emerald-400 font-medium">✓ 100% asegurables y con peritaje</span>
        </div>

        {/* Vehicles Grid */}
        {filteredVehicles.length === 0 ? (
          <div className="text-center py-16 bg-[#11161d] rounded-2xl border border-slate-800 p-8 space-y-4">
            <Search className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-white">No encontramos vehículos con estos filtros</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Intenta cambiar los parámetros de búsqueda o restablecer los filtros para ver todo nuestro catálogo disponible.
            </p>
            <button
              onClick={handleClearFilters}
              className="px-5 py-2.5 rounded-lg bg-[#00C896] text-slate-950 font-bold text-xs"
            >
              Restablecer filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVehicles.map((car) => {
              const isTooltipOpen = activeTooltip === car.id;
              return (
                <div
                  key={car.id}
                  className="relative rounded-2xl bg-[#11151a] border border-[#232c37] hover:border-[#00C896]/60 transition-all duration-300 flex flex-col justify-between overflow-hidden group shadow-lg"
                >
                  {/* AutosQP watermark in corner */}
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-[#0b0e12]/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-[#232a33]">
                    <span className="text-[11px] font-bold text-white tracking-wider">Autos</span>
                    <span className="text-[11px] font-bold text-[#00C896]">QP</span>
                  </div>

                  {/* Badge: 'Nuevo ingreso' if applies */}
                  {car.isNewArrival && (
                    <div className="absolute top-3 right-3 z-20 bg-[#00C896] text-slate-950 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow">
                      Nuevo ingreso
                    </div>
                  )}

                  {/* Main Car Photo */}
                  <div className="relative w-full aspect-[4/3] bg-gradient-to-b from-[#18202a] via-[#10141a] to-[#0c0f13] overflow-hidden flex items-center justify-center">
                    <img
                      src={car.images[0]}
                      alt={`${car.make} ${car.model}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#11151a] via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      {/* Make & Reference in bold */}
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
                          {car.make}
                        </p>
                        <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight group-hover:text-[#00C896] transition-colors leading-snug">
                          {car.model} {car.version}
                        </h3>
                      </div>

                      {/* Year · Transmission · Fuel · Mileage */}
                      <div className="mt-2 text-xs text-slate-400 flex flex-wrap items-center gap-1.5">
                        <span>{car.year}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span>{car.transmission}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span>{car.fuel}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="tabular-nums">{car.mileage?.toLocaleString('es-CO')} km</span>
                      </div>

                      {/* Price in COP */}
                      <div className="mt-4">
                        <p className="text-xl font-extrabold text-white tracking-tight tabular-nums">
                          $ {car.price?.toLocaleString('es-CO')}
                        </p>
                      </div>

                      {/* Optional Warranty Stamp (only for models < 10 years) */}
                      {car.hasOptionalWarranty && (
                        <div className="mt-3 relative">
                          <button
                            type="button"
                            onClick={() => setActiveTooltip(isTooltipOpen ? null : car.id)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00C896] hover:text-[#00B486] transition-colors cursor-pointer text-left"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>Garantía opcional disponible</span>
                            <Info className="w-3 h-3 text-slate-400 hover:text-white" />
                          </button>

                          {/* Tooltip on hover/touch */}
                          {isTooltipOpen && (
                            <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-[#19222c] border border-[#2e3b4a] rounded-lg shadow-2xl z-30 text-[11px] text-slate-200 leading-normal animate-in fade-in duration-150">
                              <p className="font-semibold text-white mb-1">Garantía Opcional:</p>
                              <p className="text-slate-300">{COMPANY_INFO.warrantyNotice}</p>
                              <button
                                type="button"
                                onClick={() => setActiveTooltip(null)}
                                className="mt-2 text-[10px] text-[#00C896] font-bold underline cursor-pointer"
                              >
                                Entendido
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botón: Ver detalles */}
                    <div className="pt-2">
                      <button
                        onClick={() => onSelectVehicle(car)}
                        className="w-full py-2.5 px-4 rounded-md text-xs sm:text-sm font-semibold text-slate-200 bg-[#171f28] hover:bg-[#202a36] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Ver detalles</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Categorías en footer del inventario (Page 4 from PDF) */}
        <div className="pt-8 border-t border-[#1f2835] space-y-4">
          {/* Legal Notice about Optional Warranty as required by PDF */}
          <div className="p-4 rounded-xl bg-[#0f141a] border border-[#1f2835] text-[11px] text-slate-400 leading-relaxed space-y-1">
            <span className="font-bold text-slate-300 block">Aviso Legal Garantía Opcional:</span>
            <p>{COMPANY_INFO.warrantyLegalFull}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
