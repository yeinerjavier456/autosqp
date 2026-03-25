import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrderedMenuViews, hasViewAccess, getRoleName } from '../config/views';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await axios.post('https://autosqp.co/api/token', formData, {
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
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-slate-800">AutosQP</h1>
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
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                            placeholder="admin@autosqp.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-lg transition shadow-lg"
                    >
                        {submitting ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
