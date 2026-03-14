import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { NotificationsProvider } from './context/NotificationsContext';
import AdminCompanySettings from './pages/AdminCompanySettings';
import AdminAlerts from './pages/AdminAlerts'; // Import AdminAlerts
import PublicInventory from './pages/PublicInventory';
import VehicleDetail from './pages/VehicleDetail'; // Import VehicleDetail
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CompaniesList from './pages/CompaniesList';
import UsersList from './pages/UsersList';
import GlobalNotifications from './components/GlobalNotifications';

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
import InternalChat from './pages/InternalChat';
import SystemLogs from './pages/SystemLogs';

const PrivateRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-10 text-center">Cargando sesion...</div>;

  if (!user) return <Navigate to="/login" replace />;

  const roleName = user.role?.name || (typeof user.role === 'string' ? user.role : '');
  if (allowedRoles && !allowedRoles.includes(roleName)) {
    // User authorized but not for this specific route
    if (roleName === 'inventario') {
      return <Navigate to="/admin/inventory" replace />;
    }
    if (roleName === 'compras') {
      return <Navigate to="/admin/credits" replace />;
    }
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
};

const AuthenticatedAppShell = () => (
  <ChatProvider>
    <NotificationsProvider>
      <GlobalNotifications />
      <Layout />
    </NotificationsProvider>
  </ChatProvider>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/autos" element={<PublicInventory />} />
          <Route path="/autos/:id" element={<VehicleDetail />} /> {/* New Route */}

          <Route path="/" element={<Navigate to="/autos" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route element={<PrivateRoute />}>
            <Route element={<AuthenticatedAppShell />}>
              <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'asesor', 'aliado']} />}>
                <Route path="/admin/dashboard" element={<Dashboard />} />
              </Route>

              {/* Super Admin & Company Admin Routes */}
              <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin']} />}>
                <Route path="/admin/users" element={<UsersList />} />
                <Route path="/admin/users/new" element={<UserForm />} />
                <Route path="/admin/users/:id" element={<UserForm />} />
                <Route path="/admin/users/:id" element={<UserForm />} />
                <Route path="/admin/integrations" element={<IntegrationsConfig />} />
                <Route path="/admin/alerts" element={<AdminAlerts />} />
                <Route path="/admin/logs" element={<SystemLogs />} />
              </Route>

              {/* Inventory Routes */}
              <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'asesor', 'aliado', 'inventario']} />}>
                <Route path="/admin/inventory" element={<InventoryList />} />
                <Route path="/admin/inventory/:id" element={<VehicleForm />} />
              </Route>
              <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'inventario']} />}>
                <Route path="/admin/inventory/new" element={<VehicleForm />} />
              </Route>

              {/* Shared Routes (Admin, Super Admin, Advisor) */}
              <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'asesor']} />}>
                {/* Leads Routes */}
                <Route path="/admin/leads" element={<LeadsBoard boardMode="general" />} />
                <Route path="/admin/sales" element={<SalesDashboard />} />
                <Route path="/admin/my-sales" element={<MySales />} />

                <Route path="/admin/leads/facebook" element={<FacebookLeads />} />
                <Route path="/admin/leads/tiktok" element={<TikTokLeads />} />
                <Route path="/admin/leads/whatsapp" element={<WhatsAppLeads />} />
                <Route path="/admin/leads/instagram" element={<InstagramLeads />} />

                {/* Messaging */}
                <Route path="/admin/whatsapp" element={<WhatsAppDashboard />} />
              </Route>

              {/* Credits & Requests */}
              <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'asesor', 'aliado', 'compras']} />}>
                <Route path="/admin/credits" element={<CreditBoard />} />
              </Route>

              {/* Aliado Routes */}
              <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin', 'aliado']} />}>
                <Route path="/aliado/dashboard" element={<LeadsBoard boardMode="ally" />} />
              </Route>

              {/* Internal Chat - Access for all authenticated users in company */}
              <Route path="/internal-chat" element={<InternalChat />} />

              {/* Global Super Admin Only Routes */}
              <Route element={<PrivateRoute allowedRoles={['super_admin']} />}>
                <Route path="/admin/companies" element={<AdminCompanySettings />} />
                <Route path="/admin/companies/:id" element={<AdminCompanySettings />} />
                <Route path="/admin/companies-list" element={<CompaniesList />} />
              </Route>

              {/* NOTE: I removed the duplicate Route path="/" here because it intercepts the global "/" public route */}
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/autos" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
