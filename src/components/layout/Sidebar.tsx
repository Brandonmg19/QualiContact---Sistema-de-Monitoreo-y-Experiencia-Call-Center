import React, { useState } from 'react';
import { useApp, MainSection } from '../../context/AppContext';
import { 
  Inbox, 
  FileSpreadsheet, 
  BarChart3, 
  ShieldCheck, 
  Sparkles, 
  ChevronDown, 
  ChevronRight,
  RotateCcw, 
  X,
  UserCheck,
  LayoutDashboard,
  FolderTree,
  LineChart,
  Bot,
  Users,
  GitFork,
  Key,
  History,
  Tag,
  LogOut
} from 'lucide-react';
import { NexaLogo } from '../common/NexaLogo';

interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface SubSectionItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  highlight?: boolean;
}

interface MainSectionItem {
  id: MainSection;
  label: string;
  icon: React.ElementType;
  subsections: SubSectionItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const { 
    authUserProfile,
    signOutUser,
    currentUser, 
    setCurrentUser, 
    users, 
    activeSection, 
    activeSubSection,
    navigateTo,
    hasPermission,
    canAccessSubSection,
    clearAllRecords,
    monitorings,
    categories,
    pendingAnalyses,
    contactReasons,
  } = useApp();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const isRealAdmin = authUserProfile?.role === 'admin';

  // Expanded sections state (default: all expanded or active section expanded)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: true,
    analista: true,
    reporteria: true,
    administrador: true,
  });

  const toggleSectionExpand = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const canViewInbox = hasPermission('canViewAssignedInbox');
  const canCreateMon = hasPermission('canCreateMonitoring');
  const analystPendingCount = canCreateMon
    ? pendingAnalyses.filter((p) => p.status === 'PENDIENTE').length
    : 0;

  // Compute pending actions count for current user
  const inboxPendingCount = canViewInbox
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

  const pendingCount = inboxPendingCount + (currentUser.role === 'analista' ? analystPendingCount : 0);

  const rawMenuStructure: MainSectionItem[] = [
    {
      id: 'general',
      label: 'Sección General',
      icon: Inbox,
      subsections: [
        {
          id: 'bandeja',
          label: 'Bandeja de Monitoreos',
          icon: Inbox,
          badge: inboxPendingCount > 0 ? inboxPendingCount : undefined,
        },
        {
          id: 'dashboard',
          label: 'Dashboard por Perfil',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: 'analista',
      label: 'Sección Analista',
      icon: FileSpreadsheet,
      subsections: [
        {
          id: 'bandeja_analista',
          label: 'Bandeja de Pendientes',
          icon: Inbox,
          badge: analystPendingCount > 0 ? analystPendingCount : undefined,
          highlight: analystPendingCount > 0,
        },
        {
          id: 'encuestas',
          label: 'Carga de Encuestas (NPS)',
          icon: Sparkles,
        },
        {
          id: 'categorizaciones',
          label: 'Gestión de Categorizaciones',
          icon: FolderTree,
          badge: categories.length,
        },
        {
          id: 'motivos_contacto',
          label: 'Gestión de Motivo de contacto',
          icon: Tag,
          badge: contactReasons.length,
        },
      ],
    },
    {
      id: 'reporteria',
      label: 'Sección Reportería',
      icon: BarChart3,
      subsections: [
        {
          id: 'metricas',
          label: 'Métricas & Reportes',
          icon: LineChart,
        },
        {
          id: 'ia',
          label: 'Consultor IA (Gemini)',
          icon: Bot,
          highlight: true,
        },
      ],
    },
    {
      id: 'administrador',
      label: 'Sección Administrador',
      icon: ShieldCheck,
      subsections: [
        {
          id: 'usuarios',
          label: 'Gestión de Usuarios',
          icon: Users,
        },
        {
          id: 'dependencias',
          label: 'Gestión de Dependencias',
          icon: GitFork,
        },
        {
          id: 'roles',
          label: 'Roles y Permisos',
          icon: Key,
        },
        {
          id: 'bitacora',
          label: 'Bitácora del Sistema',
          icon: History,
        },
      ],
    },
  ];

  const menuStructure: MainSectionItem[] = rawMenuStructure
    .map((sec) => ({
      ...sec,
      subsections: sec.subsections.filter((sub) => canAccessSubSection(sec.id, sub.id)),
    }))
    .filter((sec) => sec.subsections.length > 0);

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

  const handleSubSectionClick = (sectionId: MainSection, subId: string) => {
    navigateTo(sectionId, subId);
    onCloseMobile();
  };

  const handleMainSectionHeaderClick = (sectionId: MainSection, firstSubId: string) => {
    // If not active, navigate to it and ensure it's expanded
    if (activeSection !== sectionId) {
      navigateTo(sectionId, firstSubId);
      setExpandedSections((prev) => ({ ...prev, [sectionId]: true }));
    } else {
      // If already active, toggle expand/collapse
      setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-slate-200 
        flex flex-col justify-between transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto shrink-0 select-none
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>
        
        {/* Top: Brand & Hierarchical Navigation */}
        <div className="flex flex-col flex-1 min-h-0">
          
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <NexaLogo size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight text-slate-900 truncate">
                    NEXA-CX
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate leading-none">
                  Gestión de Experiencia
                </div>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button 
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tree with Subsections */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
            
            <div className="px-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Módulos y Subsecciones
              </span>
            </div>

            <nav className="space-y-3">
              {menuStructure.map((sec) => {
                const isSectionActive = activeSection === sec.id;
                const isExpanded = expandedSections[sec.id] ?? true;
                const MainIcon = sec.icon;

                return (
                  <div key={sec.id} className="space-y-1">
                    
                    {/* Main Section Header Button */}
                    <button
                      onClick={() => handleMainSectionHeaderClick(sec.id, sec.subsections[0].id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors group ${
                        isSectionActive
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                          isSectionActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        }`}>
                          <MainIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs tracking-tight truncate">
                          {sec.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {sec.id === 'general' && pendingCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                            {pendingCount}
                          </span>
                        )}
                        <span 
                          onClick={(e) => toggleSectionExpand(sec.id, e)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </div>
                    </button>

                    {/* Subsections List (Indented under parent) */}
                    {isExpanded && (
                      <div className="pl-4 pr-1 space-y-0.5 border-l-2 border-slate-200 ml-4 py-0.5 animate-in fade-in duration-150">
                        {sec.subsections.map((sub) => {
                          const isSubActive = isSectionActive && activeSubSection === sub.id;
                          const SubIcon = sub.icon;

                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleSubSectionClick(sec.id, sub.id)}
                              className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-md text-left transition-all ${
                                isSubActive
                                  ? 'bg-slate-900 text-white font-medium shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <SubIcon className={`w-3.5 h-3.5 shrink-0 ${
                                  isSubActive ? 'text-white' : sub.highlight ? 'text-indigo-500' : 'text-slate-400'
                                }`} />
                                <span className="text-xs truncate">
                                  {sub.label}
                                </span>
                              </div>

                              <div className="shrink-0 ml-1">
                                {sub.badge !== undefined && (
                                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                                    isSubActive 
                                      ? 'bg-white/20 text-white' 
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}>
                                    {sub.badge}
                                  </span>
                                )}
                                {sub.highlight && (
                                  <Sparkles className={`w-3 h-3 ${isSubActive ? 'text-indigo-300' : 'text-indigo-500'}`} />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })}
            </nav>

          </div>

        </div>

        {/* Bottom Section: Active Profile, Admin Preview Switcher & Sign Out */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 space-y-2 shrink-0">
          
          {/* User Profile Card */}
          <div className="relative">
            {isRealAdmin ? (
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs hover:bg-slate-50 transition-all text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate leading-tight">
                      {currentUser.name}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                      {roleLabels[currentUser.role] || currentUser.role}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </button>
            ) : (
              <div className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200 shadow-2xs text-left">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                    {roleLabels[currentUser.role] || currentUser.role}
                  </div>
                </div>
              </div>
            )}

            {/* Admin-only User Preview Dropdown */}
            {isRealAdmin && isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Vista Previa de Perfil (Admin)
                    </p>
                    <p className="text-xs text-slate-600">
                      Selecciona un usuario para revisar su bandeja y permisos:
                    </p>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1 py-1">
                    {users.map((u) => {
                      const isSelected = u.id === currentUser.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
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
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {u.name.charAt(0)}
                            </span>
                            <div className="truncate">
                              <div className="truncate text-xs">{u.name}</div>
                              <div className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                {u.department}
                              </div>
                            </div>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-sm border shrink-0 ${
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

          {/* Admin-only Clear All Records */}
          {isRealAdmin && (
            confirmResetOpen ? (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 space-y-1.5">
                <p className="text-[11px] text-rose-900 font-medium leading-tight">
                  ¿Eliminar todos los registros (usuarios, encuestas, monitoreos, pendientes y catálogos) y dejar solo tu Administrador?
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmResetOpen(false);
                      void clearAllRecords();
                    }}
                    className="flex-1 py-1 px-2 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(false)}
                    className="py-1 px-2 rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                title="Vaciar todos los registros cargados"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Vaciar Todos los Registros</span>
              </button>
            )
          )}

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>

        </div>

      </aside>
    </>
  );
};
