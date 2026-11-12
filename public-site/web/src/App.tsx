import { webText } from "./content";
import { useWebsiteContent } from './content';
import React, { useEffect, useState } from 'react';
import { PageTab, Vehicle, FilterState } from './types';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { SolucionQP } from './components/SolucionQP';
import { FeaturedVehicles } from './components/FeaturedVehicles';
import { Testimonials } from './components/Testimonials';
import { SellCarCta } from './components/SellCarCta';
import { InventoryView } from './components/InventoryView';
import { FinanciamientoView } from './components/FinanciamientoView';
import { ReactivacionFinancieraView } from './components/ReactivacionFinancieraView';
import { NosotrosView } from './components/NosotrosView';
import { ContactoView } from './components/ContactoView';
import { FaqView } from './components/FaqView';
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { SellCarModal } from './components/SellCarModal';
import { LegalModal } from './components/LegalModal';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import { Footer } from './components/Footer';
import { InventoryProvider, useInventory } from './inventory';
import PublicSalesChatbot from '../../../frontend/src/components/PublicSalesChatbot';
import { creditFormUrl } from './credit';
const tabs: PageTab[] = ['inicio', 'inventario', 'financiamiento', 'reactivacion-financiera', 'nosotros', 'contacto', 'faq'];
function Website() {
  const websiteContent = useWebsiteContent();
  const initialTab = window.location.hash.slice(1) as PageTab;
  const [currentTab, setCurrentTab] = useState<PageTab>(tabs.includes(initialTab) ? initialTab : 'inicio');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'data' | null>(null);
  const [inventoryFilters, setInventoryFilters] = useState<Partial<FilterState>>({});
  const [chat, setChat] = useState<{
    key: number;
    vehicleId: number | null;
  } | null>(null);
  const {
    vehicles,
    loading,
    error
  } = useInventory();
  const navigate = (tab: PageTab) => {
    setCurrentTab(tab);
    window.location.hash = tab;
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  useEffect(() => {
    if (window.location.hash === '#vender') setIsSellModalOpen(true);
    const onHash = () => {
      if (window.location.hash === '#vender') setIsSellModalOpen(true);
      const tab = window.location.hash.slice(1) as PageTab;
      if (tabs.includes(tab)) setCurrentTab(tab);
    };
    const onChat = (event: Event) => {
      const id = (event as CustomEvent).detail?.vehicleId;
      setChat({
        key: Date.now(),
        vehicleId: id ? Number(id) : null
      });
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('autosqp:open-chat', onChat);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('autosqp:open-chat', onChat);
    };
  }, []);
  const inventory = () => {
    setInventoryFilters({});
    navigate('inventario');
  };
  if (!websiteContent.loaded) return <div role="status" className="min-h-screen bg-[#0c0f13] p-12 text-center text-slate-200">{websiteContent.error || 'Cargando página…'}</div>;
  return <div className="min-h-screen bg-[#0c0f13] text-slate-100 flex flex-col font-sans">
    <Navbar currentTab={currentTab} onSelectTab={tab => {
      if (tab === 'inventario') setInventoryFilters({});
      navigate(tab);
    }} onOpenSellModal={() => setIsSellModalOpen(true)} onOpenAdmin={() => window.location.assign('/crm/login')} />
    <main className="flex-1">
      {currentTab === 'inicio' && <>
        <Hero onSearch={(make, model, maxPrice) => {
          setInventoryFilters({
            make,
            model,
            maxPrice
          });
          navigate('inventario');
        }} onExploreInventory={inventory} onSellMyCar={() => setIsSellModalOpen(true)} />
        <SolucionQP onNavigate={navigate} onOpenSellModal={() => setIsSellModalOpen(true)} />
        {loading ? <p role="status" className="text-center p-8 text-slate-300">{webText("App.80b2350a11a9", "Cargando veh\xEDculos disponibles\u2026")}</p> : error ? <p role="alert" className="text-center p-8 text-amber-300">{error}</p> : <FeaturedVehicles vehicles={vehicles} onSelectVehicle={setSelectedVehicle} onViewAll={inventory} />}
        <Testimonials /><SellCarCta onOpenSellModal={() => setIsSellModalOpen(true)} />
      </>}
      {currentTab === 'inventario' && (loading ? <p role="status" className="text-center p-16">{webText("App.93bf234f7f64", "Cargando inventario\u2026")}</p> : error ? <p role="alert" className="text-center p-16 text-amber-300">{error}</p> : <InventoryView key={JSON.stringify(inventoryFilters)} vehicles={vehicles} initialFilters={inventoryFilters} onSelectVehicle={setSelectedVehicle} />)}
      {currentTab === 'financiamiento' && <FinanciamientoView />}
      {currentTab === 'reactivacion-financiera' && <ReactivacionFinancieraView />}
      {currentTab === 'nosotros' && <NosotrosView />}
      {currentTab === 'contacto' && <ContactoView />}
      {currentTab === 'faq' && <FaqView />}
    </main>
    <Footer onSelectTab={navigate} onOpenLegal={setLegalModalType} onOpenSellModal={() => setIsSellModalOpen(true)} onOpenAdmin={() => window.location.assign('/crm/login')} />
    {!chat && <WhatsAppFloatingButton />}
    {chat && <div className="text-slate-900"><PublicSalesChatbot key={chat.key} autoOpen vehicleId={chat.vehicleId} sourcePage={`website:${currentTab}`} sessionStorageKey="autosqp_website_chat" brandName="Autos QP" /></div>}
    {selectedVehicle && <VehicleDetailModal key={selectedVehicle.id} vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} onSimulateCredit={() => window.location.assign(creditFormUrl())} />}
    <SellCarModal isOpen={isSellModalOpen} onClose={() => setIsSellModalOpen(false)} />
    <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />
  </div>;
}
export default function App() {
  return <InventoryProvider><Website /></InventoryProvider>;
}
