import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import PublicBrandLogo from '../components/PublicBrandLogo';
import { normalizeMediaUrl } from '../utils/media';

const withAlpha = (hex, alpha = '18') => {
  const normalized = String(hex || '').trim();
  if (!normalized.startsWith('#')) return normalized;
  if (normalized.length === 7) return `${normalized}${alpha}`;
  return normalized;
};

const getMapsUrl = (address) => {
  const query = String(address || '').trim();
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const getWhatsAppUrl = (phone) => {
  const firstPhone = String(phone || '').split(/[,;|/-]/).map((item) => item.trim()).find(Boolean) || '';
  const digits = firstPhone.replace(/[^\d]/g, '');
  if (!digits) return '';
  const normalized = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${normalized}`;
};

const normalizeExternalUrl = (url) => {
  const value = String(url || '').trim();
  if (!value || value === 'auto') return value;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
};

const SocialIcon = ({ network }) => {
  if (network === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Zm4.2 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 2a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Zm5.1-2.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" />
      </svg>
    );
  }
  if (network === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.47h-1.25c-1.24 0-1.63.77-1.63 1.56v1.9h2.77l-.44 2.91h-2.33V22C18.34 21.24 22 17.08 22 12.06Z" />
      </svg>
    );
  }
  if (network === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M16.6 2c.35 2.22 1.58 3.55 3.8 3.69v3.05a7.2 7.2 0 0 1-3.75-1.1v6.54c0 4.1-2.6 6.82-6.45 6.82-3.35 0-6.2-2.23-6.2-5.87 0-3.74 2.9-5.89 6.28-5.89.48 0 .86.04 1.22.14v3.25a3.4 3.4 0 0 0-1.23-.23c-1.6 0-2.9.94-2.9 2.67 0 1.62 1.2 2.63 2.78 2.63 1.75 0 2.83-1.05 2.83-3.07V2h3.62Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.58 14.85L2.2 22l5.28-1.23A9.95 9.95 0 1 0 12.04 2Zm0 1.9a8.05 8.05 0 1 1 0 16.1 8 8 0 0 1-4.08-1.12l-.36-.21-3.08.72.73-3-.24-.38A8.05 8.05 0 0 1 12.04 3.9Zm-3.42 3.7c-.18 0-.47.07-.72.35-.25.27-.95.93-.95 2.27s.98 2.64 1.12 2.82c.14.18 1.9 3.05 4.72 4.15 2.34.91 2.82.73 3.33.68.51-.05 1.65-.67 1.88-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33-.28-.14-1.65-.81-1.9-.9-.26-.1-.44-.14-.63.14-.18.28-.72.9-.88 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.49.14-.16.18-.28.28-.47.09-.18.05-.35-.02-.49-.07-.14-.62-1.54-.86-2.1-.23-.54-.46-.55-.64-.56h-.55Z" />
    </svg>
  );
};

const PublicTeamCard = () => {
  const { slug } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const loadCard = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await axios.get(`/api/public/team-cards/${encodeURIComponent(slug || '')}`);
        if (!ignore) setCard(response.data);
      } catch (err) {
        if (!ignore) setError(err?.response?.data?.detail || 'No se pudo cargar esta tarjeta.');
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    loadCard();
    return () => {
      ignore = true;
    };
  }, [slug]);

  const company = card?.company || {};
  const accentColor = card?.accent_color || company.primary_color || '#2fe6bd';
  const headerColor = card?.header_color || '#071225';
  const headerTextColor = card?.header_text_color || '#ffffff';
  const cardColor = card?.card_color || '#ffffff';
  const textColor = card?.text_color || '#071225';
  const secondaryTextColor = withAlpha(textColor, 'b8');
  const mapsQuery = company.contact_address || `${company.name || 'AutosQP'} Colombia`;
  const mapsUrl = getMapsUrl(mapsQuery);
  const photoUrl = card?.photo_url ? normalizeMediaUrl(card.photo_url) : '';
  const inventoryPath = `${import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')}/autos`;
  const emailToShow = card?.display_email || card?.email;
  const phoneToShow = card?.display_phone || company.contact_phone || '';
  const whatsappUrl = getWhatsAppUrl(phoneToShow);
  const headline = card?.headline || 'Gracias por confiar';
  const headlineHighlight = card?.headline_highlight || 'en nosotros';
  const subheadline = card?.subheadline || 'Estamos aquí para ayudarte a encontrar el carro ideal.';
  const visitTitle = card?.visit_title || 'Visítanos en nuestra empresa';
  const visitText = card?.visit_text || 'Conoce nuestras instalaciones y encuentra tu próximo carro.';
  const footerLabels = Array.isArray(card?.footer_labels) && card.footer_labels.length
    ? card.footer_labels
    : ['Transparencia', 'Confianza', 'Calidad'];
  const socials = card?.socials || {};
  const socialEntries = [
    ['instagram', 'Instagram', socials.instagram],
    ['facebook', 'Facebook', socials.facebook],
    ['tiktok', 'TikTok', socials.tiktok],
    ['whatsapp', 'WhatsApp', socials.whatsapp === 'auto' ? whatsappUrl : socials.whatsapp],
  ].filter(([, , url]) => Boolean(url));

  const initials = useMemo(() => {
    const parts = String(card?.full_name || '').trim().split(/\s+/).filter(Boolean);
    return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase() || 'EQ';
  }, [card?.full_name]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-semibold">Cargando tarjeta...</div>
      </main>
    );
  }

  if (error || !card) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-black text-slate-900">Tarjeta no disponible</h1>
          <p className="mt-3 text-sm text-slate-500">{error || 'La tarjeta está deshabilitada o no existe.'}</p>
          <a href={inventoryPath || '/autos'} className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">
            Ver inventario
          </a>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen px-4 py-6"
      style={{
        background: `linear-gradient(145deg, ${accentColor} 0%, ${withAlpha(accentColor, 'e8')} 42%, ${withAlpha(headerColor, 'de')} 100%)`,
      }}
    >
      <section className="mx-auto w-full max-w-[390px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative min-h-[280px] overflow-hidden px-7 pb-16 pt-7" style={{ background: headerColor, color: headerTextColor }}>
          <div className="absolute -right-16 bottom-0 h-48 w-72 rounded-tl-full opacity-50" style={{ background: `radial-gradient(circle at 30% 50%, ${withAlpha(accentColor, '88')}, transparent 62%)` }} />
          <div className="absolute bottom-8 right-0 h-28 w-56 rounded-l-full border border-white/10 bg-white/5 shadow-inner" />
          <div className="relative z-10 flex items-center gap-3">
            <PublicBrandLogo
              company={company}
              brandName={company.name}
              className="h-14 max-w-[170px] object-contain"
              fallbackClassName="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-black text-white"
              showText={!company.logo_url}
              textClassName="text-base font-black uppercase text-white"
              primaryColor={accentColor}
              secondaryColor={headerColor}
            />
          </div>
          <div className="relative z-10 mt-10">
            <p className="text-3xl font-black leading-snug">
              {headline} <span style={{ color: accentColor }}>{headlineHighlight}</span>
            </p>
            <p className="mt-5 max-w-[245px] text-sm leading-7" style={{ color: withAlpha(headerTextColor, 'd9') }}>
              {subheadline}
            </p>
          </div>
          <div className="absolute bottom-6 left-7 grid grid-cols-4 gap-1">
            {Array.from({ length: 12 }).map((_, index) => (
              <span key={index} className="h-1 w-1 rounded-full" style={{ background: accentColor }} />
            ))}
          </div>
        </div>

        <div className="relative -mt-11 mx-3 rounded-[28px] px-6 pb-6 pt-6 shadow-xl" style={{ background: cardColor }}>
          <div className="grid grid-cols-[112px_1fr] gap-5">
            <div className="h-32 w-32 overflow-hidden rounded-full bg-slate-100 shadow-inner">
              {photoUrl ? (
                <img src={photoUrl} alt={card.full_name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black text-slate-400">{initials}</div>
              )}
            </div>
            <div className="min-w-0 pt-5">
              <h1 className="break-words text-2xl font-black leading-snug" style={{ color: textColor }}>{card.full_name}</h1>
              <p className="mt-2 text-sm font-black uppercase leading-6" style={{ color: secondaryTextColor }}>{card.position || 'Equipo comercial'}</p>
              <a href={`mailto:${emailToShow}`} className="mt-5 flex min-w-0 items-center gap-3 text-sm font-semibold" style={{ color: secondaryTextColor }}>
                <span className="shrink-0">✉</span>
                <span className="truncate">{emailToShow}</span>
              </a>
              {phoneToShow ? (
                <a
                  href={whatsappUrl || undefined}
                  target={whatsappUrl ? '_blank' : undefined}
                  rel={whatsappUrl ? 'noreferrer' : undefined}
                  className="mt-3 flex min-w-0 items-center gap-3 text-sm font-semibold"
                  style={{ color: secondaryTextColor }}
                >
                  <span className="shrink-0">☎</span>
                  <span className="truncate">{phoneToShow}</span>
                </a>
              ) : null}
              <div className="mt-7 h-0.5 w-full" style={{ background: accentColor }} />
            </div>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-8 block rounded-3xl bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: accentColor }}>
                <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
                  <path fill="currentColor" d="M12 2.5A7.5 7.5 0 0 0 4.5 10c0 5.25 7.5 11.5 7.5 11.5S19.5 15.25 19.5 10A7.5 7.5 0 0 0 12 2.5Zm0 10.2A2.7 2.7 0 1 1 12 7.3a2.7 2.7 0 0 1 0 5.4Z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-black leading-7" style={{ color: textColor }}>{visitTitle}</p>
                <p className="mt-2 text-sm leading-6" style={{ color: secondaryTextColor }}>
                  {visitText}
                </p>
              </div>
            </div>
            <div
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-black uppercase text-white shadow-lg"
              style={{ background: headerColor }}
            >
              <span style={{ color: accentColor }}>●</span>
              Cómo llegar
            </div>
            {company.contact_address ? (
              <p className="mt-4 text-center text-sm font-semibold" style={{ color: accentColor }}>{company.contact_address}</p>
            ) : null}
          </a>

          <a
            href={inventoryPath || '/autos'}
            className="mt-4 flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-black uppercase text-white shadow-lg"
            style={{ background: accentColor, color: headerColor }}
          >
            Ver inventario
          </a>

          {socialEntries.length ? (
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {socialEntries.map(([network, label, url]) => (
                <a
                  key={network}
                  href={normalizeExternalUrl(url)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderColor: withAlpha(accentColor, '66'), color: textColor, background: withAlpha(accentColor, '10') }}
                >
                  <SocialIcon network={network} />
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 py-7 text-center text-xs font-semibold text-white" style={{ background: headerColor }}>
          {footerLabels.slice(0, 3).map((label) => <span key={label}>{label}</span>)}
        </div>
      </section>
    </main>
  );
};

export default PublicTeamCard;
