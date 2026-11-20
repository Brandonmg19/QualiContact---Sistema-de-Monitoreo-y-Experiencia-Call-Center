import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Menu,
  ChevronRight,
  Clock,
  RefreshCw,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

interface TopHeaderProps {
  onToggleMobileSidebar: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onToggleMobileSidebar }) => {
  const {
    activeSection,
    activeSubSection,
    currentUser,
    authEmail,
    monitorings,
    pendingAnalyses,
    hasPermission,
    isSyncing,
    refreshData,
    setAccountPassword,
    signOutUser,
  } = useApp();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleOpenPasswordModal = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setPasswordFeedback(null);
    setIsPasswordModalOpen(true);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 6) {
      setPasswordFeedback({
        type: 'error',
        text: 'La contraseña debe tener al menos 6 caracteres.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        text: 'Las contraseñas no coinciden.',
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      const result = await setAccountPassword(newPassword);
      if (result.ok) {
        setPasswordFeedback({ type: 'success', text: result.message });
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordFeedback({ type: 'error', text: result.message });
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  const sectionTitles: Record<string, { title: string; subtitle: string }> = {
    general: {
      title: 'Sección General',
      subtitle: 'Bandeja de Monitoreos & Dashboard por Perfil',
    },
    analista: {
      title: 'Sección Analista',
      subtitle: 'Bandeja de Pendientes, Encuestas NPS & Categorizaciones',
    },
    reporteria: {
      title: 'Sección Reportería',
      subtitle: 'Métricas Multi-nivel & Consultor Inteligente de Experiencia',
    },
    administrador: {
      title: 'Sección Administrador',
      subtitle: 'Gestión de Usuarios, Dependencias, Permisos & Bitácora',
    },
  };

  const currentInfo = sectionTitles[activeSection] || {
    title: 'NEXA-CX',
    subtitle: 'Gestión de Experiencia',
  };

  const analystPending = hasPermission('canCreateMonitoring')
    ? pendingAnalyses.filter((p) => p.status === 'PENDIENTE').length
    : 0;

  // Count pending actions for user
  const inboxPending = hasPermission('canViewAssignedInbox')
    ? monitorings.filter((m) => {
        if (currentUser.role === 'team_leader') {
          return m.teamLeaderId === currentUser.id && m.status === 'PENDIENTE_TL';
        }
        if (currentUser.role === 'asesor') {
          return m.agentId === currentUser.id && m.status === 'PENDIENTE_AGENTE';
        }
        if (currentUser.role === 'coordinador') {
          return m.status === 'PENDIENTE_TL' || m.status === 'PENDIENTE_AGENTE';
        }
        return false;
      }).length
    : 0;

  const pendingCount = inboxPending + (currentUser.role === 'analista' ? analystPending : 0);

  const subSectionLabels: Record<string, string> = {
    bandeja: 'Bandeja de Monitoreos',
    dashboard: 'Dashboard por Perfil',
    bandeja_analista: 'Bandeja de Pendientes (Analista)',
    encuestas: 'Carga de Encuestas del Día (NPS)',
    categorizaciones: 'Gestión de Categorizaciones',
    motivos_contacto: 'Gestión de Motivo de contacto',
    metricas: 'Métricas & Reportes',
    ia: 'Consultor IA (Gemini)',
    usuarios: 'Gestión de Usuarios',
    dependencias: 'Gestión de Dependencias',
    roles: 'Roles y Permisos',
    bitacora: 'Bitácora del Sistema',
  };

  const activeSubLabel = subSectionLabels[activeSubSection] || '';

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
        
        {/* Left: Mobile Hamburger & Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            title="Abrir menú vertical"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Clean Contextual Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
              NEXA-CX
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline shrink-0" />
            <span className="text-slate-600 hidden md:inline truncate">
              {currentInfo.title}
            </span>
            {activeSubLabel && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden md:inline shrink-0" />
                <span className="font-bold text-slate-900 truncate">
                  {activeSubLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: User Quick Status & Pending Indicator */}
        <div className="flex items-center gap-2.5 shrink-0">
          {pendingCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-medium">
                {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => void refreshData()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors disabled:opacity-60"
            title="Actualizar datos desde la base"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{isSyncing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>

          <div className="flex items-center gap-2 pl-2.5 border-l border-slate-200 text-xs text-slate-600">
            <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div className="hidden sm:block text-right">
              <span className="font-semibold text-slate-900 block leading-tight">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-slate-400 capitalize block leading-tight">
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenPasswordModal}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-colors"
            title="Configurar o cambiar contraseña"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </header>

      {/* MODAL: CONFIGURAR / CAMBIAR CONTRASEÑA */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Configurar contraseña de acceso
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {authEmail || currentUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Asigna una contraseña directamente a tu cuenta para ingresar con usuario y contraseña sin depender de enlaces por correo.
            </p>

            {passwordFeedback && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {passwordFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{passwordFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nueva contraseña (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-9 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Confirmar contraseña
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg"
                >
                  {isSavingPassword ? 'Guardando...' : 'Guardar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
