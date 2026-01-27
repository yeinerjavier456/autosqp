import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const UserForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const [user, setUser] = useState({
        email: '',
        password: '',
        role_id: '',
        company_id: '',
    });
    const [companies, setCompanies] = useState([]);
    const [roles, setRoles] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        const fetchDependencies = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token}` };

                // Fetch Roles
                const rolesRes = await axios.get('http://localhost:8000/roles/', { headers });
                setRoles(rolesRes.data);

                // Fetch Companies if Super Admin
                if (!currentUser?.company_id) {
                    const compRes = await axios.get('http://localhost:8000/companies/?limit=100', { headers });
                    setCompanies(compRes.data.items);
                }
            } catch (error) {
                console.error("Error fetching dependencies", error);
            }
        };
        fetchDependencies();

        if (id) {
            setIsEditing(true);
            const fetchUser = async () => {
                try {
                    const token = localStorage.getItem('token');
                    console.log(`Fetching user ${id}...`);
                    const response = await axios.get(`http://localhost:8000/users/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    console.log("User data loaded:", response.data);

                    const { hashed_password, role, ...userData } = response.data;

                    // Logic to determine correct role_id from response
                    // Priorities: userData.role_id -> role object -> nothing
                    let loadedRoleId = userData.role_id;
                    if (!loadedRoleId && role && role.id) {
                        loadedRoleId = role.id;
                    }

                    setUser({
                        ...userData,
                        role_id: loadedRoleId || '',
                        password: ''
                    });
                } catch (error) {
                    console.error("Error fetching user", error);
                    const detail = error.response?.data?.detail || error.message;
                    setStatus({ type: 'error', message: `Error al cargar: ${detail}` });
                }
            };
            fetchUser();
        }
    }, [id, currentUser]);

    const handleChange = (e) => {
        setUser({
            ...user,
            [e.target.name]: e.target.value,
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setStatus({ type: 'loading', message: 'Guardando...' });
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Prepare payload. Remove password if empty on edit.
            const payload = { ...user };
            if (isEditing && !payload.password) {
                delete payload.password;
            }
            if (payload.company_id === '') {
                payload.company_id = null;
            }
            // Ensure role_id is integer
            if (payload.role_id) {
                payload.role_id = parseInt(payload.role_id);
            }

            if (isEditing) {
                await axios.put(`http://localhost:8000/users/${id}`, payload, { headers });
                setStatus({ type: 'success', message: 'Usuario actualizado exitosamente!' });
            } else {
                await axios.post('http://localhost:8000/users/', payload, { headers });
                setStatus({ type: 'success', message: 'Usuario creado exitosamente!' });
                if (!isEditing) {
                    navigate('/admin/users');
                }
            }
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.detail || 'Error al conectar con el servidor';
            setStatus({ type: 'error', message: `Error: ${errorMsg}` });
        }
    };

    return (
        <div className="">
            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800">
                    {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h1>
                <p className="text-slate-500 mt-2">
                    {isEditing ? 'Modifica los datos del usuario.' : 'Crea un nuevo usuario en el sistema.'}
                </p>
            </header>

            {status.message && (
                <div className={`mb-6 p-4 rounded-lg text-white font-bold ${status.type === 'error' ? 'bg-red-500' : status.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}>
                    {status.message}
                </div>
            )}

            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-2xl">
                <form onSubmit={handleSave} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            required
                            value={user.email}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Contraseña {isEditing && '(Dejar en blanco para mantener actual)'}</label>
                        <input
                            type="password"
                            name="password"
                            required={!isEditing}
                            value={user.password}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Rol</label>
                            <select
                                name="role_id"
                                value={user.role_id}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                            >
                                <option value="">Seleccionar Rol</option>
                                {roles.filter(r => {
                                    // If company admin, hide Super Admin role
                                    if (currentUser?.company_id && r.name === 'super_admin') return false;
                                    return true;
                                }).map(role => (
                                    <option key={role.id} value={role.id}>
                                        {role.label || role.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Only show Company select for Global Super Admin (no company_id) */}
                        {!currentUser?.company_id && (
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Empresa</label>
                                <select
                                    name="company_id"
                                    value={user.company_id || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                >
                                    <option value="">Sin Empresa</option>
                                    {companies.map(company => (
                                        <option key={company.id} value={company.id}>
                                            {company.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={status.type === 'loading'}
                            className="w-full py-3 px-6 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {status.type === 'loading' ? 'Guardando...' : 'Guardar Usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserForm;
