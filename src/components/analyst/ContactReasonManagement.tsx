import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ContactReasonItem } from '../../types';
import { 
  Tag, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RotateCcw,
  SlidersHorizontal,
  Info,
  Upload,
  Download
} from 'lucide-react';
import { ExcelImportModal } from '../common/ExcelImportModal';
import {
  downloadContactReasonTemplate,
  exportContactReasonsToExcel,
  parseContactReasonsFromFile
} from '../../utils/excel';

export const ContactReasonManagement: React.FC = () => {
  const { 
    contactReasons, 
    addContactReason, 
    editContactReason, 
    deleteContactReason, 
    toggleContactReasonStatus,
    replaceContactReasons,
    monitorings
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Excel import modal & feedback banner
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  // Filtered List
  const filteredReasons = useMemo(() => {
    return contactReasons.filter((r) => {
      if (statusFilter === 'ACTIVE' && !r.active) return false;
      if (statusFilter === 'INACTIVE' && r.active) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchDesc = r.description?.toLowerCase().includes(q) || false;
        const matchId = r.id.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchId) return false;
      }
      return true;
    });
  }, [contactReasons, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = contactReasons.length;
    const active = contactReasons.filter((r) => r.active).length;
    const inactive = total - active;

    // Count how many monitorings use reasons
    const usedCount = monitorings.filter((m) => !!m.contactReason).length;

    return { total, active, inactive, usedCount };
  }, [contactReasons, monitorings]);

  // Handlers
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ContactReasonItem) => {
    setModalMode('edit');
    setEditingId(item.id);
    setFormName(item.name);
    setFormDescription(item.description || '');
    setIsModalOpen(true);
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Por favor ingresa un nombre para el motivo de contacto.');
      return;
    }

    if (modalMode === 'create') {
      addContactReason(formName.trim(), formDescription.trim());
    } else if (editingId) {
      editContactReason(editingId, formName.trim(), formDescription.trim());
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = (id: string) => {
    deleteContactReason(id);
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Gestión de Motivo de contacto
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configura los motivos de contacto tipificados que los analistas seleccionan en el formulario de atención.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => exportContactReasonsToExcel(contactReasons)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors shadow-2xs"
            title="Descargar motivos actuales en Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={() => {
              setImportSuccessCount(null);
              setShowExcelImport(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            title="Reemplazar motivos cargando un archivo Excel"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Cargar Excel</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Motivo de Contacto</span>
          </button>
        </div>
      </div>

      {/* Import Success Banner */}
      {importSuccessCount !== null && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>¡Catálogo actualizado desde Excel!</strong> Se eliminaron los motivos anteriores y se cargaron{' '}
              <strong>{importSuccessCount}</strong> motivos de contacto activos.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setImportSuccessCount(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-medium block">Total Motivos</span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {stats.total}
          </span>
          <span className="text-[10px] text-slate-400">En catálogo</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-2xs">
          <span className="text-emerald-700 font-medium block">Activos en Formulario</span>
          <span className="text-xl font-bold font-mono text-emerald-800 mt-1 block">
            {stats.active}
          </span>
          <span className="text-[10px] text-emerald-600">Disponibles para selección</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-medium block">Inactivos / Deshabilitados</span>
          <span className="text-xl font-bold font-mono text-slate-600 mt-1 block">
            {stats.inactive}
          </span>
          <span className="text-[10px] text-slate-400">Ocultos en formulario</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-2xs">
          <span className="text-blue-700 font-medium block">Monitoreos con Motivo</span>
          <span className="text-xl font-bold font-mono text-blue-900 mt-1 block">
            {stats.usedCount}
          </span>
          <span className="text-[10px] text-blue-600">Casos evaluados</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar motivo por nombre, ID o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({contactReasons.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Activos ({stats.active})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'INACTIVE'
                  ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactivos ({stats.inactive})
            </button>
          </div>

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-2.5 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
              title="Limpiar búsqueda"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Motivos Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 w-28">ID</th>
                <th className="py-3 px-4">Nombre del Motivo</th>
                <th className="py-3 px-4">Descripción / Criterio</th>
                <th className="py-3 px-4 w-32 text-center">Estado</th>
                <th className="py-3 px-4 w-28 text-center">Fecha Creación</th>
                <th className="py-3 px-4 w-28 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredReasons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">No se encontraron motivos de contacto</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery ? 'Prueba ajustando los términos de búsqueda o filtros.' : 'Crea tu primer motivo con el botón superior.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReasons.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-500 text-[11px]">
                      {item.id}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md">
                      {item.description || <span className="text-slate-300 italic">Sin descripción</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleContactReasonStatus(item.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold text-[10px] transition-all cursor-pointer ${
                          item.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                        }`}
                        title="Haz clic para activar o desactivar este motivo en el formulario"
                      >
                        {item.active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Activo</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Inactivo</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500 font-mono text-[11px]">
                      {item.createdAt}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          title="Editar motivo"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(item.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                          title="Eliminar motivo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Mostrando {filteredReasons.length} de {contactReasons.length} motivos registrados</span>
          <span className="text-[10px] text-slate-400">Los motivos activos se despliegan automáticamente en el formulario de monitoreo</span>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm">
                  {modalMode === 'create' ? 'Nuevo Motivo de Contacto' : 'Editar Motivo de Contacto'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Nombre del Motivo *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Reclamo de Facturación, Falla Técnica, Cancelación..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Descripción / Criterio de Aplicación
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalla cuándo debe seleccionarse este motivo por parte del analista de experiencia..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-[11px] text-blue-900">
                <p>
                  💡 <strong>Impacto:</strong> Al guardar este motivo, estará disponible de forma inmediata en la lista desplegable del <strong>Formulario para Analizar Atención</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs"
                >
                  {modalMode === 'create' ? 'Crear Motivo' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200 text-xs">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-sm text-slate-900">¿Eliminar Motivo de Contacto?</h4>
            </div>
            <p className="text-slate-600 mb-4">
              Esta acción eliminará el motivo del catálogo de opciones. Los monitoreos históricos conservarán el texto registrado.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(deletingId)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL IMPORT MODAL (Replaces all previous contact reasons) */}
      {showExcelImport && (
        <ExcelImportModal
          title="Carga Masiva de Motivos de Contacto"
          description="⚠️ Atención: Al procesar el Excel se eliminarán todos los motivos guardados anteriormente y se cargarán únicamente los del archivo."
          sampleColumns={['MOTIVO DE CONTACTO', 'DESCRIPCION']}
          onDownloadTemplate={() => downloadContactReasonTemplate()}
          onProcessFile={async (file: File) => {
            const res = await parseContactReasonsFromFile(file);
            if (res.success && res.reasons.length > 0) {
              replaceContactReasons(res.reasons);
              setImportSuccessCount(res.reasons.length);
            }
            return {
              success: res.success,
              rowCount: res.reasons.length,
              errors: res.errors,
            };
          }}
          onClose={() => setShowExcelImport(false)}
        />
      )}

    </div>
  );
};
