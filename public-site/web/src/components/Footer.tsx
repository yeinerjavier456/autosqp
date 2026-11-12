import { webText } from "../content";
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
    pending.current = true;
    setSending(true);
    setError('');
    try {
      await sendContact({
        name: 'Suscripción web',
        email: newsletterEmail,
        subject: 'Suscripción al boletín',
        message: 'Solicito recibir novedades de Autos QP en este correo.'
      }, requestId.current);
      setNewsletterSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar la solicitud.');
    } finally {
      pending.current = false;
      setSending(false);
    }
  };
  const navLinks: {
    label: string;
    tab: PageTab;
  }[] = [{
    label: webText("Footer.fd58ea06eb60", "Inicio"),
    tab: 'inicio'
  }, {
    label: webText("Footer.c2fc94c262a6", "Inventario"),
    tab: 'inventario'
  }, {
    label: webText("Footer.9bebd8cada05", "Financiamiento"),
    tab: 'financiamiento'
  }, {
    label: webText("Footer.fb816fe7e3d2", "Reactivaci\xF3n Financiera"),
    tab: 'reactivacion-financiera'
  }, {
    label: webText("Footer.6e68cf5276e9", "Nosotros"),
    tab: 'nosotros'
  }, {
    label: webText("Footer.14fe6d341989", "Contacto"),
    tab: 'contacto'
  }, {
    label: webText("Footer.8f2328048ca7", "Preguntas Frecuentes"),
    tab: 'faq'
  }];
  return <footer className="bg-[#090b0e] text-slate-300 border-t border-[#1b222b]">
      {/* Newsletter Strip from Page 13 specifications */}
      <div className="border-b border-slate-800/80 bg-[#0d1014]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center lg:text-left">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">{webText("Footer.317486a1445e", "Bolet\xEDn de novedades y ofertas exclusivas")}</h3>
              <p className="text-xs sm:text-sm text-slate-400">{webText("Footer.161f958d0818", "Recibe semanalmente los nuevos ingresos en vitrina antes de que se publiquen en redes.")}</p>
            </div>

            {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
            {newsletterSent ? <div className="flex items-center gap-2 text-xs sm:text-sm text-[#00C896] bg-[#00C896]/10 px-4 py-2.5 rounded-xl border border-[#00C896]/30">
                <CheckCircle2 className="w-4 h-4" />
                <span>{webText("Footer.ddd7bebe3b56", "\xA1Gracias por suscribirte al bolet\xEDn de Autos QP!")}</span>
              </div> : <form onSubmit={handleNewsletterSubmit} className="flex w-full sm:w-auto items-center gap-2 max-w-md">
                <input type="email" required placeholder={webText("Footer.847f4d72a545", "Tu correo electr\xF3nico")} value={newsletterEmail} onChange={e => setNewsletterEmail(e.target.value)} className="bg-[#12171e] border border-[#232c37] text-xs sm:text-sm text-white rounded-lg px-3.5 py-2.5 focus:border-[#00C896] focus:outline-none placeholder:text-slate-500 w-full sm:w-72" />
                <button type="submit" disabled={sending} className="px-4 py-2.5 bg-[#00C896] hover:bg-[#00B486] text-slate-950 font-bold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? webText("Footer.419ff2162118", "Enviando\u2026") : webText("Footer.fe111fceedf2", "Suscribirme")}</span>
                </button>
              </form>}
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Col 1: Brand & Slogan */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-baseline">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{webText("Footer.48df5b18cbf7", "Autos")}</span>
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#00C896] ml-0.5">{webText("Footer.0e97614e3af8", "QP")}</span>
            </div>

            <p className="text-sm text-[#00C896] font-semibold">
              {COMPANY_INFO.slogan}
            </p>

            <p className="text-xs text-slate-400 leading-relaxed">{webText("Footer.6a4b37b8dd53", "Calidad y confianza en cada kil\xF3metro. Concesionario l\xEDder en compra, venta, financiamiento y reactivaci\xF3n crediticia vehicular en Bogot\xE1.")}</p>

            <div className="pt-2 text-xs text-slate-400 space-y-1">
              <p><strong className="text-slate-300">{webText("Footer.33c9fd3c123a", "Raz\xF3n social:")}</strong> {COMPANY_INFO.name}</p>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="lg:col-span-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white">{webText("Footer.98a46afde5c8", "Enlaces r\xE1pidos")}</p>
            <ul className="space-y-2 text-xs sm:text-sm">
              {navLinks.map(item => <li key={item.tab}>
                  <button onClick={() => {
                onSelectTab(item.tab);
                window.scrollTo({
                  top: 0,
                  behavior: 'smooth'
                });
              }} className="hover:text-[#00C896] transition-colors cursor-pointer text-left">
                    {item.label}
                  </button>
                </li>)}
              <li>
                <button onClick={onOpenSellModal} className="text-[#00C896] hover:underline transition-colors cursor-pointer">{webText("Footer.2085577735cb", "\xBFQuieres vender tu auto?")}</button>
              </li>
              {onOpenAdmin && <li>
                  <button onClick={onOpenAdmin} className="text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5">
                    <span>{webText("Footer.fca2519212cb", "Ingresar al CRM")}</span>
                  </button>
                </li>}
            </ul>
          </div>

          {/* Col 3: Contact details */}
          <div className="lg:col-span-3 space-y-3 text-xs">
            <p className="text-xs font-bold uppercase tracking-wider text-white">{webText("Footer.296a90c84597", "Contacto y vitrina")}</p>

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
            <p className="text-xs font-bold uppercase tracking-wider text-white">{webText("Footer.661b55fb6707", "S\xEDguenos")}</p>
            <SocialLinks />
          </div>
        </div>

        {/* Bottom Bar & Legal Links */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>{"\xA9 "}{new Date().getFullYear()} {COMPANY_INFO.name}{webText("Footer.25901fcdee39", ". Todos los derechos reservados.")}</p>

          <div className="flex items-center gap-4">
            <button onClick={() => onOpenLegal('privacy')} className="hover:text-slate-300 transition-colors cursor-pointer">{webText("Footer.bb9a4e09b4cc", "Pol\xEDtica de privacidad")}</button>
            <span aria-hidden="true">{"\xB7"}</span>
            <button onClick={() => onOpenLegal('data')} className="hover:text-slate-300 transition-colors cursor-pointer">{webText("Footer.3578c8757539", "Tratamiento de datos personales (Ley 1581 de 2012)")}</button>
          </div>
        </div>
      </div>
    </footer>;
};
