export function creditFormUrl() {
  const home = window.location.pathname.startsWith('/preview') ? '/preview/' : '/';
  return `/crm/credito?website=1&return=${encodeURIComponent(home)}`;
}
