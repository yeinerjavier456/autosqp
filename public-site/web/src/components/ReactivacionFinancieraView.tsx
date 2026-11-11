import React, { useState } from 'react';
import { useInquiry } from '../useInquiry';
import { ShieldCheck, CheckCircle2, Lock, MessageCircle, AlertCircle, Sparkles } from 'lucide-react';

export const ReactivacionFinancieraView: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [reportType, setReportType] = useState('Datacrédito');
  const [reportAge, setReportAge] = useState('Menos de 1 año');
  const { submitted, sending, error, submit } = useInquiry();

  const includes = [
    'Revisión detallada de tu situación actual en centrales de riesgo (Datacrédito / TransUnion)',
    'Diagnóstico real de elegibilidad crediticia para compra vehicular',
    'Orientación sobre entidades y cooperativas con mayor flexibilidad de aprobación',
    'Plan de acción personalizado para el saneamiento gradual de tu caso',
    'Acompañamiento jurídico especializado durante todo el proceso de reactivación'
  ];

  const targetAudience = [
    'Personas reportadas negativamente en Datacrédito o TransUnion',
    'Clientes con créditos castigados o carteras en mora que buscan acuerdo',
    'Personas que han sido rechazadas en otras entidades bancarias',
    'Quienes desean sanear su historial crediticio antes de solicitar un crédito vehicular'
  ];

  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `Hola Autos QP, solicito consulta confidencial para Reactivación Financiera.\nNombre: ${fullName || 'Cliente'}\nTeléfono: ${phone}\nCentral: ${reportType}\nAntigüedad: ${reportAge}`;
    await submit({ name: fullName, phone, subject: 'Reactivación Financiera', message: msg });
  };

  return (
    <div className="py-12 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header from PDF Page 8 */}
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00C896]/15 border border-[#00C896]/40 text-xs font-bold text-[#00C896]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Servicio Exclusivo Autos QP — Diferencial en C.C. Outlet Factory</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Reactivación <span className="text-[#00C896]">Financiera</span>
          </h1>

          <p className="text-xl sm:text-2xl font-bold text-[#00C896] tracking-tight">
            ¿Reportado en centrales de riesgo? Te ayudamos a retomar el camino.
          </p>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Sabemos que un reporte en Datacrédito o TransUnion no define tu futuro. En Autos QP contamos con una consultoría jurídica y financiera especializada que analiza tu caso de forma personalizada, confidencial y sin juicios. Nuestro equipo te orienta sobre cómo mejorar tu historial crediticio y te acompaña en el proceso de reactivación para que puedas acceder nuevamente al financiamiento vehicular.
          </p>
        </div>

        {/* 2-Column Grid: Features on Left, Pre-diagnostic Form on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: What it includes & Audience */}
          <div className="lg:col-span-7 space-y-8">
            {/* ¿Qué incluye la consulta? */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#11161d] border border-[#212b37] space-y-4">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#00C896]" />
                <span>¿Qué incluye la consulta?</span>
              </h2>

              <ul className="space-y-3">
                {includes.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C896] mt-2 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ¿A quién va dirigido? */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#11161d] border border-[#212b37] space-y-4">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#00C896]" />
                <span>¿A quién va dirigido?</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {targetAudience.map((item, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl bg-[#0b0e12] border border-[#1f2834] text-xs text-slate-300 leading-relaxed"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Confidentiality promise */}
            <div className="p-4 rounded-xl bg-[#00C896]/10 border border-[#00C896]/30 flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#00C896] shrink-0" />
              <p className="text-xs sm:text-sm text-slate-200">
                <strong className="text-white">Confidencialidad absoluta:</strong> Tu información es completamente confidencial bajo la Ley 1581 de 2012. Hablemos sin compromiso.
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Consultation Card */}
          <div className="lg:col-span-5 bg-[#121820] border border-[#263240] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#00C896] uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Diagnóstico Sin Juicios</span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                Solicitar Consulta Confidencial
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Completa estos datos básicos y un consultor jurídico te contactará en minutos.
              </p>
            </div>

            {submitted ? <div role="status" className="rounded-2xl border border-[#00C896]/40 bg-[#00C896]/10 p-6 text-slate-200">Recibimos tu solicitud de Reactivación Financiera. Nuestro equipo continuará el seguimiento.</div> : <form onSubmit={handleConsultSubmit} className="space-y-4">
              {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Tu nombre y apellido"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ej. 320 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Central
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-2.5 py-2.5 focus:border-[#00C896] focus:outline-none"
                  >
                    <option value="Datacrédito">Datacrédito</option>
                    <option value="TransUnion">TransUnion</option>
                    <option value="Ambas">Ambas</option>
                    <option value="No sé">No estoy seguro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Antigüedad
                  </label>
                  <select
                    value={reportAge}
                    onChange={(e) => setReportAge(e.target.value)}
                    className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-2.5 py-2.5 focus:border-[#00C896] focus:outline-none"
                  >
                    <option value="Menos de 1 año">Menos de 1 año</option>
                    <option value="1 a 3 años">1 a 3 años</option>
                    <option value="Más de 3 años">Más de 3 años</option>
                    <option value="Ya pagué">Ya pagué la deuda</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer flex items-center justify-center gap-2 text-sm mt-2"
              >
                <MessageCircle className="w-5 h-5" />
                <span>{sending ? 'Registrando solicitud…' : 'Solicitar consulta'}</span>
              </button>

              <p className="text-center text-xs text-slate-400 italic">
                "Tu información es completamente confidencial. Hablemos sin compromiso."
              </p>
            </form>}

            {/* Aviso legal obligatorio (Page 8) */}
            <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-400 leading-relaxed">
              <span className="font-bold text-slate-300 block mb-0.5">Aviso legal:</span>
              <p>
                * La consultoría de Reactivación Financiera es prestada por una firma jurídica aliada. Autos QP actúa como intermediario y orientador en el proceso.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
