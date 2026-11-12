import { webText } from "../content";
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
  const {
    brands: AVAILABLE_BRANDS
  } = useInventory();
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
    return vehicles.filter(car => {
      // Free search
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesQuery = car.make.toLowerCase().includes(query) || car.model.toLowerCase().includes(query) || car.version.toLowerCase().includes(query);
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
  const bodyCategories: BodyType[] = ['Sedán', 'Camioneta / SUV', 'Pickup', 'Hatchback'];
  return <div className="py-10 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Intro from PDF Page 4 */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">{webText("InventoryView.3969d5454f36", "Cat\xE1logo Verificado")}</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">{webText("InventoryView.23a5b0dbd75d", "Nuestro ")}<span className="text-[#00C896]">{webText("InventoryView.c2fc94c262a6", "Inventario")}</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{webText("InventoryView.7d4015484a17", "En Autos QP encontrar\xE1s una amplia selecci\xF3n de veh\xEDculos usados verificados, de todas las marcas y referencias. Actualizamos nuestro inventario constantemente para ofrecerte siempre las mejores opciones al mejor precio. Todos nuestros veh\xEDculos son 100% asegurables.")}</p>
        </div>

        {/* Filters Bar visible on top as specified in PDF */}
        <div className="bg-[#12171e] border border-[#222c38] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#202936]">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Filter className="w-4 h-4 text-[#00C896]" />
              <span>{webText("InventoryView.5866e0ebb92b", "Filtros de b\xFAsqueda")}</span>
            </div>
            <button onClick={handleClearFilters} className="text-xs text-slate-400 hover:text-[#00C896] flex items-center gap-1 transition-colors cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{webText("InventoryView.0ba6c47d6d3b", "Limpiar filtros")}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Make */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{webText("InventoryView.f7f06237065e", "Marca")}</label>
              <select value={filters.make} onChange={e => setFilters({
              ...filters,
              make: e.target.value
            })} className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none">
                <option value="">{webText("InventoryView.ff1f2d19999e", "Todas")}</option>
                {AVAILABLE_BRANDS.map(b => <option key={b} value={b}>
                    {b}
                  </option>)}
              </select>
            </div>

            {/* Reference / Model */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{webText("InventoryView.93b99ecbcbf7", "Referencia / Modelo")}</label>
              <input type="text" placeholder={webText("InventoryView.4e9da58ce768", "Ej. Duster, Fiesta...")} value={filters.model} onChange={e => setFilters({
              ...filters,
              model: e.target.value
            })} className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none placeholder:text-slate-600" />
            </div>

            {/* Year Range */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{webText("InventoryView.d27558f6dfa5", "A\xF1o (Desde)")}</label>
              <select value={filters.minYear} onChange={e => setFilters({
              ...filters,
              minYear: e.target.value === '' ? '' : Number(e.target.value)
            })} className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none">
                <option value="">{webText("InventoryView.a51d8abd2879", "Cualquier a\xF1o")}</option>
                <option value="2016">{webText("InventoryView.0c67a704bf29", "2016 en adelante")}</option>
                <option value="2018">{webText("InventoryView.f598e4a213f2", "2018 en adelante")}</option>
                <option value="2020">{webText("InventoryView.8ecd20b3a675", "2020 en adelante")}</option>
                <option value="2022">{webText("InventoryView.590f2a0b44e3", "2022 en adelante")}</option>
              </select>
            </div>

            {/* Price Max */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{webText("InventoryView.e1de386b9ed2", "Precio m\xE1ximo")}</label>
              <select value={filters.maxPrice} onChange={e => setFilters({
              ...filters,
              maxPrice: e.target.value === '' ? '' : Number(e.target.value)
            })} className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none">
                <option value="">{webText("InventoryView.6a3408c484c6", "Sin tope")}</option>
                <option value="60000000">{webText("InventoryView.2b7065a5db5a", "Hasta $ 60.000.000")}</option>
                <option value="90000000">{webText("InventoryView.0402a9de7bb0", "Hasta $ 90.000.000")}</option>
                <option value="120000000">{webText("InventoryView.0a99709017dd", "Hasta $ 120.000.000")}</option>
                <option value="180000000">{webText("InventoryView.ab862aeee763", "Hasta $ 180.000.000")}</option>
              </select>
            </div>

            {/* Transmission */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{webText("InventoryView.6de7c092382c", "Transmisi\xF3n")}</label>
              <select value={filters.transmission} onChange={e => setFilters({
              ...filters,
              transmission: e.target.value
            })} className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none">
                <option value="">{webText("InventoryView.ff1f2d19999e.2", "Todas")}</option>
                <option value="Mecánico">{webText("InventoryView.c97c6ffc4eb8", "Manual (Mec\xE1nico)")}</option>
                <option value="Automático">{webText("InventoryView.988e4b4f0557", "Autom\xE1tica")}</option>
              </select>
            </div>

            {/* Fuel */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{webText("InventoryView.13d946467452", "Combustible")}</label>
              <select value={filters.fuel} onChange={e => setFilters({
              ...filters,
              fuel: e.target.value
            })} className="w-full bg-[#090c10] border border-[#273341] text-xs text-slate-200 rounded-md px-2.5 py-2 focus:border-[#00C896] focus:outline-none">
                <option value="">{webText("InventoryView.d732bfcff4ea", "Todos")}</option>
                <option value="Gasolina">{webText("InventoryView.857942037065", "Gasolina")}</option>
                <option value="Híbrido">{webText("InventoryView.7c409156d77d", "H\xEDbrido")}</option>
                <option value="Diésel">{webText("InventoryView.5238633361df", "Di\xE9sel")}</option>
                <option value="Eléctrico">{webText("InventoryView.554f5629d0c5", "El\xE9ctrico")}</option>
              </select>
            </div>
          </div>


        </div>

        {/* Counter of results */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <p>{webText("InventoryView.ece05bf3cb9f", "Mostrando ")}<span className="text-white font-bold">{filteredVehicles.length}</span>{webText("InventoryView.b43c87c9c839", " veh\xEDculos disponibles")}</p>
          <span className="text-emerald-400 font-medium">{webText("InventoryView.6d0a845b986f", "\u2713 100% asegurables y con peritaje")}</span>
        </div>

        {/* Vehicles Grid */}
        {filteredVehicles.length === 0 ? <div className="text-center py-16 bg-[#11161d] rounded-2xl border border-slate-800 p-8 space-y-4">
            <Search className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-white">{webText("InventoryView.2e31718149f7", "No encontramos veh\xEDculos con estos filtros")}</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">{webText("InventoryView.d2c9bd3d2d60", "Intenta cambiar los par\xE1metros de b\xFAsqueda o restablecer los filtros para ver todo nuestro cat\xE1logo disponible.")}</p>
            <button onClick={handleClearFilters} className="px-5 py-2.5 rounded-lg bg-[#00C896] text-slate-950 font-bold text-xs">{webText("InventoryView.d106df52950c", "Restablecer filtros")}</button>
          </div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVehicles.map(car => {
          const isTooltipOpen = activeTooltip === car.id;
          return <div key={car.id} className="relative rounded-2xl bg-[#11151a] border border-[#232c37] hover:border-[#00C896]/60 transition-all duration-300 flex flex-col justify-between overflow-hidden group shadow-lg">
                  {/* AutosQP watermark in corner */}
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-[#0b0e12]/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-[#232a33]">
                    <span className="text-[11px] font-bold text-white tracking-wider">{webText("InventoryView.48df5b18cbf7", "Autos")}</span>
                    <span className="text-[11px] font-bold text-[#00C896]">{webText("InventoryView.0e97614e3af8", "QP")}</span>
                  </div>

                  {/* Badge: 'Nuevo ingreso' if applies */}
                  {car.isNewArrival && <div className="absolute top-3 right-3 z-20 bg-[#00C896] text-slate-950 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow">{webText("InventoryView.e56b811685ae", "Nuevo ingreso")}</div>}

                  {/* Main Car Photo */}
                  <div className="relative w-full aspect-[4/3] bg-gradient-to-b from-[#18202a] via-[#10141a] to-[#0c0f13] overflow-hidden flex items-center justify-center">
                    <img src={car.images[0]} alt={`${car.make} ${car.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" loading="lazy" referrerPolicy="no-referrer" />
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
                        <span aria-hidden="true" className="text-slate-600">{"\xB7"}</span>
                        <span>{car.transmission}</span>
                        <span aria-hidden="true" className="text-slate-600">{"\xB7"}</span>
                        <span>{car.fuel}</span>
                        <span aria-hidden="true" className="text-slate-600">{"\xB7"}</span>
                        <span className="tabular-nums">{car.mileage?.toLocaleString('es-CO')}{webText("InventoryView.165e17cf4eeb", " km")}</span>
                      </div>

                      {/* Price in COP */}
                      <div className="mt-4">
                        <p className="text-xl font-extrabold text-white tracking-tight tabular-nums">{"$ "}{car.price?.toLocaleString('es-CO')}
                        </p>
                      </div>

                      {/* Optional Warranty Stamp (only for models < 10 years) */}
                      {car.hasOptionalWarranty && <div className="mt-3 relative">
                          <button type="button" onClick={() => setActiveTooltip(isTooltipOpen ? null : car.id)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00C896] hover:text-[#00B486] transition-colors cursor-pointer text-left">
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>{webText("InventoryView.4009625c945a", "Garant\xEDa opcional disponible")}</span>
                            <Info className="w-3 h-3 text-slate-400 hover:text-white" />
                          </button>

                          {/* Tooltip on hover/touch */}
                          {isTooltipOpen && <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-[#19222c] border border-[#2e3b4a] rounded-lg shadow-2xl z-30 text-[11px] text-slate-200 leading-normal animate-in fade-in duration-150">
                              <p className="font-semibold text-white mb-1">{webText("InventoryView.a5703a715608", "Garant\xEDa Opcional:")}</p>
                              <p className="text-slate-300">{COMPANY_INFO.warrantyNotice}</p>
                              <button type="button" onClick={() => setActiveTooltip(null)} className="mt-2 text-[10px] text-[#00C896] font-bold underline cursor-pointer">{webText("InventoryView.91e884ee963b", "Entendido")}</button>
                            </div>}
                        </div>}
                    </div>

                    {/* Botón: Ver detalles */}
                    <div className="pt-2">
                      <button onClick={() => onSelectVehicle(car)} className="w-full py-2.5 px-4 rounded-md text-xs sm:text-sm font-semibold text-slate-200 bg-[#171f28] hover:bg-[#202a36] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                        <span>{webText("InventoryView.6744cd6b43e4", "Ver detalles")}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>;
        })}
          </div>}

        {/* Categorías en footer del inventario (Page 4 from PDF) */}
        <div className="pt-8 border-t border-[#1f2835] space-y-4">
          {/* Legal Notice about Optional Warranty as required by PDF */}
          <div className="p-4 rounded-xl bg-[#0f141a] border border-[#1f2835] text-[11px] text-slate-400 leading-relaxed space-y-1">
            <span className="font-bold text-slate-300 block">{webText("InventoryView.11f31591205a", "Aviso Legal Garant\xEDa Opcional:")}</span>
            <p>{COMPANY_INFO.warrantyLegalFull}</p>
          </div>
        </div>
      </div>
    </div>;
};
