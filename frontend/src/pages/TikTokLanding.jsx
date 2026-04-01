import React from 'react';
import { Link } from 'react-router-dom';
import PublicSalesChatbot from '../components/PublicSalesChatbot';

const TikTokLanding = () => {
    return (
        <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#fff6e8_0%,#f7fafc_45%,#e2e8f0_100%)] text-slate-900">
            <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <Link to="/autos" className="text-2xl font-extrabold tracking-tight text-slate-900">
                        <span className="text-green-500">Autos</span>QP
                    </Link>
                    <Link
                        to="/autos"
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-orange-300 hover:text-orange-600"
                    >
                        Ver inventario
                    </Link>
                </header>

                <main className="grid flex-1 gap-5 py-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] lg:items-stretch lg:gap-6 lg:overflow-hidden">
                    <section className="flex min-h-0 max-w-3xl flex-col justify-center lg:pr-2">
                        <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
                            Atención inmediata desde TikTok
                        </span>
                        <p className="mt-3 max-w-2xl font-serif text-[2rem] font-black leading-[0.95] text-slate-900">
                            Bienvenido a Autos QP.
                        </p>
                        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 lg:text-[1.05rem]">
                            Déjanos tus datos desde aquí y nuestro equipo comercial se pondrá en contacto contigo.
                        </p>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                                <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Paso 1</p>
                                <p className="mt-2 text-sm font-semibold text-slate-700">Cuéntanos qué vehículo te interesa.</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                                <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Paso 2</p>
                                <p className="mt-2 text-sm font-semibold text-slate-700">Comparte nombre, teléfono y correo.</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                                <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Paso 3</p>
                                <p className="mt-2 text-sm font-semibold text-slate-700">Te orientamos sobre crédito, cuota inicial y perfil.</p>
                            </div>
                        </div>

                        <div className="mt-4 max-w-2xl rounded-3xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
                            <p className="text-sm font-bold uppercase tracking-wide text-orange-700">Importante</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                                Nuestros asesores están listos para atenderte.
                            </p>
                        </div>
                    </section>

                    <section className="relative mx-auto flex min-h-0 w-full max-w-[620px] lg:max-w-none">
                        <div className="absolute -left-8 top-8 hidden h-40 w-40 rounded-full bg-orange-200/40 blur-3xl lg:block" />
                        <div className="absolute -right-8 bottom-8 hidden h-48 w-48 rounded-full bg-blue-200/40 blur-3xl lg:block" />
                        <div className="relative flex min-h-0 w-full flex-1 flex-col rounded-[28px] border border-white/70 bg-white/85 p-3 shadow-2xl backdrop-blur sm:p-4">
                            <div className="mb-3 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white">
                                <div>
                                    <p className="text-sm font-bold">Chat comercial Autos QP</p>
                                </div>
                                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-200">
                                    En línea
                                </span>
                            </div>
                            <div className="min-h-0 flex-1 rounded-[24px] border border-slate-200 bg-slate-50 p-2">
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
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default TikTokLanding;
