import React, { useState, useRef } from 'react';
import { sendContact } from '../contact';
import { PageTab } from '../types';
import { COMPANY_INFO } from '../data/company';
import { SocialLinks } from './SocialLinks';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';

interface FooterProps {
  onSelectTab: (tab: PageTab) => void;
  onOpenLegal: (type: 'privacy' | 'data') => void;
  onOpenSellModal: () => void;
  onOpenAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectTab,
  onOpenLegal,
  onOpenSellModal,
  onOpenAdmin
}) => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSent, setNewsletterSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const requestId = useRef(crypto.randomUUID());

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true; setSending(true); setError('');
    try {
      await sendContact({ name: 'Suscripción web', email: newsletterEmail, subject: 'Suscripción al boletín', message: 'Solicito recibir novedades de Autos QP en este correo.' }, requestId.current);
      setNewsletterSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible registrar la solicitud.'); }
    finally { pending.current = false; setSending(false); }
  };

  const navLinks: { label: string; tab: PageTab }[] = [
    { label: 'Inicio', tab: 'inicio' },
    { label: 'Inventario', tab: 'inventario' },
    { label: 'Financiamiento', tab: 'financiamiento' },
    { label: 'Reactivación Financiera', tab: 'reactivacion-financiera' },
    { label: 'Nosotros', tab: 'nosotros' },
    { label: 'Contacto', tab: 'contacto' },
    { label: 'Preguntas Frecuentes', tab: 'faq' }
  ];

  return (
    <footer className="bg-[#090b0e] text-slate-300 border-t border-[#1b222b]">
      {/* Newsletter Strip from Page 13 specifications */}
      <div className="border-b border-slate-800/80 bg-[#0d1014]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center lg:text-left">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Boletín de novedades y ofertas exclusivas
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Recibe semanalmente los nuevos ingresos en vitrina antes de que se publiquen en redes.
              </p>
            </div>

            {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
            {newsletterSent ? (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-[#00C896] bg-[#00C896]/10 px-4 py-2.5 rounded-xl border border-[#00C896]/30">
                <CheckCircle2 className="w-4 h-4" />
                <span>¡Gracias por suscribirte al boletín de Autos QP!</span>
              </div>
            ) : (
              <form
                onSubmit={handleNewsletterSubmit}
                className="flex w-full sm:w-auto items-center gap-2 max-w-md"
              >
                <input
                  type="email"
                  required
                  placeholder="Tu correo electrónico"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="bg-[#12171e] border border-[#232c37] text-xs sm:text-sm text-white rounded-lg px-3.5 py-2.5 focus:border-[#00C896] focus:outline-none placeholder:text-slate-500 w-full sm:w-72"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="px-4 py-2.5 bg-[#00C896] hover:bg-[#00B486] text-slate-950 font-bold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Enviando…' : 'Suscribirme'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Col 1: Brand & Slogan */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-baseline">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Autos
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#00C896] ml-0.5">
                QP
              </span>
            </div>

            <p className="text-sm text-[#00C896] font-semibold">
              {COMPANY_INFO.slogan}
            </p>

            <p className="text-xs text-slate-400 leading-relaxed">
              Calidad y confianza en cada kilómetro. Concesionario líder en compra, venta, financiamiento y reactivación crediticia vehicular en Bogotá.
            </p>

            <div className="pt-2 text-xs text-slate-400 space-y-1">
              <p><strong className="text-slate-300">Razón social:</strong> {COMPANY_INFO.name}</p>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="lg:col-span-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white">
              Enlaces rápidos
            </p>
            <ul className="space-y-2 text-xs sm:text-sm">
              {navLinks.map((item) => (
                <li key={item.tab}>
                  <button
                    onClick={() => {
                      onSelectTab(item.tab);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#00C896] transition-colors cursor-pointer text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={onOpenSellModal}
                  className="text-[#00C896] hover:underline transition-colors cursor-pointer"
                >
                  ¿Quieres vender tu auto?
                </button>
              </li>
              {onOpenAdmin && (
                <li>
                  <button
                    onClick={onOpenAdmin}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Ingresar al CRM</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Col 3: Contact details */}
          <div className="lg:col-span-3 space-y-3 text-xs">
            <p className="text-xs font-bold uppercase tracking-wider text-white">
              Contacto y vitrina
            </p>

            <div className="space-y-2.5 text-slate-300">
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-[#00C896] shrink-0 mt-0.5" />
                <div>
                  <a href={`tel:${COMPANY_INFO.phone1Raw}`} className="hover:text-white block">
                    {COMPANY_INFO.phone1}
                  </a>
                  <a href={`tel:${COMPANY_INFO.phone2Raw}`} className="hover:text-white block">
                    {COMPANY_INFO.phone2}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#00C896] shrink-0" />
                <a href={`mailto:${COMPANY_INFO.email}`} className="hover:text-white truncate">
                  {COMPANY_INFO.email}
                </a>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#00C896] shrink-0 mt-0.5" />
                <span>{COMPANY_INFO.address}</span>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#00C896] shrink-0 mt-0.5" />
                <div>
                  <p>{COMPANY_INFO.scheduleWeekday}</p>
                  <p>{COMPANY_INFO.scheduleWeekend}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Col 4: Social Networks */}
          <div className="lg:col-span-2 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white">
              Síguenos
            </p>
            <SocialLinks />
          </div>
        </div>

        {/* Bottom Bar & Legal Links */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} {COMPANY_INFO.name}. Todos los derechos reservados.
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Política de privacidad
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => onOpenLegal('data')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Tratamiento de datos personales (Ley 1581 de 2012)
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
