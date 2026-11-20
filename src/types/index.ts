export type UserRole = 'asesor' | 'team_leader' | 'coordinador' | 'analista' | 'admin';

export interface User {
  id: string;
  name: string;
  voiceName?: string;
  email: string;
  employeeCode: string;
  role: UserRole;
  status: 'active' | 'inactive';
  reportsToId?: string; // Asesor reports to TL, TL reports to Coordinador
  department: string;
  avatar?: string;
  phone?: string;
  authUid?: string;
}

export type ChannelType = 'Voz' | 'Chat' | 'WhatsApp' | 'Correo';

export type AreaImputable = 'Asesor' | 'Negocio' | 'Cliente';

export type MonitoringStatus = 
  | 'PENDIENTE_TL'
  | 'PENDIENTE_AGENTE'
  | 'CERRADO'
  | 'CONFORME_SIN_FEEDBACK'
  | 'REFUTADO';

export interface RefutationEntry {
  refutedByRole: 'team_leader' | 'asesor';
  refutedById: string;
  refutedByName: string;
  reason: string;
  refutedAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  code?: string;
  motivos: MotivoItem[];
}

export interface MotivoItem {
  id: string;
  name: string;
  categoriaId: string;
  causasRaiz: CausaRaizItem[];
}

export interface CausaRaizItem {
  id: string;
  name: string;
  motivoId: string;
  categoriaId: string;
  areaImputable?: AreaImputable;
  definicion?: string;
}

export interface CategorySelection {
  categoria: string;
  motivo: string;
  causaRaiz: string;
}

export interface QAItemScore {
  criterion: string;
  maxScore: number;
  obtainedScore: number;
  complies: boolean;
}

export interface MonitoringItem {
  id: string;
  ticketNumber: string;
  customerIdentifier: string; // Línea o documento o ID de cliente
  channel: ChannelType;
  callDate: string; // YYYY-MM-DD
  callTime?: string; // HH:mm
  callDurationSec: number;
  audioRecordingId?: string;
  score: number; // Mantenido numérico para cálculos internos de reportería; removido del formulario
  scoreItems?: QAItemScore[];

  // Campos de encuesta y motivo de contacto
  surveyScore?: number; // Nota de la encuesta (0 a 10)
  contactReason?: string; // Motivo de contacto seleccionado
  chatId?: string; // Código del chat
  inboxName?: string; // inbox_name original (ej. WA :: 59895702611)
  segment?: string; // B2C o B2B
  clasificacionEmpresas?: string; // Valor original de Clasificación Empresas (Particular = B2C, resto = B2B)
  csat?: string; // Satisfacción (CSAT)
  fcr?: string; // Resolución (FCR)
  effort?: string; // Esfuerzo del cliente (Effort)
  asesorPersonalizado?: string; // _AsesorPersonalizado

  // Relationships
  agentId: string;
  agentName: string;
  agentEmail?: string;
  teamLeaderId: string;
  teamLeaderName: string;
  teamLeaderEmail?: string;
  analystId: string;
  analystName: string;
  analystEmail?: string;

  // Categorizations
  category1: CategorySelection;
  hasSecondCategory: boolean;
  category2?: CategorySelection;

  areaImputable: AreaImputable;
  requiresFeedback: boolean;
  status: MonitoringStatus;

  // Findings from QA Analyst
  qaFindings?: {
    criticalFinding: string;
    strengths?: string;
    opportunities?: string;
    priority: 'Alta' | 'Media' | 'Baja';
    createdAt: string;
  };

  // TL Feedback stage
  tlFeedback?: {
    feedbackDate: string;
    feedbackType?: 'Refuerzo' | 'Correctivo' | 'Calibración';
    observations: string;
    actionPlan: string;
    submittedAt: string;
    submittedByTLId: string;
  };

  // Agent Commitment stage
  agentCommitment?: {
    commitmentText: string;
    actionStep: string;
    targetCompletionDate: string;
    signedAt: string;
    signatureConfirmed: boolean;
  };

  // Refutations history (when TL or Asesor returns monitoring to Analyst for review)
  refutations?: RefutationEntry[];
  latestRefutation?: RefutationEntry;

  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: 'General' | 'Analista' | 'Reportería' | 'Administrador' | 'Autenticación';
  details: string;
  targetId?: string;
}

export interface RolePermission {
  id: string;
  roleKey: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: {
    canViewAssignedInbox: boolean;
    canViewTeamDashboard: boolean;
    canViewExecutiveDashboard: boolean;
    canCreateMonitoring: boolean;
    canManageCategories: boolean;
    canGiveTLFeedback: boolean;
    canSignAgentCommitment: boolean;
    canViewReports: boolean;
    canExportReports: boolean;
    canUseAICoaching: boolean;
    canManageUsers: boolean;
    canManageDependencies: boolean;
    canManageRoles: boolean;
    canViewAuditLogs: boolean;
  };
}

export type SurveyNpsType = 'Detractor' | 'Pasivo' | 'Promotor';

export interface SurveyItem {
  id: string;
  ticketNumber: string;
  chatId?: string; // Código del chat
  customerIdentifier: string;
  channel: 'Voz' | 'Chat';
  inboxName?: string; // inbox_name (WA :: 59895702611 -> B2C, WA :: 59895700630 -> B2B)
  segment?: string; // B2C | B2B
  clasificacionEmpresas?: string; // Clasificación Empresas (Particular = B2C, resto = B2B)
  surveyDate: string; // YYYY-MM-DD
  surveyTime?: string; // HH:mm
  npsScore: number; // 0 to 10
  npsType: SurveyNpsType; // Detractor: 0-6, Pasivo: 7-8, Promotor: 9-10
  agentId?: string;
  agentName?: string;
  asesorPersonalizado?: string; // _AsesorPersonalizado
  customerComment?: string; // Verbatim del cliente
  phoneOrLine?: string; // Móvil / NroLlamante / Línea del cliente
  csat?: string; // Satisfacción (CSAT)
  fcr?: string; // Resolución (FCR)
  effort?: string; // Esfuerzo del cliente (Effort)
  callDurationSec?: number;
  batchId?: string;
  createdAt: string;
  hasGeneratedPending: boolean;
}

export type PendingAnalysisOrigin = 
  | 'ENCUESTA_DETRACTORA_VOZ' 
  | 'ENCUESTA_DETRACTORA_CHAT' 
  | 'MUESTREO_ALEATORIO' 
  | 'ESCALAMIENTO'
  | 'REFUTACION';

export type PendingAnalysisStatus = 'PENDIENTE' | 'EN_ANALISIS' | 'ANALIZADO';

export interface PendingAnalysisItem {
  id: string;
  ticketNumber: string;
  chatId?: string; // Código del chat
  customerIdentifier: string;
  channel: ChannelType;
  inboxName?: string;
  segment?: string; // B2C | B2B
  clasificacionEmpresas?: string; // Clasificación Empresas
  interactionDate: string;
  interactionTime?: string;
  durationSec?: number;
  origin: PendingAnalysisOrigin;
  npsScore?: number;
  npsType?: SurveyNpsType;
  customerComment?: string; // Verbatim del cliente insatisfecho
  csat?: string; // Satisfacción (CSAT)
  fcr?: string; // Resolución (FCR)
  effort?: string; // Esfuerzo del cliente (Effort)
  agentId?: string;
  agentName?: string;
  asesorPersonalizado?: string; // _AsesorPersonalizado
  assignedAnalystId?: string;
  assignedAnalystName?: string;
  status: PendingAnalysisStatus;
  priority: 'Alta' | 'Media' | 'Baja';
  audioRecordingId?: string;
  completedMonitoringId?: string;
  originalMonitoringId?: string;
  refutation?: RefutationEntry;
  createdAt: string;
}

export interface ContactReasonItem {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

