import { webText } from "../content";
import React from 'react';
import { Car, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
interface SellCarCtaProps {
  onOpenSellModal: () => void;
}
export const SellCarCta: React.FC<SellCarCtaProps> = ({
  onOpenSellModal
}) => {
  return <section className="relative overflow-hidden py-14 sm:py-20 bg-[#0d1014] border-b border-[#1b222b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-[#121820] via-[#151c24] to-[#0d1217] border border-[#232d39] p-8 sm:p-12 relative overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Copy & CTA */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C896]/10 border border-[#00C896]/30 text-xs font-bold text-[#00C896]">
                <Zap className="w-3.5 h-3.5" />
                <span>{webText("SellCarCta.69aba1343289", "Tasaci\xF3n Gratuita y Pago Inmediato")}</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#00C896]/10 border border-[#00C896]/30 flex items-center justify-center text-[#00C896] shrink-0">
                  <Car className="w-8 h-8" />
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white leading-tight">{webText("SellCarCta.506eff5e08d5", "\xBFQUIERES VENDER ")}<br className="hidden sm:inline" />
                  <span className="text-[#00C896]">{webText("SellCarCta.f3e94b556faf", "TU AUTO?")}</span>
                </h2>
              </div>

              <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">{webText("SellCarCta.9606ca243b06", "Te ofrecemos la mejor valoraci\xF3n del mercado y una venta segura sin intermediarios dudosos. Recibimos tu auto en retoma o lo compramos de contado.")}</p>

              <div className="flex flex-wrap items-center gap-4">
                <button onClick={onOpenSellModal} className="px-6 py-3.5 text-sm sm:text-base font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] rounded-md transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer inline-flex items-center gap-2">
                  <span>{webText("SellCarCta.106e469d26df", "Vender mi auto")}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-[#00C896]" />
                  <span>{webText("SellCarCta.9e0a136c39d5", "Traspaso 100% legal y seguro")}</span>
                </div>
              </div>
            </div>

            {/* Right Visual matching the reference image layout */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative w-full aspect-[16/9] sm:aspect-[16/10] rounded-2xl overflow-hidden border border-[#273240] bg-gradient-to-tr from-[#0a0d11] to-[#171f28]">
                <img src={webText("SellCarCta.333796e887d9", "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80")} alt={webText("SellCarCta.be83bc079cfb", "Vender auto en Autos QP")} className="w-full h-full object-cover object-center" loading="lazy" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121820] via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>;
};
