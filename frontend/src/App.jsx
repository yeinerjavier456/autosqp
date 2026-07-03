import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { NotificationsProvider } from './context/NotificationsContext';
import AdminCompanySettings from './pages/AdminCompanySettings';
import AdminAlerts from './pages/AdminAlerts'; // Import AdminAlerts
import PublicInventory from './pages/PublicInventory';
import PublicCreditForm from './pages/PublicCreditForm';
import PublicCreditCapture from './pages/PublicCreditCapture';
import TikTokLanding from './pages/TikTokLanding';
import VehicleDetail from './pages/VehicleDetail'; // Import VehicleDetail
import LoginPage from './pages/LoginPage';
import LicenseRenewalPage from './pages/LicenseRenewalPage';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CompaniesList from './pages/CompaniesList';
import UsersList from './pages/UsersList';
import GlobalNotifications from './components/GlobalNotifications';

import UserForm from './pages/UserForm';
import InventoryList from './pages/InventoryList';
import VehicleForm from './pages/VehicleForm';
import LeadsBoard from './pages/LeadsBoard';
import AppointmentsCalendar from './pages/AppointmentsCalendar';
import DeletedLeads from './pages/DeletedLeads';
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
import PublicCreditSubmissions from './pages/PublicCreditSubmissions';
import GmailCreditAudit from './pages/GmailCreditAudit';
import PurchaseBoard from './pages/PurchaseBoard';
import InternalChat from './pages/InternalChat';
import SystemLogs from './pages/SystemLogs';
import RolesConfig from './pages/RolesConfig';
import { hasViewAccess, getOrderedMenuViews } from './config/views';

const routerBaseName = import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, '');

const PrivateRoute = ({ requiredView }) => {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const loading = auth?.loading ?? true;

  if (loading) return <div className="p-10 text-center">Cargando sesion...</div>;

  if (!user) return <Navigate to="/login" replace />;

  if (requiredView && !hasViewAccess(user, requiredView)) {
    const fallbackView = getOrderedMenuViews(user).find((view) => view?.path);
    if (fallbackView?.path) {
      return <Navigate to={fallbackView.path} replace />;
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
      <Router basename={routerBaseName}>
        <Routes>
          {/* Public Routes */}
          <Route path="/autos" element={<PublicInventory />} />
          <Route path="/credito" element={<PublicCreditForm />} />
          <Route path="/credito/captura/:token" element={<PublicCreditCapture />} />
          <Route path="/renovar-licencia" element={<LicenseRenewalPage />} />
          <Route path="/tiktok" element={<TikTokLanding />} />
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
              <Route element={<PrivateRoute requiredView="appointments_calendar" />}>
                <Route path="/admin/appointments" element={<AppointmentsCalendar />} />
              </Route>
              <Route element={<PrivateRoute requiredView="deleted_leads" />}>
                <Route path="/admin/leads/deleted" element={<DeletedLeads />} />
              </Route>
              <Route element={<PrivateRoute requiredView="sales" />}>
                <Route path="/admin/sales" element={<SalesDashboard />} />
              </Route>
              <Route element={<PrivateRoute requiredView="payment_receipts" />}>
                <Route path="/admin/receipts/new" element={<SalesDashboard receiptEntryOnly />} />
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

              <Route element={<PrivateRoute requiredView="public_credit_submissions" />}>
                <Route path="/admin/public-credit-submissions" element={<PublicCreditSubmissions />} />
              </Route>

              <Route element={<PrivateRoute requiredView="gmail_credit_audit" />}>
                <Route path="/admin/gmail-credit-audit" element={<GmailCreditAudit />} />
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
