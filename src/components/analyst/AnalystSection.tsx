import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ChannelType, 
  AreaImputable, 
  PendingAnalysisItem, 
  SurveyItem 
} from '../../types';
import { 
  FileSpreadsheet, 
  PlusCircle, 
  FolderTree, 
  Phone, 
  MessageSquare, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  Plus, 
  ChevronRight, 
  ChevronDown,
  Layers,
  Sparkles,
  HelpCircle,
  FileCheck,
  Inbox,
  Filter,
  Search,
  Star,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Check,
  RotateCcw,
  Tag,
  Hash
} from 'lucide-react';
import { 
  exportCategoriesToExcel, 
  downloadCategoryTemplate, 
  parseCategoriesFromFile,
  exportSurveysToExcel 
} from '../../utils/excel';
import { ExcelImportModal } from '../common/ExcelImportModal';
import { SearchableSelect } from '../common/SearchableSelect';
import { SurveyUploadModal } from './SurveyUploadModal';
import { ContactReasonManagement } from './ContactReasonManagement';

export const AnalystSection: React.FC = () => {
  const { 
    currentUser, 
    users, 
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
    createMonitoring,
    resolveRefutedMonitoring,
    monitorings,
    setActiveSection,
    activeSubSection,
    setActiveSubSection,
    surveys,
    clearSurveys,
    pendingAnalyses,
    completePendingAnalysis,
    deletePendingAnalysis,
    contactReasons,
    hasPermission,
    canAccessSubSection,
  } = useApp();

  // Tab mapping
  type AnalystTab = 'bandeja_analista' | 'encuestas' | 'categorizaciones' | 'motivos_contacto';

  const canCreateMon = hasPermission('canCreateMonitoring');
  const canManageCats = hasPermission('canManageCategories');
  const canViewGeneralInbox = canAccessSubSection('general', 'bandeja');

  const allowedAnalystTabs: AnalystTab[] = [
    ...(canCreateMon ? (['bandeja_analista', 'encuestas'] as AnalystTab[]) : []),
    ...(canManageCats ? (['categorizaciones', 'motivos_contacto'] as AnalystTab[]) : []),
  ];

  const activeTab = (
    allowedAnalystTabs.includes(activeSubSection as AnalystTab)
      ? activeSubSection
      : allowedAnalystTabs[0] || 'bandeja_analista'
  ) as AnalystTab;

  const setActiveTab = (tab: AnalystTab) => {
    if (allowedAnalystTabs.includes(tab)) {
      setActiveSubSection(tab);
    }
  };

  // Modals state
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [surveyModalChannel, setSurveyModalChannel] = useState<'Voz' | 'Chat'>('Voz');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isClearSurveysModalOpen, setIsClearSurveysModalOpen] = useState(false);
  const [alsoClearSurveyPending, setAlsoClearSurveyPending] = useState(false);
  const [isClearingSurveys, setIsClearingSurveys] = useState(false);

  // Success notifications
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [surveySuccessBanner, setSurveySuccessBanner] = useState<{ total: number; detractors: number; channel: string } | null>(null);
  const [surveyClearedMessage, setSurveyClearedMessage] = useState<string | null>(null);

  // Active Pending Item being audited in Analysis Modal
  const [activePendingItem, setActivePendingItem] = useState<PendingAnalysisItem | null>(null);
  const [analysisFormError, setAnalysisFormError] = useState<string | null>(null);

  // FORM STATE: Carga de Monitoreo / Análisis de Atención
  const [uniqueId, setUniqueId] = useState<string>(() => `MON-${Math.floor(100000 + Math.random() * 900000)}`);
  const [agentId, setAgentId] = useState<string>('usr-agt-1');
  const [sourceAgentName, setSourceAgentName] = useState<string>('');
  const [fallbackTlId, setFallbackTlId] = useState<string>('');
  const [channel, setChannel] = useState<ChannelType>('Voz');
  const [ticketNumber, setTicketNumber] = useState<string>('TK-849500');
  const [customerIdentifier, setCustomerIdentifier] = useState<string>('+57 300 123 4567');
  const [callDate, setCallDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [surveyScore, setSurveyScore] = useState<number | ''>(4);
  const [contactReason, setContactReason] = useState<string>('');
  const [customerComment, setCustomerComment] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');
  const [inboxName, setInboxName] = useState<string>('');
  const [segment, setSegment] = useState<string>('');
  const [clasificacionEmpresas, setClasificacionEmpresas] = useState<string>('');
  const [csat, setCsat] = useState<string>('');
  const [fcr, setFcr] = useState<string>('');
  const [effort, setEffort] = useState<string>('');
  const [asesorPersonalizado, setAsesorPersonalizado] = useState<string>('');
  const [score] = useState<number>(80);

  // Categorization 1 Triplet
  const [cat1, setCat1] = useState<string>('');
  const [mot1, setMot1] = useState<string>('');
  const [cr1, setCr1] = useState<string>('');

  // Second Categorization Triplet
  const [hasSecondCategory, setHasSecondCategory] = useState<boolean>(false);
  const [cat2, setCat2] = useState<string>('');
  const [mot2, setMot2] = useState<string>('');
  const [cr2, setCr2] = useState<string>('');

  // Imputable & Feedback Trigger
  const [areaImputable, setAreaImputable] = useState<AreaImputable>('Asesor');
  const [requiresFeedback, setRequiresFeedback] = useState<boolean>(true);

  // Feedback Findings for QA
  const [criticalFinding, setCriticalFinding] = useState<string>('');
  const [strengths, setStrengths] = useState<string>('');
  const [opportunities, setOpportunities] = useState<string>('');
  const [priority, setPriority] = useState<'Alta' | 'Media' | 'Baja'>('Media');

  // Tree expansion state for Categorizaciones module
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedMotivos, setExpandedMotivos] = useState<Record<string, boolean>>({});

  // CRUD Modals for Categories
  const [modalType, setModalType] = useState<'cat' | 'mot' | 'cr' | null>(null);
  const [modalAction, setModalAction] = useState<'create' | 'edit'>('create');
  const [editingTarget, setEditingTarget] = useState<{
    catId?: string;
    motId?: string;
    crId?: string;
    name: string;
    code?: string;
    areaImputable?: AreaImputable | '';
    definicion?: string;
  } | null>(null);

  // Filters for Categorizaciones Tree
  const [catTreeSearch, setCatTreeSearch] = useState<string>('');
  const [catTreeAreaFilter, setCatTreeAreaFilter] = useState<string>('ALL');

  // FILTERS: Bandeja del Analista
  const [analystSearch, setAnalystSearch] = useState<string>('');
  const [analystChannelFilter, setAnalystChannelFilter] = useState<string>('ALL');
  const [analystOriginFilter, setAnalystOriginFilter] = useState<string>('ALL');
  const [analystStatusFilter, setAnalystStatusFilter] = useState<'PENDIENTE' | 'ANALIZADO' | 'ALL'>('PENDIENTE');

  // FILTERS: Encuestas del Día
  const [surveySearch, setSurveySearch] = useState<string>('');
  const [surveyChannelFilter, setSurveyChannelFilter] = useState<string>('ALL');
  const [surveyTypeFilter, setSurveyTypeFilter] = useState<string>('ALL');

  // Filter advisors and team leaders
  const advisors = useMemo(() => {
    return users.filter((u) => u.role === 'asesor' && u.status === 'active');
  }, [users]);

  const teamLeaders = useMemo(() => {
    return users.filter((u) => u.role === 'team_leader' && u.status === 'active');
  }, [users]);

  // Selected Advisor's Associated Team Leader
  const selectedAdvisor = useMemo(() => {
    return users.find((u) => u.id === agentId) || null;
  }, [users, agentId]);

  const assignedTeamLeader = useMemo(() => {
    if (selectedAdvisor?.reportsToId) {
      return users.find((u) => u.id === selectedAdvisor.reportsToId) || null;
    }
    if (fallbackTlId) {
      return users.find((u) => u.id === fallbackTlId) || null;
    }
    return null;
  }, [selectedAdvisor, fallbackTlId, users]);

  // Cascading lists for Categorization 1
  const motivos1List = useMemo(() => {
    const foundCat = categories.find((c) => c.name === cat1);
    return foundCat ? foundCat.motivos : [];
  }, [categories, cat1]);

  const causas1List = useMemo(() => {
    const foundMot = motivos1List.find((m) => m.name === mot1);
    return foundMot ? foundMot.causasRaiz : [];
  }, [motivos1List, mot1]);

  // Cascading lists for Categorization 2
  const motivos2List = useMemo(() => {
    const foundCat = categories.find((c) => c.name === cat2);
    return foundCat ? foundCat.motivos : [];
  }, [categories, cat2]);

  const causas2List = useMemo(() => {
    const foundMot = motivos2List.find((m) => m.name === mot2);
    return foundMot ? foundMot.causasRaiz : [];
  }, [motivos2List, mot2]);

  const selectedCausa1Obj = useMemo(() => {
    return causas1List.find((cr) => cr.name === cr1) || null;
  }, [causas1List, cr1]);

  const selectedCausa2Obj = useMemo(() => {
    return causas2List.find((cr) => cr.name === cr2) || null;
  }, [causas2List, cr2]);

  const derivedAreaImputable: AreaImputable | null = useMemo(() => {
    if (selectedCausa1Obj?.areaImputable) return selectedCausa1Obj.areaImputable;
    if (cr1) return areaImputable;
    return null;
  }, [selectedCausa1Obj, cr1, areaImputable]);

  // Toggle node expansion
  const toggleCat = (id: string) => {
    setExpandedCats((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMotivo = (id: string) => {
    setExpandedMotivos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered Pending Analyses for Analyst Tray
  const filteredPendingAnalyses = useMemo(() => {
    return pendingAnalyses.filter((item) => {
      if (analystStatusFilter !== 'ALL' && item.status !== analystStatusFilter) return false;
      if (analystChannelFilter !== 'ALL' && item.channel !== analystChannelFilter) return false;
      if (analystOriginFilter !== 'ALL' && item.origin !== analystOriginFilter) return false;

      if (analystSearch.trim()) {
        const query = analystSearch.toLowerCase();
        const matchTicket = item.ticketNumber.toLowerCase().includes(query);
        const matchChat = item.chatId?.toLowerCase().includes(query);
        const matchSegment = item.segment?.toLowerCase().includes(query);
        const matchEmpresas = item.clasificacionEmpresas?.toLowerCase().includes(query);
        const matchInbox = item.inboxName?.toLowerCase().includes(query);
        const matchClient = item.customerIdentifier.toLowerCase().includes(query);
        const matchAgent = item.agentName?.toLowerCase().includes(query);
        const matchPers = item.asesorPersonalizado?.toLowerCase().includes(query);
        const matchComment = item.customerComment?.toLowerCase().includes(query);
        const matchOriginalId = item.originalMonitoringId?.toLowerCase().includes(query);
        const matchRefReason = item.refutation?.reason.toLowerCase().includes(query);
        const matchRefAuthor = item.refutation?.refutedByName.toLowerCase().includes(query);
        if (
          !matchTicket &&
          !matchChat &&
          !matchSegment &&
          !matchEmpresas &&
          !matchInbox &&
          !matchClient &&
          !matchAgent &&
          !matchPers &&
          !matchComment &&
          !matchOriginalId &&
          !matchRefReason &&
          !matchRefAuthor
        ) {
          return false;
        }
      }
      return true;
    });
  }, [pendingAnalyses, analystStatusFilter, analystChannelFilter, analystOriginFilter, analystSearch]);

  // Filtered Surveys of the Day
  const filteredSurveys = useMemo(() => {
    return surveys.filter((s) => {
      if (surveyChannelFilter !== 'ALL' && s.channel !== surveyChannelFilter) return false;
      if (surveyTypeFilter !== 'ALL' && s.npsType !== surveyTypeFilter) return false;

      if (surveySearch.trim()) {
        const query = surveySearch.toLowerCase();
        const matchTicket = s.ticketNumber.toLowerCase().includes(query);
        const matchChat = s.chatId?.toLowerCase().includes(query);
        const matchSegment = s.segment?.toLowerCase().includes(query);
        const matchEmpresas = s.clasificacionEmpresas?.toLowerCase().includes(query);
        const matchInbox = s.inboxName?.toLowerCase().includes(query);
        const matchClient = s.customerIdentifier.toLowerCase().includes(query);
        const matchAgent = s.agentName?.toLowerCase().includes(query);
        const matchPers = s.asesorPersonalizado?.toLowerCase().includes(query);
        const matchComment = s.customerComment?.toLowerCase().includes(query);
        if (!matchTicket && !matchChat && !matchSegment && !matchEmpresas && !matchInbox && !matchClient && !matchAgent && !matchPers && !matchComment) return false;
      }
      return true;
    });
  }, [surveys, surveyChannelFilter, surveyTypeFilter, surveySearch]);

  // Survey KPIs
  const surveyKpis = useMemo(() => {
    const total = surveys.length;
    const detractors = surveys.filter((s) => s.npsType === 'Detractor').length;
    const passives = surveys.filter((s) => s.npsType === 'Pasivo').length;
    const promoters = surveys.filter((s) => s.npsType === 'Promotor').length;
    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

    return { total, detractors, passives, promoters, npsScore };
  }, [surveys]);

  // Action: Launch audit on a pending item from the Analyst Tray
  const handleStartAuditPendingItem = (item: PendingAnalysisItem) => {
    setActivePendingItem(item);
    setFormSuccessMessage(null);
    setAnalysisFormError(null);

    const originalMon =
      item.origin === 'REFUTACION' && item.originalMonitoringId
        ? monitorings.find((m) => m.id === item.originalMonitoringId)
        : undefined;

    const refCode = (item.chatId || item.ticketNumber || '').replace(/[^a-zA-Z0-9]/g, '');
    setUniqueId(
      originalMon
        ? originalMon.id.replace(/^mon-/i, 'MON-')
        : item.originalMonitoringId
        ? item.originalMonitoringId.replace(/^mon-/i, 'MON-')
        : `MON-${refCode || Math.floor(100000 + Math.random() * 900000)}`
    );
    setTicketNumber(item.ticketNumber);
    setCustomerIdentifier(item.customerIdentifier);
    setChannel(item.channel);

    // Ensure YYYY-MM-DD format for <input type="date">
    const rawDate = (item.interactionDate || '').trim();
    const dmyMatch = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    const ymdMatch = rawDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    const formattedDate = dmyMatch
      ? `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`
      : ymdMatch
      ? `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`
      : new Date().toISOString().substring(0, 10);
    setCallDate(formattedDate);

    setChatId(item.chatId || '');
    setInboxName(item.inboxName || '');
    setSegment(item.segment || '');
    setClasificacionEmpresas(item.clasificacionEmpresas || '');
    setCsat(item.csat || '');
    setFcr(item.fcr || '');
    setEffort(item.effort || '');
    setAsesorPersonalizado(item.asesorPersonalizado || '');
    setCustomerComment(item.customerComment || '');

    // Pre-select surveyScore accurately without inventing a default when undefined
    setSurveyScore(item.npsScore !== undefined ? item.npsScore : '');

    if (originalMon) {
      setContactReason(originalMon.contactReason || '');
      setCat1(originalMon.category1?.categoria || '');
      setMot1(originalMon.category1?.motivo || '');
      setCr1(originalMon.category1?.causaRaiz || '');
      const hasSecond = Boolean(originalMon.hasSecondCategory && originalMon.category2);
      setHasSecondCategory(hasSecond);
      setCat2(hasSecond ? originalMon.category2?.categoria || '' : '');
      setMot2(hasSecond ? originalMon.category2?.motivo || '' : '');
      setCr2(hasSecond ? originalMon.category2?.causaRaiz || '' : '');
      setAreaImputable(originalMon.areaImputable || 'Asesor');
      setRequiresFeedback(originalMon.requiresFeedback);
      setPriority(originalMon.qaFindings?.priority || item.priority || 'Media');
      setCriticalFinding(originalMon.qaFindings?.criticalFinding || '');
      setStrengths(originalMon.qaFindings?.strengths || '');
      setOpportunities(originalMon.qaFindings?.opportunities || '');
    } else {
      setPriority(item.priority || 'Media');
      setRequiresFeedback(true);
      // Reset editable typification fields so nothing leaks from previous monitoring
      setContactReason('');
      setCat1('');
      setMot1('');
      setCr1('');
      setHasSecondCategory(false);
      setCat2('');
      setMot2('');
      setCr2('');
      setAreaImputable('Asesor');
      setStrengths('');
      setOpportunities('');
      setCriticalFinding('');
    }

    // Match advisor from item.agentId or item.agentName without falling back to wrong default advisor
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

    let matchedAdvisor = item.agentId ? users.find((u) => u.id === item.agentId) : undefined;
    if (!matchedAdvisor && item.agentName) {
      const target = normalize(item.agentName);
      matchedAdvisor =
        advisors.find((a) => normalize(a.name) === target || (a.voiceName && normalize(a.voiceName) === target)) ||
        advisors.find((a) => {
          const aNorm = normalize(a.name);
          const vNorm = a.voiceName ? normalize(a.voiceName) : '';
          return (
            aNorm.includes(target) ||
            target.includes(aNorm) ||
            (Boolean(vNorm) && (vNorm.includes(target) || target.includes(vNorm)))
          );
        }) ||
        users.find(
          (u) =>
            u.role === 'asesor' &&
            (normalize(u.name) === target || (u.voiceName && normalize(u.voiceName) === target))
        );
    }

    if (matchedAdvisor) {
      setAgentId(matchedAdvisor.id);
      setSourceAgentName(matchedAdvisor.name);
      setFallbackTlId(matchedAdvisor.reportsToId || originalMon?.teamLeaderId || '');
    } else {
      setAgentId('');
      setSourceAgentName(item.agentName || 'Sin asesor identificado');
      setFallbackTlId(originalMon?.teamLeaderId || teamLeaders[0]?.id || '');
    }

    // Open the Analysis Form Modal on screen
    setIsAnalysisModalOpen(true);
  };

  // Close & reset Analysis Modal
  const handleCloseAnalysisModal = () => {
    setIsAnalysisModalOpen(false);
    setActivePendingItem(null);
    setAnalysisFormError(null);
    setSourceAgentName('');
    setFallbackTlId('');
    setCustomerComment('');
    setChatId('');
    setInboxName('');
    setSegment('');
    setClasificacionEmpresas('');
    setCsat('');
    setFcr('');
    setEffort('');
    setAsesorPersonalizado('');
  };

  // Handle Form Submission for new Monitoring
  const handleCreateMonitoring = (e: React.FormEvent) => {
    e.preventDefault();
    setAnalysisFormError(null);

    const effectiveAgentName = selectedAdvisor?.name || sourceAgentName;
    if (!effectiveAgentName || !assignedTeamLeader) {
      setAnalysisFormError('Debes contar con un asesor y un Team Leader asignado para registrar el monitoreo.');
      return;
    }

    if (!customerIdentifier.trim()) {
      setAnalysisFormError('Por favor ingresa el Chat ID o la línea del cliente.');
      return;
    }

    if (!contactReason) {
      setAnalysisFormError('Por favor selecciona el Motivo de Contacto.');
      return;
    }

    if (!cat1 || !mot1 || !cr1) {
      setAnalysisFormError('Debes completar los 3 niveles de la categorización principal (Categoría, Motivo y Causa raíz).');
      return;
    }

    if (hasSecondCategory && (!cat2 || !mot2 || !cr2)) {
      setAnalysisFormError('Marcaste segunda categorización pero no completaste los 3 niveles requeridos.');
      return;
    }

    if (requiresFeedback && !criticalFinding.trim()) {
      setAnalysisFormError('Al indicar que amerita feedback, debes redactar el hallazgo crítico para el Team Leader y Asesor.');
      return;
    }

    const finalId = (uniqueId.trim() || `MON-${Math.floor(100000 + Math.random() * 900000)}`).replace(/^mon-/i, 'MON-');

    const payload = {
      ticketNumber: activePendingItem ? ticketNumber : finalId,
      customerIdentifier: customerIdentifier.trim(),
      channel,
      callDate,
      callTime: '10:00',
      callDurationSec: activePendingItem?.durationSec || 240,
      surveyScore: surveyScore !== '' ? Number(surveyScore) : undefined,
      contactReason: contactReason,
      chatId: chatId || undefined,
      inboxName: inboxName || undefined,
      segment: segment || undefined,
      clasificacionEmpresas: clasificacionEmpresas || undefined,
      csat: csat || undefined,
      fcr: fcr || undefined,
      effort: effort || undefined,
      asesorPersonalizado: asesorPersonalizado || undefined,
      agentId: selectedAdvisor?.id || activePendingItem?.agentId || `ext-${finalId}`,
      agentName: effectiveAgentName,
      teamLeaderId: assignedTeamLeader.id,
      teamLeaderName: assignedTeamLeader.name,
      analystId: currentUser.id,
      analystName: currentUser.name,
      category1: {
        categoria: cat1,
        motivo: mot1,
        causaRaiz: cr1,
      },
      hasSecondCategory,
      category2: hasSecondCategory
        ? {
            categoria: cat2,
            motivo: mot2,
            causaRaiz: cr2,
          }
        : undefined,
      areaImputable: derivedAreaImputable || 'Asesor',
      requiresFeedback,
      qaFindings: requiresFeedback
        ? {
            criticalFinding: criticalFinding.trim(),
            strengths: strengths.trim(),
            opportunities: opportunities.trim(),
            priority,
            createdAt: `${callDate}`,
          }
        : undefined,
    };

    const isRefutationReview =
      activePendingItem?.origin === 'REFUTACION' && Boolean(activePendingItem.originalMonitoringId);

    const savedMonitoring = isRefutationReview && activePendingItem?.originalMonitoringId
      ? resolveRefutedMonitoring(activePendingItem.originalMonitoringId, payload) ||
        createMonitoring({ ...payload, id: finalId })
      : createMonitoring({ ...payload, id: finalId });

    // If auditing a pending item, complete it in the queue
    if (activePendingItem) {
      completePendingAnalysis(activePendingItem.id, savedMonitoring.id);
      setActivePendingItem(null);
    }

    setFormSuccessMessage(
      isRefutationReview
        ? `Monitoreo ${savedMonitoring.id} revisado nuevamente tras refutación (${savedMonitoring.agentName}). ${
            requiresFeedback
              ? `Devuelto a la bandeja del Team Leader ${assignedTeamLeader.name} para nuevo ciclo de feedback.`
              : 'Cerrado como atención conforme sin requerimiento de feedback.'
          }`
        : `Monitoreo ${savedMonitoring.id} registrado con éxito para ${savedMonitoring.agentName}. ${
            requiresFeedback
              ? `Asignado a la bandeja del Team Leader ${assignedTeamLeader.name} para gestión de feedback.`
              : 'Registrado como atención conforme sin requerimiento de feedback.'
          }`
    );

    // Close modal & reset form
    setIsAnalysisModalOpen(false);
    setUniqueId(`MON-${Math.floor(100000 + Math.random() * 900000)}`);
    setSourceAgentName('');
    setFallbackTlId('');
    setContactReason('');
    setCustomerComment('');
    setChatId('');
    setInboxName('');
    setSegment('');
    setClasificacionEmpresas('');
    setCsat('');
    setFcr('');
    setEffort('');
    setAsesorPersonalizado('');
    setCriticalFinding('');
    setStrengths('');
    setOpportunities('');
  };

  // Open Survey Modal
  const handleOpenSurveyModal = (modalChannel: 'Voz' | 'Chat') => {
    setSurveyModalChannel(modalChannel);
    setSurveyModalOpen(true);
  };

  // Survey Import Success callback
  const handleSurveySuccess = (result: { totalImported: number; detractorsFound: number }) => {
    setSurveySuccessBanner({
      total: result.totalImported,
      detractors: result.detractorsFound,
      channel: surveyModalChannel,
    });
  };

  // Category CRUD Save Handler
  const handleSaveCategoryModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget?.name.trim()) return;

    if (modalType === 'cat') {
      if (modalAction === 'create') {
        addCategory(editingTarget.name.trim(), editingTarget.code?.trim());
      } else if (editingTarget.catId) {
        editCategory(editingTarget.catId, editingTarget.name.trim(), editingTarget.code?.trim());
      }
    } else if (modalType === 'mot' && editingTarget.catId) {
      if (modalAction === 'create') {
        addMotivo(editingTarget.catId, editingTarget.name.trim());
      } else if (editingTarget.motId) {
        editMotivo(editingTarget.catId, editingTarget.motId, editingTarget.name.trim());
      }
    } else if (modalType === 'cr' && editingTarget.catId && editingTarget.motId) {
      const areaVal = editingTarget.areaImputable || undefined;
      const defVal = editingTarget.definicion?.trim() || undefined;
      if (modalAction === 'create') {
        addCausaRaiz(editingTarget.catId, editingTarget.motId, editingTarget.name.trim(), areaVal, defVal);
      } else if (editingTarget.crId) {
        editCausaRaiz(
          editingTarget.catId,
          editingTarget.motId,
          editingTarget.crId,
          editingTarget.name.trim(),
          areaVal,
          defVal
        );
      }
    }

    setModalType(null);
    setEditingTarget(null);
  };

  const pendingAnalysesCount = pendingAnalyses.filter((p) => p.status === 'PENDIENTE').length;

  return (
    <div className="space-y-6">
      
      {/* Sub-Header Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Sección Analista (Experiencia del Cliente)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Bandeja de pendientes por auditar, ingesta de encuestas de satisfacción NPS (Voz y Chat), carga técnica y árbol de categorizaciones a 3 niveles.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg shrink-0 flex-wrap gap-1">
          {/* TAB 1: BANDEJA ANALISTA */}
          {canCreateMon && (
            <button
              onClick={() => setActiveTab('bandeja_analista')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'bandeja_analista'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Bandeja de Pendientes</span>
              {pendingAnalysesCount > 0 && (
                <span className="font-mono text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                  {pendingAnalysesCount}
                </span>
              )}
            </button>
          )}

          {/* TAB 2: CARGA ENCUESTAS NPS */}
          {canCreateMon && (
            <button
              onClick={() => setActiveTab('encuestas')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'encuestas'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Carga de Encuestas (NPS)</span>
              <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                {surveys.length}
              </span>
            </button>
          )}

          {/* TAB 3: CATEGORIZACIONES */}
          {canManageCats && (
            <button
              onClick={() => setActiveTab('categorizaciones')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'categorizaciones'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Categorizaciones</span>
              <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                {categories.length}
              </span>
            </button>
          )}

          {/* TAB 5: GESTIÓN DE MOTIVO DE CONTACTO */}
          {canManageCats && (
            <button
              onClick={() => setActiveTab('motivos_contacto')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'motivos_contacto'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>Gestión de Motivo de contacto</span>
              <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                {contactReasons.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* SURVEY IMPORT SUCCESS BANNER */}
      {surveySuccessBanner && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start justify-between gap-3 text-xs text-indigo-950 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                ¡Encuestas de {surveySuccessBanner.channel} Cargadas con Éxito!
              </span>
              <p className="mt-0.5">
                Se importaron <strong>{surveySuccessBanner.total} encuestas</strong>. El motor detectó automáticamente{' '}
                <strong className="text-rose-700 font-bold">
                  {surveySuccessBanner.detractors} encuestas detractoras (NPS ≤ 6)
                </strong>{' '}
                y generó los respectivos formularios en tu <strong>Bandeja de Pendientes</strong> para auditar la llamada/chat.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setActiveTab('bandeja_analista');
                setSurveySuccessBanner(null);
              }}
              className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-medium rounded-md shadow-2xs"
            >
              Ir a Bandeja de Pendientes
            </button>
            <button
              onClick={() => setSurveySuccessBanner(null)}
              className="text-indigo-600 hover:text-indigo-900 p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* FORM SUCCESS BANNER */}
      {formSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3 text-xs text-emerald-900 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">¡Monitoreo de Experiencia Registrado!</span>
              <p className="mt-0.5">{formSuccessMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canViewGeneralInbox && (
              <button
                onClick={() => setActiveSection('general')}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-md shadow-2xs"
              >
                Ver en Bandeja General
              </button>
            )}
            <button
              onClick={() => setFormSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BANDEJA DEL ANALISTA DE EXPERIENCIA (PENDIENTES DE ANALIZAR)        */}
      {/* ========================================================================= */}
      {activeTab === 'bandeja_analista' && (
        <div className="space-y-6">
          
          {/* Header KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-500 font-medium block">Total Pendientes</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                {pendingAnalysesCount}
              </span>
              <span className="text-[10px] text-amber-600 font-medium">Requieren auditoría</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-2xs">
              <div className="flex items-center justify-between text-blue-700 font-medium">
                <span>Detractoras Voz</span>
                <Phone className="w-3.5 h-3.5" />
              </div>
              <span className="text-xl font-bold font-mono text-blue-900 mt-1 block">
                {pendingAnalyses.filter((p) => p.origin === 'ENCUESTA_DETRACTORA_VOZ' && p.status === 'PENDIENTE').length}
              </span>
              <span className="text-[10px] text-slate-400">Audio / Llamadas</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-teal-200 shadow-2xs">
              <div className="flex items-center justify-between text-teal-700 font-medium">
                <span>Detractoras Chat</span>
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <span className="text-xl font-bold font-mono text-teal-900 mt-1 block">
                {pendingAnalyses.filter((p) => p.origin === 'ENCUESTA_DETRACTORA_CHAT' && p.status === 'PENDIENTE').length}
              </span>
              <span className="text-[10px] text-slate-400">Canales digitales</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-rose-200 shadow-2xs">
              <span className="text-rose-700 font-medium block">Prioridad Alta</span>
              <span className="text-xl font-bold font-mono text-rose-900 mt-1 block">
                {pendingAnalyses.filter((p) => p.priority === 'Alta' && p.status === 'PENDIENTE').length}
              </span>
              <span className="text-[10px] text-rose-600 font-medium">NPS ≤ 3 crítico</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-emerald-700 font-medium block">Auditados / Listos</span>
              <span className="text-xl font-bold font-mono text-emerald-900 mt-1 block">
                {pendingAnalyses.filter((p) => p.status === 'ANALIZADO').length}
              </span>
              <span className="text-[10px] text-emerald-600">Ciclos derivados</span>
            </div>
          </div>

          {/* Tray Filters & Search */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por Ticket, cliente, asesor o comentario..."
                value={analystSearch}
                onChange={(e) => setAnalystSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Channel filter */}
              <SearchableSelect
                wrapperClassName="w-auto min-w-[135px]"
                dropdownMinWidth={170}
                value={analystChannelFilter}
                onChange={setAnalystChannelFilter}
                searchPlaceholder="Buscar canal..."
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                options={[
                  { value: 'ALL', label: 'Canal: Todos' },
                  { value: 'Voz', label: 'Canal: Voz' },
                  { value: 'Chat', label: 'Canal: Chat' },
                ]}
              />

              {/* Origin filter */}
              <SearchableSelect
                wrapperClassName="w-auto min-w-[185px]"
                dropdownMinWidth={230}
                value={analystOriginFilter}
                onChange={setAnalystOriginFilter}
                searchPlaceholder="Buscar origen..."
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                options={[
                  { value: 'ALL', label: 'Origen: Todos' },
                  { value: 'REFUTACION', label: 'Refutado (TL / Asesor)' },
                  { value: 'ENCUESTA_DETRACTORA_VOZ', label: 'Detractor NPS Voz' },
                  { value: 'ENCUESTA_DETRACTORA_CHAT', label: 'Detractor NPS Chat' },
                  { value: 'MUESTREO_ALEATORIO', label: 'Muestreo Aleatorio' },
                ]}
              />

              {/* Status filter */}
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAnalystStatusFilter('PENDIENTE')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    analystStatusFilter === 'PENDIENTE'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Pendientes ({pendingAnalysesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAnalystStatusFilter('ANALIZADO')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    analystStatusFilter === 'ANALIZADO'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Analizados
                </button>
                <button
                  type="button"
                  onClick={() => setAnalystStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    analystStatusFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Todos
                </button>
              </div>
            </div>
          </div>

          {/* Pending Items List */}
          <div className="space-y-3">
            {filteredPendingAnalyses.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <span className="font-semibold block text-slate-700">No hay atenciones en este filtro</span>
                <p className="mt-1">
                  Puedes cargar encuestas del día en la pestaña <strong>"Carga de Encuestas (NPS)"</strong> para alimentar la bandeja de detractoras.
                </p>
              </div>
            ) : (
              filteredPendingAnalyses.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border p-4.5 shadow-2xs transition-all space-y-3 ${
                    item.status === 'ANALIZADO'
                      ? 'border-slate-200 opacity-75'
                      : item.origin === 'REFUTACION'
                      ? 'border-rose-300 hover:border-rose-400 ring-1 ring-rose-200 bg-rose-50/15'
                      : item.priority === 'Alta'
                      ? 'border-rose-200 hover:border-rose-300 ring-1 ring-rose-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top Bar of card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {item.originalMonitoringId
                          ? item.originalMonitoringId.replace(/^mon-/i, 'MON-')
                          : item.chatId || item.ticketNumber}
                      </span>

                      {/* Channel Badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        item.channel === 'Voz'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}>
                        {item.channel === 'Voz' ? <Phone className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                        <span>{item.channel}{item.segment ? ` · ${item.segment}` : ''}</span>
                      </span>

                      {/* Segment / Clasificación Empresas Badge when Chat */}
                      {item.segment && (
                        <span
                          title={item.clasificacionEmpresas || item.inboxName}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            item.segment === 'B2B'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                          }`}
                        >
                          {item.segment}
                          {item.clasificacionEmpresas
                            ? ` (${item.clasificacionEmpresas})`
                            : item.inboxName
                            ? ` (${item.inboxName})`
                            : ''}
                        </span>
                      )}

                      {/* Origin Badge */}
                      {item.origin === 'REFUTACION' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <RotateCcw className="w-3 h-3 text-rose-700" />
                          <span>
                            Refutado por {item.refutation?.refutedByRole === 'team_leader' ? 'Team Leader' : 'Asesor'}
                          </span>
                        </span>
                      ) : item.origin.includes('DETRACTORA') ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          <Star className="w-3 h-3 fill-rose-600 text-rose-600" />
                          <span>Encuesta Detractora (NPS: {item.npsScore}/10)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700">
                          <span>Muestreo Aleatorio</span>
                        </span>
                      )}

                      {/* Priority */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        item.priority === 'Alta'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        Prioridad {item.priority}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{item.interactionDate} {item.interactionTime || ''}</span>
                    </div>
                  </div>

                  {/* Middle Content */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">
                        {item.channel === 'Chat' ? 'NroLlamante / Línea' : 'Cliente / Línea'}
                      </span>
                      <span className="font-semibold text-slate-800 font-mono">{item.customerIdentifier}</span>
                      {item.chatId && (
                        <span className="text-slate-500 font-mono block text-[10px] mt-0.5">
                          Chat ID: {item.chatId}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Asesor Asociado</span>
                      <span className="font-semibold text-slate-800">
                        {item.agentName || '⚠️ Sin asesor asociado'}
                      </span>
                      {item.asesorPersonalizado && (
                        <span className="text-slate-500 block text-[10px] mt-0.5">
                          Asesor Personalizado: <strong>{item.asesorPersonalizado}</strong>
                        </span>
                      )}
                      {item.inboxName && (
                        <span className="text-slate-500 font-mono block text-[10px] mt-0.5">
                          {item.inboxName}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">CSAT, FCR & Effort</span>
                      {item.csat || item.fcr || item.effort ? (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {item.csat && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              CSAT: {item.csat}
                            </span>
                          )}
                          {item.fcr && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              item.fcr.toLowerCase().startsWith('s')
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              FCR: {item.fcr}
                            </span>
                          )}
                          {item.effort && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              Effort: {item.effort}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No aplica / Voz</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Estado de Gestión</span>
                      {item.status === 'PENDIENTE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>Pendiente de Análisis</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mt-0.5">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Auditado con Monitoreo</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Refutation Alert Box when origin === 'REFUTACION' */}
                  {item.origin === 'REFUTACION' && item.refutation && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-rose-900">
                        <span className="flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                          <span>
                            Devuelto para re-evaluación por{' '}
                            {item.refutation.refutedByRole === 'team_leader' ? 'Team Leader' : 'Asesor'}:{' '}
                            {item.refutation.refutedByName}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-rose-700 font-medium">
                          {item.refutation.refutedAt}
                        </span>
                      </div>
                      <p className="text-rose-950 pl-5 text-[11px] leading-relaxed">
                        <strong>Motivo de refutación:</strong> &ldquo;{item.refutation.reason}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Customer Verbatim box (Critical for detractor surveys) */}
                  {item.customerComment && item.origin !== 'REFUTACION' && (
                    <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-lg text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-950 text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Comentario / Verbatim del Cliente Insatisfecho:</span>
                      </div>
                      <p className="text-slate-700 italic pl-5 text-[11px] leading-relaxed">
                        "{item.customerComment}"
                      </p>
                    </div>
                  )}

                  {/* Bottom Action Bar */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[11px] text-slate-400">
                      ID Bandeja: <span className="font-mono">{item.id}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'PENDIENTE' ? (
                        <button
                          type="button"
                          onClick={() => handleStartAuditPendingItem(item)}
                          className={`flex items-center gap-1.5 px-4 py-1.5 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs ${
                            item.origin === 'REFUTACION'
                              ? 'bg-rose-700 hover:bg-rose-800'
                              : 'bg-slate-900 hover:bg-slate-800'
                          }`}
                        >
                          <span>
                            {item.origin === 'REFUTACION'
                              ? 'Re-evaluar Monitoreo Refutado'
                              : 'Analizar / Auditar Monitoreo'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-emerald-700 font-semibold text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Caso cerrado y monitoreado</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`¿Remover caso ${item.ticketNumber} de la bandeja?`)) {
                            deletePendingAnalysis(item.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar de la bandeja"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CARGA DE ENCUESTAS DEL DÍA (NPS DE VOZ Y CHAT CON DETRACTORES)    */}
      {/* ========================================================================= */}
      {activeTab === 'encuestas' && (
        <div className="space-y-6">
          
          {/* Hero Instructions & Action Buttons */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Carga y Procesamiento de Encuestas de Satisfacción (NPS)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Importa las bases diarias de encuestas. El sistema clasificará automáticamente los resultados y{' '}
                  <strong className="text-rose-700">canalizará todas las encuestas detractoras (NPS ≤ 6)</strong>{' '}
                  directamente a tu <strong>Bandeja de Analista</strong> como llamadas/chats pendientes de auditar.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {surveys.length > 0 && (
                  <button
                    type="button"
                    onClick={() => exportSurveysToExcel(surveys)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar Encuestas a Excel</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAlsoClearSurveyPending(false);
                    setIsClearSurveysModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-colors shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Base de Encuestas</span>
                </button>
              </div>
            </div>

            {surveyClearedMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{surveyClearedMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSurveyClearedMessage(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* The 2 Major Action Buttons for Voice and Chat */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              
              {/* BUTTON 1: CARGAR BASE NPS DE VOZ */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md relative overflow-hidden group">
                <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Phone className="w-24 h-24" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-blue-200">
                      <Phone className="w-5 h-5" />
                    </span>
                    <div>
                      <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
                        Canal Telefónico
                      </span>
                      <h3 className="text-base font-bold text-white">
                        Cargar Base de Encuestas NPS de VOZ
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300">
                    Carga archivos Excel/CSV de encuestas post-llamada telefónica. Las atenciones con puntaje 0 a 6 se crearán de inmediato en tu bandeja con su grabación.
                  </p>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenSurveyModal('Voz')}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-blue-950 font-bold text-xs rounded-xl hover:bg-blue-50 transition-colors shadow-xs"
                    >
                      <Upload className="w-4 h-4 text-blue-800" />
                      <span>Cargar Base NPS de VOZ</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BUTTON 2: CARGAR BASE NPS DE CHAT */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-950 via-slate-900 to-slate-900 text-white shadow-md relative overflow-hidden group">
                <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <MessageSquare className="w-24 h-24" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-teal-200">
                      <MessageSquare className="w-5 h-5" />
                    </span>
                    <div>
                      <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider block">
                        Canal Digital & Escrito
                      </span>
                      <h3 className="text-base font-bold text-white">
                        Cargar Base de Encuestas NPS de CHAT
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300">
                    Carga encuestas de chats web y WhatsApp. Los clientes insatisfechos se canalizarán a la bandeja con el transcript completo para auditoría.
                  </p>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenSurveyModal('Chat')}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-teal-950 font-bold text-xs rounded-xl hover:bg-teal-50 transition-colors shadow-xs"
                    >
                      <Upload className="w-4 h-4 text-teal-800" />
                      <span>Cargar Base NPS de CHAT</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Daily NPS KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-500 font-medium block">Total Encuestas del Día</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                {surveyKpis.total}
              </span>
              <span className="text-[10px] text-slate-400">Voz + Chat procesadas</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-rose-200 shadow-2xs">
              <div className="flex items-center justify-between text-rose-700 font-medium">
                <span>🔴 Detractoras (0-6)</span>
                <span className="w-2 h-2 rounded-full bg-rose-600"></span>
              </div>
              <span className="text-xl font-bold font-mono text-rose-900 mt-1 block">
                {surveyKpis.detractors}
              </span>
              <span className="text-[10px] text-rose-600 font-semibold">
                Canalizadas a bandeja
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-2xs">
              <span className="text-amber-700 font-medium block">🟡 Pasivas (7-8)</span>
              <span className="text-xl font-bold font-mono text-amber-900 mt-1 block">
                {surveyKpis.passives}
              </span>
              <span className="text-[10px] text-slate-400">Atención neutral</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-2xs">
              <span className="text-emerald-700 font-medium block">🟢 Promotoras (9-10)</span>
              <span className="text-xl font-bold font-mono text-emerald-900 mt-1 block">
                {surveyKpis.promoters}
              </span>
              <span className="text-[10px] text-slate-400">Clientes satisfechos</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-indigo-200 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-indigo-700 font-medium block">NPS Global Calculado</span>
              <span className={`text-xl font-bold font-mono mt-1 block ${
                surveyKpis.npsScore >= 50
                  ? 'text-emerald-600'
                  : surveyKpis.npsScore >= 0
                  ? 'text-indigo-900'
                  : 'text-rose-600'
              }`}>
                {surveyKpis.npsScore > 0 ? `+${surveyKpis.npsScore}%` : `${surveyKpis.npsScore}%`}
              </span>
              <span className="text-[10px] text-slate-400">% Promotores - % Detractores</span>
            </div>
          </div>

          {/* Table of Processed Surveys */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar en encuestas del día..."
                  value={surveySearch}
                  onChange={(e) => setSurveySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <SearchableSelect
                  wrapperClassName="w-auto min-w-[130px]"
                  dropdownMinWidth={170}
                  value={surveyChannelFilter}
                  onChange={setSurveyChannelFilter}
                  searchPlaceholder="Buscar canal..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  options={[
                    { value: 'ALL', label: 'Canal: Todos' },
                    { value: 'Voz', label: 'Canal: Voz' },
                    { value: 'Chat', label: 'Canal: Chat' },
                  ]}
                />

                <SearchableSelect
                  wrapperClassName="w-auto min-w-[165px]"
                  dropdownMinWidth={210}
                  value={surveyTypeFilter}
                  onChange={setSurveyTypeFilter}
                  searchPlaceholder="Buscar nota NPS..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  options={[
                    { value: 'ALL', label: 'NPS: Todos' },
                    { value: 'Detractor', label: 'Detractoras (0 a 6)' },
                    { value: 'Pasivo', label: 'Pasivas (7 a 8)' },
                    { value: 'Promotor', label: 'Promotoras (9 a 10)' },
                  ]}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">ID / Ticket</th>
                    <th className="py-2.5 px-3">Canal / Segmento</th>
                    <th className="py-2.5 px-3">NroLlamante / Cliente</th>
                    <th className="py-2.5 px-3">Fecha Encuesta</th>
                    <th className="py-2.5 px-3 text-center">NPS</th>
                    <th className="py-2.5 px-3">CSAT / FCR / Effort</th>
                    <th className="py-2.5 px-3">Nombre Asesor</th>
                    <th className="py-2.5 px-3">Comentario / Verbatim</th>
                    <th className="py-2.5 px-3">Destino en Sistema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSurveys.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No hay encuestas para mostrar. Carga una base de Voz o Chat arriba.
                      </td>
                    </tr>
                  ) : (
                    filteredSurveys.map((srv) => (
                      <tr key={srv.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {srv.chatId || srv.ticketNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col items-start gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                srv.channel === 'Voz' ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-700'
                              }`}>
                                {srv.channel === 'Voz' ? <Phone className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                                <span>{srv.channel}</span>
                              </span>
                              {srv.segment && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  srv.segment === 'B2B' ? 'bg-indigo-100 text-indigo-800' : 'bg-cyan-100 text-cyan-800'
                                }`}>
                                  {srv.segment}
                                </span>
                              )}
                            </div>
                            {srv.clasificacionEmpresas ? (
                              <span className="text-[10px] text-slate-500">{srv.clasificacionEmpresas}</span>
                            ) : srv.inboxName ? (
                              <span className="text-[10px] font-mono text-slate-400">{srv.inboxName}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-medium font-mono text-slate-800">
                          {srv.phoneOrLine || srv.customerIdentifier}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] font-mono">
                          {srv.surveyDate}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                            srv.npsType === 'Detractor'
                              ? 'bg-rose-100 text-rose-800'
                              : srv.npsType === 'Pasivo'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {srv.npsScore}/10 · {srv.npsType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {srv.csat || srv.fcr || srv.effort ? (
                            <div className="space-y-0.5 text-[10px]">
                              {srv.csat && (
                                <div className="text-slate-700">
                                  CSAT: <strong className="font-mono text-blue-700">{srv.csat}</strong>
                                </div>
                              )}
                              {srv.fcr && (
                                <div className="text-slate-700">
                                  FCR: <strong className={srv.fcr.toLowerCase().startsWith('s') ? 'text-emerald-700' : 'text-rose-700'}>{srv.fcr}</strong>
                                </div>
                              )}
                              {srv.effort && (
                                <div className="text-slate-700">
                                  Effort: <strong className="font-mono">{srv.effort}</strong>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <div>{srv.agentName || 'No identificado'}</div>
                          {srv.asesorPersonalizado && (
                            <div className="text-[10px] text-slate-400">
                              Personalizado: {srv.asesorPersonalizado}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 max-w-xs truncate text-slate-600 italic" title={srv.customerComment}>
                          {srv.customerComment || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {srv.hasGeneratedPending ? (
                            <button
                              type="button"
                              onClick={() => {
                                const matchedPending = pendingAnalyses.find(
                                  (p) => p.ticketNumber === srv.ticketNumber || (srv.chatId && p.chatId === srv.chatId)
                                );
                                if (matchedPending && matchedPending.status === 'PENDIENTE') {
                                  handleStartAuditPendingItem(matchedPending);
                                } else {
                                  setActiveTab('bandeja_analista');
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold hover:bg-rose-100 transition-colors"
                            >
                              <span>En Bandeja Analista</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Informativo</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL EN PANTALLA: FORMULARIO PARA ANALIZAR ATENCIÓN                      */}
      {/* ========================================================================= */}
      {isAnalysisModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-slate-50 rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            
            {/* Modal Sticky Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                      {activePendingItem?.origin === 'REFUTACION'
                        ? `Re-evaluación de Monitoreo Refutado · ${uniqueId}`
                        : `Formulario para Analizar Atención · Caso #${activePendingItem?.chatId || activePendingItem?.ticketNumber || uniqueId}`}
                    </h2>
                    {activePendingItem?.origin === 'REFUTACION' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        Refutado por {activePendingItem.refutation?.refutedByRole === 'team_leader' ? 'TL' : 'Asesor'}
                      </span>
                    )}
                    {activePendingItem?.segment && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        activePendingItem.segment === 'B2B'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : 'bg-teal-50 text-teal-800 border-teal-200'
                      }`}>
                        {activePendingItem.segment}
                      </span>
                    )}
                    {activePendingItem?.origin.includes('DETRACTORA') && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                        Detractor NPS {activePendingItem.npsScore}/10
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Asesor: <strong className="text-slate-700">{sourceAgentName || activePendingItem?.agentName || 'Sin asesor'}</strong> · Fecha: <strong className="font-mono text-slate-700">{callDate}</strong>.{' '}
                    {activePendingItem?.origin === 'REFUTACION'
                      ? 'Al guardar, el monitoreo se actualizará y volverá al flujo de feedback.'
                      : 'Al guardar, el pendiente pasará a estado AUDITADO.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseAnalysisModal}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
                title="Cerrar formulario de análisis"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMonitoring} className="p-5 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">

              {analysisFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{analysisFormError}</span>
                </div>
              )}

              {activePendingItem?.origin === 'REFUTACION' && activePendingItem.refutation && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-rose-900 flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-rose-600" />
                      <span>
                        Monitoreo Refutado por{' '}
                        {activePendingItem.refutation.refutedByRole === 'team_leader' ? 'Team Leader' : 'Asesor'}:{' '}
                        {activePendingItem.refutation.refutedByName}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-rose-700">
                      {activePendingItem.refutation.refutedAt}
                    </span>
                  </div>
                  <p className="text-rose-950 leading-relaxed pl-5.5">
                    <strong>Argumento / Motivo:</strong> &ldquo;{activePendingItem.refutation.reason}&rdquo;
                  </p>
                  <p className="text-[11px] text-rose-800 pl-5.5">
                    Revisa las categorizaciones, área imputable o hallazgos y guarda para reenviar el monitoreo actualizado al Team Leader.
                  </p>
                </div>
              )}

          {/* Card 1: Datos de la Atención Evaluada */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  1. Datos de la Atención Evaluada
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              
              {/* 1. ID Único */}
              <div>
                <label className="text-slate-700 font-semibold flex items-center gap-1 mb-1">
                  <Hash className="w-3 h-3 text-slate-500" />
                  <span>ID Único</span>
                </label>
                <input
                  type="text"
                  value={uniqueId}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                />
              </div>

              {/* 2. Asesor Evaluado */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Asesor Evaluado
                </label>
                <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-not-allowed select-none truncate">
                  {selectedAdvisor
                    ? selectedAdvisor.name
                    : sourceAgentName || 'Sin asesor asignado'}
                </div>
              </div>

              {/* 3. Team Leader */}
              <div>
                <label className="text-slate-700 font-semibold flex items-center gap-1 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Team Leader</span>
                </label>
                {selectedAdvisor?.reportsToId ? (
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-not-allowed select-none truncate">
                    {assignedTeamLeader ? assignedTeamLeader.name : 'Sin Team Leader'}
                  </div>
                ) : (
                  <SearchableSelect
                    value={fallbackTlId}
                    onChange={setFallbackTlId}
                    required
                    placeholder="-- Seleccionar Team Leader --"
                    searchPlaceholder="Buscar Team Leader..."
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-800"
                    options={[
                      { value: '', label: '-- Seleccionar Team Leader --' },
                      ...teamLeaders.map((tl) => ({
                        value: tl.id,
                        label: tl.name,
                        searchText: tl.email,
                      })),
                    ]}
                  />
                )}
              </div>

              {/* 4. Canal de Atención */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Canal de Atención
                </label>
                <div className="flex items-center justify-between gap-2 py-2 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-not-allowed select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    {channel === 'Voz' && <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    {channel === 'Chat' && <MessageSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                    {channel === 'WhatsApp' && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>}
                    {channel === 'Correo' && <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0"></span>}
                    <span className="truncate">{channel}{segment ? ` · ${segment}` : ''}</span>
                  </div>
                  {segment && (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                      segment === 'B2B' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                    }`}>
                      {segment}
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Second row of Section 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-3 border-t border-slate-100">
              
              {/* 5. Chat ID o Línea del Cliente */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Chat ID o Línea del Cliente
                </label>
                <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-700 cursor-not-allowed select-none truncate">
                  {chatId ? `${chatId} · ${customerIdentifier}` : customerIdentifier}
                </div>
              </div>

              {/* 6. Fecha de Atención */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Fecha de Atención
                </label>
                <input
                  type="date"
                  value={callDate}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-700 cursor-not-allowed select-none"
                />
              </div>

              {/* 7. Nota de la Encuesta */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Nota de la Encuesta
                </label>
                <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs cursor-not-allowed select-none">
                  <span className="font-mono font-bold text-slate-800">
                    {surveyScore !== '' ? `${surveyScore} / 10` : 'Sin calificación'}
                  </span>
                  {surveyScore !== '' && (
                    <span className={`px-2 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                      Number(surveyScore) <= 6
                        ? 'bg-rose-100 text-rose-800'
                        : Number(surveyScore) <= 8
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {Number(surveyScore) <= 6 ? '🔴 Detractor' : Number(surveyScore) <= 8 ? '🟡 Pasivo' : '🟢 Promotor'}
                    </span>
                  )}
                </div>
              </div>

              {/* 8. Motivo de Contacto */}
              <div className="p-2.5 bg-blue-50/60 rounded-xl border-2 border-blue-400 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-blue-950 font-bold flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Motivo de Contacto *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseAnalysisModal();
                      setActiveTab('motivos_contacto');
                    }}
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-semibold hover:underline"
                    title="Ir a gestionar catálogo de motivos de contacto"
                  >
                    + Catálogo
                  </button>
                </div>
                <SearchableSelect
                  value={contactReason}
                  onChange={setContactReason}
                  required
                  placeholder="-- Seleccionar Motivo --"
                  searchPlaceholder="Buscar motivo de contacto..."
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  options={[
                    { value: '', label: '-- Seleccionar Motivo --' },
                    ...contactReasons
                      .filter((r) => r.active)
                      .map((reason) => ({
                        value: reason.name,
                        label: reason.name,
                        searchText: reason.description || '',
                      })),
                  ]}
                />
              </div>

            </div>

            {/* Chat NPS Indicators when present */}
            {(clasificacionEmpresas || inboxName || csat || fcr || effort || asesorPersonalizado) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Clasificación / Segmento</label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 cursor-not-allowed select-none truncate">
                    {clasificacionEmpresas || inboxName || '—'} {segment ? `(${segment})` : ''}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Satisfacción (CSAT)</label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono font-semibold text-slate-700 cursor-not-allowed select-none">
                    {csat || 'Sin dato'}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">FCR</label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-700 cursor-not-allowed select-none">
                    {fcr || 'Sin dato'}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Effort (Esfuerzo)</label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono font-semibold text-slate-700 cursor-not-allowed select-none">
                    {effort || 'Sin dato'}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Asesor Personalizado</label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 cursor-not-allowed select-none truncate">
                    {asesorPersonalizado || 'No'}
                  </div>
                </div>
              </div>
            )}

            {/* Verbatim / Comentario del Cliente */}
            {customerComment && (
              <div className="pt-3 border-t border-slate-100 text-xs">
                <label className="text-slate-700 font-semibold flex items-center gap-1.5 mb-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Verbatim / Comentario del Cliente</span>
                </label>
                <div className="px-3.5 py-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-slate-800 italic leading-relaxed cursor-not-allowed select-none">
                  "{customerComment}"
                </div>
              </div>
            )}

          </div>

          {/* Card 2: Categorización */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  2. Categorización (Categoría · Motivo · Causa Raíz)
                </h2>
              </div>
            </div>

            {/* Tripleta 1 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-semibold text-slate-900">
                <span>Categorización Principal (Obligatoria)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Categoría (Nivel 1) */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    1. Categoría *
                  </label>
                  <SearchableSelect
                    value={cat1}
                    onChange={(nextCat) => {
                      setCat1(nextCat);
                      setMot1('');
                      setCr1('');
                    }}
                    required
                    placeholder="-- Seleccionar Categoría --"
                    searchPlaceholder="Buscar categoría..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-slate-900"
                    options={[
                      { value: '', label: '-- Seleccionar Categoría --' },
                      ...categories.map((c) => ({
                        value: c.name,
                        label: c.name,
                      })),
                    ]}
                  />
                </div>

                {/* Motivo (Nivel 2) */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    2. Motivo *
                  </label>
                  <SearchableSelect
                    value={mot1}
                    onChange={(nextMot) => {
                      setMot1(nextMot);
                      setCr1('');
                    }}
                    required
                    disabled={!cat1}
                    placeholder="-- Seleccionar Motivo --"
                    searchPlaceholder="Buscar motivo..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-slate-900"
                    options={[
                      { value: '', label: '-- Seleccionar Motivo --' },
                      ...motivos1List.map((m) => ({
                        value: m.name,
                        label: m.name,
                      })),
                    ]}
                  />
                </div>

                {/* Causa Raíz (Nivel 3) */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    3. Causa Raíz *
                  </label>
                  <SearchableSelect
                    value={cr1}
                    onChange={(nextCr) => {
                      setCr1(nextCr);
                      const matched = causas1List.find((c) => c.name === nextCr);
                      if (matched?.areaImputable) {
                        setAreaImputable(matched.areaImputable);
                      }
                    }}
                    required
                    disabled={!mot1}
                    placeholder="-- Seleccionar Causa Raíz --"
                    searchPlaceholder="Buscar causa raíz..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-slate-900"
                    options={[
                      { value: '', label: '-- Seleccionar Causa Raíz --' },
                      ...causas1List.map((cr) => ({
                        value: cr.name,
                        label: `${cr.name}${cr.areaImputable ? ` (${cr.areaImputable})` : ''}`,
                        searchText: cr.definicion || '',
                      })),
                    ]}
                  />
                </div>
              </div>

              {(selectedCausa1Obj?.definicion || selectedCausa1Obj?.areaImputable) && (
                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-[11px] text-slate-700 flex flex-col sm:flex-row sm:items-start gap-2">
                  {selectedCausa1Obj.areaImputable && (
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 border ${
                      selectedCausa1Obj.areaImputable === 'Negocio'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : selectedCausa1Obj.areaImputable === 'Cliente'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-slate-200 text-slate-800 border-slate-300'
                    }`}>
                      Área Imputable: {selectedCausa1Obj.areaImputable}
                    </span>
                  )}
                  {selectedCausa1Obj.definicion && (
                    <p className="leading-relaxed">
                      <strong className="text-slate-900">Definición de uso:</strong> {selectedCausa1Obj.definicion}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Checkbox: Amerita segunda categorización */}
            <div className="pt-2">
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={hasSecondCategory}
                  onChange={(e) => setHasSecondCategory(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-900">
                  ¿Amerita segunda categorización?
                </span>
              </label>
            </div>

            {/* Tripleta 2 (Condicional) */}
            {hasSecondCategory && (
              <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-3 animate-in fade-in duration-150">
                <div className="text-xs font-semibold text-purple-900">
                  <span>Segunda Categorización</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      1. Categoría 2
                    </label>
                    <SearchableSelect
                      value={cat2}
                      onChange={(nextCat) => {
                        setCat2(nextCat);
                        setMot2('');
                        setCr2('');
                      }}
                      placeholder="-- Seleccionar Categoría --"
                      searchPlaceholder="Buscar categoría..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                      options={[
                        { value: '', label: '-- Seleccionar Categoría --' },
                        ...categories.map((c) => ({
                          value: c.name,
                          label: c.name,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      2. Motivo 2
                    </label>
                    <SearchableSelect
                      value={mot2}
                      onChange={(nextMot) => {
                        setMot2(nextMot);
                        setCr2('');
                      }}
                      disabled={!cat2}
                      placeholder="-- Seleccionar Motivo --"
                      searchPlaceholder="Buscar motivo..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                      options={[
                        { value: '', label: '-- Seleccionar Motivo --' },
                        ...motivos2List.map((m) => ({
                          value: m.name,
                          label: m.name,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      3. Causa Raíz 2
                    </label>
                    <SearchableSelect
                      value={cr2}
                      onChange={setCr2}
                      disabled={!mot2}
                      placeholder="-- Seleccionar Causa Raíz --"
                      searchPlaceholder="Buscar causa raíz..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                      options={[
                        { value: '', label: '-- Seleccionar Causa Raíz --' },
                        ...causas2List.map((cr) => ({
                          value: cr.name,
                          label: `${cr.name}${cr.areaImputable ? ` (${cr.areaImputable})` : ''}`,
                          searchText: cr.definicion || '',
                        })),
                      ]}
                    />
                  </div>
                </div>

                {(selectedCausa2Obj?.definicion || selectedCausa2Obj?.areaImputable) && (
                  <div className="p-2.5 rounded-lg bg-purple-100/60 border border-purple-200 text-[11px] text-slate-700 flex flex-col sm:flex-row sm:items-start gap-2">
                    {selectedCausa2Obj.areaImputable && (
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] shrink-0 bg-purple-200 text-purple-900">
                        Área Imputable: {selectedCausa2Obj.areaImputable}
                      </span>
                    )}
                    {selectedCausa2Obj.definicion && (
                      <p className="leading-relaxed">
                        <strong className="text-slate-900">Definición de uso:</strong> {selectedCausa2Obj.definicion}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Card 3: Área Imputable y Feedback */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <CheckCircle2 className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900">
                3. Área Imputable & Asignación de Feedback
              </h2>
            </div>

            <div className="text-xs">
              {/* Área Imputable (directa de la categorización, no editable) */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Área Imputable
                </label>
                <div className="max-w-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-not-allowed select-none flex items-center">
                  {derivedAreaImputable ? (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                      derivedAreaImputable === 'Negocio'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : derivedAreaImputable === 'Cliente'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                    }`}>
                      {derivedAreaImputable}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Check: ¿Amerita Feedback? */}
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={requiresFeedback}
                  onChange={(e) => setRequiresFeedback(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-900">
                  ¿Esta atención amerita feedback al agente?
                </span>
              </label>
            </div>

            {/* QA Feedback Fields (Conditional) */}
            {requiresFeedback && (
              <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-200 space-y-3 animate-in fade-in duration-150 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    Hallazgos del Analista para el Team Leader & Asesor *
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Prioridad:</span>
                    <SearchableSelect
                      wrapperClassName="w-28"
                      dropdownMinWidth={150}
                      value={priority}
                      onChange={(val) => setPriority(val as any)}
                      searchPlaceholder="Buscar prioridad..."
                      className="w-full px-2 py-0.5 rounded border border-slate-200 bg-white text-[11px] font-medium text-slate-800"
                      options={[
                        { value: 'Alta', label: 'Alta' },
                        { value: 'Media', label: 'Media' },
                        { value: 'Baja', label: 'Baja' },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Hallazgo Crítico / Motivo del Feedback *
                  </label>
                  <textarea
                    rows={3}
                    value={criticalFinding}
                    onChange={(e) => setCriticalFinding(e.target.value)}
                    required={requiresFeedback}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 mb-0.5">Fortalezas Observadas</label>
                    <input
                      type="text"
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-0.5">Oportunidades de Mejora</label>
                    <input
                      type="text"
                      value={opportunities}
                      onChange={(e) => setOpportunities(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseAnalysisModal}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex items-center gap-2 px-6 py-2.5 text-white font-medium text-xs rounded-xl transition-colors shadow-2xs ${
                  activePendingItem?.origin === 'REFUTACION'
                    ? 'bg-rose-700 hover:bg-rose-800'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {activePendingItem?.origin === 'REFUTACION'
                    ? 'Guardar Re-evaluación y Reenviar'
                    : 'Guardar y Asignar Monitoreo'}
                </span>
              </button>
            </div>

          </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GESTIÓN DE CATEGORIZACIONES (3 NIVELES ANIDADOS + EXCEL)            */}
      {/* ========================================================================= */}
      {activeTab === 'categorizaciones' && (
        <div className="space-y-6">
          
          {/* Action Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Árbol Jerárquico de Categorizaciones (3 Niveles)
                </h2>
                <p className="text-xs text-slate-500">
                  Estructura anidada: <strong>Categoría</strong> &gt; <strong>Motivo</strong> &gt; <strong>Causa Raíz</strong>, con <strong>Área Imputable</strong> y <strong>Definición</strong> de uso.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setModalType('cat');
                    setModalAction('create');
                    setEditingTarget({ name: '', code: '' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Categoría</span>
                </button>

                <button
                  onClick={() => exportCategoriesToExcel(categories)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                  title="Descargar árbol en Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Excel</span>
                </button>

                <button
                  onClick={() => setShowExcelImport(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs"
                  title="Carga masiva rápida mediante Excel"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Carga Rápida Excel</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar for Categories Tree */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-3 border-t border-slate-100 text-xs">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar categoría, motivo, causa raíz o definición..."
                  value={catTreeSearch}
                  onChange={(e) => setCatTreeSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['ALL', 'Negocio', 'Asesor', 'Cliente'] as const).map((areaOpt) => (
                  <button
                    key={areaOpt}
                    type="button"
                    onClick={() => setCatTreeAreaFilter(areaOpt)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      catTreeAreaFilter === areaOpt
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {areaOpt === 'ALL' ? 'Todas las Áreas' : areaOpt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tree View */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {categories.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No hay categorías registradas. Puedes crearlas manualmente o importar un archivo Excel.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {categories
                  .map((cat) => {
                    const q = catTreeSearch.trim().toLowerCase();
                    const catNameMatch = q ? cat.name.toLowerCase().includes(q) : true;
                    const areaFiltering = catTreeAreaFilter !== 'ALL';

                    const filteredMotivos = cat.motivos
                      .map((mot) => {
                        const motNameMatch = q ? mot.name.toLowerCase().includes(q) : true;
                        const filteredCausas = mot.causasRaiz.filter((cr) => {
                          if (areaFiltering && cr.areaImputable !== catTreeAreaFilter) {
                            return false;
                          }
                          if (!q) return true;
                          return (
                            catNameMatch ||
                            motNameMatch ||
                            cr.name.toLowerCase().includes(q) ||
                            (cr.definicion || '').toLowerCase().includes(q)
                          );
                        });

                        if (areaFiltering && filteredCausas.length === 0) return null;
                        if (q && !catNameMatch && !motNameMatch && filteredCausas.length === 0) return null;

                        return { ...mot, causasRaiz: filteredCausas };
                      })
                      .filter((m): m is NonNullable<typeof m> => m !== null);

                    if ((q || areaFiltering) && filteredMotivos.length === 0 && (!catNameMatch || areaFiltering)) {
                      return null;
                    }

                    return { ...cat, motivos: filteredMotivos };
                  })
                  .filter((c): c is NonNullable<typeof c> => c !== null)
                  .map((cat) => {
                  const isCatExpanded = expandedCats[cat.id] ?? true;
                  return (
                    <div key={cat.id} className="p-4 space-y-3">
                      
                      {/* LEVEL 1: CATEGORIA */}
                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleCat(cat.id)}
                            className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-600"
                          >
                            {isCatExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <div>
                            <span className="font-bold text-xs text-slate-900">
                              {cat.name}
                            </span>
                            {cat.code && (
                              <span className="ml-2 font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                                {cat.code}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            ({cat.motivos.length} motivos)
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setModalType('mot');
                              setModalAction('create');
                              setEditingTarget({ catId: cat.id, name: '' });
                            }}
                            className="px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
                            title="Agregar Motivo anidado"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Agregar Motivo</span>
                          </button>
                          <button
                            onClick={() => {
                              setModalType('cat');
                              setModalAction('edit');
                              setEditingTarget({ catId: cat.id, name: cat.name, code: cat.code });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded"
                            title="Editar Categoría"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`¿Eliminar categoría "${cat.name}" y todos sus motivos y causas raíz?`)) {
                                deleteCategory(cat.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Eliminar Categoría"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* LEVEL 2: MOTIVOS */}
                      {isCatExpanded && (
                        <div className="pl-6 space-y-2.5">
                          {cat.motivos.length === 0 ? (
                            <div className="p-3 text-[11px] text-slate-400 italic bg-slate-50/50 rounded-lg">
                              Sin motivos registrados. Haz clic en "Agregar Motivo".
                            </div>
                          ) : (
                            cat.motivos.map((mot) => {
                              const isMotExpanded = expandedMotivos[mot.id] ?? true;
                              return (
                                <div key={mot.id} className="p-3 rounded-lg border border-slate-100 bg-white space-y-2">
                                  
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => toggleMotivo(mot.id)}
                                        className="p-0.5 hover:bg-slate-100 rounded text-slate-500"
                                      >
                                        {isMotExpanded ? (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                      <span className="font-semibold text-xs text-slate-800">
                                        {mot.name}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        ({mot.causasRaiz.length} causas)
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          setModalType('cr');
                                          setModalAction('create');
                                          setEditingTarget({
                                            catId: cat.id,
                                            motId: mot.id,
                                            name: '',
                                            areaImputable: 'Asesor',
                                            definicion: '',
                                          });
                                        }}
                                        className="px-2 py-0.5 text-[10px] text-purple-700 hover:bg-purple-50 rounded flex items-center gap-1"
                                        title="Agregar Causa Raíz"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>Causa Raíz</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setModalType('mot');
                                          setModalAction('edit');
                                          setEditingTarget({ catId: cat.id, motId: mot.id, name: mot.name });
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (window.confirm(`¿Eliminar motivo "${mot.name}"?`)) {
                                            deleteMotivo(cat.id, mot.id);
                                          }
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* LEVEL 3: CAUSAS RAIZ */}
                                  {isMotExpanded && (
                                    <div className="pl-6 space-y-1.5 pt-1">
                                      {mot.causasRaiz.length === 0 ? (
                                        <div className="text-[10px] text-slate-400 italic">
                                          Sin causas raíz. Haz clic en "Causa Raíz".
                                        </div>
                                      ) : (
                                        mot.causasRaiz.map((cr) => (
                                          <div
                                            key={cr.id}
                                            className="flex items-start justify-between gap-2 py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] group border border-slate-100"
                                          >
                                            <div className="space-y-0.5 min-w-0 flex-1">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-slate-800">
                                                  • {cr.name}
                                                </span>
                                                {cr.areaImputable && (
                                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                                    cr.areaImputable === 'Negocio'
                                                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                                      : cr.areaImputable === 'Cliente'
                                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                                  }`}>
                                                    {cr.areaImputable}
                                                  </span>
                                                )}
                                              </div>
                                              {cr.definicion && (
                                                <p className="text-[10px] text-slate-500 pl-2.5 leading-relaxed">
                                                  <span className="font-semibold text-slate-600">Definición:</span> {cr.definicion}
                                                </p>
                                              )}
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                                              <button
                                                onClick={() => {
                                                  setModalType('cr');
                                                  setModalAction('edit');
                                                  setEditingTarget({
                                                    catId: cat.id,
                                                    motId: mot.id,
                                                    crId: cr.id,
                                                    name: cr.name,
                                                    areaImputable: cr.areaImputable || '',
                                                    definicion: cr.definicion || '',
                                                  });
                                                }}
                                                className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
                                              >
                                                <Edit3 className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={() => {
                                                  if (window.confirm(`¿Eliminar causa raíz "${cr.name}"?`)) {
                                                    deleteCausaRaiz(cat.id, mot.id, cr.id);
                                                  }
                                                }}
                                                className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}

                                </div>
                              );
                            })
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: GESTIÓN DE MOTIVO DE CONTACTO                                      */}
      {/* ========================================================================= */}
      {activeTab === 'motivos_contacto' && (
        <ContactReasonManagement />
      )}

      {/* ========================================================================= */}
      {/* MODALS SECTION                                                            */}
      {/* ========================================================================= */}

      {/* Category CRUD Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {modalAction === 'create' ? 'Agregar' : 'Editar'}{' '}
                {modalType === 'cat'
                  ? 'Categoría (Nivel 1)'
                  : modalType === 'mot'
                  ? 'Motivo (Nivel 2)'
                  : 'Causa Raíz (Nivel 3)'}
              </h3>
              <button
                onClick={() => {
                  setModalType(null);
                  setEditingTarget(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategoryModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Facturación y Pagos..."
                  value={editingTarget?.name || ''}
                  onChange={(e) =>
                    setEditingTarget((prev) => (prev ? { ...prev, name: e.target.value } : null))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white"
                  autoFocus
                />
              </div>

              {modalType === 'cat' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Código Mnemotécnico (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: FAC, TEC, REC..."
                    value={editingTarget?.code || ''}
                    onChange={(e) =>
                      setEditingTarget((prev) => (prev ? { ...prev, code: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase focus:bg-white"
                  />
                </div>
              )}

              {modalType === 'cr' && (
                <>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Área Imputable
                    </label>
                    <SearchableSelect
                      value={editingTarget?.areaImputable || ''}
                      onChange={(val) =>
                        setEditingTarget((prev) =>
                          prev ? { ...prev, areaImputable: val as AreaImputable | '' } : null
                        )
                      }
                      placeholder="-- Seleccionar Área Imputable --"
                      searchPlaceholder="Buscar área..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                      options={[
                        { value: '', label: '-- Seleccionar Área Imputable --' },
                        { value: 'Negocio', label: 'Negocio' },
                        { value: 'Asesor', label: 'Asesor' },
                        { value: 'Cliente', label: 'Cliente' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Definición (Detalle de cuándo se usa esta tripleta)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe en qué casos o situaciones aplica esta tripleta..."
                      value={editingTarget?.definicion || ''}
                      onChange={(e) =>
                        setEditingTarget((prev) => (prev ? { ...prev, definicion: e.target.value } : null))
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalType(null);
                    setEditingTarget(null);
                  }}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Category Import Modal */}
      {showExcelImport && (
        <ExcelImportModal
          title="Carga Masiva de Categorizaciones"
          description="Sube un archivo Excel (.xlsx, .xls) con el área imputable (Negocio, Asesor, Cliente), la tripleta de 3 niveles y su definición."
          sampleColumns={['ÁREA IMPUTABLE', 'CATEGORÍA', 'MOTIVO', 'CAUSA RAÍZ', 'DEFINICIÓN']}
          onDownloadTemplate={() => downloadCategoryTemplate()}
          onProcessFile={async (file: File) => {
            const res = await parseCategoriesFromFile(file);
            if (res.success && res.categories.length > 0) {
              importCategories(res.categories);
            }
            return {
              success: res.success,
              rowCount: res.rowCount,
              errors: res.errors,
            };
          }}
          onClose={() => setShowExcelImport(false)}
        />
      )}

      {/* Survey Upload Modal for Voice and Chat */}
      <SurveyUploadModal
        isOpen={surveyModalOpen}
        channel={surveyModalChannel}
        onClose={() => setSurveyModalOpen(false)}
        onSuccess={handleSurveySuccess}
      />

      {/* Modal: Confirmar eliminación total de la base de encuestas */}
      {isClearSurveysModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Eliminar toda la base de encuestas
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Esta acción eliminará permanentemente todos los registros cargados en la colección de encuestas (Voz y Chat) de la base de datos.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoClearSurveyPending}
                onChange={(e) => setAlsoClearSurveyPending(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span>
                También eliminar de la <strong>Bandeja de Pendientes</strong> las encuestas detractoras que aún estén en estado <strong>PENDIENTE</strong>.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isClearingSurveys}
                onClick={() => setIsClearSurveysModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isClearingSurveys}
                onClick={async () => {
                  setIsClearingSurveys(true);
                  try {
                    const count = await clearSurveys(alsoClearSurveyPending);
                    setSurveyClearedMessage(
                      `Base de encuestas eliminada correctamente (${count} registro(s) removidos de Firestore).`
                    );
                    setIsClearSurveysModalOpen(false);
                  } catch {
                    setIsClearSurveysModalOpen(false);
                  } finally {
                    setIsClearingSurveys(false);
                  }
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-lg"
              >
                {isClearingSurveys ? 'Eliminando...' : 'Sí, eliminar toda la base'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
