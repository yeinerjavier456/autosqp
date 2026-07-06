export const normalizeEcardSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 90);

export const getEcardPublicUrl = (company, slug) => {
  const normalizedSlug = normalizeEcardSlug(slug);
  if (!normalizedSlug) return '';
  const companyDomain = String(company?.public_domain || '').trim();
  const origin = companyDomain ? `${window.location.protocol}//${companyDomain}` : window.location.origin;
  return `${origin}/nuestroequipo/${normalizedSlug}`;
};
