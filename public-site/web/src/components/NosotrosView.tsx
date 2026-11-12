import { webText } from "../content";
import React from 'react';
import { ShieldCheck, HeartHandshake, CheckCircle2, Award, Calendar } from 'lucide-react';
import { SocialLinks } from './SocialLinks';
export const NosotrosView: React.FC = () => {
  const values = [{
    title: webText("NosotrosView.70f4eedf8183", "Transparencia"),
    desc: webText("NosotrosView.3bff69e88255", "Informaci\xF3n clara y honesta en cada negocio, sin costos ocultos ni letras peque\xF1as."),
    icon: ShieldCheck
  }, {
    title: webText("NosotrosView.1e3d91093911", "Acompa\xF1amiento real"),
    desc: webText("NosotrosView.bda91c3a93ac", "Estamos contigo desde la b\xFAsqueda inicial hasta el traspaso y entrega de llaves."),
    icon: HeartHandshake
  }, {
    title: webText("NosotrosView.b3432bf53266", "Calidad verificada"),
    desc: webText("NosotrosView.535c8d8620b6", "Todos nuestros veh\xEDculos son inspeccionados t\xE9cnicamente y son 100% asegurables."),
    icon: CheckCircle2
  }, {
    title: webText("NosotrosView.dd611062cc2f", "Compromiso"),
    desc: webText("NosotrosView.d0a806e77e77", "Tu movilidad, tranquilidad y bienestar familiar son nuestra m\xE1xima prioridad diaria."),
    icon: Award
  }];
  const services = [webText("NosotrosView.e2aae0c37286", "Venta de veh\xEDculos usados multimarca"), webText("NosotrosView.2216e94abb28", "Compra de veh\xEDculos \u2014 te pagamos a precio justo"), webText("NosotrosView.b50d827015de", "Consignaci\xF3n \u2014 vendemos tu carro por ti"), webText("NosotrosView.97ac5107bf2d", "Financiamiento con todos los bancos del pa\xEDs"), webText("NosotrosView.1d15cb8f6a7d", "Reactivaci\xF3n Financiera \u2014 consultor\xEDa especializada"), webText("NosotrosView.4a96d1994203", "Seguros y garant\xEDa mec\xE1nica opcional (caja y motor) \u2014 con empresas aliadas"), webText("NosotrosView.9503519b974b", "Ferias de veh\xEDculos \u2014 eventos especiales durante el a\xF1o")];
  return <div className="py-12 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header from PDF Page 9 */}
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">{webText("NosotrosView.5ca39a272da2", "Trayectoria y Compromiso")}</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">{webText("NosotrosView.e541318536c6", "Somos ")}<span className="text-[#00C896]">{webText("NosotrosView.065000a20af8", "Autos QP")}</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">{webText("NosotrosView.22b68afb02c3", "Somos un concesionario de veh\xEDculos usados ubicado en Bogot\xE1, Colombia, con m\xE1s de 5 a\xF1os ayudando a colombianos a moverse con confianza. Nacimos con el prop\xF3sito de hacer la compra y venta de veh\xEDculos un proceso transparente, seguro y sin complicaciones.")}</p>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">{webText("NosotrosView.4e0ae4d144ec", "Operamos en el C.C. Outlet Factory de la Avenida de las Am\xE9ricas y contamos con un equipo de asesores comerciales y expertos en cr\xE9dito listos para acompa\xF1arte en cada etapa del proceso.")}</p>
        </div>

        {/* 4 Core Values */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">{webText("NosotrosView.c34e7623a5c1", "Nuestros ")}<span className="text-[#00C896]">{webText("NosotrosView.c1a18f8fab88", "valores")}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((val, idx) => {
            const Icon = val.icon;
            return <div key={idx} className="p-6 rounded-2xl bg-[#11161d] border border-[#212b37] hover:border-[#00C896]/50 transition-colors space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#00C896]/10 text-[#00C896] flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {val.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {val.desc}
                  </p>
                </div>;
          })}
          </div>
        </div>

        {/* Nuestros Servicios & Ferias Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Services List */}
          <div className="lg:col-span-7 bg-[#11161d] border border-[#212b37] rounded-3xl p-6 sm:p-8 space-y-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">{webText("NosotrosView.c34e7623a5c1.2", "Nuestros ")}<span className="text-[#00C896]">{webText("NosotrosView.c3c66e142192", "servicios")}</span>
            </h2>
            <div className="space-y-3">
              {services.map((srv, index) => <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-[#0b0e12] border border-[#1f2834]">
                  <span className="w-2 h-2 rounded-full bg-[#00C896] shrink-0" />
                  <span className="text-sm font-medium text-slate-200">{srv}</span>
                </div>)}
            </div>
          </div>

          {/* Presencia en Ferias */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#121921] to-[#0c1015] border border-[#232d3a] rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#00C896] uppercase tracking-wider">
              <Calendar className="w-4 h-4" />
              <span>{webText("NosotrosView.fe90ba798e83", "Eventos del Sector")}</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">{webText("NosotrosView.a36174adb6c8", "Presencia en ferias automotrices")}</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{webText("NosotrosView.a5dfc10c328f", "Autos QP participa activamente en ferias automotrices en Bogot\xE1. Durante estos eventos podr\xE1s encontrar ofertas exclusivas, veh\xEDculos adicionales y atenci\xF3n personalizada de nuestro equipo. Mantente pendiente de nuestras redes sociales para enterarte de los pr\xF3ximos eventos.")}</p>
            <div className="p-4 rounded-xl bg-[#16202b] border border-slate-700/80 text-xs text-slate-300 space-y-1">
              <span className="text-white font-bold block">{webText("NosotrosView.b2ef877910db", "Pr\xF3xima Edici\xF3n Especial:")}</span>
              <p>{webText("NosotrosView.13365438e9c8", "Feria Usados Outlet Factory \xB7 Vitrina central en Bogot\xE1 con bonos de retoma y pre-aprobaci\xF3n en el acto.")}</p>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-[#222c38] bg-[#0b0e12] p-6 sm:p-8 space-y-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#00C896]">{webText("NosotrosView.15915e618cad", "Nuestras redes")}</p>
            <h2 className="text-2xl font-bold text-white">{webText("NosotrosView.d40b408c0a03", "Conecta con Autos QP")}</h2>
            <p className="mt-2 text-sm text-slate-400">{webText("NosotrosView.641d2f3a7b0d", "Conoce nuestros veh\xEDculos, novedades y consejos. Cada perfil se abre en una pesta\xF1a nueva.")}</p>
          </div>
          <SocialLinks includeWhatsApp={false} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" />
        </section>
      </div>
    </div>;
};
