import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PublicBrandLogo from '../components/PublicBrandLogo';
import { getPublicCompanyHomeUrl, usePublicCompany } from '../utils/publicCompany';

const withAlpha = (hex, alpha = '14') => {
  if (typeof hex !== 'string') return hex;
  const normalized = hex.trim();
  if (!normalized.startsWith('#')) return normalized;
  if (normalized.length === 7) return `${normalized}${alpha}`;
  if (normalized.length === 4) {
    const expanded = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    return `${expanded}${alpha}`;
  }
  return normalized;
};

const PublicPrivacyPolicy = () => {
  const company = usePublicCompany();
  const brandName = company?.name || 'AutosQP';
  const publicHomeUrl = getPublicCompanyHomeUrl(company);

  const theme = useMemo(() => {
    const primary = company?.primary_color || '#2563eb';
    const secondary = company?.secondary_color || '#0f172a';
    return {
      primary,
      secondary,
      header: company?.public_header_color || secondary,
      headerText: company?.public_header_text_color || '#ffffff',
      body: company?.public_body_color || '#f8fafc',
      text: company?.public_body_text_color || '#0f172a',
      border: withAlpha(primary, '2f'),
      soft: withAlpha(primary, '10'),
    };
  }, [company]);

  const contactChannels = [
    company?.contact_phone ? `Telefono o WhatsApp: ${company.contact_phone}` : null,
    company?.contact_address ? `Direccion fisica: ${company.contact_address}` : null,
    company?.social_instagram ? `Instagram: ${company.social_instagram}` : null,
    company?.social_facebook ? `Facebook: ${company.social_facebook}` : null,
  ].filter(Boolean);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const deletionUrl = `${currentOrigin}/politica-de-privacidad`;

  return (
    <div
      className="public-theme-scope min-h-screen font-sans"
      style={{ '--public-body-text': theme.text, background: theme.body, color: theme.text }}
    >
      <header
        className="sticky top-0 z-40 border-b shadow-sm"
        style={{ backgroundColor: theme.header, borderColor: theme.border, color: theme.headerText }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <a href={publicHomeUrl} className="flex items-center gap-3" style={{ color: theme.headerText }}>
            <PublicBrandLogo
              company={company}
              brandName={brandName}
              className="h-11 w-auto object-contain"
              fallbackClassName="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white"
              showText={Boolean(company?.logo_url)}
              textClassName="hidden text-sm font-semibold md:inline"
              primaryColor={theme.primary}
              secondaryColor={theme.secondary}
            />
          </a>
          <nav className="flex items-center gap-3 text-sm font-bold">
            <Link to="/autos" className="rounded-lg border px-4 py-2" style={{ borderColor: theme.border, color: theme.headerText }}>
              Inventario
            </Link>
            <Link to="/login" className="rounded-lg px-4 py-2" style={{ backgroundColor: theme.primary, color: theme.headerText }}>
              Ingresa
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <section className="rounded-2xl border bg-white p-6 shadow-sm md:p-10" style={{ borderColor: theme.border }}>
          <p className="text-sm font-bold uppercase tracking-wide" style={{ color: theme.primary }}>Politica de privacidad</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">Tratamiento de datos personales</h1>
          <p className="mt-4 text-sm text-slate-600">Ultima actualizacion: 7 de julio de 2026</p>
          <p className="mt-6 leading-7 text-slate-700">
            Esta politica explica como {brandName} recolecta, usa, almacena, comparte y protege los datos personales
            recibidos a traves de sus canales digitales, incluyendo el inventario publico, formularios de credito,
            formularios de contacto, chats, integraciones con Meta, WhatsApp, Instagram, Facebook, TikTok y otros canales
            comerciales habilitados.
          </p>
        </section>

        <div className="mt-6 space-y-5">
          <section className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: theme.border }}>
            <h2 className="text-xl font-black text-slate-900">1. Responsable del tratamiento</h2>
            <p className="mt-3 leading-7 text-slate-700">
              El responsable del tratamiento de los datos personales es {brandName}. Los datos de contacto disponibles
              para consultas, reclamos o solicitudes son:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
              {contactChannels.length > 0 ? contactChannels.map((item) => <li key={item}>{item}</li>) : (
                <li>Canales publicados en el sitio web oficial de {brandName}.</li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: theme.border }}>
            <h2 className="text-xl font-black text-slate-900">2. Datos que podemos recolectar</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
              <li>Datos de identificacion: nombres, apellidos, tipo y numero de documento.</li>
              <li>Datos de contacto: telefono, correo electronico, ciudad, direccion y redes sociales cuando sean suministradas.</li>
              <li>Datos comerciales: interes en vehiculos, solicitudes de contacto, historial de conversaciones y seguimiento de leads.</li>
              <li>Datos de credito: informacion financiera, laboral, referencias, documentos adjuntos, firma y autorizaciones cuando el usuario diligencie formularios de financiacion.</li>
              <li>Datos tecnicos: direccion IP, navegador, dispositivo, fecha, hora, cookies, identificadores publicitarios y eventos de integraciones como Meta Pixel o APIs de canales conectados.</li>
            </ul>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: theme.border }}>
            <h2 className="text-xl font-black text-slate-900">3. Finalidades del tratamiento</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
              <li>Atender solicitudes de informacion sobre vehiculos, servicios, financiacion, citas, ventas y posventa.</li>
              <li>Gestionar leads, conversaciones, cotizaciones, reservas, aprobaciones de credito y seguimiento comercial.</li>
              <li>Contactar al titular por telefono, WhatsApp, correo electronico, SMS, redes sociales o medios equivalentes.</li>
              <li>Validar identidad, prevenir fraude, conservar soportes y cumplir obligaciones legales, contables y contractuales.</li>
              <li>Compartir la informacion con aliados comerciales, entidades financieras, aseguradoras, operadores tecnologicos o proveedores necesarios para atender la solicitud del titular.</li>
              <li>Medir conversiones, mejorar campanas publicitarias, analizar el uso del sitio y optimizar la experiencia del usuario.</li>
            </ul>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: theme.border }}>
            <h2 className="text-xl font-black text-slate-900">4. Autorizacion, almacenamiento y seguridad</h2>
            <p className="mt-3 leading-7 text-slate-700">
              Al enviar informacion por los formularios, chats o canales conectados, el titular autoriza el tratamiento de
              sus datos para las finalidades descritas. {brandName} conserva la informacion durante el tiempo necesario para
              cumplir dichas finalidades, atender obligaciones legales y mantener evidencia de la relacion comercial.
            </p>
            <p className="mt-3 leading-7 text-slate-700">
              La informacion se protege mediante controles administrativos, tecnicos y organizacionales razonables. Aunque
              ningun sistema es completamente infalible, se aplican medidas orientadas a evitar acceso, perdida, uso o
              divulgacion no autorizada.
            </p>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: theme.border }}>
            <h2 className="text-xl font-black text-slate-900">5. Derechos de los titulares</h2>
            <p className="mt-3 leading-7 text-slate-700">
              El titular puede conocer, actualizar, rectificar, solicitar prueba de autorizacion, revocar la autorizacion,
              pedir la eliminacion de sus datos cuando proceda, presentar reclamos y consultar el uso dado a su informacion,
              de acuerdo con la Ley 1581 de 2012, sus decretos reglamentarios y demas normas aplicables en Colombia.
            </p>
            <p className="mt-3 leading-7 text-slate-700">
              Para ejercer estos derechos, el titular puede contactar a {brandName} por los canales publicados en esta pagina.
              La solicitud debe incluir nombre, documento, medio de respuesta y una descripcion clara de la peticion.
            </p>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: theme.border }}>
            <h2 className="text-xl font-black text-slate-900">6. Eliminacion de datos y apps de Meta</h2>
            <p className="mt-3 leading-7 text-slate-700">
              Si el usuario inicio sesion o interactuo con canales conectados a Meta, Facebook o Instagram, puede solicitar
              la eliminacion de sus datos personales enviando una solicitud por los canales de contacto indicados en esta
              politica. Tambien puede copiar esta URL como referencia de eliminacion de datos: {deletionUrl}.
            </p>
            <p className="mt-3 leading-7 text-slate-700">
              Una vez recibida la solicitud, {brandName} validara la identidad del solicitante y gestionara la eliminacion,
              anonimización o bloqueo de la informacion cuando sea legal y tecnicamente procedente.
            </p>
          </section>

          <section className="rounded-2xl border p-6 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.soft }}>
            <h2 className="text-xl font-black text-slate-900">7. Cambios a esta politica</h2>
            <p className="mt-3 leading-7 text-slate-700">
              Esta politica puede actualizarse para reflejar cambios legales, operativos o tecnologicos. La version vigente
              sera la publicada en esta URL.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PublicPrivacyPolicy;
