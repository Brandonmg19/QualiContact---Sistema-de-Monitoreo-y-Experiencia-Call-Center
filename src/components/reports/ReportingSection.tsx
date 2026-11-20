import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MonitoringItem } from '../../types';
import { 
  BarChart3, 
  Sparkles, 
  Download, 
  Filter, 
  Calendar, 
  User, 
  Users, 
  Layers, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Phone, 
  MessageSquare, 
  Send, 
  Bot, 
  Copy, 
  Check, 
  FileText,
  Search,
  RefreshCw,
  Database,
  Award,
  AlertCircle
} from 'lucide-react';
import { exportMonitoringsToExcel } from '../../utils/excel';
import { SearchableSelect } from '../common/SearchableSelect';

export const ReportingSection: React.FC = () => {
  const {
    currentUser,
    monitorings,
    users,
    auditLogs,
    activeSubSection,
    setActiveSubSection,
    hasPermission,
    canAccessSubSection,
  } = useApp();

  const canViewReportsTab = canAccessSubSection('reporteria', 'metricas');
  const canUseAiTab = canAccessSubSection('reporteria', 'ia');
  const canExport = hasPermission('canExportReports');

  const activeSubTab = (
    activeSubSection === 'ia' && canUseAiTab
      ? 'ia'
      : canViewReportsTab
      ? 'metricas'
      : 'ia'
  ) as 'metricas' | 'ia';
  const setActiveSubTab = (tab: 'metricas' | 'ia') => setActiveSubSection(tab);

  // Filters for Reporting
  const [levelFilter, setLevelFilter] = useState<'todos' | 'asesor' | 'tl' | 'coordinador'>('todos');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [imputableFilter, setImputableFilter] = useState<string>('ALL');
  const [searchTable, setSearchTable] = useState<string>('');

  // AI Coaching State
  const [aiTargetType, setAiTargetType] = useState<'asesor' | 'team_leader' | 'coordinador'>('asesor');
  const [aiTargetId, setAiTargetId] = useState<string>('');
  const [aiCustomQuestion, setAiCustomQuestion] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiAdviceText, setAiAdviceText] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<string>('gemini');
  const [copiedAdvice, setCopiedAdvice] = useState<boolean>(false);

  // Base monitorings scoped by active user role
  const roleScopedMonitorings = useMemo(() => {
    if (currentUser.role === 'asesor') {
      return monitorings.filter((m) => m.agentId === currentUser.id);
    }
    if (currentUser.role === 'team_leader') {
      return monitorings.filter((m) => m.teamLeaderId === currentUser.id);
    }
    return monitorings;
  }, [monitorings, currentUser]);

  // Filtered monitorings for Reporting
  const filteredMonitorings = useMemo(() => {
    return roleScopedMonitorings.filter((m) => {
      // Level & Entity filtering
      if (levelFilter === 'asesor' && selectedEntityId !== 'ALL' && m.agentId !== selectedEntityId) {
        return false;
      }
      if (levelFilter === 'tl' && selectedEntityId !== 'ALL' && m.teamLeaderId !== selectedEntityId) {
        return false;
      }

      // Channel filter
      if (channelFilter !== 'ALL' && m.channel !== channelFilter) {
        return false;
      }

      // Imputable area filter
      if (imputableFilter !== 'ALL' && m.areaImputable !== imputableFilter) {
        return false;
      }

      // Search
      if (searchTable.trim()) {
        const q = searchTable.toLowerCase();
        const match =
          m.ticketNumber.toLowerCase().includes(q) ||
          m.agentName.toLowerCase().includes(q) ||
          m.teamLeaderName.toLowerCase().includes(q) ||
          m.customerIdentifier.toLowerCase().includes(q) ||
          m.category1?.categoria.toLowerCase().includes(q) ||
          m.category1?.causaRaiz.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [roleScopedMonitorings, levelFilter, selectedEntityId, channelFilter, imputableFilter, searchTable]);

  // Aggregate Metrics & Analytics
  const metrics = useMemo(() => {
    const total = filteredMonitorings.length;
    const avgScore = total > 0 ? filteredMonitorings.reduce((sum, m) => sum + m.score, 0) / total : 0;
    const withFeedback = filteredMonitorings.filter((m) => m.requiresFeedback).length;
    const closedFeedback = filteredMonitorings.filter((m) => m.status === 'CERRADO').length;
    const feedbackRate = withFeedback > 0 ? ((closedFeedback / withFeedback) * 100).toFixed(0) : '100';

    // Imputable breakdown
    const imputable: Record<string, number> = { Asesor: 0, Negocio: 0, Cliente: 0 };
    filteredMonitorings.forEach((m) => {
      imputable[m.areaImputable] = (imputable[m.areaImputable] || 0) + 1;
    });

    // Channels breakdown
    const channels: Record<string, number> = {};
    filteredMonitorings.forEach((m) => {
      channels[m.channel] = (channels[m.channel] || 0) + 1;
    });

    // Top Causas Raíz
    const causasMap: Record<string, { count: number; name: string; category: string }> = {};
    filteredMonitorings.forEach((m) => {
      const cr = m.category1?.causaRaiz;
      if (cr) {
        if (!causasMap[cr]) {
          causasMap[cr] = { count: 0, name: cr, category: m.category1.categoria };
        }
        causasMap[cr].count += 1;
      }
    });

    const topCausas = Object.values(causasMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      avgScore,
      withFeedback,
      closedFeedback,
      feedbackRate,
      imputable,
      channels,
      topCausas,
    };
  }, [filteredMonitorings]);

  const effectiveAiTargetType: 'asesor' | 'team_leader' | 'coordinador' =
    currentUser.role === 'asesor'
      ? 'asesor'
      : currentUser.role === 'team_leader' && aiTargetType === 'coordinador'
      ? 'team_leader'
      : aiTargetType;

  // Initialize default target for AI coaching when type changes
  const targetOptions = useMemo(() => {
    if (effectiveAiTargetType === 'asesor') {
      if (currentUser.role === 'asesor') {
        return [currentUser];
      }
      if (currentUser.role === 'team_leader') {
        return users.filter((u) => u.role === 'asesor' && u.reportsToId === currentUser.id);
      }
      return users.filter((u) => u.role === 'asesor');
    }
    if (effectiveAiTargetType === 'team_leader') {
      if (currentUser.role === 'team_leader') {
        return [currentUser];
      }
      return users.filter((u) => u.role === 'team_leader');
    }
    const coords = users.filter((u) => u.role === 'coordinador');
    return [
      { id: 'coord-global', name: 'Servicio Global / Toda la Operación' },
      ...coords,
    ];
  }, [effectiveAiTargetType, users, currentUser]);

  const currentSelectedTarget = useMemo(() => {
    return targetOptions.find((t) => t.id === aiTargetId) || targetOptions[0];
  }, [targetOptions, aiTargetId]);

  // Reactive monitorings for the selected target (enables live data audit in UI)
  const currentTargetMonitorings = useMemo(() => {
    if (!currentSelectedTarget) return [];
    if (effectiveAiTargetType === 'asesor') {
      return roleScopedMonitorings.filter((m) => m.agentId === currentSelectedTarget.id);
    }
    if (effectiveAiTargetType === 'team_leader') {
      return roleScopedMonitorings.filter((m) => m.teamLeaderId === currentSelectedTarget.id);
    }
    if (currentSelectedTarget.id === 'coord-global') {
      return roleScopedMonitorings;
    }
    // Coordinator: monitorings of TLs who report to this coordinator
    const tlsUnderCoord = users.filter((u) => u.role === 'team_leader' && u.reportsToId === currentSelectedTarget.id);
    if (tlsUnderCoord.length > 0) {
      return roleScopedMonitorings.filter((m) => tlsUnderCoord.some((tl) => tl.id === m.teamLeaderId));
    }
    return roleScopedMonitorings;
  }, [currentSelectedTarget, effectiveAiTargetType, roleScopedMonitorings, users]);

  // Handle AI Advice Request to Backend Proxy (Consumes ALL registered records)
  const handleGenerateAdvice = async () => {
    setIsAiLoading(true);
    setAiAdviceText(null);

    const targetName = currentSelectedTarget ? currentSelectedTarget.name : 'Operación General';
    const total = currentTargetMonitorings.length;
    const avgScore = total > 0 ? currentTargetMonitorings.reduce((sum, m) => sum + m.score, 0) / total : 80;
    const withFeedback = currentTargetMonitorings.filter((m) => m.requiresFeedback).length;
    const closedFeedback = currentTargetMonitorings.filter((m) => m.status === 'CERRADO').length;

    // Aggregate causes for this target
    const causeCounts: Record<string, number> = {};
    currentTargetMonitorings.forEach((m) => {
      const cr = m.category1?.causaRaiz;
      if (cr) causeCounts[cr] = (causeCounts[cr] || 0) + 1;
    });
    const topCauses = Object.entries(causeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
      .slice(0, 5);

    // Build the complete array of ALL registered monitorings for this entity
    const allRegisteredMonitorings = currentTargetMonitorings.map((m) => ({
      ticketNumber: m.ticketNumber,
      customerIdentifier: m.customerIdentifier,
      callDate: m.callDate,
      callTime: m.callTime || 'N/A',
      callDuration: `${Math.floor(m.callDurationSec / 60)}m ${m.callDurationSec % 60}s`,
      channel: m.channel,
      score: m.score,
      scoreItems: m.scoreItems?.map((s) => ({
        criterio: s.criterion,
        puntajeMax: s.maxScore,
        obtenido: s.obtainedScore,
        cumple: s.complies,
      })),
      agentName: m.agentName,
      teamLeaderName: m.teamLeaderName,
      analystName: m.analystName,
      areaImputable: m.areaImputable,
      categoria1: {
        categoria: m.category1?.categoria,
        motivo: m.category1?.motivo,
        causaRaiz: m.category1?.causaRaiz,
      },
      categoria2: m.hasSecondCategory && m.category2 ? {
        categoria: m.category2?.categoria,
        motivo: m.category2?.motivo,
        causaRaiz: m.category2?.causaRaiz,
      } : null,
      requiresFeedback: m.requiresFeedback,
      status: m.status,
      qaFindings: m.qaFindings ? {
        hallazgoCritico: m.qaFindings.criticalFinding,
        fortalezas: m.qaFindings.strengths,
        oportunidades: m.qaFindings.opportunities,
        prioridad: m.qaFindings.priority,
        fechaAnalisis: m.qaFindings.createdAt,
      } : null,
      tlFeedback: m.tlFeedback ? {
        tipo: m.tlFeedback.feedbackType || 'Feedback TL',
        fechaSesion: m.tlFeedback.feedbackDate,
        observacionesTL: m.tlFeedback.observations,
        planDeAccionTL: m.tlFeedback.actionPlan,
        fechaEnvioTL: m.tlFeedback.submittedAt,
      } : null,
      agentCommitment: m.agentCommitment ? {
        compromisoAgente: m.agentCommitment.commitmentText,
        accionConcreta: m.agentCommitment.actionStep,
        fechaCompromiso: m.agentCommitment.targetCompletionDate,
        fechaFirma: m.agentCommitment.signedAt,
      } : null,
    }));

    // Team summary for TL or Coordinator
    let teamSummary: any = null;
    if (effectiveAiTargetType === 'team_leader') {
      const assignedAdvisors = users.filter((u) => u.role === 'asesor' && u.reportsToId === currentSelectedTarget?.id);
      const advisorsData = assignedAdvisors.map((adv) => {
        const advCalls = currentTargetMonitorings.filter((m) => m.agentId === adv.id);
        const advAvg = advCalls.length > 0 ? advCalls.reduce((sum, c) => sum + c.score, 0) / advCalls.length : 0;
        const pendingTL = advCalls.filter((c) => c.status === 'PENDIENTE_TL').length;
        const pendingAgent = advCalls.filter((c) => c.status === 'PENDIENTE_AGENTE').length;
        const closed = advCalls.filter((c) => c.status === 'CERRADO').length;
        return {
          id: adv.id,
          name: adv.name,
          employeeCode: adv.employeeCode,
          callsCount: advCalls.length,
          avgScore: advAvg,
          pendingTL,
          pendingAgent,
          closedCount: closed,
          isOffender: advAvg < 80 || pendingTL > 1,
        };
      });
      teamSummary = {
        teamLeaderName: currentSelectedTarget?.name,
        advisorsCount: assignedAdvisors.length,
        advisors: advisorsData,
      };
    } else if (effectiveAiTargetType === 'coordinador') {
      const teamLeaders = users.filter((u) => u.role === 'team_leader');
      const tlData = teamLeaders.map((tl) => {
        const tlCalls = monitorings.filter((m) => m.teamLeaderId === tl.id);
        const tlAvg = tlCalls.length > 0 ? tlCalls.reduce((sum, c) => sum + c.score, 0) / tlCalls.length : 0;
        const withFb = tlCalls.filter((c) => c.requiresFeedback).length;
        const closedFb = tlCalls.filter((c) => c.status === 'CERRADO').length;
        const backlogPendingTL = tlCalls.filter((c) => c.status === 'PENDIENTE_TL').length;
        return {
          id: tl.id,
          name: tl.name,
          department: tl.department,
          totalCalls: tlCalls.length,
          avgScore: tlAvg,
          complianceRate: withFb > 0 ? `${((closedFb / withFb) * 100).toFixed(0)}%` : '100%',
          backlogPendingTL,
        };
      });
      teamSummary = {
        coordinationScope: currentSelectedTarget?.name,
        teamLeaders: tlData,
      };
    }

    // Profile metadata
    const targetUserObj = users.find((u) => u.id === currentSelectedTarget?.id);
    const supervisorObj = targetUserObj?.reportsToId ? users.find((u) => u.id === targetUserObj.reportsToId) : null;
    const targetProfile = {
      id: currentSelectedTarget?.id,
      name: currentSelectedTarget?.name,
      role: effectiveAiTargetType,
      code: targetUserObj?.employeeCode || 'N/A',
      department: targetUserObj?.department || 'Operaciones',
      supervisor: supervisorObj ? supervisorObj.name : 'Dirección de Operaciones',
    };

    // Filter relevant audit logs
    const relevantAuditLogs = auditLogs
      .filter(
        (a) =>
          a.targetId === currentSelectedTarget?.id ||
          a.userId === currentSelectedTarget?.id ||
          (effectiveAiTargetType === 'team_leader' && currentTargetMonitorings.some((m) => m.id === a.targetId))
      )
      .slice(0, 10);

    try {
      const res = await fetch('/api/ai/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: effectiveAiTargetType,
          targetName,
          targetProfile,
          statsData: {
            total,
            avgScore,
            withFeedback,
            closedFeedback,
            feedbackRate: withFeedback > 0 ? `${((closedFeedback / withFeedback) * 100).toFixed(0)}%` : '100%',
            topCauses,
            imputableBreakdown: metrics.imputable,
            channels: metrics.channels,
          },
          allRegisteredMonitorings,
          teamSummary,
          auditTrail: relevantAuditLogs,
          customQuestion: aiCustomQuestion.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.advice) {
        setAiAdviceText(data.advice);
        setAiSource(data.source || 'gemini');
      } else {
        setAiAdviceText('No se pudo generar la asesoría en este momento.');
      }
    } catch (err: any) {
      console.error('Error fetching advice:', err);
      setAiAdviceText('Error al conectar con el motor de IA de experiencia. Por favor intenta de nuevo.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCopyAdvice = () => {
    if (!aiAdviceText) return;
    navigator.clipboard.writeText(aiAdviceText);
    setCopiedAdvice(true);
    setTimeout(() => setCopiedAdvice(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Sub-Header Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Sección Reportería & Asesoría IA
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Reportería consolidada multi-nivel (Asesor, Team Leader, Coordinador/Servicio) y consultor inteligente de feedback.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
          {canViewReportsTab && (
            <button
              onClick={() => setActiveSubTab('metricas')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeSubTab === 'metricas'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Métricas & Reportes</span>
            </button>
          )}
          {canUseAiTab && (
            <button
              onClick={() => setActiveSubTab('ia')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeSubTab === 'ia'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Consultor IA (Consejos & Coaching)</span>
            </button>
          )}
        </div>
      </div>

      {/* SUBTAB 1: METRICAS & REPORTES */}
      {activeSubTab === 'metricas' && canViewReportsTab && (
        <div className="space-y-6">
          
          {/* Multi-Level Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Filter className="w-4 h-4 text-slate-500" />
                <span>Filtros de Reportería</span>
              </div>
              {canExport && (
                <button
                  onClick={() => exportMonitoringsToExcel(filteredMonitorings)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Reporte a Excel (.xlsx)</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              {/* Level Selector */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Nivel de Análisis
                </label>
                <SearchableSelect
                  value={currentUser.role === 'asesor' ? 'todos' : levelFilter}
                  onChange={(val) => {
                    setLevelFilter(val as any);
                    setSelectedEntityId('ALL');
                  }}
                  disabled={currentUser.role === 'asesor'}
                  searchPlaceholder="Buscar nivel..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  options={
                    currentUser.role === 'asesor'
                      ? [{ value: 'todos', label: 'Mis Evaluaciones' }]
                      : currentUser.role === 'team_leader'
                      ? [
                          { value: 'todos', label: 'Todo mi Equipo' },
                          { value: 'asesor', label: 'Por Asesor de mi Equipo' },
                        ]
                      : [
                          { value: 'todos', label: 'Toda la Operación (Global)' },
                          { value: 'asesor', label: 'Por Asesor Específico' },
                          { value: 'tl', label: 'Por Team Leader' },
                          { value: 'coordinador', label: 'Nivel Coordinación' },
                        ]
                  }
                />
              </div>

              {/* Specific Entity (Conditional on Level) */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Seleccionar {levelFilter === 'asesor' ? 'Asesor' : levelFilter === 'tl' ? 'Team Leader' : 'Entidad'}
                </label>
                <SearchableSelect
                  value={selectedEntityId}
                  onChange={setSelectedEntityId}
                  disabled={currentUser.role === 'asesor' || levelFilter === 'todos' || levelFilter === 'coordinador'}
                  searchPlaceholder="Buscar persona..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  options={[
                    { value: 'ALL', label: '-- Todos --' },
                    ...(levelFilter === 'asesor'
                      ? users
                          .filter(
                            (u) =>
                              u.role === 'asesor' &&
                              (currentUser.role !== 'team_leader' || u.reportsToId === currentUser.id)
                          )
                          .map((a) => ({
                            value: a.id,
                            label: `${a.name} (${a.employeeCode})`,
                            searchText: a.email,
                          }))
                      : levelFilter === 'tl' && currentUser.role !== 'team_leader'
                      ? users
                          .filter((u) => u.role === 'team_leader')
                          .map((t) => ({
                            value: t.id,
                            label: t.name,
                            searchText: t.email,
                          }))
                      : []),
                  ]}
                />
              </div>

              {/* Canal */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Canal de Atención
                </label>
                <SearchableSelect
                  value={channelFilter}
                  onChange={setChannelFilter}
                  searchPlaceholder="Buscar canal..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  options={[
                    { value: 'ALL', label: 'Todos los Canales' },
                    { value: 'Voz', label: 'Voz' },
                    { value: 'Chat', label: 'Chat' },
                    { value: 'WhatsApp', label: 'WhatsApp' },
                    { value: 'Correo', label: 'Correo' },
                  ]}
                />
              </div>

              {/* Área Imputable */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Área Imputable
                </label>
                <SearchableSelect
                  value={imputableFilter}
                  onChange={setImputableFilter}
                  searchPlaceholder="Buscar área..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  options={[
                    { value: 'ALL', label: 'Todas las Áreas' },
                    { value: 'Asesor', label: 'Asesor' },
                    { value: 'Negocio', label: 'Negocio / Procesos' },
                    { value: 'Cliente', label: 'Cliente' },
                  ]}
                />
              </div>

            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium">Total Evaluaciones</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.total}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Muestra de experiencia</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium">Nota Promedio de Experiencia</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
                {metrics.avgScore.toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Meta: $\ge 85\%$</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium">Ameritan Feedback</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                {metrics.withFeedback}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {metrics.total > 0 ? ((metrics.withFeedback / metrics.total) * 100).toFixed(0) : 0}% de los casos
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium">Ciclos Cerrados</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.closedFeedback}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Feedback + Compromiso</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium">% Cierre de Ciclo</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-indigo-600 mt-1">
                {metrics.feedbackRate}%
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Efectividad de cierre</span>
            </div>
          </div>

          {/* Visual Breakdown Cards (Área Imputable & Top Causas Raíz) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Área Imputable Distribution */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Distribución por Área Imputable
                </h3>
                <p className="text-xs text-slate-500">
                  Distingue fallas atribuibles a la gestión del asesor vs fallas del negocio o políticas.
                </p>
              </div>

              <div className="space-y-3">
                {Object.entries(metrics.imputable).map(([area, count]) => {
                  const pct = metrics.total > 0 ? (count / metrics.total) * 100 : 0;
                  let barColor = 'bg-slate-800';
                  if (area === 'Negocio') barColor = 'bg-purple-600';
                  if (area === 'Cliente') barColor = 'bg-blue-600';
                  return (
                    <div key={area} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-700">{area}</span>
                        <span className="font-mono text-slate-900">
                          {count} casos ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div
                          className={`${barColor} h-2.5 rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 5 Causas Raíz */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Top 5 Causas Raíz Detectadas
                </h3>
                <p className="text-xs text-slate-500">
                  Focos prioritarios de intervención operativa para reducir desviaciones.
                </p>
              </div>

              {metrics.topCausas.length === 0 ? (
                <div className="text-xs text-slate-400 p-4 text-center">
                  No hay causas raíz registradas para el filtro actual.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {metrics.topCausas.map((cr, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="truncate pr-3">
                        <span className="font-semibold text-slate-900 block truncate">{cr.name}</span>
                        <span className="text-[10px] text-slate-500 truncate">{cr.category}</span>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 shrink-0">
                        {cr.count} {cr.count === 1 ? 'vez' : 'veces'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Drill-down Table with Search */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Detalle de Monitoreos Filtrados
                </h3>
                <p className="text-xs text-slate-500">
                  Listado individual con notas, categorización y estado de cierre de ciclo.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar en tabla..."
                  value={searchTable}
                  onChange={(e) => setSearchTable(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Fecha & Canal</th>
                    <th className="py-2.5 px-3">Asesor</th>
                    <th className="py-2.5 px-3">Team Leader</th>
                    <th className="py-2.5 px-3">Categoría & Causa Raíz</th>
                    <th className="py-2.5 px-3 text-center">Score Experiencia</th>
                    <th className="py-2.5 px-3">Imputable</th>
                    <th className="py-2.5 px-3">Estado Ciclo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMonitorings.slice(0, 15).map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{m.ticketNumber}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {m.callDate} · {m.channel}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">{m.agentName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{m.teamLeaderName}</td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-700">
                        {m.category1?.categoria} / {m.category1?.causaRaiz}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums font-bold">
                        {m.score}%
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{m.areaImputable}</td>
                      <td className="py-2.5 px-3 text-[11px]">{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMonitorings.length > 15 && (
                <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-50">
                  Mostrando primeros 15 registros de {filteredMonitorings.length}. Exporta a Excel para la data completa.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* SUBTAB 2: CONSULTOR IA (CONSEJOS & COACHING POR ROL) */}
      {activeSubTab === 'ia' && canUseAiTab && (
        <div className="space-y-6">
          
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-md">
            <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Consultor Especialista en Experiencia & Coaching Contact Center</span>
            </div>
            <h2 className="text-xl font-bold text-white">
              Análisis y Consejos Inteligentes con IA
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1">
              Genera planes de acción personalizados, técnicas de retroalimentación (modelo GROW / Feedback sándwich) y estrategias para disminuir causas raíz recurrentes, adaptadas para Asesores, Team Leaders o Coordinadores.
            </p>
          </div>

          {/* Configuration Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4 text-xs">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Target Type */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  1. Rol a Asesorar *
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  {[
                    { id: 'asesor', label: 'Asesor' },
                    ...(currentUser.role !== 'asesor'
                      ? [{ id: 'team_leader', label: 'Team Leader' }]
                      : []),
                    ...(currentUser.role !== 'asesor' && currentUser.role !== 'team_leader'
                      ? [{ id: 'coordinador', label: 'Coordinador' }]
                      : []),
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setAiTargetType(t.id as any);
                        setAiTargetId('');
                      }}
                      className={`py-1.5 px-2 rounded-md font-semibold text-center transition-colors ${
                        effectiveAiTargetType === t.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Person */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  2. Persona o Equipo Específico *
                </label>
                <SearchableSelect
                  value={currentSelectedTarget?.id || aiTargetId}
                  onChange={setAiTargetId}
                  disabled={currentUser.role === 'asesor'}
                  searchPlaceholder="Buscar persona o equipo..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  options={[
                    ...(currentUser.role === 'asesor'
                      ? []
                      : [
                          {
                            value: '',
                            label:
                              effectiveAiTargetType === 'asesor'
                                ? '-- Seleccionar Asesor --'
                                : effectiveAiTargetType === 'team_leader'
                                ? '-- Seleccionar Team Leader --'
                                : '-- Toda la Operación --',
                          },
                        ]),
                    ...targetOptions.map((opt) => ({
                      value: opt.id,
                      label: opt.name,
                      searchText: 'email' in opt ? opt.email : '',
                    })),
                  ]}
                />
              </div>

              {/* Action Button */}
              <div className="flex items-end">
                <button
                  onClick={handleGenerateAdvice}
                  disabled={isAiLoading || currentTargetMonitorings.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs disabled:opacity-50"
                >
                  {isAiLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Auditando {currentTargetMonitorings.length} registros con IA...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      <span>Generar Asesoría Exhaustiva</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Live Data Scope Banner */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>Base Registrada en la Herramienta para Análisis:</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                      100% Histórico
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Entidad seleccionada: <strong className="text-slate-800">{currentSelectedTarget?.name || 'Operación General'}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium text-[11px] shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <strong>{currentTargetMonitorings.length}</strong> Monitoreos
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium text-[11px] shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <strong>{currentTargetMonitorings.filter((m) => m.requiresFeedback).length}</strong> Con Feedback
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium text-[11px] shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <strong>{currentTargetMonitorings.filter((m) => m.status === 'CERRADO').length}</strong> Compromisos Cerrados
                </span>
              </div>
            </div>

            {/* Custom Question / Focus Area */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Pregunta o Enfoque Específico para la IA (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: ¿Cómo abordar la reincidencia en información tarifaria sin desmotivar al asesor? o Estrategias para FCR en chat..."
                value={aiCustomQuestion}
                onChange={(e) => setAiCustomQuestion(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white"
              />
            </div>

          </div>

          {/* AI Result Card */}
          {aiAdviceText && (
            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4 animate-in fade-in duration-200">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Informe Consultivo & Plan de Coaching
                    </h3>
                    <span className="text-[10px] text-slate-500">
                      Motor: {aiSource === 'gemini' ? 'Gemini 3.8 Flash (Server-Side)' : 'Motor Heurístico Local'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCopyAdvice}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                >
                  {copiedAdvice ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAdvice ? 'Copiado' : 'Copiar Texto'}</span>
                </button>
              </div>

              {/* Scope badge */}
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-lg text-[11px] text-indigo-950 font-medium">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Diagnóstico y Plan de Acción generado a partir de la totalidad de registros: <strong>{currentTargetMonitorings.length} monitoreos</strong>, retroalimentaciones de Team Leader y compromisos firmados para <strong>{currentSelectedTarget?.name}</strong>.
                </span>
              </div>

              {/* Rendered Advice Content */}
              <div className="prose prose-slate max-w-none text-xs text-slate-800 leading-relaxed space-y-2 whitespace-pre-line bg-slate-50/50 p-5 rounded-xl border border-slate-100 font-sans">
                {aiAdviceText}
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
