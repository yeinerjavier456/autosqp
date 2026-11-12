import { webText } from "../content";
import React, { useState } from 'react';
import { useInquiry } from '../useInquiry';
import { ShieldCheck, CheckCircle2, Lock, MessageCircle, AlertCircle, Sparkles } from 'lucide-react';
export const ReactivacionFinancieraView: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [reportType, setReportType] = useState('Datacrédito');
  const [reportAge, setReportAge] = useState('Menos de 1 año');
  const {
    submitted,
    sending,
    error,
    submit
  } = useInquiry();
  const includes = [webText("ReactivacionFinancieraView.d491fe1d00f3", "Revisi\xF3n detallada de tu situaci\xF3n actual en centrales de riesgo (Datacr\xE9dito / TransUnion)"), webText("ReactivacionFinancieraView.cdf0519dba9f", "Diagn\xF3stico real de elegibilidad crediticia para compra vehicular"), webText("ReactivacionFinancieraView.7cee9bd94ddf", "Orientaci\xF3n sobre entidades y cooperativas con mayor flexibilidad de aprobaci\xF3n"), webText("ReactivacionFinancieraView.fbecf8ad0a44", "Plan de acci\xF3n personalizado para el saneamiento gradual de tu caso"), webText("ReactivacionFinancieraView.de619870ea3b", "Acompa\xF1amiento jur\xEDdico especializado durante todo el proceso de reactivaci\xF3n")];
  const targetAudience = [webText("ReactivacionFinancieraView.5f02fee7543b", "Personas reportadas negativamente en Datacr\xE9dito o TransUnion"), webText("ReactivacionFinancieraView.1d2da3e3bc91", "Clientes con cr\xE9ditos castigados o carteras en mora que buscan acuerdo"), webText("ReactivacionFinancieraView.45c73cbb925b", "Personas que han sido rechazadas en otras entidades bancarias"), webText("ReactivacionFinancieraView.514be64839a9", "Quienes desean sanear su historial crediticio antes de solicitar un cr\xE9dito vehicular")];
  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `Hola Autos QP, solicito consulta confidencial para Reactivación Financiera.\nNombre: ${fullName || 'Cliente'}\nTeléfono: ${phone}\nCentral: ${reportType}\nAntigüedad: ${reportAge}`;
    await submit({
      name: fullName,
      phone,
      subject: 'Reactivación Financiera',
      message: msg
    });
  };
  return <div className="py-12 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header from PDF Page 8 */}
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00C896]/15 border border-[#00C896]/40 text-xs font-bold text-[#00C896]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{webText("ReactivacionFinancieraView.d3ba7f7c599d", "Servicio Exclusivo Autos QP \u2014 Diferencial en C.C. Outlet Factory")}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">{webText("ReactivacionFinancieraView.227cf8279e53", "Reactivaci\xF3n ")}<span className="text-[#00C896]">{webText("ReactivacionFinancieraView.d4d744a99ab1", "Financiera")}</span>
          </h1>

          <p className="text-xl sm:text-2xl font-bold text-[#00C896] tracking-tight">{webText("ReactivacionFinancieraView.f63c58029bde", "\xBFReportado en centrales de riesgo? Te ayudamos a retomar el camino.")}</p>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">{webText("ReactivacionFinancieraView.8229263b816f", "Sabemos que un reporte en Datacr\xE9dito o TransUnion no define tu futuro. En Autos QP contamos con una consultor\xEDa jur\xEDdica y financiera especializada que analiza tu caso de forma personalizada, confidencial y sin juicios. Nuestro equipo te orienta sobre c\xF3mo mejorar tu historial crediticio y te acompa\xF1a en el proceso de reactivaci\xF3n para que puedas acceder nuevamente al financiamiento vehicular.")}</p>
        </div>

        {/* 2-Column Grid: Features on Left, Pre-diagnostic Form on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: What it includes & Audience */}
          <div className="lg:col-span-7 space-y-8">
            {/* ¿Qué incluye la consulta? */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#11161d] border border-[#212b37] space-y-4">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#00C896]" />
                <span>{webText("ReactivacionFinancieraView.e7e9e006dce0", "\xBFQu\xE9 incluye la consulta?")}</span>
              </h2>

              <ul className="space-y-3">
                {includes.map((item, index) => <li key={index} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C896] mt-2 shrink-0" />
                    <span>{item}</span>
                  </li>)}
              </ul>
            </div>

            {/* ¿A quién va dirigido? */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#11161d] border border-[#212b37] space-y-4">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#00C896]" />
                <span>{webText("ReactivacionFinancieraView.41fec40bb250", "\xBFA qui\xE9n va dirigido?")}</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {targetAudience.map((item, index) => <div key={index} className="p-3.5 rounded-xl bg-[#0b0e12] border border-[#1f2834] text-xs text-slate-300 leading-relaxed">
                    {item}
                  </div>)}
              </div>
            </div>

            {/* Confidentiality promise */}
            <div className="p-4 rounded-xl bg-[#00C896]/10 border border-[#00C896]/30 flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#00C896] shrink-0" />
              <p className="text-xs sm:text-sm text-slate-200">
                <strong className="text-white">{webText("ReactivacionFinancieraView.9e00de719546", "Confidencialidad absoluta:")}</strong>{webText("ReactivacionFinancieraView.361302754692", " Tu informaci\xF3n es completamente confidencial bajo la Ley 1581 de 2012. Hablemos sin compromiso.")}</p>
            </div>
          </div>

          {/* Right Column: Interactive Consultation Card */}
          <div className="lg:col-span-5 bg-[#121820] border border-[#263240] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#00C896] uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>{webText("ReactivacionFinancieraView.8f11ef9df5f8", "Diagn\xF3stico Sin Juicios")}</span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">{webText("ReactivacionFinancieraView.68a742c6782c", "Solicitar Consulta Confidencial")}</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">{webText("ReactivacionFinancieraView.9c4881eaecb8", "Completa estos datos b\xE1sicos y un consultor jur\xEDdico te contactar\xE1 en minutos.")}</p>
            </div>

            {submitted ? <div role="status" className="rounded-2xl border border-[#00C896]/40 bg-[#00C896]/10 p-6 text-slate-200">{webText("ReactivacionFinancieraView.c9133809b99e", "Recibimos tu solicitud de Reactivaci\xF3n Financiera. Nuestro equipo continuar\xE1 el seguimiento.")}</div> : <form onSubmit={handleConsultSubmit} className="space-y-4">
              {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">{webText("ReactivacionFinancieraView.4ff6cf39e6cf", "Nombre completo")}</label>
                <input type="text" required placeholder={webText("ReactivacionFinancieraView.b4e6fa870e93", "Tu nombre y apellido")} value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">{webText("ReactivacionFinancieraView.40651301d1a6", "Tel\xE9fono / WhatsApp")}</label>
                <input type="tel" required placeholder={webText("ReactivacionFinancieraView.19f400ef51bc", "Ej. 320 123 4567")} value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">{webText("ReactivacionFinancieraView.ab58c0d659b9", "Central")}</label>
                  <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-2.5 py-2.5 focus:border-[#00C896] focus:outline-none">
                    <option value="Datacrédito">{webText("ReactivacionFinancieraView.857bd5bca497", "Datacr\xE9dito")}</option>
                    <option value="TransUnion">{webText("ReactivacionFinancieraView.dbff73d9bbf9", "TransUnion")}</option>
                    <option value="Ambas">{webText("ReactivacionFinancieraView.893bd998df36", "Ambas")}</option>
                    <option value="No sé">{webText("ReactivacionFinancieraView.ba849adba6e0", "No estoy seguro")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">{webText("ReactivacionFinancieraView.64a84d752537", "Antig\xFCedad")}</label>
                  <select value={reportAge} onChange={e => setReportAge(e.target.value)} className="w-full bg-[#090c10] border border-[#2b3744] text-xs text-white rounded-lg px-2.5 py-2.5 focus:border-[#00C896] focus:outline-none">
                    <option value="Menos de 1 año">{webText("ReactivacionFinancieraView.21e72f97d020", "Menos de 1 a\xF1o")}</option>
                    <option value="1 a 3 años">{webText("ReactivacionFinancieraView.0f7bec7dcd18", "1 a 3 a\xF1os")}</option>
                    <option value="Más de 3 años">{webText("ReactivacionFinancieraView.86be618a94e0", "M\xE1s de 3 a\xF1os")}</option>
                    <option value="Ya pagué">{webText("ReactivacionFinancieraView.070a261e9566", "Ya pagu\xE9 la deuda")}</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={sending} className="w-full py-3.5 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer flex items-center justify-center gap-2 text-sm mt-2">
                <MessageCircle className="w-5 h-5" />
                <span>{sending ? webText("ReactivacionFinancieraView.d731279d0300", "Registrando solicitud\u2026") : webText("ReactivacionFinancieraView.a50d61e242c6", "Solicitar consulta")}</span>
              </button>

              <p className="text-center text-xs text-slate-400 italic">{webText("ReactivacionFinancieraView.c60398c5cec5", "\"Tu informaci\xF3n es completamente confidencial. Hablemos sin compromiso.\"")}</p>
            </form>}

            {/* Aviso legal obligatorio (Page 8) */}
            <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-400 leading-relaxed">
              <span className="font-bold text-slate-300 block mb-0.5">{webText("ReactivacionFinancieraView.836907bbdfd1", "Aviso legal:")}</span>
              <p>{webText("ReactivacionFinancieraView.85ba440f2df2", "* La consultor\xEDa de Reactivaci\xF3n Financiera es prestada por una firma jur\xEDdica aliada. Autos QP act\xFAa como intermediario y orientador en el proceso.")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
