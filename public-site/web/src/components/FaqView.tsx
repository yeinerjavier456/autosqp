import React, { useState, useMemo } from 'react';
import { FAQ_LIST } from '../data/faqs';
import { FAQItem } from '../types';
import { ChevronDown, Search, HelpCircle, MessageCircle } from 'lucide-react';
import { createWhatsAppLink } from '../utils/formatters';

export const FaqView: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>('compra-1');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'ALL', label: 'Todas las preguntas' },
    { id: 'COMPRA', label: 'Compra de vehículos' },
    { id: 'FINANCIAMIENTO', label: 'Financiamiento' },
    { id: 'VENTA', label: 'Venta de vehículos' },
    { id: 'REACTIVACION', label: 'Reactivación Financiera ★' },
    { id: 'SEGUROS_GARANTIA', label: 'Seguros y Garantía' }
  ];

  const filteredFaqs = useMemo(() => {
    return FAQ_LIST.filter((item) => {
      if (activeCategory !== 'ALL' && item.category !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  const toggleAccordion = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleWhatsAppInquiry = () => {
    const text = 'Hola Autos QP, tengo una consulta que no encontré en las Preguntas Frecuentes.';
    window.open(createWhatsAppLink(text), '_blank');
  };

  return (
    <div className="py-12 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header from PDF Page 11 */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Centro de Ayuda</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Preguntas <span className="text-[#00C896]">Frecuentes</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300">
            Resolvemos tus dudas antes de que nos llames.
          </p>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por palabra clave (ej. Datacrédito, peritaje, retoma, Davivienda, garantía)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#11161d] border border-[#212b37] rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-slate-500 focus:border-[#00C896] focus:outline-none shadow-md"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-[#00C896] text-slate-950 shadow-md'
                    : 'bg-[#121820] text-slate-300 hover:text-white border border-[#232c38]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 p-6 rounded-2xl bg-[#11161d] border border-slate-800">
              <p className="text-slate-400 text-sm">
                No encontramos preguntas que coincidan con "{searchQuery}".
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('ALL');
                }}
                className="mt-3 text-xs text-[#00C896] font-bold underline"
              >
                Ver todas las preguntas
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl transition-all duration-200 border overflow-hidden ${
                    isOpen
                      ? 'bg-[#131922] border-[#00C896]/50 shadow-lg'
                      : 'bg-[#11161d] border-[#1f2834] hover:border-slate-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#00C896] block mb-1">
                        {faq.categoryLabel}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                        {faq.question}
                      </h3>
                    </div>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 bg-[#00C896] text-slate-950' : 'bg-[#1a222c] text-slate-400'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 pt-1 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 animate-in fade-in duration-150">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Still have questions CTA */}
        <div className="p-8 rounded-3xl bg-gradient-to-r from-[#121820] to-[#0c1015] border border-[#222b37] text-center space-y-4">
          <h3 className="text-xl font-bold text-white">¿Tienes alguna pregunta adicional?</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            Nuestros asesores en C.C. Outlet Factory están disponibles para resolver cualquier duda sobre peritaje, trámites, crédito o retoma.
          </p>
          <button
            onClick={handleWhatsAppInquiry}
            className="px-6 py-3 rounded-xl bg-[#00C896] hover:bg-[#00B486] text-slate-950 font-bold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer shadow-md"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Hablar con un asesor por WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
