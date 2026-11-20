import * as XLSX from 'xlsx';
import { CategoryItem, User, UserRole, MonitoringItem, SurveyItem, AreaImputable, ContactReasonItem } from '../types';

/**
 * Downloads a binary Excel workbook to the client's browser
 */
export function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename);
}

/**
 * Normalizes Área Imputable text from Excel to strict AreaImputable union
 */
function normalizeAreaImputable(raw: any): { value?: AreaImputable; invalid?: string } {
  if (raw === undefined || raw === null) return {};
  const clean = raw.toString().trim();
  if (!clean) return {};

  const norm = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (norm === 'negocio' || norm.includes('negocio') || norm.includes('empresa') || norm.includes('sistema')) {
    return { value: 'Negocio' };
  }
  if (norm === 'asesor' || norm.includes('asesor') || norm.includes('agente')) {
    return { value: 'Asesor' };
  }
  if (norm === 'cliente' || norm.includes('cliente')) {
    return { value: 'Cliente' };
  }
  return { invalid: clean };
}

/**
 * Exports full nested categories to an Excel spreadsheet
 */
export function exportCategoriesToExcel(categories: CategoryItem[], filename = 'Categorizaciones_CallCenter.xlsx') {
  const flatRows: any[] = [];

  categories.forEach((cat) => {
    if (!cat.motivos || cat.motivos.length === 0) {
      flatRows.push({
        'ÁREA IMPUTABLE': '',
        'CATEGORÍA': cat.name,
        'MOTIVO': '',
        'CAUSA RAÍZ': '',
        'DEFINICIÓN': '',
      });
      return;
    }

    cat.motivos.forEach((mot) => {
      if (!mot.causasRaiz || mot.causasRaiz.length === 0) {
        flatRows.push({
          'ÁREA IMPUTABLE': '',
          'CATEGORÍA': cat.name,
          'MOTIVO': mot.name,
          'CAUSA RAÍZ': '',
          'DEFINICIÓN': '',
        });
        return;
      }

      mot.causasRaiz.forEach((cr) => {
        flatRows.push({
          'ÁREA IMPUTABLE': cr.areaImputable || '',
          'CATEGORÍA': cat.name,
          'MOTIVO': mot.name,
          'CAUSA RAÍZ': cr.name,
          'DEFINICIÓN': cr.definicion || '',
        });
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(flatRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Categorizaciones');
  downloadWorkbook(workbook, filename);
}

/**
 * Generates an Excel template for quick bulk upload of categorizations
 */
export function downloadCategoryTemplate(filename = 'Plantilla_Carga_Categorizaciones.xlsx') {
  const exampleRows = [
    {
      'ÁREA IMPUTABLE': 'Asesor',
      'CATEGORÍA': 'Facturación y Pagos',
      'MOTIVO': 'Cobro Inadecuado o Duplicado',
      'CAUSA RAÍZ': 'Desinformación del asesor sobre tarifas vigentes',
      'DEFINICIÓN': 'Se utiliza cuando el asesor brinda información errónea o incompleta respecto a planes, recargos o ciclos de facturación.',
    },
    {
      'ÁREA IMPUTABLE': 'Negocio',
      'CATEGORÍA': 'Facturación y Pagos',
      'MOTIVO': 'Cobro Inadecuado o Duplicado',
      'CAUSA RAÍZ': 'Error en parametrización del sistema CRM',
      'DEFINICIÓN': 'Se utiliza cuando el sistema genera un cobro duplicado o erróneo sin intervención ni error del asesor.',
    },
    {
      'ÁREA IMPUTABLE': 'Cliente',
      'CATEGORÍA': 'Soporte Técnico y Averías',
      'MOTIVO': 'Intermitencia o Corte de Servicio',
      'CAUSA RAÍZ': 'Equipo del cliente con daño físico o mala configuración local',
      'DEFINICIÓN': 'Se utiliza cuando la falla se origina en el dispositivo del cliente o por manipulación externa fuera de red.',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(exampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');
  downloadWorkbook(workbook, filename);
}

/**
 * Parses an uploaded Excel or CSV file into 3-level categories with Área Imputable & Definición
 */
export async function parseCategoriesFromFile(file: File): Promise<{
  success: boolean;
  categories: CategoryItem[];
  rowCount: number;
  errors: string[];
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Detect sheet & header row dynamically (handles title rows or accents/case variations)
        let targetSheetName = workbook.SheetNames[0];
        let headerRowIndex = 0;

        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          const scanLimit = Math.min(matrix.length, 15);
          let found = false;
          for (let r = 0; r < scanLimit; r++) {
            const cells = (matrix[r] || []).map((c) => normalizeKey(String(c ?? '')));
            if (
              cells.some((c) => c.startsWith('categoria')) &&
              (cells.some((c) => c.startsWith('motivo')) ||
                cells.some((c) => c.startsWith('causaraiz')) ||
                cells.includes('areaimputable'))
            ) {
              targetSheetName = name;
              headerRowIndex = r;
              found = true;
              break;
            }
          }
          if (found) break;
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });

        if (!rows || rows.length === 0) {
          return resolve({
            success: false,
            categories: [],
            rowCount: 0,
            errors: ['El archivo no contiene filas de datos.'],
          });
        }

        const categoryMap = new Map<string, CategoryItem>();
        const errors: string[] = [];
        let processedRows = 0;

        rows.forEach((row, idx) => {
          // Skip completely blank rows
          const hasAnyValue = Object.values(row).some(
            (v) => v !== undefined && v !== null && v.toString().trim() !== ''
          );
          if (!hasAnyValue) return;

          processedRows++;

          const rawArea = getRowVal(row, [
            'ÁREA IMPUTABLE',
            'AREA IMPUTABLE',
            'Área Imputable',
            'Area Imputable',
            'Imputable',
          ]);
          const catRaw = getRowVal(row, [
            'CATEGORÍA',
            'CATEGORIA',
            'Categoría',
            'Categoria',
            'Categoría (Nivel 1)',
            'Categoria (Nivel 1)',
          ]);
          const catCodeRaw = getRowVal(row, ['Código Categoría', 'Codigo Categoria', 'Codigo']);
          const motRaw = getRowVal(row, [
            'MOTIVO',
            'Motivo',
            'Motivo (Nivel 2)',
          ]);
          const crRaw = getRowVal(row, [
            'CAUSA RAÍZ',
            'CAUSA RAIZ',
            'Causa Raíz',
            'Causa Raiz',
            'Causa Raíz (Nivel 3)',
            'Causa Raiz (Nivel 3)',
          ]);
          const defRaw = getRowVal(row, [
            'DEFINICIÓN',
            'DEFINICION',
            'Definición',
            'Definicion',
            'Detalle',
            'Descripción',
            'Descripcion',
          ]);

          const catName = (catRaw ?? '').toString().trim();
          const catCode = (catCodeRaw ?? '').toString().trim();
          const motName = (motRaw ?? '').toString().trim();
          const crName = (crRaw ?? '').toString().trim();
          const definicion = (defRaw ?? '').toString().trim();

          const parsedArea = normalizeAreaImputable(rawArea);
          if (parsedArea.invalid) {
            errors.push(
              `Fila ${headerRowIndex + idx + 2}: Área imputable "${parsedArea.invalid}" no reconocida (valores esperados: Negocio, Asesor, Cliente).`
            );
          }

          if (!catName) {
            errors.push(`Fila ${headerRowIndex + idx + 2}: La columna CATEGORÍA está vacía.`);
            return;
          }

          const catKey = normalizeKey(catName) || catName.toLowerCase();
          let catItem = categoryMap.get(catKey);
          if (!catItem) {
            catItem = {
              id: `cat-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
              name: catName,
              code: catCode || catName.substring(0, 3).toUpperCase(),
              motivos: [],
            };
            categoryMap.set(catKey, catItem);
          }

          if (motName) {
            const motKey = normalizeKey(motName) || motName.toLowerCase();
            let motItem = catItem.motivos.find(
              (m) => (normalizeKey(m.name) || m.name.toLowerCase()) === motKey
            );
            if (!motItem) {
              motItem = {
                id: `mot-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
                name: motName,
                categoriaId: catItem.id,
                causasRaiz: [],
              };
              catItem.motivos.push(motItem);
            }

            if (crName) {
              const crKey = normalizeKey(crName) || crName.toLowerCase();
              const existingCr = motItem.causasRaiz.find(
                (cr) => (normalizeKey(cr.name) || cr.name.toLowerCase()) === crKey
              );
              if (!existingCr) {
                motItem.causasRaiz.push({
                  id: `cr-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
                  name: crName,
                  motivoId: motItem.id,
                  categoriaId: catItem.id,
                  areaImputable: parsedArea.value,
                  definicion: definicion || undefined,
                });
              } else {
                // Enrich existing Causa Raíz if new row adds Área Imputable or Definición
                if (!existingCr.areaImputable && parsedArea.value) {
                  existingCr.areaImputable = parsedArea.value;
                }
                if (!existingCr.definicion && definicion) {
                  existingCr.definicion = definicion;
                }
              }
            }
          }
        });

        const parsedCategories = Array.from(categoryMap.values());
        resolve({
          success: parsedCategories.length > 0,
          categories: parsedCategories,
          rowCount: processedRows,
          errors,
        });
      } catch (err: any) {
        resolve({
          success: false,
          categories: [],
          rowCount: 0,
          errors: [`Error al procesar el archivo: ${err.message || 'Formato no válido'}`],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        categories: [],
        rowCount: 0,
        errors: ['No se pudo leer el archivo cargado.'],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports Advisor Dependencies to Excel with the 4 required columns:
 * Nombre del Asesor, Nombre Voz, Correo Xtendo, Correo Inmediato Superior (Team Leader)
 */
export function exportDependenciesToExcel(users: User[], filename = 'Dependencias_NEXA-CX.xlsx') {
  const advisors = users.filter((u) => u.role === 'asesor');
  const headers = [
    'Nombre del Asesor',
    'Nombre Voz',
    'Correo Xtendo',
    'Correo Inmediato Superior (Team Leader)',
  ];

  const rows = advisors.map((u) => {
    const supervisor = users.find((sup) => sup.id === u.reportsToId);
    return {
      'Nombre del Asesor': u.name,
      'Nombre Voz': u.voiceName || '',
      'Correo Xtendo': u.email,
      'Correo Inmediato Superior (Team Leader)': supervisor?.email || '',
    };
  });

  const worksheet =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows, { header: headers })
      : XLSX.utils.json_to_sheet([], { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dependencias');
  downloadWorkbook(workbook, filename);
}

/**
 * Downloads a template for registering/updating advisor dependencies:
 * Nombre del Asesor, Nombre Voz, Correo Xtendo, Correo Inmediato Superior (Team Leader)
 */
export function downloadDependencyTemplate(filename = 'Plantilla_Carga_Dependencias.xlsx') {
  const exampleRows = [
    {
      'Nombre del Asesor': 'Carlos Méndez',
      'Nombre Voz': 'Carlos Mendez Voz',
      'Correo Xtendo': 'carlos.mendez@xtendo-it.com',
      'Correo Inmediato Superior (Team Leader)': 'roberto.silva@xtendo-it.com',
    },
    {
      'Nombre del Asesor': 'Sofía Valenzuela',
      'Nombre Voz': 'Sofia Valenzuela Voz',
      'Correo Xtendo': 'sofia.valenzuela@xtendo-it.com',
      'Correo Inmediato Superior (Team Leader)': 'roberto.silva@xtendo-it.com',
    },
    {
      'Nombre del Asesor': 'Javier Ríos',
      'Nombre Voz': 'Javier Rios Voz',
      'Correo Xtendo': 'javier.rios@xtendo-it.com',
      'Correo Inmediato Superior (Team Leader)': 'patricia.herrera@xtendo-it.com',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(exampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Dependencias');
  downloadWorkbook(workbook, filename);
}

/**
 * Parses advisor dependency registration/reassignment from Excel file using:
 * Nombre del Asesor, Nombre Voz, Correo Xtendo y Correo Inmediato Superior (Team Leader)
 */
export async function parseDependenciesFromFile(
  file: File,
  currentUsers: User[]
): Promise<{
  success: boolean;
  updatedUsers: User[];
  changesApplied: number;
  errors: string[];
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let targetSheetName = workbook.SheetNames[0];
        let headerRowIndex = 0;

        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          const scanLimit = Math.min(matrix.length, 15);
          let found = false;
          for (let r = 0; r < scanLimit; r++) {
            const cells = (matrix[r] || []).map((c) => normalizeKey(String(c ?? '')));
            if (
              cells.some((c) =>
                c === 'nombredelasesor' ||
                c === 'nombrevoz' ||
                c === 'correoxtendo' ||
                c === 'correoinmediatosuperiorteamleader' ||
                c === 'correoinmediatosuperior' ||
                c === 'correodelagente' ||
                c === 'correodelasesor'
              ) ||
              (cells.some((c) => c.includes('correo')) &&
                cells.some(
                  (c) =>
                    c.includes('superior') ||
                    c.includes('teamleader') ||
                    c.includes('tl') ||
                    c.includes('supervisor')
                ))
            ) {
              targetSheetName = name;
              headerRowIndex = r;
              found = true;
              break;
            }
          }
          if (found) break;
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });

        if (!rows || rows.length === 0) {
          return resolve({
            success: false,
            updatedUsers: currentUsers,
            changesApplied: 0,
            errors: ['El archivo no contiene filas de datos.'],
          });
        }

        const sampleRowKeys = Object.keys(rows[0] || {}).map(normalizeKey);
        const hasVoiceColumn = sampleRowKeys.some(
          (k) =>
            k === 'nombrevoz' ||
            k === 'nombreenvoz' ||
            k === 'usuariovoz' ||
            k === 'agentevoz' ||
            k === 'voz'
        );

        const userMap = new Map<string, User>();
        currentUsers.forEach((u) => userMap.set(u.id, { ...u }));

        const emailMap = new Map<string, User>();
        currentUsers.forEach((u) => {
          emailMap.set(u.email.toLowerCase().trim(), u);
        });

        let changesApplied = 0;
        let createdCounter = 0;
        const baseTimestamp = Date.now();
        const errors: string[] = [];

        rows.forEach((row, idx) => {
          const hasAnyValue = Object.values(row).some(
            (v) => v !== undefined && v !== null && v.toString().trim() !== ''
          );
          if (!hasAnyValue) return;

          const rowNum = headerRowIndex + idx + 2;

          const advisorNameRaw = getRowVal(row, [
            'Nombre del Asesor',
            'Nombre Asesor',
            'Asesor',
            'Nombre Completo',
            'Nombre',
          ]);
          const voiceNameRaw = getRowVal(row, [
            'Nombre Voz',
            'Nombre en Voz',
            'Usuario Voz',
            'Agente Voz',
            'Login Voz',
            'Voz',
          ]);
          const advisorEmailRaw = getRowVal(row, [
            'Correo Xtendo',
            'Correo del Asesor',
            'Correo Asesor',
            'Correo del Agente',
            'Correo Agente',
            'Email Asesor',
            'Correo',
            'Email',
          ]);
          const tlEmailRaw = getRowVal(row, [
            'Correo Inmediato Superior (Team Leader)',
            'Correo Inmediato Superior (Team leader)',
            'Correo Inmediato Superior',
            'Inmediato Superior (Team Leader)',
            'Inmediato Superior',
            'Correo del Team Leader',
            'Correo Team Leader',
            'Correo del TL',
            'Correo TL',
            'Correo del Supervisor',
            'Correo Supervisor',
            'Team Leader',
          ]);

          const advisorName = (advisorNameRaw ?? '').toString().trim().slice(0, 150);
          const voiceName = (voiceNameRaw ?? '').toString().trim().slice(0, 150);
          const advisorEmail = (advisorEmailRaw ?? '').toString().trim().toLowerCase().slice(0, 200);
          const supEmail = (tlEmailRaw ?? '').toString().trim().toLowerCase();

          if (!advisorEmail) {
            errors.push(`Fila ${rowNum}: El campo "Correo Xtendo" está vacío.`);
            return;
          }

          if (!advisorEmail.includes('@')) {
            errors.push(`Fila ${rowNum}: El correo "${advisorEmailRaw}" no tiene un formato válido.`);
            return;
          }

          if (!supEmail) {
            errors.push(
              `Fila ${rowNum}: El campo "Correo Inmediato Superior (Team Leader)" es obligatorio.`
            );
            return;
          }

          const supervisorUser = emailMap.get(supEmail);
          if (!supervisorUser) {
            errors.push(
              `Fila ${rowNum}: No existe un Team Leader registrado con el correo "${tlEmailRaw}".`
            );
            return;
          }

          const existingUser = emailMap.get(advisorEmail);

          if (existingUser) {
            if (existingUser.role === 'team_leader' && supervisorUser.role === 'coordinador') {
              const current = userMap.get(existingUser.id);
              if (current) {
                current.reportsToId = supervisorUser.id;
                changesApplied++;
              }
              return;
            }

            if (existingUser.role !== 'asesor') {
              errors.push(
                `Fila ${rowNum}: El correo "${advisorEmail}" pertenece a ${existingUser.name} con rol "${existingUser.role}" (solo se registran asesores en esta plantilla).`
              );
              return;
            }

            if (supervisorUser.role !== 'team_leader') {
              errors.push(
                `Fila ${rowNum}: El correo "${supervisorUser.email}" (${supervisorUser.name}) tiene rol "${supervisorUser.role}", pero el inmediato superior del asesor debe ser un Team Leader.`
              );
              return;
            }

            const current = userMap.get(existingUser.id);
            if (current) {
              if (advisorName) {
                current.name = advisorName;
              }
              if (hasVoiceColumn || voiceName) {
                current.voiceName = voiceName;
              }
              current.reportsToId = supervisorUser.id;
              emailMap.set(advisorEmail, current);
              changesApplied++;
            }
          } else {
            if (!advisorName) {
              errors.push(
                `Fila ${rowNum}: El campo "Nombre del Asesor" es obligatorio para registrar al nuevo asesor (${advisorEmail}).`
              );
              return;
            }

            if (supervisorUser.role !== 'team_leader') {
              errors.push(
                `Fila ${rowNum}: El correo "${supervisorUser.email}" (${supervisorUser.name}) tiene rol "${supervisorUser.role}", pero el inmediato superior del asesor debe ser un Team Leader.`
              );
              return;
            }

            createdCounter++;
            const newId = `usr-dep-${baseTimestamp}-${createdCounter}`;
            const codeNum = currentUsers.length + createdCounter + 100;
            const newUser: User = {
              id: newId,
              name: advisorName,
              voiceName: voiceName || '',
              email: advisorEmail,
              employeeCode: `AGT-${codeNum}`,
              role: 'asesor',
              status: 'active',
              department: 'Operaciones',
              reportsToId: supervisorUser.id,
            };
            userMap.set(newId, newUser);
            emailMap.set(advisorEmail, newUser);
            changesApplied++;
          }
        });

        resolve({
          success: changesApplied > 0,
          updatedUsers: Array.from(userMap.values()),
          changesApplied,
          errors,
        });
      } catch (err: any) {
        resolve({
          success: false,
          updatedUsers: currentUsers,
          changesApplied: 0,
          errors: [`Error al procesar archivo: ${err.message || 'Formato no soportado'}`],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        updatedUsers: currentUsers,
        changesApplied: 0,
        errors: ['Error al leer el archivo.'],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports monitoring database to Excel with complete QA and feedback metrics
 */
export function exportMonitoringsToExcel(monitorings: MonitoringItem[], filename = 'Reporte_Monitoreos_CallCenter.xlsx') {
  const rows = monitorings.map((m) => {
    return {
      'ID Monitoreo': m.id,
      'Ticket / Chat ID': m.chatId || m.ticketNumber,
      'Línea / NroLlamante Cliente': m.customerIdentifier,
      'Canal': m.channel,
      'Segmento (B2C/B2B)': m.segment || '',
      'Clasificación Empresas': m.clasificacionEmpresas || '',
      'Inbox Name': m.inboxName || '',
      'Fecha Atención': m.callDate,
      'Nota Encuesta (NPS)': m.surveyScore !== undefined ? m.surveyScore : '',
      'Satisfacción (CSAT)': m.csat || '',
      'FCR': m.fcr || '',
      'Effort (Esfuerzo)': m.effort || '',
      'Motivo de Contacto': m.contactReason || '',
      'Asesor': m.agentName,
      '_AsesorPersonalizado': m.asesorPersonalizado || '',
      'Team Leader': m.teamLeaderName,
      'Analista de Experiencia': m.analystName,
      'Estado Ciclo': m.status,
      'Área Imputable': m.areaImputable,
      'Requiere Feedback': m.requiresFeedback ? 'Sí' : 'No',
      'Categoría 1': m.category1?.categoria || '',
      'Motivo 1': m.category1?.motivo || '',
      'Causa Raíz 1': m.category1?.causaRaiz || '',
      'Categoría 2': m.category2?.categoria || '',
      'Motivo 2': m.category2?.motivo || '',
      'Causa Raíz 2': m.category2?.causaRaiz || '',
      'Hallazgo Crítico de Experiencia': m.qaFindings?.criticalFinding || '',
      'Fecha Feedback TL': m.tlFeedback?.feedbackDate || '',
      'Tipo Feedback TL': m.tlFeedback?.feedbackType || '',
      'Observaciones TL': m.tlFeedback?.observations || '',
      'Plan de Acción TL': m.tlFeedback?.actionPlan || '',
      'Compromiso del Agente': m.agentCommitment?.commitmentText || '',
      'Acción Específica Agente': m.agentCommitment?.actionStep || '',
      'Fecha Límite Compromiso': m.agentCommitment?.targetCompletionDate || '',
      'Fecha Firma Agente': m.agentCommitment?.signedAt || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Monitoreos');
  downloadWorkbook(workbook, filename);
}

/**
 * Resolves inbox_name to attention segment:
 * WA :: 59895702611 -> B2C
 * WA :: 59895700630 -> B2B
 */
export function resolveInboxSegment(rawInboxName?: string): { inboxName: string; segment: string } {
  const clean = (rawInboxName || '').toString().trim();
  if (!clean) return { inboxName: '', segment: '' };

  const normalized = clean.toLowerCase();
  if (normalized.includes('59895702611') || normalized.includes('b2c')) {
    return { inboxName: clean, segment: 'B2C' };
  }
  if (normalized.includes('59895700630') || normalized.includes('b2b')) {
    return { inboxName: clean, segment: 'B2B' };
  }
  return { inboxName: clean, segment: clean };
}

/**
 * Resolves Clasificación Empresas to attention segment:
 * "Particular" -> B2C
 * Any other value -> B2B
 */
export function resolveSegmentFromEmpresas(rawVal?: string): { clasificacionEmpresas: string; segment: string } {
  const clean = (rawVal || '').toString().trim();
  if (!clean) return { clasificacionEmpresas: '', segment: '' };

  const normalized = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized === 'particular' || normalized.includes('particular') || normalized === 'b2c') {
    return { clasificacionEmpresas: clean, segment: 'B2C' };
  }
  return { clasificacionEmpresas: clean, segment: 'B2B' };
}

/**
 * Normalizes column header keys (removes accents, spaces, underscores, lowercase)
 */
function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Looks up a value in a sheet row using candidate header names
 */
function getRowVal(row: Record<string, any>, candidates: string[]): any {
  const rowKeys = Object.keys(row);
  const normalizedCandidates = candidates.map(normalizeKey);

  // First try exact normalized match
  for (const cand of normalizedCandidates) {
    const matchedKey = rowKeys.find((k) => normalizeKey(k) === cand);
    if (
      matchedKey !== undefined &&
      row[matchedKey] !== undefined &&
      row[matchedKey] !== null &&
      row[matchedKey].toString().trim() !== ''
    ) {
      return row[matchedKey];
    }
  }
  return undefined;
}

/**
 * Parses an NPS value (0-10) from raw Excel cell value
 */
function parseNpsValue(raw: any): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') {
    if (isNaN(raw)) return null;
    return Math.max(0, Math.min(10, Math.round(raw)));
  }

  const str = raw.toString().trim();
  if (!str) return null;

  // Handle decimal comma or slash formats like "9,0" or "8/10"
  const cleaned = str.replace(',', '.');
  const numMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)/) || cleaned.match(/(-?\d+(?:\.\d+)?)/);
  if (numMatch) {
    const parsed = Math.round(parseFloat(numMatch[1]));
    if (!isNaN(parsed)) {
      return Math.max(0, Math.min(10, parsed));
    }
  }

  const lower = str.toLowerCase();
  if (lower.includes('promotor')) return 10;
  if (lower.includes('pasivo') || lower.includes('neutro')) return 8;
  if (lower.includes('detractor')) return 3;

  return null;
}

/**
 * Parses Excel serial number or various date string formats into YYYY-MM-DD
 */
function parseExcelDate(raw: any): string {
  if (raw === undefined || raw === null || raw === '') {
    return new Date().toISOString().substring(0, 10);
  }

  // Excel serial number (days since 1899-12-30)
  if (typeof raw === 'number' && !isNaN(raw)) {
    const parsed = XLSX.SSF?.parse_date_code?.(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const utcDays = Math.floor(raw - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  }

  const str = raw.toString().trim();

  // Match DD/MM/YYYY or DD-MM-YYYY (with optional time)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return str.substring(0, 10);
}

/**
 * Downloads an official Excel template for uploading Voice or Chat NPS surveys
 */
export function downloadSurveyTemplate(channel: 'Voz' | 'Chat', filename?: string) {
  const defaultName = filename || `Plantilla_Carga_Encuestas_NPS_${channel.toUpperCase()}.xlsx`;
  const exampleRows = channel === 'Voz' ? [
    {
      'Ticket': 'TK-99101',
      'Línea o Identificador Cliente': '+57 300 123 4567',
      'Fecha Encuesta (AAAA-MM-DD)': '2026-11-10',
      'Hora (HH:mm)': '10:30',
      'NPS': 2,
      'Nombre Asesor': 'Carlos Méndez',
      'Comentario / Verbatim del Cliente': 'El asesor me colgó la llamada sin darme una solución sobre el cobro duplicado.',
      'Duración Llamada (segundos)': 320,
      'ID Grabación Audio': 'REC-VOZ-99101.wav',
    },
    {
      'Ticket': 'TK-99102',
      'Línea o Identificador Cliente': '+57 312 456 7890',
      'Fecha Encuesta (AAAA-MM-DD)': '2026-11-10',
      'Hora (HH:mm)': '11:15',
      'NPS': 9,
      'Nombre Asesor': 'Sofía Valenzuela',
      'Comentario / Verbatim del Cliente': 'Excelente atención, muy clara la explicación de mi plan.',
      'Duración Llamada (segundos)': 190,
      'ID Grabación Audio': 'REC-VOZ-99102.wav',
    },
    {
      'Ticket': 'TK-99103',
      'Línea o Identificador Cliente': '+57 315 789 0123',
      'Fecha Encuesta (AAAA-MM-DD)': '2026-11-10',
      'Hora (HH:mm)': '11:45',
      'NPS': 4,
      'Nombre Asesor': 'Diego Morales',
      'Comentario / Verbatim del Cliente': 'Tardaron demasiado en atenderme y no me dieron número de radicado.',
      'Duración Llamada (segundos)': 410,
      'ID Grabación Audio': 'REC-VOZ-99103.wav',
    },
  ] : [
    {
      'NroLlamante': '59899112233',
      'Fecha Encuesta': '2026-11-13',
      'NPS': 2,
      'Satisfacción': 2,
      'Effort': 5,
      'FCR': 'No',
      'Clasificación Empresas': 'Particular',
      'Nombre Asesor': 'Javier Ríos',
      '_AsesorPersonalizado': 'No',
    },
    {
      'NroLlamante': '59894556677',
      'Fecha Encuesta': '2026-11-13',
      'NPS': 4,
      'Satisfacción': 3,
      'Effort': 4,
      'FCR': 'No',
      'Clasificación Empresas': 'Corporativo',
      'Nombre Asesor': 'Camila Navarro',
      '_AsesorPersonalizado': 'Sí',
    },
    {
      'NroLlamante': '59898776655',
      'Fecha Encuesta': '2026-11-13',
      'NPS': 10,
      'Satisfacción': 5,
      'Effort': 1,
      'FCR': 'Sí',
      'Clasificación Empresas': 'Particular',
      'Nombre Asesor': 'Lucía Benítez',
      '_AsesorPersonalizado': 'No',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(exampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Encuestas_${channel}`);
  downloadWorkbook(workbook, defaultName);
}

/**
 * Exports surveys list to Excel
 */
export function exportSurveysToExcel(surveys: SurveyItem[], filename = 'Encuestas_NPS_NEXA-CX.xlsx') {
  const rows = surveys.map((s) => ({
    'ID Encuesta': s.id,
    'Canal': s.channel,
    'Segmento (B2C/B2B)': s.segment || '',
    'Clasificación Empresas': s.clasificacionEmpresas || '',
    'Inbox Name': s.inboxName || '',
    'Chat ID / Ticket': s.chatId || s.ticketNumber,
    'NroLlamante / Móvil': s.phoneOrLine || s.customerIdentifier,
    'Fecha Encuesta': s.surveyDate,
    'NPS': s.npsScore,
    'Clasificación NPS': s.npsType,
    'Satisfacción (CSAT)': s.csat || '',
    'Effort': s.effort || '',
    'FCR': s.fcr || '',
    'Nombre Asesor': s.agentName || 'No asignado',
    '_AsesorPersonalizado': s.asesorPersonalizado || '',
    'Verbatim': s.customerComment || '',
    'Canalizado a Bandeja': s.hasGeneratedPending ? 'Sí (Detractor)' : 'No',
    'Lote de Carga': s.batchId || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Encuestas_NPS');
  downloadWorkbook(workbook, filename);
}

/**
 * Parses an uploaded Excel or CSV file of daily NPS surveys
 */
export async function parseSurveysFromFile(
  file: File, 
  channel: 'Voz' | 'Chat'
): Promise<{
  success: boolean;
  surveys: Omit<SurveyItem, 'id' | 'createdAt' | 'npsType' | 'hasGeneratedPending'>[];
  errors: string[];
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Select sheet containing NPS / Chat ID / Ticket headers if multiple sheets exist
        let targetSheetName = workbook.SheetNames[0];
        let headerRowIndex = 0;

        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          const scanLimit = Math.min(matrix.length, 15);
          let found = false;
          for (let r = 0; r < scanLimit; r++) {
            const cells = (matrix[r] || []).map((c) => normalizeKey(String(c ?? '')));
            if (
              cells.includes('nps') ||
              cells.includes('nrollamante') ||
              cells.includes('chatid') ||
              cells.includes('clasificacionempresas') ||
              (cells.includes('fechaencuesta') && cells.includes('nombreasesor')) ||
              (cells.includes('fecha') && cells.includes('asesor'))
            ) {
              targetSheetName = name;
              headerRowIndex = r;
              found = true;
              break;
            }
          }
          if (found) break;
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });

        if (!rawJson || rawJson.length === 0) {
          resolve({
            success: false,
            surveys: [],
            errors: ['El archivo Excel está vacío o no contiene filas de datos.'],
          });
          return;
        }

        const parsedList: Omit<SurveyItem, 'id' | 'createdAt' | 'npsType' | 'hasGeneratedPending'>[] = [];
        const errors: string[] = [];

        // Detect if an exact "NPS" column exists in the sheet headers
        const sampleKeys = Object.keys(rawJson[0] || {});
        const exactNpsHeaderKey = sampleKeys.find((k) => normalizeKey(k) === 'nps');

        rawJson.forEach((row, idx) => {
          // Skip completely blank trailing rows
          const hasAnyValue = Object.values(row).some(
            (v) => v !== undefined && v !== null && v.toString().trim() !== ''
          );
          if (!hasAnyValue) return;

          const dateVal = getRowVal(row, ['Fecha Encuesta', 'FECHA', 'Fecha de la encuesta', 'Fecha Encuesta (AAAA-MM-DD)', 'Fecha']);
          const date = parseExcelDate(dateVal);

          const chatIdVal = getRowVal(row, ['Chat ID', 'chat_id', 'ChatID', 'Codigo del chat', 'Codigo Chat']);
          const ticketVal = getRowVal(row, ['Ticket', 'Numero Ticket', 'TK']);
          const fallbackCode = `${channel === 'Chat' ? 'CHAT' : 'TK'}-${date.replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`;
          const ticket = (chatIdVal ?? ticketVal ?? fallbackCode).toString().trim();

          const phoneVal = getRowVal(row, ['NroLlamante', 'Nro Llamante', 'Nro_Llamante', 'Móvil', 'Movil', 'Linea del cliente', 'Linea', 'Telefono', 'Celular', 'Línea o Identificador Cliente', 'Cliente', 'Identificador']);
          const customerId = (phoneVal !== undefined ? phoneVal.toString().trim() : 'Sin línea');

          const timeVal = getRowVal(row, ['Hora (HH:mm)', 'Hora']);
          const time = timeVal ? timeVal.toString().trim() : undefined;

          // Strictly read from the column named "NPS" when present in the file
          const scoreRaw = exactNpsHeaderKey !== undefined
            ? row[exactNpsHeaderKey]
            : getRowVal(row, ['NPS', 'Nota de la encuesta', 'Calificación NPS (0 a 10)', 'Calificacion NPS', 'Calificacion', 'Score', 'Nota']);

          const parsedScore = parseNpsValue(scoreRaw);
          if (parsedScore === null) {
            if (scoreRaw !== undefined && scoreRaw !== null && scoreRaw.toString().trim() !== '') {
              errors.push(`Fila ${headerRowIndex + idx + 2}: El valor "${scoreRaw}" en la columna NPS no es numérico válido (0 a 10).`);
            } else {
              errors.push(`Fila ${headerRowIndex + idx + 2}: La columna NPS está vacía.`);
            }
            return;
          }
          const score = parsedScore;

          const csatVal = getRowVal(row, ['Satisfacción', 'Satisfaccion', 'CSAT']);
          const csat = csatVal !== undefined ? csatVal.toString().trim() : undefined;

          const effortVal = getRowVal(row, ['Effort', 'Esfuerzo', 'Esfuerzo del cliente', 'CES']);
          const effort = effortVal !== undefined ? effortVal.toString().trim() : undefined;

          const fcrVal = getRowVal(row, ['FCR', 'Resolución', 'Resolucion', 'Resolucion FCR']);
          const fcr = fcrVal !== undefined ? fcrVal.toString().trim() : undefined;

          // Clasificación Empresas: "Particular" -> B2C, resto -> B2B (fallback to inbox_name if absent)
          const clasifEmpRaw = getRowVal(row, ['Clasificación Empresas', 'Clasificacion Empresas', 'Clasificacion Empresa']);
          const inboxRaw = getRowVal(row, ['inbox_name', 'inboxName', 'Inbox', 'Canal de atencion', 'Canal atención']);

          const empResolved = resolveSegmentFromEmpresas(clasifEmpRaw !== undefined ? clasifEmpRaw.toString() : undefined);
          const inboxResolved = resolveInboxSegment(inboxRaw !== undefined ? inboxRaw.toString() : undefined);

          const segment = empResolved.segment || inboxResolved.segment;
          const clasificacionEmpresas = empResolved.clasificacionEmpresas;
          const inboxName = inboxResolved.inboxName;

          const agentVal = getRowVal(row, ['Nombre Asesor', 'Asesor', 'Nombre del asesor', 'Agente']);
          const agentName = agentVal ? agentVal.toString().trim() : '';

          const asesorPersVal = getRowVal(row, ['_AsesorPersonalizado', 'AsesorPersonalizado', 'Asesor Personalizado']);
          const asesorPersonalizado = asesorPersVal !== undefined ? asesorPersVal.toString().trim() : undefined;

          const commentVal = getRowVal(row, ['Verbatim', 'Comentario del cliente', 'Comentario / Verbatim del Cliente', 'Comentario', 'Observacion']);
          const comment = commentVal ? commentVal.toString().trim() : '';

          const durationVal = getRowVal(row, ['Duración Llamada (segundos)', 'Duracion']);
          const duration = durationVal !== undefined ? parseInt(durationVal.toString(), 10) || 240 : 240;

          parsedList.push({
            ticketNumber: ticket,
            chatId: chatIdVal ? chatIdVal.toString().trim() : undefined,
            customerIdentifier: customerId,
            channel,
            inboxName: inboxName || undefined,
            segment: segment || undefined,
            clasificacionEmpresas: clasificacionEmpresas || undefined,
            surveyDate: date,
            surveyTime: time,
            npsScore: score,
            agentName: agentName || undefined,
            asesorPersonalizado: asesorPersonalizado || undefined,
            customerComment: comment || undefined,
            phoneOrLine: customerId,
            csat: csat || undefined,
            fcr: fcr || undefined,
            effort: effort || undefined,
            callDurationSec: duration,
          });
        });

        resolve({
          success: parsedList.length > 0,
          surveys: parsedList,
          errors,
        });
      } catch (err: any) {
        resolve({
          success: false,
          surveys: [],
          errors: [`Error al procesar el archivo Excel: ${err?.message || 'Formato no válido'}`],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        surveys: [],
        errors: ['No se pudo leer el archivo seleccionado.'],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Downloads an official Excel template for bulk replacement of Contact Reasons
 */
export function downloadContactReasonTemplate(filename = 'Plantilla_Motivos_Contacto.xlsx') {
  const exampleRows = [
    {
      'MOTIVO DE CONTACTO': 'Reclamo de Facturación',
      'DESCRIPCION': 'Consultas o reclamos relacionados con cobros, facturas emitidas o ajustes de saldo.',
    },
    {
      'MOTIVO DE CONTACTO': 'Falla Técnica / Conectividad',
      'DESCRIPCION': 'Inconvenientes de acceso, cortes, intermitencias o errores técnicos en el servicio.',
    },
    {
      'MOTIVO DE CONTACTO': 'Consulta Comercial / Planes',
      'DESCRIPCION': 'Solicitudes de información sobre tarifas, promociones, cambios de plan o contrataciones.',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(exampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Motivos_Contacto');
  downloadWorkbook(workbook, filename);
}

/**
 * Exports current Contact Reasons list to Excel
 */
export function exportContactReasonsToExcel(
  reasons: ContactReasonItem[],
  filename = 'Motivos_Contacto_Actuales.xlsx'
) {
  const rows = reasons.map((r) => ({
    'MOTIVO DE CONTACTO': r.name,
    'DESCRIPCION': r.description || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Motivos_Contacto');
  downloadWorkbook(workbook, filename);
}

/**
 * Parses an uploaded Excel or CSV file of Contact Reasons (MOTIVO DE CONTACTO + DESCRIPCION)
 */
export async function parseContactReasonsFromFile(file: File): Promise<{
  success: boolean;
  reasons: ContactReasonItem[];
  rowCount: number;
  errors: string[];
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let targetSheetName = workbook.SheetNames[0];
        let headerRowIndex = 0;

        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          const scanLimit = Math.min(matrix.length, 15);
          let found = false;
          for (let r = 0; r < scanLimit; r++) {
            const cells = (matrix[r] || []).map((c) => normalizeKey(String(c ?? '')));
            if (
              cells.some((c) => c === 'motivodecontacto' || c === 'motivocontacto' || c === 'motivo') &&
              (cells.some((c) => c.startsWith('descripcion')) || cells.length >= 1)
            ) {
              targetSheetName = name;
              headerRowIndex = r;
              found = true;
              break;
            }
          }
          if (found) break;
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });

        if (!rows || rows.length === 0) {
          return resolve({
            success: false,
            reasons: [],
            rowCount: 0,
            errors: ['El archivo Excel está vacío o no contiene filas de datos.'],
          });
        }

        const today = new Date().toISOString().split('T')[0];
        const reasonMap = new Map<string, ContactReasonItem>();
        const errors: string[] = [];
        let processedRows = 0;

        rows.forEach((row, idx) => {
          const hasAnyValue = Object.values(row).some(
            (v) => v !== undefined && v !== null && v.toString().trim() !== ''
          );
          if (!hasAnyValue) return;

          processedRows++;

          const nameRaw = getRowVal(row, [
            'MOTIVO DE CONTACTO',
            'Motivo de Contacto',
            'Motivo Contacto',
            'MOTIVO',
            'Motivo',
            'Nombre del Motivo',
            'Nombre',
          ]);
          const descRaw = getRowVal(row, [
            'DESCRIPCION',
            'DESCRIPCIÓN',
            'Descripción',
            'Descripcion',
            'Descripción / Criterio',
            'Detalle',
          ]);

          const name = (nameRaw ?? '').toString().trim();
          const description = (descRaw ?? '').toString().trim();

          if (!name) {
            errors.push(`Fila ${headerRowIndex + idx + 2}: La columna MOTIVO DE CONTACTO está vacía.`);
            return;
          }

          const key = normalizeKey(name) || name.toLowerCase();
          const existing = reasonMap.get(key);
          if (!existing) {
            reasonMap.set(key, {
              id: `mot-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
              name,
              description,
              active: true,
              createdAt: today,
            });
          } else if (!existing.description && description) {
            existing.description = description;
          }
        });

        const parsedReasons = Array.from(reasonMap.values());
        resolve({
          success: parsedReasons.length > 0,
          reasons: parsedReasons,
          rowCount: processedRows,
          errors,
        });
      } catch (err: any) {
        resolve({
          success: false,
          reasons: [],
          rowCount: 0,
          errors: [`Error al procesar el archivo Excel: ${err?.message || 'Formato no válido'}`],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        reasons: [],
        rowCount: 0,
        errors: ['No se pudo leer el archivo seleccionado.'],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Downloads an official Excel template for bulk uploading users
 */
export function downloadUserTemplate(filename = 'Plantilla_Carga_Usuarios.xlsx') {
  const exampleRows = [
    {
      'Correo Xtendo': 'maria.lopez@xtendo-it.com',
      'Nombre': 'María López',
      'Rol': 'Asesor',
    },
    {
      'Correo Xtendo': 'juan.perez@xtendo-it.com',
      'Nombre': 'Juan Pérez',
      'Rol': 'Team Leader',
    },
    {
      'Correo Xtendo': 'ana.garcia@xtendo-it.com',
      'Nombre': 'Ana García',
      'Rol': 'Analista',
    },
    {
      'Correo Xtendo': 'luis.torres@xtendo-it.com',
      'Nombre': 'Luis Torres',
      'Rol': 'Coordinador',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(exampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');
  downloadWorkbook(workbook, filename);
}

/**
 * Normalizes role text from Excel to allowed bulk UserRole values.
 * Admin cannot be created via Excel bulk upload.
 */
function normalizeBulkUserRole(rawRole: any): { role?: UserRole; isAdminAttempt?: boolean; invalid?: string } {
  const clean = (rawRole ?? '').toString().trim();
  if (!clean) return { invalid: '' };

  const norm = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (norm === 'admin' || norm === 'administrador' || norm === 'superadmin') {
    return { isAdminAttempt: true, invalid: clean };
  }
  if (norm === 'asesor' || norm === 'agente') {
    return { role: 'asesor' };
  }
  if (norm === 'team leader' || norm === 'teamleader' || norm === 'tl' || norm === 'lider') {
    return { role: 'team_leader' };
  }
  if (norm === 'analista' || norm.startsWith('analista') || norm === 'qa' || norm === 'cx') {
    return { role: 'analista' };
  }
  if (norm === 'coordinador' || norm === 'coordinadora' || norm === 'coord') {
    return { role: 'coordinador' };
  }

  return { invalid: clean };
}

/**
 * Parses an uploaded Excel or CSV file of users (Correo Xtendo, Nombre, Rol)
 */
export async function parseUsersFromFile(
  file: File,
  existingUsers: User[]
): Promise<{
  success: boolean;
  users: Omit<User, 'id'>[];
  rowCount: number;
  errors: string[];
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let targetSheetName = workbook.SheetNames[0];
        let headerRowIndex = 0;

        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          const scanLimit = Math.min(matrix.length, 15);
          let found = false;
          for (let r = 0; r < scanLimit; r++) {
            const cells = (matrix[r] || []).map((c) => normalizeKey(String(c ?? '')));
            if (
              cells.some((c) => c === 'correoxtendo' || c === 'correo' || c === 'email' || c === 'correoelectronico') &&
              (cells.some((c) => c.startsWith('nombre')) || cells.some((c) => c === 'rol' || c === 'perfil'))
            ) {
              targetSheetName = name;
              headerRowIndex = r;
              found = true;
              break;
            }
          }
          if (found) break;
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });

        if (!rows || rows.length === 0) {
          return resolve({
            success: false,
            users: [],
            rowCount: 0,
            errors: ['El archivo Excel está vacío o no contiene filas de datos.'],
          });
        }

        const existingEmails = new Set(existingUsers.map((u) => u.email.trim().toLowerCase()));
        const seenEmails = new Set<string>();
        const parsedUsers: Omit<User, 'id'>[] = [];
        const errors: string[] = [];

        const prefixByRole: Record<UserRole, string> = {
          asesor: 'AGT',
          team_leader: 'TL',
          analista: 'EXP',
          coordinador: 'CRD',
          admin: 'ADM',
        };

        rows.forEach((row, idx) => {
          const hasAnyValue = Object.values(row).some(
            (v) => v !== undefined && v !== null && v.toString().trim() !== ''
          );
          if (!hasAnyValue) return;

          const rowNum = headerRowIndex + idx + 2;

          const emailRaw = getRowVal(row, [
            'Correo Xtendo',
            'Correo Xtendo:',
            'Correo',
            'Correo:',
            'Correo Electrónico',
            'Correo Electronico',
            'Email',
            'E-mail',
          ]);
          const nameRaw = getRowVal(row, [
            'Nombre',
            'Nombre:',
            'Nombre Completo',
            'Nombre y Apellido',
            'Usuario',
          ]);
          const roleRaw = getRowVal(row, [
            'Rol',
            'Rol:',
            'Perfil',
            'Rol en el Sistema',
          ]);

          const email = (emailRaw ?? '').toString().trim();
          const name = (nameRaw ?? '').toString().trim();

          if (!email) {
            errors.push(`Fila ${rowNum}: El campo "Correo Xtendo" está vacío.`);
            return;
          }
          if (!email.includes('@')) {
            errors.push(`Fila ${rowNum}: El correo "${email}" no tiene un formato válido.`);
            return;
          }
          if (!name) {
            errors.push(`Fila ${rowNum}: El campo "Nombre" está vacío.`);
            return;
          }

          const lowerEmail = email.toLowerCase();
          if (existingEmails.has(lowerEmail) || seenEmails.has(lowerEmail)) {
            errors.push(`Fila ${rowNum}: El correo "${email}" ya existe en el sistema o está duplicado en el archivo.`);
            return;
          }

          const roleResult = normalizeBulkUserRole(roleRaw);
          if (roleResult.isAdminAttempt) {
            errors.push(
              `Fila ${rowNum}: El rol "${roleResult.invalid}" no está permitido en carga masiva. El perfil Admin solo puede ser creado por otro Admin en la herramienta.`
            );
            return;
          }
          if (!roleResult.role) {
            errors.push(
              `Fila ${rowNum}: Rol "${roleResult.invalid || 'vacío'}" no válido. Valores permitidos: Asesor, Team Leader, Analista, Coordinador.`
            );
            return;
          }

          seenEmails.add(lowerEmail);
          const role = roleResult.role;
          const codeNum = existingUsers.length + parsedUsers.length + 101;
          const employeeCode = `${prefixByRole[role]}-${codeNum}`;

          parsedUsers.push({
            name,
            email,
            employeeCode,
            role,
            status: 'active',
            department: 'Operaciones y Contact Center',
          });
        });

        resolve({
          success: parsedUsers.length > 0,
          users: parsedUsers,
          rowCount: parsedUsers.length,
          errors,
        });
      } catch (err: any) {
        resolve({
          success: false,
          users: [],
          rowCount: 0,
          errors: [`Error al procesar el archivo Excel: ${err?.message || 'Formato no válido'}`],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        users: [],
        rowCount: 0,
        errors: ['No se pudo leer el archivo seleccionado.'],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}


