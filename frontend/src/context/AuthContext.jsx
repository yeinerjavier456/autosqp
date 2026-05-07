import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const defaultAuthContext = {
    user: null,
    loading: true,
    login: async () => null,
    logout: () => {},
};

const AuthContext = createContext(defaultAuthContext);
const API_BASE_URL = import.meta.env.DEV ? '/crm/api' : 'https://autosqp.co/api';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const login = async (token) => {
        setLoading(true);
        localStorage.setItem('token', token);
        return await fetchUser();
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const fetchUser = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/users/me`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15000
            });
            setUser(response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching user", error);
            localStorage.removeItem('token');
            setUser(null);
            return null;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();

        // Global 401 Interceptor
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && error.response.status === 401) {
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext) || defaultAuthContext;
