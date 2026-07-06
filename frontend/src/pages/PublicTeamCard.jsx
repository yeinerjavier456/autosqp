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
              Gracias por confiar <span style={{ color: accentColor }}>en nosotros</span>
            </p>
            <p className="mt-5 max-w-[245px] text-sm leading-7" style={{ color: withAlpha(headerTextColor, 'd9') }}>
              Estamos aquí para ayudarte a encontrar el carro ideal.
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
                <p className="text-lg font-black leading-7" style={{ color: textColor }}>Visítanos en nuestra empresa</p>
                <p className="mt-2 text-sm leading-6" style={{ color: secondaryTextColor }}>
                  Conoce nuestras instalaciones y encuentra tu próximo carro.
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
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 py-7 text-center text-xs font-semibold text-white" style={{ background: headerColor }}>
          <span>Transparencia</span>
          <span>Confianza</span>
          <span>Calidad</span>
        </div>
      </section>
      <div className="mx-auto mt-5 flex max-w-[390px] flex-wrap justify-center gap-3">
        {whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-xl px-5 py-3 text-sm font-black text-white shadow-lg" style={{ background: headerColor }}>
            WhatsApp
          </a>
        ) : null}
        <a href={inventoryPath || '/autos'} className="rounded-xl bg-white/95 px-5 py-3 text-sm font-black text-slate-900 shadow-lg">
          Ver inventario
        </a>
      </div>
    </main>
  );
};

export default PublicTeamCard;
