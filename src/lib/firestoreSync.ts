import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, cleanForFirestore } from './firebase';
import type {
  User,
  CategoryItem,
  ContactReasonItem,
  SurveyItem,
  PendingAnalysisItem,
  MonitoringItem,
  RolePermission,
  AuditLog,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_MONITORINGS,
  INITIAL_ROLE_PERMISSIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SURVEYS,
  INITIAL_PENDING_ANALYSES,
  INITIAL_CONTACT_REASONS,
} from '../data/initialData';

const BOOTSTRAP_ADMIN_EMAIL = 'luis.montenegro@xtendo-it.com';

export function sanitizeDocId(rawId: string, fallbackPrefix = 'doc'): string {
  const cleaned = rawId
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return cleaned || `${fallbackPrefix}-${Date.now()}`;
}

function stripServerFields<T extends object>(raw: T): T {
  const copy = { ...(raw as Record<string, unknown>) };
  delete copy.serverCreatedAt;
  delete copy.serverUpdatedAt;
  delete copy.authorUid;
  return copy as T;
}

function toDirectoryPayload(u: User) {
  return cleanForFirestore({
    id: sanitizeDocId(u.id, 'usr'),
    name: u.name.trim().slice(0, 150),
    voiceName: (u.voiceName || '').trim().slice(0, 150),
    employeeCode: u.employeeCode,
    role: u.role,
    status: u.status,
    reportsToId: u.reportsToId || '',
    department: u.department || 'Operaciones',
    authUid: u.authUid || '',
    serverUpdatedAt: serverTimestamp(),
  });
}

function toUserPayload(u: User, isCreate = false) {
  return cleanForFirestore({
    id: sanitizeDocId(u.id, 'usr'),
    name: u.name.trim().slice(0, 150),
    voiceName: (u.voiceName || '').trim().slice(0, 150),
    email: u.email.trim().toLowerCase().slice(0, 200),
    employeeCode: u.employeeCode,
    role: u.role,
    status: u.status,
    reportsToId: u.reportsToId || '',
    department: u.department || 'Operaciones',
    avatar: u.avatar,
    phone: u.phone,
    authUid: u.authUid,
    ...(isCreate ? { serverCreatedAt: serverTimestamp() } : {}),
    serverUpdatedAt: serverTimestamp(),
  });
}

type BatchOp =
  | { type: 'set'; path: string; id: string; data: Record<string, unknown>; merge?: boolean }
  | { type: 'delete'; path: string; id: string };

async function commitChunkedBatch(ops: BatchOp[]): Promise<void> {
  const CHUNK_SIZE = 380;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      const ref = doc(db, op.path, op.id);
      if (op.type === 'delete') {
        batch.delete(ref);
      } else if (op.merge) {
        batch.set(ref, op.data, { merge: true });
      } else {
        batch.set(ref, op.data);
      }
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, chunk[0]?.path || null);
    }
  }
}

export type SessionResolution =
  | { status: 'ready'; profile: User }
  | { status: 'unauthorized'; email: string }
  | { status: 'inactive'; email: string; profile: User };

export async function resolveUserSession(fbUser: FirebaseUser): Promise<SessionResolution> {
  const authEmail = (fbUser.email || '').trim().toLowerCase();
  if (!authEmail) {
    return { status: 'unauthorized', email: '' };
  }

  let matchedUser: User | null = null;
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', authEmail)));
    if (!snap.empty) {
      const docData = snap.docs[0].data() as User;
      matchedUser = stripServerFields({ ...docData, id: snap.docs[0].id });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }

  // Bootstrap primary admin on first sign-in if not yet in directory
  if (!matchedUser && authEmail === BOOTSTRAP_ADMIN_EMAIL) {
    const adminProfile: User = {
      id: 'usr-admin-root',
      name: fbUser.displayName || 'Luis Montenegro',
      email: BOOTSTRAP_ADMIN_EMAIL,
      employeeCode: 'ADM-000',
      role: 'admin',
      status: 'active',
      department: 'Administración del Sistema',
      authUid: fbUser.uid,
    };
    try {
      await setDoc(doc(db, 'users', adminProfile.id), toUserPayload(adminProfile, true));
      await setDoc(doc(db, 'directory', adminProfile.id), toDirectoryPayload(adminProfile));
      await setDoc(doc(db, 'admins', fbUser.uid), {
        uid: fbUser.uid,
        userId: adminProfile.id,
        email: authEmail,
        grantedBy: fbUser.uid,
        serverCreatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'staff_claims', fbUser.uid), {
        uid: fbUser.uid,
        userId: adminProfile.id,
        email: authEmail,
        role: 'admin',
        status: 'active',
        serverUpdatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
    matchedUser = adminProfile;
  }

  if (!matchedUser) {
    return { status: 'unauthorized', email: authEmail };
  }

  // Ensure primary admin (luis.montenegro@xtendo-it.com) is always active admin
  if (authEmail === BOOTSTRAP_ADMIN_EMAIL && (matchedUser.role !== 'admin' || matchedUser.status !== 'active')) {
    const promotedUser: User = {
      ...matchedUser,
      role: 'admin',
      status: 'active',
      authUid: fbUser.uid,
    };
    try {
      await commitChunkedBatch([
        { type: 'set', path: 'users', id: promotedUser.id, data: toUserPayload(promotedUser, false), merge: true },
        { type: 'set', path: 'directory', id: promotedUser.id, data: toDirectoryPayload(promotedUser) },
      ]);
      matchedUser = promotedUser;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${promotedUser.id}`);
    }
  }

  if (matchedUser.status !== 'active') {
    return { status: 'inactive', email: authEmail, profile: matchedUser };
  }

  // Link Firebase Auth UID to user document if missing/changed
  if (matchedUser.authUid !== fbUser.uid) {
    try {
      await updateDoc(doc(db, 'users', matchedUser.id), {
        authUid: fbUser.uid,
        serverUpdatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'directory', matchedUser.id), toDirectoryPayload({ ...matchedUser, authUid: fbUser.uid }));
      matchedUser = { ...matchedUser, authUid: fbUser.uid };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${matchedUser.id}`);
    }
  }

  // Ensure staff_claims/{uid} exists and matches current role/status
  try {
    const claimRef = doc(db, 'staff_claims', fbUser.uid);
    const claimSnap = await getDoc(claimRef);
    const claimData = claimSnap.exists() ? (claimSnap.data() as { role?: string; status?: string; userId?: string }) : null;
    if (
      !claimSnap.exists() ||
      (matchedUser.role === 'admin' &&
        (claimData?.role !== matchedUser.role ||
          claimData?.status !== matchedUser.status ||
          claimData?.userId !== matchedUser.id))
    ) {
      await setDoc(claimRef, {
        uid: fbUser.uid,
        userId: matchedUser.id,
        email: authEmail,
        role: matchedUser.role,
        status: matchedUser.status,
        serverUpdatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `staff_claims/${fbUser.uid}`);
  }

  // Ensure admins/{uid} marker exists if role is admin
  if (matchedUser.role === 'admin') {
    try {
      const adminRef = doc(db, 'admins', fbUser.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: fbUser.uid,
          userId: matchedUser.id,
          email: authEmail,
          grantedBy: fbUser.uid,
          serverCreatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${fbUser.uid}`);
    }
  }

  // Purge any previously seeded demo records if present & ensure system role schemas exist
  if (matchedUser.role === 'admin') {
    await purgeKnownDemoRecords(matchedUser);
    await ensureSystemRolesIfEmpty();
  }

  return { status: 'ready', profile: matchedUser };
}

async function ensureSystemRolesIfEmpty(): Promise<void> {
  try {
    const roleSnap = await getDocs(query(collection(db, 'roles'), limit(1)));
    if (!roleSnap.empty) return;

    const ops: BatchOp[] = INITIAL_ROLE_PERMISSIONS.map((role) => {
      const id = sanitizeDocId(role.id, 'role');
      return {
        type: 'set',
        path: 'roles',
        id,
        data: cleanForFirestore({ ...role, id, serverUpdatedAt: serverTimestamp() }),
      };
    });
    await commitChunkedBatch(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'roles');
  }
}

async function purgeKnownDemoRecords(currentAdmin: User): Promise<void> {
  try {
    const [demoUserSnap, demoCatSnap, demoMonSnap, demoSrvSnap] = await Promise.all([
      getDoc(doc(db, 'users', 'usr-admin-1')),
      getDoc(doc(db, 'categories', 'cat-001')),
      getDoc(doc(db, 'monitorings', 'MON-001')),
      getDoc(doc(db, 'surveys', 'srv-voz-001')),
    ]);

    if (
      !demoUserSnap.exists() &&
      !demoCatSnap.exists() &&
      !demoMonSnap.exists() &&
      !demoSrvSnap.exists()
    ) {
      return;
    }

    const ops: BatchOp[] = [];
    const currentAdminEmail = currentAdmin.email.trim().toLowerCase();

    for (const u of INITIAL_USERS) {
      if (u.email.toLowerCase() === currentAdminEmail || u.id === currentAdmin.id) continue;
      const id = sanitizeDocId(u.id, 'usr');
      ops.push({ type: 'delete', path: 'users', id });
      ops.push({ type: 'delete', path: 'directory', id });
    }
    for (const cat of INITIAL_CATEGORIES) {
      ops.push({ type: 'delete', path: 'categories', id: sanitizeDocId(cat.id, 'cat') });
    }
    for (const cr of INITIAL_CONTACT_REASONS) {
      ops.push({ type: 'delete', path: 'contact_reasons', id: sanitizeDocId(cr.id, 'mot') });
    }
    for (const srv of INITIAL_SURVEYS) {
      ops.push({ type: 'delete', path: 'surveys', id: sanitizeDocId(srv.id, 'srv') });
    }
    for (const pen of INITIAL_PENDING_ANALYSES) {
      ops.push({ type: 'delete', path: 'pending_analyses', id: sanitizeDocId(pen.id, 'pen') });
    }
    for (const mon of INITIAL_MONITORINGS) {
      const id = sanitizeDocId(mon.id.replace(/^mon-/i, 'MON-'), 'MON');
      ops.push({ type: 'delete', path: 'monitorings', id });
    }

    if (ops.length > 0) {
      await commitChunkedBatch(ops);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'demo_cleanup');
  }
}

export async function clearAllRecords(currentAdmin: User): Promise<void> {
  const ops: BatchOp[] = [];
  const keepUserId = sanitizeDocId(currentAdmin.id, 'usr');
  const keepUid = currentAdmin.authUid || '';

  const collectionsToWipe = [
    'surveys',
    'pending_analyses',
    'monitorings',
    'categories',
    'contact_reasons',
  ];

  for (const colName of collectionsToWipe) {
    try {
      const snap = await getDocs(collection(db, colName));
      snap.docs.forEach((d) => {
        ops.push({ type: 'delete', path: colName, id: d.id });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colName);
    }
  }

  try {
    const [usersSnap, dirSnap, claimsSnap, adminsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'directory')),
      getDocs(collection(db, 'staff_claims')),
      getDocs(collection(db, 'admins')),
    ]);

    usersSnap.docs.forEach((d) => {
      if (d.id !== keepUserId) ops.push({ type: 'delete', path: 'users', id: d.id });
    });
    dirSnap.docs.forEach((d) => {
      if (d.id !== keepUserId) ops.push({ type: 'delete', path: 'directory', id: d.id });
    });
    claimsSnap.docs.forEach((d) => {
      if (d.id !== keepUid) ops.push({ type: 'delete', path: 'staff_claims', id: d.id });
    });
    adminsSnap.docs.forEach((d) => {
      if (d.id !== keepUid) ops.push({ type: 'delete', path: 'admins', id: d.id });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }

  if (ops.length > 0) {
    await commitChunkedBatch(ops);
  }
}

export interface LoadedWorkspaceData {
  users?: User[];
  categories?: CategoryItem[];
  contactReasons?: ContactReasonItem[];
  roles?: RolePermission[];
  monitorings: MonitoringItem[];
  surveys?: SurveyItem[];
  pendingAnalyses: PendingAnalysisItem[];
  auditLogs: AuditLog[];
}

export interface LoadWorkspaceOptions {
  includeCatalogs?: boolean;
  includeSurveys?: boolean;
}

export async function loadSurveysBatch(): Promise<SurveyItem[]> {
  try {
    const srvSnap = await getDocs(
      query(collection(db, 'surveys'), orderBy('createdAt', 'desc'), limit(350))
    );
    return srvSnap.docs.map((d) => stripServerFields({ ...(d.data() as SurveyItem), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'surveys');
  }
}

export async function loadWorkspaceData(
  profile: User,
  fbUid: string,
  options: LoadWorkspaceOptions = {}
): Promise<LoadedWorkspaceData> {
  const { includeCatalogs = true, includeSurveys = false } = options;
  const isAdmin = profile.role === 'admin';
  const isAnalystOrCoord = profile.role === 'analista' || profile.role === 'coordinador' || isAdmin;

  // 1 & 2. Directory / Users & Static Catalogs (only fetched on boot or when cache TTL expires)
  let users: User[] | undefined;
  let categories: CategoryItem[] | undefined;
  let contactReasons: ContactReasonItem[] | undefined;
  let roles: RolePermission[] | undefined;

  if (includeCatalogs) {
    if (isAdmin) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        users = snap.docs.map((d) => stripServerFields({ ...(d.data() as User), id: d.id }));
        const bootstrapTarget = users.find(
          (u) => u.email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL
        );
        if (
          bootstrapTarget &&
          (bootstrapTarget.role !== 'admin' || bootstrapTarget.status !== 'active')
        ) {
          const promoted: User = {
            ...bootstrapTarget,
            role: 'admin',
            status: 'active',
          };
          users = users.map((u) => (u.id === promoted.id ? promoted : u));
          await persistUserUpdate(promoted);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    } else {
      try {
        const dirSnap = await getDocs(collection(db, 'directory'));
        users = dirSnap.docs.map((d) => {
          const data = d.data() as Omit<User, 'email'>;
          return stripServerFields({
            ...data,
            id: d.id,
            email: d.id === profile.id ? profile.email : '',
          } as User);
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'directory');
      }
    }

    try {
      const snap = await getDocs(collection(db, 'categories'));
      categories = snap.docs.map((d) => stripServerFields({ ...(d.data() as CategoryItem), id: d.id }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    }

    try {
      const snap = await getDocs(collection(db, 'contact_reasons'));
      contactReasons = snap.docs.map((d) =>
        stripServerFields({ ...(d.data() as ContactReasonItem), id: d.id })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'contact_reasons');
    }

    try {
      const snap = await getDocs(collection(db, 'roles'));
      roles = snap.docs.map((d) => stripServerFields({ ...(d.data() as RolePermission), id: d.id }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'roles');
    }
  }

  // 3. Monitorings (Role-scoped & quota-friendly)
  let monitorings: MonitoringItem[] = [];
  try {
    const monCol = collection(db, 'monitorings');
    let qMon;
    if (isAnalystOrCoord) {
      qMon = query(monCol, orderBy('createdAt', 'desc'), limit(500));
    } else if (profile.role === 'team_leader') {
      qMon = query(monCol, where('teamLeaderId', '==', profile.id), limit(300));
    } else {
      qMon = query(monCol, where('agentId', '==', profile.id), limit(200));
    }
    const snap = await getDocs(qMon);
    monitorings = snap.docs
      .map((d) => stripServerFields({ ...(d.data() as MonitoringItem), id: d.id }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'monitorings');
  }

  // 4. Surveys (deferred on-demand) & Pending Analyses (Only loaded for Analysts, Coordinators, and Admins)
  let surveys: SurveyItem[] | undefined;
  let pendingAnalyses: PendingAnalysisItem[] = [];
  if (isAnalystOrCoord) {
    if (includeSurveys) {
      surveys = await loadSurveysBatch();
    }

    try {
      const penSnap = await getDocs(
        query(collection(db, 'pending_analyses'), orderBy('createdAt', 'desc'), limit(300))
      );
      pendingAnalyses = penSnap.docs.map((d) =>
        stripServerFields({ ...(d.data() as PendingAnalysisItem), id: d.id })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'pending_analyses');
    }
  }

  // 5. Audit Logs (Scoped by role, excluding legacy demo log IDs if present)
  let auditLogs: AuditLog[] = [];
  const demoLogIds = new Set(INITIAL_AUDIT_LOGS.map((l) => l.id));
  try {
    const logCol = collection(db, 'audit_logs');
    const qLogs = isAnalystOrCoord
      ? query(logCol, orderBy('timestamp', 'desc'), limit(200))
      : query(logCol, where('authorUid', '==', fbUid), limit(50));
    const snap = await getDocs(qLogs);
    auditLogs = snap.docs
      .filter((d) => !demoLogIds.has(d.id))
      .map((d) => stripServerFields({ ...(d.data() as AuditLog), id: d.id }))
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'audit_logs');
  }

  return {
    users,
    categories,
    contactReasons,
    roles,
    monitorings,
    surveys,
    pendingAnalyses,
    auditLogs,
  };
}

// --- Persistence Operations ---

export async function persistUserCreate(user: User): Promise<void> {
  const id = sanitizeDocId(user.id, 'usr');
  await commitChunkedBatch([
    { type: 'set', path: 'users', id, data: toUserPayload(user, true) },
    { type: 'set', path: 'directory', id, data: toDirectoryPayload(user) },
  ]);
}

export async function persistUsersBulk(users: User[]): Promise<void> {
  const ops: BatchOp[] = [];
  for (const u of users) {
    const id = sanitizeDocId(u.id, 'usr');
    ops.push({ type: 'set', path: 'users', id, data: toUserPayload(u, true) });
    ops.push({ type: 'set', path: 'directory', id, data: toDirectoryPayload(u) });
  }
  await commitChunkedBatch(ops);
}

export async function persistUserUpdate(user: User): Promise<void> {
  const id = sanitizeDocId(user.id, 'usr');
  const normalizedEmail = user.email.trim().toLowerCase();
  const effectiveUser: User =
    normalizedEmail === BOOTSTRAP_ADMIN_EMAIL
      ? { ...user, email: normalizedEmail, role: 'admin', status: 'active' }
      : { ...user, email: normalizedEmail };

  const ops: BatchOp[] = [
    { type: 'set', path: 'users', id, data: toUserPayload(effectiveUser, false), merge: true },
    { type: 'set', path: 'directory', id, data: toDirectoryPayload(effectiveUser) },
  ];

  if (effectiveUser.authUid) {
    ops.push({
      type: 'set',
      path: 'staff_claims',
      id: effectiveUser.authUid,
      data: cleanForFirestore({
        uid: effectiveUser.authUid,
        userId: id,
        email: normalizedEmail,
        role: effectiveUser.role,
        status: effectiveUser.status,
        serverUpdatedAt: serverTimestamp(),
      }),
    });

    try {
      const adminSnap = await getDoc(doc(db, 'admins', effectiveUser.authUid));
      if (effectiveUser.role === 'admin' && effectiveUser.status === 'active') {
        if (!adminSnap.exists()) {
          ops.push({
            type: 'set',
            path: 'admins',
            id: effectiveUser.authUid,
            data: cleanForFirestore({
              uid: effectiveUser.authUid,
              userId: id,
              email: normalizedEmail,
              serverCreatedAt: serverTimestamp(),
            }),
          });
        }
      } else if (adminSnap.exists() && normalizedEmail !== BOOTSTRAP_ADMIN_EMAIL) {
        ops.push({
          type: 'delete',
          path: 'admins',
          id: effectiveUser.authUid,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `admins/${effectiveUser.authUid}`);
    }
  }
  await commitChunkedBatch(ops);
}

export async function persistUserDependenciesBatch(
  users: User[],
  existingIds?: Set<string>
): Promise<void> {
  const ops: BatchOp[] = [];
  for (const u of users) {
    const id = sanitizeDocId(u.id, 'usr');
    const isNew = existingIds ? !existingIds.has(id) : false;
    if (isNew) {
      ops.push({
        type: 'set',
        path: 'users',
        id,
        data: toUserPayload(u, true),
      });
    } else {
      ops.push({
        type: 'set',
        path: 'users',
        id,
        data: toUserPayload(u, false),
        merge: true,
      });
    }
    ops.push({ type: 'set', path: 'directory', id, data: toDirectoryPayload(u) });
  }
  await commitChunkedBatch(ops);
}

export async function persistCategoryUpsert(cat: CategoryItem): Promise<void> {
  const id = sanitizeDocId(cat.id, 'cat');
  try {
    await setDoc(
      doc(db, 'categories', id),
      cleanForFirestore({ ...cat, id, serverUpdatedAt: serverTimestamp() })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `categories/${id}`);
  }
}

export async function persistCategoryDelete(catId: string): Promise<void> {
  const id = sanitizeDocId(catId, 'cat');
  try {
    await deleteDoc(doc(db, 'categories', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
  }
}

export async function persistCategoriesReplaceAll(
  previousCategories: CategoryItem[],
  newCategories: CategoryItem[]
): Promise<void> {
  const ops: BatchOp[] = [];
  const nextIds = new Set(newCategories.map((c) => sanitizeDocId(c.id, 'cat')));
  for (const oldCat of previousCategories) {
    const oldId = sanitizeDocId(oldCat.id, 'cat');
    if (!nextIds.has(oldId)) {
      ops.push({ type: 'delete', path: 'categories', id: oldId });
    }
  }
  for (const cat of newCategories) {
    const id = sanitizeDocId(cat.id, 'cat');
    ops.push({
      type: 'set',
      path: 'categories',
      id,
      data: cleanForFirestore({ ...cat, id, serverUpdatedAt: serverTimestamp() }),
    });
  }
  await commitChunkedBatch(ops);
}

export async function persistContactReasonUpsert(reason: ContactReasonItem): Promise<void> {
  const id = sanitizeDocId(reason.id, 'mot');
  try {
    await setDoc(
      doc(db, 'contact_reasons', id),
      cleanForFirestore({ ...reason, id, serverUpdatedAt: serverTimestamp() })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `contact_reasons/${id}`);
  }
}

export async function persistContactReasonDelete(reasonId: string): Promise<void> {
  const id = sanitizeDocId(reasonId, 'mot');
  try {
    await deleteDoc(doc(db, 'contact_reasons', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `contact_reasons/${id}`);
  }
}

export async function persistContactReasonsReplaceAll(
  previousReasons: ContactReasonItem[],
  newReasons: ContactReasonItem[]
): Promise<void> {
  const ops: BatchOp[] = [];
  for (const prev of previousReasons) {
    ops.push({ type: 'delete', path: 'contact_reasons', id: sanitizeDocId(prev.id, 'mot') });
  }
  for (const next of newReasons) {
    const id = sanitizeDocId(next.id, 'mot');
    ops.push({
      type: 'set',
      path: 'contact_reasons',
      id,
      data: cleanForFirestore({ ...next, id, serverUpdatedAt: serverTimestamp() }),
    });
  }
  await commitChunkedBatch(ops);
}

export async function persistMonitoringCreate(mon: MonitoringItem): Promise<void> {
  const id = sanitizeDocId(mon.id, 'MON');
  try {
    await setDoc(
      doc(db, 'monitorings', id),
      cleanForFirestore({
        ...mon,
        id,
        agentEmail: (mon.agentEmail || '').toLowerCase(),
        teamLeaderEmail: (mon.teamLeaderEmail || '').toLowerCase(),
        analystEmail: (mon.analystEmail || '').toLowerCase(),
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `monitorings/${id}`);
  }
}

export async function persistMonitoringTLFeedback(
  monitoringId: string,
  tlFeedback: NonNullable<MonitoringItem['tlFeedback']>,
  updatedAt: string
): Promise<void> {
  const id = sanitizeDocId(monitoringId, 'MON');
  try {
    await updateDoc(
      doc(db, 'monitorings', id),
      cleanForFirestore({
        status: 'PENDIENTE_AGENTE',
        tlFeedback,
        updatedAt,
        serverUpdatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `monitorings/${id}`);
  }
}

export async function persistMonitoringAgentCommitment(
  monitoringId: string,
  agentCommitment: NonNullable<MonitoringItem['agentCommitment']>,
  updatedAt: string
): Promise<void> {
  const id = sanitizeDocId(monitoringId, 'MON');
  try {
    await updateDoc(
      doc(db, 'monitorings', id),
      cleanForFirestore({
        status: 'CERRADO',
        agentCommitment,
        updatedAt,
        serverUpdatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `monitorings/${id}`);
  }
}

export async function persistMonitoringRefutation(
  monitoringId: string,
  refutations: NonNullable<MonitoringItem['refutations']>,
  latestRefutation: NonNullable<MonitoringItem['latestRefutation']>,
  updatedAt: string,
  pendingItem: PendingAnalysisItem
): Promise<void> {
  const monId = sanitizeDocId(monitoringId, 'MON');
  const penId = sanitizeDocId(pendingItem.id, 'pen');
  try {
    await updateDoc(
      doc(db, 'monitorings', monId),
      cleanForFirestore({
        status: 'REFUTADO',
        refutations,
        latestRefutation,
        updatedAt,
        serverUpdatedAt: serverTimestamp(),
      })
    );
    await setDoc(
      doc(db, 'pending_analyses', penId),
      cleanForFirestore({
        ...pendingItem,
        id: penId,
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `monitorings/${monId}`);
  }
}

export async function persistMonitoringResolveRefutation(mon: MonitoringItem): Promise<void> {
  const id = sanitizeDocId(mon.id, 'MON');
  const payload = cleanForFirestore({
    ticketNumber: mon.ticketNumber,
    customerIdentifier: mon.customerIdentifier,
    channel: mon.channel,
    callDate: mon.callDate,
    callTime: mon.callTime,
    callDurationSec: mon.callDurationSec,
    audioRecordingId: mon.audioRecordingId,
    score: mon.score,
    surveyScore: mon.surveyScore,
    contactReason: mon.contactReason,
    chatId: mon.chatId,
    inboxName: mon.inboxName,
    segment: mon.segment,
    clasificacionEmpresas: mon.clasificacionEmpresas,
    csat: mon.csat,
    fcr: mon.fcr,
    effort: mon.effort,
    asesorPersonalizado: mon.asesorPersonalizado,
    agentId: mon.agentId,
    agentName: mon.agentName,
    agentEmail: (mon.agentEmail || '').toLowerCase(),
    teamLeaderId: mon.teamLeaderId,
    teamLeaderName: mon.teamLeaderName,
    teamLeaderEmail: (mon.teamLeaderEmail || '').toLowerCase(),
    analystId: mon.analystId,
    analystName: mon.analystName,
    analystEmail: (mon.analystEmail || '').toLowerCase(),
    category1: mon.category1,
    hasSecondCategory: mon.hasSecondCategory,
    category2: mon.category2,
    areaImputable: mon.areaImputable,
    requiresFeedback: mon.requiresFeedback,
    qaFindings: mon.qaFindings,
    status: mon.status,
    updatedAt: mon.updatedAt,
  });

  try {
    await updateDoc(doc(db, 'monitorings', id), {
      ...payload,
      tlFeedback: deleteField(),
      agentCommitment: deleteField(),
      serverUpdatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `monitorings/${id}`);
  }
}

export async function persistSurveysAndPendingImport(
  surveys: SurveyItem[],
  pendingItems: PendingAnalysisItem[]
): Promise<void> {
  const ops: BatchOp[] = [];
  for (const s of surveys) {
    const id = sanitizeDocId(s.id, 'srv');
    ops.push({
      type: 'set',
      path: 'surveys',
      id,
      data: cleanForFirestore({ ...s, id, serverCreatedAt: serverTimestamp() }),
    });
  }
  for (const p of pendingItems) {
    const id = sanitizeDocId(p.id, 'pen');
    ops.push({
      type: 'set',
      path: 'pending_analyses',
      id,
      data: cleanForFirestore({
        ...p,
        id,
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      }),
    });
  }
  await commitChunkedBatch(ops);
}

export async function persistClearSurveys(includePendingFromSurveys = false): Promise<number> {
  const ops: BatchOp[] = [];
  let deletedSurveysCount = 0;

  try {
    const srvSnap = await getDocs(collection(db, 'surveys'));
    deletedSurveysCount = srvSnap.size;
    srvSnap.docs.forEach((d) => {
      ops.push({
        type: 'delete',
        path: 'surveys',
        id: d.id,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'surveys');
  }

  if (includePendingFromSurveys) {
    try {
      const penSnap = await getDocs(collection(db, 'pending_analyses'));
      penSnap.docs.forEach((d) => {
        const data = d.data() as PendingAnalysisItem;
        if (
          data.status === 'PENDIENTE' &&
          (data.origin === 'ENCUESTA_DETRACTORA_VOZ' || data.origin === 'ENCUESTA_DETRACTORA_CHAT')
        ) {
          ops.push({
            type: 'delete',
            path: 'pending_analyses',
            id: d.id,
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'pending_analyses');
    }
  }

  if (ops.length > 0) {
    await commitChunkedBatch(ops);
  }

  return deletedSurveysCount;
}

export async function persistPendingCreate(item: PendingAnalysisItem): Promise<void> {
  const id = sanitizeDocId(item.id, 'pen');
  try {
    await setDoc(
      doc(db, 'pending_analyses', id),
      cleanForFirestore({
        ...item,
        id,
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `pending_analyses/${id}`);
  }
}

export async function persistPendingComplete(
  pendingId: string,
  completedMonitoringId: string
): Promise<void> {
  const id = sanitizeDocId(pendingId, 'pen');
  try {
    await updateDoc(doc(db, 'pending_analyses', id), {
      status: 'ANALIZADO',
      completedMonitoringId,
      serverUpdatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `pending_analyses/${id}`);
  }
}

export async function persistPendingDelete(pendingId: string): Promise<void> {
  const id = sanitizeDocId(pendingId, 'pen');
  try {
    await deleteDoc(doc(db, 'pending_analyses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `pending_analyses/${id}`);
  }
}

export async function persistRoleUpsert(role: RolePermission): Promise<void> {
  const id = sanitizeDocId(role.id, 'role');
  try {
    await setDoc(
      doc(db, 'roles', id),
      cleanForFirestore({ ...role, id, serverUpdatedAt: serverTimestamp() })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `roles/${id}`);
  }
}

export async function persistRoleDelete(roleId: string): Promise<void> {
  const id = sanitizeDocId(roleId, 'role');
  try {
    await deleteDoc(doc(db, 'roles', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `roles/${id}`);
  }
}

export async function persistAuditLog(log: AuditLog, authorUid: string): Promise<void> {
  const id = sanitizeDocId(log.id, 'log');
  try {
    await setDoc(
      doc(db, 'audit_logs', id),
      cleanForFirestore({
        ...log,
        id,
        authorUid,
        serverCreatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${id}`);
  }
}
