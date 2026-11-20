import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { User, UserRole, RolePermission } from '../../types';
import { 
  Users, 
  GitFork, 
  ShieldCheck, 
  History, 
  Plus, 
  Edit3, 
  Trash2, 
  Power, 
  Download, 
  Upload, 
  Search, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  ChevronRight,
  Shield,
  Key
} from 'lucide-react';
import { 
  exportDependenciesToExcel, 
  downloadDependencyTemplate, 
  parseDependenciesFromFile,
  downloadUserTemplate,
  parseUsersFromFile
} from '../../utils/excel';
import { ExcelImportModal } from '../common/ExcelImportModal';
import { SearchableSelect } from '../common/SearchableSelect';

export const AdminSection: React.FC = () => {
  const { 
    currentUser, 
    users, 
    addUser, 
    importUsersBulk,
    updateUser, 
    toggleUserStatus, 
    updateUserDependencies,
    roles, 
    addRole, 
    updateRole, 
    deleteRole,
    auditLogs,
    activeSubSection,
    setActiveSubSection,
    hasPermission,
  } = useApp();

  type AdminTab = 'usuarios' | 'dependencias' | 'roles' | 'bitacora';
  const canManageUsers = hasPermission('canManageUsers');
  const canManageDeps = hasPermission('canManageDependencies');
  const canManageRoles = hasPermission('canManageRoles');
  const canViewAuditLogs = hasPermission('canViewAuditLogs');
  const canEditDependencies = canManageDeps && currentUser.role === 'admin';

  const validAdminTabs: AdminTab[] = [
    ...(canManageUsers ? (['usuarios'] as AdminTab[]) : []),
    ...(canManageDeps ? (['dependencias'] as AdminTab[]) : []),
    ...(canManageRoles ? (['roles'] as AdminTab[]) : []),
    ...(canViewAuditLogs ? (['bitacora'] as AdminTab[]) : []),
  ];
  const adminTab = validAdminTabs.includes(activeSubSection as AdminTab)
    ? (activeSubSection as AdminTab)
    : validAdminTabs[0] || 'bitacora';
  const setAdminTab = (tab: AdminTab) => {
    if (validAdminTabs.includes(tab)) {
      setActiveSubSection(tab);
    }
  };
  const [showDepExcelImport, setShowDepExcelImport] = useState(false);
  const [depImportSuccessCount, setDepImportSuccessCount] = useState<number | null>(null);
  const [showUserExcelImport, setShowUserExcelImport] = useState(false);
  const [userImportSuccessCount, setUserImportSuccessCount] = useState<number | null>(null);

  // Dependency Registration / Edit Modal State
  const [depSearch, setDepSearch] = useState('');
  const [depTlFilter, setDepTlFilter] = useState<string>('ALL');
  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [editingDepAdvisor, setEditingDepAdvisor] = useState<User | null>(null);
  const [depFormError, setDepFormError] = useState<string | null>(null);
  const [depFormData, setDepFormData] = useState<{
    name: string;
    voiceName: string;
    email: string;
    reportsToId: string;
  }>({
    name: '',
    voiceName: '',
    email: '',
    reportsToId: '',
  });

  // User CRUD Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormData, setUserFormData] = useState<{
    name: string;
    voiceName: string;
    email: string;
    role: UserRole;
    phone: string;
    reportsToId: string;
  }>({
    name: '',
    voiceName: '',
    email: '',
    role: 'asesor',
    phone: '',
    reportsToId: '',
  });

  // User Filter & Search
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Role CRUD Modal State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RolePermission | null>(null);
  const [roleFormData, setRoleFormData] = useState<{
    name: string;
    description: string;
    permissions: Record<string, boolean>;
  }>({
    name: '',
    description: '',
    permissions: {},
  });

  // Bitacora Filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('ALL');

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const match =
          u.name.toLowerCase().includes(q) ||
          (u.voiceName || '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.employeeCode.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [users, userRoleFilter, userSearch]);

  // Candidates for Supervisor based on role rules:
  // - Asesor -> Must report to a Team Leader
  // - Team Leader -> Optional Coordinador
  // - Coordinador, Analista, Admin -> Unassigned (none)
  const supervisorCandidates = useMemo(() => {
    if (userFormData.role === 'asesor') {
      return users.filter((u) => u.role === 'team_leader' && u.status === 'active');
    }
    if (userFormData.role === 'team_leader') {
      return users.filter((u) => u.role === 'coordinador' && u.status === 'active');
    }
    return [];
  }, [users, userFormData.role]);

  // Active Team Leaders & Filtered Advisors for Gestión de Dependencias
  const teamLeaderCandidates = useMemo(
    () => users.filter((u) => u.role === 'team_leader' && u.status === 'active'),
    [users]
  );

  const allTeamLeaders = useMemo(
    () => users.filter((u) => u.role === 'team_leader'),
    [users]
  );

  const filteredDepAdvisors = useMemo(() => {
    return users
      .filter((u) => u.role === 'asesor')
      .filter((adv) => {
        if (depTlFilter === 'UNASSIGNED' && adv.reportsToId) return false;
        if (depTlFilter !== 'ALL' && depTlFilter !== 'UNASSIGNED' && adv.reportsToId !== depTlFilter) {
          return false;
        }
        if (depSearch.trim()) {
          const q = depSearch.toLowerCase();
          const supervisor = users.find((s) => s.id === adv.reportsToId);
          const match =
            adv.name.toLowerCase().includes(q) ||
            (adv.voiceName || '').toLowerCase().includes(q) ||
            adv.email.toLowerCase().includes(q) ||
            (supervisor?.name || '').toLowerCase().includes(q) ||
            (supervisor?.email || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });
  }, [users, depTlFilter, depSearch]);

  // Open Dependency Modal for Register or Edit Advisor Dependency
  const handleOpenDepModal = (advisor?: User) => {
    setDepFormError(null);
    if (advisor) {
      setEditingDepAdvisor(advisor);
      setDepFormData({
        name: advisor.name,
        voiceName: advisor.voiceName || '',
        email: advisor.email,
        reportsToId: advisor.reportsToId || '',
      });
    } else {
      setEditingDepAdvisor(null);
      setDepFormData({
        name: '',
        voiceName: '',
        email: '',
        reportsToId: '',
      });
    }
    setIsDepModalOpen(true);
  };

  const handleSaveDep = (e: React.FormEvent) => {
    e.preventDefault();
    setDepFormError(null);

    const cleanName = depFormData.name.trim().slice(0, 150);
    const cleanVoiceName = depFormData.voiceName.trim().slice(0, 150);
    const cleanEmail = depFormData.email.trim().toLowerCase().slice(0, 180);

    if (!cleanName) {
      setDepFormError('El Nombre del Asesor es obligatorio.');
      return;
    }
    if (!cleanVoiceName) {
      setDepFormError('El Nombre Voz es obligatorio.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setDepFormError('Ingresa un Correo Xtendo válido.');
      return;
    }
    if (!depFormData.reportsToId) {
      setDepFormError('Debes seleccionar el Correo Inmediato Superior (Team Leader).');
      return;
    }

    if (editingDepAdvisor) {
      const duplicate = users.find(
        (u) => u.id !== editingDepAdvisor.id && u.email.toLowerCase().trim() === cleanEmail
      );
      if (duplicate) {
        setDepFormError(`El correo "${cleanEmail}" ya se encuentra registrado en otro usuario.`);
        return;
      }

      updateUser({
        ...editingDepAdvisor,
        name: cleanName,
        voiceName: cleanVoiceName,
        email: cleanEmail,
        reportsToId: depFormData.reportsToId,
      });
    } else {
      const existingByEmail = users.find((u) => u.email.toLowerCase().trim() === cleanEmail);
      if (existingByEmail) {
        if (existingByEmail.role !== 'asesor') {
          setDepFormError(
            `El correo "${cleanEmail}" ya pertenece a un usuario con perfil "${existingByEmail.role}".`
          );
          return;
        }
        updateUser({
          ...existingByEmail,
          name: cleanName,
          voiceName: cleanVoiceName,
          email: cleanEmail,
          reportsToId: depFormData.reportsToId,
        });
      } else {
        addUser({
          name: cleanName,
          voiceName: cleanVoiceName,
          email: cleanEmail,
          employeeCode: `AGT-${Math.floor(1000 + Math.random() * 9000)}`,
          role: 'asesor',
          department: 'Operaciones',
          status: 'active',
          reportsToId: depFormData.reportsToId,
        });
      }
    }

    setIsDepModalOpen(false);
  };

  // Open User Modal for Create or Edit
  const handleOpenUserModal = (user?: User) => {
    setUserFormError(null);
    if (user) {
      setEditingUser(user);
      setUserFormData({
        name: user.name,
        voiceName: user.voiceName || '',
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        reportsToId: user.reportsToId || '',
      });
    } else {
      setEditingUser(null);
      setUserFormData({
        name: '',
        voiceName: '',
        email: '',
        role: 'asesor',
        phone: '',
        reportsToId: '',
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    if (userFormData.role === 'admin' && currentUser.role !== 'admin') {
      setUserFormError('El perfil Administrador solo puede ser creado o asignado por otro Administrador.');
      return;
    }

    // Solo el rol Asesor requiere obligatoriamente inmediato superior (Team Leader)
    if (userFormData.role === 'asesor' && !userFormData.reportsToId) {
      setUserFormError('Para el perfil Asesor es obligatorio asignar un inmediato superior (Team Leader).');
      return;
    }

    const payloadReportsToId =
      userFormData.role === 'asesor' || userFormData.role === 'team_leader'
        ? userFormData.reportsToId || undefined
        : undefined;

    const payloadVoiceName =
      userFormData.role === 'asesor'
        ? userFormData.voiceName.trim().slice(0, 150)
        : editingUser?.voiceName || '';

    if (editingUser) {
      updateUser({
        ...editingUser,
        name: userFormData.name.trim(),
        voiceName: payloadVoiceName,
        email: userFormData.email.trim(),
        employeeCode: editingUser.employeeCode?.trim() || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        role: userFormData.role,
        department: editingUser.department?.trim() || 'Operaciones',
        phone: userFormData.phone.trim(),
        reportsToId: payloadReportsToId,
      });
    } else {
      addUser({
        name: userFormData.name.trim(),
        voiceName: payloadVoiceName,
        email: userFormData.email.trim(),
        employeeCode: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        role: userFormData.role,
        department: 'Operaciones',
        phone: userFormData.phone.trim(),
        status: 'active',
        reportsToId: payloadReportsToId,
      });
    }

    setIsUserModalOpen(false);
  };

  // Manual reassign from Dependencies view
  const handleReassignSupervisor = (userId: string, newSupervisorId: string) => {
    const updated = users.map((u) => {
      if (u.id === userId) {
        return { ...u, reportsToId: newSupervisorId || undefined };
      }
      return u;
    });
    updateUserDependencies(updated);
  };

  // Open Role Modal
  const handleOpenRoleModal = (role?: RolePermission) => {
    if (role) {
      setEditingRole(role);
      setRoleFormData({
        name: role.name,
        description: role.description,
        permissions: { ...role.permissions },
      });
    } else {
      setEditingRole(null);
      setRoleFormData({
        name: '',
        description: '',
        permissions: {
          canViewAssignedInbox: true,
          canViewTeamDashboard: false,
          canViewExecutiveDashboard: false,
          canCreateMonitoring: false,
          canManageCategories: false,
          canGiveTLFeedback: false,
          canSignAgentCommitment: true,
          canViewReports: false,
          canExportReports: false,
          canUseAICoaching: true,
          canManageUsers: false,
          canManageDependencies: false,
          canManageRoles: false,
          canViewAuditLogs: false,
        },
      });
    }
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) return;

    if (editingRole) {
      updateRole({
        ...editingRole,
        name: roleFormData.name.trim(),
        description: roleFormData.description.trim(),
        permissions: roleFormData.permissions as any,
      });
    } else {
      addRole({
        roleKey: `custom_${Date.now()}`,
        name: roleFormData.name.trim(),
        description: roleFormData.description.trim(),
        isSystem: false,
        permissions: roleFormData.permissions as any,
      });
    }
    setIsRoleModalOpen(false);
  };

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditModuleFilter !== 'ALL' && log.module !== auditModuleFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const match =
          log.userName.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [auditLogs, auditModuleFilter, auditSearch]);

  const permissionLabels: Record<string, { label: string; module: string }> = {
    canViewAssignedInbox: { label: 'Ver Bandeja Operativa Asignada', module: 'General' },
    canViewTeamDashboard: { label: 'Ver Dashboard de Equipo (TL)', module: 'General' },
    canViewExecutiveDashboard: { label: 'Ver Dashboard Ejecutivo (Coordinador)', module: 'General' },
    canCreateMonitoring: { label: 'Cargar Monitoreos de Llamadas', module: 'Analista' },
    canManageCategories: { label: 'Administrar Árbol de Categorizaciones', module: 'Analista' },
    canGiveTLFeedback: { label: 'Registrar y Enviar Feedback de TL', module: 'General' },
    canSignAgentCommitment: { label: 'Firmar Compromiso de Mejora de Agente', module: 'General' },
    canViewReports: { label: 'Visualizar Módulo de Reportería', module: 'Reportería' },
    canExportReports: { label: 'Exportar Informes a Excel', module: 'Reportería' },
    canUseAICoaching: { label: 'Consultar Diagnóstico y Coaching IA', module: 'Reportería' },
    canManageUsers: { label: 'Gestionar Usuarios (Crear / Desactivar)', module: 'Administrador' },
    canManageDependencies: { label: 'Modificar Dependencias y Jerarquías', module: 'Administrador' },
    canManageRoles: { label: 'Gestionar Roles y Permisos', module: 'Administrador' },
    canViewAuditLogs: { label: 'Ver Bitácora de Auditoría del Sistema', module: 'Administrador' },
  };

  return (
    <div className="space-y-6">
      
      {/* Sub-Header Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Sección Administrador
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión integral de usuarios, dependencias operativas, matriz de roles y permisos, y bitácora de auditoría.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg shrink-0 flex-wrap gap-1">
          {canManageUsers && (
            <button
              onClick={() => setAdminTab('usuarios')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                adminTab === 'usuarios'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Usuarios</span>
            </button>
          )}
          {canManageDeps && (
            <button
              onClick={() => setAdminTab('dependencias')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                adminTab === 'dependencias'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Dependencias</span>
            </button>
          )}
          {canManageRoles && (
            <button
              onClick={() => setAdminTab('roles')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                adminTab === 'roles'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Roles y Permisos</span>
            </button>
          )}
          {canViewAuditLogs && (
            <button
              onClick={() => setAdminTab('bitacora')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                adminTab === 'bitacora'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Bitácora</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: GESTIÓN DE USUARIOS */}
      {adminTab === 'usuarios' && (
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar usuario..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                />
              </div>

              <SearchableSelect
                wrapperClassName="w-auto min-w-[180px]"
                dropdownMinWidth={210}
                value={userRoleFilter}
                onChange={setUserRoleFilter}
                searchPlaceholder="Buscar rol..."
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                options={[
                  { value: 'ALL', label: 'Todos los Roles' },
                  { value: 'asesor', label: 'Asesores' },
                  { value: 'team_leader', label: 'Team Leaders' },
                  { value: 'coordinador', label: 'Coordinadores' },
                  { value: 'analista', label: 'Analistas de Experiencia' },
                  { value: 'admin', label: 'Administradores' },
                ]}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => {
                  setUserImportSuccessCount(null);
                  setShowUserExcelImport(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Carga Masiva Excel</span>
              </button>

              <button
                onClick={() => handleOpenUserModal()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Usuario</span>
              </button>
            </div>
          </div>

          {userImportSuccessCount !== null && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>¡Usuarios cargados desde Excel!</strong> Se registraron{' '}
                  <strong>{userImportSuccessCount}</strong> usuarios nuevos. Para Asesores y Team Leaders puedes asignar su dependencia directamente en la tabla.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUserImportSuccessCount(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="py-3 px-4">Correo</th>
                    <th className="py-3 px-4">Nombre</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Dependencia</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const isAsesor = u.role === 'asesor';
                    const isTL = u.role === 'team_leader';
                    const roleLabelMap: Record<UserRole, string> = {
                      asesor: 'Asesor',
                      team_leader: 'Team Leader',
                      coordinador: 'Coordinador',
                      analista: 'Analista',
                      admin: 'Admin',
                    };
                    const depCandidates = isAsesor
                      ? users.filter((sup) => sup.role === 'team_leader' && sup.status === 'active')
                      : isTL
                      ? users.filter((sup) => sup.role === 'coordinador' && sup.status === 'active')
                      : [];
                    const supervisor = users.find((sup) => sup.id === u.reportsToId);

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-700">
                          {u.email}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-900">
                          {u.name}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            u.role === 'admin'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : u.role === 'coordinador'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : u.role === 'team_leader'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : u.role === 'analista'
                              ? 'bg-teal-50 text-teal-800 border-teal-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {roleLabelMap[u.role] || u.role}
                          </span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isAsesor || isTL ? (
                            <SearchableSelect
                              wrapperClassName="w-[210px]"
                              dropdownMinWidth={230}
                              value={u.reportsToId || ''}
                              onChange={(val) => handleReassignSupervisor(u.id, val)}
                              searchPlaceholder={`Buscar ${isAsesor ? 'Team Leader' : 'Coordinador'}...`}
                              className={`w-full px-2 py-1 rounded-md border text-[11px] font-medium ${
                                !supervisor
                                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                                  : 'bg-white border-slate-200 text-slate-800'
                              }`}
                              title={isAsesor ? 'Team Leader asignado' : 'Coordinador asignado'}
                              options={[
                                {
                                  value: '',
                                  label: `-- Asignar ${isAsesor ? 'Team Leader' : 'Coordinador'} --`,
                                },
                                ...depCandidates.map((sup) => ({
                                  value: sup.id,
                                  label: sup.name,
                                  searchText: sup.email,
                                })),
                              ]}
                            />
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">N/A (Nivel Autónomo)</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => toggleUserStatus(u.id)}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              u.status === 'active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Haz clic para activar/desactivar"
                          >
                            {u.status === 'active' ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenUserModal(u)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                              title="Editar Usuario"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleUserStatus(u.id)}
                              className={`p-1.5 rounded-md ${
                                u.status === 'active'
                                  ? 'text-rose-500 hover:bg-rose-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={u.status === 'active' ? 'Desactivar Usuario' : 'Activar Usuario'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: GESTIÓN DE DEPENDENCIAS (MANUAL + EXCEL) */}
      {adminTab === 'dependencias' && (
        <div className="space-y-4">
          
          {/* Action Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Gestión de Dependencias
              </h2>
              <p className="text-xs text-slate-500">
                Registro y asignación de asesores: <strong>Nombre del Asesor</strong>, <strong>Nombre Voz</strong>, <strong>Correo Xtendo</strong> y <strong>Correo Inmediato Superior (Team Leader)</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                onClick={() => exportDependenciesToExcel(users)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar a Excel</span>
              </button>

              {canEditDependencies && (
                <>
                  <button
                    onClick={() => {
                      setDepImportSuccessCount(null);
                      setShowDepExcelImport(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Carga Masiva Excel</span>
                  </button>

                  <button
                    onClick={() => handleOpenDepModal()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registrar Dependencia</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {!canEditDependencies && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              Vista de dependencias en modo consulta. El registro o modificación de dependencias requiere perfil <strong>Administrador</strong>.
            </div>
          )}

          {depImportSuccessCount !== null && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>¡Dependencias procesadas desde Excel!</strong> Se registraron o actualizaron{' '}
                  <strong>{depImportSuccessCount}</strong> registros de asesores.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDepImportSuccessCount(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filters & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por asesor, Nombre Voz, correo o Team Leader..."
                  value={depSearch}
                  onChange={(e) => setDepSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                />
              </div>

              <SearchableSelect
                wrapperClassName="w-full sm:w-auto min-w-[230px]"
                dropdownMinWidth={270}
                value={depTlFilter}
                onChange={setDepTlFilter}
                searchPlaceholder="Buscar Team Leader..."
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                options={[
                  { value: 'ALL', label: 'Todos los Team Leaders' },
                  { value: 'UNASSIGNED', label: 'Sin Team Leader asignado' },
                  ...allTeamLeaders.map((tl) => ({
                    value: tl.id,
                    label: tl.email ? `${tl.email} (${tl.name})` : tl.name,
                    searchText: `${tl.name} ${tl.email}`,
                  })),
                ]}
              />
            </div>

            <span className="text-xs text-slate-500 font-mono shrink-0">
              {filteredDepAdvisors.length} asesores registrados
            </span>
          </div>

          {/* Dependencies Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="py-3 px-4">Nombre del Asesor</th>
                    <th className="py-3 px-4">Nombre Voz</th>
                    <th className="py-3 px-4">Correo Xtendo</th>
                    <th className="py-3 px-4">Correo Inmediato Superior (Team Leader)</th>
                    {canEditDependencies && <th className="py-3 px-4 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDepAdvisors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEditDependencies ? 5 : 4}
                        className="py-10 px-4 text-center text-slate-400 text-xs"
                      >
                        No hay asesores registrados que coincidan con los filtros seleccionados. Usa <strong>Registrar Dependencia</strong> o <strong>Carga Masiva Excel</strong> para agregar registros.
                      </td>
                    </tr>
                  ) : (
                    filteredDepAdvisors.map((adv) => {
                      const supervisor = users.find((sup) => sup.id === adv.reportsToId);
                      const tlOptions = teamLeaderCandidates.some((t) => t.id === adv.reportsToId)
                        ? teamLeaderCandidates
                        : supervisor
                        ? [supervisor, ...teamLeaderCandidates]
                        : teamLeaderCandidates;

                      return (
                        <tr key={adv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{adv.name}</span>
                              {adv.status === 'inactive' && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[10px]">
                                  Inactivo
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                            {adv.voiceName ? (
                              adv.voiceName
                            ) : (
                              <span className="text-slate-400 italic">Sin registrar</span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-700">
                            {adv.email || '—'}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {canEditDependencies ? (
                              <SearchableSelect
                                wrapperClassName="w-[290px]"
                                dropdownMinWidth={310}
                                value={adv.reportsToId || ''}
                                onChange={(val) => handleReassignSupervisor(adv.id, val)}
                                searchPlaceholder="Buscar correo o nombre de Team Leader..."
                                className={`w-full px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                                  !supervisor
                                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                                title="Correo Inmediato Superior (Team Leader)"
                                options={[
                                  {
                                    value: '',
                                    label: '-- Asignar Team Leader --',
                                  },
                                  ...tlOptions.map((tl) => ({
                                    value: tl.id,
                                    label: tl.email ? `${tl.email} (${tl.name})` : tl.name,
                                    searchText: `${tl.email} ${tl.name}`,
                                  })),
                                ]}
                              />
                            ) : supervisor ? (
                              <span className="font-mono text-[11px] text-slate-700">
                                {supervisor.email
                                  ? `${supervisor.email} (${supervisor.name})`
                                  : supervisor.name}
                              </span>
                            ) : (
                              <span className="text-rose-600 text-[11px] font-medium">
                                Sin asignar
                              </span>
                            )}
                          </td>

                          {canEditDependencies && (
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleOpenDepModal(adv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md text-[11px] font-medium transition-colors"
                                title="Editar registro de dependencia"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: ROLES Y PERMISOS */}
      {adminTab === 'roles' && (
        <div className="space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Matriz de Roles y Permisos del Sistema
              </h2>
              <p className="text-xs text-slate-500">
                Configura los privilegios granulares por módulo para roles predefinidos o personalizados.
              </p>
            </div>

            <button
              onClick={() => handleOpenRoleModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Nuevo Rol</span>
            </button>
          </div>

          {/* Roles Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) => (
              <div
                key={role.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{role.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                        {role.roleKey}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{role.description}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenRoleModal(role)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                      title="Editar Permisos"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el rol "${role.name}"?`)) {
                            deleteRole(role.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                        title="Eliminar Rol"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                    Permisos Asignados
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {Object.entries(role.permissions).map(([permKey, isEnabled]) => {
                      const def = permissionLabels[permKey] || { label: permKey, module: 'General' };
                      return (
                        <div
                          key={permKey}
                          className={`flex items-center gap-1.5 p-1 rounded ${
                            isEnabled ? 'text-slate-800' : 'text-slate-400 line-through opacity-60'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                              isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {isEnabled ? '✓' : '✕'}
                          </span>
                          <span className="text-[11px] truncate">{def.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 4: BITÁCORA DEL SISTEMA (AUDIT LOGS) */}
      {adminTab === 'bitacora' && (
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar en bitácora por usuario, acción o detalle..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                />
              </div>

              <SearchableSelect
                wrapperClassName="w-auto min-w-[175px]"
                dropdownMinWidth={200}
                value={auditModuleFilter}
                onChange={setAuditModuleFilter}
                searchPlaceholder="Buscar módulo..."
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                options={[
                  { value: 'ALL', label: 'Todos los Módulos' },
                  { value: 'General', label: 'General' },
                  { value: 'Analista', label: 'Analista' },
                  { value: 'Reportería', label: 'Reportería' },
                  { value: 'Administrador', label: 'Administrador' },
                ]}
              />
            </div>

            <span className="text-xs text-slate-500 font-mono shrink-0">
              {filteredAuditLogs.length} eventos registrados
            </span>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Usuario & Rol</th>
                    <th className="py-2.5 px-3">Módulo</th>
                    <th className="py-2.5 px-3">Acción Realizada</th>
                    <th className="py-2.5 px-3">Detalle del Cambio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 block">{log.userName}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{log.userRole}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {log.module}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-md">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: CREATE / EDIT USER */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {editingUser ? 'Modificar Usuario' : 'Crear Nuevo Usuario'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Ingresa los datos del empleado y su dependencia jerárquica correspondiente.
            </p>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              {userFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{userFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              {userFormData.role === 'asesor' && (
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nombre Voz</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={userFormData.voiceName}
                    onChange={(e) => setUserFormData({ ...userFormData, voiceName: e.target.value })}
                    placeholder="Nombre registrado en plataforma de Voz"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    maxLength={180}
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Rol en el Sistema *</label>
                  <SearchableSelect
                    value={userFormData.role}
                    onChange={(val) => {
                      setUserFormError(null);
                      setUserFormData({
                        ...userFormData,
                        role: val as any,
                        reportsToId: '', // Reset supervisor on role change
                      });
                    }}
                    searchPlaceholder="Buscar rol..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    options={[
                      { value: 'asesor', label: 'Asesor' },
                      { value: 'team_leader', label: 'Team Leader' },
                      { value: 'coordinador', label: 'Coordinador' },
                      { value: 'analista', label: 'Analista' },
                      ...(currentUser.role === 'admin'
                        ? [{ value: 'admin', label: 'Admin' }]
                        : []),
                    ]}
                  />
                </div>
              </div>

              {/* DEPENDENCY SELECTION (Mandatory only for Asesor) */}
              {(userFormData.role === 'asesor' || userFormData.role === 'team_leader') && (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1">
                  <label className="block font-bold text-blue-900">
                    {userFormData.role === 'asesor'
                      ? 'Inmediato Superior (Team Leader) * (Obligatorio para Asesor)'
                      : 'Inmediato Superior (Coordinador) (Opcional)'}
                  </label>
                  <SearchableSelect
                    required={userFormData.role === 'asesor'}
                    value={userFormData.reportsToId}
                    onChange={(val) => {
                      setUserFormError(null);
                      setUserFormData({ ...userFormData, reportsToId: val });
                    }}
                    placeholder={`-- Seleccionar ${userFormData.role === 'asesor' ? 'Team Leader' : 'Coordinador'} --`}
                    searchPlaceholder={`Buscar ${userFormData.role === 'asesor' ? 'Team Leader' : 'Coordinador'}...`}
                    className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-slate-800"
                    options={[
                      {
                        value: '',
                        label:
                          userFormData.role === 'asesor'
                            ? '-- Seleccionar Team Leader --'
                            : '-- Sin coordinador asignado (opcional) --',
                      },
                      ...supervisorCandidates.map((sup) => ({
                        value: sup.id,
                        label: sup.name,
                        searchText: sup.email,
                      })),
                    ]}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-2xs"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT ROLE */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {editingRole ? `Editar Rol: ${editingRole.name}` : 'Crear Nuevo Rol'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Establece el nombre y selecciona los permisos activos en cada módulo.
            </p>

            <form onSubmit={handleSaveRole} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nombre del Rol *</label>
                <input
                  type="text"
                  required
                  value={roleFormData.name}
                  onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                  placeholder="Ej: Auditor Externo, Monitor Especial..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descripción</label>
                <input
                  type="text"
                  value={roleFormData.description}
                  onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  placeholder="Finalidad del rol..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <span className="font-bold text-slate-900 block mb-2">Permisos Granulares:</span>
                <div className="space-y-2 max-h-60 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {Object.entries(permissionLabels).map(([permKey, meta]) => {
                    const isChecked = !!roleFormData.permissions[permKey];
                    return (
                      <label
                        key={permKey}
                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <div>
                          <span className="font-semibold text-slate-800 block">{meta.label}</span>
                          <span className="text-[10px] text-slate-400">Módulo: {meta.module}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setRoleFormData({
                              ...roleFormData,
                              permissions: {
                                ...roleFormData.permissions,
                                [permKey]: e.target.checked,
                              },
                            });
                          }}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-2xs"
                >
                  Guardar Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER / EDIT ADVISOR DEPENDENCY */}
      {isDepModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {editingDepAdvisor ? 'Editar Dependencia de Asesor' : 'Registrar Dependencia de Asesor'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Completa el Nombre del Asesor, Nombre Voz, Correo Xtendo y su Correo Inmediato Superior (Team Leader).
            </p>

            <form onSubmit={handleSaveDep} className="space-y-3.5 text-xs">
              {depFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{depFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">Nombre del Asesor *</label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={depFormData.name}
                  onChange={(e) => setDepFormData({ ...depFormData, name: e.target.value })}
                  placeholder="Ej: Carlos Méndez"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Nombre Voz *</label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={depFormData.voiceName}
                  onChange={(e) => setDepFormData({ ...depFormData, voiceName: e.target.value })}
                  placeholder="Ej: Carlos Mendez Voz"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Correo Xtendo *</label>
                <input
                  type="email"
                  required
                  maxLength={180}
                  value={depFormData.email}
                  onChange={(e) => setDepFormData({ ...depFormData, email: e.target.value })}
                  placeholder="asesor@xtendo-it.com"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1">
                <label className="block font-bold text-blue-900">
                  Correo Inmediato Superior (Team Leader) *
                </label>
                <SearchableSelect
                  required
                  value={depFormData.reportsToId}
                  onChange={(val) => {
                    setDepFormError(null);
                    setDepFormData({ ...depFormData, reportsToId: val });
                  }}
                  placeholder="-- Seleccionar Correo Team Leader --"
                  searchPlaceholder="Buscar por correo o nombre de Team Leader..."
                  className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-slate-800"
                  options={[
                    { value: '', label: '-- Seleccionar Correo Team Leader --' },
                    ...teamLeaderCandidates.map((tl) => ({
                      value: tl.id,
                      label: tl.email ? `${tl.email} (${tl.name})` : tl.name,
                      searchText: `${tl.email} ${tl.name}`,
                    })),
                  ]}
                />
                {teamLeaderCandidates.length === 0 && (
                  <p className="text-[11px] text-amber-700 pt-1">
                    Primero debes tener al menos un usuario activo con rol <strong>Team Leader</strong> en la pestaña Usuarios.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDepModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-2xs"
                >
                  Guardar Dependencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCEL IMPORT FOR DEPENDENCIES */}
      {showDepExcelImport && (
        <ExcelImportModal
          title="Carga Masiva de Dependencias"
          description="Sube un archivo Excel (.xlsx, .xls, .csv) con Nombre del Asesor, Nombre Voz, Correo Xtendo y Correo Inmediato Superior (Team Leader)."
          sampleColumns={[
            'Nombre del Asesor',
            'Nombre Voz',
            'Correo Xtendo',
            'Correo Inmediato Superior (Team Leader)',
          ]}
          onDownloadTemplate={() => downloadDependencyTemplate()}
          onProcessFile={async (file) => {
            const res = await parseDependenciesFromFile(file, users);
            if (res.success && res.changesApplied > 0) {
              updateUserDependencies(res.updatedUsers);
              setDepImportSuccessCount(res.changesApplied);
            }
            return {
              success: res.success,
              rowCount: res.changesApplied,
              errors: res.errors,
            };
          }}
          onClose={() => setShowDepExcelImport(false)}
        />
      )}

      {/* MODAL: EXCEL IMPORT FOR USERS */}
      {showUserExcelImport && (
        <ExcelImportModal
          title="Carga Masiva de Usuarios"
          description="Sube un archivo Excel (.xlsx, .xls, .csv) con Correo Xtendo, Nombre y Rol (Asesor, Team Leader, Analista o Coordinador). El perfil Admin solo puede ser creado manualmente por otro Admin."
          sampleColumns={['Correo Xtendo', 'Nombre', 'Rol']}
          onDownloadTemplate={() => downloadUserTemplate()}
          onProcessFile={async (file) => {
            const res = await parseUsersFromFile(file, users);
            if (res.success && res.users.length > 0) {
              importUsersBulk(res.users);
              setUserImportSuccessCount(res.users.length);
            }
            return {
              success: res.success,
              rowCount: res.users.length,
              errors: res.errors,
            };
          }}
          onClose={() => setShowUserExcelImport(false)}
        />
      )}

    </div>
  );
};
