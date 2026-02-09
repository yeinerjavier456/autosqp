
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminCompanySettings from './pages/AdminCompanySettings';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CompaniesList from './pages/CompaniesList';
import UsersList from './pages/UsersList';

import UserForm from './pages/UserForm';
import InventoryList from './pages/InventoryList';
import VehicleForm from './pages/VehicleForm';
import LeadsBoard from './pages/LeadsBoard';
import SalesDashboard from './pages/SalesDashboard'; // Admin Sales Dashboard
import MySales from './pages/MySales'; // Advisor My Sales
import IntegrationsConfig from './pages/IntegrationsConfig';
import FacebookLeads from './pages/leads/FacebookLeads';
import TikTokLeads from './pages/leads/TikTokLeads';
import WhatsAppLeads from './pages/leads/WhatsAppLeads';
import InstagramLeads from './pages/leads/InstagramLeads';
import Reports from './pages/Reports';
import WhatsAppDashboard from './pages/WhatsAppDashboard';
import CreditBoard from './pages/CreditBoard';

const PrivateRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-10 text-center">Cargando sesión...</div>;

  if (!user) return <Navigate to="/login" replace />;

  const roleName = user.role?.name || (typeof user.role === 'string' ? user.role : '');
  if (allowedRoles && !allowedRoles.includes(roleName)) {
    // User authorized but not for this specific route
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/admin/dashboard" element={<Dashboard />} />

              {/* Super Admin & Company Admin Routes */}
              <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin']} />}>
                <Route path="/admin/users" element={<UsersList />} />
                <Route path="/admin/users/new" element={<UserForm />} />
                <Route path="/admin/users/:id" element={<UserForm />} />
                <Route path="/admin/integrations" element={<IntegrationsConfig />} />
              </Route>

              {/* Shared Routes (Admin, Super Admin, Advisor) */}
              <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'asesor']} />}>
                {/* Inventory Routes */}
                <Route path="/admin/inventory" element={<InventoryList />} />
                <Route path="/admin/inventory/new" element={<VehicleForm />} />
                <Route path="/admin/inventory/:id" element={<VehicleForm />} />

                {/* Leads Routes */}
                <Route path="/admin/leads" element={<LeadsBoard />} />
                <Route path="/admin/sales" element={<SalesDashboard />} />
                <Route path="/admin/my-sales" element={<MySales />} />

                <Route path="/admin/leads/facebook" element={<FacebookLeads />} />
                <Route path="/admin/leads/tiktok" element={<TikTokLeads />} />
                <Route path="/admin/leads/whatsapp" element={<WhatsAppLeads />} />
                <Route path="/admin/leads/instagram" element={<InstagramLeads />} />

                {/* Messaging */}
                <Route path="/admin/whatsapp" element={<WhatsAppDashboard />} />

                {/* Credits & Requests */}
                <Route path="/admin/credits" element={<CreditBoard />} />
              </Route>

              {/* Global Super Admin Only Routes */}
              <Route element={<PrivateRoute allowedRoles={['super_admin']} />}>
                <Route path="/admin/companies" element={<AdminCompanySettings />} />
                <Route path="/admin/companies/:id" element={<AdminCompanySettings />} />
                <Route path="/admin/companies-list" element={<CompaniesList />} />
              </Route>

              {/* Redirect root to admin for authenticated users */}
              <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider >
  );
}

export default App;
