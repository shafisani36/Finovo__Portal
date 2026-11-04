import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

export interface User {
  id: number;
  name: string;
  email: string;
  status: string;
  timezone: string;
  locale: string;
  profile_photo_url: string | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  created_at: string;
}

export interface CompanyMembership {
  membership_id: number;
  status: string;
  joined_at: string;
  company: {
    id: number;
    name: string;
    slug: string;
    status: string;
    timezone: string;
  };
  roles: Array<{ id: number; name: string; slug: string }>;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  companies: CompanyMembership[];
  activeCompany: CompanyMembership | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  setActiveCompany: (company: CompanyMembership) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const u = localStorage.getItem('bitspark_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const [companies, setCompanies] = useState<CompanyMembership[]>(() => {
    try {
      const c = localStorage.getItem('bitspark_companies');
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });
  const [activeCompany, setActiveCompanyState] = useState<CompanyMembership | null>(() => {
    try {
      const a = localStorage.getItem('bitspark_active_membership');
      return a ? JSON.parse(a) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const token = localStorage.getItem('bitspark_token');
    const u = localStorage.getItem('bitspark_user');
    // If token and user exist locally, 0ms instant startup without blocking spinner
    return !(token && u);
  });

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('bitspark_token');
      if (!token) {
        setUser(null);
        setCompanies([]);
        setActiveCompanyState(null);
        setLoading(false);
        return;
      }

      const res = await api.get('/me');
      const freshUser = res.data.user;
      const freshCompanies = res.data.companies || [];

      setUser(freshUser);
      setCompanies(freshCompanies);
      localStorage.setItem('bitspark_user', JSON.stringify(freshUser));
      localStorage.setItem('bitspark_companies', JSON.stringify(freshCompanies));

      const savedSlug = localStorage.getItem('bitspark_active_company');
      const matched = freshCompanies.find(
        (c: CompanyMembership) => c.company.slug === savedSlug
      );
      if (matched) {
        setActiveCompanyState(matched);
        localStorage.setItem('bitspark_active_membership', JSON.stringify(matched));
      } else if (freshCompanies.length > 0) {
        setActiveCompanyState(freshCompanies[0]);
        localStorage.setItem('bitspark_active_company', freshCompanies[0].company.slug);
        localStorage.setItem('bitspark_active_membership', JSON.stringify(freshCompanies[0]));
      }
    } catch {
      // Only remove if explicitly 401 unauthenticated
      if (!localStorage.getItem('bitspark_token')) {
        setUser(null);
        setCompanies([]);
        setActiveCompanyState(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (token: string, userData: User) => {
    localStorage.setItem('bitspark_token', token);
    setUser(userData);
    await refreshUser();
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('bitspark_token');
      localStorage.removeItem('bitspark_active_company');
      setUser(null);
      setCompanies([]);
      setActiveCompanyState(null);
    }
  };

  const setActiveCompany = (comp: CompanyMembership) => {
    setActiveCompanyState(comp);
    localStorage.setItem('bitspark_active_company', comp.company.slug);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        activeCompany,
        loading,
        login,
        logout,
        setActiveCompany,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
