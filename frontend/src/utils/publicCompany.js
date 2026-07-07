import { useEffect, useState } from 'react';
import axios from 'axios';
import { normalizeMediaUrl } from './media';

const inferCompanyNameFromHost = () => {
  if (typeof window === 'undefined') {
    return 'AutosQP';
  }

  const hostname = String(window.location.hostname || '').trim().toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'AutosQP';
  }

  const normalized = hostname.replace(/^www\./, '');
  const [label] = normalized.split('.');
  return label || 'AutosQP';
};

const formatPublicTitle = (companyName) => {
  const normalized = String(companyName || '').trim();
  return normalized || 'AutosQP';
};

const upsertMetaTag = (selector, attributes) => {
  if (typeof document === 'undefined') {
    return;
  }
  let meta = document.querySelector(selector);
  if (!meta) {
    meta = document.createElement('meta');
    Object.entries(attributes.identity || {}).forEach(([key, value]) => meta.setAttribute(key, value));
    document.head.appendChild(meta);
  }
  Object.entries(attributes.values || {}).forEach(([key, value]) => meta.setAttribute(key, value));
};

const setPublicSeoMetadata = (company) => {
  if (typeof document === 'undefined') {
    return;
  }
  const brandName = formatPublicTitle(company?.name || inferCompanyNameFromHost());
  const description = `Consulta carros y camionetas disponibles en ${brandName}.`;
  const logoUrl = company?.logo_url ? normalizeMediaUrl(company.logo_url) : '';
  document.title = brandName;
  upsertMetaTag('meta[name="description"]', {
    identity: { name: 'description' },
    values: { content: description },
  });
  upsertMetaTag('meta[property="og:title"]', {
    identity: { property: 'og:title' },
    values: { content: brandName },
  });
  upsertMetaTag('meta[property="og:description"]', {
    identity: { property: 'og:description' },
    values: { content: description },
  });
  upsertMetaTag('meta[property="og:url"]', {
    identity: { property: 'og:url' },
    values: { content: window.location.href },
  });
  if (logoUrl) {
    upsertMetaTag('meta[property="og:image"]', {
      identity: { property: 'og:image' },
      values: { content: logoUrl },
    });
  }
  upsertMetaTag('meta[name="twitter:title"]', {
    identity: { name: 'twitter:title' },
    values: { content: brandName },
  });
  upsertMetaTag('meta[name="twitter:description"]', {
    identity: { name: 'twitter:description' },
    values: { content: description },
  });
  if (logoUrl) {
    upsertMetaTag('meta[name="twitter:image"]', {
      identity: { name: 'twitter:image' },
      values: { content: logoUrl },
    });
  }
};

const buildCompanyFaviconDataUrl = (companyName, primaryColor = '#2563eb', secondaryColor = '#0f172a') => {
  const label = String(companyName || 'A').trim().slice(0, 1).toUpperCase() || 'A';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${secondaryColor}" />
          <stop offset="100%" stop-color="${primaryColor}" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#g)" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const setDocumentFavicon = (company) => {
  if (typeof document === 'undefined') {
    return;
  }

  const brandName = String(company?.name || inferCompanyNameFromHost()).trim() || 'AutosQP';
  const primaryColor = company?.primary_color || '#2563eb';
  const secondaryColor = company?.secondary_color || '#0f172a';
  const generatedFavicon = buildCompanyFaviconDataUrl(brandName, primaryColor, secondaryColor);
  const logoHref = company?.logo_url ? normalizeMediaUrl(company.logo_url) : '';
  const faviconHref = logoHref || generatedFavicon;

  const relConfigurations = [
    { rel: 'icon', href: faviconHref, type: logoHref ? undefined : 'image/svg+xml', sizes: logoHref ? undefined : 'any' },
    { rel: 'shortcut icon', href: faviconHref, type: logoHref ? undefined : 'image/svg+xml', sizes: logoHref ? undefined : 'any' },
    { rel: 'apple-touch-icon', href: faviconHref, type: undefined, sizes: undefined },
  ];

  relConfigurations.forEach(({ rel, href, type, sizes }) => {
    let favicon = document.querySelector(`link[rel="${rel}"]`);

    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', rel);
      document.head.appendChild(favicon);
    }

    favicon.setAttribute('href', href);
    if (type) {
      favicon.setAttribute('type', type);
    } else {
      favicon.removeAttribute('type');
    }
    if (sizes) {
      favicon.setAttribute('sizes', sizes);
    } else {
      favicon.removeAttribute('sizes');
    }
  });
};

const DEFAULT_PUBLIC_COMPANY = {
  id: null,
  name: inferCompanyNameFromHost(),
  public_domain: null,
  website_url: '',
  enabled_modules: [],
  logo_url: '',
  contact_address: '',
  contact_phone: '',
  social_instagram: '',
  social_tiktok: '',
  social_facebook: '',
  primary_color: '#2563eb',
  secondary_color: '#0f172a',
  public_header_color: '#0f172a',
  public_header_text_color: '#ffffff',
  public_body_color: '#f8fafc',
  public_body_text_color: '#0f172a',
  public_credit_requires_email_validation: true,
  license_status: 'unlimited',
  license_notice: null,
  license_days_remaining: null,
};

export const usePublicCompany = () => {
  const [company, setCompany] = useState(DEFAULT_PUBLIC_COMPANY);

  useEffect(() => {
    let ignore = false;

    const loadCompany = async () => {
      const endpoints = ['/api/public/company-context', '/crm/api/public/company-context'];

      try {
        let response = null;

        for (const endpoint of endpoints) {
          try {
            response = await axios.get(endpoint);
            break;
          } catch {
            response = null;
          }
        }

        if (!response) {
          throw new Error('No public company context endpoint responded');
        }

        if (!ignore && response?.data) {
          setCompany({ ...DEFAULT_PUBLIC_COMPANY, ...response.data });
        }
      } catch {
        if (!ignore) {
          setCompany(DEFAULT_PUBLIC_COMPANY);
        }
      }
    };

    loadCompany();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    setPublicSeoMetadata(company);
    setDocumentFavicon(company);
  }, [company]);

  return company;
};

const normalizeAbsolutePublicUrl = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return `https://${normalized}`;
};

export const getPublicCompanyHomeUrl = (companyOrDomain) => {
  const company = typeof companyOrDomain === 'object' && companyOrDomain !== null ? companyOrDomain : null;
  const websiteUrl = normalizeAbsolutePublicUrl(company?.website_url);
  if (websiteUrl) {
    return websiteUrl;
  }

  const publicDomain = company ? company.public_domain : companyOrDomain;
  const normalizedDomain = String(publicDomain || '').trim();
  const publicBaseUrl = normalizedDomain
    ? `${window.location.protocol}//${normalizedDomain}`
    : window.location.origin;
  return `${publicBaseUrl}/crm/autos`;
};
