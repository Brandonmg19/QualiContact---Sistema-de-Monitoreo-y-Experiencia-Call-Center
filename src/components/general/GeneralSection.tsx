import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MonitoringItem, MonitoringStatus } from '../../types';
import { 
  Inbox, 
  BarChart2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Calendar, 
  Phone, 
  MessageSquare, 
  FileText, 
  UserCheck, 
  Send, 
  ArrowRight, 
  Check, 
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Award,
  ChevronRight,
  Shield,
  Layers,
  RotateCcw
} from 'lucide-react';

export const GeneralSection: React.FC = () => {
  const { 
    currentUser, 
    monitorings, 
    submitTLFeedback, 
    submitAgentCommitment,
    refuteMonitoring,
    activeSubSection,
    setActiveSubSection,
    hasPermission,
    canAccessSubSection,
  } = useApp();

  const canViewInboxTab = canAccessSubSection('general', 'bandeja');
  const canViewDashboardTab = canAccessSubSection('general', 'dashboard');
  const activeTab = (
    activeSubSection === 'dashboard' && canViewDashboardTab
      ? 'dashboard'
      : canViewInboxTab
      ? 'bandeja'
      : 'dashboard'
  ) as 'bandeja' | 'dashboard';
  const setActiveTab = (tab: 'bandeja' | 'dashboard') => setActiveSubSection(tab);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMonitoring, setSelectedMonitoring] = useState<MonitoringItem | null>(null);

  const getCurrentDateTimeString = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  // TL Feedback Form State (Fecha/hora automática)
  const [feedbackDate, setFeedbackDate] = useState<string>(() => getCurrentDateTimeString());
  const [tlObservations, setTlObservations] = useState<string>('');
  const [tlActionPlan, setTlActionPlan] = useState<string>('');
  const [tlSubmitSuccess, setTlSubmitSuccess] = useState<boolean>(false);

  // Live clock for automatic feedback session date & time while TL form is open
  useEffect(() => {
    if (!selectedMonitoring || !selectedMonitoring.requiresFeedback || selectedMonitoring.tlFeedback) {
      return;
    }
    setFeedbackDate(getCurrentDateTimeString());
    const timer = setInterval(() => {
      setFeedbackDate(getCurrentDateTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedMonitoring]);

  // Agent Commitment Form State
  const [agentCommitmentText, setAgentCommitmentText] = useState<string>('');
  const [agentActionStep, setAgentActionStep] = useState<string>('');
  const [agentTargetDate, setAgentTargetDate] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10)
  );
  const [agentAcceptedTerms, setAgentAcceptedTerms] = useState<boolean>(false);
  const [cycleClosedSuccess, setCycleClosedSuccess] = useState<boolean>(false);

  // Refutation State (for TL and Asesor)
  const [isRefuting, setIsRefuting] = useState<boolean>(false);
  const [refutationReason, setRefutationReason] = useState<string>('');
  const [refuteSuccess, setRefuteSuccess] = useState<boolean>(false);

  // Filter monitorings according to current user's role and search criteria
  const userRelevantMonitorings = useMemo(() => {
    return monitorings.filter((m) => {
      // Role scoping
      if (currentUser.role === 'asesor') {
        if (m.agentId !== currentUser.id) return false;
      } else if (currentUser.role === 'team_leader') {
        if (m.teamLeaderId !== currentUser.id) return false;
      }
      // Coordinador, Analista and Admin can see all

      // Status filter
      if (statusFilter !== 'ALL' && m.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTicket = m.ticketNumber.toLowerCase().includes(query);
        const matchesClient = m.customerIdentifier.toLowerCase().includes(query);
        const matchesAgent = m.agentName.toLowerCase().includes(query);
        const matchesCategory = m.category1?.categoria.toLowerCase().includes(query) ||
          m.category1?.motivo.toLowerCase().includes(query) ||
          m.category1?.causaRaiz.toLowerCase().includes(query);
        if (!matchesTicket && !matchesClient && !matchesAgent && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [monitorings, currentUser, statusFilter, searchQuery]);

  // Statistics for Dashboard based on role
  const dashboardStats = useMemo(() => {
    let scoped = monitorings;
    if (currentUser.role === 'asesor') {
      scoped = monitorings.filter((m) => m.agentId === currentUser.id);
    } else if (currentUser.role === 'team_leader') {
      scoped = monitorings.filter((m) => m.teamLeaderId === currentUser.id);
    }

    const total = scoped.length;
    const pendingTL = scoped.filter((m) => m.status === 'PENDIENTE_TL').length;
    const pendingAgent = scoped.filter((m) => m.status === 'PENDIENTE_AGENTE').length;
    const closed = scoped.filter((m) => m.status === 'CERRADO').length;
    const noFeedback = scoped.filter((m) => m.status === 'CONFORME_SIN_FEEDBACK').length;

    const avgScore = total > 0 ? scoped.reduce((acc, m) => acc + m.score, 0) / total : 0;

    // Causes frequency
    const causeCounts: Record<string, { count: number; name: string; category: string }> = {};
    scoped.forEach((m) => {
      if (m.category1?.causaRaiz) {
        const key = m.category1.causaRaiz;
        if (!causeCounts[key]) {
          causeCounts[key] = { count: 0, name: key, category: m.category1.categoria };
        }
        causeCounts[key].count += 1;
      }
    });

    const topCauses = Object.values(causeCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Agent breakdown (for TL / Coord)
    const agentScores: Record<string, { name: string; count: number; totalScore: number; criticalCount: number; recurrentCauses: Record<string, number> }> = {};
    scoped.forEach((m) => {
      if (!agentScores[m.agentId]) {
        agentScores[m.agentId] = {
          name: m.agentName,
          count: 0,
          totalScore: 0,
          criticalCount: 0,
          recurrentCauses: {},
        };
      }
      agentScores[m.agentId].count += 1;
      agentScores[m.agentId].totalScore += m.score;
      if (m.requiresFeedback && m.score < 75) {
        agentScores[m.agentId].criticalCount += 1;
      }
      const cr = m.category1?.causaRaiz;
      if (cr) {
        agentScores[m.agentId].recurrentCauses[cr] = (agentScores[m.agentId].recurrentCauses[cr] || 0) + 1;
      }
    });

    const rankedAgents = Object.values(agentScores).map((a) => {
      const avg = a.count > 0 ? a.totalScore / a.count : 0;
      const topRecurrent = Object.entries(a.recurrentCauses).sort((x, y) => y[1] - x[1])[0];
      return {
        ...a,
        avgScore: avg,
        recurrentCauseName: topRecurrent && topRecurrent[1] > 1 ? topRecurrent[0] : null,
        recurrentCauseCount: topRecurrent && topRecurrent[1] > 1 ? topRecurrent[1] : 0,
      };
    });

    // Ofensores: lower average score or high critical count
    const ofensores = [...rankedAgents].sort((a, b) => a.avgScore - b.avgScore).slice(0, 4);

    // Recurrentes: agents with same cause repeated >= 2 times
    const recurrentes = rankedAgents.filter((a) => a.recurrentCauseCount >= 2);

    // TL comparisons (for Coordinator)
    const tlBreakdown: Record<string, { name: string; total: number; closed: number; pending: number; avgScore: number; totalScore: number }> = {};
    monitorings.forEach((m) => {
      if (!tlBreakdown[m.teamLeaderId]) {
        tlBreakdown[m.teamLeaderId] = {
          name: m.teamLeaderName,
          total: 0,
          closed: 0,
          pending: 0,
          avgScore: 0,
          totalScore: 0,
        };
      }
      tlBreakdown[m.teamLeaderId].total += 1;
      tlBreakdown[m.teamLeaderId].totalScore += m.score;
      if (m.status === 'CERRADO') tlBreakdown[m.teamLeaderId].closed += 1;
      if (m.status === 'PENDIENTE_TL') tlBreakdown[m.teamLeaderId].pending += 1;
    });

    Object.values(tlBreakdown).forEach((tl) => {
      tl.avgScore = tl.total > 0 ? tl.totalScore / tl.total : 0;
    });

    return {
      total,
      pendingTL,
      pendingAgent,
      closed,
      noFeedback,
      avgScore,
      topCauses,
      ofensores,
      recurrentes,
      tlBreakdown: Object.values(tlBreakdown),
      scoped,
    };
  }, [monitorings, currentUser]);

  const handleOpenMonitoring = (item: MonitoringItem) => {
    setSelectedMonitoring(item);
    setFeedbackDate(getCurrentDateTimeString());
    setTlObservations(item.tlFeedback?.observations || '');
    setTlActionPlan(item.tlFeedback?.actionPlan || '');
    setAgentCommitmentText(item.agentCommitment?.commitmentText || '');
    setAgentActionStep(item.agentCommitment?.actionStep || '');
    setAgentAcceptedTerms(item.agentCommitment?.signatureConfirmed || false);
    setTlSubmitSuccess(false);
    setCycleClosedSuccess(false);
    setIsRefuting(false);
    setRefutationReason('');
    setRefuteSuccess(false);
  };

  const handleSaveTLFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMonitoring) return;
    if (!tlObservations.trim() || !tlActionPlan.trim()) {
      alert('Por favor complete las observaciones y el plan de acción del feedback.');
      return;
    }

    const sessionTimestamp = getCurrentDateTimeString();
    setFeedbackDate(sessionTimestamp);

    submitTLFeedback(selectedMonitoring.id, {
      feedbackDate: sessionTimestamp,
      observations: tlObservations,
      actionPlan: tlActionPlan,
    });

    setTlSubmitSuccess(true);
    setTimeout(() => {
      setSelectedMonitoring(null);
      setTlSubmitSuccess(false);
    }, 1500);
  };

  const handleSaveAgentCommitment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMonitoring) return;
    if (!agentCommitmentText.trim() || !agentActionStep.trim()) {
      alert('Por favor complete su compromiso de mejora y el paso de acción específico.');
      return;
    }
    if (!agentAcceptedTerms) {
      alert('Debe marcar la casilla de confirmación para firmar su compromiso.');
      return;
    }

    submitAgentCommitment(selectedMonitoring.id, {
      commitmentText: agentCommitmentText,
      actionStep: agentActionStep,
      targetCompletionDate: agentTargetDate,
    });

    setCycleClosedSuccess(true);
    setTimeout(() => {
      setSelectedMonitoring(null);
      setCycleClosedSuccess(false);
    }, 1500);
  };

  const handleConfirmRefutation = (e: React.FormEvent, role: 'team_leader' | 'asesor') => {
    e.preventDefault();
    if (!selectedMonitoring) return;
    if (!refutationReason.trim()) {
      alert('Por favor ingresa el motivo o argumento de la refutación para que el Analista pueda revisarlo.');
      return;
    }

    refuteMonitoring(selectedMonitoring.id, refutationReason, role);
    setRefuteSuccess(true);
    setTimeout(() => {
      setSelectedMonitoring(null);
      setRefuteSuccess(false);
      setIsRefuting(false);
      setRefutationReason('');
    }, 1500);
  };

  const getStatusBadge = (status: MonitoringStatus) => {
    switch (status) {
      case 'PENDIENTE_TL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Pendiente TL
          </span>
        );
      case 'PENDIENTE_AGENTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-800 border border-blue-200">
            <UserCheck className="w-3 h-3 text-blue-600" />
            Pendiente Asesor
          </span>
        );
      case 'REFUTADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-rose-50 text-rose-800 border border-rose-200">
            <RotateCcw className="w-3 h-3 text-rose-600" />
            Refutado · Revisión Analista
          </span>
        );
      case 'CERRADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Ciclo Cerrado
          </span>
        );
      case 'CONFORME_SIN_FEEDBACK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-50 text-slate-700 border border-slate-200">
            <Check className="w-3 h-3 text-slate-500" />
            Conforme / Sin Feedback
          </span>
        );
    }
  };

  const getSurveyScoreBadge = (surveyScore?: number) => {
    if (surveyScore === undefined || surveyScore === null) {
      return (
        <span className="font-mono tabular-nums text-xs font-medium px-2 py-0.5 rounded border text-slate-500 bg-slate-50 border-slate-200">
          Sin nota
        </span>
      );
    }
    let color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (surveyScore <= 6) {
      color = 'text-rose-700 bg-rose-50 border-rose-200';
    } else if (surveyScore <= 8) {
      color = 'text-amber-700 bg-amber-50 border-amber-200';
    }
    return (
      <span className={`font-mono tabular-nums text-xs font-bold px-2 py-0.5 rounded border ${color}`}>
        {surveyScore} / 10
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Sub-Header Tabs & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Sección General
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Bandeja operativa de monitoreos asignados y dashboard de gestión según tu perfil activo ({currentUser.name} - <span className="capitalize">{currentUser.role.replace('_', ' ')}</span>).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
          {canViewInboxTab && (
            <button
              onClick={() => setActiveTab('bandeja')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'bandeja'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Bandeja de Monitoreos</span>
              <span className="font-mono tabular-nums text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full border border-slate-200">
                {userRelevantMonitorings.length}
              </span>
            </button>
          )}
          {canViewDashboardTab && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Dashboard por Perfil</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: BANDEJA DE MONITOREOS ASIGNADOS */}
      {activeTab === 'bandeja' && (
        <div className="space-y-4">
          
          {/* Action / Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            {/* Search */}
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por Ticket, teléfono, asesor, categoría o causa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Status Filter */}
            <div className="md:col-span-6 flex items-center gap-2 justify-start md:justify-end overflow-x-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
                {[
                  { id: 'ALL', label: 'Todos' },
                  { id: 'PENDIENTE_TL', label: 'Pendiente TL' },
                  { id: 'PENDIENTE_AGENTE', label: 'Pendiente Asesor' },
                  { id: 'REFUTADO', label: 'Refutados' },
                  { id: 'CERRADO', label: 'Cerrados' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStatusFilter(s.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                      statusFilter === s.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List of Monitorings */}
          {userRelevantMonitorings.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">No se encontraron monitoreos</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                No hay registros con los filtros seleccionados o tu usuario no tiene monitoreos asignados pendientes.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-medium">
                    <tr>
                      <th className="py-3 px-4">Ticket / Cliente</th>
                      <th className="py-3 px-4">Canal & Fecha</th>
                      <th className="py-3 px-4">Asesor & TL</th>
                      <th className="py-3 px-4">Categoría & Causa Raíz</th>
                      <th className="py-3 px-4 text-center">Nota NPS</th>
                      <th className="py-3 px-4">Estado del Ciclo</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {userRelevantMonitorings.map((m) => {
                      const isPendingTLForMe = currentUser.role === 'team_leader' && m.status === 'PENDIENTE_TL';
                      const isPendingAgentForMe = currentUser.role === 'asesor' && m.status === 'PENDIENTE_AGENTE';
                      const isUrgent = isPendingTLForMe || isPendingAgentForMe;

                      return (
                        <tr
                          key={m.id}
                          onClick={() => handleOpenMonitoring(m)}
                          className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                            isUrgent ? 'bg-amber-50/30 font-medium' : ''
                          }`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{m.ticketNumber}</span>
                              {m.requiresFeedback && (
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Amerita Feedback" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{m.customerIdentifier}</div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              {m.channel === 'Voz' ? (
                                <Phone className="w-3.5 h-3.5 text-indigo-500" />
                              ) : (
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                              <span>{m.channel}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                              {m.callDate} ({Math.floor(m.callDurationSec / 60)}m {m.callDurationSec % 60}s)
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="text-slate-900 font-medium">{m.agentName}</div>
                            <div className="text-[11px] text-slate-400">TL: {m.teamLeaderName}</div>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="text-slate-800 font-medium truncate">
                              {m.category1?.categoria} / {m.category1?.motivo}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate" title={m.category1?.causaRaiz}>
                              Causa: {m.category1?.causaRaiz}
                            </div>
                            {m.hasSecondCategory && m.category2 && (
                              <div className="text-[10px] text-slate-400 italic truncate">
                                + 2ª: {m.category2.motivo}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {getSurveyScoreBadge(m.surveyScore)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {getStatusBadge(m.status)}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMonitoring(m);
                              }}
                              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                isUrgent
                                  ? 'bg-slate-900 text-white font-medium hover:bg-slate-800 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              {isPendingTLForMe
                                ? 'Realizar Feedback'
                                : isPendingAgentForMe
                                ? 'Cargar Compromiso'
                                : 'Ver Detalle'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: DASHBOARD POR PERFIL */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">

          {/* Role Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Dashboard de Rendimiento Operativo
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-medium">
                  {currentUser.role.toUpperCase()}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                {currentUser.name} - {currentUser.department}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentUser.role === 'asesor' && 'Tus llamadas evaluadas, evolución de nota de experiencia y motivos principales.'}
                {currentUser.role === 'team_leader' && 'Control de tu equipo de asesores, asesores con desvíos, reincidentes y estado de feedback.'}
                {currentUser.role === 'coordinador' && 'Comparativo de desempeño entre Team Leaders, cumplimiento de SLAs y diagnóstico global.'}
                {(currentUser.role === 'analista' || currentUser.role === 'admin') && 'Vista consolidada de monitoreos, cobertura de experiencia y cierre del ciclo.'}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-2.5 rounded-lg shrink-0">
              <div className="text-center">
                <div className="text-[10px] text-slate-400 uppercase font-medium">Score Promedio</div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">
                  {dashboardStats.avgScore.toFixed(1)}%
                </div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-[10px] text-slate-400 uppercase font-medium">Casos Evaluados</div>
                <div className="text-xl font-bold font-mono tabular-nums text-white">
                  {dashboardStats.total}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Pendiente Feedback TL</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {dashboardStats.pendingTL}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Esperando sesión de TL
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Pendiente Asesor</span>
                <UserCheck className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {dashboardStats.pendingAgent}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Por registrar compromiso
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Ciclos Cerrados</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-2">
                {dashboardStats.closed}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Feedback + Compromiso firmado
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Conforme Directo</span>
                <Award className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                {dashboardStats.noFeedback}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Atención sin desvíos
              </span>
            </div>
          </div>

          {/* DYNAMIC VIEW FOR AGENT PROFILE */}
          {currentUser.role === 'asesor' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly & Time Breakdown */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Resumen de Evaluaciones (Día / Semana / Mes)
                  </h3>
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500">Hoy / Ayer</span>
                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">2</p>
                    <span className="text-[10px] text-slate-400">monitoreos</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500">Esta Semana</span>
                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">4</p>
                    <span className="text-[10px] text-slate-400">monitoreos</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500">Mes Actual</span>
                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {dashboardStats.total}
                    </p>
                    <span className="text-[10px] text-slate-400">monitoreos</span>
                  </div>
                </div>

                {/* Monthly Comparative */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-800 mb-2">Comparativo Mensual de Experiencia</div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">Mes Anterior (Octubre)</span>
                        <span className="font-mono font-medium text-slate-700">79.5%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-slate-400 h-2 rounded-full" style={{ width: '79.5%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-900 font-medium">Mes Actual (Noviembre)</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {dashboardStats.avgScore.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(dashboardStats.avgScore, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Causes of Error for this Agent */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Tus Principales Oportunidades (Causas Raíz)
                </h3>
                {dashboardStats.topCauses.length === 0 ? (
                  <p className="text-xs text-slate-500">No se registran causas de error en tus llamadas.</p>
                ) : (
                  <div className="space-y-3">
                    {dashboardStats.topCauses.map((tc, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-medium text-slate-900 block">{tc.name}</span>
                            <span className="text-[11px] text-slate-500">{tc.category}</span>
                          </div>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                            {tc.count} {tc.count === 1 ? 'caso' : 'casos'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DYNAMIC VIEW FOR TEAM LEADER PROFILE */}
          {(currentUser.role === 'team_leader' || currentUser.role === 'admin' || currentUser.role === 'analista') && hasPermission('canViewTeamDashboard') && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Asesores Ofensores (Mayor cantidad de fallas o menor score) */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Asesores con Desvíos de Experiencia
                      </h3>
                      <p className="text-xs text-slate-500">Asesores con menor promedio o incidencias críticas que requieren coaching.</p>
                    </div>
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  </div>

                  <div className="space-y-2.5">
                    {dashboardStats.ofensores.map((ag, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{ag.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {ag.count} llamadas evaluadas · {ag.criticalCount} con hallazgo crítico
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono text-xs font-bold px-2 py-0.5 rounded border inline-block ${
                            ag.avgScore < 75 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {ag.avgScore.toFixed(1)}%
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Nota Promedio</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Asesores Recurrentes (Reincidencia en la misma Causa Raíz) */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Asesores con Fallas Recurrentes
                      </h3>
                      <p className="text-xs text-slate-500">Agentes que presentan repetición de la misma causa raíz de error.</p>
                    </div>
                    <RotateCcw className="w-4 h-4 text-amber-500 shrink-0" />
                  </div>

                  {dashboardStats.recurrentes.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      No hay reincidencias críticas repetidas en el periodo.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {dashboardStats.recurrentes.map((rec, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/60"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{rec.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              {rec.recurrentCauseCount} veces repetida
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 font-medium mt-1">
                            Causa: "{rec.recurrentCauseName}"
                          </p>
                          <span className="text-[11px] text-slate-500 mt-1 block">
                            Requiere calibración inmediata y plan de acción correctivo.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* DYNAMIC VIEW FOR COORDINATOR / ADMIN PROFILE */}
          {(currentUser.role === 'coordinador' || currentUser.role === 'admin' || currentUser.role === 'analista') && hasPermission('canViewExecutiveDashboard') && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Estadísticas Comparativas por Team Leader
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cumplimiento del ciclo de feedback y rendimiento promedio por equipo.
                  </p>
                </div>
                <Layers className="w-4 h-4 text-purple-500" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Team Leader</th>
                      <th className="py-2.5 px-3 text-center">Monitoreos Totales</th>
                      <th className="py-2.5 px-3 text-center">Pendientes TL</th>
                      <th className="py-2.5 px-3 text-center">Ciclos Cerrados</th>
                      <th className="py-2.5 px-3 text-center">Score Equipo</th>
                      <th className="py-2.5 px-3 text-right">% Cumplimiento SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboardStats.tlBreakdown.map((tl, i) => {
                      const compliance = tl.total > 0 ? ((tl.total - tl.pending) / tl.total) * 100 : 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3 font-semibold text-slate-900">{tl.name}</td>
                          <td className="py-3 px-3 text-center font-mono tabular-nums">{tl.total}</td>
                          <td className="py-3 px-3 text-center font-mono tabular-nums text-amber-700">
                            {tl.pending}
                          </td>
                          <td className="py-3 px-3 text-center font-mono tabular-nums text-emerald-700 font-semibold">
                            {tl.closed}
                          </td>
                          <td className="py-3 px-3 text-center font-mono tabular-nums font-bold">
                            {tl.avgScore.toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-mono font-bold text-xs text-slate-800">
                              {compliance.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* DETAIL & ACTION MODAL / DRAWER */}
      {selectedMonitoring && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header (Sticky: Solo Código Único de Monitoreo + Estado) */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-white sticky top-0 z-10 font-sans">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 block">
                  Código Único de Monitoreo
                </span>
                <h3 className="font-bold text-base text-slate-900 font-sans leading-tight">
                  {selectedMonitoring.id.replace(/^mon-/i, 'MON-')}
                </h3>
                <div className="pt-0.5">
                  {getStatusBadge(selectedMonitoring.status)}
                </div>
              </div>

              <button
                onClick={() => setSelectedMonitoring(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 font-sans">

              {/* Datos Iniciales Destacados: ID / LÍNEA, FECHA ENCUESTA, CANAL, SEGMENTO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="bg-white px-3.5 py-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">
                    ID / Línea
                  </span>
                  <span className="text-sm font-semibold text-slate-900 mt-0.5 block break-all">
                    {selectedMonitoring.chatId
                      ? `${selectedMonitoring.chatId} / ${selectedMonitoring.customerIdentifier}`
                      : selectedMonitoring.ticketNumber && selectedMonitoring.ticketNumber !== selectedMonitoring.id
                      ? `${selectedMonitoring.ticketNumber} / ${selectedMonitoring.customerIdentifier}`
                      : selectedMonitoring.customerIdentifier}
                  </span>
                </div>

                <div className="bg-white px-3.5 py-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">
                    Fecha Encuesta
                  </span>
                  <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                    {selectedMonitoring.callDate}
                  </span>
                </div>

                <div className="bg-white px-3.5 py-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">
                    Canal
                  </span>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 mt-0.5">
                    {selectedMonitoring.channel === 'Voz' ? (
                      <Phone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span>{selectedMonitoring.channel}</span>
                  </div>
                </div>

                <div className="bg-white px-3.5 py-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">
                    Segmento
                  </span>
                  <div className="mt-0.5">
                    {selectedMonitoring.segment ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-sm font-semibold border ${
                        selectedMonitoring.segment === 'B2B'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : 'bg-teal-50 text-teal-800 border-teal-200'
                      }`}>
                        {selectedMonitoring.segment}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-slate-800">
                        {selectedMonitoring.clasificacionEmpresas || 'General'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Closed-Loop Stepper */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Ciclo de Experiencia y Feedback
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-sm">
                  
                  {/* Step 1 */}
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                    <span className="font-semibold block text-xs sm:text-sm">1. Carga Experiencia</span>
                    <span className="text-xs text-emerald-700 block mt-0.5">{selectedMonitoring.analystName}</span>
                  </div>

                  {/* Step 2 */}
                  <div className={`p-2.5 rounded-lg border ${
                    selectedMonitoring.status === 'REFUTADO' && !selectedMonitoring.tlFeedback
                      ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-300/60'
                      : selectedMonitoring.status !== 'PENDIENTE_TL' && selectedMonitoring.status !== 'REFUTADO'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : selectedMonitoring.status === 'REFUTADO'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-400/50'
                  }`}>
                    {selectedMonitoring.status === 'REFUTADO' ? (
                      <RotateCcw className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                    ) : selectedMonitoring.status !== 'PENDIENTE_TL' ? (
                      <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                    ) : (
                      <Clock className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                    )}
                    <span className="font-semibold block text-xs sm:text-sm">2. Feedback TL</span>
                    <span className="text-xs block mt-0.5">
                      {selectedMonitoring.status === 'REFUTADO'
                        ? 'Refutado · Analista'
                        : selectedMonitoring.tlFeedback
                        ? 'Completado'
                        : 'Pendiente'}
                    </span>
                  </div>

                  {/* Step 3 */}
                  <div className={`p-2.5 rounded-lg border ${
                    selectedMonitoring.status === 'CERRADO' || selectedMonitoring.status === 'CONFORME_SIN_FEEDBACK'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : selectedMonitoring.status === 'PENDIENTE_AGENTE'
                      ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-400/50'
                      : selectedMonitoring.status === 'REFUTADO'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    {selectedMonitoring.status === 'CERRADO' ? (
                      <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                    ) : selectedMonitoring.status === 'REFUTADO' ? (
                      <RotateCcw className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                    ) : (
                      <UserCheck className="w-4 h-4 mx-auto mb-1" />
                    )}
                    <span className="font-semibold block text-xs sm:text-sm">3. Compromiso</span>
                    <span className="text-xs block mt-0.5">
                      {selectedMonitoring.status === 'REFUTADO'
                        ? 'En Revisión'
                        : selectedMonitoring.agentCommitment
                        ? 'Firmado'
                        : 'Por Agente'}
                    </span>
                  </div>

                  {/* Step 4 */}
                  <div className={`p-2.5 rounded-lg border ${
                    selectedMonitoring.status === 'CERRADO' || selectedMonitoring.status === 'CONFORME_SIN_FEEDBACK'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : selectedMonitoring.status === 'REFUTADO'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    <Check className="w-4 h-4 mx-auto mb-1" />
                    <span className="font-semibold block text-xs sm:text-sm">4. Ciclo Cerrado</span>
                    <span className="text-xs block mt-0.5">
                      {selectedMonitoring.status === 'CERRADO'
                        ? 'Finalizado'
                        : selectedMonitoring.status === 'REFUTADO'
                        ? 'Refutado'
                        : 'En Proceso'}
                    </span>
                  </div>

                </div>
              </div>

              {/* Monitoring General Information Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200 text-sm">
                <div>
                  <span className="text-slate-500 text-xs block">Asesor Evaluado</span>
                  <span className="font-semibold text-slate-900">{selectedMonitoring.agentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Team Leader</span>
                  <span className="font-semibold text-slate-900">{selectedMonitoring.teamLeaderName}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Analista de Experiencia</span>
                  <span className="font-semibold text-slate-900">{selectedMonitoring.analystName}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Nota NPS</span>
                  <div className="mt-1">
                    {getSurveyScoreBadge(selectedMonitoring.surveyScore)}
                  </div>
                </div>
                {selectedMonitoring.contactReason && (
                  <div>
                    <span className="text-slate-500 text-xs block">Motivo de Contacto</span>
                    <span className="font-semibold text-blue-700">{selectedMonitoring.contactReason}</span>
                  </div>
                )}
                {(selectedMonitoring.clasificacionEmpresas || selectedMonitoring.inboxName) && (
                  <div>
                    <span className="text-slate-500 text-xs block">Clasificación Empresas</span>
                    <span className="font-semibold text-slate-900">
                      {selectedMonitoring.clasificacionEmpresas || selectedMonitoring.inboxName}
                    </span>
                  </div>
                )}
                {selectedMonitoring.csat && (
                  <div>
                    <span className="text-slate-500 text-xs block">Satisfacción (CSAT)</span>
                    <span className="font-semibold text-slate-900">{selectedMonitoring.csat}</span>
                  </div>
                )}
                {selectedMonitoring.fcr && (
                  <div>
                    <span className="text-slate-500 text-xs block">FCR</span>
                    <span className="font-semibold text-slate-900">{selectedMonitoring.fcr}</span>
                  </div>
                )}
                {selectedMonitoring.effort && (
                  <div>
                    <span className="text-slate-500 text-xs block">Effort (Esfuerzo)</span>
                    <span className="font-semibold text-slate-900">{selectedMonitoring.effort}</span>
                  </div>
                )}
                {selectedMonitoring.asesorPersonalizado && (
                  <div>
                    <span className="text-slate-500 text-xs block">Asesor Personalizado</span>
                    <span className="font-semibold text-slate-900">{selectedMonitoring.asesorPersonalizado}</span>
                  </div>
                )}
              </div>

              {/* Categorizaciones Anidadas */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 text-sm">
                <div className="text-sm font-semibold text-slate-900">
                  Categorización 1:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block">Categoría (N1)</span>
                    <span className="font-medium text-slate-900 text-sm">{selectedMonitoring.category1?.categoria}</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block">Motivo (N2)</span>
                    <span className="font-medium text-slate-900 text-sm">{selectedMonitoring.category1?.motivo}</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block">Causa Raíz (N3)</span>
                    <span className="font-medium text-slate-900 text-sm">{selectedMonitoring.category1?.causaRaiz}</span>
                  </div>
                </div>

                {selectedMonitoring.hasSecondCategory && selectedMonitoring.category2 && (
                  <div className="pt-3 border-t border-slate-200 mt-2">
                    <div className="text-sm font-semibold text-slate-900 mb-2">
                      Segunda Categorización:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-xs text-slate-500 block">Categoría 2</span>
                        <span className="font-medium text-slate-900 text-sm">{selectedMonitoring.category2.categoria}</span>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-xs text-slate-500 block">Motivo 2</span>
                        <span className="font-medium text-slate-900 text-sm">{selectedMonitoring.category2.motivo}</span>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-xs text-slate-500 block">Causa Raíz 2</span>
                        <span className="font-medium text-slate-900 text-sm">{selectedMonitoring.category2.causaRaiz}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Hallazgos del Analista */}
              {selectedMonitoring.qaFindings && (
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">
                      Hallazgos del Analista
                    </h4>
                    <span className="text-xs px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      Prioridad: {selectedMonitoring.qaFindings.priority}
                    </span>
                  </div>
                  <div className="text-sm text-slate-800 bg-slate-50 p-3.5 rounded-lg border border-slate-100 leading-relaxed">
                    <span className="font-semibold text-rose-700 block mb-1">Hallazgo Crítico:</span>
                    {selectedMonitoring.qaFindings.criticalFinding}
                  </div>
                  {selectedMonitoring.qaFindings.strengths && (
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold text-emerald-700">Fortalezas: </span>
                      {selectedMonitoring.qaFindings.strengths}
                    </div>
                  )}
                  {selectedMonitoring.qaFindings.opportunities && (
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold text-amber-700">Oportunidades de Mejora: </span>
                      {selectedMonitoring.qaFindings.opportunities}
                    </div>
                  )}
                </div>
              )}

              {/* Historial de Refutaciones (si aplica) */}
              {selectedMonitoring.refutations && selectedMonitoring.refutations.length > 0 && (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-rose-600" />
                      <h4 className="text-sm font-bold text-rose-950">
                        {selectedMonitoring.status === 'REFUTADO'
                          ? 'Monitoreo Refutado · En Revisión del Analista'
                          : 'Historial de Refutación y Calibración'}
                      </h4>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                      {selectedMonitoring.refutations.length}{' '}
                      {selectedMonitoring.refutations.length === 1 ? 'refutación' : 'refutaciones'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedMonitoring.refutations.map((ref, idx) => (
                      <div key={idx} className="bg-white p-3.5 rounded-lg border border-rose-200 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500">
                          <span className="font-semibold text-rose-800">
                            Refutado por {ref.refutedByRole === 'team_leader' ? 'Team Leader' : 'Asesor'}: {ref.refutedByName}
                          </span>
                          <span>{ref.refutedAt}</span>
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed">
                          "{ref.reason}"
                        </p>
                      </div>
                    ))}
                  </div>

                  {selectedMonitoring.status === 'REFUTADO' && (
                    <p className="text-xs text-rose-800 font-medium">
                      Este monitoreo fue devuelto a la Bandeja de Pendientes del Analista de Experiencia para ser revisado nuevamente.
                    </p>
                  )}
                </div>
              )}

              {/* SECTION: TEAM LEADER FEEDBACK (VIEW OR EDIT) */}
              {selectedMonitoring.requiresFeedback && selectedMonitoring.status !== 'REFUTADO' && (
                <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/20 space-y-4 text-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <h4 className="text-base font-bold text-slate-900">
                        Feedback de Team Leader al Agente
                      </h4>
                    </div>
                    {selectedMonitoring.tlFeedback && (
                      <span className="text-xs text-emerald-700 font-semibold">
                        ✓ Realizado el {selectedMonitoring.tlFeedback.feedbackDate}
                      </span>
                    )}
                  </div>

                  {selectedMonitoring.tlFeedback ? (
                    /* Read-only existing TL feedback */
                    <div className="space-y-3.5 bg-white p-4 rounded-xl border border-slate-200 text-sm">
                      <div>
                        <span className="text-xs text-slate-500 block">Fecha y Hora de Sesión</span>
                        <span className="font-semibold text-slate-900">{selectedMonitoring.tlFeedback.feedbackDate}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">Observaciones del TL</span>
                        <p className="text-slate-800 mt-1 whitespace-pre-line leading-relaxed">{selectedMonitoring.tlFeedback.observations}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">Plan de Acción Acordado</span>
                        <p className="text-slate-800 mt-1 font-medium whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                          {selectedMonitoring.tlFeedback.actionPlan}
                        </p>
                      </div>
                    </div>
                  ) : isRefuting ? (
                    /* Inline TL Refutation Form */
                    <form onSubmit={(e) => handleConfirmRefutation(e, 'team_leader')} className="space-y-4 text-sm bg-white p-4 rounded-xl border border-rose-200">
                      <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-sm text-rose-900">
                        <strong>Refutar Monitoreo (Team Leader):</strong> Al confirmar, este monitoreo será devuelto a la bandeja del Analista de Experiencia para una nueva revisión.
                      </div>
                      <div>
                        <label className="block text-sm text-slate-800 font-semibold mb-1.5">
                          Motivo / Argumento de Refutación *
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Explica por qué no estás de acuerdo con la evaluación o categorización del monitoreo..."
                          value={refutationReason}
                          onChange={(e) => setRefutationReason(e.target.value)}
                          required
                          autoFocus
                          className="w-full p-3 text-sm bg-slate-50 border border-rose-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRefuting(false);
                            setRefutationReason('');
                          }}
                          className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg transition-colors"
                        >
                          Volver al Feedback
                        </button>
                        <button
                          type="submit"
                          disabled={refuteSuccess}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-2xs"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>{refuteSuccess ? '¡Devuelto al Analista!' : 'Confirmar Refutación y Devolver al Analista'}</span>
                        </button>
                      </div>
                    </form>
                  ) : !(
                    hasPermission('canGiveTLFeedback') &&
                    (currentUser.role === 'admin' ||
                      currentUser.role === 'coordinador' ||
                      selectedMonitoring.teamLeaderId === currentUser.id)
                  ) ? (
                    <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-600">
                      Pendiente de retroalimentación por parte del Team Leader (<strong>{selectedMonitoring.teamLeaderName}</strong>). Tu perfil tiene vista de solo lectura en esta etapa.
                    </div>
                  ) : (
                    /* Edit form if current user has TL feedback permission */
                    <form onSubmit={handleSaveTLFeedback} className="space-y-4 text-sm">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-700 font-semibold">
                            Fecha y Hora de Sesión de Feedback
                          </label>
                          <span className="text-xs text-blue-700 font-medium">
                            (Automática)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 cursor-not-allowed select-none">
                          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{feedbackDate}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700 font-semibold mb-1.5">
                          Observaciones y Conversación con el Agente *
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Describe qué se escuchó en la llamada junto al asesor, qué reconoció el asesor y motivos del desvío..."
                          value={tlObservations}
                          onChange={(e) => setTlObservations(e.target.value)}
                          required
                          className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700 font-semibold mb-1.5">
                          Plan de Acción Acordado (Metas y Actividades) *
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Ej: 1. Repasar guía de facturación. 2. Realizar 2 llamadas en sombra con un asesor senior antes del viernes..."
                          value={tlActionPlan}
                          onChange={(e) => setTlActionPlan(e.target.value)}
                          required
                          className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
                        <span className="text-xs text-slate-500">
                          Al guardar, el caso se transferirá a la bandeja del agente para su compromiso de mejora.
                        </span>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setIsRefuting(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-semibold text-sm rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Refutar Monitoreo</span>
                          </button>
                          <button
                            type="submit"
                            disabled={tlSubmitSuccess}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-2xs"
                          >
                            <Send className="w-4 h-4" />
                            <span>{tlSubmitSuccess ? '¡Enviado a Agente!' : 'Enviar a Bandeja del Agente'}</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* SECTION: AGENT COMMITMENT (VIEW OR EDIT) */}
              {selectedMonitoring.tlFeedback && selectedMonitoring.status !== 'REFUTADO' && (
                <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 space-y-4 text-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-base font-bold text-slate-900">
                        Compromiso de Mejora del Asesor
                      </h4>
                    </div>
                    {selectedMonitoring.agentCommitment && (
                      <span className="text-xs text-emerald-700 font-semibold">
                        ✓ Firmado y Ciclo Cerrado ({selectedMonitoring.agentCommitment.signedAt})
                      </span>
                    )}
                  </div>

                  {selectedMonitoring.agentCommitment ? (
                    /* Read-only existing commitment */
                    <div className="space-y-3.5 bg-white p-4 rounded-xl border border-slate-200 text-sm">
                      <div>
                        <span className="text-xs text-slate-500 block">Compromiso Personal del Asesor</span>
                        <p className="text-slate-800 font-medium mt-1 whitespace-pre-line leading-relaxed">
                          "{selectedMonitoring.agentCommitment.commitmentText}"
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2.5 border-t border-slate-100">
                        <div>
                          <span className="text-xs text-slate-500 block">Acción Específica a Realizar</span>
                          <span className="text-slate-800 font-medium">{selectedMonitoring.agentCommitment.actionStep}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block">Fecha Objetivo de Cumplimiento</span>
                          <span className="text-slate-800 font-semibold">{selectedMonitoring.agentCommitment.targetCompletionDate}</span>
                        </div>
                      </div>
                    </div>
                  ) : isRefuting ? (
                    /* Inline Agent Refutation Form */
                    <form onSubmit={(e) => handleConfirmRefutation(e, 'asesor')} className="space-y-4 text-sm bg-white p-4 rounded-xl border border-rose-200">
                      <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-sm text-rose-900">
                        <strong>Refutar Monitoreo (Asesor):</strong> Si no estás de acuerdo con este monitoreo, indica tu argumento para devolverlo al Analista de Experiencia y que sea revisado nuevamente.
                      </div>
                      <div>
                        <label className="block text-sm text-slate-800 font-semibold mb-1.5">
                          Motivo / Argumento de Refutación *
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Explica por qué consideras que el monitoreo o el hallazgo debe ser revisado nuevamente..."
                          value={refutationReason}
                          onChange={(e) => setRefutationReason(e.target.value)}
                          required
                          autoFocus
                          className="w-full p-3 text-sm bg-slate-50 border border-rose-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRefuting(false);
                            setRefutationReason('');
                          }}
                          className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg transition-colors"
                        >
                          Volver al Compromiso
                        </button>
                        <button
                          type="submit"
                          disabled={refuteSuccess}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-2xs"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>{refuteSuccess ? '¡Devuelto al Analista!' : 'Confirmar Refutación y Devolver al Analista'}</span>
                        </button>
                      </div>
                    </form>
                  ) : !(
                    hasPermission('canSignAgentCommitment') &&
                    (currentUser.role === 'admin' ||
                      selectedMonitoring.agentId === currentUser.id)
                  ) ? (
                    <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-600">
                      Pendiente de firma de compromiso por parte del asesor (<strong>{selectedMonitoring.agentName}</strong>). Tu perfil tiene vista de solo lectura en esta etapa.
                    </div>
                  ) : (
                    /* Edit form for Agent or Admin */
                    <form onSubmit={handleSaveAgentCommitment} className="space-y-4 text-sm">
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-900">
                        Por favor revisa el feedback y plan de acción de tu Team Leader arriba y registra tu compromiso personal para cerrar este ciclo de experiencia.
                      </div>

                      <div>
                        <label className="block text-sm text-slate-700 font-semibold mb-1.5">
                          Mi Compromiso de Mejora *
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Describe qué harás diferente a partir de ahora para evitar este desvío en tus llamadas..."
                          value={agentCommitmentText}
                          onChange={(e) => setAgentCommitmentText(e.target.value)}
                          required
                          className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1.5">
                            Paso de Acción Específico *
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Consultar la matriz de tarifas antes de responder..."
                            value={agentActionStep}
                            onChange={(e) => setAgentActionStep(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1.5">
                            Fecha Límite para Cumplimiento *
                          </label>
                          <input
                            type="date"
                            value={agentTargetDate}
                            onChange={(e) => setAgentTargetDate(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agentAcceptedTerms}
                          onChange={(e) => setAgentAcceptedTerms(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span className="text-sm text-slate-700 font-medium">
                          Confirmo haber recibido el feedback y me comprometo al plan de acción establecido.
                        </span>
                      </label>

                      <div className="flex items-center justify-end gap-2.5 pt-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setIsRefuting(true)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-semibold text-sm rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Refutar Monitoreo</span>
                        </button>
                        <button
                          type="submit"
                          disabled={cycleClosedSuccess}
                          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-2xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{cycleClosedSuccess ? '¡Ciclo Cerrado con Éxito!' : 'Firmar y Cerrar Ciclo de Feedback'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedMonitoring(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
