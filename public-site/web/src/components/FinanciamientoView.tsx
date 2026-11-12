import { webText } from "../content";
import React, { useState } from 'react';
import { COMPANY_INFO } from '../data/company';
import { calculateLoanMonthlyPayment, createWhatsAppLink } from '../utils/formatters';
import { creditFormUrl } from '../credit';
import { Calculator, Landmark, Shield, FileText, CheckCircle2, MessageCircle, ArrowRight } from 'lucide-react';
export const FinanciamientoView: React.FC = () => {
  // Simulator state
  const [vehiclePrice, setVehiclePrice] = useState<number>(65000000);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(20);
  const [termMonths, setTermMonths] = useState<number>(48);
  const downPayment = Math.round(vehiclePrice * downPaymentPercent / 100);
  const loanPrincipal = Math.max(0, vehiclePrice - downPayment);
  const {
    monthlyPayment
  } = calculateLoanMonthlyPayment(loanPrincipal, 0.165, termMonths);
  const termOptions = [12, 24, 36, 48, 60, 72];
  const percentOptions = [0, 10, 20, 30, 40, 50];
  const handleWhatsAppCredit = () => {
    const msg = `Hola Autos QP, deseo asesoría de crédito para financiar un vehículo de $ ${vehiclePrice.toLocaleString('es-CO')} con cuota inicial de $ ${downPayment.toLocaleString('es-CO')} a ${termMonths} meses.`;
    window.location.assign(creditFormUrl());
  };
  const handleWhatsAppInsurance = () => {
    const msg = `Hola Autos QP, deseo cotizar el seguro (todo riesgo / SOAT) para mi vehículo.`;
    window.open(createWhatsAppLink(msg), '_blank');
  };
  const handleWhatsAppWarranty = () => {
    const msg = `Hola, quiero información sobre la garantía opcional de caja y motor`;
    window.open(createWhatsAppLink(msg), '_blank');
  };
  const steps = [{
    step: '01',
    title: webText("FinanciamientoView.dee6be05ec60", "Consulta tu perfil"),
    desc: webText("FinanciamientoView.6c87866d3cad", "Consulta tu perfil crediticio sin costo y sin afectar tu historial ante las centrales de riesgo.")
  }, {
    step: '02',
    title: webText("FinanciamientoView.96a7ec67a252", "Opciones a tu medida"),
    desc: webText("FinanciamientoView.54c20b2dcba5", "Te presentamos las mejores opciones de tasas, cuotas y plazos disponibles para tu situaci\xF3n financiera.")
  }, {
    step: '03',
    title: webText("FinanciamientoView.ed7657856392", "Radicaci\xF3n directa"),
    desc: webText("FinanciamientoView.9528d1899114", "Radicamos tu solicitud y documentaci\xF3n ante la entidad financiera que m\xE1s te favorece.")
  }, {
    step: '04',
    title: webText("FinanciamientoView.cd1f7a9adbe1", "Aprobaci\xF3n y entrega"),
    desc: webText("FinanciamientoView.2d565ff5de39", "Recibes la carta de aprobaci\xF3n formal, realizamos traspaso legal y te entregamos las llaves de tu veh\xEDculo.")
  }];
  return <div className="py-12 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header from PDF Page 6 */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">{webText("FinanciamientoView.c9fc7bd16d02", "Financiamiento a tu Medida")}</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">{webText("FinanciamientoView.ebd2aba4a6f4", "Financia tu veh\xEDculo ")}<span className="text-[#00C896]">{webText("FinanciamientoView.798904a1f1d9", "con la mejor opci\xF3n")}</span>
          </h1>
          <p className="text-lg text-[#00C896] font-semibold">{webText("FinanciamientoView.d61d56bba25d", "No buscas un cr\xE9dito \u2014 buscas el cr\xE9dito correcto para ti.")}</p>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{webText("FinanciamientoView.45adabbeea9c", "En Autos QP tenemos alianzas con todos los bancos del pa\xEDs para que encuentres la opci\xF3n que m\xE1s te conviene seg\xFAn tu perfil. Te asesoramos paso a paso, radicamos tu solicitud y te acompa\xF1amos hasta la entrega de tu veh\xEDculo.")}</p>
        </div>

        {/* Calculadora de Crédito Interactiva */}
        <div className="bg-[#11161d] border border-[#212b37] rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="flex items-center gap-3 pb-6 border-b border-[#202936]">
            <div className="p-2.5 rounded-xl bg-[#00C896]/10 text-[#00C896]">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{webText("FinanciamientoView.07f625788899", "Calculadora de cr\xE9dito vehicular")}</h2>
              <p className="text-xs sm:text-sm text-slate-400">{webText("FinanciamientoView.46bdc8d52beb", "Simula tu cuota mensual estimada en segundos de forma interactiva")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 items-center">
            {/* Controls Left Column */}
            <div className="lg:col-span-7 space-y-6">
              {/* Valor del vehículo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">{webText("FinanciamientoView.89c46aaafc91", "Valor del veh\xEDculo a financiar")}</label>
                  <span className="text-base sm:text-lg font-bold text-[#00C896] tabular-nums">{"$ "}{vehiclePrice.toLocaleString('es-CO')}
                  </span>
                </div>
                <input type="range" min={30000000} max={250000000} step={1000000} value={vehiclePrice} onChange={e => setVehiclePrice(Number(e.target.value))} className="w-full accent-[#00C896] cursor-pointer" />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>{webText("FinanciamientoView.e5b2329ecadd", "$ 30.000.000")}</span>
                  <span>{webText("FinanciamientoView.f1f311beff87", "$ 250.000.000")}</span>
                </div>
              </div>

              {/* Cuota Inicial */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">{webText("FinanciamientoView.6f55280bd6b7", "Cuota inicial (")}{downPaymentPercent}{"%)"}</label>
                  <span className="text-base sm:text-lg font-bold text-white tabular-nums">{"$ "}{downPayment.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {percentOptions.map(pct => <button key={pct} type="button" onClick={() => setDownPaymentPercent(pct)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${downPaymentPercent === pct ? 'bg-[#00C896] text-slate-950 shadow-md' : 'bg-[#18212b] text-slate-300 hover:text-white'}`}>
                      {pct}{"%"}</button>)}
                </div>
                <p className="text-[11px] text-slate-400">{webText("FinanciamientoView.1df9eeb68d51", "Monto neto a financiar por el banco:")}{' '}
                  <span className="text-white font-semibold">{"$ "}{loanPrincipal.toLocaleString('es-CO')}
                  </span>
                </p>
              </div>

              {/* Plazo en meses */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">{webText("FinanciamientoView.508ecc6745d3", "Plazo en meses")}</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {termOptions.map(term => <button key={term} type="button" onClick={() => setTermMonths(term)} className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${termMonths === term ? 'bg-[#00C896] text-slate-950 shadow-md' : 'bg-[#18212b] text-slate-300 hover:text-white border border-[#26313d]'}`}>
                      {term}{webText("FinanciamientoView.09633a499433", " meses")}</button>)}
                </div>
              </div>
            </div>

            {/* Results Right Box */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#16222b] to-[#0f171e] p-6 sm:p-8 rounded-2xl border border-[#2b394a] shadow-xl text-center space-y-5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00C896]">{webText("FinanciamientoView.03569cd25ec1", "Resultado Estimado")}</span>
              <div>
                <p className="text-xs text-slate-400 mb-1">{webText("FinanciamientoView.7c36dd9bb41d", "Cuota mensual aproximada:")}</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight tabular-nums">{"$ "}{monthlyPayment.toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-slate-400 mt-1">{webText("FinanciamientoView.b54ea7f2c474", "/ mes por ")}{termMonths}{webText("FinanciamientoView.02735e7b3696", " cuotas")}</p>
              </div>

              <div className="pt-4 border-t border-slate-700/60 space-y-2 text-left text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>{webText("FinanciamientoView.9a3a733880ba", "Monto solicitado:")}</span>
                  <span className="font-semibold text-white">{"$ "}{loanPrincipal.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{webText("FinanciamientoView.fbac6f326ce3", "Tasa estimada referencial:")}</span>
                  <span className="font-semibold text-[#00C896]">{webText("FinanciamientoView.a85c43c2ccae", "Desde 1.28% MV (~16.5% EA)")}</span>
                </div>
              </div>

              <button onClick={handleWhatsAppCredit} className="w-full py-3.5 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer flex items-center justify-center gap-2 text-sm">
                <MessageCircle className="w-4 h-4" />
                <span>{webText("FinanciamientoView.fdb41330b22e", "Solicitar este cr\xE9dito en l\xEDnea")}</span>
              </button>

              {/* Mandatory Legal Disclaimers from PDF Page 6 */}
              <div className="text-[10px] text-slate-400 leading-normal text-left space-y-1">
                <p>{webText("FinanciamientoView.427b65567204", "* El valor es referencial. El monto aprobado y la tasa dependen del an\xE1lisis crediticio de la entidad financiera. No incluye seguros.")}</p>
                <p>{webText("FinanciamientoView.61628ae8c5b1", "* Los seguros y la garant\xEDa mec\xE1nica de caja y motor son servicios opcionales con costo adicional; ver secci\xF3n \"Seguros y garant\xEDa mec\xE1nica\".")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Entidades bancarias aliadas (Page 6) */}
        <div className="p-8 rounded-3xl bg-[#11161d] border border-[#212b37] space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#00C896] uppercase tracking-wider mb-1">
              <Landmark className="w-4 h-4" />
              <span>{webText("FinanciamientoView.cb6efae387f2", "Red Bancaria Aliada")}</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">{webText("FinanciamientoView.c6adfb6f5a57", "Entidades bancarias aliadas")}</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">{webText("FinanciamientoView.24b0747f269e", "Radicamos tu solicitud simult\xE1neamente para lograr la tasa m\xE1s baja y mayor viabilidad de aprobaci\xF3n.")}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {COMPANY_INFO.banks.map(bank => <div key={bank.name} className="p-4 rounded-xl bg-[#0b0e12] border border-[#1f2834] text-center flex flex-col justify-center items-center">
                <p className="text-sm font-bold text-white">{bank.name}</p>
                <span className="text-[11px] text-slate-400 mt-1">{bank.category}</span>
              </div>)}
          </div>

          {/* Davivienda notice from PDF */}
          <p className="text-xs text-amber-400/90 italic">{webText("FinanciamientoView.97e79c50959b", "* Trabajamos con todos los bancos excepto Davivienda.")}</p>
        </div>

        {/* Seguros y garantía mecánica (servicios opcionales) — Dos tarjetas lado a lado (PDF Page 6 & 7) */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{webText("FinanciamientoView.b013093ac832", "Seguros y garant\xEDa mec\xE1nica ")}<span className="text-slate-400 font-normal text-lg">{webText("FinanciamientoView.59bece78919b", "(servicios opcionales)")}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">{webText("FinanciamientoView.4491698fc7c2", "Servicios complementarios para que ruedes con total tranquilidad desde el primer d\xEDa.")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tarjeta 1 — Seguros */}
            <div className="rounded-2xl bg-[#11161d] border border-[#212b37] p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#00C896]/10 text-[#00C896]">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C896]">{webText("FinanciamientoView.ba6c57089cab", "Tarjeta 1 \u2014 Seguros")}</span>
                    <h3 className="text-lg font-bold text-white leading-snug">{webText("FinanciamientoView.3ab49cccc62c", "Cotiza tu seguro con nuestras aseguradoras aliadas (cotizaci\xF3n comparativa sin costo)")}</h3>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">{webText("FinanciamientoView.9223db2d0b37", "Al comprar tu veh\xEDculo puedes cotizar tu seguro (todo riesgo, SOAT y otros) con las aseguradoras con las que Autos QP tiene alianza, para que salgas con todo resuelto.")}</p>

                {/* Logos / listado de aseguradoras */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-400 mb-2">{webText("FinanciamientoView.ced6ad081a31", "Aseguradoras aliadas:")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COMPANY_INFO.insurers.map(ins => <div key={ins.name} className="px-2.5 py-1.5 rounded-md bg-[#0b0e12] border border-[#222b36] text-[11px] font-medium text-slate-300 text-center">
                        {ins.name}
                      </div>)}
                  </div>
                </div>
              </div>

              <button onClick={handleWhatsAppInsurance} className="w-full py-3 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm">
                <MessageCircle className="w-4 h-4" />
                <span>{webText("FinanciamientoView.071fdd78025e", "Cotizar mi seguro \u2192 WhatsApp")}</span>
              </button>
            </div>

            {/* Tarjeta 2 — Garantía de caja y motor (opcional) */}
            <div className="rounded-2xl bg-[#11161d] border border-[#212b37] p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#00C896]/10 text-[#00C896]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C896]">{webText("FinanciamientoView.5f46faf479d7", "Tarjeta 2 \u2014 Garant\xEDa Opcional")}</span>
                    <h3 className="text-lg font-bold text-white leading-snug">{webText("FinanciamientoView.4c7b2260f71d", "Garant\xEDa opcional de caja y motor")}</h3>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">{webText("FinanciamientoView.b2904d110f2b", "Si lo deseas, puedes solicitar una garant\xEDa mec\xE1nica de caja y motor para veh\xEDculos de modelo menor a 10 a\xF1os. Es un valor agregado con costo adicional a cargo del cliente, y es otorgada por una empresa aliada, no por Autos QP.")}</p>

                {/* Pre-defined message reminder */}
                <div className="p-3 rounded-lg bg-[#0c1015] border border-slate-800 text-xs text-slate-400">
                  <p className="text-[11px] font-semibold text-slate-300 mb-1">{webText("FinanciamientoView.8dea23f02446", "Mensaje predefinido de WhatsApp:")}</p>
                  <p className="italic text-[#00C896]">{webText("FinanciamientoView.f228eb3f9ff8", "\"Hola, quiero informaci\xF3n sobre la garant\xEDa opcional de caja y motor\"")}</p>
                </div>
              </div>

              <div className="space-y-4">
                <button onClick={handleWhatsAppWarranty} className="w-full py-3 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm">
                  <MessageCircle className="w-4 h-4" />
                  <span>{webText("FinanciamientoView.0402667c7e57", "Preguntar por la garant\xEDa \u2192 WhatsApp")}</span>
                </button>

                {/* MANDATORY LEGAL NOTICE VISIBLE AND READABLE UNDER CARD AS SPECIFIED IN PDF */}
                <div className="p-3 rounded-lg bg-[#0e1217] border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-300 block mb-0.5">{webText("FinanciamientoView.34d39bb7d2b4", "AVISO LEGAL OBLIGATORIO:")}</span>
                  <p>{COMPANY_INFO.warrantyLegalFull}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ¿Cómo funciona? — Proceso en 4 pasos (PDF Page 7) */}
        <div className="p-8 sm:p-10 rounded-3xl bg-[#11161d] border border-[#212b37] space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{webText("FinanciamientoView.fd2db4ac10e4", "\xBFC\xF3mo funciona? \u2014 ")}<span className="text-[#00C896]">{webText("FinanciamientoView.f0ba60bae34e", "Proceso en 4 pasos")}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">{webText("FinanciamientoView.b1e9bee71bb5", "Acompa\xF1amiento personalizado desde el primer contacto hasta que estrenas")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(st => <div key={st.step} className="p-5 rounded-2xl bg-[#0b0e12] border border-[#1f2834] relative space-y-3">
                <div className="text-3xl font-black text-[#00C896]/30 font-mono">
                  {st.step}
                </div>
                <h3 className="text-base font-bold text-white">
                  {st.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {st.desc}
                </p>
              </div>)}
          </div>

          {/* Llamado a la acción (Page 7) */}
          <div className="text-center pt-6 space-y-3">
            <button onClick={handleWhatsAppCredit} className="px-8 py-3.5 text-sm sm:text-base font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] rounded-md transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer inline-flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span>{webText("FinanciamientoView.8d96f817cbc5", "Completar solicitud de cr\xE9dito \u2192")}</span>
            </button>
            <p className="text-xs text-slate-400 italic">{webText("FinanciamientoView.8abe0e7312c3", "Nuestros asesores responden en minutos.")}</p>
          </div>
        </div>
      </div>
    </div>;
};
