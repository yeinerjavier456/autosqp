import React from 'react';
import { Facebook, Instagram, ExternalLink } from 'lucide-react';
import { COMPANY_INFO } from '../data/company';

function TikTokIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M16.6 2c.35 2.22 1.58 3.55 3.8 3.69v3.05a7.2 7.2 0 0 1-3.75-1.1v6.54c0 4.1-2.6 6.82-6.45 6.82-3.35 0-6.2-2.23-6.2-5.87 0-3.74 2.9-5.89 6.28-5.89.48 0 .86.04 1.22.14v3.25a3.4 3.4 0 0 0-1.23-.23c-1.6 0-2.9.94-2.9 2.67 0 1.62 1.2 2.63 2.78 2.63 1.75 0 2.83-1.05 2.83-3.07V2h3.62Z" /></svg>;
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.4-.2-2.7.7.7-2.7-.3-.4A8 8 0 1 1 12 20Zm4.4-5.6c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.5.1l-.7.8c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3-2.6c-.2-.3.2-.5.5-.9.1-.1.1-.3 0-.5l-.7-1.6c-.1-.3-.3-.3-.5-.3h-.4c-.2 0-.4.1-.6.3-.6.6-.9 1.4-.5 2.5.6 1.8 3.1 4.2 5.7 4.8 1 .2 1.9 0 2.4-.8.2-.4.3-.9.2-1-.1-.1-.2-.1-.4-.2Z" /></svg>;
}

export function SocialLinks({ className = 'grid gap-2', includeWhatsApp = true }: { className?: string; includeWhatsApp?: boolean }) {
  const links = [
    { label: 'Facebook', handle: 'Autos QP', href: COMPANY_INFO.social.facebook, Icon: Facebook },
    { label: 'Instagram', handle: COMPANY_INFO.social.instagramHandle, href: COMPANY_INFO.social.instagram, Icon: Instagram },
    { label: 'TikTok', handle: COMPANY_INFO.social.tiktokAdvisorHandle, href: COMPANY_INFO.social.tiktokAdvisor, Icon: TikTokIcon },
    { label: 'TikTok', handle: COMPANY_INFO.social.tiktokHandle, href: COMPANY_INFO.social.tiktok, Icon: TikTokIcon },
    ...(includeWhatsApp ? [{ label: 'WhatsApp', handle: COMPANY_INFO.phone1, href: COMPANY_INFO.social.whatsapp, Icon: WhatsAppIcon }] : [])
  ];
  return <nav aria-label="Redes sociales" className={className}>
    {links.map(({ label, handle, href, Icon }) => <a key={href} href={href} target="_blank" rel="noopener noreferrer"
      aria-label={`${label} ${handle} (abre en una pestaña nueva)`}
      className="group flex min-h-12 items-center gap-3 rounded-xl border border-[#263240] bg-[#11161d] px-3 py-3 text-slate-200 transition-colors hover:border-[#00C896] hover:bg-[#00C896]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C896]">
      <span className="shrink-0 text-[#00C896]"><Icon aria-hidden="true" className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-white">{label}</span><span className="block break-words text-[11px] text-slate-400">{handle}</span></span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-[#00C896]" aria-hidden="true" />
    </a>)}
  </nav>;
}
