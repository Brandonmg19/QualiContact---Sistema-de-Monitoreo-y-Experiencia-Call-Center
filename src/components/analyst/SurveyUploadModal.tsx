import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SurveyItem } from '../../types';
import { 
  X, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  Info
} from 'lucide-react';
import { downloadSurveyTemplate, parseSurveysFromFile } from '../../utils/excel';

interface SurveyUploadModalProps {
  isOpen: boolean;
  channel: 'Voz' | 'Chat';
  onClose: () => void;
  onSuccess: (result: { totalImported: number; detractorsFound: number }) => void;
}

export const SurveyUploadModal: React.FC<SurveyUploadModalProps> = ({
  isOpen,
  channel,
  onClose,
  onSuccess,
}) => {
  const { users, importSurveys } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<Omit<SurveyItem, 'id' | 'createdAt' | 'npsType' | 'hasGeneratedPending'>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  // Real sample agents
  const advisors = users.filter((u) => u.role === 'asesor');

  // Generate a realistic demo batch for one-click testing
  const handleLoadDemoBatch = () => {
    const today = new Date().toISOString().substring(0, 10);
    const demoItems = channel === 'Voz' ? [
      {
        ticketNumber: `TK-VOZ-${Date.now().toString().slice(-4)}1`,
        customerIdentifier: '+57 300 456 7890 (C.C. 10293841)',
        channel: 'Voz' as const,
        surveyDate: today,
        surveyTime: '09:40',
        npsScore: 2,
        agentName: advisors[0]?.name || 'Carlos Méndez',
        agentId: advisors[0]?.id,
        customerComment: 'El asesor me cortó la llamada cuando le pedí que me explicara un cobro no reconocido de 45 dólares.',
        phoneOrLine: '+57 300 456 7890',
        callDurationSec: 360,
      },
      {
        ticketNumber: `TK-VOZ-${Date.now().toString().slice(-4)}2`,
        customerIdentifier: '+57 312 987 6543 (C.C. 52849102)',
        channel: 'Voz' as const,
        surveyDate: today,
        surveyTime: '10:15',
        npsScore: 4,
        agentName: advisors[2]?.name || 'Diego Morales',
        agentId: advisors[2]?.id,
        customerComment: 'Me tuvieron 25 minutos en espera para decirme que debía acercarme a una sucursal física. Cero solución telefónica.',
        phoneOrLine: '+57 312 987 6543',
        callDurationSec: 480,
      },
      {
        ticketNumber: `TK-VOZ-${Date.now().toString().slice(-4)}3`,
        customerIdentifier: '+57 315 111 2233',
        channel: 'Voz' as const,
        surveyDate: today,
        surveyTime: '10:50',
        npsScore: 1,
        agentName: advisors[4]?.name || 'Javier Ríos',
        agentId: advisors[4]?.id,
        customerComment: 'El asesor fue grosero y me habló de mala gana cuando no entendí los términos del contrato.',
        phoneOrLine: '+57 315 111 2233',
        callDurationSec: 290,
      },
      {
        ticketNumber: `TK-VOZ-${Date.now().toString().slice(-4)}4`,
        customerIdentifier: '+57 318 444 5566',
        channel: 'Voz' as const,
        surveyDate: today,
        surveyTime: '11:20',
        npsScore: 5,
        agentName: advisors[1]?.name || 'Sofía Valenzuela',
        agentId: advisors[1]?.id,
        customerComment: 'La llamada se escuchaba muy bajita y el asesor no me ofreció devolverme la llamada.',
        phoneOrLine: '+57 318 444 5566',
        callDurationSec: 210,
      },
      {
        ticketNumber: `TK-VOZ-${Date.now().toString().slice(-4)}5`,
        customerIdentifier: '+57 311 777 8899',
        channel: 'Voz' as const,
        surveyDate: today,
        surveyTime: '12:00',
        npsScore: 8,
        agentName: advisors[3]?.name || 'Lucía Benítez',
        agentId: advisors[3]?.id,
        customerComment: 'Atención aceptable, aunque la música de espera estaba demasiado alta.',
        phoneOrLine: '+57 311 777 8899',
        callDurationSec: 240,
      },
      {
        ticketNumber: `TK-VOZ-${Date.now().toString().slice(-4)}6`,
        customerIdentifier: '+57 301 333 4455',
        channel: 'Voz' as const,
        surveyDate: today,
        surveyTime: '12:45',
        npsScore: 10,
        agentName: advisors[1]?.name || 'Sofía Valenzuela',
        agentId: advisors[1]?.id,
        customerComment: 'Excelente atención, muy clara, rápida y educada. Resolvió mi cambio de plan inmediatamente.',
        phoneOrLine: '+57 301 333 4455',
        callDurationSec: 195,
      },
      {
        ticketNumber: `TK-VOZ-${Date.now().toString().slice(-4)}7`,
        customerIdentifier: '+57 300 888 9911',
        channel: 'Voz' as const,
        surveyDate: today,
        surveyTime: '13:10',
        npsScore: 9,
        agentName: advisors[0]?.name || 'Carlos Méndez',
        agentId: advisors[0]?.id,
        customerComment: 'Muy buen servicio y amabilidad en la llamada.',
        phoneOrLine: '+57 300 888 9911',
        callDurationSec: 180,
      },
      {
        ticketNumber: `TK-VOZ-${Date.now().toString().slice(-4)}8`,
        customerIdentifier: '+57 314 222 6677',
        channel: 'Voz' as const,
        surveyDate: today,
        surveyTime: '14:30',
        npsScore: 7,
        agentName: advisors[5]?.name || 'Camila Navarro',
        agentId: advisors[5]?.id,
        customerComment: 'Me atendió bien pero el trámite tarda 48 horas en verse reflejado.',
        phoneOrLine: '+57 314 222 6677',
        callDurationSec: 260,
      },
    ] : [
      {
        ticketNumber: `CHAT-${Date.now().toString().slice(-4)}1`,
        customerIdentifier: '59895222334',
        channel: 'Chat' as const,
        clasificacionEmpresas: 'Particular',
        segment: 'B2C',
        surveyDate: today,
        npsScore: 1,
        agentName: advisors[4]?.name || 'Javier Ríos',
        agentId: advisors[4]?.id,
        asesorPersonalizado: 'No',
        phoneOrLine: '59895222334',
        csat: '2',
        fcr: 'No',
        effort: '5',
      },
      {
        ticketNumber: `CHAT-${Date.now().toString().slice(-4)}2`,
        customerIdentifier: '59899888900',
        channel: 'Chat' as const,
        clasificacionEmpresas: 'Corporativo',
        segment: 'B2B',
        surveyDate: today,
        npsScore: 3,
        agentName: advisors[5]?.name || 'Camila Navarro',
        agentId: advisors[5]?.id,
        asesorPersonalizado: 'Sí',
        phoneOrLine: '59899888900',
        csat: '2',
        fcr: 'No',
        effort: '4',
      },
      {
        ticketNumber: `CHAT-${Date.now().toString().slice(-4)}3`,
        customerIdentifier: '59891777112',
        channel: 'Chat' as const,
        clasificacionEmpresas: 'Particular',
        segment: 'B2C',
        surveyDate: today,
        npsScore: 4,
        agentName: advisors[0]?.name || 'Carlos Méndez',
        agentId: advisors[0]?.id,
        asesorPersonalizado: 'No',
        phoneOrLine: '59891777112',
        csat: '3',
        fcr: 'No',
        effort: '4',
      },
      {
        ticketNumber: `CHAT-${Date.now().toString().slice(-4)}4`,
        customerIdentifier: '59894333448',
        channel: 'Chat' as const,
        clasificacionEmpresas: 'Pyme',
        segment: 'B2B',
        surveyDate: today,
        npsScore: 9,
        agentName: advisors[3]?.name || 'Lucía Benítez',
        agentId: advisors[3]?.id,
        asesorPersonalizado: 'Sí',
        phoneOrLine: '59894333448',
        csat: '5',
        fcr: 'Sí',
        effort: '1',
      },
      {
        ticketNumber: `CHAT-${Date.now().toString().slice(-4)}5`,
        customerIdentifier: '59896999001',
        channel: 'Chat' as const,
        clasificacionEmpresas: 'Particular',
        segment: 'B2C',
        surveyDate: today,
        npsScore: 8,
        agentName: advisors[2]?.name || 'Diego Morales',
        agentId: advisors[2]?.id,
        asesorPersonalizado: 'No',
        phoneOrLine: '59896999001',
        csat: '4',
        fcr: 'Sí',
        effort: '2',
      },
      {
        ticketNumber: `CHAT-${Date.now().toString().slice(-4)}6`,
        customerIdentifier: '59898444882',
        channel: 'Chat' as const,
        clasificacionEmpresas: 'Particular',
        segment: 'B2C',
        surveyDate: today,
        npsScore: 10,
        agentName: advisors[1]?.name || 'Sofía Valenzuela',
        agentId: advisors[1]?.id,
        asesorPersonalizado: 'No',
        phoneOrLine: '59898444882',
        csat: '5',
        fcr: 'Sí',
        effort: '1',
      },
    ];

    setParsedRows(demoItems);
    setErrors([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setIsParsing(true);
    setErrors([]);

    const result = await parseSurveysFromFile(selected, channel);
    setIsParsing(false);

    if (result.success) {
      setParsedRows(result.surveys);
    } else {
      setErrors(result.errors);
      setParsedRows([]);
    }
  };

  const detractorsCount = parsedRows.filter((r) => r.npsScore <= 6).length;
  const passivesCount = parsedRows.filter((r) => r.npsScore >= 7 && r.npsScore <= 8).length;
  const promotersCount = parsedRows.filter((r) => r.npsScore >= 9).length;

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    const result = importSurveys(parsedRows, channel);
    onSuccess(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className={`p-5 border-b border-slate-200 flex items-center justify-between ${
          channel === 'Voz' 
            ? 'bg-gradient-to-r from-blue-900 to-indigo-900 text-white' 
            : 'bg-gradient-to-r from-slate-900 to-teal-950 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              {channel === 'Voz' ? (
                <Phone className="w-5 h-5 text-blue-200" />
              ) : (
                <MessageSquare className="w-5 h-5 text-teal-200" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Carga de Base de Encuestas NPS — Canal {channel.toUpperCase()}
              </h2>
              <p className="text-xs text-slate-300">
                El sistema detectará automáticamente las encuestas detractoras (NPS ≤ 6) y las agregará como pendientes de análisis en tu bandeja.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Quick Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span className="font-semibold text-slate-800">
                Formato admitido: Excel (.xlsx, .xls) o CSV
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadSurveyTemplate(channel)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium rounded-lg text-xs transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Plantilla Excel</span>
              </button>

              <button
                type="button"
                onClick={handleLoadDemoBatch}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-medium rounded-lg text-xs transition-colors shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cargar Lote de Prueba (Demo)</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop File Input */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              isDragging
                ? 'border-indigo-600 bg-indigo-50/50'
                : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) {
                setFile(dropped);
                setIsParsing(true);
                parseSurveysFromFile(dropped, channel).then((res) => {
                  setIsParsing(false);
                  if (res.success) {
                    setParsedRows(res.surveys);
                    setErrors([]);
                  } else {
                    setErrors(res.errors);
                  }
                });
              }
            }}
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-2">
              <Upload className="w-5 h-5" />
            </div>

            <label className="cursor-pointer">
              <span className="font-bold text-indigo-600 hover:text-indigo-800">
                Selecciona un archivo
              </span>
              <span className="text-slate-500"> o arrástralo y suéltalo aquí</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-slate-400 mt-1">
              {file
                ? `Archivo: ${file.name}`
                : channel === 'Chat'
                ? 'Columnas esperadas: NroLlamante, Fecha Encuesta, NPS, Satisfacción, Effort, FCR, Clasificación Empresas, Nombre Asesor, _AsesorPersonalizado'
                : 'Columnas esperadas: Ticket, Cliente, Fecha, NPS, Nombre Asesor, Comentario'}
            </p>
            {channel === 'Chat' && !file && (
              <p className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2.5 py-1 mt-2 inline-block font-medium">
                Clasificación Empresas: "Particular" → B2C | Resto de clasificaciones → B2B
              </p>
            )}
          </div>

          {/* Loading Indicator */}
          {isParsing && (
            <div className="p-4 text-center text-slate-500 animate-pulse">
              Analizando archivo y clasificando encuestas NPS...
            </div>
          )}

          {/* Errors Banner */}
          {errors.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Se encontraron errores en el archivo:</span>
              </div>
              <ul className="list-disc pl-5 text-[11px]">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Breakdown Preview when data is parsed */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  Resumen de Clasificación Automática ({parsedRows.length} encuestas)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Metodología NPS Estándar
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {/* Detractors */}
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px]">🔴 Detractoras (0 a 6)</span>
                    <span className="font-mono text-base font-extrabold">{detractorsCount}</span>
                  </div>
                  <p className="text-[10px] text-rose-700 mt-1 font-medium">
                    ⚠️ Se enviarán a tu Bandeja de Analista
                  </p>
                </div>

                {/* Passives */}
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px]">🟡 Pasivas (7 a 8)</span>
                    <span className="font-mono text-base font-extrabold">{passivesCount}</span>
                  </div>
                  <p className="text-[10px] text-amber-700 mt-1">
                    Atención neutral / registro histórico
                  </p>
                </div>

                {/* Promoters */}
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px]">🟢 Promotoras (9 a 10)</span>
                    <span className="font-mono text-base font-extrabold">{promotersCount}</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 mt-1">
                    Experiencia destacada
                  </p>
                </div>
              </div>

              {/* Callout about auto generation of pending forms */}
              {detractorsCount > 0 && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-2.5 text-indigo-900">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <span className="font-bold">Regla de Negocio de Experiencia:</span>
                    <p className="mt-0.5">
                      Al confirmar la carga, las <strong>{detractorsCount} encuestas detractoras</strong> generarán automáticamente formularios de análisis pendientes en tu bandeja de analista, con el ticket, cliente, asesor y el verbatim del usuario listos para auditar.
                    </p>
                  </div>
                </div>
              )}

              {/* Table Preview (first 4 items) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-2 bg-slate-50 border-b border-slate-200 font-semibold text-[11px] text-slate-700">
                  Vista Previa de Muestras Detectadas
                </div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {parsedRows.slice(0, 5).map((row, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between gap-3 text-[11px]">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900">{row.chatId || row.ticketNumber}</span>
                          {row.segment && (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              row.segment === 'B2B'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-teal-100 text-teal-800 border border-teal-200'
                            }`} title={row.clasificacionEmpresas || row.inboxName}>
                              {row.segment}{row.clasificacionEmpresas ? ` · ${row.clasificacionEmpresas}` : ''}
                            </span>
                          )}
                          <span className="text-slate-500">· NroLlamante: {row.phoneOrLine || row.customerIdentifier}</span>
                          <span className="text-slate-600 font-medium">· {row.agentName || 'Sin asesor'}</span>
                          <span className="text-slate-400 font-mono text-[10px]">· {row.surveyDate}</span>
                        </div>
                        {(row.csat || row.fcr || row.effort || row.asesorPersonalizado || row.inboxName) && (
                          <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
                            {row.csat && <span>CSAT: <strong className="text-slate-700">{row.csat}</strong></span>}
                            {row.effort && <span>Effort: <strong className="text-slate-700">{row.effort}</strong></span>}
                            {row.fcr && <span>FCR: <strong className="text-slate-700">{row.fcr}</strong></span>}
                            {row.asesorPersonalizado && <span>Asesor Personalizado: <strong className="text-slate-700">{row.asesorPersonalizado}</strong></span>}
                            {row.inboxName && <span>Inbox: <strong className="text-slate-700 font-mono">{row.inboxName}</strong></span>}
                          </div>
                        )}
                        {row.customerComment && (
                          <p className="text-slate-500 italic max-w-md truncate">
                            "{row.customerComment}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[10px] ${
                          row.npsScore <= 6
                            ? 'bg-rose-100 text-rose-800'
                            : row.npsScore <= 8
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          NPS: {row.npsScore}/10
                        </span>
                        {row.npsScore <= 6 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-600 text-white font-medium">
                            Detractor
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-xl text-xs transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={parsedRows.length === 0}
            className={`flex items-center gap-2 px-6 py-2 text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs disabled:opacity-50 ${
              channel === 'Voz'
                ? 'bg-blue-900 hover:bg-blue-800'
                : 'bg-teal-900 hover:bg-teal-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar e Importar {parsedRows.length > 0 ? `(${parsedRows.length} Encuestas)` : ''}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
