import { useEffect, useState } from 'react';
import axios from 'axios';

const DEFAULT_PUBLIC_COMPANY = {
  id: null,
  name: 'AutosQP',
  public_domain: null,
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

  return company;
};

export const getPublicCompanyHomeUrl = (publicDomain) => {
  const normalizedDomain = String(publicDomain || '').trim();
  if (!normalizedDomain) {
    return window.location.origin;
  }
  return `${window.location.protocol}//${normalizedDomain}`;
};
