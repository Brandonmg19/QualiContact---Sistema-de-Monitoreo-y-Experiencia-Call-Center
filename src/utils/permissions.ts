import { INITIAL_ROLE_PERMISSIONS } from '../data/initialData';
import { RolePermission, UserRole } from '../types';

export type MainSection = 'general' | 'analista' | 'reporteria' | 'administrador';

export type PermissionKey = keyof RolePermission['permissions'];

export const SECTION_SUBSECTIONS: Record<MainSection, string[]> = {
  general: ['bandeja', 'dashboard'],
  analista: ['bandeja_analista', 'encuestas', 'categorizaciones', 'motivos_contacto'],
  reporteria: ['metricas', 'ia'],
  administrador: ['usuarios', 'dependencias', 'roles', 'bitacora'],
};

const EMPTY_PERMISSIONS: RolePermission['permissions'] = {
  canViewAssignedInbox: false,
  canViewTeamDashboard: false,
  canViewExecutiveDashboard: false,
  canCreateMonitoring: false,
  canManageCategories: false,
  canGiveTLFeedback: false,
  canSignAgentCommitment: false,
  canViewReports: false,
  canExportReports: false,
  canUseAICoaching: false,
  canManageUsers: false,
  canManageDependencies: false,
  canManageRoles: false,
  canViewAuditLogs: false,
};

export function resolveRolePermissions(
  roleKey: UserRole | string,
  roles: RolePermission[]
): RolePermission['permissions'] {
  const fromDb = roles.find((r) => r.roleKey === roleKey);
  if (fromDb?.permissions) {
    return { ...EMPTY_PERMISSIONS, ...fromDb.permissions };
  }

  const fromInitial = INITIAL_ROLE_PERMISSIONS.find((r) => r.roleKey === roleKey);
  if (fromInitial?.permissions) {
    return { ...EMPTY_PERMISSIONS, ...fromInitial.permissions };
  }

  return { ...EMPTY_PERMISSIONS };
}

export function canAccessSubSectionForRole(
  roleKey: UserRole | string,
  perms: RolePermission['permissions'],
  section: MainSection,
  subSection: string
): boolean {
  switch (section) {
    case 'general':
      if (subSection === 'bandeja') {
        return Boolean(perms.canViewAssignedInbox);
      }
      if (subSection === 'dashboard') {
        return Boolean(
          perms.canViewTeamDashboard ||
            perms.canViewExecutiveDashboard ||
            (roleKey === 'asesor' && perms.canViewAssignedInbox)
        );
      }
      return false;

    case 'analista':
      if (subSection === 'bandeja_analista' || subSection === 'encuestas') {
        return Boolean(perms.canCreateMonitoring);
      }
      if (subSection === 'categorizaciones' || subSection === 'motivos_contacto') {
        return Boolean(perms.canManageCategories);
      }
      return false;

    case 'reporteria':
      if (subSection === 'metricas') {
        return Boolean(perms.canViewReports);
      }
      if (subSection === 'ia') {
        return Boolean(perms.canUseAICoaching);
      }
      return false;

    case 'administrador':
      if (subSection === 'usuarios') {
        return Boolean(perms.canManageUsers);
      }
      if (subSection === 'dependencias') {
        return Boolean(perms.canManageDependencies);
      }
      if (subSection === 'roles') {
        return Boolean(perms.canManageRoles);
      }
      if (subSection === 'bitacora') {
        return Boolean(perms.canViewAuditLogs);
      }
      return false;

    default:
      return false;
  }
}

export function getAllowedSubSectionsForSection(
  roleKey: UserRole | string,
  perms: RolePermission['permissions'],
  section: MainSection
): string[] {
  return SECTION_SUBSECTIONS[section].filter((sub) =>
    canAccessSubSectionForRole(roleKey, perms, section, sub)
  );
}

export function canAccessSectionForRole(
  roleKey: UserRole | string,
  perms: RolePermission['permissions'],
  section: MainSection
): boolean {
  return getAllowedSubSectionsForSection(roleKey, perms, section).length > 0;
}

export function getFirstAllowedRouteForRole(
  roleKey: UserRole | string,
  perms: RolePermission['permissions']
): { section: MainSection; sub: string } {
  const preferredOrder: MainSection[] =
    roleKey === 'analista'
      ? ['analista', 'general', 'reporteria', 'administrador']
      : roleKey === 'coordinador'
      ? ['reporteria', 'general', 'administrador', 'analista']
      : roleKey === 'admin'
      ? ['administrador', 'general', 'analista', 'reporteria']
      : ['general', 'reporteria', 'analista', 'administrador'];

  for (const section of preferredOrder) {
    const allowedSubs = getAllowedSubSectionsForSection(roleKey, perms, section);
    if (allowedSubs.length > 0) {
      return { section, sub: allowedSubs[0] };
    }
  }

  return { section: 'general', sub: 'bandeja' };
}
