import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SessionSocketProvider } from '@/context/SessionSocketContext';
import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CreateSessionWizard } from '@/pages/CreateSessionWizard';
import { SessionRoom } from '@/pages/SessionRoom';
import { SessionResult } from '@/pages/SessionResult';
import './index.css';

// Обёртка комнаты сессии: получает sessionId из URL-параметров
const SessionRoomWrapper: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  if (!sessionId) return <Navigate to="/dashboard" replace />;
  return (
    <SessionSocketProvider sessionId={sessionId}>
      <SessionRoom sessionId={sessionId} />
    </SessionSocketProvider>
  );
};

// Обёртка результата сессии: получает sessionId из URL-параметров
const SessionResultWrapper: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  if (!sessionId) return <Navigate to="/dashboard" replace />;
  return <SessionResult sessionId={sessionId} />;
};

// Защищённый маршрут: если не авторизован — редирект на /auth
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

// Маршрут для неавторизованных: если уже авторизован — редирект на /dashboard
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route
      path="/auth"
      element={
        <GuestRoute>
          <AuthPage />
        </GuestRoute>
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/create-session"
      element={
        <ProtectedRoute>
          <CreateSessionWizard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/session/:sessionId"
      element={
        <ProtectedRoute>
          <SessionRoomWrapper />
        </ProtectedRoute>
      }
    />
    <Route
      path="/sessions/:sessionId/result"
      element={
        <ProtectedRoute>
          <SessionResultWrapper />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
