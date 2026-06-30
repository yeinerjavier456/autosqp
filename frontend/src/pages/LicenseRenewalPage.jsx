import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PublicBrandLogo from '../components/PublicBrandLogo';
import { usePublicCompany } from '../utils/publicCompany';

const LicenseRenewalPage = () => {
    const company = usePublicCompany();
    const notice = sessionStorage.getItem('license_notice') || company?.license_notice || 'La licencia de esta empresa no permite el acceso actualmente.';

    const theme = useMemo(() => {
        const primary = company?.primary_color || '#2563eb';
        const secondary = company?.secondary_color || '#0f172a';
        return { primary, secondary };
    }, [company]);

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-10"
            style={{ background: `linear-gradient(135deg, ${theme.secondary} 0%, ${theme.primary} 100%)` }}
        >
            <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl">
                <div className="mb-6 flex justify-center">
                    <PublicBrandLogo
                        company={company}
                        brandName={company?.name || 'AutosQP'}
                        className="h-16 w-auto object-contain"
                        fallbackClassName="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black text-white shadow-lg"
                        primaryColor={theme.primary}
                        secondaryColor={theme.secondary}
                    />
                </div>

                <p className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: theme.primary }}>
                    Renovar licencia
                </p>
                <h1 className="mt-3 text-3xl font-black text-slate-900">
                    Tu acceso necesita renovación
                </h1>
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
                    {notice}
                </p>
                <p className="mt-5 text-slate-600">
                    Para volver a usar el CRM y el inventario público, contacta al administrador de AutosQP y solicita la reactivación de la licencia.
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                    <Link
                        to="/autos"
                        className="rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg"
                        style={{ backgroundColor: theme.primary }}
                    >
                        Volver al inicio
                    </Link>
                    <a
                        href="https://autosqp.com"
                        className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700"
                    >
                        Contactar AutosQP
                    </a>
                </div>
            </div>
        </div>
    );
};

export default LicenseRenewalPage;
