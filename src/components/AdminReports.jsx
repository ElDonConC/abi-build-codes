import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
  ShieldAlert, Trash2, CheckCircle, RefreshCw, AlertTriangle, 
  EyeOff, Eye, AlertOctagon, Check, KeyRound 
} from 'lucide-react';

export default function AdminReports({ user, onModerationChanged }) {
  const [reports, setReports] = useState([]);
  const [moderations, setModerations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Formulario rápido para cambiar código / motivo
  const [editCodeModal, setEditCodeModal] = useState(null); // { build_id, current_code, new_code }

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsRes, modRes] = await Promise.all([
        supabase.from('reportes').select('*').order('created_at', { ascending: false }),
        supabase.from('builds_moderacion').select('*'),
      ]);

      if (reportsRes.error) throw reportsRes.error;
      setReports(reportsRes.data || []);

      if (modRes.data) {
        const modMap = {};
        modRes.data.forEach(m => { modMap[m.build_id] = m; });
        setModerations(modMap);
      }
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los datos de administración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (id, nuevoEstado) => {
    try {
      const { error: err } = await supabase
        .from('reportes')
        .update({ estado: nuevoEstado })
        .eq('id', id);

      if (err) throw err;
      setReports(prev => prev.map(r => r.id === id ? { ...r, estado: nuevoEstado } : r));
    } catch (err) {
      alert('Error al actualizar estado: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este reporte permanentemente?')) return;
    try {
      const { error: err } = await supabase
        .from('reportes')
        .delete()
        .eq('id', id);

      if (err) throw err;
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Error al eliminar reporte: ' + err.message);
    }
  };

  // Moderación rápida de la build asociada al reporte
  const handleSetModeration = async (buildId, nuevoEstado, motivo = null, codigoReemplazo = null) => {
    try {
      const payload = {
        build_id: buildId,
        estado: nuevoEstado,
        motivo: motivo || (nuevoEstado === 'oculta' ? 'Desactivada por reporte de comunidad' : 'Reportado: posible código caducado'),
        codigo_reemplazo: codigoReemplazo || null,
        actualizado_por: user?.email || 'admin',
        updated_at: new Date().toISOString(),
      };

      const { error: err } = await supabase
        .from('builds_moderacion')
        .upsert(payload, { onConflict: 'build_id' });

      if (err) throw err;

      setModerations(prev => ({
        ...prev,
        [buildId]: payload,
      }));

      if (onModerationChanged) {
        onModerationChanged();
      }
    } catch (err) {
      alert('Error al guardar estado de moderación: ' + err.message);
    }
  };

  const handleResetModeration = async (buildId) => {
    try {
      const { error: err } = await supabase
        .from('builds_moderacion')
        .delete()
        .eq('build_id', buildId);

      if (err) throw err;

      setModerations(prev => {
        const next = { ...prev };
        delete next[buildId];
        return next;
      });

      if (onModerationChanged) {
        onModerationChanged();
      }
    } catch (err) {
      alert('Error al reactivar build: ' + err.message);
    }
  };

  const statusColors = {
    nuevo: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    en_revision: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    resuelto: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    rechazado: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };

  return (
    <div className="space-y-4">
      {/* Admin Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-white/8 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Centro de Gestión & Moderación de Builds
            </h2>
            <p className="text-xs text-slate-400">
              {reports.length} reportes registrados ({reports.filter(r => r.estado === 'nuevo').length} nuevos) · {Object.keys(moderations).length} builds moderadas
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refrescar</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Cargando reportes y estados desde Supabase...
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-white/10 rounded-2xl">
          No hay reportes enviados por la comunidad todavía.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const currentMod = moderations[r.build_id];
            const isOculta = currentMod?.estado === 'oculta';
            const hasWarning = currentMod?.estado === 'advertencia';

            return (
              <article
                key={r.id}
                className="p-4 sm:p-5 rounded-xl border border-white/8 bg-[#10151e]/80 backdrop-blur-md shadow-md text-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">
                      {r.arma}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      (ID #{r.build_id})
                    </span>
                    <code className="text-sky-300 bg-[#080b10] px-2 py-0.5 rounded border border-white/5 font-mono">
                      {r.codigo}
                    </code>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${statusColors[r.estado] || 'border-slate-500 text-slate-400'}`}>
                      {r.estado.replace('_', ' ')}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500">
                    {new Date(r.created_at).toLocaleString('es-ES')}
                  </span>
                </div>

                {/* Motivo & Comentario */}
                <div className="p-3 rounded-lg bg-[#080b10] border border-white/5 space-y-1">
                  <div className="text-amber-400 font-semibold">
                    Motivo: {r.motivo.replace('_', ' ')}
                  </div>
                  {r.comentario && (
                    <p className="text-slate-300">
                      "{r.comentario}"
                    </p>
                  )}
                  {r.contacto && (
                    <p className="text-slate-500 text-[11px]">
                      Contacto: {r.contacto}
                    </p>
                  )}
                </div>

                {/* Acciones de Moderación Directa sobre la Build */}
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      Acción sobre la Build #{r.build_id}:
                    </span>
                    {currentMod && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        isOculta 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        Estado catálogo: {currentMod.estado}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Botón Poner Advertencia */}
                    <button
                      onClick={() => handleSetModeration(r.build_id, 'advertencia', 'Reportado como posiblemente no funcional')}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        hasWarning 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' 
                          : 'bg-white/5 text-slate-300 border-white/10 hover:border-amber-400 hover:text-amber-300'
                      }`}
                      title="Muestra una advertencia preventiva en la tarjeta"
                    >
                      <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                      <span>{hasWarning ? 'En Advertencia' : 'Poner en Advertencia'}</span>
                    </button>

                    {/* Botón Ocultar / Desactivar */}
                    <button
                      onClick={() => handleSetModeration(r.build_id, 'oculta', 'Código no funcional verificado por admin')}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isOculta 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' 
                          : 'bg-white/5 text-slate-300 border-white/10 hover:border-rose-400 hover:text-rose-300'
                      }`}
                      title="Oculta esta build del catálogo público"
                    >
                      <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                      <span>{isOculta ? 'Build Oculta' : 'Ocultar Build'}</span>
                    </button>

                    {/* Botón Reactivar / Restaurar */}
                    {currentMod && (
                      <button
                        onClick={() => handleResetModeration(r.build_id)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Restaura la build como activa y normal"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Reactivar Normal</span>
                      </button>
                    )}

                    {/* Botón Reemplazar Código */}
                    <button
                      onClick={() => {
                        const nuevoCod = prompt(`Ingresa nuevo código funcional para ${r.arma}:`, currentMod?.codigo_reemplazo || r.codigo);
                        if (nuevoCod && nuevoCod.trim()) {
                          handleSetModeration(r.build_id, 'advertencia', 'Código actualizado por soporte', nuevoCod.trim());
                          handleUpdateStatus(r.id, 'resuelto');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Reemplaza el código roto por uno que sí funcione"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                      <span>{currentMod?.codigo_reemplazo ? 'Código Reemplazado ✓' : 'Sustituir Código'}</span>
                    </button>
                  </div>
                </div>

                {/* Status Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium text-[11px]">Estado del ticket:</span>
                    <select
                      value={r.estado}
                      onChange={(e) => handleUpdateStatus(r.id, e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="nuevo">Nuevo</option>
                      <option value="en_revision">En Revisión</option>
                      <option value="resuelto">Resuelto</option>
                      <option value="rechazado">Rechazado</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-all cursor-pointer"
                    title="Eliminar reporte de la lista"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

