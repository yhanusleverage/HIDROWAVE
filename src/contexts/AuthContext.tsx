'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

interface UserProfile {
  id: number;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.email!);
      } else {
        setLoading(false);
      }
    });

    // Ouvir mudanças de autenticação
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
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        // Se usuário não existe, criar perfil
        if (error.code === 'PGRST116') {
          await createUserProfile(email);
          return;
        }
        console.error('Error loading user profile:', error);
        setLoading(false);
        return;
      }

      setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUserProfile = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          email,
          name: email.split('@')[0],
          subscription_type: 'free',
          max_devices: 5,
          total_devices: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        return;
      }

      setUserProfile(data);
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  };

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // ✅ VALIDAR: Verificar se email existe na tabela users ANTES de fazer login
      const { data: userCheck, error: userCheckError } = await supabase
        .from('users')
        .select('email, is_active')
        .eq('email', normalizedEmail)
        .single();

      if (userCheckError || !userCheck) {
        toast.error('Email não encontrado na base de dados. Contate o administrador.');
        return false;
      }

      if (!userCheck.is_active) {
        toast.error('Sua conta está desativada. Contate o administrador.');
        return false;
      }

      // ✅ MODO DESENVOLVIMENTO: Tentar login com senha fornecida ou padrão
      const defaultPassword = 'admin123';
      const passwordToUse = password || defaultPassword;
      
      // ✅ Validar que email e senha não estão vazios
      if (!normalizedEmail || !passwordToUse) {
        toast.error('Email e senha são obrigatórios');
        return false;
      }
      
      // Primeiro tenta fazer login com a senha fornecida ou padrão
      let loginData = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: passwordToUse,
      });

      // ✅ Se falhou, verificar o tipo de erro
      if (loginData.error) {
        const errorCode = loginData.error.code || '';
        const errorMessage = loginData.error.message || '';
        
        // ✅ Erro 422 geralmente significa que o usuário não existe ou dados inválidos
        if (errorCode === 'invalid_credentials' || errorMessage.includes('Invalid login credentials') || errorMessage.includes('422')) {
          console.log('🔧 Usuário não existe ou credenciais inválidas. Tentando criar...');
          
          // Tentar criar usuário primeiro
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: normalizedEmail,
            password: defaultPassword,
          });
          
          if (signUpData?.user) {
            // Se criou com sucesso e tem sessão
            if (signUpData.session) {
              loginData = { data: { user: signUpData.user, session: signUpData.session }, error: null };
            } else {
              // Aguardar e tentar login
              await new Promise(resolve => setTimeout(resolve, 1000));
              loginData = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password: defaultPassword,
              });
            }
          } else if (signUpError) {
            // Se erro é que já existe, tentar login novamente
            if (signUpError.message.includes('already registered') || 
                signUpError.message.includes('User already registered')) {
              await new Promise(resolve => setTimeout(resolve, 500));
              loginData = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password: defaultPassword,
              });
            } else {
              toast.error(`Erro ao criar usuário: ${signUpError.message}`);
              return false;
            }
          }
        }
        
        // ✅ MODO DESENVOLVIMENTO: Se email não foi confirmado, tentar criar/confirmar
        if (errorMessage.includes('Email not confirmed') || errorCode === 'email_not_confirmed') {
          console.log('🔧 Email não confirmado. Tentando criar/confirmar em modo desenvolvimento...');
          
          // Tentar criar usuário novamente (pode confirmar automaticamente em dev)
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: normalizedEmail,
            password: defaultPassword,
          });

          if (signUpData?.user) {
            // Se tem sessão, usar diretamente
            if (signUpData.session) {
              loginData = { data: { user: signUpData.user, session: signUpData.session }, error: null };
            } else {
              // Se não tem sessão, tentar fazer login de qualquer forma
              // Em desenvolvimento, podemos ignorar a confirmação de email
              toast.success('Usuário encontrado. Aguarde...');
              
              // Aguardar e tentar login novamente
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              loginData = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password: defaultPassword,
              });
              
              // ✅ Se ainda falhar por email não confirmado, permitir acesso de qualquer forma em dev
              if (loginData.error && loginData.error.message.includes('Email not confirmed')) {
                console.log('⚠️ Modo desenvolvimento: Permitindo acesso sem confirmação de email');
                toast.success('Modo desenvolvimento: Acesso permitido sem confirmação de email');
                
                // ✅ Criar sessão manual usando o token se disponível
                // Ou simplesmente retornar true e deixar o ProtectedRoute verificar
                // Na verdade, precisamos da sessão válida, então vamos tentar outra abordagem
                
                // Tentar usar signInWithOtp ou outra forma
                // Por enquanto, vamos mostrar mensagem e tentar novamente
                toast.error('Email não confirmado. Verifique seu email ou desative confirmação em Supabase Dashboard.');
                return false;
              }
            }
          } else if (signUpError) {
            // Se erro é que já existe, tentar login novamente
            if (signUpError.message.includes('already registered') || 
                signUpError.message.includes('User already registered')) {
              console.log('✅ Usuário já existe, mas email não confirmado. Tentando login...');
              
              // Aguardar um pouco
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Tentar login com senha padrão
              loginData = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password: defaultPassword,
              });
              
              // Se ainda falhar por email não confirmado
              if (loginData.error && loginData.error.message.includes('Email not confirmed')) {
                toast.error(
                  'Email não confirmado. Para desenvolvimento: vá em Supabase Dashboard > Authentication > Settings > desative "Enable email confirmations"',
                  { duration: 6000 }
                );
                return false;
              }
            } else if (signUpError.message.includes('Too Many Requests')) {
              toast.error('Muitas tentativas. Aguarde alguns segundos e tente novamente.');
              return false;
            } else {
              console.error('Erro ao criar usuário:', signUpError);
              toast.error(`Erro: ${signUpError.message}`);
              return false;
            }
          }
        }
        // Se é erro de credenciais inválidas
        else if (errorMessage.includes('Invalid login credentials')) {
          console.log('🔧 Credenciais inválidas. Tentando criar usuário no Supabase Auth...');
          
          // Criar usuário no auth com senha padrão (só se não existe)
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: normalizedEmail,
            password: defaultPassword,
          });

          // Se criou com sucesso
          if (signUpData?.user) {
            if (signUpData.session) {
              // Se já tem sessão, usar diretamente
              loginData = { data: { user: signUpData.user, session: signUpData.session }, error: null };
            } else {
              // Aguardar e tentar login
              await new Promise(resolve => setTimeout(resolve, 1000));
              loginData = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password: defaultPassword,
              });
            }
          } 
          // Se erro é que já existe, tentar login novamente
          else if (signUpError && (
            signUpError.message.includes('already registered') || 
            signUpError.message.includes('User already registered')
          )) {
            console.log('✅ Usuário já existe, tentando login...');
            await new Promise(resolve => setTimeout(resolve, 500));
            loginData = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password: defaultPassword,
            });
          } 
          // Se erro de rate limit (429)
          else if (signUpError && signUpError.message.includes('Too Many Requests')) {
            toast.error('Muitas tentativas. Aguarde alguns segundos e tente novamente.');
            return false;
          }
          // Outro erro ao criar
          else if (signUpError) {
            console.error('Erro ao criar usuário:', signUpError);
            toast.error(`Erro: ${signUpError.message}. Tente novamente mais tarde.`);
            return false;
          }
        } 
        // Outro tipo de erro no login
        else if (loginData.error) {
          toast.error(loginData.error.message || 'Erro ao fazer login');
          return false;
        }
      }

      // ✅ Se login foi bem-sucedido
      if (loginData.data?.user) {
        // ✅ Carregar perfil e aguardar conclusão
        await loadUserProfile(loginData.data.user.email!);
        
        // ✅ Aguardar um pouco para garantir que o estado foi atualizado
        await new Promise(resolve => setTimeout(resolve, 300));
        
        toast.success('Login realizado com sucesso!');
        return true;
      }

      // ✅ Se ainda falhou após todas as tentativas
      toast.error('Erro ao fazer login. Verifique se o email está correto e tente novamente.');
      return false;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      toast.error('Erro ao fazer login');
      return false;
    }
  };

  const signUp = async (email: string, password: string, name?: string): Promise<boolean> => {
    try {
      // ✅ VALIDAR: Verificar se email já existe na tabela users
      const normalizedEmail = email.toLowerCase().trim();
      
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', normalizedEmail)
        .single();

      if (existingUser) {
        toast.error('Este email já está cadastrado. Faça login ou contate o administrador.');
        return false;
      }

      // ✅ Criar conta no Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (error) {
        toast.error(error.message);
        return false;
      }

      if (data.user) {
        // ✅ Criar perfil do usuário na tabela users
        await createUserProfile(normalizedEmail);
        toast.success('Conta criada com sucesso! Verifique seu email para confirmar.');
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
    if (!userProfile) return false;

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userProfile.id)
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

