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

const DEFAULT_FAVICON = 'https://autosqp.com/wp-content/uploads/2025/12/cropped-Horizontal-Base_-v3-1.03.18-p.m.png';

const setDocumentFavicon = (logoUrl) => {
  if (typeof document === 'undefined') {
    return;
  }

  const baseHref = logoUrl ? normalizeMediaUrl(logoUrl) : DEFAULT_FAVICON;
  const separator = baseHref.includes('?') ? '&' : '?';
  const faviconHref = `${baseHref}${separator}v=${encodeURIComponent(baseHref)}`;
  const relValues = ['icon', 'shortcut icon', 'apple-touch-icon'];

  relValues.forEach((relValue) => {
    let favicon = document.querySelector(`link[rel="${relValue}"]`);

    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', relValue);
      document.head.appendChild(favicon);
    }

    favicon.setAttribute('href', faviconHref);
  });
};

const DEFAULT_PUBLIC_COMPANY = {
  id: null,
  name: inferCompanyNameFromHost(),
  public_domain: null,
  enabled_modules: [],
  logo_url: '',
  primary_color: '#2563eb',
  secondary_color: '#0f172a',
};

export const usePublicCompany = () => {
  const [company, setCompany] = useState(DEFAULT_PUBLIC_COMPANY);

  useEffect(() => {
    let ignore = false;

    const loadCompany = async () => {
      try {
        const response = await axios.get('/api/public/company-context');
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
    document.title = formatPublicTitle(company?.name);
    setDocumentFavicon(company?.logo_url);
  }, [company]);

  return company;
};

export const getPublicCompanyHomeUrl = (publicDomain) => {
  const normalizedDomain = String(publicDomain || '').trim();
  if (!normalizedDomain) {
    return window.location.origin;
  }
  return `${window.location.protocol}//${normalizedDomain}`;
};
