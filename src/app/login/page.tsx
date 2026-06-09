'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Toaster, toast } from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  // ✅ Redirecionar se já está autenticado
  useEffect(() => {
    if (!authLoading && user && (!userProfile || userProfile.is_active)) {
      // ✅ Usar setTimeout para garantir que a navegação aconteça
      const timer = setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user, userProfile, authLoading, router]);

  // ✅ Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-primary-900 to-aqua-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-500 mx-auto"></div>
          <p className="mt-4 text-dark-textSecondary">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ Validar email obrigatório
    if (!email || !email.trim()) {
      toast.error('Por favor, informe seu email');
      return;
    }
    
    setLoading(true);

    try {
      let success = false;
      if (isSignUp) {
        // ✅ Para signUp, senha é obrigatória
        if (!password || password.length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres');
          setLoading(false);
          return;
        }
        success = await signUp(email, password, name);
      } else {
        if (!password || password.length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres');
          setLoading(false);
          return;
        }
        success = await signIn(email, password);
      }

      if (success) {
        // ✅ Aguardar um pouco para garantir que o perfil foi carregado
        await new Promise(resolve => setTimeout(resolve, 500));
        // ✅ Forçar redireção
        router.push('/dashboard');
        router.refresh(); // Forçar atualização da página
      }
    } catch (error) {
      toast.error('Erro ao processar requisição');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-primary-900 to-aqua-900 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent mb-2">
            🌱 HydroWave
          </h1>
          <p className="text-dark-textSecondary">
            {isSignUp ? 'Criar nova conta' : 'Entre na sua conta'}
          </p>
          <p className="text-dark-textSecondary text-xs mt-2 leading-relaxed">
            {isSignUp ? (
              <>
                Qualquer pessoa pode criar conta aqui. Os ESPs so aparecem em Dispositivos se estiverem
                registados com <strong>este mesmo email</strong> (ex.: configuracao WiFi do modulo).
              </>
            ) : (
              <>
                Login independente do hardware. Sem ESP associado ao teu email, o painel funciona mas
                Dispositivos pode ficar vazio.
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-dark-textSecondary mb-1">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                placeholder="Seu nome"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-dark-textSecondary mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-dark-textSecondary mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full p-3 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              placeholder="Sua senha"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-aqua-400 hover:text-aqua-300 text-sm transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Entrar' : 'Não tem conta? Criar conta'}
          </button>
        </div>

      </div>
    </div>
  );
}

