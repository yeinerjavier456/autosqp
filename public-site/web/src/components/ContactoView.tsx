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
  const request = useRef({ id: '', fingerprint: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setSending(true); setError('');
    const fingerprint = JSON.stringify(formData);
    if (fingerprint !== request.current.fingerprint) request.current = { id: crypto.randomUUID(), fingerprint };
    try {
      await sendContact(formData, request.current.id);
      setSubmitted(true);
      request.current = { id: '', fingerprint: '' };
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar el mensaje.'); }
    finally { inFlight.current = false; setSending(false); }
  };

  const handleSendViaWhatsApp = () => {
    const text = `Hola Autos QP, te contacto desde la web oficial.\nNombre: ${formData.name}\nTeléfono: ${formData.phone}\nEmail: ${formData.email}\nMotivo: ${formData.subject}\nMensaje: ${formData.message}`;
    openChat();
  };

  return (
    <div className="py-12 sm:py-16 bg-[#0c0f13] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header from PDF Page 10 */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00C896]/10 text-xs font-bold text-[#00C896]">
            Canales de Atención Directa
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            ¡Hablemos!
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Estamos listos para ayudarte. Escríbenos, llámanos o visítanos en nuestra vitrina en Bogotá.
          </p>
        </div>

        {/* Contact Info & Interactive Form Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Contact Data */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-[#11161d] border border-[#212b37] space-y-6">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Datos de contacto
              </h2>

              <div className="space-y-5">
                {/* Phones */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#00C896]/10 text-[#00C896] flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Líneas de atención / WhatsApp
                    </p>
                    <div className="mt-1 space-y-0.5">
                      <a
                        href={`tel:${COMPANY_INFO.phone1Raw}`}
                        className="text-sm sm:text-base font-bold text-white hover:text-[#00C896] transition-colors block"
                      >
                        {COMPANY_INFO.phone1}
                      </a>
                      <a
                        href={`tel:${COMPANY_INFO.phone2Raw}`}
                        className="text-sm sm:text-base font-bold text-white hover:text-[#00C896] transition-colors block"
                      >
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
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Correo electrónico
                    </p>
                    <a
                      href={`mailto:${COMPANY_INFO.email}`}
                      className="text-sm sm:text-base font-semibold text-slate-200 hover:text-[#00C896] transition-colors"
                    >
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
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Dirección vitrina física
                    </p>
                    <p className="text-sm text-slate-200 leading-snug mt-1">
                      {COMPANY_INFO.address}
                    </p>
                    <span className="text-xs text-[#00C896] font-semibold block mt-0.5">
                      Local 128 · Bogotá, Colombia
                    </span>
                  </div>
                </div>

                {/* Schedule */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#00C896]/10 text-[#00C896] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Horario de atención
                    </p>
                    <p className="text-xs text-slate-300 mt-1">{COMPANY_INFO.scheduleWeekday}</p>
                    <p className="text-xs text-slate-300">{COMPANY_INFO.scheduleWeekend}</p>
                  </div>
                </div>
              </div>

              {/* Direct WhatsApp Callout */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => openChat()}
                  className="w-full py-3 px-4 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-colors flex items-center justify-center gap-2 text-sm shadow-md"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chatea con nosotros</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7 bg-[#11161d] border border-[#212b37] rounded-3xl p-6 sm:p-10 shadow-2xl">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
              Envíanos un mensaje
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-6">
              Te responderemos en minutos en horario hábil para resolver todas tus inquietudes.
            </p>

            {error && <p role="alert" className="mb-4 text-sm text-rose-300">{error}</p>}
            {submitted ? (
              <div className="p-8 rounded-2xl bg-[#0b1411] border border-[#00C896]/40 text-center space-y-4 animate-in fade-in">
                <CheckCircle className="w-14 h-14 text-[#00C896] mx-auto" />
                <h3 className="text-xl font-bold text-white">¡Mensaje recibido con éxito!</h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  Gracias por comunicarte con Autos QP S.A.S. Un asesor comercial revisará tu solicitud para responderte a la brevedad.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={handleSendViaWhatsApp}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#00C896] text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Chatea con nosotros</span>
                  </button>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({
                        name: '',
                        phone: '',
                        email: '',
                        subject: 'Comprar vehículo',
                        message: ''
                      });
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-medium text-xs sm:text-sm cursor-pointer"
                  >
                    Enviar otro mensaje
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Tu nombre y apellidos"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ej. 300 252 3226"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Correo electrónico *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="ejemplo@correo.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none"
                    />
                  </div>

                  {/* Dropdown with all PDF categories */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      ¿En qué podemos ayudarte? *
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none"
                    >
                      <option value="Comprar vehículo">Comprar vehículo</option>
                      <option value="Vender mi vehículo">Vender mi vehículo</option>
                      <option value="Financiamiento">Financiamiento</option>
                      <option value="Reactivación Financiera">Reactivación Financiera</option>
                      <option value="Seguros">Seguros</option>
                      <option value="Garantía opcional">Garantía opcional</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Mensaje *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Escribe aquí tu consulta o el vehículo por el que estás interesado..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-[#090c10] border border-[#2b3744] text-xs sm:text-sm text-white rounded-lg px-3 py-2.5 focus:border-[#00C896] focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-slate-950 bg-[#00C896] hover:bg-[#00B486] transition-all transform hover:-translate-y-0.5 shadow-lg shadow-[#00C896]/20 cursor-pointer flex items-center justify-center gap-2 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>{sending ? 'Enviando mensaje…' : 'Enviar consulta'}</span>
                  </button>

                  <span className="text-[11px] text-slate-400">
                    Envío directo al equipo de <strong className="text-slate-300">Autos QP</strong>
                  </span>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Mapa Google Maps embebido (PDF Page 10) */}
        <div className="p-8 rounded-3xl bg-[#11161d] border border-[#212b37] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#00C896]" />
                <span>Nuestra ubicación en Bogotá</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {COMPANY_INFO.address}
              </p>
            </div>
            <a
              href="https://maps.google.com/?q=Centro+Comercial+Outlet+Factory+Bogota"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#00C896] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Abrir en Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-[#263240] relative">
            <iframe
              title="Ubicación Autos QP C.C. Outlet Factory Bogotá"
              src="https://maps.google.com/maps?q=Centro%20Comercial%20Outlet%20Factory%2C%20Avenida%20de%20las%20Am%C3%A9ricas%2062-84%2C%20Bogot%C3%A1&t=&z=16&ie=UTF8&iwloc=&output=embed"
              className="w-full h-full border-0 filter invert contrast-125 opacity-90 hover:opacity-100 transition-opacity"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
