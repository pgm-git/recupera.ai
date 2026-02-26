import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import LeadDetail from './pages/LeadDetail';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PrivacyPolicy from './pages/PrivacyPolicy';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <ToastProvider>
            <ToastContainer />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ErrorBoundary>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/products" element={<Products />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/leads/:leadId" element={<LeadDetail />} />
                          <Route path="/onboarding" element={<Onboarding />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </ErrorBoundary>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
