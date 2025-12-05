import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  department: string | null;
  suspended_until: string | null;
  last_appointment_date: string | null;
}

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, department: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSuspended: boolean;
  suspendedUntil: Date | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const profileData = await api.getMe();
      setProfile(profileData);
      setUser({ id: profileData.id, email: profileData.email });
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      setUser(null);
      api.signOut();
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      if (token) {
        await fetchProfile();
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await api.signIn(email, password);
      setUser({ id: response.user.id, email: response.user.email });
      setProfile(response.user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, name: string, department: string) => {
    try {
      const response = await api.signUp(email, password, name, department);
      setUser({ id: response.user.id, email: response.user.email });
      setProfile(response.user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await api.signOut();
    setProfile(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile();
    }
  };

  const isAdmin = profile?.role === 'admin';
  const suspendedUntil = profile?.suspended_until ? new Date(profile.suspended_until) : null;
  const isSuspended = suspendedUntil ? suspendedUntil > new Date() : false;

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      isAdmin,
      isSuspended,
      suspendedUntil,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
