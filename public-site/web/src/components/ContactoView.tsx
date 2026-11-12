import { webText } from "../content";
import React, { useState, useRef } from 'react';
import { COMPANY_INFO } from '../data/company';
import { openChat } from '../chat';
import { sendContact } from '../contact';
import { Phone, Mail, MapPin, Clock, MessageSquare, Send, CheckCircle, ExternalLink } from 'lucide-react';
export const ContactoView: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: 'Comprar vehículo',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const request = useRef({
    id: '',
    fingerprint: ''
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError('');
    const fingerprint = JSON.stringify(formData);
    if (fingerprint !== request.current.fingerprint) request.current = {
      id: crypto.randomUUID(),
      fingerprint
    };
    try {
      await sendContact(formData, request.current.id);
      setSubmitted(true);
      request.current = {
        id: '',
        fingerprint: ''
      };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar el mensaje.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };
  const handleSendViaWhatsApp = () => {
    const text = `Hola Autos QP, te contacto desde la web oficial.\nNombre: ${formData.name}\nTeléfono: ${formData.phone}\nEmail: ${formData.email}\nMotivo: ${formData.subject}\nMensaje: ${formData.message}`;
    openChat();
  };
  return <div className="py-12 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header from PDF Page 10 */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">{webText("ContactoView.e01f0954c378", "Canales de Atenci\xF3n Directa")}</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">{webText("ContactoView.279b101d711e", "\xA1Hablemos!")}</h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">{webText("ContactoView.fd9bdb19de6d", "Estamos listos para ayudarte. Escr\xEDbenos, ll\xE1manos o vis\xEDtanos en nuestra vitrina en Bogot\xE1.")}</p>
        </div>

        {/* Contact Info & Interactive Form Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Contact Data */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-[#11161d] border border-[#212b37] space-y-6">
              <h2 className="text-xl font-bold text-white tracking-tight">{webText("ContactoView.2f69f2bf73e4", "Datos de contacto")}</h2>

              <div className="space-y-5">
                {/* Phones */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#00C896]/10 text-[#00C896] flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{webText("ContactoView.03879547326b", "L\xEDneas de atenci\xF3n / WhatsApp")}</p>
                    <div className="mt-1 space-y-0.5">
                      <a href={`tel:${COMPANY_INFO.phone1Raw}`} className="text-sm sm:text-base font-bold text-white hover:text-[#00C896] transition-colors block">
                        {COMPANY_INFO.phone1}
                      </a>
                      <a href={`tel:${COMPANY_INFO.phone2Raw}`} className="text-sm sm:text-base font-bold text-white hover:text-[#00C896] transition-colors block">
                        {COMPANY_INFO.phone2}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#00C896]/10 text-[#00C896] flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{webText("ContactoView.eb38acee1007", "Correo electr\xF3nico")}</p>
                    <a href={`mailto:${COMPANY_INFO.email}`} className="text-sm sm:text-base font-semibold text-slate-200 hover:text-[#00C896] transition-colors">
                      {COMPANY_INFO.email}
                    </a>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#00C896]/10 text-[#00C896] flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{webText("ContactoView.c3fd64bf07e8", "Direcci\xF3n vitrina f\xEDsica")}</p>
                    <p className="text-sm text-slate-200 leading-snug mt-1">
                      {COMPANY_INFO.address}
                    </p>
                    <span className="text-xs text-[#00C896] font-semibold block mt-0.5">{webText("ContactoView.5cd67d36237a", "Local 128 \xB7 Bogot\xE1, Colombia")}</span>
                  </div>
                </div>

                {/* Schedule */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#00C896]/10 text-[#00C896] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{webText("ContactoView.0886f3e327f2", "Horario de atenci\xF3n")}</p>
                    <p className="text-xs text-slate-300 mt-1">{COMPANY_INFO.scheduleWeekday}</p>
                    <p className="text-xs text-slate-300">{COMPANY_INFO.scheduleWeekend}</p>
                  </div>
                </div>
              </div>

              {/* Direct WhatsApp Callout */}
              <div className="pt-4 border-t border-slate-800">
                <button type="button" onClick={() => openChat()} className="w-full py-3 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-colors flex items-center justify-center gap-2 text-sm shadow-md">
                  <MessageSquare className="w-4 h-4" />
                  <span>{webText("ContactoView.00894c12978f", "Chatea con nosotros")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7 bg-[#11161d] border border-[#212b37] rounded-3xl p-6 sm:p-10 shadow-2xl">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">{webText("ContactoView.e94d5e6595a1", "Env\xEDanos un mensaje")}</h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-6">{webText("ContactoView.397236e6295c", "Te responderemos en minutos en horario h\xE1bil para resolver todas tus inquietudes.")}</p>

            {error && <p role="alert" className="mb-4 text-sm text-rose-300">{error}</p>}
            {submitted ? <div className="p-8 rounded-2xl bg-[#0b1411] border border-[#00C896]/40 text-center space-y-4 animate-in fade-in">
                <CheckCircle className="w-14 h-14 text-[#00C896] mx-auto" />
                <h3 className="text-xl font-bold text-white">{webText("ContactoView.a37b9651e5c9", "\xA1Mensaje recibido con \xE9xito!")}</h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto">{webText("ContactoView.33eeb4375c5e", "Gracias por comunicarte con Autos QP S.A.S. Un asesor comercial revisar\xE1 tu solicitud para responderte a la brevedad.")}</p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button onClick={handleSendViaWhatsApp} className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#00C896] text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer">
                    <MessageSquare className="w-4 h-4" />
                    <span>{webText("ContactoView.00894c12978f.2", "Chatea con nosotros")}</span>
                  </button>
                  <button onClick={() => {
                setSubmitted(false);
                setFormData({
                  name: '',
                  phone: '',
                  email: '',
                  subject: 'Comprar vehículo',
                  message: ''
                });
              }} className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-medium text-xs sm:text-sm cursor-pointer">{webText("ContactoView.42e4759eff92", "Enviar otro mensaje")}</button>
                </div>
              </div> : <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">{webText("ContactoView.6bf5b2b344d9", "Nombre completo *")}</label>
                    <input type="text" required placeholder={webText("ContactoView.7ca21953ba25", "Tu nombre y apellidos")} value={formData.name} onChange={e => setFormData({
                  ...formData,
                  name: e.target.value
                })} className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">{webText("ContactoView.f81fe9ae085d", "Tel\xE9fono / WhatsApp *")}</label>
                    <input type="tel" required placeholder={webText("ContactoView.7e1bb4cfc519", "Ej. 300 252 3226")} value={formData.phone} onChange={e => setFormData({
                  ...formData,
                  phone: e.target.value
                })} className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">{webText("ContactoView.16c4a7726e59", "Correo electr\xF3nico *")}</label>
                    <input type="email" required placeholder={webText("ContactoView.f28491470563", "ejemplo@correo.com")} value={formData.email} onChange={e => setFormData({
                  ...formData,
                  email: e.target.value
                })} className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none" />
                  </div>

                  {/* Dropdown with all PDF categories */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">{webText("ContactoView.231e7b700f13", "\xBFEn qu\xE9 podemos ayudarte? *")}</label>
                    <select value={formData.subject} onChange={e => setFormData({
                  ...formData,
                  subject: e.target.value
                })} className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none">
                      <option value="Comprar vehículo">{webText("ContactoView.112aae7940db", "Comprar veh\xEDculo")}</option>
                      <option value="Vender mi vehículo">{webText("ContactoView.4d957bd2740e", "Vender mi veh\xEDculo")}</option>
                      <option value="Financiamiento">{webText("ContactoView.9bebd8cada05", "Financiamiento")}</option>
                      <option value="Reactivación Financiera">{webText("ContactoView.fb816fe7e3d2", "Reactivaci\xF3n Financiera")}</option>
                      <option value="Seguros">{webText("ContactoView.ee66fca3234d", "Seguros")}</option>
                      <option value="Garantía opcional">{webText("ContactoView.0e3efd906645", "Garant\xEDa opcional")}</option>
                      <option value="Otro">{webText("ContactoView.332c333b441a", "Otro")}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">{webText("ContactoView.a8c3e4743006", "Mensaje *")}</label>
                  <textarea rows={4} required placeholder={webText("ContactoView.63e4bd2dd9a2", "Escribe aqu\xED tu consulta o el veh\xEDculo por el que est\xE1s interesado...")} value={formData.message} onChange={e => setFormData({
                ...formData,
                message: e.target.value
              })} className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none resize-none" />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <button type="submit" disabled={sending} className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer flex items-center justify-center gap-2 text-sm">
                    <Send className="w-4 h-4" />
                    <span>{sending ? webText("ContactoView.cee440c48b32", "Enviando mensaje\u2026") : webText("ContactoView.7618b64366ea", "Enviar consulta")}</span>
                  </button>

                  <span className="text-[11px] text-slate-400">{webText("ContactoView.2f9ea94fb506", "Env\xEDo directo al equipo de ")}<strong className="text-slate-300">{webText("ContactoView.065000a20af8", "Autos QP")}</strong>
                  </span>
                </div>
              </form>}
          </div>
        </div>

        {/* Mapa Google Maps embebido (PDF Page 10) */}
        <div className="p-8 rounded-3xl bg-[#11161d] border border-[#212b37] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#00C896]" />
                <span>{webText("ContactoView.2c33ebf20b03", "Nuestra ubicaci\xF3n en Bogot\xE1")}</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {COMPANY_INFO.address}
              </p>
            </div>
            <a href="https://maps.google.com/?q=Centro+Comercial+Outlet+Factory+Bogota" target="_blank" rel="noopener noreferrer" className="text-xs text-[#00C896] hover:underline flex items-center gap-1 font-semibold">
              <span>{webText("ContactoView.10aee890d90d", "Abrir en Google Maps")}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-[#263240] relative">
            <iframe title={webText("ContactoView.4c43b31c3fd9", "Ubicaci\xF3n Autos QP C.C. Outlet Factory Bogot\xE1")} src="https://maps.google.com/maps?q=Centro%20Comercial%20Outlet%20Factory%2C%20Avenida%20de%20las%20Am%C3%A9ricas%2062-84%2C%20Bogot%C3%A1&t=&z=16&ie=UTF8&iwloc=&output=embed" className="w-full h-full border-0 filter invert contrast-125 opacity-90 hover:opacity-100 transition-opacity" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </div>
      </div>
    </div>;
};
