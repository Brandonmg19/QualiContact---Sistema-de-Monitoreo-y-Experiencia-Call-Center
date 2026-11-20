import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';

interface ExcelImportModalProps {
  title: string;
  description: string;
  onDownloadTemplate: () => void;
  onProcessFile: (file: File) => Promise<{ success: boolean; rowCount?: number; errors: string[] }>;
  onClose: () => void;
  sampleColumns: string[];
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  title,
  description,
  onDownloadTemplate,
  onProcessFile,
  onClose,
  sampleColumns,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; rowCount?: number; errors: string[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const res = await onProcessFile(selectedFile);
      setResult(res);
      if (res.success && res.errors.length === 0) {
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-xs">
          {/* Download Template Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="font-semibold text-slate-800 block">¿No tienes el formato oficial?</span>
              <span className="text-[11px] text-slate-500">
                Descarga la plantilla con ejemplos y columnas requeridas.
              </span>
            </div>
            <button
              onClick={onDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Plantilla</span>
            </button>
          </div>

          {/* Expected Columns */}
          <div>
            <span className="text-slate-500 text-[11px] font-medium block mb-1.5">
              Columnas requeridas en la primera fila del archivo:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sampleColumns.map((col, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] border border-slate-200"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* File Picker */}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-slate-300 transition-colors bg-slate-50/50">
            <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800">
              {selectedFile ? selectedFile.name : 'Haz clic o arrastra tu archivo Excel / CSV'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Soporta .xlsx, .xls y .csv</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="mt-3 text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
            />
          </div>

          {/* Result / Errors */}
          {result && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                result.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>
                  {result.success
                    ? `¡Importación exitosa! (${result.rowCount || 0} registros procesados)`
                    : 'Hubo observaciones en la importación'}
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-[11px] max-h-24 overflow-y-auto">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-5">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile || isProcessing}
            className="px-4 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-2xs disabled:opacity-50"
          >
            {isProcessing ? 'Procesando archivo...' : 'Procesar e Importar'}
          </button>
        </div>

      </div>
    </div>
  );
};
