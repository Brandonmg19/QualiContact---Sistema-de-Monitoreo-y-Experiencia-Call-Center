import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import {
  resolveUserSession,
  loadWorkspaceData,
  loadSurveysBatch,
  clearAllRecords as clearAllRecordsInDb,
  persistUserCreate,
  persistUsersBulk,
  persistUserUpdate,
  persistUserDependenciesBatch,
  persistCategoryUpsert,
  persistCategoryDelete,
  persistCategoriesReplaceAll,
  persistContactReasonUpsert,
  persistContactReasonDelete,
  persistContactReasonsReplaceAll,
  persistMonitoringCreate,
  persistMonitoringTLFeedback,
  persistMonitoringAgentCommitment,
  persistMonitoringRefutation,
  persistMonitoringResolveRefutation,
  persistSurveysAndPendingImport,
  persistClearSurveys,
  persistPendingCreate,
  persistPendingComplete,
  persistPendingDelete,
  persistRoleUpsert,
  persistRoleDelete,
  persistAuditLog,
  sanitizeDocId,
} from '../lib/firestoreSync';
import {
  User,
  CategoryItem,
  MonitoringItem,
  AuditLog,
  RolePermission,
  MonitoringStatus,
  SurveyItem,
  PendingAnalysisItem,
  ContactReasonItem,
  RefutationEntry,
  AreaImputable,
} from '../types';

import {
  MainSection,
  PermissionKey,
  resolveRolePermissions,
  canAccessSubSectionForRole,
  canAccessSectionForRole,
  getAllowedSubSectionsForSection,
  getFirstAllowedRouteForRole,
} from '../utils/permissions';

export type { MainSection, PermissionKey };

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'verification_pending'
  | 'unauthorized'
  | 'inactive'
  | 'ready';

const EMPTY_FALLBACK_USER: User = {
  id: '',
  name: 'Usuario',
  email: '',
  employeeCode: '',
  role: 'asesor',
  status: 'active',
  department: '',
};

interface AppContextType {
  // Auth & Sync
  authStatus: AuthStatus;
  authEmail: string;
  authError: string | null;
  authNotice: string | null;
  clearAuthNotice: () => void;
  authUserProfile: User | null;
  isSyncing: boolean;
  syncError: string | null;
  clearSyncError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  registerWithEmailPassword: (email: string, password: string) => Promise<void>;
  resetPasswordWithEmail: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  verifyEmailAndContinue: () => Promise<void>;
  setAccountPassword: (newPassword: string) => Promise<{ ok: boolean; message: string }>;
  signOutUser: () => Promise<void>;
  refreshData: () => Promise<void>;

  currentUser: User;
  setCurrentUser: (user: User) => void;
  currentPermissions: RolePermission['permissions'];
  hasPermission: (key: PermissionKey) => boolean;
  canAccessSection: (section: MainSection) => boolean;
  canAccessSubSection: (section: MainSection, subSection: string) => boolean;
  activeSection: MainSection;
  setActiveSection: (section: MainSection) => void;
  activeSubSection: string;
  setActiveSubSection: (subsection: string) => void;
  navigateTo: (section: MainSection, subsection?: string) => void;

  // Users
  users: User[];
  addUser: (user: Omit<User, 'id'>) => void;
  importUsersBulk: (newUsers: Omit<User, 'id'>[]) => void;
  updateUser: (user: User) => void;
  toggleUserStatus: (userId: string) => void;
  updateUserDependencies: (updatedUsers: User[]) => void;

  // Categories
  categories: CategoryItem[];
  addCategory: (name: string, code?: string) => void;
  editCategory: (id: string, name: string, code?: string) => void;
  deleteCategory: (id: string) => void;
  addMotivo: (categoriaId: string, name: string) => void;
  editMotivo: (categoriaId: string, motivoId: string, name: string) => void;
  deleteMotivo: (categoriaId: string, motivoId: string) => void;
  addCausaRaiz: (
    categoriaId: string,
    motivoId: string,
    name: string,
    areaImputable?: AreaImputable,
    definicion?: string
  ) => void;
  editCausaRaiz: (
    categoriaId: string,
    motivoId: string,
    causaId: string,
    name: string,
    areaImputable?: AreaImputable,
    definicion?: string
  ) => void;
  deleteCausaRaiz: (categoriaId: string, motivoId: string, causaId: string) => void;
  importCategories: (newCategories: CategoryItem[]) => void;

  // Contact Reasons (Motivos de Contacto)
  contactReasons: ContactReasonItem[];
  addContactReason: (name: string, description?: string) => void;
  editContactReason: (id: string, name: string, description?: string) => void;
  deleteContactReason: (id: string) => void;
  toggleContactReasonStatus: (id: string) => void;
  replaceContactReasons: (newReasons: ContactReasonItem[]) => void;

  // Monitorings
  monitorings: MonitoringItem[];
  createMonitoring: (
    item: Omit<MonitoringItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'score'> & {
      id?: string;
      score?: number;
    }
  ) => MonitoringItem;
  submitTLFeedback: (
    monitoringId: string,
    feedback: {
      feedbackDate: string;
      feedbackType?: 'Refuerzo' | 'Correctivo' | 'Calibración';
      observations: string;
      actionPlan: string;
    }
  ) => void;
  submitAgentCommitment: (
    monitoringId: string,
    commitment: {
      commitmentText: string;
      actionStep: string;
      targetCompletionDate: string;
    }
  ) => void;
  refuteMonitoring: (
    monitoringId: string,
    reason: string,
    refutedByRole: 'team_leader' | 'asesor'
  ) => void;
  resolveRefutedMonitoring: (
    monitoringId: string,
    updatedFields: Omit<MonitoringItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'score'> & {
      score?: number;
    }
  ) => MonitoringItem | null;

  // Roles & Permissions
  roles: RolePermission[];
  addRole: (role: Omit<RolePermission, 'id'>) => void;
  updateRole: (role: RolePermission) => void;
  deleteRole: (roleId: string) => void;

  // Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (
    action: string,
    module: 'General' | 'Analista' | 'Reportería' | 'Administrador' | 'Autenticación',
    details: string,
    targetId?: string
  ) => void;

  // Clear all records (Admin only)
  clearAllRecords: () => Promise<void>;

  // Daily Surveys & NPS
  surveys: SurveyItem[];
  importSurveys: (
    items: Omit<SurveyItem, 'id' | 'createdAt' | 'npsType' | 'hasGeneratedPending'>[],
    channel: 'Voz' | 'Chat'
  ) => { totalImported: number; detractorsFound: number };
  clearSurveys: (includePendingFromSurveys?: boolean) => Promise<number>;

  // Analyst Pending Queue
  pendingAnalyses: PendingAnalysisItem[];
  createPendingAnalysis: (
    item: Omit<PendingAnalysisItem, 'id' | 'createdAt' | 'status'>
  ) => PendingAnalysisItem;
  completePendingAnalysis: (pendingId: string, completedMonitoringId: string) => void;
  deletePendingAnalysis: (pendingId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [authUserProfile, setAuthUserProfile] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const catalogLoadedAtRef = useRef<number>(0);
  const surveysLoadedRef = useRef<boolean>(false);

  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUserState] = useState<User>(EMPTY_FALLBACK_USER);
  const [activeSection, setActiveSectionState] = useState<MainSection>('general');
  const [activeSubSection, setActiveSubSectionState] = useState<string>('bandeja');

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [monitorings, setMonitorings] = useState<MonitoringItem[]>([]);
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [pendingAnalyses, setPendingAnalyses] = useState<PendingAnalysisItem[]>([]);
  const [contactReasons, setContactReasons] = useState<ContactReasonItem[]>([]);

  const formatFirestoreUserError = (err: unknown, contextLabel: string): string => {
    const rawMsg = err instanceof Error ? err.message : String(err || '');
    if (rawMsg.toLowerCase().includes('quota exceeded')) {
      return `Se alcanzó la cuota diaria gratuita de Firestore (${contextLabel}). El cupo se reinicia al día siguiente; para operar sin límites diarios activa el plan Blaze en Firebase Console.`;
    }
    return `Error al sincronizar (${contextLabel}). Verifica tu conexión o permisos antes de continuar.`;
  };

  const runPersist = useCallback((promise: Promise<unknown>, actionLabel: string) => {
    void promise.catch((err) => {
      console.error(`Failed to ${actionLabel}:`, err);
      setSyncError(formatFirestoreUserError(err, actionLabel));
    });
  }, []);

  const clearSyncError = () => setSyncError(null);
  const clearAuthNotice = () => setAuthNotice(null);

  const translateFirebaseAuthError = (err: any, fallbackMsg: string): string => {
    const code = err?.code || '';
    const msg = String(err?.message || '');
    if (code === 'auth/operation-not-allowed' || msg.includes('PASSWORD_LOGIN_DISABLED')) {
      return 'El proveedor "Correo electrónico / Contraseña" está deshabilitado en el proyecto Firebase gen-lang-client-0341239279. Actívalo en Authentication → Sign-in method → Correo electrónico/Contraseña (o usa "Continuar con Google" mientras tanto).';
    }
    if (code === 'auth/requires-recent-login') {
      return 'Por seguridad, cierra sesión e ingresa nuevamente antes de cambiar tu contraseña.';
    }
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Usuario o contraseña incorrectos. Si aún no creaste tu contraseña (o antes entrabas con Google), usa "Activar contraseña" o "¿Olvidaste tu contraseña?".';
      case 'auth/invalid-email':
        return 'Ingresa un correo electrónico válido.';
      case 'auth/email-already-in-use':
        return 'Este correo ya está registrado (por ejemplo, con Google o con una contraseña previa). Usa "Iniciar sesión" o haz clic en "¿Olvidaste tu contraseña?" para definir una nueva clave.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentar.';
      case 'auth/popup-closed-by-user':
        return 'Se cerró la ventana de inicio de sesión antes de completar el acceso.';
      default:
        return err?.message || fallbackMsg;
    }
  };

  const currentPermissions = React.useMemo(
    () => resolveRolePermissions(currentUser.role, roles),
    [currentUser.role, roles]
  );

  const hasPermission = useCallback(
    (key: PermissionKey) => Boolean(currentPermissions[key]),
    [currentPermissions]
  );

  const canAccessSection = useCallback(
    (section: MainSection) =>
      canAccessSectionForRole(currentUser.role, currentPermissions, section),
    [currentUser.role, currentPermissions]
  );

  const canAccessSubSection = useCallback(
    (section: MainSection, subSection: string) =>
      canAccessSubSectionForRole(currentUser.role, currentPermissions, section, subSection),
    [currentUser.role, currentPermissions]
  );

  const navigateTo = useCallback(
    (section: MainSection, subsection?: string) => {
      const allowedSubs = getAllowedSubSectionsForSection(
        currentUser.role,
        currentPermissions,
        section
      );
      if (allowedSubs.length === 0) return;

      const targetSub =
        subsection && allowedSubs.includes(subsection) ? subsection : allowedSubs[0];
      setActiveSectionState(section);
      setActiveSubSectionState(targetSub);
    },
    [currentUser.role, currentPermissions]
  );

  const setActiveSection = useCallback(
    (section: MainSection) => {
      navigateTo(section);
    },
    [navigateTo]
  );

  const setActiveSubSection = useCallback(
    (subsection: string) => {
      if (!canAccessSubSectionForRole(currentUser.role, currentPermissions, activeSection, subsection)) {
        return;
      }
      setActiveSubSectionState(subsection);
    },
    [currentUser.role, currentPermissions, activeSection]
  );

  const getDefaultRouteForRole = useCallback(
    (role: User['role'], roleList: RolePermission[] = roles): { section: MainSection; sub: string } => {
      const perms = resolveRolePermissions(role, roleList);
      return getFirstAllowedRouteForRole(role, perms);
    },
    [roles]
  );

  const hydrateFromFirestore = useCallback(
    async (profile: User, uid: string, options?: { forceCatalogs?: boolean }) => {
      setIsSyncing(true);
      const CATALOG_TTL_MS = 15 * 60 * 1000;
      const includeCatalogs =
        Boolean(options?.forceCatalogs) ||
        catalogLoadedAtRef.current === 0 ||
        Date.now() - catalogLoadedAtRef.current > CATALOG_TTL_MS;
      const isAnalystOrCoord =
        profile.role === 'analista' || profile.role === 'coordinador' || profile.role === 'admin';
      const includeSurveys = isAnalystOrCoord && surveysLoadedRef.current;

      try {
        const data = await loadWorkspaceData(profile, uid, {
          includeCatalogs,
          includeSurveys,
        });
        if (data.users !== undefined) setUsers(data.users);
        if (data.categories !== undefined) setCategories(data.categories);
        if (data.contactReasons !== undefined) setContactReasons(data.contactReasons);
        if (data.roles !== undefined) setRoles(data.roles);
        if (includeCatalogs) {
          catalogLoadedAtRef.current = Date.now();
        }
        setMonitorings(data.monitorings);
        if (data.surveys !== undefined) setSurveys(data.surveys);
        setPendingAnalyses(data.pendingAnalyses);
        setAuditLogs(data.auditLogs);
        setAuthError(null);
        setSyncError(null);
        return data.roles;
      } catch (err: any) {
        console.error('Error loading workspace data:', err);
        const friendly = formatFirestoreUserError(err, 'cargar datos');
        setAuthError(friendly);
        setSyncError(friendly);
        return undefined;
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        catalogLoadedAtRef.current = 0;
        surveysLoadedRef.current = false;
        setAuthStatus('unauthenticated');
        setAuthEmail('');
        setFirebaseUid(null);
        setAuthUserProfile(null);
        setSyncError(null);
        setUsers([]);
        setCategories([]);
        setContactReasons([]);
        setRoles([]);
        setMonitorings([]);
        setSurveys([]);
        setPendingAnalyses([]);
        setAuditLogs([]);
        return;
      }

      setAuthStatus('loading');
      setAuthError(null);
      setSyncError(null);
      setAuthEmail(fbUser.email || '');
      setFirebaseUid(fbUser.uid);

      if (!fbUser.emailVerified) {
        setAuthUserProfile(null);
        setAuthStatus('verification_pending');
        return;
      }

      setAuthNotice(null);

      try {
        const resolution = await resolveUserSession(fbUser);
        if (resolution.status === 'unauthorized') {
          setAuthUserProfile(null);
          setAuthStatus('unauthorized');
          return;
        }
        if (resolution.status === 'inactive') {
          setAuthUserProfile(resolution.profile);
          setAuthStatus('inactive');
          return;
        }

        const profile = resolution.profile;
        catalogLoadedAtRef.current = 0;
        surveysLoadedRef.current = false;
        setAuthUserProfile(profile);
        setCurrentUserState(profile);
        const loadedRoles = await hydrateFromFirestore(profile, fbUser.uid, { forceCatalogs: true });
        const route = getDefaultRouteForRole(profile.role, loadedRoles || roles);
        setActiveSectionState(route.section);
        setActiveSubSectionState(route.sub);
        setAuthStatus('ready');
      } catch (err: any) {
        console.error('Auth resolution failed:', err);
        setAuthError(formatFirestoreUserError(err, 'validar sesión'));
        setAuthStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, [hydrateFromFirestore]);

  // Auto-redirect if active route is not permitted for current user / updated role permissions
  useEffect(() => {
    if (authStatus !== 'ready') return;
    if (!canAccessSubSection(activeSection, activeSubSection)) {
      const fallback = getFirstAllowedRouteForRole(currentUser.role, currentPermissions);
      setActiveSectionState(fallback.section);
      setActiveSubSectionState(fallback.sub);
    }
  }, [
    authStatus,
    activeSection,
    activeSubSection,
    canAccessSubSection,
    currentUser.role,
    currentPermissions,
  ]);

  // Lazy-load Surveys (up to 350) only when an Analyst/Coordinator/Admin enters Encuestas or Reportería
  useEffect(() => {
    if (authStatus !== 'ready' || !authUserProfile) return;
    const isAnalystOrCoord =
      authUserProfile.role === 'analista' ||
      authUserProfile.role === 'coordinador' ||
      authUserProfile.role === 'admin';
    if (!isAnalystOrCoord) return;

    const needsSurveys =
      activeSection === 'reporteria' ||
      (activeSection === 'analista' && activeSubSection === 'encuestas');
    if (!needsSurveys || surveysLoadedRef.current) return;

    surveysLoadedRef.current = true;
    setIsSyncing(true);
    loadSurveysBatch()
      .then((loadedSurveys) => {
        setSurveys(loadedSurveys);
      })
      .catch((err) => {
        surveysLoadedRef.current = false;
        console.error('Failed to load surveys on demand:', err);
        setSyncError(formatFirestoreUserError(err, 'cargar encuestas'));
      })
      .finally(() => {
        setIsSyncing(false);
      });
  }, [authStatus, authUserProfile, activeSection, activeSubSection]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setAuthError(
        translateFirebaseAuthError(err, 'No se pudo completar el inicio de sesión con Google.')
      );
    }
  };

  const signInWithEmailPassword = async (email: string, password: string) => {
    setAuthError(null);
    setAuthNotice(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setAuthError('Ingresa tu correo corporativo y tu contraseña.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err: any) {
      console.error('Email/password sign-in error:', err);
      setAuthError(translateFirebaseAuthError(err, 'No se pudo iniciar sesión.'));
    }
  };

  const registerWithEmailPassword = async (email: string, password: string) => {
    setAuthError(null);
    setAuthNotice(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 6) {
      setAuthError('Ingresa un correo válido y una contraseña de al menos 6 caracteres.');
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      if (cred.user && !cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
      }
      setAuthNotice(
        `Cuenta creada. Te enviamos un enlace de verificación a ${normalizedEmail}. Confírmalo para ingresar.`
      );
    } catch (err: any) {
      console.error('Email/password registration error:', err);
      setAuthError(translateFirebaseAuthError(err, 'No se pudo crear la contraseña de acceso.'));
    }
  };

  const resetPasswordWithEmail = async (email: string) => {
    setAuthError(null);
    setAuthNotice(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setAuthError('Escribe primero tu correo en el campo Usuario para enviarte el enlace.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setAuthNotice(
        `Si el correo ${normalizedEmail} existe en el proyecto, recibirás un enlace. Si el enlace aparece como vencido o ya usado al abrirlo por primera vez (bloqueo del antivirus/Safe Links del correo o proveedor aún deshabilitado en Firebase), inicia sesión con Google y configura tu contraseña directamente desde el botón de llave en la barra superior.`
      );
    } catch (err: any) {
      console.error('Password reset error:', err);
      setAuthError(
        translateFirebaseAuthError(err, 'No se pudo enviar el correo de recuperación.')
      );
    }
  };

  const resendVerificationEmail = async () => {
    setAuthError(null);
    setAuthNotice(null);
    const user = auth.currentUser;
    if (!user) return;
    try {
      await sendEmailVerification(user);
      setAuthNotice(`Reenviamos el correo de verificación a ${user.email || authEmail}.`);
    } catch (err: any) {
      console.error('Resend verification error:', err);
      setAuthError(
        translateFirebaseAuthError(err, 'No se pudo reenviar el correo de verificación.')
      );
    }
  };

  const verifyEmailAndContinue = async () => {
    setAuthError(null);
    setAuthNotice(null);
    const user = auth.currentUser;
    if (!user) return;
    try {
      await user.reload();
      await user.getIdToken(true);
      if (!user.emailVerified) {
        setAuthError('Tu correo aún no aparece como verificado. Abre el enlace en tu bandeja e intenta de nuevo.');
        return;
      }
      setAuthStatus('loading');
      const resolution = await resolveUserSession(user);
      if (resolution.status === 'unauthorized') {
        setAuthUserProfile(null);
        setAuthStatus('unauthorized');
        return;
      }
      if (resolution.status === 'inactive') {
        setAuthUserProfile(resolution.profile);
        setAuthStatus('inactive');
        return;
      }
      const profile = resolution.profile;
      catalogLoadedAtRef.current = 0;
      surveysLoadedRef.current = false;
      setAuthUserProfile(profile);
      setCurrentUserState(profile);
      const loadedRoles = await hydrateFromFirestore(profile, user.uid, { forceCatalogs: true });
      const route = getDefaultRouteForRole(profile.role, loadedRoles || roles);
      setActiveSectionState(route.section);
      setActiveSubSectionState(route.sub);
      setAuthStatus('ready');
    } catch (err: any) {
      console.error('Verify email reload failed:', err);
      setAuthError(translateFirebaseAuthError(err, 'No se pudo verificar el estado del correo.'));
      setAuthStatus('verification_pending');
    }
  };

  const setAccountPassword = async (
    newPassword: string
  ): Promise<{ ok: boolean; message: string }> => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.email) {
      return {
        ok: false,
        message: 'No hay una sesión activa válida para configurar la contraseña.',
      };
    }
    if (newPassword.length < 6) {
      return {
        ok: false,
        message: 'La contraseña debe tener al menos 6 caracteres.',
      };
    }

    const hasPasswordProvider = fbUser.providerData.some((p) => p.providerId === 'password');
    try {
      if (hasPasswordProvider) {
        await updatePassword(fbUser, newPassword);
      } else {
        const credential = EmailAuthProvider.credential(fbUser.email, newPassword);
        await linkWithCredential(fbUser, credential);
      }
      return {
        ok: true,
        message: `Contraseña configurada correctamente para ${fbUser.email}. Ya puedes iniciar sesión con usuario y contraseña.`,
      };
    } catch (err: any) {
      console.error('Failed to set account password:', err);
      return {
        ok: false,
        message: translateFirebaseAuthError(err, 'No se pudo guardar la contraseña.'),
      };
    }
  };

  const signOutUser = async () => {
    setAuthNotice(null);
    setAuthError(null);
    await signOut(auth);
  };

  const refreshData = async () => {
    if (!authUserProfile || !firebaseUid) return;
    await hydrateFromFirestore(authUserProfile, firebaseUid);
  };

  // Allow Admins to preview another profile in UI while non-Admins stay locked to their real profile
  const setCurrentUser = (user: User) => {
    if (authUserProfile?.role !== 'admin') return;
    setCurrentUserState(user);
    const route = getDefaultRouteForRole(user.role);
    setActiveSectionState(route.section);
    setActiveSubSectionState(route.sub);
  };

  // Helper to append audit logs
  const addAuditLog = (
    action: string,
    module: 'General' | 'Analista' | 'Reportería' | 'Administrador' | 'Autenticación',
    details: string,
    targetId?: string
  ) => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      module,
      details,
      targetId,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    if (firebaseUid) {
      runPersist(persistAuditLog(newLog, firebaseUid), 'registrar bitácora');
    }
  };

  // User Management
  const addUser = (newUser: Omit<User, 'id'>) => {
    const created: User = {
      ...newUser,
      email: newUser.email.trim().toLowerCase(),
      id: `usr-${Date.now()}`,
    };
    setUsers((prev) => [...prev, created]);
    runPersist(persistUserCreate(created), 'crear usuario');
    addAuditLog(
      'Creación de Usuario',
      'Administrador',
      `Se creó el usuario ${created.name} (${created.employeeCode}) con rol ${created.role}.`,
      created.id
    );
  };

  const importUsersBulk = (newUsers: Omit<User, 'id'>[]) => {
    if (!newUsers.length) return;
    const timestamp = Date.now();
    const createdUsers: User[] = newUsers.map((u, idx) => ({
      ...u,
      email: u.email.trim().toLowerCase(),
      id: `usr-${timestamp}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
    }));
    setUsers((prev) => [...prev, ...createdUsers]);
    runPersist(persistUsersBulk(createdUsers), 'importar usuarios');
    addAuditLog(
      'Carga Masiva de Usuarios',
      'Administrador',
      `Se importaron ${createdUsers.length} usuarios mediante Excel (${createdUsers
        .map((u) => u.email)
        .slice(0, 5)
        .join(', ')}${createdUsers.length > 5 ? '...' : ''}).`
    );
  };

  const updateUser = (updatedUser: User) => {
    const cleanEmail = updatedUser.email.trim().toLowerCase();
    const isBootstrapAdmin = cleanEmail === 'luis.montenegro@xtendo-it.com';
    const normalized: User = {
      ...updatedUser,
      email: cleanEmail,
      ...(isBootstrapAdmin ? { role: 'admin', status: 'active' } : {}),
    };
    setUsers((prev) => prev.map((u) => (u.id === normalized.id ? normalized : u)));
    if (currentUser.id === normalized.id) {
      setCurrentUserState(normalized);
    }
    if (authUserProfile?.id === normalized.id) {
      setAuthUserProfile(normalized);
    }
    runPersist(persistUserUpdate(normalized), 'actualizar usuario');
    addAuditLog(
      'Actualización de Usuario',
      'Administrador',
      `Se modificaron los datos del usuario ${normalized.name} (${normalized.employeeCode}).`,
      normalized.id
    );
  };

  const toggleUserStatus = (userId: string) => {
    let toggledUser: User | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          if (u.email.trim().toLowerCase() === 'luis.montenegro@xtendo-it.com') {
            toggledUser = { ...u, role: 'admin', status: 'active' };
            return toggledUser;
          }
          const newStatus = u.status === 'active' ? 'inactive' : 'active';
          toggledUser = { ...u, status: newStatus };
          return toggledUser;
        }
        return u;
      })
    );
    if (toggledUser) {
      const target = toggledUser as User;
      runPersist(persistUserUpdate(target), 'cambiar estado de usuario');
      addAuditLog(
        'Cambio de Estado de Usuario',
        'Administrador',
        `Se cambió el estado del usuario ${target.name} a ${target.status}.`,
        target.id
      );
    }
  };

  const updateUserDependencies = (updatedUsers: User[]) => {
    const existingIds = new Set(users.map((u) => sanitizeDocId(u.id, 'usr')));
    setUsers(updatedUsers);
    runPersist(persistUserDependenciesBatch(updatedUsers, existingIds), 'actualizar dependencias');
    addAuditLog(
      'Actualización de Dependencias',
      'Administrador',
      `Se registraron o actualizaron dependencias de asesores (${updatedUsers.filter((u) => u.role === 'asesor').length} asesores en directorio).`
    );
  };

  // Categories CRUD
  const addCategory = (name: string, code?: string) => {
    const newCat: CategoryItem = {
      id: `cat-${Date.now()}`,
      name,
      code: code || name.substring(0, 3).toUpperCase(),
      motivos: [],
    };
    setCategories((prev) => [...prev, newCat]);
    runPersist(persistCategoryUpsert(newCat), 'crear categoría');
    addAuditLog('Creación de Categoría', 'Analista', `Se creó la categoría Nivel 1: "${name}".`, newCat.id);
  };

  const editCategory = (id: string, name: string, code?: string) => {
    let updatedCat: CategoryItem | null = null;
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        updatedCat = { ...c, name, code: code || c.code };
        return updatedCat;
      })
    );
    if (updatedCat) {
      runPersist(persistCategoryUpsert(updatedCat), 'editar categoría');
    }
    addAuditLog('Edición de Categoría', 'Analista', `Se editó la categoría Nivel 1: "${name}".`, id);
  };

  const deleteCategory = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    runPersist(persistCategoryDelete(id), 'eliminar categoría');
    addAuditLog(
      'Eliminación de Categoría',
      'Analista',
      `Se eliminó la categoría "${cat?.name || id}" y sus motivos asociados.`,
      id
    );
  };

  const addMotivo = (categoriaId: string, name: string) => {
    const newMotivo = {
      id: `mot-${Date.now()}`,
      name,
      categoriaId,
      causasRaiz: [],
    };
    let updatedCat: CategoryItem | null = null;
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== categoriaId) return c;
        updatedCat = { ...c, motivos: [...c.motivos, newMotivo] };
        return updatedCat;
      })
    );
    if (updatedCat) {
      runPersist(persistCategoryUpsert(updatedCat), 'agregar motivo');
    }
    addAuditLog(
      'Creación de Motivo',
      'Analista',
      `Se agregó el motivo Nivel 2 "${name}" en la categoría ${categoriaId}.`
    );
  };

  const editMotivo = (categoriaId: string, motivoId: string, name: string) => {
    let updatedCat: CategoryItem | null = null;
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== categoriaId) return c;
        updatedCat = {
          ...c,
          motivos: c.motivos.map((m) => (m.id === motivoId ? { ...m, name } : m)),
        };
        return updatedCat;
      })
    );
    if (updatedCat) {
      runPersist(persistCategoryUpsert(updatedCat), 'editar motivo');
    }
    addAuditLog('Edición de Motivo', 'Analista', `Se actualizó el motivo "${name}".`);
  };

  const deleteMotivo = (categoriaId: string, motivoId: string) => {
    let updatedCat: CategoryItem | null = null;
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== categoriaId) return c;
        updatedCat = {
          ...c,
          motivos: c.motivos.filter((m) => m.id !== motivoId),
        };
        return updatedCat;
      })
    );
    if (updatedCat) {
      runPersist(persistCategoryUpsert(updatedCat), 'eliminar motivo');
    }
    addAuditLog('Eliminación de Motivo', 'Analista', `Se eliminó el motivo ${motivoId}.`);
  };

  const addCausaRaiz = (
    categoriaId: string,
    motivoId: string,
    name: string,
    areaImputable?: AreaImputable,
    definicion?: string
  ) => {
    const newCr = {
      id: `cr-${Date.now()}`,
      name,
      motivoId,
      categoriaId,
      areaImputable,
      definicion: definicion?.trim() || undefined,
    };
    let updatedCat: CategoryItem | null = null;
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== categoriaId) return c;
        updatedCat = {
          ...c,
          motivos: c.motivos.map((m) => {
            if (m.id !== motivoId) return m;
            return {
              ...m,
              causasRaiz: [...m.causasRaiz, newCr],
            };
          }),
        };
        return updatedCat;
      })
    );
    if (updatedCat) {
      runPersist(persistCategoryUpsert(updatedCat), 'agregar causa raíz');
    }
    addAuditLog('Creación de Causa Raíz', 'Analista', `Se agregó la causa raíz Nivel 3 "${name}".`);
  };

  const editCausaRaiz = (
    categoriaId: string,
    motivoId: string,
    causaId: string,
    name: string,
    areaImputable?: AreaImputable,
    definicion?: string
  ) => {
    let updatedCat: CategoryItem | null = null;
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== categoriaId) return c;
        updatedCat = {
          ...c,
          motivos: c.motivos.map((m) => {
            if (m.id !== motivoId) return m;
            return {
              ...m,
              causasRaiz: m.causasRaiz.map((cr) =>
                cr.id === causaId
                  ? {
                      ...cr,
                      name,
                      areaImputable,
                      definicion: definicion?.trim() || undefined,
                    }
                  : cr
              ),
            };
          }),
        };
        return updatedCat;
      })
    );
    if (updatedCat) {
      runPersist(persistCategoryUpsert(updatedCat), 'editar causa raíz');
    }
    addAuditLog('Edición de Causa Raíz', 'Analista', `Se actualizó la causa raíz "${name}".`);
  };

  const deleteCausaRaiz = (categoriaId: string, motivoId: string, causaId: string) => {
    let updatedCat: CategoryItem | null = null;
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== categoriaId) return c;
        updatedCat = {
          ...c,
          motivos: c.motivos.map((m) => {
            if (m.id !== motivoId) return m;
            return {
              ...m,
              causasRaiz: m.causasRaiz.filter((cr) => cr.id !== causaId),
            };
          }),
        };
        return updatedCat;
      })
    );
    if (updatedCat) {
      runPersist(persistCategoryUpsert(updatedCat), 'eliminar causa raíz');
    }
    addAuditLog('Eliminación de Causa Raíz', 'Analista', `Se eliminó la causa raíz ${causaId}.`);
  };

  const importCategories = (newCategories: CategoryItem[]) => {
    const previous = categories;
    setCategories(newCategories);
    runPersist(persistCategoriesReplaceAll(previous, newCategories), 'importar categorizaciones');
    addAuditLog(
      'Carga Masiva de Categorizaciones',
      'Analista',
      `Se importaron ${newCategories.length} categorías principales desde archivo Excel/CSV.`
    );
  };

  // Contact Reasons (Gestión de Motivo de contacto)
  const addContactReason = (name: string, description?: string) => {
    const newReason: ContactReasonItem = {
      id: `mot-${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || '',
      active: true,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setContactReasons((prev) => [newReason, ...prev]);
    runPersist(persistContactReasonUpsert(newReason), 'crear motivo de contacto');
    addAuditLog(
      'Creación Motivo Contacto',
      'Analista',
      `Se creó el motivo de contacto: "${newReason.name}"`,
      newReason.id
    );
  };

  const editContactReason = (id: string, name: string, description?: string) => {
    let updated: ContactReasonItem | null = null;
    setContactReasons((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, name: name.trim(), description: description?.trim() || '' };
        return updated;
      })
    );
    if (updated) {
      runPersist(persistContactReasonUpsert(updated), 'editar motivo de contacto');
    }
    addAuditLog(
      'Edición Motivo Contacto',
      'Analista',
      `Se actualizó el motivo de contacto ID ${id} a "${name}"`,
      id
    );
  };

  const deleteContactReason = (id: string) => {
    const reasonToDelete = contactReasons.find((r) => r.id === id);
    setContactReasons((prev) => prev.filter((r) => r.id !== id));
    runPersist(persistContactReasonDelete(id), 'eliminar motivo de contacto');
    addAuditLog(
      'Eliminación Motivo Contacto',
      'Analista',
      `Se eliminó el motivo de contacto: "${reasonToDelete?.name || id}"`,
      id
    );
  };

  const toggleContactReasonStatus = (id: string) => {
    let updated: ContactReasonItem | null = null;
    setContactReasons((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextState = !r.active;
          updated = { ...r, active: nextState };
          addAuditLog(
            'Estado Motivo Contacto',
            'Analista',
            `Se ${nextState ? 'activó' : 'desactivó'} el motivo de contacto "${r.name}"`,
            id
          );
          return updated;
        }
        return r;
      })
    );
    if (updated) {
      runPersist(persistContactReasonUpsert(updated), 'cambiar estado de motivo de contacto');
    }
  };

  const replaceContactReasons = (newReasons: ContactReasonItem[]) => {
    const previous = contactReasons;
    const previousCount = previous.length;
    setContactReasons(newReasons);
    runPersist(persistContactReasonsReplaceAll(previous, newReasons), 'importar motivos de contacto');
    addAuditLog(
      'Carga Masiva Motivos de Contacto',
      'Analista',
      `Se reemplazaron los ${previousCount} motivos anteriores por ${newReasons.length} motivos cargados desde Excel.`
    );
  };

  // Monitorings Lifecycle
  const createMonitoring = (
    data: Omit<MonitoringItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'score'> & {
      id?: string;
      score?: number;
    }
  ): MonitoringItem => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const status: MonitoringStatus = data.requiresFeedback
      ? 'PENDIENTE_TL'
      : 'CONFORME_SIN_FEEDBACK';

    const rawId = data.id ? data.id.trim() : `MON-${Date.now().toString().slice(-6)}`;
    const normalizedId = rawId.replace(/^mon-/i, 'MON-');

    const agentUser = users.find((u) => u.id === data.agentId);
    const tlUser = users.find((u) => u.id === data.teamLeaderId);
    const analystUser = users.find((u) => u.id === data.analystId);

    const newItem: MonitoringItem = {
      ...data,
      id: normalizedId,
      agentEmail: data.agentEmail || agentUser?.email || '',
      teamLeaderEmail: data.teamLeaderEmail || tlUser?.email || '',
      analystEmail: data.analystEmail || analystUser?.email || authUserProfile?.email || '',
      score:
        data.score !== undefined
          ? data.score
          : data.surveyScore !== undefined
          ? data.surveyScore * 10
          : 80,
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setMonitorings((prev) => [newItem, ...prev]);
    runPersist(persistMonitoringCreate(newItem), 'guardar monitoreo');

    addAuditLog(
      'Carga de Monitoreo',
      'Analista',
      `Se registró análisis de atención ${newItem.id} (${
        newItem.ticketNumber || newItem.customerIdentifier
      }) para ${newItem.agentName}. Motivo: ${newItem.contactReason || 'N/A'}. Estado: ${status}`,
      newItem.id
    );

    return newItem;
  };

  const submitTLFeedback = (
    monitoringId: string,
    feedback: {
      feedbackDate: string;
      feedbackType?: 'Refuerzo' | 'Correctivo' | 'Calibración';
      observations: string;
      actionPlan: string;
    }
  ) => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    const tlFeedbackObj: NonNullable<MonitoringItem['tlFeedback']> = {
      ...feedback,
      submittedAt: timestamp,
      submittedByTLId: currentUser.id,
    };

    setMonitorings((prev) =>
      prev.map((m) => {
        if (m.id !== monitoringId) return m;
        return {
          ...m,
          status: 'PENDIENTE_AGENTE',
          updatedAt: timestamp,
          tlFeedback: tlFeedbackObj,
        };
      })
    );

    runPersist(
      persistMonitoringTLFeedback(monitoringId, tlFeedbackObj, timestamp),
      'guardar feedback del TL'
    );

    const mon = monitorings.find((m) => m.id === monitoringId);
    addAuditLog(
      'Registro de Feedback por TL',
      'General',
      `El TL ${currentUser.name} completó el feedback para ${mon?.agentName} en ${mon?.ticketNumber}. Enrutado a bandeja del agente.`,
      monitoringId
    );
  };

  const submitAgentCommitment = (
    monitoringId: string,
    commitment: {
      commitmentText: string;
      actionStep: string;
      targetCompletionDate: string;
    }
  ) => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    const commitmentObj: NonNullable<MonitoringItem['agentCommitment']> = {
      ...commitment,
      signedAt: timestamp,
      signatureConfirmed: true,
    };

    setMonitorings((prev) =>
      prev.map((m) => {
        if (m.id !== monitoringId) return m;
        return {
          ...m,
          status: 'CERRADO',
          updatedAt: timestamp,
          agentCommitment: commitmentObj,
        };
      })
    );

    runPersist(
      persistMonitoringAgentCommitment(monitoringId, commitmentObj, timestamp),
      'firmar compromiso del asesor'
    );

    const mon = monitorings.find((m) => m.id === monitoringId);
    addAuditLog(
      'Cierre de Ciclo de Feedback',
      'General',
      `El asesor ${currentUser.name} firmó su compromiso de mejora para ${mon?.ticketNumber}. Ciclo cerrado exitosamente.`,
      monitoringId
    );
  };

  const refuteMonitoring = (
    monitoringId: string,
    reason: string,
    refutedByRole: 'team_leader' | 'asesor'
  ) => {
    const targetMon = monitorings.find((m) => m.id === monitoringId);
    if (!targetMon) return;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;

    const entry: RefutationEntry = {
      refutedByRole,
      refutedById: currentUser.id,
      refutedByName: currentUser.name,
      reason: reason.trim(),
      refutedAt: timestamp,
    };

    const nextRefutations = [...(targetMon.refutations || []), entry];

    setMonitorings((prev) =>
      prev.map((m) => {
        if (m.id !== monitoringId) return m;
        return {
          ...m,
          status: 'REFUTADO',
          updatedAt: timestamp,
          refutations: nextRefutations,
          latestRefutation: entry,
        };
      })
    );

    const pendingItem: PendingAnalysisItem = {
      id: `pen-ref-${Date.now()}`,
      ticketNumber: targetMon.ticketNumber,
      chatId: targetMon.chatId,
      customerIdentifier: targetMon.customerIdentifier,
      channel: targetMon.channel,
      inboxName: targetMon.inboxName,
      segment: targetMon.segment,
      clasificacionEmpresas: targetMon.clasificacionEmpresas,
      interactionDate: targetMon.callDate,
      interactionTime: targetMon.callTime,
      durationSec: targetMon.callDurationSec,
      origin: 'REFUTACION',
      npsScore: targetMon.surveyScore,
      npsType:
        targetMon.surveyScore !== undefined
          ? targetMon.surveyScore <= 6
            ? 'Detractor'
            : targetMon.surveyScore <= 8
            ? 'Pasivo'
            : 'Promotor'
          : undefined,
      customerComment: targetMon.qaFindings?.criticalFinding || '',
      csat: targetMon.csat,
      fcr: targetMon.fcr,
      effort: targetMon.effort,
      agentId: targetMon.agentId,
      agentName: targetMon.agentName,
      asesorPersonalizado: targetMon.asesorPersonalizado,
      assignedAnalystId: targetMon.analystId,
      assignedAnalystName: targetMon.analystName,
      status: 'PENDIENTE',
      priority: 'Alta',
      audioRecordingId: targetMon.audioRecordingId,
      originalMonitoringId: targetMon.id,
      refutation: entry,
      createdAt: timestamp,
    };

    setPendingAnalyses((prev) => [pendingItem, ...prev]);

    runPersist(
      persistMonitoringRefutation(monitoringId, nextRefutations, entry, timestamp, pendingItem),
      'registrar refutación'
    );

    const roleText = refutedByRole === 'team_leader' ? 'Team Leader' : 'Asesor';
    addAuditLog(
      'Refutación de Monitoreo',
      'General',
      `El ${roleText} ${currentUser.name} refutó el monitoreo ${targetMon.id} y lo devolvió al Analista para revisión. Motivo: "${entry.reason}".`,
      targetMon.id
    );
  };

  const resolveRefutedMonitoring = (
    monitoringId: string,
    updatedFields: Omit<MonitoringItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'score'> & {
      score?: number;
    }
  ): MonitoringItem | null => {
    const existing = monitorings.find((m) => m.id === monitoringId);
    if (!existing) return null;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;

    const nextStatus: MonitoringStatus = updatedFields.requiresFeedback
      ? 'PENDIENTE_TL'
      : 'CONFORME_SIN_FEEDBACK';

    const agentUser = users.find((u) => u.id === updatedFields.agentId);
    const tlUser = users.find((u) => u.id === updatedFields.teamLeaderId);
    const analystUser = users.find((u) => u.id === updatedFields.analystId);

    const updatedMonitoring: MonitoringItem = {
      ...existing,
      ...updatedFields,
      id: existing.id,
      agentEmail: updatedFields.agentEmail || agentUser?.email || existing.agentEmail || '',
      teamLeaderEmail:
        updatedFields.teamLeaderEmail || tlUser?.email || existing.teamLeaderEmail || '',
      analystEmail:
        updatedFields.analystEmail || analystUser?.email || existing.analystEmail || '',
      score:
        updatedFields.score !== undefined
          ? updatedFields.score
          : updatedFields.surveyScore !== undefined
          ? updatedFields.surveyScore * 10
          : existing.score,
      status: nextStatus,
      tlFeedback: undefined,
      agentCommitment: undefined,
      createdAt: existing.createdAt,
      updatedAt: timestamp,
    };

    setMonitorings((prev) =>
      prev.map((m) => (m.id === monitoringId ? updatedMonitoring : m))
    );

    runPersist(
      persistMonitoringResolveRefutation(updatedMonitoring),
      'resolver monitoreo refutado'
    );

    addAuditLog(
      'Revisión de Monitoreo Refutado',
      'Analista',
      `El analista ${currentUser.name} re-evaluó el monitoreo refutado ${existing.id} (${existing.agentName}). Nuevo estado: ${nextStatus}.`,
      existing.id
    );

    return updatedMonitoring;
  };

  // Roles CRUD
  const addRole = (newRole: Omit<RolePermission, 'id'>) => {
    const created: RolePermission = {
      ...newRole,
      id: `role-${Date.now()}`,
    };
    setRoles((prev) => [...prev, created]);
    runPersist(persistRoleUpsert(created), 'crear rol');
    addAuditLog(
      'Creación de Rol',
      'Administrador',
      `Se creó el rol personalizado "${created.name}".`,
      created.id
    );
  };

  const updateRole = (updatedRole: RolePermission) => {
    setRoles((prev) => prev.map((r) => (r.id === updatedRole.id ? updatedRole : r)));
    runPersist(persistRoleUpsert(updatedRole), 'actualizar rol');
    addAuditLog(
      'Actualización de Rol',
      'Administrador',
      `Se actualizaron permisos del rol "${updatedRole.name}".`,
      updatedRole.id
    );
  };

  const deleteRole = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (role?.isSystem) return;
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    runPersist(persistRoleDelete(roleId), 'eliminar rol');
    addAuditLog('Eliminación de Rol', 'Administrador', `Se eliminó el rol "${role?.name}".`, roleId);
  };

  // Daily Surveys & NPS Methods
  const importSurveys = (
    items: Omit<SurveyItem, 'id' | 'createdAt' | 'npsType' | 'hasGeneratedPending'>[],
    channel: 'Voz' | 'Chat'
  ) => {
    const batchId = `LOTE-${channel.toUpperCase()}-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
    const newPendingList: PendingAnalysisItem[] = [];
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const baseTime = Date.now();
    const newSurveys: SurveyItem[] = items.map((item, idx) => {
      const score = item.npsScore;
      const npsType = score <= 6 ? 'Detractor' : score <= 8 ? 'Pasivo' : 'Promotor';
      const isDetractor = npsType === 'Detractor';
      const surveyId = `srv-${channel.toLowerCase()}-${baseTime}-${idx}`;

      if (isDetractor) {
        let matchedAgentId = item.agentId;
        if (!matchedAgentId && item.agentName) {
          const normTarget = item.agentName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
          const found = users.find((u) => {
            const normUser = u.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim();
            const normVoice = (u.voiceName || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim();
            const matchesName =
              normUser === normTarget ||
              normUser.includes(normTarget) ||
              normTarget.includes(normUser);
            const matchesVoice =
              Boolean(normVoice) &&
              (normVoice === normTarget ||
                normVoice.includes(normTarget) ||
                normTarget.includes(normVoice));
            return matchesName || matchesVoice;
          });
          if (found) matchedAgentId = found.id;
        }

        const pendingItem: PendingAnalysisItem = {
          id: `pen-${baseTime}-${idx}`,
          ticketNumber: item.chatId || item.ticketNumber,
          chatId: item.chatId,
          customerIdentifier: item.phoneOrLine || item.customerIdentifier,
          channel,
          inboxName: item.inboxName,
          segment: item.segment,
          clasificacionEmpresas: item.clasificacionEmpresas,
          interactionDate: item.surveyDate,
          interactionTime: item.surveyTime,
          durationSec: item.callDurationSec || 240,
          origin: channel === 'Voz' ? 'ENCUESTA_DETRACTORA_VOZ' : 'ENCUESTA_DETRACTORA_CHAT',
          npsScore: score,
          npsType: 'Detractor',
          customerComment:
            item.customerComment ||
            'Encuesta calificada con puntaje detractor (NPS ≤ 6). Requiere análisis de causa raíz.',
          csat: item.csat,
          fcr: item.fcr,
          effort: item.effort,
          agentId: matchedAgentId,
          agentName: item.agentName,
          asesorPersonalizado: item.asesorPersonalizado,
          assignedAnalystId: currentUser.id,
          assignedAnalystName: currentUser.name,
          status: 'PENDIENTE',
          priority: score <= 3 ? 'Alta' : 'Media',
          audioRecordingId:
            channel === 'Voz'
              ? `REC-${item.ticketNumber}.wav`
              : `CHAT-${item.chatId || item.ticketNumber}.txt`,
          createdAt: timestamp,
        };
        newPendingList.push(pendingItem);
      }

      return {
        ...item,
        id: surveyId,
        npsType,
        batchId,
        createdAt: timestamp,
        hasGeneratedPending: isDetractor,
      };
    });

    surveysLoadedRef.current = true;
    setSurveys((prev) => [...newSurveys, ...prev]);
    if (newPendingList.length > 0) {
      setPendingAnalyses((prev) => [...newPendingList, ...prev]);
    }

    runPersist(
      persistSurveysAndPendingImport(newSurveys, newPendingList),
      'importar encuestas'
    );

    addAuditLog(
      `Carga de Encuestas NPS ${channel}`,
      'Analista',
      `Importó ${newSurveys.length} encuestas de ${channel}. Se detectaron ${newPendingList.length} encuestas detractoras canalizadas automáticamente a la bandeja de pendientes del analista.`
    );

    return {
      totalImported: newSurveys.length,
      detractorsFound: newPendingList.length,
    };
  };

  const clearSurveys = async (includePendingFromSurveys = false): Promise<number> => {
    setIsSyncing(true);
    try {
      const deletedCount = await persistClearSurveys(includePendingFromSurveys);
      setSurveys([]);
      if (includePendingFromSurveys) {
        setPendingAnalyses((prev) =>
          prev.filter(
            (p) =>
              !(
                p.status === 'PENDIENTE' &&
                (p.origin === 'ENCUESTA_DETRACTORA_VOZ' || p.origin === 'ENCUESTA_DETRACTORA_CHAT')
              )
          )
        );
      }
      surveysLoadedRef.current = true;
      setSyncError(null);
      addAuditLog(
        'Limpieza de Encuestas',
        'Analista',
        `Se eliminó toda la base de encuestas (${deletedCount} registro(s))${
          includePendingFromSurveys ? ' junto con sus pendientes sin analizar' : ''
        }.`
      );
      return deletedCount;
    } catch (err) {
      console.error('Failed to clear surveys:', err);
      setSyncError(formatFirestoreUserError(err, 'eliminar base de encuestas'));
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Pending Analysis Queue Methods
  const createPendingAnalysis = (
    item: Omit<PendingAnalysisItem, 'id' | 'createdAt' | 'status'>
  ): PendingAnalysisItem => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const newItem: PendingAnalysisItem = {
      ...item,
      id: `pen-${Date.now()}`,
      status: 'PENDIENTE',
      createdAt: timestamp,
    };
    setPendingAnalyses((prev) => [newItem, ...prev]);
    runPersist(persistPendingCreate(newItem), 'registrar caso pendiente');
    addAuditLog(
      'Caso Pendiente Registrado',
      'Analista',
      `Se agregó caso ${newItem.ticketNumber} a la bandeja de análisis.`
    );
    return newItem;
  };

  const completePendingAnalysis = (pendingId: string, completedMonitoringId: string) => {
    setPendingAnalyses((prev) =>
      prev.map((p) =>
        p.id === pendingId ? { ...p, status: 'ANALIZADO', completedMonitoringId } : p
      )
    );
    runPersist(
      persistPendingComplete(pendingId, completedMonitoringId),
      'completar caso pendiente'
    );
  };

  const deletePendingAnalysis = (pendingId: string) => {
    setPendingAnalyses((prev) => prev.filter((p) => p.id !== pendingId));
    runPersist(persistPendingDelete(pendingId), 'eliminar caso pendiente');
    addAuditLog(
      'Eliminación de Caso Pendiente',
      'Analista',
      `Se removió el pendiente ${pendingId} de la bandeja.`
    );
  };

  const clearAllRecords = async () => {
    if (authUserProfile?.role !== 'admin' || !firebaseUid) return;
    setIsSyncing(true);
    try {
      await clearAllRecordsInDb(authUserProfile);
      surveysLoadedRef.current = false;
      catalogLoadedAtRef.current = 0;
      await hydrateFromFirestore(authUserProfile, firebaseUid, { forceCatalogs: true });
    } catch (err) {
      console.error('Failed to clear all records:', err);
      setSyncError(formatFirestoreUserError(err, 'vaciar registros'));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        authStatus,
        authEmail,
        authError,
        authNotice,
        clearAuthNotice,
        authUserProfile,
        isSyncing,
        syncError,
        clearSyncError,
        signInWithGoogle,
        signInWithEmailPassword,
        registerWithEmailPassword,
        resetPasswordWithEmail,
        resendVerificationEmail,
        verifyEmailAndContinue,
        setAccountPassword,
        signOutUser,
        refreshData,
        currentUser,
        setCurrentUser,
        currentPermissions,
        hasPermission,
        canAccessSection,
        canAccessSubSection,
        activeSection,
        setActiveSection,
        activeSubSection,
        setActiveSubSection,
        navigateTo,
        users,
        addUser,
        importUsersBulk,
        updateUser,
        toggleUserStatus,
        updateUserDependencies,
        categories,
        addCategory,
        editCategory,
        deleteCategory,
        addMotivo,
        editMotivo,
        deleteMotivo,
        addCausaRaiz,
        editCausaRaiz,
        deleteCausaRaiz,
        importCategories,
        contactReasons,
        addContactReason,
        editContactReason,
        deleteContactReason,
        toggleContactReasonStatus,
        replaceContactReasons,
        monitorings,
        createMonitoring,
        submitTLFeedback,
        submitAgentCommitment,
        refuteMonitoring,
        resolveRefutedMonitoring,
        roles,
        addRole,
        updateRole,
        deleteRole,
        auditLogs,
        addAuditLog,
        clearAllRecords,
        surveys,
        importSurveys,
        clearSurveys,
        pendingAnalyses,
        createPendingAnalysis,
        completePendingAnalysis,
        deletePendingAnalysis,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
