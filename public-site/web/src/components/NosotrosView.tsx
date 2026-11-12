import React from 'react';
import { ShieldCheck, HeartHandshake, CheckCircle2, Award, Calendar } from 'lucide-react';
import { SocialLinks } from './SocialLinks';

export const NosotrosView: React.FC = () => {
  const values = [
    {
      title: 'Transparencia',
      desc: 'Información clara y honesta en cada negocio, sin costos ocultos ni letras pequeñas.',
      icon: ShieldCheck
    },
    {
      title: 'Acompañamiento real',
      desc: 'Estamos contigo desde la búsqueda inicial hasta el traspaso y entrega de llaves.',
      icon: HeartHandshake
    },
    {
      title: 'Calidad verificada',
      desc: 'Todos nuestros vehículos son inspeccionados técnicamente y son 100% asegurables.',
      icon: CheckCircle2
    },
    {
      title: 'Compromiso',
      desc: 'Tu movilidad, tranquilidad y bienestar familiar son nuestra máxima prioridad diaria.',
      icon: Award
    }
  ];

  const services = [
    'Venta de vehículos usados multimarca',
    'Compra de vehículos — te pagamos a precio justo',
    'Consignación — vendemos tu carro por ti',
    'Financiamiento con todos los bancos del país',
    'Reactivación Financiera — consultoría especializada',
    'Seguros y garantía mecánica opcional (caja y motor) — con empresas aliadas',
    'Ferias de vehículos — eventos especiales durante el año'
  ];

  return (
    <div className="py-12 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header from PDF Page 9 */}
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">
            Trayectoria y Compromiso
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Somos <span className="text-[#00C896]">Autos QP</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Somos un concesionario de vehículos usados ubicado en Bogotá, Colombia, con más de 5 años ayudando a colombianos a moverse con confianza. Nacimos con el propósito de hacer la compra y venta de vehículos un proceso transparente, seguro y sin complicaciones.
          </p>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Operamos en el C.C. Outlet Factory de la Avenida de las Américas y contamos con un equipo de asesores comerciales y expertos en crédito listos para acompañarte en cada etapa del proceso.
          </p>
        </div>

        {/* 4 Core Values */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Nuestros <span className="text-[#00C896]">valores</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((val, idx) => {
              const Icon = val.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#11161d] border border-[#212b37] hover:border-[#00C896]/50 transition-colors space-y-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#00C896]/10 text-[#00C896] flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {val.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {val.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Nuestros Servicios & Ferias Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Services List */}
          <div className="lg:col-span-7 bg-[#11161d] border border-[#212b37] rounded-3xl p-6 sm:p-8 space-y-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Nuestros <span className="text-[#00C896]">servicios</span>
            </h2>
            <div className="space-y-3">
              {services.map((srv, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#0b0e12] border border-[#1f2834]"
                >
                  <span className="w-2 h-2 rounded-full bg-[#00C896] shrink-0" />
                  <span className="text-sm font-medium text-slate-200">{srv}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Presencia en Ferias */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#121921] to-[#0c1015] border border-[#232d3a] rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#00C896] uppercase tracking-wider">
              <Calendar className="w-4 h-4" />
              <span>Eventos del Sector</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Presencia en ferias automotrices
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Autos QP participa activamente en ferias automotrices en Bogotá. Durante estos eventos podrás encontrar ofertas exclusivas, vehículos adicionales y atención personalizada de nuestro equipo. Mantente pendiente de nuestras redes sociales para enterarte de los próximos eventos.
            </p>
            <div className="p-4 rounded-xl bg-[#16202b] border border-slate-700/80 text-xs text-slate-300 space-y-1">
              <span className="text-white font-bold block">Próxima Edición Especial:</span>
              <p>Feria Usados Outlet Factory · Vitrina central en Bogotá con bonos de retoma y pre-aprobación en el acto.</p>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-[#222c38] bg-[#0b0e12] p-6 sm:p-8 space-y-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#00C896]">Nuestras redes</p>
            <h2 className="text-2xl font-bold text-white">Conecta con Autos QP</h2>
            <p className="mt-2 text-sm text-slate-400">Conoce nuestros vehículos, novedades y consejos. Cada perfil se abre en una pestaña nueva.</p>
          </div>
          <SocialLinks includeWhatsApp={false} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" />
        </section>
      </div>
    </div>
  );
};
