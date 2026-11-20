import React, { useState } from 'react';
import { useApp, MainSection } from '../../context/AppContext';
import { 
  Inbox, 
  FileSpreadsheet, 
  BarChart3, 
  ShieldCheck, 
  Users, 
  RotateCcw,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { NexaLogo } from '../common/NexaLogo';

export const Navbar: React.FC = () => {
  const { 
    currentUser, 
    setCurrentUser, 
    users, 
    activeSection, 
    setActiveSection, 
    monitorings 
  } = useApp();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Compute pending actions count for current user
  const pendingCount = monitorings.filter((m) => {
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
  }).length;

  const sections: { id: MainSection; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'Sección General', icon: Inbox },
    { id: 'analista', label: 'Sección Analista', icon: FileSpreadsheet },
    { id: 'reporteria', label: 'Sección Reportería', icon: BarChart3 },
    { id: 'administrador', label: 'Sección Administrador', icon: ShieldCheck },
  ];

  const roleLabels: Record<string, string> = {
    asesor: 'Asesor',
    team_leader: 'Team Leader',
    coordinador: 'Coordinador',
    analista: 'Analista de Experiencia',
    admin: 'Administrador',
  };

  const roleColors: Record<string, string> = {
    asesor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    team_leader: 'bg-blue-50 text-blue-700 border-blue-200',
    coordinador: 'bg-purple-50 text-purple-700 border-purple-200',
    analista: 'bg-amber-50 text-amber-700 border-amber-200',
    admin: 'bg-slate-100 text-slate-800 border-slate-300',
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-16">
          
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <NexaLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 font-sans">
                  NEXA-CX
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Call Center Experiencia
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-none">Gestión y Ciclo Cerrado de Feedback</p>
            </div>
          </div>

          {/* Zone 2: Navigation Links for the 4 Mandatory Sections */}
          <nav className="hidden md:flex items-center gap-1">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{sec.label}</span>
                  {sec.id === 'general' && pendingCount > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-800'
                      }`}
                      title={`${pendingCount} casos pendientes de gestión`}
                    >
                      {pendingCount}
                    </span>
                  )}
                  {sec.id === 'reporteria' && (
                    <Sparkles className="w-3 h-3 text-indigo-400 opacity-90" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: User Role Switcher & Actions */}
          <div className="flex items-center gap-3 shrink-0">

            {/* Profile Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-all shadow-2xs hover:bg-slate-50 text-left"
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium leading-none">
                    {roleLabels[currentUser.role] || currentUser.role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Simular Usuario / Perfil
                      </p>
                      <p className="text-xs text-slate-600">
                        Cambia de perfil para probar la bandeja y dashboard de cada rol.
                      </p>
                    </div>

                    <div className="max-h-80 overflow-y-auto space-y-1 py-1">
                      {users.map((u) => {
                        const isSelected = u.id === currentUser.id;
                        return (
                          <button
                            key={u.id}
                            onClick={() => {
                              setCurrentUser(u);
                              setIsUserMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                              isSelected
                                ? 'bg-slate-900 text-white font-medium'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {u.name.charAt(0)}
                              </span>
                              <div className="truncate">
                                <div className="truncate">{u.name}</div>
                                <div className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                  {u.department}
                                </div>
                              </div>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border shrink-0 ${
                              isSelected ? 'bg-white/10 text-white border-white/20' : roleColors[u.role] || 'bg-slate-50'
                            }`}>
                              {roleLabels[u.role] || u.role}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center gap-1 py-2 overflow-x-auto border-t border-slate-100">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
};
