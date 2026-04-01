import React from 'react';
import PublicSalesChatbot from '../components/PublicSalesChatbot';

const TikTokLanding = () => {
    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff6e8_0%,#f7fafc_42%,#e2e8f0_100%)] text-slate-900">
            <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
                <header className="flex justify-center pb-4 sm:pb-5 lg:pb-6">
                    <div className="rounded-full border border-white/70 bg-white/85 px-5 py-3 text-2xl font-extrabold tracking-tight text-slate-900 shadow-sm backdrop-blur">
                        <span className="text-orange-500">Autos</span>QP
                    </div>
                </header>

                <main className="flex flex-1 items-center justify-center">
                    <section className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/80 p-3 shadow-2xl backdrop-blur sm:p-4 lg:min-h-0 lg:flex-row lg:items-stretch lg:gap-4 lg:p-5">
                        <div className="absolute -left-10 top-10 hidden h-36 w-36 rounded-full bg-orange-200/40 blur-3xl lg:block" />
                        <div className="absolute -right-10 bottom-10 hidden h-40 w-40 rounded-full bg-blue-200/40 blur-3xl lg:block" />

                        <div className="relative z-10 flex items-center justify-center rounded-[24px] bg-slate-950 px-6 py-6 text-center text-white lg:w-[32%] lg:min-w-[250px] lg:px-8">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-200">TikTok</p>
                                <h1 className="mt-3 font-serif text-[2rem] font-black leading-none sm:text-[2.25rem]">
                                    Autos QP
                                </h1>
                                <p className="mt-4 text-sm leading-6 text-slate-200 sm:text-base">
                                    Cuéntanos qué vehículo buscas y nuestro bot te ayudará a registrar tus datos.
                                </p>
                            </div>
                        </div>

                        <div className="relative z-10 mt-3 flex min-h-0 flex-1 flex-col rounded-[24px] border border-slate-200 bg-slate-50 p-2 sm:p-3 lg:mt-0">
                            <PublicSalesChatbot
                                autoOpen={true}
                                hideLauncher={true}
                                embedded={true}
                                forceFreshSession={true}
                                sourcePage="/tiktok"
                                sessionStorageKey="autosqp_public_chat_session_tiktok"
                                initialAssistantMessage="Hola, bienvenido a Autos QP. Soy tu asesora virtual y voy a ayudarte a perfilar tu solicitud. Para empezar, cuéntame qué vehículo te interesa."
                            />
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default TikTokLanding;
