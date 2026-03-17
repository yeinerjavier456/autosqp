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
import PurchaseBoard from './pages/PurchaseBoard';
import InternalChat from './pages/InternalChat';
import SystemLogs from './pages/SystemLogs';
import RolesConfig from './pages/RolesConfig';
import { hasViewAccess, getRoleName } from './config/views';

const PrivateRoute = ({ requiredView }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-10 text-center">Cargando sesion...</div>;

  if (!user) return <Navigate to="/login" replace />;

  const roleName = getRoleName(user);
  if (requiredView && !hasViewAccess(user, requiredView)) {
    if (hasViewAccess(user, 'inventory')) {
      return <Navigate to="/admin/inventory" replace />;
    }
    if (hasViewAccess(user, 'credits')) {
      return <Navigate to="/admin/credits" replace />;
    }
    if (hasViewAccess(user, 'ally_board')) {
      return <Navigate to="/aliado/dashboard" replace />;
    }
    if (hasViewAccess(user, 'dashboard')) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/autos" replace />;
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
              <Route element={<PrivateRoute requiredView="dashboard" />}>
                <Route path="/admin/dashboard" element={<Dashboard />} />
              </Route>

              <Route element={<PrivateRoute requiredView="users" />}>
                <Route path="/admin/users" element={<UsersList />} />
                <Route path="/admin/users/new" element={<UserForm />} />
                <Route path="/admin/users/:id" element={<UserForm />} />
              </Route>
              <Route element={<PrivateRoute requiredView="roles" />}>
                <Route path="/admin/roles" element={<RolesConfig />} />
              </Route>
              <Route element={<PrivateRoute requiredView="integrations" />}>
                <Route path="/admin/integrations" element={<IntegrationsConfig />} />
              </Route>
              <Route element={<PrivateRoute requiredView="alerts" />}>
                <Route path="/admin/alerts" element={<AdminAlerts />} />
              </Route>
              <Route element={<PrivateRoute requiredView="logs" />}>
                <Route path="/admin/logs" element={<SystemLogs />} />
              </Route>

              <Route element={<PrivateRoute requiredView="inventory" />}>
                <Route path="/admin/inventory" element={<InventoryList />} />
                <Route path="/admin/inventory/:id" element={<VehicleForm />} />
                <Route path="/admin/inventory/new" element={<VehicleForm />} />
              </Route>

              <Route element={<PrivateRoute requiredView="leads_board" />}>
                <Route path="/admin/leads" element={<LeadsBoard key="general-leads-board" boardMode="general" />} />
              </Route>
              <Route element={<PrivateRoute requiredView="sales" />}>
                <Route path="/admin/sales" element={<SalesDashboard />} />
              </Route>
              <Route element={<PrivateRoute requiredView="my_sales" />}>
                <Route path="/admin/my-sales" element={<MySales />} />
              </Route>
              <Route element={<PrivateRoute requiredView="facebook_leads" />}>
                <Route path="/admin/leads/facebook" element={<FacebookLeads />} />
              </Route>
              <Route element={<PrivateRoute requiredView="tiktok_leads" />}>
                <Route path="/admin/leads/tiktok" element={<TikTokLeads />} />
              </Route>
              <Route element={<PrivateRoute requiredView="whatsapp_leads" />}>
                <Route path="/admin/leads/whatsapp" element={<WhatsAppLeads />} />
              </Route>
              <Route element={<PrivateRoute requiredView="instagram_leads" />}>
                <Route path="/admin/leads/instagram" element={<InstagramLeads />} />
              </Route>
              <Route element={<PrivateRoute requiredView="whatsapp_dashboard" />}>
                <Route path="/admin/whatsapp" element={<WhatsAppDashboard />} />
              </Route>

              <Route element={<PrivateRoute requiredView="credits" />}>
                <Route path="/admin/credits" element={<CreditBoard />} />
              </Route>

              <Route element={<PrivateRoute requiredView="purchase_board" />}>
                <Route path="/admin/purchases" element={<PurchaseBoard />} />
              </Route>

              <Route element={<PrivateRoute requiredView="ally_board" />}>
                <Route path="/aliado/dashboard" element={<LeadsBoard key="ally-leads-board" boardMode="ally" />} />
              </Route>

              <Route element={<PrivateRoute requiredView="internal_chat" />}>
                <Route path="/internal-chat" element={<InternalChat />} />
              </Route>

              <Route element={<PrivateRoute requiredView="companies" />}>
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
