import { webText } from "../content";
import React from 'react';
import { PageTab } from '../types';
import { ShoppingBag, ArrowLeftRight, Landmark, ShieldCheck, ArrowRight } from 'lucide-react';
interface SolucionQPProps {
  onNavigate: (tab: PageTab) => void;
  onOpenSellModal: () => void;
}
export const SolucionQP: React.FC<SolucionQPProps> = ({
  onNavigate,
  onOpenSellModal
}) => {
  const pillars = [{
    id: 'comprar',
    title: webText("SolucionQP.6719dc8ed6c9", "Comprar"),
    subtitle: webText("SolucionQP.b5a497bd74ba", "Inventario 100% asegurable"),
    desc: webText("SolucionQP.b6ab6b523205", "Encuentra autos y camionetas multimarca verificados mec\xE1nicamente, con peritaje transparente y entrega inmediata."),
    icon: ShoppingBag,
    action: () => onNavigate('inventario'),
    cta: webText("SolucionQP.9564f253385a", "Ver cat\xE1logo")
  }, {
    id: 'vender',
    title: webText("SolucionQP.ad095c7b2855", "Vender o Retoma"),
    subtitle: webText("SolucionQP.73abecf5f9ec", "Pago justo y sin rodeos"),
    desc: webText("SolucionQP.b03ebe53c783", "Compramos tu veh\xEDculo o lo recibimos en parte de pago. Tambi\xE9n te ofrecemos gesti\xF3n por consignaci\xF3n segura."),
    icon: ArrowLeftRight,
    action: onOpenSellModal,
    cta: webText("SolucionQP.83fa8bdeda6b", "Tasaci\xF3n inmediata")
  }, {
    id: 'financiar',
    title: webText("SolucionQP.916b2854b2f3", "Financiar"),
    subtitle: webText("SolucionQP.a0157a4b86b9", "Alianzas bancarias nacionales"),
    desc: webText("SolucionQP.09752036ea6a", "Tramitamos tu cr\xE9dito con Banco Santander, Occidente, Finandina, Banco W, Bancam\xEDa y cooperativas. Hasta 72 meses."),
    icon: Landmark,
    action: () => onNavigate('financiamiento'),
    cta: webText("SolucionQP.6dae6adb8605", "Simular cuotas")
  }, {
    id: 'reactivacion',
    title: webText("SolucionQP.fb816fe7e3d2", "Reactivaci\xF3n Financiera"),
    subtitle: webText("SolucionQP.e0c8a36cc052", "\u2605 Diferencial Exclusivo"),
    desc: webText("SolucionQP.8ec8e5d4ba56", "\xBFReportado en Datacr\xE9dito o TransUnion? Consultor\xEDa jur\xEDdica especializada para sanear tu historial y volver a calificar."),
    icon: ShieldCheck,
    action: () => onNavigate('reactivacion-financiera'),
    cta: webText("SolucionQP.a50d61e242c6", "Solicitar consulta"),
    highlighted: true
  }];
  return <section className="py-16 sm:py-20 bg-[#0a0d11] border-b border-[#1b222b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896] uppercase tracking-wider">{webText("SolucionQP.89ba3c8f1684", "Concepto Integral")}</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{webText("SolucionQP.61c23cf84f9e", "La Soluci\xF3n ")}<span className="text-[#00C896]">{webText("SolucionQP.0e97614e3af8", "QP")}</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed text-balance">{webText("SolucionQP.f6e9bf1b2ac7", "\"En Autos QP no solo vendemos carros \u2014 te damos toda la soluci\xF3n. Compramos, vendemos, financiamos con todos los bancos y te ayudamos a reactivarte financieramente si lo necesitas. Todo en un solo lugar.\"")}</p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map(item => {
          const Icon = item.icon;
          return <div key={item.id} className={`p-6 rounded-2xl transition-all duration-300 flex flex-col justify-between group ${item.highlighted ? 'bg-gradient-to-b from-[#13221e] to-[#0e1416] border border-[#00C896]/40 shadow-lg shadow-[#00C896]/5' : 'bg-[#11161d] border border-[#1f2834] hover:border-slate-600'}`}>
                <div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${item.highlighted ? 'bg-[#00C896] text-slate-950 font-bold' : 'bg-[#1a212b] text-[#00C896]'}`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="space-y-1 mb-3">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${item.highlighted ? 'text-[#00C896]' : 'text-slate-400'}`}>
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

                <button onClick={item.action} className={`w-full py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${item.highlighted ? 'bg-[#00C896] hover:bg-[#00B486] text-slate-950 shadow-md shadow-[#00C896]/20' : 'bg-[#1a222c] hover:bg-[#25303e] text-slate-200'}`}>
                  <span>{item.cta}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>;
        })}
        </div>
      </div>
    </section>;
};
