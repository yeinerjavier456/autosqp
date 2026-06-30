import React from 'react';
import PublicSalesChatbot from '../components/PublicSalesChatbot';
import PublicBrandLogo from '../components/PublicBrandLogo';
import { getPublicCompanyHomeUrl, usePublicCompany } from '../utils/publicCompany';

const TikTokLanding = () => {
    const company = usePublicCompany();
    const publicHomeUrl = getPublicCompanyHomeUrl(company.public_domain);
    const brandName = company.name || 'AutosQP';
    const isPublicChatEnabled = new Set(Array.isArray(company?.enabled_modules) ? company.enabled_modules : []).has('public_sales_chat');

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff6e8_0%,#f7fafc_42%,#e2e8f0_100%)] text-slate-900">
            <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
                <header className="flex justify-center pb-4 sm:pb-5 lg:pb-6">
                    <a
                        href={publicHomeUrl}
                        title={brandName}
                        className="rounded-full border border-white/70 bg-white/90 px-4 py-2 shadow-sm backdrop-blur transition-opacity hover:opacity-90"
                    >
                        <PublicBrandLogo
                            company={company}
                            brandName={brandName}
                            className="h-11 w-auto object-contain md:h-12"
                            fallbackClassName="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white md:h-12 md:w-12"
                            showText={!company?.logo_url}
                            textClassName="text-lg font-extrabold"
                            primaryColor={company?.primary_color || '#2563eb'}
                            secondaryColor={company?.secondary_color || '#0f172a'}
                        />
                    </a>
                </header>

                <main className="flex flex-1 items-center justify-center">
                    <section className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/80 p-3 shadow-2xl backdrop-blur sm:p-4 lg:min-h-0 lg:p-5">
                        <div className="absolute -left-10 top-10 hidden h-36 w-36 rounded-full bg-orange-200/40 blur-3xl lg:block" />
                        <div className="absolute -right-10 bottom-10 hidden h-40 w-40 rounded-full bg-blue-200/40 blur-3xl lg:block" />

                        <div className="relative z-10 flex min-h-0 flex-1 flex-col rounded-[24px] border border-slate-200 bg-slate-50 p-2 sm:p-3">
                            {isPublicChatEnabled ? (
                                <PublicSalesChatbot
                                    autoOpen={true}
                                    hideLauncher={true}
                                    embedded={true}
                                    forceFreshSession={true}
                                    sourcePage="/autos"
                                    brandName={brandName}
                                    sessionStorageKey={`public_chat_session_tiktok_${company.public_domain || window.location.host}`}
                                    initialAssistantMessage={`Hola, bienvenido a ${brandName}. Soy tu asesora virtual y voy a ayudarte a perfilar tu solicitud. Para empezar, cuéntame qué vehículo te interesa.`}
                                />
                            ) : (
                                <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-white/80 px-6 text-center text-sm text-slate-500">
                                    El chat comercial no estA habilitado para esta empresa.
                                </div>
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default TikTokLanding;
