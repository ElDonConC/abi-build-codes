import React, { useState } from 'react';
import { supabase } from '../supabase';
import { X, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';

export default function ReportModal({ isOpen, onClose, build }) {
  const [motivo, setMotivo] = useState('no_funciona');
  const [comentario, setComentario] = useState('');
  const [contacto, setContacto] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !build) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('reportes').insert([
        {
          build_id: build.id,
          arma: build.arma,
          codigo: build.codigo,
          motivo,
          comentario: comentario.trim() || null,
          contacto: contacto.trim() || null,
          estado: 'nuevo',
        },
      ]);
      if (err) throw err;
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err) {
      setError(err.message || 'Error al enviar reporte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0f141c] border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/80 text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-rose-500/10 border border-rose-500/30 text-rose-400 uppercase mb-2">
            Incidencia de Build
          </div>
          <h2 className="text-lg font-bold text-white">
            Reportar {build.arma}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
            {build.codigo}
          </p>
        </div>

        {success ? (
          <div className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h3 className="text-base font-bold text-white">Reporte Enviado</h3>
            <p className="text-xs text-slate-400">
              Gracias por colaborar. Lo revisaremos a la brevedad.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1">
                Motivo del reporte
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-amber-400"
              >
                <option value="no_funciona">Código no funciona en el juego</option>
                <option value="arma_incorrecta">Arma o variante incorrecta</option>
                <option value="precio_desactualizado">Precio muy desactualizado</option>
                <option value="otro">Otro motivo</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1">
                Detalles adicionales (opcional)
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Explica qué error aparece o qué accesorio falta..."
                rows={3}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1">
                Discord o Email (opcional)
              </label>
              <input
                type="text"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="operador#1234"
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Enviando...' : 'Enviar Reporte'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
