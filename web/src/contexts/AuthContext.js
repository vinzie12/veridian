import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, apiCall, getCurrentUser } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile();
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          await fetchProfile();
        } else {
          setProfile(null);
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async () => {
    try {
      const { user: profileData } = await apiCall('/users/me');
      setProfile(profileData);
      setUser({
        id: profileData.id,
        email: profileData.email,
        full_name: profileData.full_name,
        badge_number: profileData.badge_number,
        role: profileData.role,
        agency: profileData.agencies?.name,
        agency_id: profileData.agency_id,
        status: profileData.status
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setProfile(null);
      setUser(null);
    }
    setLoading(false);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    isAuthenticated: !!session,
    fetchProfile,
    // Convenience methods
    signIn: supabase.auth.signInWithPassword,
    signInWithOTP: supabase.auth.signInWithOtp,
    verifyOTP: supabase.auth.verifyOtp,
    signUp: supabase.auth.signUp,
    signOut: async () => {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
    },
    resetPassword: supabase.auth.resetPasswordForEmail,
    updatePassword: supabase.auth.updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
