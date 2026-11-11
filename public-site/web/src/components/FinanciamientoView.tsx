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

  const downPayment = Math.round((vehiclePrice * downPaymentPercent) / 100);
  const loanPrincipal = Math.max(0, vehiclePrice - downPayment);
  const { monthlyPayment } = calculateLoanMonthlyPayment(loanPrincipal, 0.165, termMonths);

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

  const steps = [
    {
      step: '01',
      title: 'Consulta tu perfil',
      desc: 'Consulta tu perfil crediticio sin costo y sin afectar tu historial ante las centrales de riesgo.'
    },
    {
      step: '02',
      title: 'Opciones a tu medida',
      desc: 'Te presentamos las mejores opciones de tasas, cuotas y plazos disponibles para tu situación financiera.'
    },
    {
      step: '03',
      title: 'Radicación directa',
      desc: 'Radicamos tu solicitud y documentación ante la entidad financiera que más te favorece.'
    },
    {
      step: '04',
      title: 'Aprobación y entrega',
      desc: 'Recibes la carta de aprobación formal, realizamos traspaso legal y te entregamos las llaves de tu vehículo.'
    }
  ];

  return (
    <div className="py-12 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header from PDF Page 6 */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">
            Financiamiento a tu Medida
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Financia tu vehículo <span className="text-[#00C896]">con la mejor opción</span>
          </h1>
          <p className="text-lg text-[#00C896] font-semibold">
            No buscas un crédito — buscas el crédito correcto para ti.
          </p>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            En Autos QP tenemos alianzas con todos los bancos del país para que encuentres la opción que más te conviene según tu perfil. Te asesoramos paso a paso, radicamos tu solicitud y te acompañamos hasta la entrega de tu vehículo.
          </p>
        </div>

        {/* Calculadora de Crédito Interactiva */}
        <div className="bg-[#11161d] border border-[#212b37] rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="flex items-center gap-3 pb-6 border-b border-[#202936]">
            <div className="p-2.5 rounded-xl bg-[#00C896]/10 text-[#00C896]">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Calculadora de crédito vehicular
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Simula tu cuota mensual estimada en segundos de forma interactiva
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 items-center">
            {/* Controls Left Column */}
            <div className="lg:col-span-7 space-y-6">
              {/* Valor del vehículo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Valor del vehículo a financiar
                  </label>
                  <span className="text-base sm:text-lg font-bold text-[#00C896] tabular-nums">
                    $ {vehiclePrice.toLocaleString('es-CO')}
                  </span>
                </div>
                <input
                  type="range"
                  min={30000000}
                  max={250000000}
                  step={1000000}
                  value={vehiclePrice}
                  onChange={(e) => setVehiclePrice(Number(e.target.value))}
                  className="w-full accent-[#00C896] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>$ 30.000.000</span>
                  <span>$ 250.000.000</span>
                </div>
              </div>

              {/* Cuota Inicial */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Cuota inicial ({downPaymentPercent}%)
                  </label>
                  <span className="text-base sm:text-lg font-bold text-white tabular-nums">
                    $ {downPayment.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {percentOptions.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDownPaymentPercent(pct)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        downPaymentPercent === pct
                          ? 'bg-[#00C896] text-slate-950 shadow-md'
                          : 'bg-[#18212b] text-slate-300 hover:text-white'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Monto neto a financiar por el banco:{' '}
                  <span className="text-white font-semibold">
                    $ {loanPrincipal.toLocaleString('es-CO')}
                  </span>
                </p>
              </div>

              {/* Plazo en meses */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Plazo en meses
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {termOptions.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setTermMonths(term)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        termMonths === term
                          ? 'bg-[#00C896] text-slate-950 shadow-md'
                          : 'bg-[#18212b] text-slate-300 hover:text-white border border-[#26313d]'
                      }`}
                    >
                      {term} meses
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Right Box */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#16222b] to-[#0f171e] p-6 sm:p-8 rounded-2xl border border-[#2b394a] shadow-xl text-center space-y-5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00C896]">
                Resultado Estimado
              </span>
              <div>
                <p className="text-xs text-slate-400 mb-1">Cuota mensual aproximada:</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight tabular-nums">
                  $ {monthlyPayment.toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-slate-400 mt-1">/ mes por {termMonths} cuotas</p>
              </div>

              <div className="pt-4 border-t border-slate-700/60 space-y-2 text-left text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Monto solicitado:</span>
                  <span className="font-semibold text-white">
                    $ {loanPrincipal.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tasa estimada referencial:</span>
                  <span className="font-semibold text-[#00C896]">Desde 1.28% MV (~16.5% EA)</span>
                </div>
              </div>

              <button
                onClick={handleWhatsAppCredit}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Solicitar este crédito en línea</span>
              </button>

              {/* Mandatory Legal Disclaimers from PDF Page 6 */}
              <div className="text-[10px] text-slate-400 leading-normal text-left space-y-1">
                <p>
                  * El valor es referencial. El monto aprobado y la tasa dependen del análisis crediticio de la entidad financiera. No incluye seguros.
                </p>
                <p>
                  * Los seguros y la garantía mecánica de caja y motor son servicios opcionales con costo adicional; ver sección "Seguros y garantía mecánica".
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Entidades bancarias aliadas (Page 6) */}
        <div className="p-8 rounded-3xl bg-[#11161d] border border-[#212b37] space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#00C896] uppercase tracking-wider mb-1">
              <Landmark className="w-4 h-4" />
              <span>Red Bancaria Aliada</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Entidades bancarias aliadas
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Radicamos tu solicitud simultáneamente para lograr la tasa más baja y mayor viabilidad de aprobación.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {COMPANY_INFO.banks.map((bank) => (
              <div
                key={bank.name}
                className="p-4 rounded-xl bg-[#0b0e12] border border-[#1f2834] text-center flex flex-col justify-center items-center"
              >
                <p className="text-sm font-bold text-white">{bank.name}</p>
                <span className="text-[11px] text-slate-400 mt-1">{bank.category}</span>
              </div>
            ))}
          </div>

          {/* Davivienda notice from PDF */}
          <p className="text-xs text-amber-400/90 italic">
            * Trabajamos con todos los bancos excepto Davivienda.
          </p>
        </div>

        {/* Seguros y garantía mecánica (servicios opcionales) — Dos tarjetas lado a lado (PDF Page 6 & 7) */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Seguros y garantía mecánica <span className="text-slate-400 font-normal text-lg">(servicios opcionales)</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Servicios complementarios para que ruedes con total tranquilidad desde el primer día.
            </p>
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C896]">
                      Tarjeta 1 — Seguros
                    </span>
                    <h3 className="text-lg font-bold text-white leading-snug">
                      Cotiza tu seguro con nuestras aseguradoras aliadas (cotización comparativa sin costo)
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  Al comprar tu vehículo puedes cotizar tu seguro (todo riesgo, SOAT y otros) con las aseguradoras con las que Autos QP tiene alianza, para que salgas con todo resuelto.
                </p>

                {/* Logos / listado de aseguradoras */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Aseguradoras aliadas:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COMPANY_INFO.insurers.map((ins) => (
                      <div
                        key={ins.name}
                        className="px-2.5 py-1.5 rounded-md bg-[#0b0e12] border border-[#222b36] text-[11px] font-medium text-slate-300 text-center"
                      >
                        {ins.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleWhatsAppInsurance}
                className="w-full py-3 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Cotizar mi seguro → WhatsApp</span>
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C896]">
                      Tarjeta 2 — Garantía Opcional
                    </span>
                    <h3 className="text-lg font-bold text-white leading-snug">
                      Garantía opcional de caja y motor
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  Si lo deseas, puedes solicitar una garantía mecánica de caja y motor para vehículos de modelo menor a 10 años. Es un valor agregado con costo adicional a cargo del cliente, y es otorgada por una empresa aliada, no por Autos QP.
                </p>

                {/* Pre-defined message reminder */}
                <div className="p-3 rounded-lg bg-[#0c1015] border border-slate-800 text-xs text-slate-400">
                  <p className="text-[11px] font-semibold text-slate-300 mb-1">
                    Mensaje predefinido de WhatsApp:
                  </p>
                  <p className="italic text-[#00C896]">
                    "Hola, quiero información sobre la garantía opcional de caja y motor"
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleWhatsAppWarranty}
                  className="w-full py-3 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Preguntar por la garantía → WhatsApp</span>
                </button>

                {/* MANDATORY LEGAL NOTICE VISIBLE AND READABLE UNDER CARD AS SPECIFIED IN PDF */}
                <div className="p-3 rounded-lg bg-[#0e1217] border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-300 block mb-0.5">AVISO LEGAL OBLIGATORIO:</span>
                  <p>{COMPANY_INFO.warrantyLegalFull}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ¿Cómo funciona? — Proceso en 4 pasos (PDF Page 7) */}
        <div className="p-8 sm:p-10 rounded-3xl bg-[#11161d] border border-[#212b37] space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              ¿Cómo funciona? — <span className="text-[#00C896]">Proceso en 4 pasos</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Acompañamiento personalizado desde el primer contacto hasta que estrenas
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((st) => (
              <div
                key={st.step}
                className="p-5 rounded-2xl bg-[#0b0e12] border border-[#1f2834] relative space-y-3"
              >
                <div className="text-3xl font-black text-[#00C896]/30 font-mono">
                  {st.step}
                </div>
                <h3 className="text-base font-bold text-white">
                  {st.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {st.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Llamado a la acción (Page 7) */}
          <div className="text-center pt-6 space-y-3">
            <button
              onClick={handleWhatsAppCredit}
              className="px-8 py-3.5 text-sm sm:text-base font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] rounded-md transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer inline-flex items-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Completar solicitud de crédito →</span>
            </button>
            <p className="text-xs text-slate-400 italic">
              Nuestros asesores responden en minutos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
