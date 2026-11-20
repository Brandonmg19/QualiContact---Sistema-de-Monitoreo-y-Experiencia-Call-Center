import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// AI Advice & Coaching Endpoint for Call Center (Analyzing ALL registered data)
app.post('/api/ai/advice', async (req, res) => {
  try {
    const {
      targetType,
      targetName,
      targetProfile,
      statsData,
      allRegisteredMonitorings,
      teamSummary,
      auditTrail,
      customQuestion,
    } = req.body;

    const monitoringsList = Array.isArray(allRegisteredMonitorings) ? allRegisteredMonitorings : [];

    if (!aiClient) {
      // Fallback response if GEMINI_API_KEY is not configured yet
      return res.json({
        success: true,
        source: 'local_engine',
        advice: generateLocalAdvice(targetType, targetName, targetProfile, statsData, monitoringsList, teamSummary),
      });
    }

    const systemPrompt = `Eres el Consultor Director y Master Coach en Experiencia del Cliente (CX), Calidad de Servicio y Operaciones de Call Center para la plataforma QualiContact (especialista en metodologías COPC, Six Sigma aplicada a CX, modelo GROW de feedback y desarrollo de talento en contact centers).

INSTRUCCIÓN CRÍTICA DE ANÁLISIS EXHAUSTIVO:
Tu análisis DEBE realizarse a partir de TODO LO REGISTRADO en la herramienta con respecto a la persona o entidad seleccionada. No uses frases genéricas o hipotéticas; debes citar la evidencia exacta registrada en el sistema:
1. EVIDENCIA DE TICKETS: Cita números de ticket reales (ej. ${monitoringsList[0]?.ticketNumber || 'TK-XXXX'}), fechas de llamada, canales (Voz, Chat, etc.), y notas exactas de experiencia registradas.
2. AUDITORÍA DEL CICLO CERRADO DE FEEDBACK:
   - Correlaciona: Hallazgo del Analista de Experiencia -> Feedback y Plan de Acción del Team Leader -> Compromiso y Acción Concreta firmada por el Asesor.
   - Reincidencias y efectividad: Analiza si el asesor cometió los mismos errores en llamadas posteriores a haber firmado un compromiso (reincidencia) o si sus notas mejoraron.
   - Calidad del Feedback del TL: Evalúa si los planes de acción del Team Leader son específicos y medibles o si fueron vagos/genéricos.
3. ADAPTACIÓN AL ROL SELECCIONADO:
   - Si es 'asesor': Diagnóstico personalizado basado en todas sus llamadas monitoreadas, fortalezas comprobadas, análisis de sus compromisos firmados, 3 técnicas prácticas de auto-mejora (con ejemplos de fraseología/guiones para llamadas o chats), y un compromiso SMART sugerido para su próximo ciclo.
   - Si es 'team_leader': Diagnóstico del liderazgo sobre todo su equipo asignado, identificación de asesores destacados vs asesores con desvíos recurrentes ('ofensores'), auditoría a su agilidad de respuesta (monitoreos pendientes de feedback por el TL), y dinámicas recomendadas de coaching 1 a 1 y roleplay en briefing.
   - Si es 'coordinador': Visión macro-operativa y sistémica de todo el servicio/coordinación, comparativa entre Team Leaders, segregación rigurosa de causas imputables al Asesor vs causas imputables al Negocio o Procesos (ej. aplicativos lentos, políticas rígidas, fallas de catálogo) para elevar a mesas de producto, y plan de calibración quincenal.

Estructura obligatoria de tu informe en Markdown:
### 1. 🎯 Diagnóstico Ejecutivo Basado en Evidencia Registrada
(Resumen ejecutivo con métricas reales, total de monitoreos analizados y diagnóstico del nivel de experiencia)

### 2. 📊 Auditoría del Historial y Ciclo Cerrado de Feedback
(Citas explícitas de tickets, fechas, hallazgos de experiencia, feedback brindado por el TL y compromisos firmados por los agentes)

### 3. 🔍 Detección de Patrones, Reincidencias y Causas Raíz
(Análisis de áreas imputables Asesor vs Negocio, principales motivos de contacto y causas raíz recurrentes)

### 4. 📋 Plan de Acción Inmediato y Técnicas Aplicadas
(Paso a paso estructurado con acciones claras, herramientas y guiones de respuesta recomendados)

### 5. 💡 Recomendación de Coaching y Dinámica Operativa
(Técnicas concretas de acompañamiento, roleplays, modelos de feedback GROW o escalamiento a producto)

### 6. 📈 KPIs y Metas de Seguimiento
(Metas numéricas de score de experiencia, SLA de feedback y reducción de causas raíz)`;

    const userPrompt = `Realiza un análisis integral y exhaustivo a partir de TODO lo registrado en el sistema para la siguiente entidad:

DATOS DEL PERFIL REGISTRADO:
- Rol / Nivel: ${targetType.toUpperCase()}
- Nombre: ${targetName}
- Código de Empleado / ID: ${targetProfile?.code || 'N/A'}
- Departamento / Campaña: ${targetProfile?.department || 'Operaciones'}
- Supervisor Directo: ${targetProfile?.supervisor || 'N/A'}

MÉTRICAS REGISTRADAS EN LA HERRAMIENTA:
- Total Monitoreos Registrados: ${statsData?.total || monitoringsList.length}
- Calificación Promedio de Experiencia: ${statsData?.avgScore ? statsData.avgScore.toFixed(1) + '%' : 'N/A'}
- Monitoreos que Ameritaron Feedback: ${statsData?.withFeedback || 0}
- Ciclos de Feedback Cerrados: ${statsData?.closedFeedback || 0}
- Cumplimiento de Feedback Cerrado: ${statsData?.feedbackRate || '0%'}
- Desglose por Área Imputable: ${JSON.stringify(statsData?.imputableBreakdown || {})}
- Desglose por Canales: ${JSON.stringify(statsData?.channels || {})}
- Top Causas Raíz Recurrentes: ${JSON.stringify(statsData?.topCauses || [])}

HISTORIAL COMPLETO DE MONITOREOS Y CICLO DE FEEDBACK REGISTRADOS (${monitoringsList.length} evaluaciones):
${JSON.stringify(monitoringsList, null, 2)}

${teamSummary ? `RESUMEN DE EQUIPO ASIGNADO:\n${JSON.stringify(teamSummary, null, 2)}\n` : ''}

${auditTrail && auditTrail.length > 0 ? `REGISTROS EN BITÁCORA DEL SISTEMA:\n${JSON.stringify(auditTrail, null, 2)}\n` : ''}

${customQuestion ? `ENFOQUE O PREGUNTA ESPECÍFICA SOLICITADA POR EL USUARIO: "${customQuestion}"` : ''}

Por favor genera la asesoría completa, rigurosa y altamente detallada en base a cada registro provisto.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return res.json({
      success: true,
      source: 'gemini',
      advice: response.text,
    });
  } catch (error: any) {
    console.error('Error generating AI advice with Gemini:', error);
    // Return structured analysis from local engine with warning
    const fallbackAdvice = generateLocalAdvice(
      req.body.targetType,
      req.body.targetName,
      req.body.targetProfile,
      req.body.statsData,
      req.body.allRegisteredMonitorings || [],
      req.body.teamSummary
    );

    return res.json({
      success: true,
      source: 'fallback',
      advice: fallbackAdvice,
      warning: error?.message || 'Error communicating with AI service',
    });
  }
});

// Comprehensive evidence-based local advice generator (examines ALL registered monitorings)
function generateLocalAdvice(
  targetType: string,
  targetName: string,
  targetProfile: any,
  statsData: any,
  monitorings: any[],
  teamSummary: any
): string {
  const total = monitorings.length;
  const avg = statsData?.avgScore || (total > 0 ? monitorings.reduce((s: number, m: any) => s + (m.score || 0), 0) / total : 82);
  const withFeedback = monitorings.filter((m: any) => m.requiresFeedback);
  const closed = monitorings.filter((m: any) => m.status === 'CERRADO');
  const pendingTL = monitorings.filter((m: any) => m.status === 'PENDIENTE_TL');
  const pendingAgent = monitorings.filter((m: any) => m.status === 'PENDIENTE_AGENTE');

  // Top causes
  const causeCounts: Record<string, number> = {};
  monitorings.forEach((m: any) => {
    const cr = m.categoria1?.causaRaiz || m.category1?.causaRaiz;
    if (cr) causeCounts[cr] = (causeCounts[cr] || 0) + 1;
  });
  const sortedCauses = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]);
  const mainCause = sortedCauses[0]?.[0] || 'Validación de procedimiento y política de atención';

  // Area imputable breakdown
  const imputableCounts: Record<string, number> = { Asesor: 0, Negocio: 0, Cliente: 0 };
  monitorings.forEach((m: any) => {
    const area = m.areaImputable;
    if (area && imputableCounts[area] !== undefined) imputableCounts[area]++;
  });

  if (targetType === 'asesor') {
    const recentTickets = monitorings.map((m: any) => `- **Ticket ${m.ticketNumber}** (${m.callDate || 'Reciente'} · Canal: ${m.channel} · Score: **${m.score}%**): Causa raíz: *${m.categoria1?.causaRaiz || 'General'}*. ${m.qaFindings?.hallazgoCritico || m.qaFindings?.criticalFinding ? `Hallazgo: "${m.qaFindings?.hallazgoCritico || m.qaFindings?.criticalFinding}".` : ''} ${m.tlFeedback?.planDeAccionTL || m.tlFeedback?.actionPlan ? `Plan TL: "${m.tlFeedback?.planDeAccionTL || m.tlFeedback?.actionPlan}".` : ''} ${m.agentCommitment?.compromisoAgente || m.agentCommitment?.commitmentText ? `Compromiso firmado: "${m.agentCommitment?.compromisoAgente || m.agentCommitment?.commitmentText}".` : ''}`).join('\n');

    return `### 1. 🎯 Diagnóstico Ejecutivo para el Asesor: ${targetName}
**Score Promedio de Experiencia:** **${avg.toFixed(1)}%** | **Total Monitoreos Auditados:** ${total} evaluaciones registradas.
- **Monitoreos que requirieron feedback:** ${withFeedback.length} caso(s).
- **Ciclos cerrados con compromiso:** ${closed.length} caso(s) (${withFeedback.length > 0 ? ((closed.length / withFeedback.length) * 100).toFixed(0) : 100}% de cumplimiento).
- **Pendientes actuales:** ${pendingAgent.length} en espera de tu compromiso | ${pendingTL.length} en revisión por tu Team Leader.

---

### 2. 📊 Auditoría del Historial y Casos Registrados en la Herramienta
A continuación se detalla la evidencia recopilada en todas tus evaluaciones registradas:
${recentTickets || '- Sin monitoreos cargados actualmente.'}

---

### 3. 🔍 Análisis de Causas Raíz y Oportunidades Clave
- **Principal Causa Raíz Detectada:** **${mainCause}** (presente en ${causeCounts[mainCause] || 1} evaluación/es).
- **Distribución de Imputabilidad:** Asesor: ${imputableCounts.Asesor} | Negocio/Sistemas: ${imputableCounts.Negocio} | Cliente: ${imputableCounts.Cliente}.
- **Patrón de Desvío:** Se evidencia que cuando el cliente expone reclamos técnicos o de facturación, existe tendencia a no indagar la causa de fondo antes de remitir el procedimiento.

---

### 4. 📋 Plan de Acción y Técnicas de Mejora Inmediata
1. **Técnica del Doble Sondeo Abierto (Primeros 60 segundos):**
   *Frase recomendada:* *"Comprendo perfectamente su requerimiento con respecto al trámite, permítame validar en el sistema su última factura para asegurarle la solución definitiva desde este primer contacto."*
2. **Uso Activo de la Guía Rápida de Soluciones:**
   Mantén abierta la matriz de procedimientos antes de brindar plazos de resolución al usuario.
3. **Validación de Entendimiento en el Cierre:**
   Antes de despedir la interacción, confirma: *"¿Quedó claro el procedimiento acordado o desea que repitamos algún detalle para su tranquilidad?"*.

---

### 5. 💡 Compromiso de Mejora Sugerido para tu Próximo Monitoreo
*"Me comprometo a validar con la herramienta de consulta antes de emitir información tarifaria o de soporte, garantizando que el 100% de mis llamadas cumplan con el protocolo y logrando una nota superior al 90%."*

---

### 6. 📈 Metas de Seguimiento
- **Meta de Score de Experiencia:** Elevar el promedio a **≥ 90.0%**.
- **Cero Reincidencias en:** *${mainCause}*.
- **FCR (First Contact Resolution):** Reducir transferencias innecesarias en un 20%.`;
  }

  if (targetType === 'team_leader') {
    const agentsSummary = Array.isArray(teamSummary?.advisors)
      ? teamSummary.advisors.map((adv: any) => `- **${adv.name}**: ${adv.callsCount} llamadas evaluadas | Promedio: **${adv.avgScore.toFixed(1)}%** | ${adv.pendingTL > 0 ? `⚠️ ${adv.pendingTL} feedback(s) pendientes de entrega por el TL` : '✅ Al día'} | ${adv.isOffender ? '🚨 Asesor con desvíos recurrentes' : '👍 Rendimiento estable'}`).join('\n')
      : '- Sin desglose de asesores disponible.';

    return `### 1. 🎯 Diagnóstico Ejecutivo para el Team Leader: ${targetName}
**Rendimiento Consolidado del Equipo:** **${avg.toFixed(1)}%** | **Total Monitoreos Auditados:** ${total} llamadas/chats.
- **Monitoreos que Ameritaron Feedback:** ${withFeedback.length} casos.
- **Feedbacks Cerrados:** ${closed.length} (${withFeedback.length > 0 ? ((closed.length / withFeedback.length) * 100).toFixed(0) : 100}% de adherencia al ciclo).
- **Cuello de Botella Operativo:** **${pendingTL.length} monitoreos en estado PENDIENTE_TL** esperando tu sesión de feedback.

---

### 2. 📊 Estado de los Asesores en tu Equipo (Auditoría Registrada)
${agentsSummary}

---

### 3. 🔍 Análisis de Causas Raíz y 'Asesores Ofensores'
- **Principal Causa Raíz en el Equipo:** **${mainCause}** (${causeCounts[mainCause] || 1} casos).
- **Distribución de Imputabilidad:** Asesor: ${imputableCounts.Asesor} | Negocio/Procesos: ${imputableCounts.Negocio} | Cliente: ${imputableCounts.Cliente}.
- **Alerta de Gestión:** Si existen monitoreos con más de 48 horas en *PENDIENTE_TL*, se pierde el impacto pedagógico del feedback y el asesor reincide en los errores.

---

### 4. 📋 Plan de Gestión y Liderazgo para el Team Leader
1. **Despeje de Bandeja (Prioridad Inmediata - Próximas 24 Horas):**
   Programar de inmediato las sesiones de feedback pendientes para los ${pendingTL.length} casos acumulados.
2. **Sesiones 1 a 1 con Técnica GROW:**
   - **G (Goal):** Establecer con el asesor la meta de la sesión (ej. subir de 75% a 90%).
   - **R (Reality):** Escuchar juntos el audio del ticket crítico y pedirle al asesor que identifique el error por sí mismo.
   - **O (Options):** ¿Qué frases alternativas pudo haber empleado?
   - **W (Will/Commitment):** Registrar un compromiso con fecha de cumplimiento y no solo un texto genérico.
3. **Roleplay en Briefing Diario (10 Minutos):**
   Realizar una simulación rápida sobre **${mainCause}** con dos asesores antes de abrir canales.

---

### 5. 📈 Metas y KPIs para el Equipo
- **SLA de Feedback de Experiencia:** 100% de retroalimentaciones entregadas en menos de 48h hábiles.
- **Score Grupal de Experiencia:** Meta de equipo en **≥ 88.0%**.
- **Reducción de Asesores con Notas < 80%:** Acompañamiento diario a asesores con alertas.`;
  }

  // Coordinador / Servicio Global
  const tlBreakdown = Array.isArray(teamSummary?.teamLeaders)
    ? teamSummary.teamLeaders.map((tl: any) => `- **${tl.name}** (${tl.department}): ${tl.totalCalls} llamadas evaluadas | Promedio: **${tl.avgScore.toFixed(1)}%** | Cumplimiento Feedback: **${tl.complianceRate}** | Pendientes TL: ${tl.backlogPendingTL}`).join('\n')
    : '- Análisis transversal de la coordinación.';

  return `### 1. 🎯 Diagnóstico Estratégico para Coordinación de Operaciones & Experiencia
**Score General del Servicio:** **${avg.toFixed(1)}%** | **Universo Evaluado:** ${total} atenciones registradas.
- **Casos que requirieron intervención de feedback:** ${withFeedback.length}.
- **Efectividad del Ciclo Cerrado:** ${closed.length} compromisos firmados (${withFeedback.length > 0 ? ((closed.length / withFeedback.length) * 100).toFixed(0) : 100}%).
- **Backlog en la Operación:** ${pendingTL.length} casos esperando feedback de TL | ${pendingAgent.length} compromisos pendientes de firma por agentes.

---

### 2. 📊 Desempeño Comparativo entre Equipos y Team Leaders
${tlBreakdown}

---

### 3. 🔍 Diagnóstico Sistémico: Asesor vs Negocio/Sistemas
- **Imputable al Asesor:** ${imputableCounts.Asesor} (${total > 0 ? ((imputableCounts.Asesor / total) * 100).toFixed(0) : 0}%) -> Brechas de conocimiento, empatía o adherencia a protocolo.
- **Imputable al Negocio / Sistemas:** ${imputableCounts.Negocio} (${total > 0 ? ((imputableCounts.Negocio / total) * 100).toFixed(0) : 0}%) -> **ATENCIÓN:** Fallas de aplicativos, caídas de sistema o inconsistencias de políticas que perjudican la experiencia sin ser culpa directa del agente.
- **Imputable al Cliente:** ${imputableCounts.Cliente} (${total > 0 ? ((imputableCounts.Cliente / total) * 100).toFixed(0) : 0}%) -> Expectativas no alineadas o documentación incompleta del usuario.
- **Top Causa Raíz Sistémica:** **${mainCause}**.

---

### 4. 📋 Estrategia de Gobernanza y Mejora Continua
1. **Mesa Interdisciplinaria con Tecnología y Producto:**
   Presentar formalmente los ${imputableCounts.Negocio} casos generados por fallas del sistema para corregir los cuellos de botella en la plataforma tecnológica.
2. **Sesión Quincenal de Calibración de Experiencia:**
   Reunir a los Analistas de Experiencia y Team Leaders para escuchar 3 llamadas testigo (una sobresaliente, una regular y una con falla crítica) y calibrar criterios de puntuación.
3. **Tablero de SLA de Gestión para Team Leaders:**
   Hacer visible el tiempo promedio que tarda cada TL en dar feedback para eliminar el backlog de ${pendingTL.length} casos.

---

### 5. 📈 Metas Operativas para el Servicio
- **Score Global de Experiencia:** **≥ 88.5%**.
- **Tasa de Cierre de Ciclo de Feedback:** **≥ 95%** en ≤ 72 horas.
- **Reducción de Fallas Imputables a Negocio:** 15% mediante ajustes en los sistemas del contact center.`;
}

// Development with Vite vs Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QualiContact server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
