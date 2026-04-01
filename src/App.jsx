import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from "sonner";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import AppLayout from './components/layout/AppLayout';

const Chat = lazy(() => import('./pages/Chat'));
const Summary = lazy(() => import('./pages/Summary'));
const Profile = lazy(() => import('./pages/Profile'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Login = lazy(() => import('./pages/Login'));
const Exercise = lazy(() => import('./pages/Exercise'));
const Diary = lazy(() => import('./pages/Diary'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (user) {
      supabase.from('user_profiles').select('*').eq('user_id', user.id).single().then(({ data }) => {
        setProfile(data);
        setLoadingProfile(false);
      });
    } else if (!isLoadingAuth) {
      setLoadingProfile(false);
    }
  }, [user, isLoadingAuth]);

  if (location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (isLoadingAuth || loadingProfile) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return <Login />;

  const needsOnboarding = !profile?.age || !profile?.weight || !profile?.height || !profile?.gender || !profile?.activity_level || !profile?.goal;

  if (needsOnboarding) {
    return <Onboarding onComplete={() => {
      supabase.from('user_profiles').select('*').eq('user_id', user.id).single().then(({ data }) => setProfile(data));
    }} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/Chat" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/Exercise" element={<Exercise />} />
        <Route path="/Chat" element={<Chat />} />
        <Route path="/Summary" element={<Summary />} />
        <Route path="/Profile" element={<Profile />} />
        <Route path="/Diary" element={<Diary />} />
      </Route>
      <Route path="*" element={<Navigate to="/Chat" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <AuthenticatedApp />
          </Suspense>
        </Router>
        <Toaster richColors />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;