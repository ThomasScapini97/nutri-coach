import React, { useState, useEffect } from 'react';
import { Toaster } from "sonner";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

import AppLayout from './components/layout/AppLayout';
import Chat from './pages/Chat';
import Summary from './pages/Summary';
import Profile from './pages/Profile';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';

const AuthenticatedApp = () => {
  const { user, isLoadingAuth } = useAuth();
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
        <Route path="/Chat" element={<Chat />} />
        <Route path="/Summary" element={<Summary />} />
        <Route path="/Profile" element={<Profile />} />
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
          <AuthenticatedApp />
        </Router>
        <Toaster richColors />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;