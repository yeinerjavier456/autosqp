import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrderedMenuViews, hasViewAccess, getRoleName } from '../config/views';
import { usePublicCompany } from '../utils/publicCompany';
import PublicBrandLogo from '../components/PublicBrandLogo';

const API_BASE_URL = import.meta.env.DEV ? '/crm/api' : '/api';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();
    const company = usePublicCompany();

    const theme = useMemo(() => {
        const primary = company?.primary_color || '#2563eb';
        const secondary = company?.secondary_color || '#0f172a';
        return {
            primary,
            secondary,
            primarySoft: `${primary}14`,
            secondarySoft: `${secondary}f2`,
        };
    }, [company]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await axios.post(`${API_BASE_URL}/token`, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000
            });

            // Use context login which sets token and fetches user
            const loggedUser = await login(response.data.access_token);
            if (!loggedUser) {
                throw new Error('No se pudo cargar la sesion del usuario despues de autenticar.');
            }

            if (response.data.license_notice) {
                window.alert(response.data.license_notice);
            }

            const roleName = getRoleName(loggedUser);
            const orderedViews = getOrderedMenuViews(loggedUser);
            const destination = hasViewAccess(loggedUser, 'dashboard')
                ? '/admin/dashboard'
                : orderedViews.length > 0
                    ? orderedViews[0].path
                    : roleName === 'inventario'
                        ? '/admin/inventory'
                        : roleName === 'compras'
                            ? '/admin/purchases'
                            : '/autos';

            navigate(destination, { replace: true });

        } catch (err) {
            console.error(err);
            const statusCode = err?.response?.status;
            if (statusCode === 401) {
                setError('Credenciales invalidas. Por favor intenta de nuevo.');
            } else if (err?.code === 'ECONNABORTED') {
                setError('La solicitud de inicio de sesion tardo demasiado. Intenta nuevamente.');
            } else {
                setError(err?.response?.data?.detail || 'No se pudo iniciar sesion. Revisa si el backend esta respondiendo correctamente.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-10"
            style={{
                background: `linear-gradient(135deg, ${theme.secondary} 0%, ${theme.primary} 100%)`,
            }}
        >
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border" style={{ borderColor: theme.primarySoft }}>
                <div className="text-center mb-8">
                    <div className="mb-4 flex justify-center">
                        <PublicBrandLogo
                            company={company}
                            brandName={company?.name || 'AutosQP'}
                            className="h-16 w-auto object-contain"
                            fallbackClassName="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black text-white shadow-lg"
                            primaryColor={theme.primary}
                            secondaryColor={theme.secondary}
                        />
                    </div>
                    <h1 className="text-2xl font-extrabold" style={{ color: theme.secondary }}>
                        {company?.name || 'AutosQP'}
                    </h1>
                    <p className="text-slate-500">Inicia sesión en tu cuenta</p>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none text-black bg-white"
                            style={{ boxShadow: 'none' }}
                            onFocus={(e) => { e.target.style.borderColor = theme.primary; e.target.style.boxShadow = `0 0 0 2px ${theme.primarySoft}`; }}
                            onBlur={(e) => { e.target.style.borderColor = ''; e.target.style.boxShadow = 'none'; }}
                            placeholder={`admin@${(company?.public_domain || 'autosqp.com').replace(/^www\./, '')}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none text-black bg-white"
                            style={{ boxShadow: 'none' }}
                            onFocus={(e) => { e.target.style.borderColor = theme.primary; e.target.style.boxShadow = `0 0 0 2px ${theme.primarySoft}`; }}
                            onBlur={(e) => { e.target.style.borderColor = ''; e.target.style.boxShadow = 'none'; }}
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-lg transition shadow-lg"
                        style={{ backgroundColor: theme.primary }}
                    >
                        {submitting ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
