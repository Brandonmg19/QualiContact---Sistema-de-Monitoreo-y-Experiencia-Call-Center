import React, { useState } from 'react';
import {
  LogIn,
  ShieldAlert,
  LogOut,
  RefreshCw,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NexaLogo } from '../common/NexaLogo';

export const LoginScreen: React.FC = () => {
  const {
    authStatus,
    authEmail,
    authError,
    authNotice,
    clearAuthNotice,
    signInWithGoogle,
    signInWithEmailPassword,
    registerWithEmailPassword,
    resetPasswordWithEmail,
    resendVerificationEmail,
    verifyEmailAndContinue,
    signOutUser,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'activate'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleModeChange = (nextMode: 'login' | 'activate') => {
    setMode(nextMode);
    clearAuthNotice();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmailPassword(email, password);
      } else {
        await registerWithEmailPassword(email, password);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await resetPasswordWithEmail(email);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm space-y-4">
          <NexaLogo size="lg" className="mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Conectando con NEXA-CX...</h2>
          <p className="text-xs text-slate-500">
            Verificando tu sesión y cargando tus permisos en la base de datos.
          </p>
        </div>
      </div>
    );
  }

  if (authStatus === 'verification_pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Verifica tu correo corporativo</h2>
              <p className="text-xs text-slate-500 font-mono">{authEmail}</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Para proteger tu cuenta, enviamos un enlace de verificación a tu bandeja. Ábrelo y luego pulsa{' '}
            <strong className="text-slate-800">Ya verifiqué mi correo</strong> para continuar.
          </p>

          {authNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{authNotice}</span>
            </div>
          )}

          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => void verifyEmailAndContinue()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ya verifiqué mi correo (Continuar)</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void resendVerificationEmail()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reenviar enlace</span>
              </button>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthorized' || authStatus === 'inactive') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {authStatus === 'inactive' ? 'Usuario Inactivo' : 'Acceso Pendiente de Habilitación'}
              </h2>
              <p className="text-xs text-slate-500 font-mono">{authEmail}</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {authStatus === 'inactive'
              ? 'Tu usuario se encuentra marcado como inactivo en el directorio de NEXA-CX. Solicita a un Administrador que reactive tu acceso.'
              : 'Tu correo aún no figura en el directorio de usuarios autorizados. Solicita a un Administrador que te agregue en el módulo Gestión de Usuarios (o mediante carga masiva Excel) con este correo.'}
          </p>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cambiar cuenta</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-7 max-w-md w-full shadow-sm space-y-5">
        <div className="flex items-center gap-3.5">
          <NexaLogo size="lg" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">NEXA-CX</h1>
            <p className="text-xs text-slate-500">
              Sistema Integral de Gestión de Experiencia, Monitoreo y Feedback
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
          <button
            type="button"
            onClick={() => handleModeChange('login')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('activate')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              mode === 'activate'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Activar contraseña
          </button>
        </div>

        {authNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{authNotice}</span>
          </div>
        )}

        {authError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Usuario (Correo corporativo)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                autoComplete="email"
                required
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Contraseña</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => void handleResetPassword()}
                  disabled={isSubmitting}
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'activate' ? 'Mínimo 6 caracteres' : '••••••••'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
                className="w-full pl-9 pr-10 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {mode === 'activate' && (
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                Si un Administrador ya registró tu correo en el directorio, crea aquí tu contraseña por primera vez.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : mode === 'login' ? (
              <LogIn className="w-4 h-4" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            <span>{mode === 'login' ? 'Ingresar con usuario y contraseña' : 'Crear contraseña y verificar'}</span>
          </button>
        </form>

        <div className="relative flex items-center py-1">
          <div className="grow border-t border-slate-200" />
          <span className="shrink mx-3 text-[11px] text-slate-400">o accede con tu cuenta</span>
          <div className="grow border-t border-slate-200" />
        </div>

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
        >
          <LogIn className="w-4 h-4 text-slate-600" />
          <span>Continuar con Google</span>
        </button>
      </div>
    </div>
  );
};
