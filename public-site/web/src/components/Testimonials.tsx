import { webText } from "../content";
import React, { useState, useEffect } from 'react';
import { websiteTestimonials } from '../content';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
export const Testimonials: React.FC = () => {
  const TESTIMONIALS = websiteTestimonials();
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => { setCurrentIndex(index => Math.max(0, Math.min(index, TESTIMONIALS.length - 1))); }, [TESTIMONIALS]);
  const prev = () => {
    setCurrentIndex(prevIdx => prevIdx === 0 ? TESTIMONIALS.length - 1 : prevIdx - 1);
  };
  const next = () => {
    setCurrentIndex(prevIdx => prevIdx === TESTIMONIALS.length - 1 ? 0 : prevIdx + 1);
  };
  const current = TESTIMONIALS[Math.min(currentIndex, TESTIMONIALS.length - 1)];
  if (!current) return null;
  return <section className="py-16 sm:py-24 bg-[#0a0d11] border-b border-[#1b222b] overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">{webText("Testimonials.f7f871eeae11", "LO QUE DICEN NUESTROS ")}<span className="text-[#00C896]">{webText("Testimonials.05ed1abd1797", "CLIENTES")}</span>
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">{webText("Testimonials.d45243b945a7", "Experiencias compartidas con Autos QP en C.C. Outlet Factory")}</p>
        </div>

        {/* Carousel Area */}
        <div className="relative flex items-center justify-between gap-4 sm:gap-8">
          {/* Left Arrow Button */}
          <button onClick={prev} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-slate-700 bg-[#12171e] hover:bg-[#1a222c] hover:border-[#00C896] text-white flex items-center justify-center transition-all cursor-pointer shrink-0" aria-label={webText("Testimonials.a0555f9c0b4b", "Testimonio anterior")}>
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Testimonial Card */}
          <div className="flex-1 max-w-2xl mx-auto flex flex-col md:flex-row items-center gap-6 sm:gap-8 text-center md:text-left p-6 sm:p-8 rounded-2xl bg-[#11161d] border border-[#202935] shadow-xl">
            {/* Avatar Circle with ring */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-[#00C896] p-0.5 shadow-lg">
                {current.avatar ? <img src={current.avatar} alt={current.name} className="w-full h-full object-cover rounded-full" loading="lazy" referrerPolicy="no-referrer" /> : <div className="flex h-full w-full items-center justify-center rounded-full bg-[#00C896]/15 text-3xl font-bold text-[#00C896]">{current.name.slice(0, 1).toUpperCase()}</div>}
              </div>
            </div>

            {/* Testimonial Content */}
            <div className="space-y-3">
              <div className="relative">
                <Quote className="w-8 h-8 text-[#00C896]/20 absolute -top-4 -left-4 hidden md:block" />
                <p className="text-base sm:text-lg text-slate-200 italic font-medium leading-relaxed">{"\""}{current.comment}{"\""}</p>
              </div>

              <div>
                <p className="text-base font-bold text-white tracking-wide">
                  {current.name}
                </p>
                <p className="text-xs text-slate-400">
                  {[current.role, current.vehiclePurchased].filter(Boolean).join(' · ')}
                </p>
                {current.date && <p className="mt-1 text-xs text-slate-500">{current.date}</p>}
              </div>

              {/* 5 Stars matching screenshot */}
              <div className="flex items-center justify-center md:justify-start gap-1 text-[#00C896]">
                {[...Array(current.rating)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
            </div>
          </div>

          {/* Right Arrow Button */}
          <button onClick={next} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-slate-700 bg-[#12171e] hover:bg-[#1a222c] hover:border-[#00C896] text-white flex items-center justify-center transition-all cursor-pointer shrink-0" aria-label={webText("Testimonials.c23079d215da", "Testimonio siguiente")}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Carousel indicator dots */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {TESTIMONIALS.map((_, idx) => <button key={idx} onClick={() => setCurrentIndex(idx)} className={`h-2 transition-all rounded-full cursor-pointer ${currentIndex === idx ? 'w-6 bg-[#00C896]' : 'w-2 bg-slate-700 hover:bg-slate-500'}`} aria-label={`Ir al testimonio ${idx + 1}`} />)}
        </div>
      </div>
    </section>;
};
