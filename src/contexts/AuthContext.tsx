'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

interface UserProfile {
  /** Opcional: tabela public.users usa email como PK (sem coluna id) */
  id?: number;
  email: string;
  name: string | null;
  subscription_type: 'free' | 'premium' | 'enterprise';
  max_devices: number;
  total_devices: number;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, name?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function mapAuthErrorMessage(error: {
  message?: string;
  status?: number;
  code?: string;
}): string {
  const msg = (error.message || '').toLowerCase();
  const code = (error.code || '').toLowerCase();

  if (
    code === 'email_exists' ||
    msg.includes('already registered') ||
    msg.includes('user already registered')
  ) {
    return 'Este email JA existe no Auth — use "Entrar" (senha certa) ou Authentication → Users → Reset password no Supabase.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Email ou senha incorretos, ou conta ainda nao criada — use Criar conta ou redefina a senha no Supabase Auth.';
  }
  if (msg.includes('email not confirmed') || code === 'email_not_confirmed') {
    return 'Confirme o email (link no correio) ou desative "Confirm email" em Auth → Providers → Email.';
  }
  if (
    code === 'over_email_send_rate_limit' ||
    msg.includes('email rate limit') ||
    msg.includes('rate limit') ||
    error.status === 429
  ) {
    return 'Limite de emails do Auth (429). Desative "Confirm email" em Providers → Email, aguarde ~1h, ou crie o user em Authentication → Users (Auto Confirm) — nao use Criar conta no site.';
  }
  if (msg.includes('signup_disabled') || code === 'signup_disabled') {
    return 'Registo desativado no Supabase — ative em Authentication → Providers → Email.';
  }
  if (msg.includes('password') && msg.includes('weak')) {
    return 'Senha fraca — use pelo menos 6 caracteres (recomendado 8+).';
  }

  return error.message || 'Erro de autenticacao';
}

/** Garante linha em public.users (RPC do ESP / SQL) após Auth OK */
async function syncPublicUserProfile(email: string, name?: string | null): Promise<void> {
  try {
    await supabase.rpc('ensure_public_user', {
      p_user_email: email,
      p_name: name ?? null,
    });
  } catch {
    // RPC pode não existir em projetos antigos — ignorar
  }
}

function buildFallbackProfile(email: string): UserProfile {
  return {
    email: normalizeEmail(email),
    name: email.split('@')[0],
    subscription_type: 'free',
    max_devices: 5,
    total_devices: 0,
    is_active: true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.email!);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.email!);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          await createUserProfile(normalizedEmail);
          return;
        }
        if (error.code === 'PGRST205') {
          setUserProfile(buildFallbackProfile(normalizedEmail));
          return;
        }
        console.error('Error loading user profile:', error);
        setUserProfile(buildFallbackProfile(normalizedEmail));
        return;
      }

      if (data && !data.is_active) {
        toast.error('Sua conta está desativada. Contate o administrador.');
        await supabase.auth.signOut();
        setUser(null);
        setUserProfile(null);
        return;
      }

      setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(buildFallbackProfile(normalizedEmail));
    } finally {
      setLoading(false);
    }
  };

  const createUserProfile = async (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          subscription_type: 'free',
          max_devices: 5,
          total_devices: 0,
        })
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST205') {
          setUserProfile(buildFallbackProfile(normalizedEmail));
          return;
        }
        console.error('Error creating user profile:', error);
        setUserProfile(buildFallbackProfile(normalizedEmail));
        return;
      }

      setUserProfile(data);
    } catch (error) {
      console.error('Error creating user profile:', error);
      setUserProfile(buildFallbackProfile(normalizedEmail));
    }
  };

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      const normalizedEmail = normalizeEmail(email);

      if (!normalizedEmail || !password) {
        toast.error('Email e senha são obrigatórios');
        return false;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        console.error('Auth signIn:', error.message, error.status, (error as { code?: string }).code);
        toast.error(mapAuthErrorMessage(error));
        return false;
      }

      if (data.user) {
        await syncPublicUserProfile(
          normalizedEmail,
          (data.user.user_metadata?.name as string | undefined) ?? null
        );
        await loadUserProfile(data.user.email!);
        toast.success('Login realizado com sucesso!');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      toast.error('Erro ao fazer login');
      return false;
    }
  };

  const signUp = async (email: string, password: string, name?: string): Promise<boolean> => {
    try {
      const normalizedEmail = normalizeEmail(email);

      if (!normalizedEmail || !password) {
        toast.error('Email e senha são obrigatórios');
        return false;
      }

      if (password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres');
        return false;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: name?.trim() ? { name: name.trim() } : undefined,
          emailRedirectTo:
            typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
        },
      });

      if (error) {
        console.error('Auth signUp:', error.message, error.status, (error as { code?: string }).code);
        toast.error(mapAuthErrorMessage(error));
        return false;
      }

      if (data.user) {
        await syncPublicUserProfile(normalizedEmail, name?.trim() ?? null);

        if (!data.session) {
          toast.success(
            'Conta criada — confirme o email no Supabase/correio, depois use Entrar. (Ou desative Confirm email em dev.)',
            { duration: 8000 }
          );
          return false;
        }

        await loadUserProfile(data.user.email!);
        toast.success('Conta criada! Login ativo.');
        return true;
      }

      return false;
    } catch (error) {
      toast.error('Erro ao criar conta');
      return false;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      toast.success('Logout realizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!userProfile?.email) return false;

    const profileEmail = normalizeEmail(userProfile.email);
    const { id: _id, email: _email, ...safeUpdates } = updates;

    if (Object.keys(safeUpdates).length === 0) {
      toast.error('Nada para atualizar');
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ ...safeUpdates, updated_at: new Date().toISOString() })
        .eq('email', profileEmail)
        .select()
        .single();

      if (error) {
        toast.error('Erro ao atualizar perfil');
        return false;
      }

      setUserProfile(data);
      toast.success('Perfil atualizado com sucesso!');
      return true;
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
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
