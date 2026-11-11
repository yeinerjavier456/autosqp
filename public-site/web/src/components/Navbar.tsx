import React, { useState } from 'react';
import { PageTab } from '../types';
import { COMPANY_INFO } from '../data/company';
import { Phone, Menu, X, ShieldCheck, LogIn } from 'lucide-react';

interface NavbarProps {
  currentTab: PageTab;
  onSelectTab: (tab: PageTab) => void;
  onOpenSellModal: () => void;
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenSellModal,
  onOpenAdmin
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: PageTab; label: string; isHighlighted?: boolean }[] = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'inventario', label: 'Inventario' },
    { id: 'financiamiento', label: 'Financiamiento' },
    { id: 'reactivacion-financiera', label: 'Reactivación Financiera', isHighlighted: true },
    { id: 'nosotros', label: 'Nosotros' },
    { id: 'contacto', label: 'Contacto' },
    { id: 'faq', label: 'FAQ' },
  ];

  const handleTabClick = (tab: PageTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0d1014]/95 backdrop-blur-md border-b border-[#1f2630]">
      {/* Top microbar for contact */}
      <div className="hidden lg:flex items-center justify-between px-6 py-1.5 text-xs text-slate-400 border-b border-slate-800/60 bg-[#090b0e]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C896]" />
            {COMPANY_INFO.shortAddress}
          </span>
          <span className="text-slate-600">|</span>
          <span>{COMPANY_INFO.scheduleWeekday}</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`tel:${COMPANY_INFO.phone1Raw}`}
            className="flex items-center gap-1 hover:text-[#00C896] transition-colors"
          >
            <Phone className="w-3 h-3 text-[#00C896]" />
            <span>{COMPANY_INFO.phone1}</span>
          </a>
          <span className="text-slate-600">·</span>
          <button
            onClick={onOpenSellModal}
            className="text-xs text-slate-300 hover:text-[#00C896] transition-colors cursor-pointer"
          >
            ¿Quieres vender tu auto? Haz clic aquí
          </button>
        </div>
      </div>

      {/* Main navigation row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Brand Wordmark (matching reference image: Autos in white, QP in green) */}
        <button
          onClick={() => handleTabClick('inicio')}
          className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none"
        >
          <div className="flex items-baseline">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white group-hover:text-slate-100 transition-colors">
              Autos
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#00C896] ml-0.5">
              QP
            </span>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-5 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            if (item.isHighlighted) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`relative px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#00C896] text-slate-950 shadow-md shadow-[#00C896]/20'
                      : 'text-[#00C896] bg-[#00C896]/10 hover:bg-[#00C896]/20 border border-[#00C896]/30'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black/30 px-1 py-0.2 rounded">
                    ★ Exclusivo
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#00C896] font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right CTA Buttons */}
        <div className="hidden sm:flex items-center gap-2.5">
          <button
            onClick={onOpenAdmin}
            className="px-3.5 py-2 text-xs font-bold text-slate-200 bg-[#171f28] hover:bg-[#222c38] border border-[#263240] hover:border-[#00C896] rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-[#00C896]" />
            <span>Ingresar</span>
          </button>
          <button
            onClick={() => handleTabClick('inventario')}
            className="px-5 py-2.5 text-sm font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] rounded-md transition-all transform hover:-translate-y-0.5 shadow-sm shadow-[#00C896]/20 cursor-pointer whitespace-nowrap"
          >
            Ver inventario
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex xl:hidden items-center gap-2">
          <button
            onClick={onOpenAdmin}
            className="sm:hidden p-2 text-slate-300 hover:text-white rounded-lg bg-[#161d25] border border-slate-700"
            title="Ingresar al CRM"
          >
            <LogIn className="w-4 h-4 text-[#00C896]" />
          </button>
          <button
            onClick={() => handleTabClick('inventario')}
            className="sm:hidden px-3 py-1.5 text-xs font-bold text-slate-950 bg-[#00C896] rounded-md"
          >
            Inventario
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/60 focus:outline-none"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#11161d] border-b border-slate-800 px-4 pt-3 pb-6 space-y-2 animate-in slide-in-from-top-2 duration-150">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                currentTab === item.id
                  ? 'bg-[#00C896]/15 text-[#00C896] font-semibold'
                  : item.isHighlighted
                  ? 'text-[#00C896] bg-[#00C896]/5'
                  : 'text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{item.label}</span>
              {item.isHighlighted && (
                <span className="text-[10px] text-[#00C896] font-bold border border-[#00C896]/40 px-1.5 py-0.5 rounded">
                  ★ Diferencial
                </span>
              )}
            </button>
          ))}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAdmin();
              }}
              className="w-full py-2.5 text-sm font-bold text-[#00C896] bg-[#00C896]/10 border border-[#00C896]/30 rounded-lg flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Administración</span>
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSellModal();
              }}
              className="w-full py-2.5 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
            >
              Vender mi auto
            </button>
            <button
              onClick={() => handleTabClick('inventario')}
              className="w-full py-2.5 text-sm font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] rounded-lg"
            >
              Ver inventario completo
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
