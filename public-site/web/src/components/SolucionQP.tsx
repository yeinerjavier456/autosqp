import React from 'react';
import { PageTab } from '../types';
import { ShoppingBag, ArrowLeftRight, Landmark, ShieldCheck, ArrowRight } from 'lucide-react';

interface SolucionQPProps {
  onNavigate: (tab: PageTab) => void;
  onOpenSellModal: () => void;
}

export const SolucionQP: React.FC<SolucionQPProps> = ({ onNavigate, onOpenSellModal }) => {
  const pillars = [
    {
      id: 'comprar',
      title: 'Comprar',
      subtitle: 'Inventario 100% asegurable',
      desc: 'Encuentra autos y camionetas multimarca verificados mecánicamente, con peritaje transparente y entrega inmediata.',
      icon: ShoppingBag,
      action: () => onNavigate('inventario'),
      cta: 'Ver catálogo'
    },
    {
      id: 'vender',
      title: 'Vender o Retoma',
      subtitle: 'Pago justo y sin rodeos',
      desc: 'Compramos tu vehículo o lo recibimos en parte de pago. También te ofrecemos gestión por consignación segura.',
      icon: ArrowLeftRight,
      action: onOpenSellModal,
      cta: 'Tasación inmediata'
    },
    {
      id: 'financiar',
      title: 'Financiar',
      subtitle: 'Alianzas bancarias nacionales',
      desc: 'Tramitamos tu crédito con Banco Santander, Occidente, Finandina, Banco W, Bancamía y cooperativas. Hasta 72 meses.',
      icon: Landmark,
      action: () => onNavigate('financiamiento'),
      cta: 'Simular cuotas'
    },
    {
      id: 'reactivacion',
      title: 'Reactivación Financiera',
      subtitle: '★ Diferencial Exclusivo',
      desc: '¿Reportado en Datacrédito o TransUnion? Consultoría jurídica especializada para sanear tu historial y volver a calificar.',
      icon: ShieldCheck,
      action: () => onNavigate('reactivacion-financiera'),
      cta: 'Solicitar consulta',
      highlighted: true
    }
  ];

  return (
    <section className="py-16 sm:py-20 bg-[#0a0d11] border-b border-[#1b222b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896] uppercase tracking-wider">
            Concepto Integral
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            La Solución <span className="text-[#00C896]">QP</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed text-balance">
            "En Autos QP no solo vendemos carros — te damos toda la solución. Compramos, vendemos, financiamos con todos los bancos y te ayudamos a reactivarte financieramente si lo necesitas. Todo en un solo lugar."
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`p-6 rounded-2xl transition-all duration-300 flex flex-col justify-between group ${
                  item.highlighted
                    ? 'bg-gradient-to-b from-[#13221e] to-[#0e1416] border border-[#00C896]/40 shadow-lg shadow-[#00C896]/5'
                    : 'bg-[#11161d] border border-[#1f2834] hover:border-slate-600'
                }`}
              >
                <div>
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                      item.highlighted
                        ? 'bg-[#00C896] text-slate-950 font-bold'
                        : 'bg-[#1a212b] text-[#00C896]'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="space-y-1 mb-3">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        item.highlighted ? 'text-[#00C896]' : 'text-slate-400'
                      }`}
                    >
                      {item.subtitle}
                    </span>
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed mb-6">
                    {item.desc}
                  </p>
                </div>

                <button
                  onClick={item.action}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    item.highlighted
                      ? 'bg-[#00C896] hover:bg-[#00B486] text-slate-950 shadow-md shadow-[#00C896]/20'
                      : 'bg-[#1a222c] hover:bg-[#25303e] text-slate-200'
                  }`}
                >
                  <span>{item.cta}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
